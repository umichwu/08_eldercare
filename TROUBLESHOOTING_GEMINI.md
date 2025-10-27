# 🔍 Gemini API 问题排查指南

## 当前问题

**错误信息**：`"傳送失敗，請重試: 無法產生AI回應 - 詳情: LLM API 呼叫失敗，請檢查 API Key 配置"`

**已确认**：
- ✅ Render 显示 "Gemini API Key: Configured"
- ✅ test-api.html 测试 Gemini API Key 成功
- ✅ 代码已推送并部署成功

---

## 📋 完整排查步骤

### 步骤 1: 确认 Render 环境变量

1. 登入 [Render Dashboard](https://dashboard.render.com)
2. 点击 `eldercare-backend` 服务
3. 点击左侧 **"Environment"** 标签
4. **确认以下变量存在且正确**：

```bash
LLM_PROVIDER=gemini
GEMINI_API_KEY=AIza... (你的完整 API Key)
```

⚠️ **重要检查项**：
- [ ] `GEMINI_API_KEY` 的值是否完整？（应该是 39 个字符）
- [ ] `GEMINI_API_KEY` 是否以 `AIza` 开头？
- [ ] 有没有多余的空格或换行符？
- [ ] 是否与 test-api.html 测试成功的 Key 完全一致？

### 步骤 2: 查看 Render 部署日志

1. 在 Render Dashboard，点击左侧 **"Logs"** 标签
2. 查找以下关键日志：

**应该看到的日志（正常）**：
```
✅ Gemini client initialized
📋 LLM Configuration:
   Current Provider: gemini
   Default Model: gemini-2.0-flash-exp
   Gemini API Key: Configured
```

**如果看到错误日志**：
```
⚠️  Gemini API key not configured
```
说明环境变量没有设置成功，回到步骤 1 重新检查。

### 步骤 3: 测试 API 调用

在 Render Logs 中查找具体的 API 调用日志：

**应该看到（成功）**：
```
📨 收到訊息請求: { conversationId: ..., userId: ..., llmProvider: 'gemini' }
🤖 使用 LLM 提供商: gemini
🤖 Generating response with gemini (gemini-2.0-flash-exp)
   Temperature: 0.7, MaxTokens: 500
   Messages count: 2
✅ Response generated successfully from gemini
   Content length: 150 chars
✅ 訊息處理成功
```

**如果看到错误**：
```
❌ LLM client not initialized for provider: gemini
   Available API Keys: { openai: true, gemini: false, deepseek: false }
```
说明 `GEMINI_API_KEY` 没有被正确读取。

### 步骤 4: 重新部署

如果修改了环境变量：

1. 确认已点击 **"Save Changes"**
2. Render 应该会自动重新部署
3. 如果没有自动部署，点击 **"Manual Deploy"** → **"Deploy latest commit"**
4. 等待 3-5 分钟部署完成
5. 再次查看 Logs 确认新的配置已生效

### 步骤 5: 清除缓存并重试

1. 在浏览器打开 https://08-eldercare.vercel.app/
2. 按 **F12** 打开开发者工具
3. 右键点击浏览器的刷新按钮
4. 选择 **"清除缓存并硬性重新加载"**
5. 重新登入并测试发送消息

### 步骤 6: 检查前端日志

在浏览器 Console（F12）中查看日志：

**应该看到（成功）**：
```
📦 請求資料: { userId: "...", content: "你好", llmProvider: "gemini" }
🌐 API 呼叫: POST /conversations/.../messages
✅ API 回應: { userMessage: {...}, assistantMessage: {...} }
```

**如果看到错误**：
```
❌ API 錯誤回應: { error: "無法產生 AI 回應", details: "..." }
```

复制完整的错误信息，包括 `details` 字段的内容。

---

## 🧪 快速测试方法

### 测试 1: 直接测试 Health Endpoint

在浏览器访问：
```
https://eldercare-backend-8o4k.onrender.com/api/health
```

应该看到类似的回应：
```json
{
  "status": "ok",
  "timestamp": "2025-01-...",
  "environment": "production",
  "llm": {
    "provider": "gemini",
    "available": true
  }
}
```

### 测试 2: 使用 test-api.html

1. 访问 https://08-eldercare.vercel.app/test-api.html
2. 选择 "Google Gemini"
3. 输入相同的 API Key（与 Render 配置的完全一致）
4. 测试消息："测试"
5. 点击 "🧪 直接测试 API Key"
6. 确认测试成功

---

## 🔑 API Key 常见问题

### 问题 1: Key 格式错误

**正确格式**：
```
AIzaSyC1234567890abcdefghijklmnopqrstuv
```

**错误示例**：
- ❌ 包含空格：`AIza... ` 或 ` AIza...`
- ❌ 包含换行：`AIza...\n`
- ❌ 截断不完整：`AIza...xyz`（少于 39 个字符）
- ❌ 使用了不同的 Key：test-api.html 测试的 Key 和 Render 配置的不一样

### 问题 2: API Key 权限不足

1. 访问 [Google AI Studio](https://aistudio.google.com/app/apikey)
2. 确认 API Key 的状态是 "Active"
3. 检查 API Key 的配额使用情况
4. 如果超出配额，等待重置或创建新的 Key

### 问题 3: API Key 过期

1. 删除旧的 API Key
2. 创建新的 API Key
3. 更新 Render 环境变量
4. 重新部署

---

## 📞 需要提供的信息

如果问题仍然无法解决，请提供以下信息：

1. **Render Logs 的完整错误信息**：
   - 从 `📨 收到訊息請求` 开始
   - 到 `❌ 產生 AI 回應失敗` 结束
   - 包括所有中间的日志

2. **浏览器 Console 的错误信息**：
   - 按 F12 打开开发者工具
   - 切换到 Console 标签
   - 复制所有红色的错误信息

3. **test-api.html 测试结果**：
   - 截图测试成功的画面
   - 确认使用的是同一个 API Key

4. **Render 环境变量截图**：
   - 隐藏 API Key 的大部分内容
   - 只显示前 10 个字符：`AIzaSyC123...`

---

## ✅ 解决后的验证

问题解决后，你应该看到：

1. **Render Logs**：
   ```
   ✅ Response generated successfully from gemini
   ✅ 訊息處理成功
   ```

2. **前端界面**：
   - 能够正常发送和接收消息
   - AI 回复的消息下方显示 "🌟 Gemini" 标签

3. **浏览器 Console**：
   - 没有红色错误信息
   - 显示 `✅ API 回應成功`

---

## 🎯 最可能的原因

根据你的描述，最可能的原因是：

1. **API Key 复制错误**：
   - Render 配置的 Key 和 test-api.html 测试的 Key 不一致
   - 建议：重新复制粘贴，确保完全一致

2. **环境变量未生效**：
   - 修改后没有重新部署
   - 建议：手动触发重新部署

3. **缓存问题**：
   - 旧的配置被缓存
   - 建议：清除浏览器缓存，重启 Render 服务

---

## 📚 相关文档

- [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) - 完整部署指南
- [test-api.html](https://08-eldercare.vercel.app/test-api.html) - API Key 测试工具
- [Google AI Studio](https://aistudio.google.com/app/apikey) - 获取 Gemini API Key
