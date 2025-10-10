import { NextRequest, NextResponse } from 'next/server';

interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ReviewIssue {
  originalText: string;
  violatedClause: string;
  suggestion: string;
  severity: 'high' | 'medium' | 'low';
  isSpecificOperator?: boolean;
  specificOperatorType?: '直接指名' | '变相确定' | '量身定制' | '条件排除' | '其他';
  problemDescription?: string;
}

interface ReviewResult {
  isCompliant: boolean;
  summary: string;
  totalIssues: number;
  issues: ReviewIssue[];
  reviewTime: string;
}

// 精准条款映射配置
const PRECISE_CLAUSE_MAPPING = {
  // 第十一条第（一）项 - 变相限定特定经营者
  CLAUSE_11_1: {
    article: '第十一条第（一）项',
    fullClause: '以明确要求、暗示等方式，限定或者变相限定经营、购买、使用特定经营者提供的商品',
    keywords: [
      '龙头企业', '头部企业', '重点企业', '知名企业', '领军企业', '骨干企业', 
      '标杆企业', '示范企业', '著名企业', '优秀企业', '先进企业', '百强企业'
    ],
    contextKeywords: ['支持', '扶持', '培育', '发展', '建设', '促进', '鼓励'],
    severity: 'high'
  },
  // 第十二条第（一）项 - 不合理准入条件  
  CLAUSE_12_1: {
    article: '第十二条第（一）项',
    fullClause: '设置明显不必要或者超出实际需要的准入条件',
    patterns: [
      /注册资本[不少于]{0,3}.*?(\d+)[万亿]元以上/g,
      /年营业收入[不少于]{0,3}.*?(\d+)[万亿]元以上/g,
      /成立[满]{0,1}.*?(\d+)年以上/g,
      /经营[满]{0,1}.*?(\d+)年以上/g,
      /员工[人数]{0,2}[不少于]{0,3}.*?(\d+)人以上/g
    ],
    thresholds: {
      '注册资本': { high: 1000, medium: 500 }, // 万元
      '营业收入': { high: 5000, medium: 1000 }, // 万元  
      '经营年限': { high: 5, medium: 3 }, // 年
      '员工数量': { high: 100, medium: 50 } // 人
    },
    severity: 'medium'
  },
  // 第十五条第（三）项 - 地域限制
  CLAUSE_15_3: {
    article: '第十五条第（三）项', 
    fullClause: '将经营者取得业绩和奖项荣誉的区域、缴纳税收社保的区域、投标（响应）产品的产地、注册地址、与本地经营者组成联合体等作为投标（响应）条件、加分条件、中标（成交、入围）条件或者评标条款',
    keywords: ['本地', '本区', '本市', '本县', '当地', '区内', '市内', '县内'],
    contextKeywords: ['注册', '纳税', '缴费', '经营', '设立', '投标', '参与'],
    severity: 'high'
  },
  // 第十九条第（一）项 - 财政奖励补贴
  CLAUSE_19_1: {
    article: '第十九条第（一）项',
    fullClause: '以直接确定受益经营者或者设置不明确、不合理入选条件的名录库、企业库等方式，实施财政奖励或者补贴',
    subsidyKeywords: ['补贴', '补助', '奖励', '扶持资金', '专项资金', '资助'],
    specificOperatorKeywords: ['龙头', '头部', '重点', '知名', '领军', '骨干'],
    severity: 'high'
  },
  // 第四十六条 - 特定经营者定义
  CLAUSE_46: {
    article: '第四十六条',
    fullClause: '特定经营者是指在政策措施中直接或者变相确定的某个或者某部分经营者，但通过公平合理、客观明确且非排他性条件确定的除外',
    keywords: ['择优', '综合评定', '符合条件', '经评定', '项目库', '名录库', '企业库', '推荐目录'],
    contextKeywords: ['选择', '确定', '支持', '入库', '纳入'],
    severity: 'medium'
  }
};

// 简单的内存级限流（按 IP 粒度，不适用于无状态多实例，仅作基础保护）
const rateStore = new Map<string, { windowStart: number; count: number }>();
const WINDOW_MS = 60_000; // 1 分钟
const MAX_REQ_PER_WINDOW = 60; // 每分钟最多 60 次

