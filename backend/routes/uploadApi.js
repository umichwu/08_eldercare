/**
 * Upload API - 檔案上傳路由
 *
 * 功能：
 * - 圖片上傳（社交貼文、聊天訊息）
 * - 影片上傳
 * - 音訊上傳
 * - 檔案驗證和壓縮
 */

import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const router = express.Router();

// 初始化 Supabase 客戶端（使用 Service Role Key 以繞過 RLS）
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ===================================
// Multer 設定 - 記憶體儲存
// ===================================
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 52428800, // 50MB
  },
  fileFilter: (req, file, cb) => {
    // 允許的檔案類型
    const allowedMimeTypes = [
      // 圖片
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      // 影片
      'video/mp4',
      'video/webm',
      'video/quicktime', // .mov
      // 音訊
      'audio/mpeg', // mp3
      'audio/wav',
      'audio/webm',
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`不支援的檔案類型: ${file.mimetype}`), false);
    }
  },
});

// ===================================
// 工具函數
// ===================================

/**
 * 壓縮圖片
 * @param {Buffer} buffer - 原始圖片 buffer
 * @param {Object} options - 壓縮選項
 * @returns {Promise<Buffer>} 壓縮後的圖片 buffer
 */
async function compressImage(buffer, options = {}) {
  const {
    maxWidth = 1920,
    maxHeight = 1080,
    quality = 80,
    format = 'jpeg',
  } = options;

  try {
    let image = sharp(buffer);

    // 取得圖片資訊
    const metadata = await image.metadata();

    // 計算新尺寸（保持長寬比）
    let newWidth = metadata.width;
    let newHeight = metadata.height;

    if (newWidth > maxWidth || newHeight > maxHeight) {
      const ratio = Math.min(maxWidth / newWidth, maxHeight / newHeight);
      newWidth = Math.round(newWidth * ratio);
      newHeight = Math.round(newHeight * ratio);
    }

    // 壓縮圖片
    const compressed = await image
      .resize(newWidth, newHeight, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .toFormat(format, { quality })
      .toBuffer();

    console.log(`✅ 圖片壓縮成功: ${metadata.width}x${metadata.height} → ${newWidth}x${newHeight}`);

    return compressed;
  } catch (error) {
    console.error('❌ 圖片壓縮失敗:', error);
    throw error;
  }
}

/**
 * 生成影片縮圖（簡化版，實際使用建議使用 ffmpeg）
 * @param {Buffer} buffer - 影片 buffer
 * @returns {Promise<Buffer>} 縮圖 buffer
 */
async function generateVideoThumbnail(buffer) {
  // 注意：這裡需要使用 ffmpeg 來生成縮圖
  // 簡化版本，返回預設圖片
  console.warn('⚠️  影片縮圖生成功能尚未實作，使用預設圖片');
  // TODO: 整合 ffmpeg 或使用雲端服務生成縮圖
  return null;
}

/**
 * 上傳檔案到 Supabase Storage
 * @param {Buffer} fileBuffer - 檔案 buffer
 * @param {string} fileName - 檔案名稱
 * @param {string} mimeType - MIME 類型
 * @param {string} userId - 使用者 ID
 * @param {string} type - 檔案類型 (posts, chat, avatars)
 * @returns {Promise<string>} 公開 URL
 */
async function uploadToStorage(fileBuffer, fileName, mimeType, userId, type = 'posts') {
  try {
    const fileExt = path.extname(fileName);
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(7);
    const newFileName = `${timestamp}_${randomStr}${fileExt}`;
    const filePath = `${type}/${userId}/${newFileName}`;

    console.log(`📤 上傳檔案到 Supabase Storage: ${filePath}`);

    const { data, error } = await supabase.storage
      .from('social-media')
      .upload(filePath, fileBuffer, {
        contentType: mimeType,
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('❌ Supabase Storage 上傳失敗:', error);
      throw error;
    }

    // 取得公開 URL
    const { data: { publicUrl } } = supabase.storage
      .from('social-media')
      .getPublicUrl(filePath);

    console.log(`✅ 檔案上傳成功: ${publicUrl}`);

    return publicUrl;
  } catch (error) {
    console.error('❌ 上傳到 Storage 失敗:', error);
    throw error;
  }
}

// ===================================
// API 路由
// ===================================

/**
 * POST /api/upload/image
 * 上傳圖片（自動壓縮）
 *
 * Body (multipart/form-data):
 * - image: 圖片檔案
 * - userId: 使用者 ID
 * - type: 'posts' | 'chat' | 'avatars' (預設: posts)
 * - compress: true | false (預設: true)
 */
router.post('/image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: '缺少圖片檔案',
        message: '請上傳圖片',
      });
    }

    const { userId, type = 'posts', compress = 'true' } = req.body;

    if (!userId) {
      return res.status(400).json({
        error: '缺少必要參數',
        message: 'userId 為必填',
      });
    }

    console.log(`📷 收到圖片上傳請求: ${req.file.originalname} (${req.file.size} bytes)`);

    let fileBuffer = req.file.buffer;
    let mimeType = req.file.mimetype;

    // 圖片壓縮
    if (compress === 'true' || compress === true) {
      try {
        fileBuffer = await compressImage(fileBuffer, {
          maxWidth: type === 'avatars' ? 512 : 1920,
          maxHeight: type === 'avatars' ? 512 : 1080,
          quality: 80,
        });
        mimeType = 'image/jpeg'; // 壓縮後統一為 JPEG
      } catch (error) {
        console.warn('⚠️  圖片壓縮失敗，使用原始檔案:', error.message);
      }
    }

    // 上傳到 Supabase Storage
    const publicUrl = await uploadToStorage(
      fileBuffer,
      req.file.originalname,
      mimeType,
      userId,
      type
    );

    res.json({
      message: '圖片上傳成功',
      url: publicUrl,
      originalSize: req.file.size,
      compressedSize: fileBuffer.length,
      compressionRatio: ((1 - fileBuffer.length / req.file.size) * 100).toFixed(2) + '%',
    });

  } catch (error) {
    console.error('API 錯誤 (POST /upload/image):', error);
    res.status(500).json({
      error: '上傳失敗',
      message: error.message,
    });
  }
});

