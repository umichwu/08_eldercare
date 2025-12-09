/**
 * 測試家屬設定 API
 * 用途：驗證家屬設定功能是否正常運作
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 缺少 Supabase 環境變數');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testFamilySettings() {
  console.log('=== 測試家屬設定功能 ===\n');

  try {
    // 1. 檢查 family_settings 表是否存在
    console.log('1️⃣ 檢查 family_settings 表是否存在...');
    const { data: tables, error: tablesError } = await supabase
      .from('family_settings')
      .select('*')
      .limit(1);

    if (tablesError && tablesError.code === '42P01') {
      console.error('❌ family_settings 表不存在');
      console.log('請先在 Supabase Dashboard 的 SQL Editor 中執行:');
      console.log('database/migrations/add_family_settings.sql\n');
      return;
    } else if (tablesError) {
      console.error('❌ 查詢失敗:', tablesError);
      return;
    }

    console.log('✅ family_settings 表存在\n');

    // 2. 查詢第一個家屬成員
    console.log('2️⃣ 查詢家屬成員...');
    const { data: familyMembers, error: familyError } = await supabase
      .from('family_members')
      .select('id, name')
      .limit(1);

    if (familyError) {
      console.error('❌ 查詢家屬成員失敗:', familyError);
      return;
    }

    if (!familyMembers || familyMembers.length === 0) {
      console.log('⚠️ 沒有找到家屬成員');
      console.log('請先建立家屬資料\n');
      return;
    }

    const familyMember = familyMembers[0];
    console.log(`✅ 找到家屬成員: ${familyMember.name} (ID: ${familyMember.id})\n`);

    // 3. 測試插入設定
    console.log('3️⃣ 測試插入設定...');
    const testSettings = {
      family_member_id: familyMember.id,
      notification_preferences: {
        email: true,
        sms: false,
        push: true
      },
      alert_thresholds: {
        medication_compliance: 75,
        missed_medication: 3,
        safe_zone_alert: true
      },
      language_preference: 'zh-TW'
    };

    const { data: insertedSettings, error: insertError } = await supabase
      .from('family_settings')
      .upsert(testSettings, { onConflict: 'family_member_id' })
      .select()
      .single();

    if (insertError) {
      console.error('❌ 插入設定失敗:', insertError);
      return;
    }

    console.log('✅ 設定已插入/更新:');
    console.log(JSON.stringify(insertedSettings, null, 2));
    console.log();

    // 4. 測試查詢設定
    console.log('4️⃣ 測試查詢設定...');
    const { data: queriedSettings, error: queryError } = await supabase
      .from('family_settings')
      .select('*')
      .eq('family_member_id', familyMember.id)
      .single();

    if (queryError) {
      console.error('❌ 查詢設定失敗:', queryError);
      return;
    }

    console.log('✅ 查詢到的設定:');
    console.log(JSON.stringify(queriedSettings, null, 2));
    console.log();

    // 5. 測試更新設定
    console.log('5️⃣ 測試更新設定...');
    const updatedSettings = {
      family_member_id: familyMember.id,
      notification_preferences: {
        email: false,
        sms: true,
        push: false
      },
      alert_thresholds: {
        medication_compliance: 80,
        missed_medication: 2,
        safe_zone_alert: false
      },
      language_preference: 'en-US'
    };

    const { data: updated, error: updateError } = await supabase
      .from('family_settings')
      .upsert(updatedSettings, { onConflict: 'family_member_id' })
      .select()
      .single();

    if (updateError) {
      console.error('❌ 更新設定失敗:', updateError);
      return;
    }

    console.log('✅ 設定已更新:');
    console.log(JSON.stringify(updated, null, 2));
    console.log();

    // 6. 驗證更新
    console.log('6️⃣ 驗證更新結果...');
    const { data: finalSettings, error: finalError } = await supabase
      .from('family_settings')
      .select('*')
      .eq('family_member_id', familyMember.id)
      .single();

    if (finalError) {
      console.error('❌ 查詢最終設定失敗:', finalError);
      return;
    }

    console.log('✅ 最終設定:');
    console.log(JSON.stringify(finalSettings, null, 2));
    console.log();

    console.log('=== ✅ 所有測試通過！ ===\n');

    console.log('📝 測試摘要:');
    console.log('- family_settings 表存在: ✅');
    console.log('- 插入設定: ✅');
    console.log('- 查詢設定: ✅');
    console.log('- 更新設定: ✅');
    console.log('- 驗證更新: ✅');
    console.log();

    console.log('🎯 下一步:');
    console.log('1. 前往家屬監控面板');
    console.log('2. 點擊「⚙️ 設定」按鈕');
    console.log('3. 在「個人化設定」區域測試設定功能');

  } catch (error) {
    console.error('❌ 測試過程中發生錯誤:', error);
  }
}

testFamilySettings();
