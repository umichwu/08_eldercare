/**
 * 清理所有重複的用藥記錄
 * 保留最早創建的那一筆，刪除其他重複的
 */
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function cleanupDuplicates() {
  try {
    console.log('🧹 開始清理重複的用藥記錄...\n');

    // 查詢今日和明日的所有用藥記錄
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const twoDaysLater = new Date(today);
    twoDaysLater.setDate(today.getDate() + 2);

    const { data: logs, error } = await supabase
      .from('medication_logs')
      .select('*')
      .gte('scheduled_time', today.toISOString())
      .lt('scheduled_time', twoDaysLater.toISOString())
      .order('created_at', { ascending: true }); // 按創建時間排序

    if (error) {
      console.error('❌ 查詢失敗:', error);
      return;
    }

    console.log(`📊 找到 ${logs.length} 筆記錄\n`);

    // 按藥物和時間分組
    const grouped = {};

    logs.forEach(log => {
      const key = `${log.medication_id}_${log.scheduled_time}`;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(log);
    });

    // 找出重複的記錄並刪除
    let totalDeleted = 0;

    for (const [key, group] of Object.entries(grouped)) {
      if (group.length > 1) {
        console.log(`\n📌 處理重複記錄組 (共 ${group.length} 筆):`);
        console.log(`   Medication ID: ${group[0].medication_id}`);
        console.log(`   Scheduled Time: ${group[0].scheduled_time}`);

        // 保留第一筆（最早創建的），刪除其他
        const toKeep = group[0];
        const toDelete = group.slice(1);

        console.log(`   ✅ 保留: ID ${toKeep.id} (Created: ${new Date(toKeep.created_at).toLocaleString('zh-TW')})`);

        for (const log of toDelete) {
          console.log(`   🗑️  刪除: ID ${log.id} (Created: ${new Date(log.created_at).toLocaleString('zh-TW')})`);

          const { error: deleteError } = await supabase
            .from('medication_logs')
            .delete()
            .eq('id', log.id);

          if (deleteError) {
            console.error(`   ❌ 刪除失敗:`, deleteError);
          } else {
            totalDeleted++;
          }
        }
      }
    }

    console.log(`\n\n✅ 清理完成！共刪除 ${totalDeleted} 筆重複記錄`);

  } catch (error) {
    console.error('❌ 執行失敗:', error);
  }
}

cleanupDuplicates();
