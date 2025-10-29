import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// 取得當前檔案的目錄
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 載入環境變數（向上兩層 = 專案根目錄）
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ 環境變數檢查失敗:');
  console.error('   SUPABASE_URL:', supabaseUrl ? '✅ 已設定' : '❌ 缺少');
  console.error('   SUPABASE_ANON_KEY:', supabaseAnonKey ? '✅ 已設定' : '❌ 缺少');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceRoleKey ? '✅ 已設定' : '❌ 缺少');
  console.error('   請檢查 .env 檔案是否存在且格式正確');
  console.error('   .env 路徑:', path.resolve(__dirname, '../../.env'));
  throw new Error('Missing Supabase environment variables');
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