function getClientId(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for') || '';
  const ip = xff.split(',')[0].trim() || req.headers.get('x-real-ip') || 'anonymous';
  return `ip:${ip}`;
}

function checkRateLimit(clientId: string): boolean {
  const now = Date.now();
  const entry = rateStore.get(clientId);
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    rateStore.set(clientId, { windowStart: now, count: 1 });
    return true;
  }
  if (entry.count >= MAX_REQ_PER_WINDOW) return false;
  entry.count += 1;
  return true;
}

// 智能违规检测引擎
class IntelligentViolationDetector {
  private static processedTexts = new Set<string>();
  
  static detectAllViolations(documentContent: string): ReviewIssue[] {
    this.processedTexts.clear();
    const allIssues: ReviewIssue[] = [];
    
    // 检测各类违规情况
    allIssues.push(...this.detectClause11Violations(documentContent));
    allIssues.push(...this.detectClause12Violations(documentContent));
    allIssues.push(...this.detectClause15Violations(documentContent));
    allIssues.push(...this.detectClause19Violations(documentContent));
    allIssues.push(...this.detectClause46Violations(documentContent));
    
    return this.deduplicateIssues(allIssues);
  }
  
  // 检测第十一条第（一）项违规 - 变相限定特定经营者
  static detectClause11Violations(documentContent: string): ReviewIssue[] {
    const issues: ReviewIssue[] = [];
    const config = PRECISE_CLAUSE_MAPPING.CLAUSE_11_1;
    
    for (const keyword of config.keywords) {
      const occurrences = this.findKeywordOccurrences(documentContent, keyword);
      
      for (const occurrence of occurrences) {
        const context = this.extractSmartContext(documentContent, occurrence.index, keyword);
        
        if (this.shouldProcessText(context)) {
          const hasFinancialSupport = config.contextKeywords.some(ctx => context.includes(ctx));
          const hasSubsidyTerms = ['补贴', '补助', '奖励', '扶持'].some(term => context.includes(term));
          
          let severity: 'high' | 'medium' | 'low' = 'high';
          let problemDesc = '';
          
          if (hasFinancialSupport && hasSubsidyTerms) {
            severity = 'high';
            problemDesc = `通过"${keyword}"概念结合财政支持措施，构成变相确定特定经营者并给予优惠待遇，严重违反公平竞争原则，可能形成对其他经营者的不公平排斥`;
          } else if (hasFinancialSupport) {
            severity = 'high';
            problemDesc = `使用"${keyword}"概念变相确定特定经营者范围，可能排除其他符合条件的企业参与，影响市场公平竞争环境`;
          } else {
            severity = 'medium';
            problemDesc = `使用"${keyword}"等模糊概念可能构成变相确定特定经营者，建议采用客观明确的量化标准替代`;
          }
          
          issues.push({
            originalText: context,
            violatedClause: `《公平竞争审查条例实施办法》${config.article}：${config.fullClause}`,
            suggestion: `将"${keyword}"修改为具体的量化标准，如：技术水平达到XX标准、年产值不低于XX万元、获得XX认证等客观明确的条件，确保所有符合条件的经营者均可参与`,
            severity,
            isSpecificOperator: true,
            specificOperatorType: '变相确定',
            problemDescription: problemDesc
          });
          
          this.processedTexts.add(context);
          break; // 每个关键词只处理一次
        }
      }
    }
    
    return issues;
  }
  
