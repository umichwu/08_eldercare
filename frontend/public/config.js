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
const DEFAULT_LLM_PROVIDER = 'openai';  // ⬅️ 在這裡修改預設 AI 模型

// 配置版本（修改 DEFAULT_LLM_PROVIDER 時請同步更新此版本號）
// 用途：當版本號改變時，自動清除舊的 localStorage 設定
const LLM_CONFIG_VERSION = '2025-11-12-openai';  // ⬅️ 修改 LLM 時也要改這裡
// ===================================

// 檢查並清除過期的 localStorage 設定
if (localStorage.getItem('llmConfigVersion') !== LLM_CONFIG_VERSION) {
  console.log('🔄 檢測到 LLM 配置更新，清除舊設定...');
  localStorage.removeItem('llmProvider');
  localStorage.setItem('llmConfigVersion', LLM_CONFIG_VERSION);
  console.log(`✅ 已更新為預設 LLM: ${DEFAULT_LLM_PROVIDER}`);
}

console.log('📝 全域配置已載入');
console.log(`   預設 LLM 提供商: ${DEFAULT_LLM_PROVIDER}`);
console.log(`   配置版本: ${LLM_CONFIG_VERSION}`);
