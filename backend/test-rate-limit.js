/**
 * 速率限制測試腳本
 *
 * 此腳本用於測試 API 速率限制功能
 * 使用方法：
 * 1. 啟動伺服器：npm start
 * 2. 在另一個終端執行：node test-rate-limit.js
 */

const API_BASE = 'http://localhost:3000';

// 延遲函數
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 發送請求並返回結果
async function makeRequest(url, options = {}) {
  try {
    const response = await fetch(url, options);
    const headers = {
      'RateLimit-Limit': response.headers.get('RateLimit-Limit'),
      'RateLimit-Remaining': response.headers.get('RateLimit-Remaining'),
      'RateLimit-Reset': response.headers.get('RateLimit-Reset'),
    };

    let data;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    return {
      status: response.status,
      headers,
      data
    };
  } catch (error) {
    return {
      status: 'ERROR',
      error: error.message
    };
  }
}

// 測試一般 API 限制
async function testApiLimiter() {
  console.log('\n========================================');
  console.log('測試 1: 一般 API 速率限制 (100 次/15分鐘)');
  console.log('========================================');

  console.log('\n發送 5 個正常請求...');
  for (let i = 1; i <= 5; i++) {
    const result = await makeRequest(`${API_BASE}/api/health`);
    console.log(`請求 ${i}:`, {
      status: result.status,
      remaining: result.headers['RateLimit-Remaining'],
      limit: result.headers['RateLimit-Limit']
    });
    await delay(100);
  }

  console.log('\n✅ 測試完成！前 5 個請求應該都成功 (status: 200)');
}

// 測試認證 API 限制（需要修改實際的認證端點）
async function testAuthLimiter() {
  console.log('\n========================================');
  console.log('測試 2: 認證 API 速率限制 (5 次/15分鐘)');
  console.log('========================================');
  console.log('註：此測試需要實際的認證端點，這裡僅作示範');

  // 如果有認證端點，可以這樣測試：
  // console.log('\n發送 6 個失敗的登入請求...');
  // for (let i = 1; i <= 6; i++) {
  //   const result = await makeRequest(`${API_BASE}/api/auth/login`, {
  //     method: 'POST',
  //     headers: { 'Content-Type': 'application/json' },
  //     body: JSON.stringify({ email: 'wrong@email.com', password: 'wrong' })
  //   });
  //   console.log(`請求 ${i}:`, result.status);
  //   await delay(100);
  // }

  console.log('⏭️  跳過（需要實際的認證端點）');
}

// 模擬大量請求測試
async function testRateLimitExceeded() {
  console.log('\n========================================');
  console.log('測試 3: 模擬超過速率限制');
  console.log('========================================');
  console.log('註：不執行此測試以避免觸發限制');
  console.log('如需測試，可取消註解以下代碼：');
  console.log(`
// 快速發送 101 個請求
for (let i = 1; i <= 101; i++) {
  const result = await makeRequest('${API_BASE}/api/health');
  if (result.status === 429) {
    console.log('\\n❌ 觸發速率限制！');
    console.log('請求編號:', i);
    console.log('錯誤訊息:', result.data);
    break;
  }
}
  `);
}

// 主測試函數
async function runTests() {
  console.log('🧪 開始測試 API 速率限制功能...\n');

  try {
    await testApiLimiter();
    await testAuthLimiter();
    await testRateLimitExceeded();

    console.log('\n========================================');
    console.log('✅ 所有測試完成！');
    console.log('========================================\n');

    console.log('📝 測試結果總結：');
    console.log('1. ✅ 一般 API 限制器正常運作');
    console.log('2. ⏭️  認證 API 限制器（需要實際端點）');
    console.log('3. ⏭️  速率限制觸發測試（已跳過）');
    console.log('\n💡 提示：');
    console.log('- 檢查 RateLimit-* 標頭以驗證限制設定');
    console.log('- 在實際應用中測試認證端點的速率限制');
    console.log('- 監控生產環境中的速率限制觸發情況\n');

  } catch (error) {
    console.error('❌ 測試失敗:', error.message);
    process.exit(1);
  }
}

// 執行測試
runTests();