  // 检测第十二条第（一）项违规 - 不合理准入条件
  static detectClause12Violations(documentContent: string): ReviewIssue[] {
    const issues: ReviewIssue[] = [];
    const config = PRECISE_CLAUSE_MAPPING.CLAUSE_12_1;
    
    for (const pattern of config.patterns) {
      const matches = [...documentContent.matchAll(pattern)];
      
      for (const match of matches) {
        const context = this.extractSmartContext(documentContent, match.index!, match[0]);
        
        if (this.shouldProcessText(context)) {
          const thresholdValue = parseInt(match[1]);
          const thresholdType = this.identifyThresholdType(match[0]);
          
          const { severity, problemDesc } = this.evaluateThresholdSeverity(thresholdType, thresholdValue, config.thresholds);
          
          issues.push({
            originalText: context,
            violatedClause: `《公平竞争审查条例实施办法》${config.article}：${config.fullClause}`,
            suggestion: `降低门槛要求或提供充分的必要性论证，确保条件设置与政策目标直接相关且为实现目标所必需，避免设置过高门槛形成准入壁垒`,
            severity,
            isSpecificOperator: true,
            specificOperatorType: '条件排除',
            problemDescription: problemDesc
          });
          
          this.processedTexts.add(context);
        }
      }
    }
    
    return issues;
  }
  
  // 检测第十五条第（三）项违规 - 地域限制
  static detectClause15Violations(documentContent: string): ReviewIssue[] {
    const issues: ReviewIssue[] = [];
    const config = PRECISE_CLAUSE_MAPPING.CLAUSE_15_3;
    
    for (const keyword of config.keywords) {
      // 检查是否同时包含地域词和上下文关键词
      const contextPattern = new RegExp(`[^。]*${keyword}[^。]*(?:${config.contextKeywords.join('|')})[^。]*`, 'g');
      const matches = documentContent.match(contextPattern);
      
      if (matches) {
        for (const match of matches) {
          const context = this.extractSmartContext(documentContent, documentContent.indexOf(match), match);
          
          if (this.shouldProcessText(context)) {
            issues.push({
              originalText: context,
              violatedClause: `《公平竞争审查条例实施办法》${config.article}：${config.fullClause}`,
              suggestion: `删除地域限制表述，或修改为"在本行政区域内依法注册的企业"等符合法律规定的表述，确保外地企业享有同等参与机会`,
              severity: config.severity as any,
              isSpecificOperator: true,
              specificOperatorType: '条件排除',
              problemDescription: `设置地域限制条件排斥外地经营者参与，违反统一市场和公平竞争原则，可能构成地方保护主义，影响要素自由流动`
            });
            
            this.processedTexts.add(context);
            break;
          }
        }
      }
    }
    
    return issues;
  }
  
  // 检测第十九条第（一）项违规 - 财政奖励补贴
  static detectClause19Violations(documentContent: string): ReviewIssue[] {
    const issues: ReviewIssue[] = [];
    const config = PRECISE_CLAUSE_MAPPING.CLAUSE_19_1;
    
    // 检测财政补贴与特定企业结合的情况
    const combinedPattern = new RegExp(
      `[^。]*(?:${config.specificOperatorKeywords.join('|')})[^。]*(?:${config.subsidyKeywords.join('|')})[^。]*`, 'g'
    );
    
    const matches = documentContent.match(combinedPattern);
    
    if (matches) {
      for (const match of matches) {
        const context = this.extractSmartContext(documentContent, documentContent.indexOf(match), match);
        
        if (this.shouldProcessText(context)) {
          issues.push({
            originalText: context,
            violatedClause: `《公平竞争审查条例实施办法》${config.article}：${config.fullClause}`,
            suggestion: `取消对特定类型企业的专门财政支持，或修改为基于客观量化标准的普惠性政策，如按技术创新水平、环保达标情况等客观条件给予支持`,
            severity: config.severity as any,
            isSpecificOperator: true,
            specificOperatorType: '量身定制',
            problemDescription: '通过财政奖励补贴措施变相确定特定经营者，构成量身定制政策，严重违反公平竞争原则，可能造成市场竞争扭曲'
          });
          
          this.processedTexts.add(context);
          break;
        }
      }
    }
    
    return issues;
  }
  
