import { createClient } from '@supabase/supabase-js';
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

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ 環境變數檢查失敗:');
  console.error('   SUPABASE_URL:', supabaseUrl ? '✅ 已設定' : '❌ 缺少');
  console.error('   SUPABASE_ANON_KEY:', supabaseAnonKey ? '✅ 已設定' : '❌ 缺少');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceRoleKey ? '✅ 已設定' : '❌ 缺少');

  if (process.env.NODE_ENV !== 'production') {
    console.error('   請檢查 .env 檔案是否存在且格式正確');
    console.error('   .env 路徑:', path.resolve(__dirname, '../../.env'));
  } else {
    console.error('   請確認 Render Dashboard 的環境變數設定');
    console.error('   必要變數: SUPABASE_URL, SUPABASE_ANON_KEY');
  }

  throw new Error('Missing required Supabase environment variables');
}

if (!supabaseServiceRoleKey) {
  console.warn('⚠️  SUPABASE_SERVICE_ROLE_KEY 未設定，某些功能可能無法使用（FCM推送、用藥提醒等）');
}

// Client for user-level operations (uses RLS)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin client for server-side operations (bypasses RLS)
// 使用 service_role key 來繞過 RLS，適用於後端管理操作
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

console.log('✅ Supabase client initialized');
console.log('   URL:', supabaseUrl);
