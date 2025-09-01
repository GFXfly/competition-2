// 服务器端文档解析API
import { NextRequest, NextResponse } from 'next/server';
import * as mammoth from 'mammoth';

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
    const { fileName, fileData, fileType }: ParseRequest = await request.json();

    if (!fileName || !fileData) {
      return NextResponse.json(
        { error: '缺少文件名或文件数据' },
        { status: 400 }
      );
    }

    // 将Base64数据转换为Buffer
    const buffer = Buffer.from(fileData, 'base64');
    
    let textContent = '';

    // 根据文件类型进行解析
    if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || fileName.endsWith('.docx')) {
      // 解析DOCX文件
      try {
        const result = await mammoth.extractRawText({ buffer });
        textContent = result.value;
        
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
    } else if (fileType === 'application/msword' || fileName.endsWith('.doc')) {
      // DOC文件解析（mammoth也支持部分DOC文件）
      try {
        const result = await mammoth.extractRawText({ buffer });
        textContent = result.value;
      } catch (error) {
        console.error('DOC解析失败:', error);
        return NextResponse.json(
          { error: 'DOC文件格式较旧，建议转换为DOCX格式后重新上传' },
          { status: 500 }
        );
      }
    } else {
      return NextResponse.json(
        { error: '不支持的文件格式，请上传DOCX或DOC文件' },
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
    supportedFormats: ['DOCX', 'DOC']
  });
}