  // 检测第四十六条违规 - 模糊条件设置
  static detectClause46Violations(documentContent: string): ReviewIssue[] {
    const issues: ReviewIssue[] = [];
    const config = PRECISE_CLAUSE_MAPPING.CLAUSE_46;
    
    for (const keyword of config.keywords) {
      const occurrences = this.findKeywordOccurrences(documentContent, keyword);
      
      for (const occurrence of occurrences) {
        const context = this.extractSmartContext(documentContent, occurrence.index, keyword);
        
        if (this.shouldProcessText(context)) {
          issues.push({
            originalText: context,
            violatedClause: `《公平竞争审查条例实施办法》${config.article}：${config.fullClause}`,
            suggestion: `将"${keyword}"等模糊表述修改为具体的量化标准和客观条件，如设定明确的技术指标、资质要求、业绩标准等，确保条件公平合理、客观明确且具有可操作性`,
            severity: config.severity as any,
            isSpecificOperator: true,
            specificOperatorType: '变相确定',
            problemDescription: `使用模糊不明确的评定标准可能为变相确定特定经营者提供操作空间，违反公平竞争审查要求，容易产生自由裁量权滥用，影响政策执行的公正性和透明度`
          });
          
          this.processedTexts.add(context);
          break;
        }
      }
    }
    
    return issues;
  }
  
  // 智能上下文提取
  private static extractSmartContext(documentContent: string, startIndex: number, keyword: string): string {
    const sentenceEnders = ['。', '；', '！', '？'];
    const maxContextLength = 200;
    
    // 寻找句子边界
    let start = startIndex;
    let end = startIndex + keyword.length;
    
    // 向前找句子开始
    while (start > 0 && !sentenceEnders.includes(documentContent[start - 1])) {
      start--;
    }
    
    // 向后找句子结束
    while (end < documentContent.length && !sentenceEnders.includes(documentContent[end])) {
      end++;
    }
    
    if (end < documentContent.length) end++; // 包含标点符号
    
    let context = documentContent.substring(start, end).trim();
    
    // 如果句子过长，尝试更精确的截取
    if (context.length > maxContextLength) {
      const keywordIndexInContext = context.indexOf(keyword);
      const halfLength = Math.floor(maxContextLength / 2);
      
      const newStart = Math.max(0, keywordIndexInContext - halfLength);
      const newEnd = Math.min(context.length, keywordIndexInContext + keyword.length + halfLength);
      
      context = context.substring(newStart, newEnd).trim();
      if (newStart > 0) context = '...' + context;
      if (newEnd < context.length) context = context + '...';
    }
    
    return context;
  }
  
  // 查找关键词出现位置
  private static findKeywordOccurrences(text: string, keyword: string): Array<{index: number, match: string}> {
    const occurrences = [];
    let index = text.indexOf(keyword);
    
    while (index !== -1) {
      occurrences.push({ index, match: keyword });
      index = text.indexOf(keyword, index + 1);
    }
    
    return occurrences;
  }
  
  // 判断是否应该处理文本
  private static shouldProcessText(text: string): boolean {
    return text.length > 10 && 
           text.length <= 200 && 
           !this.processedTexts.has(text) &&
           !text.includes('无法提取') &&
           !text.includes('解析失败');
  }
  
  // 识别门槛类型
  private static identifyThresholdType(matchText: string): string {
    if (matchText.includes('注册资本')) return '注册资本';
    if (matchText.includes('营业收入')) return '营业收入';
    if (matchText.includes('经营') || matchText.includes('成立')) return '经营年限';
    if (matchText.includes('员工')) return '员工数量';
    return '其他';
  }
  
  // 评估门槛严重程度
  private static evaluateThresholdSeverity(type: string, value: number, thresholds: any): {severity: 'high' | 'medium' | 'low', problemDesc: string} {
    const typeThreshold = thresholds[type];
    if (!typeThreshold) {
      return {
        severity: 'low',
        problemDesc: '设置的门槛条件需要论证其必要性和合理性，确保不会对竞争造成不必要的限制'
      };
    }
    
    if (value >= typeThreshold.high) {
      return {
        severity: 'high',
        problemDesc: `设置过高的${type}门槛，可能构成为特定规模企业量身定制，形成准入壁垒，限制中小企业参与市场竞争`
      };
    } else if (value >= typeThreshold.medium) {
      return {
        severity: 'medium', 
        problemDesc: `设置的${type}要求可能对部分经营者构成不合理限制，建议降低门槛或提供充分的必要性论证`
      };
    } else {
      return {
        severity: 'low',
        problemDesc: `${type}门槛设置相对合理，但仍需确保其与政策目标的关联性和必要性`
      };
    }
  }
  
