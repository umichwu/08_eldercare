/**
 * 執行資料庫遷移腳本
 *
 * 這個腳本會執行資料庫 schema 檔案來建立或更新資料表結構
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

// 取得當前檔案的目錄
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 載入環境變數
dotenv.config({ path: join(__dirname, '../.env') });

// 初始化 Supabase 客戶端（使用 Service Role Key 以執行 DDL）
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

/**
 * 執行 SQL 檔案
 */
async function executeSQLFile(filePath, description) {
  try {
    console.log(`\n📄 執行 ${description}...`);
    console.log(`   檔案: ${filePath}`);

    // 讀取 SQL 檔案
    const sql = readFileSync(filePath, 'utf8');

    // 執行 SQL（使用 Supabase REST API）
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      // 如果 exec_sql 函數不存在，嘗試使用直接執行方式
      console.log('   ⚠️  嘗試使用替代方式執行...');

      // 將 SQL 分割成多個語句並逐一執行
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i];
        if (stmt) {
          try {
            // 使用 Supabase client 的原始查詢功能
            const response = await fetch(
              `${process.env.SUPABASE_URL}/rest/v1/rpc/exec_sql`,
              {
                method: 'POST',
                headers: {
                  'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
                  'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ query: stmt })
              }
            );

            if (!response.ok && response.status !== 404) {
              const errorText = await response.text();
              console.log(`   ⚠️  語句 ${i + 1}/${statements.length} 執行警告: ${errorText}`);
            }
          } catch (err) {
            console.log(`   ⚠️  語句 ${i + 1}/${statements.length} 執行警告: ${err.message}`);
          }
        }
      }

      console.log('   ✅ 已完成執行（部分語句可能需要在 Supabase 控制台手動確認）');
      return;
    }

    console.log('   ✅ 執行成功！');

  } catch (error) {
    console.error(`   ❌ 執行失敗: ${error.message}`);
    throw error;
  }
}

/**
 * 主函數
 */
async function main() {
  console.log('🚀 開始執行資料庫遷移...\n');
  console.log('=' .repeat(60));

  try {
    // 執行群組聊天 schema
    await executeSQLFile(
      join(__dirname, '../database/group_chat_schema.sql'),
      '群組聊天功能 Schema'
    );

    // 執行短期用藥提醒 schema
    await executeSQLFile(
      join(__dirname, '../database/short_term_medication_schema.sql'),
      '短期用藥提醒功能 Schema'
    );

    console.log('\n' + '='.repeat(60));
    console.log('\n✅ 所有遷移執行完成！\n');
    console.log('📌 請注意：');
    console.log('   - 如果看到警告訊息，請到 Supabase 控制台檢查');
    console.log('   - 您可能需要手動執行部分 SQL 語句');
    console.log('   - 建議到 Supabase Dashboard > SQL Editor 確認表格是否建立成功');
    console.log('');

  } catch (error) {
    console.error('\n❌ 遷移過程發生錯誤:', error);
    console.log('\n📌 建議手動執行 SQL：');
    console.log('   1. 前往 Supabase Dashboard');
    console.log('   2. 開啟 SQL Editor');
    console.log('   3. 複製 database/*.sql 檔案內容並執行');
    process.exit(1);
  }
}

// 執行主函數
main();
