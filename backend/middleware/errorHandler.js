import { logError } from '../utils/logger.js';
import { AppError } from '../utils/errors.js';

/**
 * 集中式錯誤處理中間件
 * 捕獲所有錯誤並統一處理回應格式
 */
export function errorHandler(err, req, res, next) {
  // 預設錯誤資訊
  let error = {
    statusCode: 500,
    errorCode: 'INTERNAL_ERROR',
    message: '伺服器錯誤，請稍後再試',
    isOperational: false,
  };

  // 如果是自訂的 AppError
  if (err instanceof AppError) {
    error = {
      statusCode: err.statusCode,
      errorCode: err.errorCode,
      message: err.message,
      isOperational: err.isOperational,
    };

    // ValidationError 可能有額外的 details
    if (err.details) {
      error.details = err.details;
    }

    // ExternalServiceError 可能有 service 資訊
    if (err.service) {
      error.service = err.service;
    }
  }
  // JWT 驗證錯誤
  else if (err.name === 'JsonWebTokenError') {
    error = {
      statusCode: 401,
      errorCode: 'INVALID_TOKEN',
      message: '無效的認證令牌',
      isOperational: true,
    };
  }
  // JWT 過期錯誤
  else if (err.name === 'TokenExpiredError') {
    error = {
      statusCode: 401,
      errorCode: 'TOKEN_EXPIRED',
      message: '認證令牌已過期',
      isOperational: true,
    };
  }
  // Multer 檔案上傳錯誤
  else if (err.name === 'MulterError') {
    error = {
      statusCode: 400,
      errorCode: 'FILE_UPLOAD_ERROR',
      message: getMulterErrorMessage(err),
      isOperational: true,
    };
  }
  // 語法錯誤（通常是 JSON 解析錯誤）
  else if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    error = {
      statusCode: 400,
      errorCode: 'INVALID_JSON',
      message: '無效的 JSON 格式',
      isOperational: true,
    };
  }
  // 其他未預期的錯誤
  else {
    error.message = err.message || error.message;
  }

  // 記錄錯誤詳情
  const logData = {
    path: req.path,
    method: req.method,
    query: req.query,
    body: sanitizeBody(req.body), // 移除敏感資訊
    userId: req.userId,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    statusCode: error.statusCode,
    errorCode: error.errorCode,
  };

  // 根據錯誤嚴重程度選擇日誌級別
  if (error.statusCode >= 500) {
    logError('嚴重錯誤', err, logData);
  } else if (error.statusCode >= 400) {
    logError('客戶端錯誤', err, logData);
  }

  // 回應給客戶端
  const response = {
    error: error.errorCode,
    message: error.message,
  };

  // 開發環境時包含更多除錯資訊
  if (process.env.NODE_ENV !== 'production') {
    response.stack = err.stack;
    response.details = error.details;
  } else {
    // 生產環境時，非操作性錯誤不顯示詳細訊息
    if (!error.isOperational) {
      response.message = '伺服器錯誤，請稍後再試';
    } else if (error.details) {
      response.details = error.details;
    }
  }

  res.status(error.statusCode).json(response);
}

/**
 * 404 錯誤處理（放在所有路由之後）
 */
export function notFoundHandler(req, res) {
  res.status(404).json({
    error: 'NOT_FOUND',
    message: `找不到路由: ${req.method} ${req.path}`,
  });
}

/**
 * 非同步路由錯誤包裝器
 * 用於捕獲 async/await 函數中的錯誤
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * 取得 Multer 錯誤訊息
 */
function getMulterErrorMessage(err) {
  switch (err.code) {
    case 'LIMIT_FILE_SIZE':
      return '檔案大小超過限制';
    case 'LIMIT_FILE_COUNT':
      return '檔案數量超過限制';
    case 'LIMIT_UNEXPECTED_FILE':
      return '非預期的檔案欄位';
    case 'LIMIT_PART_COUNT':
      return '表單欄位數量過多';
    case 'LIMIT_FIELD_KEY':
      return '欄位名稱過長';
    case 'LIMIT_FIELD_VALUE':
      return '欄位值過長';
    case 'LIMIT_FIELD_COUNT':
      return '欄位數量過多';
    default:
      return '檔案上傳失敗';
  }
}

/**
 * 清除請求 body 中的敏感資訊
 */
function sanitizeBody(body) {
  if (!body || typeof body !== 'object') {
    return body;
  }

  const sanitized = { ...body };
  const sensitiveFields = [
    'password',
    'token',
    'secret',
    'apiKey',
    'api_key',
    'accessToken',
    'access_token',
    'refreshToken',
    'refresh_token',
  ];

  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '***';
    }
  }

  return sanitized;
}

/**
 * 請求日誌中間件
 * 記錄每個 API 請求
 */
export function requestLogger(req, res, next) {
  const startTime = Date.now();

  // 記錄請求
  if (process.env.LOG_REQUESTS === 'true') {
    import('../utils/logger.js').then(({ logRequest }) => {
      logRequest(req);
    });
  }

  // 監聽回應完成事件
  res.on('finish', () => {
    const duration = Date.now() - startTime;

    // 只記錄慢請求或錯誤請求
    if (duration > 1000 || res.statusCode >= 400) {
      import('../utils/logger.js').then(({ logResponse }) => {
        logResponse(req, res, duration);
      });
    }
  });

  next();
}
