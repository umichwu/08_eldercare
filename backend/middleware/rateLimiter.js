/**
 * API 速率限制中間件
 * 使用 express-rate-limit 防止 API 濫用和 DDoS 攻擊
 */

import rateLimit from 'express-rate-limit';

/**
 * 一般 API 速率限制
 * 15 分鐘內最多 100 次請求
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分鐘
  max: 100, // 限制 100 次請求
  message: {
    success: false,
    error: '請求過於頻繁，請稍後再試',
    retryAfter: '請在 15 分鐘後重試'
  },
  standardHeaders: true, // 返回 `RateLimit-*` 標頭
  legacyHeaders: false, // 禁用 `X-RateLimit-*` 標頭
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: '請求過於頻繁，請稍後再試',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  }
});

/**
 * 認證 API 速率限制（更嚴格）
 * 15 分鐘內最多 5 次失敗的登入嘗試
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分鐘
  max: 5, // 15 分鐘內最多 5 次
  message: {
    success: false,
    error: '登入嘗試次數過多，請稍後再試',
    retryAfter: '請在 15 分鐘後重試'
  },
  skipSuccessfulRequests: true, // 成功的請求不計數
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: '登入嘗試次數過多，請稍後再試',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  }
});

/**
 * 圖片上傳速率限制
 * 1 小時內最多 20 次上傳
 */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 小時
  max: 20, // 最多 20 次上傳
  message: {
    success: false,
    error: '上傳次數過多，請稍後再試',
    retryAfter: '請在 1 小時後重試'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: '上傳次數過多，請稍後再試',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  }
});

/**
 * 嚴格速率限制（用於敏感操作）
 * 15 分鐘內最多 3 次請求
 */
export const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分鐘
  max: 3, // 最多 3 次請求
  message: {
    success: false,
    error: '操作過於頻繁，請稍後再試',
    retryAfter: '請在 15 分鐘後重試'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: '操作過於頻繁，請稍後再試',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  }
});

/**
 * 寬鬆速率限制（用於公開 API）
 * 15 分鐘內最多 300 次請求
 */
export const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分鐘
  max: 300, // 限制 300 次請求
  message: {
    success: false,
    error: '請求過於頻繁，請稍後再試',
    retryAfter: '請在 15 分鐘後重試'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: '請求過於頻繁，請稍後再試',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  }
});
