/**
 * Gemini API Key Pool Manager
 *
 * 功能：
 * 1. 管理多個 Gemini API Keys
 * 2. Round Robin 調度策略
 * 3. 健康檢查（跳過已達配額的 Key）
 * 4. 自動失敗重試（嘗試下一個可用的 Key）
 * 5. 配額追蹤和日誌
 *
 * 環境變數設定：
 * GEMINI_API_KEY_1=AIzaSy...
 * GEMINI_API_KEY_2=AIzaSy...
 * GEMINI_API_KEY_3=AIzaSy...
 * GEMINI_API_KEY_4=AIzaSy...
 * GEMINI_API_KEY_5=AIzaSy...
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

class GeminiKeyPool {
  constructor() {
    this.keys = [];
    this.currentIndex = 0;
    this.keyStats = new Map(); // 追蹤每個 Key 的使用統計
    this.blacklist = new Set(); // 暫時封鎖已達配額的 Key
    this.blacklistDuration = 60 * 60 * 1000; // 封鎖時間：1小時

    this.initializeKeys();
  }

  /**
   * 從環境變數載入所有 API Keys
   */
  initializeKeys() {
    console.log('🔑 初始化 Gemini API Key Pool...');

    // 嘗試載入最多 10 個 Key（GEMINI_API_KEY_1 到 GEMINI_API_KEY_10）
    for (let i = 1; i <= 10; i++) {
      const key = process.env[`GEMINI_API_KEY_${i}`];

      if (key && key.trim()) {
        const keyInfo = {
          id: `key_${i}`,
          key: key.trim(),
          index: i,
          prefix: key.substring(0, 10) + '...',
          client: null, // 延遲初始化
          isHealthy: true,
          lastUsed: null,
          successCount: 0,
          errorCount: 0,
          lastError: null,
          blacklistedUntil: null
        };

        this.keys.push(keyInfo);
        this.keyStats.set(keyInfo.id, {
          totalRequests: 0,
          successRequests: 0,
          failedRequests: 0,
          quotaErrors: 0,
          lastUsed: null
        });

        console.log(`   ✅ 載入 Key #${i}: ${keyInfo.prefix}`);
      }
    }

    // 如果沒有找到編號的 Key，檢查原始的 GEMINI_API_KEY
    if (this.keys.length === 0 && process.env.GEMINI_API_KEY) {
      const key = process.env.GEMINI_API_KEY.trim();
      const keyInfo = {
        id: 'key_default',
        key: key,
        index: 0,
        prefix: key.substring(0, 10) + '...',
        client: null,
        isHealthy: true,
        lastUsed: null,
        successCount: 0,
        errorCount: 0,
        lastError: null,
        blacklistedUntil: null
      };

      this.keys.push(keyInfo);
      this.keyStats.set(keyInfo.id, {
        totalRequests: 0,
        successRequests: 0,
        failedRequests: 0,
        quotaErrors: 0,
        lastUsed: null
      });

      console.log(`   ✅ 載入預設 Key: ${keyInfo.prefix}`);
    }

    console.log(`✅ API Key Pool 初始化完成，共載入 ${this.keys.length} 個 Keys`);

    if (this.keys.length === 0) {
      console.warn('⚠️ 警告：沒有找到任何 Gemini API Key！');
    }
  }

  /**
   * 獲取下一個可用的 API Key（Round Robin + Health Check）
   */
  getNextKey() {
    if (this.keys.length === 0) {
      throw new Error('沒有可用的 Gemini API Key');
    }

    const now = Date.now();
    let attempts = 0;
    const maxAttempts = this.keys.length;

    while (attempts < maxAttempts) {
      // Round Robin：選擇下一個 Key
      const keyInfo = this.keys[this.currentIndex];
      this.currentIndex = (this.currentIndex + 1) % this.keys.length;
      attempts++;

      // 檢查是否在黑名單中
      if (keyInfo.blacklistedUntil && now < keyInfo.blacklistedUntil) {
        const remainingTime = Math.ceil((keyInfo.blacklistedUntil - now) / 1000 / 60);
        console.log(`   ⏭️ 跳過 ${keyInfo.id}（黑名單，剩餘 ${remainingTime} 分鐘）`);
        continue;
      }

      // 如果黑名單時間已過，解除封鎖
      if (keyInfo.blacklistedUntil && now >= keyInfo.blacklistedUntil) {
        console.log(`   🔓 解除 ${keyInfo.id} 的黑名單`);
        keyInfo.blacklistedUntil = null;
        keyInfo.isHealthy = true;
        keyInfo.lastError = null;
      }

      // 延遲初始化 Client
      if (!keyInfo.client) {
        keyInfo.client = new GoogleGenerativeAI(keyInfo.key);
      }

      // 更新使用時間
      keyInfo.lastUsed = now;
      const stats = this.keyStats.get(keyInfo.id);
      stats.lastUsed = now;
      stats.totalRequests++;

      console.log(`🎯 選擇 API Key: ${keyInfo.id} (${keyInfo.prefix})`);
      console.log(`   使用統計: ${stats.successRequests} 成功 / ${stats.failedRequests} 失敗 / ${stats.quotaErrors} 配額錯誤`);

      return keyInfo;
    }

    // 所有 Key 都被封鎖了
    throw new Error('所有 Gemini API Keys 都已達配額限制，請稍後再試');
  }

  /**
   * 標記 Key 為成功
   */
  markSuccess(keyInfo) {
    keyInfo.successCount++;
    keyInfo.isHealthy = true;
    keyInfo.lastError = null;

    const stats = this.keyStats.get(keyInfo.id);
    stats.successRequests++;

    console.log(`✅ ${keyInfo.id} 調用成功`);
  }

  /**
   * 標記 Key 為失敗（配額錯誤）
   */
  markQuotaError(keyInfo) {
    keyInfo.errorCount++;
    keyInfo.isHealthy = false;
    keyInfo.lastError = 'QUOTA_EXCEEDED';
    keyInfo.blacklistedUntil = Date.now() + this.blacklistDuration;

    const stats = this.keyStats.get(keyInfo.id);
    stats.failedRequests++;
    stats.quotaErrors++;

    console.warn(`❌ ${keyInfo.id} 配額已達上限，加入黑名單 1 小時`);
    console.warn(`   總計：${stats.totalRequests} 次請求，${stats.quotaErrors} 次配額錯誤`);
  }

  /**
   * 標記 Key 為失敗（一般錯誤）
   */
  markError(keyInfo, error) {
    keyInfo.errorCount++;
    keyInfo.lastError = error.message;

    const stats = this.keyStats.get(keyInfo.id);
    stats.failedRequests++;

    console.warn(`⚠️ ${keyInfo.id} 發生錯誤: ${error.message}`);
  }

  /**
   * 取得 Client（支持重試）
   */
  async getClientWithRetry() {
    if (this.keys.length === 0) {
      throw new Error('沒有可用的 Gemini API Key');
    }

    const maxRetries = Math.min(3, this.keys.length);
    let lastError = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const keyInfo = this.getNextKey();

        // 返回 Client 和 Key 資訊
        return {
          client: keyInfo.client,
          keyInfo: keyInfo
        };
      } catch (error) {
        lastError = error;
        console.warn(`⚠️ 嘗試 #${attempt + 1} 失敗: ${error.message}`);
      }
    }

    throw lastError || new Error('無法取得可用的 Gemini API Key');
  }

  /**
   * 取得池狀態統計
   */
  getStats() {
    const stats = {
      totalKeys: this.keys.length,
      healthyKeys: this.keys.filter(k => !k.blacklistedUntil || Date.now() >= k.blacklistedUntil).length,
      blacklistedKeys: this.keys.filter(k => k.blacklistedUntil && Date.now() < k.blacklistedUntil).length,
      keys: []
    };

    this.keys.forEach(keyInfo => {
      const keyStats = this.keyStats.get(keyInfo.id);
      const isBlacklisted = keyInfo.blacklistedUntil && Date.now() < keyInfo.blacklistedUntil;

      stats.keys.push({
        id: keyInfo.id,
        prefix: keyInfo.prefix,
        isHealthy: keyInfo.isHealthy,
        isBlacklisted: isBlacklisted,
        blacklistedUntil: keyInfo.blacklistedUntil,
        successCount: keyInfo.successCount,
        errorCount: keyInfo.errorCount,
        lastError: keyInfo.lastError,
        lastUsed: keyInfo.lastUsed,
        totalRequests: keyStats.totalRequests,
        successRate: keyStats.totalRequests > 0
          ? (keyStats.successRequests / keyStats.totalRequests * 100).toFixed(2) + '%'
          : 'N/A'
      });
    });

    return stats;
  }

  /**
   * 檢查是否有可用的 Key
   */
  hasAvailableKeys() {
    if (this.keys.length === 0) return false;

    const now = Date.now();
    return this.keys.some(k => !k.blacklistedUntil || now >= k.blacklistedUntil);
  }
}

// 單例模式
export const geminiKeyPool = new GeminiKeyPool();
export default geminiKeyPool;
