/**
 * 自訂錯誤類別
 * 用於統一管理應用程式中的各種錯誤類型
 */

// 基礎應用錯誤類別
export class AppError extends Error {
  constructor(message, statusCode = 500, errorCode = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = true; // 標記為可預期的錯誤
    Error.captureStackTrace(this, this.constructor);
  }
}

// 驗證錯誤 (400)
export class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
    this.details = details;
  }
}

// 未授權錯誤 (401)
export class UnauthorizedError extends AppError {
  constructor(message = '未授權，請先登入') {
    super(message, 401, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}

// 禁止訪問錯誤 (403)
export class ForbiddenError extends AppError {
  constructor(message = '沒有權限執行此操作') {
    super(message, 403, 'FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}

// 找不到資源錯誤 (404)
export class NotFoundError extends AppError {
  constructor(message = '找不到請求的資源') {
    super(message, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

// 衝突錯誤 (409) - 例如重複的資料
export class ConflictError extends AppError {
  constructor(message = '資料衝突') {
    super(message, 409, 'CONFLICT');
    this.name = 'ConflictError';
  }
}

// 請求過於頻繁錯誤 (429)
export class TooManyRequestsError extends AppError {
  constructor(message = '請求過於頻繁，請稍後再試') {
    super(message, 429, 'TOO_MANY_REQUESTS');
    this.name = 'TooManyRequestsError';
  }
}

// 資料庫錯誤 (500)
export class DatabaseError extends AppError {
  constructor(message = '資料庫操作失敗', originalError = null) {
    super(message, 500, 'DATABASE_ERROR');
    this.name = 'DatabaseError';
    this.originalError = originalError;
  }
}

// 外部服務錯誤 (502)
export class ExternalServiceError extends AppError {
  constructor(message = '外部服務錯誤', service = null) {
    super(message, 502, 'EXTERNAL_SERVICE_ERROR');
    this.name = 'ExternalServiceError';
    this.service = service;
  }
}

// 檔案上傳錯誤 (400)
export class FileUploadError extends AppError {
  constructor(message = '檔案上傳失敗') {
    super(message, 400, 'FILE_UPLOAD_ERROR');
    this.name = 'FileUploadError';
  }
}

// 業務邏輯錯誤 (400)
export class BusinessLogicError extends AppError {
  constructor(message) {
    super(message, 400, 'BUSINESS_LOGIC_ERROR');
    this.name = 'BusinessLogicError';
  }
}
