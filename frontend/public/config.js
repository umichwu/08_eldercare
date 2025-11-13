/**
 * 全域配置檔
 * 此檔案會最先載入，供所有其他 JavaScript 檔案使用
 */

// ===================================
// 🤖 AI 模型配置 (預設 LLM 提供商)
// ===================================
//
// 修改此處來改變預設的 AI 模型：
//
//   'openai'   - 使用 OpenAI GPT-4o-mini (推薦，穩定且配額充足)
//   'gemini'   - 使用 Google Gemini (透過後端 Key Pool，支援多個 API Keys)
//   'deepseek' - 使用 DeepSeek (需要確認帳戶餘額)
//
// 範例：
//   const DEFAULT_LLM_PROVIDER = 'openai';    // 使用 OpenAI
//   const DEFAULT_LLM_PROVIDER = 'gemini';    // 使用 Gemini
//   const DEFAULT_LLM_PROVIDER = 'deepseek';  // 使用 DeepSeek
// 
//  1. 修改成 OpenAI - ChatGPT (當前設定)
const DEFAULT_LLM_PROVIDER = 'openai';  // ⬅️ 在這裡修改預設 AI 模型
const LLM_CONFIG_VERSION = '2025-11-13-openai';  // ⬅️ 修改 LLM 時也要改這裡

//  2. 使用 Gemini
//  const DEFAULT_LLM_PROVIDER = 'gemini';  // ⬅️ 改這裡
//  const LLM_CONFIG_VERSION = '2025-11-13-gemini';  // ⬅️ 也要改這裡（任何不同的字串都可以）

//  3. 使用 DeepSeek
//  const DEFAULT_LLM_PROVIDER = 'deepseek';  // ⬅️ 改這裡
//  const LLM_CONFIG_VERSION = '2025-11-13-deepseek';  // ⬅️ 也要改這裡

// ===================================

// 檢查並清除過期的 localStorage 設定
if (localStorage.getItem('llmConfigVersion') !== LLM_CONFIG_VERSION) {
  console.log('🔄 檢測到 LLM 配置更新，清除舊設定...');
  localStorage.removeItem('llmProvider');
  localStorage.setItem('llmConfigVersion', LLM_CONFIG_VERSION);
  console.log(`✅ 已更新為預設 LLM: ${DEFAULT_LLM_PROVIDER}`);
}

// ===================================
// 🔍 網路搜尋功能配置
// ===================================
//
// 控制是否啟用即時網路搜尋功能：
// - true:  啟用網路搜尋（會查詢最新的天氣、新聞、颱風等即時資訊）
// - false: 關閉網路搜尋（AI 只根據既有知識回答，不查詢即時資訊）
//
// 注意：網路搜尋可能增加 API 用量和回應時間
//
const DEFAULT_WEB_SEARCH_ENABLED = true;  // ⬅️ 預設啟用網路搜尋
const WEB_SEARCH_CONFIG_VERSION = '2025-11-13-v1';

// 檢查並清除過期的網路搜尋設定
if (localStorage.getItem('webSearchConfigVersion') !== WEB_SEARCH_CONFIG_VERSION) {
  console.log('🔄 檢測到網路搜尋配置更新，清除舊設定...');
  localStorage.removeItem('webSearchEnabled');
  localStorage.setItem('webSearchConfigVersion', WEB_SEARCH_CONFIG_VERSION);
  console.log(`✅ 已更新為預設網路搜尋設定: ${DEFAULT_WEB_SEARCH_ENABLED ? '啟用' : '停用'}`);
}

// ===================================

console.log('📝 全域配置已載入');
console.log(`   預設 LLM 提供商: ${DEFAULT_LLM_PROVIDER}`);
console.log(`   配置版本: ${LLM_CONFIG_VERSION}`);
console.log(`   網路搜尋: ${DEFAULT_WEB_SEARCH_ENABLED ? '啟用' : '停用'}`);
