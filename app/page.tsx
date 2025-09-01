"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { CheckCircle, Scale, Cloud, Upload, HelpCircle, MessageCircle, FileText, Globe, Moon, Sun, Download } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Toaster } from "@/components/ui/toaster"
import { useTheme } from "next-themes"
import { TooltipProvider, Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

// 导入我们创建的工具
import { deepseekAPI, ReviewResult } from "@/lib/deepseek-api"
import { documentParser, ParsedDocument } from "@/lib/document-parser"
import { reportGenerator } from "@/lib/report-generator"
import { reviewHistoryManager } from "@/lib/review-history"

interface ProcessStep {
  id: number
  title: string
  status: "pending" | "running" | "completed" | "error"
}

// 审查记录管理组件
const HistoryContent: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [records, setRecords] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const { toast } = useToast()

  useEffect(() => {
    loadRecords()
  }, [])

  const loadRecords = () => {
    const allRecords = reviewHistoryManager.getAllRecords()
    const statistics = reviewHistoryManager.getStatistics()
    setRecords(allRecords)
    setStats(statistics)
  }

  const handleDeleteRecord = (id: string) => {
    if (reviewHistoryManager.deleteRecord(id)) {
      loadRecords()
      toast({
        title: "删除成功",
        description: "审查记录已删除",
      })
    }
  }

  const handleClearAll = () => {
    if (confirm('确定要清空所有审查记录吗？此操作不可恢复。')) {
      reviewHistoryManager.clearAllRecords()
      loadRecords()
      toast({
        title: "清空成功",
        description: "所有审查记录已清空",
      })
    }
  }

  const handleExportRecords = () => {
    const csvData = reviewHistoryManager.exportRecords()
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `审查记录_${new Date().toLocaleDateString('zh-CN')}.csv`
    link.click()
    
    toast({
      title: "导出成功",
      description: "审查记录已导出为CSV文件",
    })
  }

  return (
    <div className="space-y-6">
      {/* 统计信息 */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-4">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.totalCount}</div>
            <div className="text-sm text-blue-600 dark:text-blue-400">总审查数</div>
          </div>
          <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-4">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.compliantCount}</div>
            <div className="text-sm text-green-600 dark:text-green-400">通过数</div>
          </div>
          <div className="bg-orange-50 dark:bg-orange-950/20 rounded-lg p-4">
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{stats.issuesCount}</div>
            <div className="text-sm text-orange-600 dark:text-orange-400">发现问题</div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
            <div className="text-sm font-medium text-slate-600 dark:text-slate-400">最近活动</div>
            <div className="text-xs text-slate-500 dark:text-slate-500">{stats.recentActivity}</div>
          </div>
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={handleExportRecords}
          disabled={records.length === 0}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          导出记录
        </button>
        <button
          onClick={handleClearAll}
          disabled={records.length === 0}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          清空记录
        </button>
      </div>

      {/* 记录列表 */}
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {records.length === 0 ? (
          <div className="text-center py-8 text-slate-500 dark:text-slate-400">
            暂无审查记录
          </div>
        ) : (
          records.map((record) => (
            <div key={record.id} className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="font-medium text-slate-900 dark:text-slate-100">
                    {record.fileName}
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    {record.reviewTime} | {(record.fileSize / 1024).toFixed(1)}KB
                  </div>
                  <div className="mt-2">
                    <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                      record.result.isCompliant 
                        ? 'bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-400'
                        : 'bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-400'
                    }`}>
                      {record.result.isCompliant ? '✓ 通过' : `✗ ${record.result.totalIssues}个问题`}
                    </span>
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                    {record.result.summary}
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteRecord(record.id)}
                  className="ml-4 text-red-500 hover:text-red-700 transition-colors"
                >
                  删除
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default function HomePage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [parsedDocument, setParsedDocument] = useState<ParsedDocument | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [showWarningModal, setShowWarningModal] = useState(false)
  const [showProcessModal, setShowProcessModal] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [reviewResult, setReviewResult] = useState<ReviewResult | null>(null)
  const [isReviewing, setIsReviewing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()
  const { theme, setTheme } = useTheme()

  const processSteps: ProcessStep[] = [
    { id: 1, title: "文件格式验证中...", status: "pending" },
    { id: 2, title: "文档内容解析中...", status: "pending" },
    { id: 3, title: "内容预处理中...", status: "pending" },
    { id: 4, title: "连接DeepSeek API中...", status: "pending" },
    { id: 5, title: "公平竞争条例审查中...", status: "pending" },
    { id: 6, title: "生成审查报告中...", status: "pending" },
    { id: 7, title: "审查完成", status: "pending" },
  ]

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      // 验证文件格式
      const allowedTypes = [
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword'
      ];
      
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "文件格式不支持",
          description: "请上传 .docx 或 .doc 格式的文件",
          variant: "destructive",
        })
        return
      }

      // 验证文件大小 (10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "文件过大",
          description: "文件大小不能超过 10MB",
          variant: "destructive",
        })
        return
      }

      setShowWarningModal(true)
      // Store file temporarily for confirmation
    }
  }

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault()
    setIsDragOver(false)

    const file = event.dataTransfer.files[0]
    if (file) {
      // 验证文件格式
      const allowedTypes = [
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword'
      ];
      
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "文件格式不支持",
          description: "请上传 .docx 或 .doc 格式的文件",
          variant: "destructive",
        })
        return
      }

      // 模拟文件选择事件
      const dt = new DataTransfer()
      dt.items.add(file)
      if (fileInputRef.current) {
        fileInputRef.current.files = dt.files
      }
      setShowWarningModal(true)
    }
  }

  const handleConfirmUpload = async () => {
    const file = fileInputRef.current?.files?.[0]
    if (file) {
      setSelectedFile(file)
      setShowWarningModal(false)
      
      // 解析文档内容
      try {
        let parsed: ParsedDocument
        if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
          parsed = await documentParser.parseDocxFile(file)
        } else {
          parsed = await documentParser.parseDocFile(file)
        }
        
        setParsedDocument(parsed)
        
        toast({
          title: "文件解析成功",
          description: `已成功解析文件: ${file.name}`,
        })
      } catch (error) {
        console.error('文档解析失败:', error)
        toast({
          title: "文档解析失败",
          description: error instanceof Error ? error.message : "未知错误",
          variant: "destructive",
        })
      }
    }
  }

  const handleCancelUpload = () => {
    setShowWarningModal(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleStartReview = async () => {
    if (!selectedFile || !parsedDocument) {
      toast({
        title: "请先选择并解析文件",
        description: "请选择一个文件并等待解析完成后再开始审查",
        variant: "destructive",
      })
      return
    }

    setIsReviewing(true)
    setShowProcessModal(true)
    setCurrentStep(0)
    setError(null)

    const steps = [...processSteps]
    
    try {
      // 步骤 1: 文件格式验证
      setCurrentStep(0)
      steps[0].status = "running"
      await new Promise(resolve => setTimeout(resolve, 800))
      steps[0].status = "completed"

      // 步骤 2: 文档内容解析 (已完成)
      setCurrentStep(1)
      steps[1].status = "running"
      await new Promise(resolve => setTimeout(resolve, 1000))
      steps[1].status = "completed"

      // 步骤 3: 内容预处理
      setCurrentStep(2)
      steps[2].status = "running"
      const validation = documentParser.validateContent(parsedDocument.content)
      if (!validation.isValid) {
        throw new Error(validation.message)
      }
      const processedContent = documentParser.preprocessContent(parsedDocument.content)
      await new Promise(resolve => setTimeout(resolve, 500))
      steps[2].status = "completed"

      // 步骤 4: 连接DeepSeek API
      setCurrentStep(3)
      steps[3].status = "running"
      const isConnected = await deepseekAPI.testConnection()
      if (!isConnected) {
        throw new Error("无法连接到 DeepSeek API，请检查网络连接")
      }
      steps[3].status = "completed"

      // 步骤 5: 进行审查
      setCurrentStep(4)
      steps[4].status = "running"
      const result = await deepseekAPI.reviewDocument(processedContent)
      setReviewResult(result)
      
      // 保存审查记录
      reviewHistoryManager.saveReviewRecord(selectedFile.name, selectedFile.size, result)
      
      steps[4].status = "completed"

      // 步骤 6: 生成报告
      setCurrentStep(5)
      steps[5].status = "running"
      await new Promise(resolve => setTimeout(resolve, 1000))
      steps[5].status = "completed"

      // 步骤 7: 完成
      setCurrentStep(6)
      steps[6].status = "completed"

      // 延迟显示结果
      setTimeout(() => {
        setShowProcessModal(false)
        setShowResults(true)
        setIsReviewing(false)
      }, 1000)

    } catch (error) {
      console.error('审查过程出错:', error)
      setError(error instanceof Error ? error.message : '审查过程中发生未知错误')
      steps[currentStep].status = "error"
      
      toast({
        title: "审查失败",
        description: error instanceof Error ? error.message : '审查过程中发生未知错误',
        variant: "destructive",
      })
      
      setIsReviewing(false)
      setTimeout(() => {
        setShowProcessModal(false)
      }, 2000)
    }
  }

  const handleSelectFile = () => {
    fileInputRef.current?.click()
  }

  const handleBackToHome = () => {
    setShowResults(false)
    setSelectedFile(null)
    setParsedDocument(null)
    setReviewResult(null)
    setCurrentStep(0)
    setError(null)
  }

  const handleRestart = () => {
    setShowResults(false)
    setSelectedFile(null)
    setParsedDocument(null)
    setReviewResult(null)
    setCurrentStep(0)
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleDownloadReport = async () => {
    if (!reviewResult || !selectedFile) {
      toast({
        title: "无法下载报告",
        description: "审查结果不可用",
        variant: "destructive",
      })
      return
    }

    try {
      await reportGenerator.downloadReport(reviewResult, selectedFile.name)
      toast({
        title: "报告下载成功",
        description: "审查报告已保存到您的下载目录",
      })
    } catch (error) {
      console.error('报告下载失败:', error)
      toast({
        title: "报告下载失败",
        description: error instanceof Error ? error.message : '下载过程中发生错误',
        variant: "destructive",
      })
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "high":
        return "text-red-600 bg-red-50 dark:bg-red-950/20"
      case "medium":
        return "text-orange-600 bg-orange-50 dark:bg-orange-950/20"
      case "low":
        return "text-yellow-600 bg-yellow-50 dark:bg-yellow-950/20"
      default:
        return "text-gray-600 bg-gray-50 dark:bg-gray-950/20"
    }
  }

  const getStatusColor = (isCompliant: boolean) => {
    if (isCompliant) return "text-green-600 bg-green-50 dark:bg-green-950/20"
    return "text-red-600 bg-red-50 dark:bg-red-950/20"
  }

  const getStatusText = (isCompliant: boolean) => {
    if (isCompliant) return "审查通过"
    return "审查不通过"
  }

  if (showResults && reviewResult) {
    return (
      <TooltipProvider>
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/50">
          <div className="container mx-auto px-6 py-8">
            {/* Header */}
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100 mb-4">审查结果</h1>
            </div>

            {/* Results Content */}
            <div className="max-w-4xl mx-auto">
              {/* Status Card */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-8 mb-8">
                <div className="space-y-4">
                  <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    文件名称: {selectedFile?.name.replace(/\.(docx?|pdf|txt)$/i, '')}
                  </div>
                  <div className="text-slate-600 dark:text-slate-400">审查时间: {reviewResult.reviewTime}</div>
                  <div className={`inline-block px-4 py-2 rounded-full font-semibold ${getStatusColor(reviewResult.isCompliant)}`}>
                    {reviewResult.isCompliant ? "审查通过" : `发现 ${reviewResult.totalIssues} 个问题`}
                  </div>
                </div>
              </div>

              {/* Issues List */}
              {reviewResult.issues.length > 0 && (
                <div className="space-y-6">
                  {reviewResult.issues.map((issue, index) => (
                    <div key={index} className="bg-white dark:bg-slate-900 rounded-xl shadow-lg p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex flex-col">
                          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                            问题 {index + 1}：{issue.problemDescription || '存在可能影响公平竞争的问题，需要按照相关法规进行整改'}
                          </h3>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getSeverityColor(issue.severity)}`}>
                          {issue.severity === "high" ? "高风险" : issue.severity === "medium" ? "中等风险" : "低风险"}
                        </span>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <h4 className="font-medium text-slate-700 dark:text-slate-300 mb-2">问题原文:</h4>
                          <p className="text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 p-3 rounded-lg">
                            "{issue.originalText}"
                          </p>
                        </div>

                        <div>
                          <h4 className="font-medium text-slate-700 dark:text-slate-300 mb-2">违反条款:</h4>
                          <p className="text-slate-600 dark:text-slate-400">{issue.violatedClause}</p>
                        </div>

                        <div>
                          <h4 className="font-medium text-slate-700 dark:text-slate-300 mb-2">修改建议:</h4>
                          <p className="text-slate-600 dark:text-slate-400 bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg">
                            {issue.suggestion}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
                <button
                  onClick={handleBackToHome}
                  className="px-8 py-4 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200"
                >
                  返回首页
                </button>
                <button
                  onClick={handleRestart}
                  className="px-8 py-4 bg-gradient-to-r from-blue-500/80 to-indigo-600/80 backdrop-blur-sm text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-xl hover:scale-105 transition-all duration-200"
                >
                  重新审查
                </button>
                <button 
                  onClick={handleDownloadReport}
                  className="px-8 py-4 bg-green-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl hover:scale-105 hover:bg-green-700 transition-all duration-200 flex items-center gap-2"
                >
                  <Download className="w-5 h-5" />
                  下载报告
                </button>
              </div>
            </div>
          </div>
        </div>
      </TooltipProvider>
    )
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/50">
        {/* Header */}
        <header className="text-center pt-12 pb-8 px-6">
          <div className="mb-6">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500/80 to-indigo-600/80 backdrop-blur-sm rounded-2xl shadow-lg shadow-blue-500/25 mb-6">
              <Scale className="w-10 h-10 text-white" />
            </div>
          </div>
          <h1 className="text-6xl font-bold text-slate-900 dark:text-slate-100 mb-4 tracking-tight">
            公平竞争审查在线工具
          </h1>
          <p className="text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
            杭州市临安区公平竞争审查专用 - 集成 DeepSeek V3.1 AI
          </p>
        </header>

        {/* Main Content */}
        <main className="flex justify-center px-6 pb-12">
          <div className="w-full max-w-2xl">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50 p-8 md:p-10 transform hover:scale-[1.01] transition-all duration-300">
              {/* Upload Area */}
              <div
                className={`border-2 border-dashed rounded-xl p-10 text-center transition-all duration-200 ${
                  isDragOver
                    ? "border-blue-400 bg-blue-50/50 dark:bg-blue-950/20 scale-105"
                    : "border-slate-300 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600"
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <div className="mb-6">
                  <div className="relative inline-block">
                    <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-950/50 dark:to-indigo-950/50 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
                      <Cloud className="w-10 h-10 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center shadow-lg">
                      <Upload className="w-3.5 h-3.5 text-white" />
                    </div>
                  </div>
                </div>

                <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-3">
                  拖拽文件到此处或点击上传
                </h3>
                <p className="text-base text-slate-600 dark:text-slate-400 mb-6">
                  支持 .docx、.doc 格式文件，最大支持 10MB
                </p>

                {selectedFile && parsedDocument && (
                  <div className="mb-6 p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                      <p className="text-green-700 dark:text-green-400 font-medium">已选择并解析文件: {selectedFile.name}</p>
                    </div>
                    <div className="text-sm text-green-600 dark:text-green-400">
                      字数: {parsedDocument.metadata.wordCount} | 解析时间: {new Date(parsedDocument.metadata.extractedAt).toLocaleString('zh-CN')}
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <button
                    onClick={handleSelectFile}
                    className="px-8 py-4 bg-gradient-to-r from-blue-500/80 to-indigo-600/80 backdrop-blur-sm text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-xl hover:scale-105 transition-all duration-200 flex items-center gap-2"
                  >
                    <Upload className="w-5 h-5" />
                    选择文件
                  </button>
                  <button
                    onClick={handleStartReview}
                    disabled={!selectedFile || !parsedDocument || isReviewing}
                    className="px-8 py-4 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold rounded-xl border-2 border-slate-300 dark:border-slate-600 shadow-lg hover:shadow-xl hover:scale-105 hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  >
                    {isReviewing ? "审查中..." : "开始审查"}
                  </button>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".doc,.docx"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
            </div>
          </div>
        </main>

        {/* Floating Actions */}
        <div className="fixed right-6 top-1/2 -translate-y-1/2 flex flex-col gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="w-14 h-14 bg-white dark:bg-slate-800 rounded-full shadow-lg shadow-slate-200/50 dark:shadow-slate-900/50 hover:shadow-xl hover:scale-110 transition-all duration-200 flex items-center justify-center border border-slate-200 dark:border-slate-700">
                <HelpCircle className="w-6 h-6 text-slate-600 dark:text-slate-400" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="left">功能说明</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button className="w-14 h-14 bg-white dark:bg-slate-800 rounded-full shadow-lg shadow-slate-200/50 dark:shadow-slate-900/50 hover:shadow-xl hover:scale-110 transition-all duration-200 flex items-center justify-center border border-slate-200 dark:border-slate-700">
                <MessageCircle className="w-6 h-6 text-slate-600 dark:text-slate-400" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="left">智能客服</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button className="w-14 h-14 bg-white dark:bg-slate-800 rounded-full shadow-lg shadow-slate-200/50 dark:shadow-slate-900/50 hover:shadow-xl hover:scale-110 transition-all duration-200 flex items-center justify-center border border-slate-200 dark:border-slate-700">
                <FileText className="w-6 h-6 text-slate-600 dark:text-slate-400" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="left">文档指南</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="w-14 h-14 bg-white dark:bg-slate-800 rounded-full shadow-lg shadow-slate-200/50 dark:shadow-slate-900/50 hover:shadow-xl hover:scale-110 transition-all duration-200 flex items-center justify-center border border-slate-200 dark:border-slate-700"
              >
                {theme === "dark" ? (
                  <Sun className="w-6 h-6 text-slate-600 dark:text-slate-400" />
                ) : (
                  <Moon className="w-6 h-6 text-slate-600 dark:text-slate-400" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="left">主题切换</TooltipContent>
          </Tooltip>
        </div>

        {/* Footer */}
        <footer className="border-t border-slate-200 dark:border-slate-800 py-8 px-6 text-center">
          <div className="flex items-center justify-center gap-2 text-slate-600 dark:text-slate-400">
            <button 
              onClick={() => setShowHistoryModal(true)}
              className="text-blue-600 dark:text-blue-400 font-medium hover:underline cursor-pointer"
            >
              审查记录管理
            </button>
            <span className="text-slate-400 dark:text-slate-600">|</span>
            <span>© 2025</span>
            <span className="text-slate-400 dark:text-slate-600">|</span>
            <span>浙ICP备2025160577号</span>
          </div>
        </footer>

        {/* Warning Modal */}
        {showWarningModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full p-8 relative transform scale-100 animate-in fade-in-0 zoom-in-95 duration-200">
              <button
                onClick={handleCancelUpload}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                ×
              </button>

              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-orange-100 to-red-100 dark:from-orange-950/50 dark:to-red-950/50 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-lg">!</span>
                  </div>
                </div>

                <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-6">禁止上传涉密文档</h3>

                <div className="flex flex-col sm:flex-row gap-3 mt-8">
                  <button
                    onClick={handleCancelUpload}
                    className="flex-1 px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  >
                    取消上传
                  </button>
                  <button
                    onClick={handleConfirmUpload}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500/80 to-indigo-600/80 backdrop-blur-sm text-white font-medium rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 transition-all duration-200"
                  >
                    确认上传
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Process Modal */}
        {showProcessModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-lg w-full p-8 transform scale-100 animate-in fade-in-0 zoom-in-95 duration-200">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100">正在审查文档</h3>
                <p className="text-slate-600 dark:text-slate-400 mt-2">
                  {error ? "审查过程中出现错误" : "DeepSeek V3.1 正在分析您的文档..."}
                </p>
                {error && (
                  <div className="mt-4 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                {processSteps.map((step, index) => (
                  <div key={step.id} className="flex items-center gap-4 p-4 rounded-lg bg-slate-50 dark:bg-slate-800">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                        index < currentStep
                          ? "bg-green-500 text-white"
                          : index === currentStep
                            ? error
                              ? "bg-red-500 text-white"
                              : "bg-blue-500 text-white animate-pulse"
                            : "bg-slate-300 dark:bg-slate-600 text-slate-500"
                      }`}
                    >
                      {index < currentStep ? "✓" : index === currentStep && error ? "×" : index + 1}
                    </div>
                    <span
                      className={`font-medium transition-colors duration-300 ${
                        index <= currentStep
                          ? error && index === currentStep
                            ? "text-red-600 dark:text-red-400"
                            : "text-slate-900 dark:text-slate-100"
                          : "text-slate-500 dark:text-slate-400"
                      }`}
                    >
                      {step.title}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* History Modal */}
        {showHistoryModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
              <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100">审查记录管理</h3>
                <button
                  onClick={() => setShowHistoryModal(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors text-2xl"
                >
                  ×
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                <HistoryContent onClose={() => setShowHistoryModal(false)} />
              </div>
            </div>
          </div>
        )}

        <Toaster />
      </div>
    </TooltipProvider>
  )
}