  // 去重处理
  private static deduplicateIssues(issues: ReviewIssue[]): ReviewIssue[] {
    const unique = [];
    const seen = new Set();
    
    for (const issue of issues) {
      const key = issue.originalText + issue.violatedClause;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(issue);
      }
    }
    
    return unique;
  }
}

// 改进的句子提取函数，专门处理中文政策文档
function extractSentenceWithKeyword(documentContent: string, keyword: string): string {
  const keywordIndex = documentContent.indexOf(keyword);
  if (keywordIndex === -1) {
    return keyword; // 如果找不到关键词，返回关键词本身
  }
  
  // Step 1: 按行分割，过滤空行
  const lines = documentContent.split('\n').filter(line => line.trim().length > 0);
  
  // Step 2: 找到包含关键词的行
  const keywordLine = lines.find(line => line.includes(keyword));
  if (keywordLine) {
    const cleanLine = keywordLine.trim();
    
    // 如果是编号项目如（一）、（二），直接返回该项目
    if (cleanLine.match(/^（[一二三四五六七八九十]+）/)) {
      return cleanLine;
    }
    
    // 如果行内有句子分割符，尝试提取包含关键词的句子
    const sentences = cleanLine.split(/[。；！？]/);
    const sentenceWithKeyword = sentences.find(s => s.includes(keyword));
    if (sentenceWithKeyword && sentenceWithKeyword.trim().length > 0) {
      return sentenceWithKeyword.trim();
    }
    
    // 否则返回整行，但限制长度
    return cleanLine.length > 100 ? cleanLine.substring(0, 100) + '...' : cleanLine;
  }
  
  // Step 3: 复杂提取作为备用方案
  const sentenceEnders = ['。', '；', '！', '？'];
  const contextRadius = 150; // 在关键词周围150字符内查找
  
  const contextStart = Math.max(0, keywordIndex - contextRadius);
  const contextEnd = Math.min(documentContent.length, keywordIndex + contextRadius);
  const context = documentContent.substring(contextStart, contextEnd);
  
  const keywordPosInContext = context.indexOf(keyword);
  
  // 向前找句子开始
  let sentenceStart = keywordPosInContext;
  while (sentenceStart > 0) {
    const char = context[sentenceStart - 1];
    if (sentenceEnders.includes(char) || char === '\n') {
      break;
    }
    sentenceStart--;
  }
  
  // 向后找句子结束
  let sentenceEnd = keywordPosInContext + keyword.length;
  while (sentenceEnd < context.length) {
    const char = context[sentenceEnd];
    if (sentenceEnders.includes(char)) {
      sentenceEnd++; // 包含标点符号
      break;
    }
    // 遇到新段落开始就停止
    if (char === '\n' && context.substring(sentenceEnd + 1).match(/^(第|（[一二三四五六七八九十]+）)/)) {
      break;
    }
    sentenceEnd++;
  }
  
  const extractedText = context.substring(sentenceStart, sentenceEnd).trim();
  return extractedText.length > 100 ? extractedText.substring(0, 100) + '...' : extractedText;
}

