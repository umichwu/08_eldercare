/**
 * FCM 註冊測試腳本
 *
 * 用途：測試 FCM Token 註冊功能
 */

const elderId = 'fe50db48-6d33-4777-803b-8b335625c9c2';
const testToken = 'test-fcm-token-' + Date.now();

console.log('🧪 測試 FCM Token 註冊');
console.log('長輩 ID:', elderId);
console.log('測試 Token:', testToken);

fetch('http://localhost:3000/api/fcm/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: elderId,
    userType: 'elder',
    fcmToken: testToken,
    deviceInfo: {
      userAgent: 'Test Script',
      platform: 'Node.js',
      language: 'zh-TW'
    }
  })
})
.then(res => res.json())
.then(data => {
  console.log('\n✅ 註冊成功:', data);

  // 驗證資料庫是否更新
  return fetch(`http://localhost:3000/api/elders/${elderId}`);
})
.then(res => res.json())
.then(elder => {
  console.log('\n📋 驗證長輩資料:');
  console.log('姓名:', elder.name);
  console.log('FCM Token:', elder.fcm_token);
  console.log('Token 更新時間:', elder.fcm_token_updated_at);

  if (elder.fcm_token === testToken) {
    console.log('\n🎉 測試成功！FCM Token 已正確註冊');
  } else {
    console.log('\n❌ 測試失敗！Token 不匹配');
  }
})
.catch(error => {
  console.error('\n❌ 測試失敗:', error.message);
});
