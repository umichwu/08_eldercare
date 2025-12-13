import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 定義日誌格式
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// 控制台輸出格式（開發環境使用）
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...metadata }) => {
    let msg = `${timestamp} [${level}]: ${message}`;

    // 如果有額外的 metadata，也顯示出來
    if (Object.keys(metadata).length > 0) {
      msg += ` ${JSON.stringify(metadata)}`;
    }

    return msg;
  })
);

// 建立 logger 實例
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'eldercare-app' },
  transports: [
    // 錯誤日誌：只記錄 error 級別
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),

    // 組合日誌：記錄所有級別
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),

    // 警告日誌：只記錄 warn 級別
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/warn.log'),
      level: 'warn',
      maxsize: 5242880, // 5MB
      maxFiles: 3,
    }),
  ],
});

// 開發環境時也輸出到控制台
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: consoleFormat,
    })
  );
}

// 建立特定用途的日誌函數
export const logInfo = (message, metadata = {}) => {
  logger.info(message, metadata);
};

export const logWarn = (message, metadata = {}) => {
  logger.warn(message, metadata);
};

export const logError = (message, error = null, metadata = {}) => {
  const errorData = {
    ...metadata,
    ...(error && {
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name,
      },
    }),
  };
  logger.error(message, errorData);
};

export const logDebug = (message, metadata = {}) => {
  logger.debug(message, metadata);
};

// 記錄 API 請求
export const logRequest = (req, metadata = {}) => {
  logger.info('API 請求', {
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip,
    userId: req.userId,
    ...metadata,
  });
};

// 記錄 API 回應
export const logResponse = (req, res, duration, metadata = {}) => {
  logger.info('API 回應', {
    method: req.method,
    path: req.path,
    statusCode: res.statusCode,
    duration: `${duration}ms`,
    userId: req.userId,
    ...metadata,
  });
};

export default logger;