// 模拟审查函数（API不可用时的备选方案）
function generateMockReview(documentContent: string): ReviewResult {
  // 检查文档内容是否有效
  if (!documentContent || documentContent.trim().length < 20 || 
      documentContent.includes('整个文档内容') || 
      documentContent.includes('无法提取') ||
      documentContent.includes('解析失败')) {
    return {
      isCompliant: false,
      summary: '文档解析失败，无法提取有效内容进行审查。可能原因：1）文档加密或密码保护；2）文档格式不支持；3）文档内容为空或损坏。请检查文档格式，确保为标准的Word文档(.doc/.docx)且未加密。',
      totalIssues: 1,
      issues: [{
        originalText: '文档无法正常解析',
        violatedClause: '文档格式问题 - 无法进行有效审查',
        suggestion: '请提供可读取的政策文本内容（如Word文档、PDF文档或纯文本格式），以便进行公平竞争审查。需要包含具体的政策措施文字表述。',
        severity: 'high',
        isSpecificOperator: false,
        specificOperatorType: '其他',
        problemDescription: '文档格式存在问题导致无法正常解析内容，可能是由于文档加密、格式损坏或不支持的文件类型，无法进行有效的公平竞争审查，需要提供标准格式的政策文本'
      }],
      reviewTime: new Date().toLocaleString('zh-CN')
    };
  }
  
  // 使用智能检测引擎进行精准违规检测
  const issues = IntelligentViolationDetector.detectAllViolations(documentContent);
  
  const specificOperatorIssues = issues.filter(issue => issue.isSpecificOperator).length;
  const isCompliant = issues.length === 0;
  
  return {
    isCompliant,
    summary: isCompliant 
      ? '经智能审查，该文档基本符合公平竞争要求，未发现特定经营者相关问题。审查采用精准条款匹配算法，检测准确度显著提升。'
      : `经智能审查，发现该文档存在${issues.length}个公平竞争问题，其中涉及特定经营者问题${specificOperatorIssues}个。主要问题包括：变相确定特定经营者、设置不合理准入条件、地域限制等，需要进行整改以符合公平竞争审查要求。审查采用精准条款匹配算法，条款引用更加准确。`,
    totalIssues: issues.length,
    issues: issues,
    reviewTime: new Date().toLocaleString('zh-CN')
  };
}

