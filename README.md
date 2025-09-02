# 公平竞争审查在线工具

杭州市临安区公平竞争审查专用工具，集成 DeepSeek V3.1 AI 进行智能文档审查。

## 功能特色

### ✨ 核心功能
- **智能审查**: 集成 DeepSeek V3.1 模型，基于《公平竞争审查条例实施办法》进行严格审查
- **文档解析**: 支持 DOCX 格式文档的智能解析；传统 DOC（二进制）格式请先转换为 DOCX 再上传
- **专业报告**: 生成符合公文格式的 Word 审查报告，支持一键下载
- **实时流程**: 7步审查流程实时展示，透明化处理过程

### 🎨 设计特色
- **苹果风格**: 采用苹果官网简约高级设计风格
- **响应式布局**: 完美适配桌面和移动设备
- **暗色模式**: 支持明暗主题自动切换
- **流畅动画**: 精心设计的交互动画提升用户体验

## 技术架构

### 前端技术栈
- **Next.js 15.2.4** - React 全栈框架
 - **React 18** - 用户界面库
- **TypeScript** - 类型安全开发
- **Tailwind CSS** - 原子化CSS框架
- **Radix UI** - 高质量组件库
- **Lucide React** - 现代化图标库

### AI集成
- **DeepSeek V3.1** - 大语言模型API
- **智能审查引擎** - 基于法规条例的严格审查逻辑
- **文档解析器** - DOCX格式智能解析（DOC 请先转换）
- **报告生成器** - 专业公文格式报告生成

## 快速开始

### 环境要求
- Node.js 18+
- npm 或 pnpm

### 安装步骤

1. **安装依赖**
   ```bash
   npm install --legacy-peer-deps
   ```

2. **配置环境变量**
   
   创建 `.env.local` 文件：
   ```env
   # 请使用你自己的密钥，切勿提交到仓库
   DEEPSEEK_API_KEY=YOUR_DEEPSEEK_API_KEY
   DEEPSEEK_BASE_URL=https://api.deepseek.com
   ```

3. **启动开发服务器**
   ```bash
   npm run dev
   ```

4. **访问应用**
   
   打开浏览器访问 [http://localhost:3000](http://localhost:3000)

### 生产部署

1. **构建应用**
   ```bash
   npm run build
   ```

2. **启动生产服务器**
   ```bash
   npm run start
   ```

## 使用指南

### 审查流程

1. **文件上传**
   - 支持拖拽上传或点击选择
   - 仅支持 .docx 格式；.doc 请先转换为 .docx
   - 最大文件大小 10MB
   - 涉密文档确认提醒

2. **智能审查**
   - 7步处理流程：文件验证 → 内容解析 → 预处理 → API连接 → 条例审查 → 报告生成 → 完成
   - 实时进度显示
   - 错误处理和重试机制

3. **结果展示**
   - 审查状态：通过/需要修改/不通过
   - 详细问题列表：原文引用、违反条款、修改建议
   - 风险等级分类：高/中/低

4. **报告下载**
   - 一键生成 Word 格式审查报告
   - 符合政府公文格式标准
   - 包含完整审查信息和时间戳

### 审查标准

本系统严格按照《公平竞争审查条例实施办法》进行审查，重点检查：

- ✓ 是否设定歧视性标准，排除或限制经营者参与市场竞争
- ✓ 是否限制经营者自由进入或退出相关市场
- ✓ 是否限制商品自由流通
- ✓ 是否对外地和进口商品、服务实行歧视性政策
- ✓ 是否限制外地和外国经营者投资或设立分支机构
- ✓ 是否强制经营者从事垄断行为
- ✓ 是否违法披露经营敏感信息
- ✓ 是否超越定价权限进行政府定价
- ✓ 是否违法干预市场调节价格

## API文档

### DeepSeek API集成

系统使用 DeepSeek V3.1 模型进行智能审查：

```typescript
// API调用示例
const result = await deepseekAPI.reviewDocument(documentContent)

// 返回结果格式
interface ReviewResult {
  isCompliant: boolean
  summary: string
  totalIssues: number
  issues: ReviewIssue[]
  reviewTime: string
}
```

### 文档解析

支持 DOCX 格式文档解析（DOC 请先转换）：

```typescript
// 解析示例
const parsed = await documentParser.parseDocxFile(file)

// 返回格式
interface ParsedDocument {
  content: string
  metadata: {
    title?: string
    wordCount: number
    extractedAt: string
  }
}
```

## 项目结构

```
competition-2/
├── app/                 # Next.js App Router
│   ├── globals.css     # 全局样式
│   ├── layout.tsx      # 根布局
│   └── page.tsx        # 主页面
├── lib/                # 核心工具库
│   ├── deepseek-api.ts       # DeepSeek API集成
│   ├── document-parser.ts    # 文档解析器
│   └── report-generator.ts   # 报告生成器
├── components/         # UI组件
│   ├── ui/            # 基础UI组件
│   └── theme-provider.tsx
├── hooks/             # React Hooks
├── public/           # 静态资源
└── .env.local       # 环境变量
```

## 版本历史
### v2.0.0 (2025-09-02)
- ✅ 报告导出改为极简公文格式（无单位落款/编号）
- ✅ 仅支持 DOCX；DOC 需先转换
- ✅ DOCX 解析增加 HTML 兜底，提升成功率
- ✅ DeepSeek 无密钥优雅降级；支持自定义网关
- ✅ 可选鉴权（`API_AUTH_TOKEN`）与内存限流
- ✅ 严格构建检查（不忽略 ESLint/TS 错误）
- ✅ 长文档分片审查与结果合并

### v1.0.0 (2025-09-01)
- ✅ 集成 DeepSeek V3.1 API
- ✅ 实现基于《公平竞争审查条例实施办法》的严格审查逻辑
- ✅ 支持 DOCX 文档解析（DOC 需转换）
- ✅ 生成专业公文格式审查报告
- ✅ 苹果风格界面设计
- ✅ 暗色模式支持
- ✅ 响应式布局

## 联系方式

- **项目名称**: 杭州市临安区公平竞争审查在线工具
- **技术支持**: AI驱动的智能审查系统
- **许可证**: 政府内部使用

## 注意事项

⚠️ **重要提醒**:
- 请勿上传涉密文档
- 审查结果仅供参考，最终决定需人工复核
- 系统会自动清理临时文件，确保数据安全
- API密钥请妥善保管，避免泄露

---

*© 2025 杭州市临安区公平竞争审查工作组. 保留所有权利.*
