/**
 * 個人資料 API 路由
 * ElderCare Companion - Profile Management
 *
 * 功能：
 * - 查看個人資料
 * - 更新個人資料
 * - 上傳頭像
 */

import express from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import userService from '../services/userService.js';

dotenv.config();

const router = express.Router();

// 初始化 Supabase 客戶端
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 缺少 Supabase 環境變數');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ============================================================================
// 輔助函數
// ============================================================================

/**
 * 從請求中取得 auth user id
 */
async function getAuthUserId(req) {
  // 從 Authorization header 中取得 JWT token
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);

  try {
    // 使用 Supabase 驗證 JWT token
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      console.error('JWT 驗證失敗:', error);
      return null;
    }

    return user.id; // 返回 auth_user_id
  } catch (error) {
    console.error('驗證 token 時發生錯誤:', error);
    return null;
  }
}

// ============================================================================
// 個人資料相關 API
// ============================================================================

/**
 * GET /api/profile
 * 取得當前使用者的完整個人資料
 */
router.get('/', async (req, res) => {
  try {
    const authUserId = await getAuthUserId(req);
    if (!authUserId) {
      return res.status(401).json({ error: '未授權' });
    }

    const result = await userService.getUserProfile(authUserId);

    if (result.success) {
      res.json({
        success: true,
        profile: result.data
      });
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    console.error('取得個人資料失敗:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/profile/:userId
 * 取得指定使用者的公開資料
 */
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await userService.getPublicProfile(userId);

    if (result.success) {
      res.json({
        success: true,
        profile: result.data
      });
    } else {
      res.status(404).json({ error: '找不到使用者' });
    }
  } catch (error) {
    console.error('取得公開資料失敗:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/profile
 * 更新個人資料
 */
router.put('/', async (req, res) => {
  try {
    const authUserId = await getAuthUserId(req);
    if (!authUserId) {
      return res.status(401).json({ error: '未授權' });
    }

    const updates = req.body;

    // 驗證必要欄位
    if (updates.display_name && updates.display_name.trim().length === 0) {
      return res.status(400).json({ error: '暱稱不能為空' });
    }

    if (updates.email && !isValidEmail(updates.email)) {
      return res.status(400).json({ error: 'Email 格式不正確' });
    }

    const result = await userService.updateUserProfile(authUserId, updates);

    if (result.success) {
      res.json({
        success: true,
        profile: result.data,
        message: '個人資料已更新'
      });
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    console.error('更新個人資料失敗:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/profile/avatar
 * 上傳頭像
 */
router.post('/avatar', async (req, res) => {
  try {
    const authUserId = await getAuthUserId(req);
    if (!authUserId) {
      return res.status(401).json({ error: '未授權' });
    }

    const { avatarUrl } = req.body;

    if (!avatarUrl) {
      return res.status(400).json({ error: '缺少頭像 URL' });
    }

    const result = await userService.updateAvatar(authUserId, avatarUrl);

    if (result.success) {
      res.json({
        success: true,
        profile: result.data,
        message: '頭像已更新'
      });
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    console.error('更新頭像失敗:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/profile/avatar/upload
 * 上傳頭像檔案到 Supabase Storage
 */
router.post('/avatar/upload', async (req, res) => {
  try {
    const authUserId = await getAuthUserId(req);
    if (!authUserId) {
      return res.status(401).json({ error: '未授權' });
    }

    // 檢查是否有檔案
    if (!req.files || !req.files.avatar) {
      return res.status(400).json({ error: '請選擇要上傳的圖片' });
    }

    const file = req.files.avatar;

    // 驗證檔案類型
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.mimetype)) {
      return res.status(400).json({ error: '只支援 JPG, PNG, WEBP 格式' });
    }

    // 驗證檔案大小（最大 5MB）
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return res.status(400).json({ error: '檔案大小不能超過 5MB' });
    }

    // 產生檔案名稱
    const fileExt = path.extname(file.name);
    const fileName = `${authUserId}_${Date.now()}${fileExt}`;
    const filePath = `avatars/${fileName}`;

    // 上傳到 Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('user-uploads')
      .upload(filePath, file.data, {
        contentType: file.mimetype,
        upsert: false
      });

    if (uploadError) {
      console.error('上傳檔案失敗:', uploadError);
      return res.status(500).json({ error: '上傳失敗' });
    }

    // 取得公開 URL
    const { data: urlData } = supabase.storage
      .from('user-uploads')
      .getPublicUrl(filePath);

    const avatarUrl = urlData.publicUrl;

    // 更新使用者資料
    const result = await userService.updateAvatar(authUserId, avatarUrl);

    if (result.success) {
      res.json({
        success: true,
        avatarUrl,
        profile: result.data,
        message: '頭像已更新'
      });
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    console.error('上傳頭像失敗:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// 輔助函數
// ============================================================================

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// ============================================================================
// 健康檢查
// ============================================================================

router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'profile-api',
    timestamp: new Date().toISOString()
  });
});

export default router;
