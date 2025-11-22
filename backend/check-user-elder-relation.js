/**
 * 檢查 elder 和 user_profile 的關聯
 */

import { supabaseAdmin as supabase } from './config/supabase.js';

async function checkRelation() {
  console.log('\n檢查 elder 和 user_profile 的關聯...\n');

  const { data: elders, error } = await supabase
    .from('elders')
    .select(`
      id,
      name,
      user_profile_id,
      auth_user_id
    `);

  if (error) {
    console.error('錯誤:', error);
    return;
  }

  console.log('找到的長輩資料:\n');
  elders.forEach(elder => {
    console.log(`長輩: ${elder.name}`);
    console.log(`  elder_id: ${elder.id}`);
    console.log(`  user_profile_id: ${elder.user_profile_id}`);
    console.log(`  auth_user_id: ${elder.auth_user_id}`);
    console.log('');
  });

  // 檢查 user_profiles
  const { data: profiles, error: profileError } = await supabase
    .from('user_profiles')
    .select('id, display_name, elder_id');

  if (profileError) {
    console.error('錯誤:', profileError);
    return;
  }

  console.log('\n找到的 user profiles:\n');
  profiles.forEach(profile => {
    console.log(`Profile: ${profile.display_name || '未命名'}`);
    console.log(`  profile_id: ${profile.id}`);
    console.log(`  elder_id: ${profile.elder_id}`);
    console.log('');
  });
}

checkRelation();
