import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// 取得當前檔案的目錄
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 載入環境變數
// 在本地開發：從根目錄的 .env 載入
// 在 Render：環境變數已經在 Dashboard 設定，dotenv.config() 不會覆蓋現有變數
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: path.resolve(__dirname, '../../.env') });
} else {
  // 生產環境：環境變數應該由平台提供（Render Dashboard）
  dotenv.config(); // 嘗試載入，但不強制要求檔案存在
}

const apiKey = process.env.OPENAI_API_KEY;
const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

if (!apiKey) {
  console.warn('⚠️  OpenAI API key not configured - LLM features will not work');
  if (process.env.NODE_ENV !== 'production') {
    console.warn('   請在 .env 檔案中設定 OPENAI_API_KEY');
    console.warn('   .env 路徑:', path.resolve(__dirname, '../../.env'));
  } else {
    console.warn('   請在 Render Dashboard 設定 OPENAI_API_KEY');
  }
}

export const openai = apiKey ? new OpenAI({ apiKey }) : null;
export const defaultModel = model;

console.log('✅ OpenAI client initialized');
console.log('   Model:', model);
console.log('   API Key:', apiKey ? 'Configured' : 'Not configured');