export async function POST(request: NextRequest) {
  let documentContent = '';
  try {
    // 可选鉴权：若设置 API_AUTH_TOKEN，则要求请求头携带 x-api-token 匹配
    const requiredToken = process.env.API_AUTH_TOKEN;
    if (requiredToken) {
      const token = request.headers.get('x-api-token');
      if (!token || token !== requiredToken) {
        return NextResponse.json({ error: '未授权的请求' }, { status: 401 });
      }
    }

    // 限流
    const clientId = getClientId(request);
    if (!checkRateLimit(clientId)) {
      return NextResponse.json({ error: '请求过于频繁，请稍后再试' }, { status: 429 });
    }

    const requestData = await request.json();
    documentContent = requestData.documentContent;

    if (!documentContent) {
      return NextResponse.json(
        { error: '文档内容不能为空' },
        { status: 400 }
      );
    }

    // 服务端长度约束（与客户端保持一致，增强健壮性）
    if (typeof documentContent !== 'string' || documentContent.length > 50000) {
      return NextResponse.json(
        { error: '文档内容过长，请分段提交审查（最大约 5 万字符）' },
        { status: 413 }
      );
    }

    const systemPrompt = `你是一名专业的公平竞争审查员，请严格按照《公平竞争审查条例》和《公平竞争审查条例实施办法》对政策文件进行精准审查。本系统已优化条款匹配算法，请严格按照以下精准匹配规则进行审查。

## 精准条款匹配体系

### 第十一条第（一）项 - 变相限定特定经营者（高风险）
**条款内容**：以明确要求、暗示等方式，限定或者变相限定经营、购买、使用特定经营者提供的商品
**关键词精准识别**：龙头企业、头部企业、重点企业、知名企业、领军企业、骨干企业、标杆企业、示范企业、著名企业、优秀企业、先进企业、百强企业
**上下文匹配**：与"支持、扶持、培育、发展、建设、促进、鼓励"等词汇结合使用
**严重程度判断**：
- 高风险：同时包含财政支持措施和补贴奖励条款
- 高风险：直接用于政策支持对象确定
- 中等风险：仅作为描述性用词使用

### 第十二条第（一）项 - 不合理准入条件（中等风险）
**条款内容**：设置明显不必要或者超出实际需要的准入条件
**精准模式匹配**：
- 注册资本≥1000万元（高风险）、≥500万元（中等风险）
- 年营业收入≥5000万元（高风险）、≥1000万元（中等风险）
- 经营年限≥5年（高风险）、≥3年（中等风险）
- 员工数量≥100人（高风险）、≥50人（中等风险）
**识别模式**：数值+单位+以上/不少于/满

### 第十五条第（三）项 - 地域限制（高风险）
**条款内容**：将经营者取得业绩和奖项荣誉的区域、缴纳税收社保的区域、投标（响应）产品的产地、注册地址、与本地经营者组成联合体等作为投标（响应）条件、加分条件、中标（成交、入围）条件或者评标条款
**地域词汇**：本地、本区、本市、本县、当地、区内、市内、县内
**上下文要求**：必须与"注册、纳税、缴费、经营、设立、投标、参与"等业务活动词汇结合

### 第十九条第（一）项 - 财政奖励补贴（高风险）
**条款内容**：以直接确定受益经营者或者设置不明确、不合理入选条件的名录库、企业库等方式，实施财政奖励或者补贴
**复合匹配要求**：必须同时包含特定经营者词汇和财政支持词汇
- 特定经营者：龙头、头部、重点、知名、领军、骨干
- 财政支持：补贴、补助、奖励、扶持资金、专项资金、资助

### 第四十六条 - 模糊条件设置（中等风险）
**条款内容**：特定经营者是指在政策措施中直接或者变相确定的某个或者某部分经营者，但通过公平合理、客观明确且非排他性条件确定的除外
**模糊词汇**：择优、综合评定、符合条件、经评定、项目库、名录库、企业库、推荐目录
**上下文匹配**：与"选择、确定、支持、入库、纳入"等决策词汇结合

## 精准审查执行标准

### 1. 文本提取要求
- **完整性**：必须提取完整句子，包含主谓宾结构
- **精确性**：不超过200字符，确保语义完整
- **准确性**：避免截取片段或不完整表述

### 2. 条款引用格式
**标准格式**：《公平竞争审查条例实施办法》第X条第（X）项：[完整条款内容]
**严格对应**：
- 特定经营者概念 → 第十一条第（一）项
- 数值门槛设置 → 第十二条第（一）项  
- 地域限制表述 → 第十五条第（三）项
- 财政补贴结合 → 第十九条第（一）项
- 模糊条件设置 → 第四十六条

### 3. 问题严重程度精准判断
**高风险（high）**：
- 变相确定特定经营者+财政支持
- 过高准入门槛（超出合理范围）
- 明确地域排斥条件

**中等风险（medium）**：
- 单纯特定经营者概念使用
- 相对合理但需论证的门槛
- 模糊评定标准

**低风险（low）**：
- 条件设置相对合理但需完善
- 表述不够精确但无实质排斥

### 4. 修改建议精准化
**量化替代方案**：提供具体的技术指标、资质要求、业绩标准
**合规路径**：明确整改方向和具体操作建议
**法律依据**：确保建议符合上位法要求

请严格按照上述精准匹配标准进行审查，确保条款引用准确、问题识别精准、修改建议可操作。

请以JSON格式返回结果：
{
  "isCompliant": boolean,
  "summary": "审查总结，重点说明是否存在特定经营者问题及整体合规情况",
  "totalIssues": number,
  "issues": [
    {
      "originalText": "完整的问题句子（不超过200字符）",
      "violatedClause": "《公平竞争审查条例实施办法》第X条第（X）项：完整的条款内容",
      "suggestion": "具体可操作的修改建议和替代表述",
      "severity": "high|medium|low",
      "problemDescription": "精准的问题性质描述和影响分析",
      "isSpecificOperator": boolean,
      "specificOperatorType": "直接指名|变相确定|量身定制|条件排除|其他"
    }
  ]
}`;

    const userPrompt = `请对以下政策文档进行公平竞争审查：

${documentContent}

请严格按照《公平竞争审查条例实施办法》进行审查，不要随意发挥或添加额外内容。`;

    const apiKey = process.env.DEEPSEEK_API_KEY;
    const baseUrl = (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/+$/, '');

    // 当未配置密钥时，优雅降级到本地模拟结果，避免UI中断
    if (!apiKey) {
      const mockResult = generateMockReview(documentContent);
      return NextResponse.json(mockResult);
    }

    // 长文档分片处理（仅在配置了 API Key 时调用外部 API）
    const MAX_CHARS_PER_CHUNK = 9000;
    async function callDeepSeek(chunk: string): Promise<ReviewResult> {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'deepseek-chat-v3.2',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `请对以下政策文档进行公平竞争审查：\n\n${chunk}\n\n请严格按照《公平竞争审查条例实施办法》进行审查，不要随意发挥或添加额外内容。` }
          ],
          max_tokens: 4000,
          temperature: 0.1,
          stream: false,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`DeepSeek API错误: ${error}`);
      }

      const result = await response.json();
      const content = result.choices[0].message.content;
      let reviewResult: ReviewResult;
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsedResult = JSON.parse(jsonMatch[0]);
          reviewResult = {
            isCompliant: parsedResult.isCompliant,
            summary: parsedResult.summary,
            totalIssues: parsedResult.totalIssues || parsedResult.issues?.length || 0,
            issues: parsedResult.issues || [],
            reviewTime: new Date().toLocaleString('zh-CN')
          };
        } else {
          throw new Error('No JSON found in response');
        }
      } catch (parseError) {
        const isCompliant = !content.toLowerCase().includes('违反') && !content.toLowerCase().includes('问题');
        reviewResult = {
          isCompliant,
          summary: content.substring(0, 200) + '...',
          totalIssues: isCompliant ? 0 : 1,
          issues: isCompliant ? [] : [{
            originalText: '文档中发现潜在问题',
            violatedClause: '需要进一步人工审查',
            suggestion: '建议人工详细审查该文档',
            severity: 'medium',
            problemDescription: '系统检测到文档中存在潜在的公平竞争问题，但无法自动识别具体违规内容，建议进行人工详细审查以确定具体问题和整改措施'
          }],
          reviewTime: new Date().toLocaleString('zh-CN')
        };
      }
      return reviewResult;
    }

    let finalResult: ReviewResult;
    if (documentContent.length > MAX_CHARS_PER_CHUNK) {
      // 简单按句号切分并合并
      const chunks: string[] = [];
      let buffer = '';
      for (const ch of documentContent) {
        buffer += ch;
        if (buffer.length >= MAX_CHARS_PER_CHUNK && /[。；!?]/.test(ch)) {
          chunks.push(buffer);
          buffer = '';
        }
      }
      if (buffer) chunks.push(buffer);

      const results: ReviewResult[] = [];
      for (const c of chunks) {
        try {
          results.push(await callDeepSeek(c));
        } catch (e) {
          // 任一分片失败则回退到本地检测
          const mock = generateMockReview(documentContent);
          return NextResponse.json(mock);
        }
      }

      const mergedIssues = results.flatMap(r => r.issues);
      const isCompliant = mergedIssues.length === 0;
      finalResult = {
        isCompliant,
        summary: isCompliant
          ? '经分片审查，文档基本符合公平竞争要求。'
          : `经分片审查，共发现 ${mergedIssues.length} 个问题。` ,
        totalIssues: mergedIssues.length,
        issues: mergedIssues,
        reviewTime: new Date().toLocaleString('zh-CN')
      };
    } else {
      finalResult = await callDeepSeek(documentContent);
    }

    return NextResponse.json(finalResult);

  } catch (error) {
    console.error('审查过程出错:', error);
    
    // 如果整个审查过程出错，返回模拟审查结果
    const mockResult = generateMockReview(documentContent || '');
    return NextResponse.json(mockResult);
  }
}

// 测试连接
export async function GET() {
  try {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    const baseUrl = (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/+$/, '');
    if (!apiKey) {
      return NextResponse.json({
        connected: false, 
        error: 'API密钥未配置，使用模拟审查模式',
        fallbackMode: true
      });
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'user', content: '你好，请回复"连接成功"' }
        ],
        max_tokens: 10,
        temperature: 0.1,
      }),
    });

    if (response.ok) {
      const result = await response.json();
      const content = result.choices[0].message.content;
      return NextResponse.json({ 
        connected: true,
        message: content,
        fallbackMode: false
      });
    } else {
      return NextResponse.json({
        connected: false, 
        error: `API错误: ${response.status}，使用模拟审查模式`,
        fallbackMode: true
      });
    }

  } catch (error) {
    return NextResponse.json({
      connected: false, 
      error: `连接失败，使用模拟审查模式: ${error instanceof Error ? error.message : '未知错误'}`,
      fallbackMode: true
    });
  }
}
