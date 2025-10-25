import { supabaseAdmin } from '../config/supabase.js';

/**
 * 驗證 Supabase JWT Token 中間件
 * 用於保護需要身份驗證的 API 路由
 */
export async function authenticateToken(req, res, next) {
  try {
    // 從 Authorization header 取得 token
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('⚠️ No authorization header or invalid format');
      return res.status(401).json({
        success: false,
        error: 'Missing or invalid authorization header'
      });
    }

    // 提取 token
    const token = authHeader.substring(7); // 移除 "Bearer " 前綴

    // 使用 Supabase Admin Client 驗證 token
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      console.error('❌ Token validation failed:', error?.message);
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }

    // 將使用者資訊附加到 request 物件
    req.user = user;
    req.userId = user.id;

    console.log('✅ User authenticated:', user.email, '(ID:', user.id, ')');

    // 繼續處理請求
    next();

  } catch (error) {
    console.error('❌ Authentication error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Authentication failed'
    });
  }
}

/**
 * 驗證並取得使用者完整檔案
 * 包含 user_profiles, elders, family_members 資訊
 */
export async function authenticateWithProfile(req, res, next) {
  try {
    // 先執行基本的 token 驗證
    await new Promise((resolve, reject) => {
      authenticateToken(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // 取得使用者的 profile 資訊
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select(`
        *,
        elders (*),
        family_members (*)
      `)
      .eq('auth_user_id', req.userId)
      .single();

    if (profileError) {
      console.error('❌ Failed to load user profile:', profileError.message);

      // 如果找不到 profile，可能是 onboarding 未完成
      if (profileError.code === 'PGRST116') {
        return res.status(403).json({
          success: false,
          error: 'User profile not found. Please complete onboarding.',
          code: 'PROFILE_NOT_FOUND'
        });
      }

      return res.status(500).json({
        success: false,
        error: 'Failed to load user profile'
      });
    }

    // 檢查 onboarding 是否完成
    if (!profile.onboarding_completed) {
      return res.status(403).json({
        success: false,
        error: 'Onboarding not completed',
        code: 'ONBOARDING_INCOMPLETE'
      });
    }

    // 將 profile 資訊附加到 request
    req.userProfile = profile;

    // 根據角色設定相關 ID
    if (profile.role === 'elder' || profile.role === 'both') {
      req.elderId = profile.elders?.id || null;
    }

    if (profile.role === 'family' || profile.role === 'both') {
      req.familyMemberId = profile.family_members?.id || null;
    }

    console.log('✅ User profile loaded:', {
      role: profile.role,
      elderId: req.elderId,
      familyMemberId: req.familyMemberId
    });

    next();

  } catch (error) {
    console.error('❌ Profile authentication error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Authentication with profile failed'
    });
  }
}

/**
 * 可選的認證中間件
 * 如果有 token 就驗證，沒有 token 也繼續處理
 */
export async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // 沒有 token，但允許繼續
      req.user = null;
      req.userId = null;
      return next();
    }

    // 有 token，執行驗證
    await authenticateToken(req, res, next);

  } catch (error) {
    // 驗證失敗，但允許繼續（作為未認證使用者）
    req.user = null;
    req.userId = null;
    next();
  }
}

export default {
  authenticateToken,
  authenticateWithProfile,
  optionalAuth
};
