// 审查记录管理
export interface ReviewRecord {
  id: string;
  fileName: string;
  fileSize: number;
  reviewTime: string;
  result: {
    isCompliant: boolean;
    totalIssues: number;
    summary: string;
  };
  status: 'completed' | 'failed';
}

class ReviewHistoryManager {
  private readonly STORAGE_KEY = 'fairCompetition_reviewHistory';

  // 保存审查记录
  saveReviewRecord(fileName: string, fileSize: number, reviewResult: any): string {
    const records = this.getAllRecords();
    
    const newRecord: ReviewRecord = {
      id: `review_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      fileName,
      fileSize,
      reviewTime: new Date().toLocaleString('zh-CN'),
      result: {
        isCompliant: reviewResult.isCompliant,
        totalIssues: reviewResult.totalIssues,
        summary: reviewResult.summary.substring(0, 100) + (reviewResult.summary.length > 100 ? '...' : '')
      },
      status: 'completed'
    };

    records.unshift(newRecord); // 最新记录在前
    
    // 保持最多50条记录
    if (records.length > 50) {
      records.splice(50);
    }

    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(records));
    return newRecord.id;
  }

  // 获取所有记录
  getAllRecords(): ReviewRecord[] {
    try {
      const records = localStorage.getItem(this.STORAGE_KEY);
      return records ? JSON.parse(records) : [];
    } catch (error) {
      console.error('读取审查记录失败:', error);
      return [];
    }
  }

  // 删除单条记录
  deleteRecord(id: string): boolean {
    const records = this.getAllRecords();
    const index = records.findIndex(record => record.id === id);
    
    if (index !== -1) {
      records.splice(index, 1);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(records));
      return true;
    }
    return false;
  }

  // 清空所有记录
  clearAllRecords(): void {
    localStorage.removeItem(this.STORAGE_KEY);
  }

  // 获取记录统计信息
  getStatistics(): {
    totalCount: number;
    compliantCount: number;
    issuesCount: number;
    recentActivity: string;
  } {
    const records = this.getAllRecords();
    const compliantCount = records.filter(r => r.result.isCompliant).length;
    const totalIssues = records.reduce((sum, r) => sum + r.result.totalIssues, 0);
    
    return {
      totalCount: records.length,
      compliantCount,
      issuesCount: totalIssues,
      recentActivity: records.length > 0 ? records[0].reviewTime : '暂无记录'
    };
  }

  // 导出记录为CSV
  exportRecords(): string {
    const records = this.getAllRecords();
    
    const csvHeader = '文件名,文件大小,审查时间,审查结果,问题数量,总结\n';
    const csvData = records.map(record => {
      const result = record.result.isCompliant ? '通过' : 
                    record.result.totalIssues > 0 ? '需要修改' : '不通过';
      
      return [
        record.fileName,
        `${(record.fileSize / 1024).toFixed(1)}KB`,
        record.reviewTime,
        result,
        record.result.totalIssues,
        `"${record.result.summary.replace(/"/g, '""')}"`
      ].join(',');
    }).join('\n');

    return csvHeader + csvData;
  }
}

export const reviewHistoryManager = new ReviewHistoryManager();