// 服务器端文档解析API
import { NextRequest, NextResponse } from 'next/server';
import * as mammoth from 'mammoth';

// 简单的内存级限流（按 IP 粒度，不适用于无状态多实例，仅作基础保护）
const rateStore = new Map<string, { windowStart: number; count: number }>();
const WINDOW_MS = 60_000; // 1 分钟
const MAX_REQ_PER_WINDOW = 30; // 每分钟最多 30 次

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

interface ParseRequest {
  fileName: string;
  fileData: string; // Base64编码的文件数据
  fileType: string;
}

interface ParseResponse {
  content: string;
  metadata: {
    title: string;
    wordCount: number;
    extractedAt: string;
  };
}

export async function POST(request: NextRequest) {
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

    const { fileName, fileData, fileType }: ParseRequest = await request.json();

    if (!fileName || !fileData) {
      return NextResponse.json(
        { error: '缺少文件名或文件数据' },
        { status: 400 }
      );
    }

    // 将Base64数据转换为Buffer
    const buffer = Buffer.from(fileData, 'base64');

    // 服务端安全限制：最大 10MB
    const MAX_SIZE_BYTES = 10 * 1024 * 1024;
    if (buffer.length > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: '文件过大，最大支持 10MB' },
        { status: 413 }
      );
    }
    
    let textContent = '';

    // 根据文件类型进行解析
    if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || fileName.toLowerCase().endsWith('.docx')) {
      // 解析DOCX文件
      try {
        const result = await mammoth.extractRawText({ buffer });
        textContent = result.value || '';

        // 如果纯文本基本为空，使用 HTML 提取兜底再剥离标签
        if (!textContent || textContent.trim().length < 10) {
          const htmlRes = await mammoth.convertToHtml({ buffer });
          const html = htmlRes.value || '';
          const plain = html
            .replace(/<\/?(style|script)[^>]*>[^]*?<\/\1>/gi, ' ')
            .replace(/<[^>]+>/g, ' ') // 去标签
            .replace(/&nbsp;|&#160;/gi, ' ')
            .replace(/&lt;/gi, '<')
            .replace(/&gt;/gi, '>')
            .replace(/&amp;/gi, '&')
            .replace(/&quot;/gi, '"')
            .replace(/&#39;/gi, "'")
            .replace(/\s+/g, ' ')
            .trim();
          if (plain.length >= 10) {
            textContent = plain;
          }
        }

        // 如果有警告信息，记录但不中断处理
        if (result.messages && result.messages.length > 0) {
          console.log('DOCX解析警告:', result.messages);
        }
      } catch (error) {
        console.error('Mammoth解析失败:', error);
        return NextResponse.json(
          { error: `DOCX文件解析失败: ${error instanceof Error ? error.message : '未知错误'}` },
          { status: 500 }
        );
      }
    } else if (fileType === 'application/msword' || fileName.toLowerCase().endsWith('.doc')) {
      // 不再尝试使用 mammoth 解析 .doc，直接返回更明确的错误提示
      return NextResponse.json(
        { error: '暂不支持 .doc（二进制）格式，请将文件转换为 .docx 后重新上传' },
        { status: 400 }
      );
    } else {
      return NextResponse.json(
        { error: '不支持的文件格式，请上传 DOCX 文件' },
        { status: 400 }
      );
    }

    // 清理和验证提取的文本
    textContent = cleanExtractedText(textContent);
    
    if (!textContent || textContent.length < 10) {
      return NextResponse.json(
        { error: '文档内容为空或过短，可能是加密文档或格式有问题' },
        { status: 400 }
      );
    }

    // 构建返回结果
    const response: ParseResponse = {
      content: textContent,
      metadata: {
        title: fileName.replace(/\.[^/.]+$/, ""),
        wordCount: textContent.length,
        extractedAt: new Date().toISOString()
      }
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('文档解析API错误:', error);
    return NextResponse.json(
      { error: `服务器解析失败: ${error instanceof Error ? error.message : '未知错误'}` },
      { status: 500 }
    );
  }
}

// 清理提取的文本内容
function cleanExtractedText(text: string): string {
  if (!text) return '';
  
  // 移除多余的空白字符
  let cleaned = text.replace(/\s+/g, ' ');
  
  // 移除页眉页脚等可能的无关内容
  cleaned = cleaned.replace(/第\s*\d+\s*页.*?共\s*\d+\s*页/g, '');
  cleaned = cleaned.replace(/\d{4}年\d{1,2}月\d{1,2}日\s*\d{1,2}:\d{2}/g, '');
  
  // 标准化标点符号
  cleaned = cleaned.replace(/，\s+/g, '，');
  cleaned = cleaned.replace(/。\s+/g, '。');
  cleaned = cleaned.replace(/；\s+/g, '；');
  
  // 去除首尾空格
  cleaned = cleaned.trim();
  
  return cleaned;
}

// 支持GET请求返回API状态
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: '文档解析API正常运行',
    supportedFormats: ['DOCX']
  });
}
