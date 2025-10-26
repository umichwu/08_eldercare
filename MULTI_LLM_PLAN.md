# 多 LLM 支援實作計劃

## 📋 概述

為 ElderCare 系統添加多個 LLM 提供商支援，讓用戶可以選擇使用 OpenAI ChatGPT 或 Google Gemini。

## 🎯 目標

1. **彈性選擇**: 用戶可在前端介面選擇要使用的 LLM
2. **統一介面**: 後端提供統一的 API，無論使用哪個 LLM
3. **配置管理**: 管理員可設定多個 LLM 的 API Keys
4. **降低成本**: 可根據需求選擇較便宜的 LLM
5. **備援機制**: 當一個 LLM 失敗時，可自動切換到另一個

## 🏗️ 架構設計

### 後端架構

```
backend/
├── config/
│   ├── openai.js          # 現有 OpenAI 配置
│   ├── gemini.js          # 新增 Gemini 配置
│   └── llm-factory.js     # LLM 工廠模式（統一介面）
├── services/
│   ├── llm/
│   │   ├── base-llm.js    # 抽象基礎類別
│   │   ├── openai-llm.js  # OpenAI 實作
│   │   └── gemini-llm.js  # Gemini 實作
│   └── messageService.js   # 更新以使用 LLM Factory
```

### 前端架構

```
frontend/public/
├── index.html             # 添加 LLM 選擇器 UI
├── app.js                 # 更新以傳送 LLM 選擇參數
└── settings.js            # 新增 LLM 偏好設定
```

## 📝 實作步驟

### Phase 1: 後端 LLM 抽象層（1-2 小時）

1. **創建 LLM 基礎類別** (`backend/services/llm/base-llm.js`)
   - 定義統一的介面：`chat()`, `stream()`, `getModelInfo()`
   - 處理錯誤和重試邏輯

2. **實作 OpenAI Provider** (`backend/services/llm/openai-llm.js`)
   - 包裝現有的 OpenAI 配置
   - 實作基礎類別的介面

3. **實作 Gemini Provider** (`backend/services/llm/gemini-llm.js`)
   - 整合 Google Gemini API
   - 將回應格式統一為標準格式

4. **創建 LLM Factory** (`backend/config/llm-factory.js`)
   - 根據參數返回對應的 LLM 實例
   - 處理配置載入和驗證

### Phase 2: API 更新（30分鐘）

1. **更新訊息 API** (`backend/routes/api.js`)
   - 接受 `llmProvider` 參數（預設: 'openai'）
   - 將選擇傳遞給 messageService

2. **更新環境變數** (`.env.example`)
   ```env
   # OpenAI
   OPENAI_API_KEY=sk-...
   OPENAI_MODEL=gpt-4o-mini

   # Google Gemini
   GEMINI_API_KEY=AIza...
   GEMINI_MODEL=gemini-1.5-flash

   # 預設 LLM
   DEFAULT_LLM_PROVIDER=openai
   ```

### Phase 3: 前端 UI（1 小時）

1. **添加 LLM 選擇器** (`index.html`)
   - 在訊息輸入框上方添加選擇器
   - 支援：OpenAI (ChatGPT), Google (Gemini)
   - 顯示當前使用的模型

2. **更新發送邏輯** (`app.js`)
   - 在 API 請求中包含 `llmProvider` 參數
   - 儲存用戶偏好到 localStorage

3. **添加設定頁面** (`settings.js`)
   - LLM 偏好設定
   - 顯示可用的 LLM 列表
   - 顯示每個 LLM 的狀態（可用/不可用）

### Phase 4: 資料庫更新（選用，30分鐘）

1. **更新 messages 表格**
   - 添加 `llm_provider` 欄位（記錄使用哪個 LLM）
   - 添加 `llm_model` 欄位（記錄具體模型）

2. **更新 user_profiles 表格**
   - 添加 `preferred_llm` 欄位（用戶偏好）

## 🔧 技術細節

### Gemini API 整合

```javascript
// backend/config/gemini.js
import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY;
const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

export const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;
export const defaultModel = model;
```

### 統一的回應格式

```javascript
{
  provider: 'openai' | 'gemini',
  model: 'gpt-4o-mini' | 'gemini-1.5-flash',
  content: '回應文字',
  usage: {
    promptTokens: 100,
    completionTokens: 50,
    totalTokens: 150
  },
  finishReason: 'stop',
  timestamp: '2024-01-01T00:00:00Z'
}
```

## 📦 需要的 NPM 套件

```bash
npm install @google/generative-ai --save
```

## 🧪 測試計劃

1. **單元測試**
   - 測試每個 LLM Provider
   - 測試 LLM Factory
   - 測試錯誤處理

2. **整合測試**
   - 測試 API 端點
   - 測試 LLM 切換
   - 測試備援機制

3. **用戶測試**
   - 測試前端 UI
   - 測試用戶體驗
   - 測試效能差異

## 💰 成本比較

| Provider | 模型 | 輸入成本 (每 1M tokens) | 輸出成本 (每 1M tokens) |
|---------|------|------------------------|------------------------|
| OpenAI | gpt-4o-mini | $0.150 | $0.600 |
| OpenAI | gpt-4o | $2.50 | $10.00 |
| Google | gemini-1.5-flash | $0.075 | $0.30 |
| Google | gemini-1.5-pro | $1.25 | $5.00 |

**建議**:
- 日常對話: 使用 Gemini 1.5 Flash (最便宜)
- 複雜任務: 使用 GPT-4o-mini
- 最高品質: 使用 Gemini 1.5 Pro 或 GPT-4o

## ⏱️ 預估時間

- **Phase 1 (後端)**: 1-2 小時
- **Phase 2 (API)**: 30 分鐘
- **Phase 3 (前端)**: 1 小時
- **Phase 4 (資料庫)**: 30 分鐘（選用）
- **測試**: 1 小時
- **文件**: 30 分鐘

**總計**: 約 3.5 - 5 小時

## 🚀 部署步驟

1. 更新後端代碼並部署到 Render
2. 在 Render 環境變數中添加 `GEMINI_API_KEY`
3. 更新前端代碼並部署到 Vercel
4. 執行資料庫 migration（如果需要）
5. 測試兩個 LLM 都正常運作
6. 更新文件

## 📚 參考資料

- [OpenAI API 文件](https://platform.openai.com/docs/api-reference)
- [Google Gemini API 文件](https://ai.google.dev/docs)
- [Gemini 定價](https://ai.google.dev/pricing)
- [OpenAI 定價](https://openai.com/api/pricing/)

## ✅ 完成檢查清單

- [ ] 後端 LLM 抽象層實作完成
- [ ] OpenAI Provider 實作完成
- [ ] Gemini Provider 實作完成
- [ ] LLM Factory 實作完成
- [ ] API 端點更新完成
- [ ] 前端 UI 實作完成
- [ ] 設定頁面實作完成
- [ ] 環境變數配置完成
- [ ] 單元測試通過
- [ ] 整合測試通過
- [ ] 部署到 Render
- [ ] 部署到 Vercel
- [ ] 文件更新完成
