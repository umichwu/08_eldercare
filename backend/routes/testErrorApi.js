/**
 * 錯誤處理測試路由（僅開發環境使用）
 * 用於測試各種錯誤類型的處理
 */

import express from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import {
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  TooManyRequestsError,
  DatabaseError,
  ExternalServiceError,
  FileUploadError,
  BusinessLogicError,
} from '../utils/errors.js';
import { logInfo, logWarn, logError } from '../utils/logger.js';

const router = express.Router();

// 只在非生產環境啟用測試端點
if (process.env.NODE_ENV !== 'production') {

  // 測試 ValidationError
  router.get('/error/validation', asyncHandler(async (req, res) => {
    throw new ValidationError('這是一個測試驗證錯誤', {
      field: 'email',
      reason: '格式不正確'
    });
  }));

  // 測試 UnauthorizedError
  router.get('/error/unauthorized', asyncHandler(async (req, res) => {
    throw new UnauthorizedError('需要登入才能訪問此資源');
  }));

  // 測試 ForbiddenError
  router.get('/error/forbidden', asyncHandler(async (req, res) => {
    throw new ForbiddenError('您沒有權限執行此操作');
  }));

  // 測試 NotFoundError
  router.get('/error/not-found', asyncHandler(async (req, res) => {
    throw new NotFoundError('找不到 ID 為 12345 的使用者');
  }));

  // 測試 ConflictError
  router.get('/error/conflict', asyncHandler(async (req, res) => {
    throw new ConflictError('此電子郵件已被註冊');
  }));

  // 測試 DatabaseError
  router.get('/error/database', asyncHandler(async (req, res) => {
    const dbError = new Error('Connection timeout');
    throw new DatabaseError('資料庫連線失敗', dbError);
  }));

  // 測試 ExternalServiceError
  router.get('/error/external-service', asyncHandler(async (req, res) => {
    throw new ExternalServiceError('第三方支付服務暫時無法使用', 'PaymentGateway');
  }));

  // 測試 FileUploadError
  router.get('/error/file-upload', asyncHandler(async (req, res) => {
    throw new FileUploadError('檔案大小超過限制（最大 5MB）');
  }));

  // 測試 BusinessLogicError
  router.get('/error/business-logic', asyncHandler(async (req, res) => {
    throw new BusinessLogicError('餘額不足，無法完成交易');
  }));

  // 測試未預期的錯誤
  router.get('/error/unexpected', asyncHandler(async (req, res) => {
    throw new Error('這是一個未預期的錯誤');
  }));

  // 測試同步錯誤
  router.get('/error/sync', (req, res, next) => {
    try {
      throw new Error('這是一個同步錯誤');
    } catch (error) {
      next(error);
    }
  });

  // 測試 JSON 解析錯誤（需要發送錯誤的 JSON）
  router.post('/error/json', (req, res) => {
    res.json({ message: '如果發送錯誤的 JSON，會觸發解析錯誤' });
  });

  // 測試日誌功能
  router.get('/log/test', asyncHandler(async (req, res) => {
    logInfo('測試資訊日誌', { test: true, userId: 'test-123' });
    logWarn('測試警告日誌', { warning: 'This is a warning' });

    try {
      throw new Error('測試錯誤');
    } catch (error) {
      logError('測試錯誤日誌', error, { context: 'log-test' });
    }

    res.json({
      message: '日誌已記錄',
      hint: '請檢查 backend/logs/ 資料夾中的日誌檔案'
    });
  }));

  // 測試成功回應（對照組）
  router.get('/success', asyncHandler(async (req, res) => {
    logInfo('測試端點成功執行', { endpoint: '/test/success' });
    res.json({
      success: true,
      message: '這是一個成功的回應',
      timestamp: new Date().toISOString()
    });
  }));

  // 列出所有測試端點
  router.get('/', (req, res) => {
    res.json({
      message: '錯誤處理測試端點（僅開發環境）',
      endpoints: [
        { path: '/test/error/validation', description: '400 - 驗證錯誤' },
        { path: '/test/error/unauthorized', description: '401 - 未授權' },
        { path: '/test/error/forbidden', description: '403 - 禁止訪問' },
        { path: '/test/error/not-found', description: '404 - 找不到資源' },
        { path: '/test/error/conflict', description: '409 - 資料衝突' },
        { path: '/test/error/database', description: '500 - 資料庫錯誤' },
        { path: '/test/error/external-service', description: '502 - 外部服務錯誤' },
        { path: '/test/error/file-upload', description: '400 - 檔案上傳錯誤' },
        { path: '/test/error/business-logic', description: '400 - 業務邏輯錯誤' },
        { path: '/test/error/unexpected', description: '500 - 未預期錯誤' },
        { path: '/test/error/sync', description: '500 - 同步錯誤' },
        { path: '/test/log/test', description: '測試日誌功能' },
        { path: '/test/success', description: '成功回應（對照組）' },
      ],
      note: '此測試端點僅在開發環境可用'
    });
  });
}

export default router;
