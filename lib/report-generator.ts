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
  // 生成HTML格式的报告（用于Word导出）
  generateReportHTML(reviewResult: ReviewResult, template: ReportTemplate): string {
    const { isCompliant, summary, totalIssues, issues, reviewTime } = reviewResult;
    
    // 统计问题总数
    
    const statusText = isCompliant ? '通过' : totalIssues > 0 ? '需要修改' : '不通过';
    const statusStyle = isCompliant ? 'color: green;' : totalIssues > 0 ? 'color: orange;' : 'color: red;';
    
    const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>公平竞争审查报告</title>
    <style>
        body {
            font-family: "SimSun", "宋体", serif;
            font-size: 14px;
            line-height: 1.6;
            margin: 2cm;
            color: #333;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #333;
            padding-bottom: 20px;
        }
        .title {
            font-size: 24px;
            font-weight: bold;
            margin: 20px 0;
            color: #1a1a1a;
        }
        .info-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        .info-table td, .info-table th {
            border: 1px solid #ccc;
            padding: 12px;
            text-align: left;
        }
        .info-table th {
            background-color: #f5f5f5;
            font-weight: bold;
        }
        .section {
            margin: 30px 0;
        }
        .section-title {
            font-size: 18px;
            font-weight: bold;
            margin: 20px 0 10px 0;
            color: #2c3e50;
            border-left: 4px solid #3498db;
            padding-left: 10px;
        }
        .issue {
            background-color: #f9f9f9;
            border: 1px solid #ddd;
            border-radius: 5px;
            padding: 15px;
            margin: 15px 0;
        }
        .issue-header {
            font-weight: bold;
            color: #e74c3c;
            margin-bottom: 10px;
        }
        .issue-content {
            margin: 10px 0;
        }
        .issue-severity {
            display: inline-block;
            padding: 3px 8px;
            border-radius: 3px;
            font-size: 12px;
            font-weight: bold;
        }
        .severity-high {
            background-color: #e74c3c;
            color: white;
        }
        .severity-medium {
            background-color: #f39c12;
            color: white;
        }
        .severity-low {
            background-color: #f1c40f;
            color: #333;
        }
        .summary {
            background-color: #ecf0f1;
            border-left: 4px solid #3498db;
            padding: 20px;
            margin: 20px 0;
        }
        .footer {
            margin-top: 50px;
            border-top: 1px solid #ccc;
            padding-top: 20px;
            text-align: right;
            color: #666;
        }
        .compliant {
            color: #27ae60;
            font-weight: bold;
        }
        .non-compliant {
            color: #e74c3c;
            font-weight: bold;
        }
        .quote {
            background-color: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 10px 15px;
            margin: 10px 0;
            font-style: italic;
        }
        .suggestion {
            background-color: #d1ecf1;
            border-left: 4px solid #17a2b8;
            padding: 10px 15px;
            margin: 10px 0;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="title">公平竞争审查意见书</div>
        <div style="font-size: 16px; margin-top: 10px;">杭州市临安区发展和改革局</div>
    </div>

    <div style="text-align: left; margin: 30px 0;">
        <div style="margin-bottom: 20px;">
            <strong>审查编号：</strong>FCRA-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}<br/>
            <strong>被审查文件：</strong>${template.fileName}<br/>
            <strong>审查日期：</strong>${reviewTime}<br/>
            <strong>审查结论：</strong><span style="${statusStyle}">${statusText}</span>
        </div>
        
        ${totalIssues > 0 ? `<div style="margin-bottom: 20px; padding: 15px; background-color: #fff3cd; border-left: 4px solid #ffc107;">
            <strong>发现问题：</strong>经审查，该文件存在 <strong>${totalIssues}</strong> 个需要修改的问题。
        </div>` : `<div style="margin-bottom: 20px; padding: 15px; background-color: #d1ecf1; border-left: 4px solid #17a2b8;">
            <strong>审查结论：</strong>该文件符合公平竞争审查要求，未发现违反相关条例的内容。
        </div>`}
    </div>

    <div class="section">
        <div class="section-title">一、审查依据</div>
        <p>本次审查严格按照《公平竞争审查条例实施办法》进行，重点审查以下内容：</p>
        <ul>
            <li>是否设定歧视性标准，排除或者限制经营者参与市场竞争</li>
            <li>是否限制经营者自由进入相关市场或者自由退出相关市场</li>
            <li>是否限制商品自由流通</li>
            <li>是否对外地和进口商品、服务实行歧视性价格和歧视性补贴政策</li>
            <li>是否限制外地和外国经营者在本地投资或者设立分支机构</li>
            <li>是否强制经营者从事《反垄断法》规定的垄断行为</li>
            <li>其他可能妨碍公平竞争的行为</li>
        </ul>
    </div>

    <div class="section">
        <div class="section-title">二、审查总结</div>
        <div class="summary">
            ${summary}
        </div>
    </div>

    ${totalIssues > 0 ? `
    <div class="section">
        <div class="section-title">三、发现的问题及修改建议</div>
        ${issues.map((issue, index) => `
        <div class="issue">
            <div class="issue-header">
                问题 ${index + 1}: 
                <span class="issue-severity severity-${issue.severity}">
                    ${issue.severity === 'high' ? '高风险' : issue.severity === 'medium' ? '中等风险' : '低风险'}
                </span>
            </div>
            <div class="issue-content">
                <strong>问题原文：</strong>
                <div class="quote">"${issue.originalText}"</div>
            </div>
            <div class="issue-content">
                <strong>违反条款：</strong> ${issue.violatedClause}
            </div>
            <div class="issue-content">
                <strong>修改建议：</strong>
                <div class="suggestion">${issue.suggestion}</div>
            </div>
        </div>
        `).join('')}
    </div>
    ` : `
    <div class="section">
        <div class="section-title">三、审查结论</div>
        <div class="summary compliant">
            经审查，该文件符合公平竞争审查要求，未发现违反相关条例的内容。
        </div>
    </div>
    `}

    <div class="section">
        <div class="section-title">四、审查结论和建议</div>
        ${isCompliant ? `
        <p class="compliant">该文件通过公平竞争审查，可以按程序继续推进。</p>
        ` : `
        <p class="non-compliant">该文件存在 ${totalIssues} 个需要修改的问题，建议根据上述修改意见进行调整后重新提交审查。</p>
        `}
        
        <p><strong>特别说明：</strong></p>
        <ul>
            <li>本次审查基于《公平竞争审查条例实施办法》相关条款进行</li>
            <li>如对审查结果有异议，可申请复核审查</li>
            <li>文件修改后应重新提交审查</li>
        </ul>
    </div>

    <div class="footer">
        <p>审查机构：杭州市临安区公平竞争审查工作组</p>
        <p>报告生成时间：${new Date().toLocaleString('zh-CN')}</p>
        <p>报告编号：FCRA-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}</p>
    </div>
