// Word 审查报告生成器
import { ReviewResult } from './deepseek-api';

export interface ReportTemplate {
  title: string;
  department: string;
  reviewer: string;
  reviewDate: string;
  fileName: string;
}

class ReportGenerator {
  // 生成HTML格式（极简公文版）：去除单位名称/编号/落款，仅保留必要内容
  generateReportHTML(reviewResult: ReviewResult, template: ReportTemplate): string {
    const { totalIssues, issues } = reviewResult;
    const cleanFileName = template.fileName.replace(/\.(docx?|pdf|txt)$/i, '').replace(/^关于/, '').replace(/的通知$/, '').replace(/的意见$/, '').replace(/的办法$/, '').replace(/的规定$/, '');
    const intro = `根据《公平竞争审查条例》及其实施办法的有关规定，对《${cleanFileName}》进行了公平竞争审查。审查情况如下：`;
    const body = totalIssues > 0
      ? issues.map((issue, index) => `问题 ${index + 1}：\n\n问题原文：${issue.originalText}\n\n违反条款：${issue.violatedClause}\n\n整改建议：${issue.suggestion}\n`).join('\n')
      : '经审查，未发现违反公平竞争相关规定的内容。';
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <title>审查报告</title>
  <style>
    body { font-family: "SimSun","宋体",serif; font-size: 14px; line-height: 1.8; margin: 2cm; color: #333; }
    .title { text-align: left; font-size: 20px; font-weight: bold; margin-bottom: 18px; }
    .hr { border-top: 1px solid #333; margin: 12px 0 24px; }
    .para { margin: 12px 0; white-space: pre-wrap; }
  </style>
</head>
<body>
  <div class="title">关于《${cleanFileName}》的审查报告</div>
  <div class="hr"></div>
  <div class="para">${intro}</div>
  <div class="para">${body}</div>
</body>
</html>`;
  }

  // 生成简化的审查结果报告（极简公文版）- 无单位名称/落款/编号
  generateSimpleReport(reviewResult: ReviewResult, fileName: string): string {
    const { totalIssues, issues } = reviewResult;
    const cleanFileName = fileName.replace(/\.(docx?|pdf|txt)$/i, '').replace(/^关于/, '').replace(/的通知$/, '').replace(/的意见$/, '').replace(/的办法$/, '').replace(/的规定$/, '');

    let report = `关于《${cleanFileName}》的审查报告\n\n`;
    report += `根据《公平竞争审查条例》及其实施办法的有关规定，对《${cleanFileName}》进行了公平竞争审查。审查情况如下：\n`;

    if (totalIssues > 0) {
      issues.forEach((issue, index) => {
        report += `\n问题 ${index + 1}：\n\n问题原文：${issue.originalText}\n\n违反条款：${issue.violatedClause}\n\n整改建议：${issue.suggestion}\n`;
      });
    } else {
      report += `\n经审查，未发现违反公平竞争相关规定的内容。\n`;
    }

    return report;
  }

  // 将简化报告转换为Word文档数据
  async generateWordDocument(reviewResult: ReviewResult, template: ReportTemplate): Promise<Blob> {
    const reportContent = this.generateSimpleReport(reviewResult, template.fileName);
    
    // 创建Word文档的基本结构，使用纯文本格式
    const wordContent = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { 
            font-family: "SimSun", "宋体", serif; 
            font-size: 12pt; 
            line-height: 1.8; 
            margin: 2cm; 
            white-space: pre-line;
        }
    </style>
</head>
<body>
${reportContent.replace(/\n/g, '<br>')}
</body>
</html>`;
    
    return new Blob([wordContent], { 
      type: 'application/msword'
    });
  }

  // 下载Word文档
  async downloadReport(reviewResult: ReviewResult, fileName: string): Promise<void> {
    const template: ReportTemplate = {
      title: '审查报告',
      department: '',
      reviewer: '',
      reviewDate: new Date().toLocaleDateString('zh-CN'),
      fileName: fileName
    };

    try {
      const wordBlob = await this.generateWordDocument(reviewResult, template);
      
      // 提取文件名主要部分，生成规范的下载文件名
      const cleanFileName = fileName.replace(/\.(docx?|pdf|txt)$/i, '').replace(/^关于/, '').replace(/的通知$/, '').replace(/的意见$/, '').replace(/的办法$/, '').replace(/的规定$/, '');
      
      // 创建下载链接
      const url = URL.createObjectURL(wordBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `关于《${cleanFileName}》的审查报告_${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, '0')}${new Date().getDate().toString().padStart(2, '0')}.doc`;
      
      // 触发下载
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // 清理URL
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('报告下载失败:', error);
      throw new Error('报告生成失败，请重试');
    }
  }
}

export const reportGenerator = new ReportGenerator();
