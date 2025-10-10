# 如何检查是否调用了 DeepSeek API

## 方法一：查看服务器日志（推荐）

运行开发服务器后，在终端中会看到以下日志：

### 使用 API 模式
```
✅ 使用 DeepSeek API 进行审查，模型: deepseek-chat
🔄 正在调用 DeepSeek API，文档长度: 1234 字符
✅ DeepSeek API 响应成功，Token 使用: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 }
✅ 审查完成，模式: api，问题数: 3
```

### 使用本地模拟模式
```
⚠️  未配置 DEEPSEEK_API_KEY，使用本地模拟审查模式
```

## 方法二：检查响应数据

在浏览器开发者工具（F12）的 Network 标签中：
1. 找到 `/api/review` 请求
2. 查看响应的 JSON 数据
3. 检查 `reviewMode` 字段：
   - `"reviewMode": "api"` = 使用了 DeepSeek API
   - `"reviewMode": "local"` = 使用本地规则引擎

## 方法三：查看审查结果特征

### API 模式的特征
- 审查结果更加详细和灵活
- 问题描述更加自然
- 可能包含 AI 生成的个性化建议

### 本地模式的特征
- 摘要中包含"智能审查"、"精准条款匹配"等固定词汇
- 问题按照固定的规则匹配
- 条款引用严格按照预设映射

## 环境变量检查

确认 `.env.local` 或 `.env` 文件中是否配置了：
```bash
DEEPSEEK_API_KEY=your_api_key_here
```

如果没有配置，系统会自动使用本地模拟模式。

## 测试建议

1. **首先测试无 API Key 的情况**
   - 删除或注释掉 `DEEPSEEK_API_KEY`
   - 重启服务器
   - 进行审查，应该看到本地模式的日志

2. **然后测试有 API Key 的情况**
   - 配置正确的 `DEEPSEEK_API_KEY`
   - 重启服务器
   - 进行审查，应该看到 API 调用的日志
