// DeepSeek V3.2 API Integration
export interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface DeepSeekResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface ReviewIssue {
  originalText: string;
  violatedClause: string;
  suggestion: string;
  severity: 'high' | 'medium' | 'low';
  pageNumber?: number;
  isSpecificOperator?: boolean;
  specificOperatorType?: '直接指名' | '变相确定' | '量身定制' | '条件排除' | '其他';
  problemDescription?: string;
}

export interface ReviewResult {
  isCompliant: boolean;
  summary: string;
  totalIssues: number;
  issues: ReviewIssue[];
  reviewTime: string;
}

class DeepSeekAPI {
  constructor() {
    // 客户端不再直接调用外部API
  }

  // 基于《公平竞争审查条例实施办法》的严格审查
  async reviewDocument(documentContent: string): Promise<ReviewResult> {
    try {
      const response = await fetch('/api/review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          documentContent
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `API调用失败: ${response.status}`);
      }

      const reviewResult = await response.json();
      return reviewResult;
    } catch (error) {
      console.error('审查API调用失败:', error);
      throw new Error(`审查失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  private parseTextResponse(content: string): ReviewResult {
    // 简单的文本解析逻辑，作为JSON解析失败的后备方案
    const isCompliant = !content.toLowerCase().includes('违反') && !content.toLowerCase().includes('问题');
    
    return {
      isCompliant,
      summary: content.substring(0, 200) + '...',
      totalIssues: isCompliant ? 0 : 1,
      issues: isCompliant ? [] : [{
        originalText: '文档中发现潜在问题',
        violatedClause: '需要进一步人工审查',
        suggestion: '建议人工详细审查该文档',
        severity: 'medium' as const,
        problemDescription: '系统检测到文档中存在潜在的公平竞争问题，但无法自动识别具体违规内容，建议进行人工详细审查以确定具体问题和整改措施'
      }],
      reviewTime: new Date().toLocaleString('zh-CN')
    };
  }

  // 测试API连接
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch('/api/review', {
        method: 'GET',
      });
      
      if (response.ok) {
        const result = await response.json();
        // 如果是备选模式，也返回true，但会显示相应提示
        return true;
      }
      return false;
    } catch (error) {
      console.error('API连接测试失败:', error);
      return false;
    }
  }
}

export const deepseekAPI = new DeepSeekAPI();
