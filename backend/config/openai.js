import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// 取得當前檔案的目錄
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 載入環境變數（向上兩層 = 專案根目錄）
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const apiKey = process.env.OPENAI_API_KEY;
const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

if (!apiKey) {
  console.warn('⚠️  OpenAI API key not configured - LLM features will not work');
  console.warn('   請在 .env 檔案中設定 OPENAI_API_KEY');
  console.warn('   .env 路徑:', path.resolve(__dirname, '../../.env'));
}

export const openai = apiKey ? new OpenAI({ apiKey }) : null;
export const defaultModel = model;

console.log('✅ OpenAI client initialized');
console.log('   Model:', model);
console.log('   API Key:', apiKey ? 'Configured' : 'Not configured');