/**
 * POST /api/upload/video
 * 上傳影片
 *
 * Body (multipart/form-data):
 * - video: 影片檔案
 * - userId: 使用者 ID
 * - type: 'posts' | 'chat' (預設: posts)
 * - generateThumbnail: true | false (預設: false)
 */
router.post('/video', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: '缺少影片檔案',
        message: '請上傳影片',
      });
    }

    const { userId, type = 'posts', generateThumbnail = 'false' } = req.body;

    if (!userId) {
      return res.status(400).json({
        error: '缺少必要參數',
        message: 'userId 為必填',
      });
    }

    console.log(`🎥 收到影片上傳請求: ${req.file.originalname} (${req.file.size} bytes)`);

    // 檢查檔案大小（影片最大 50MB）
    if (req.file.size > 52428800) {
      return res.status(400).json({
        error: '檔案過大',
        message: '影片檔案不能超過 50MB',
      });
    }

    // 上傳影片
    const videoUrl = await uploadToStorage(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      userId,
      type
    );

    let thumbnailUrl = null;

    // 生成縮圖（選擇性）
    if (generateThumbnail === 'true' || generateThumbnail === true) {
      try {
        const thumbnail = await generateVideoThumbnail(req.file.buffer);
        if (thumbnail) {
          thumbnailUrl = await uploadToStorage(
            thumbnail,
            req.file.originalname.replace(/\.[^/.]+$/, '_thumb.jpg'),
            'image/jpeg',
            userId,
            'thumbnails'
          );
        }
      } catch (error) {
        console.warn('⚠️  縮圖生成失敗:', error.message);
      }
    }

    res.json({
      message: '影片上傳成功',
      videoUrl: videoUrl,
      thumbnailUrl: thumbnailUrl,
      size: req.file.size,
    });

  } catch (error) {
    console.error('API 錯誤 (POST /upload/video):', error);
    res.status(500).json({
      error: '上傳失敗',
      message: error.message,
    });
  }
});

/**
 * POST /api/upload/audio
 * 上傳音訊
 *
 * Body (multipart/form-data):
 * - audio: 音訊檔案
 * - userId: 使用者 ID
 * - type: 'chat' (預設: chat)
 */
router.post('/audio', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: '缺少音訊檔案',
        message: '請上傳音訊',
      });
    }

    const { userId, type = 'chat' } = req.body;

    if (!userId) {
      return res.status(400).json({
        error: '缺少必要參數',
        message: 'userId 為必填',
      });
    }

    console.log(`🎵 收到音訊上傳請求: ${req.file.originalname} (${req.file.size} bytes)`);

    // 檢查檔案大小（音訊最大 10MB）
    if (req.file.size > 10485760) {
      return res.status(400).json({
        error: '檔案過大',
        message: '音訊檔案不能超過 10MB',
      });
    }

    // 上傳音訊
    const audioUrl = await uploadToStorage(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      userId,
      type
    );

    res.json({
      message: '音訊上傳成功',
      url: audioUrl,
      size: req.file.size,
    });

  } catch (error) {
    console.error('API 錯誤 (POST /upload/audio):', error);
    res.status(500).json({
      error: '上傳失敗',
      message: error.message,
    });
  }
});

/**
 * DELETE /api/upload/delete
 * 刪除檔案
 *
 * Body:
 * - url: 檔案 URL
 * - userId: 使用者 ID（用於驗證權限）
 */
router.delete('/delete', async (req, res) => {
  try {
    const { url, userId } = req.body;

    if (!url || !userId) {
      return res.status(400).json({
        error: '缺少必要參數',
        message: 'url, userId 為必填',
      });
    }

    // 從 URL 提取檔案路徑
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    const bucketName = pathParts[pathParts.length - 3];
    const filePath = pathParts.slice(-2).join('/');

    console.log(`🗑️  刪除檔案請求: ${filePath}`);

    // 驗證權限（檔案路徑必須包含使用者 ID）
    if (!filePath.includes(userId)) {
      return res.status(403).json({
        error: '權限不足',
        message: '您沒有權限刪除此檔案',
      });
    }

    // 刪除檔案
    const { error } = await supabase.storage
      .from('social-media')
      .remove([filePath]);

    if (error) {
      throw error;
    }

    console.log(`✅ 檔案刪除成功: ${filePath}`);

    res.json({
      message: '檔案刪除成功',
    });

  } catch (error) {
    console.error('API 錯誤 (DELETE /upload/delete):', error);
    res.status(500).json({
      error: '刪除失敗',
      message: error.message,
    });
  }
});

/**
 * GET /api/upload/test
 * 測試路由
 */
router.get('/test', (req, res) => {
  res.json({
    message: 'Upload API 運行正常',
    endpoints: {
      image: 'POST /api/upload/image',
      video: 'POST /api/upload/video',
      audio: 'POST /api/upload/audio',
      delete: 'DELETE /api/upload/delete',
    },
  });
});

// 錯誤處理中間件
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: '檔案過大',
        message: '檔案大小不能超過 50MB',
      });
    }
    return res.status(400).json({
      error: '上傳錯誤',
      message: error.message,
    });
  }

  if (error) {
    return res.status(400).json({
      error: '上傳錯誤',
      message: error.message,
    });
  }

  next();
});

export default router;
