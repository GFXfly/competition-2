// 文档解析工具
export interface ParsedDocument {
  content: string;
  metadata: {
    title?: string;
    pageCount?: number;
    wordCount: number;
    extractedAt: string;
  };
}

class DocumentParser {
  // 解析DOCX文件（通过服务器端API）
  async parseDocxFile(file: File): Promise<ParsedDocument> {
    try {
      // 将文件转换为Base64编码发送到服务器
      const base64Data = await this.fileToBase64(file);
      
      // 调用服务器端解析API
      const response = await fetch('/api/parse-document', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileName: file.name,
          fileData: base64Data,
          fileType: file.type
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `文档解析失败: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('DOCX解析失败:', error);
      throw new Error(`文档解析失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  // 解析DOC文件：当前不直接支持，提示用户转换
  async parseDocFile(_file: File): Promise<ParsedDocument> {
    throw new Error('暂不支持 .doc（二进制）格式，请先将文件转换为 .docx 再上传');
  }

  private async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1]; // 移除data:...;base64,前缀
        resolve(base64);
      };
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsDataURL(file);
    });
  }

  // 验证文档内容
  validateContent(content: string): { isValid: boolean; message?: string } {
    if (!content || content.length < 10) {
      return { isValid: false, message: '文档内容过短，无法进行有效审查' };
    }
    
    if (content.length > 50000) {
      return { isValid: false, message: '文档内容过长，请分段提交审查' };
    }
    
    return { isValid: true };
  }

  // 预处理文档内容
  preprocessContent(content: string): string {
    // 清理和标准化文档内容
    let processed = content;
    
    // 移除多余空格和换行
    processed = processed.replace(/\s+/g, ' ');
    processed = processed.trim();
    
    // 移除特殊字符但保留标点符号
    processed = processed.replace(/[^\w\s\u4e00-\u9fff，。；：""''（）【】《》？！、]/g, '');
    
    return processed;
  }
}

export const documentParser = new DocumentParser();