</body>
</html>`;
    
    return html;
  }

  // 生成简化的审查结果报告（公文标准格式）
  generateSimpleReport(reviewResult: ReviewResult, fileName: string): string {
    const { isCompliant, summary, totalIssues, issues, reviewTime } = reviewResult;
    
    // 提取文件名中的主要部分作为报告标题
    const cleanFileName = fileName.replace(/\.(docx?|pdf|txt)$/i, '').replace(/^关于/, '').replace(/的通知$/, '').replace(/的意见$/, '').replace(/的办法$/, '').replace(/的规定$/, '');
    
    let report = `


关于《${cleanFileName}》的审查报告

                  杭州市临安区发展和改革局

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    根据《公平竞争审查条例》及其实施办法的有关规定，我局对《${fileName.replace(/\.(docx?|pdf|txt)$/i, '')}》进行了公平竞争审查。现将审查情况报告如下：`;

    if (totalIssues > 0) {
      issues.forEach((issue, index) => {
        // 根据具体问题内容生成个性化描述
        let problemDescription = '';
        const originalText = issue.originalText.toLowerCase();
        
        // 特定经营者相关
        if (originalText.includes('龙头企业') || originalText.includes('头部企业')) {
          problemDescription = '使用"龙头企业"等表述变相确定特定经营者，可能排除其他符合条件的企业参与，影响市场公平竞争';
        } else if (originalText.includes('重点企业') || originalText.includes('知名企业')) {
          problemDescription = '使用"重点企业"等模糊标准变相指定特定经营者，违反公平竞争审查要求';
        } else if (originalText.includes('新雏鹰企业') || originalText.includes('雏鹰企业')) {
          problemDescription = '针对特定类型企业设置专门政策，存在变相确定特定经营者的嫌疑';
        } 
        // 规模门槛相关
        else if (originalText.includes('营业收入') || originalText.includes('注册资本')) {
          problemDescription = '设置具体的营业收入或注册资本门槛，可能构成为特定企业量身定制，限制其他企业参与';
        }
        // 地域限制相关
        else if (originalText.includes('本地') || originalText.includes('本区') || originalText.includes('当地')) {
          problemDescription = '设置地域限制条件，排斥外地经营者参与，违反统一市场和公平竞争原则';
        }
        // 时间限制相关
        else if (originalText.includes('年以上') || (originalText.includes('满') && originalText.includes('年'))) {
          problemDescription = '设置不合理的经营年限要求，对新进入市场的经营者形成准入障碍';
        }
        // 默认描述
        else {
          problemDescription = '存在可能影响公平竞争的问题，需要按照相关法规进行整改';
        }
        
        report += `

问题${index + 1}：${problemDescription}

问题原文：${issue.originalText}

违反条款：${issue.violatedClause}

整改建议：${issue.suggestion}
`;
      });
      
      report += `


    综上所述，该文件存在上述${totalIssues}个公平竞争问题，建议按照整改意见进行修改后重新报送审查。
`;
    } else {
      report += `


    经审查，该文件符合《公平竞争审查条例实施办法》要求，未发现违反公平竞争相关条例的内容。
`;
    }

    report += `


                      杭州市临安区发展和改革局
                        ${new Date().getFullYear()}年${(new Date().getMonth() + 1).toString().padStart(2, '0')}月${new Date().getDate().toString().padStart(2, '0')}日
`;

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
      title: '公平竞争审查意见书',
      department: '杭州市临安区发展和改革局',
      reviewer: '公平竞争审查工作组',
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