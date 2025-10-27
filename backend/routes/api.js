import express from 'express';
import conversationService from '../services/conversationService.js';
import messageService from '../services/messageService.js';
import summaryService from '../services/summaryService.js';
import userService from '../services/userService.js';

const router = express.Router();

// ============================================
// 對話 API
// ============================================

/**
 * 建立新對話
 * POST /api/conversations
 */
router.post('/conversations', async (req, res) => {
  try {
    const { userId, title = '新對話' } = req.body;

    if (!userId) {
      return res.status(400).json({ error: '缺少 userId' });
    }

    // userId 是 auth_user_id，我們需要從 user_profiles 取得 user_profile_id
    // 簡化版本：直接使用 userId 作為兩個參數
    const result = await conversationService.createConversation(
      userId,    // authUserId
      userId,    // 暫時也用作 userProfileId (需要從 user_profiles 查詢)
      {
        title
      }
    );

    if (result.success) {
      res.status(201).json(result.data);
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    console.error('❌ API /conversations POST 錯誤:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 取得使用者的所有對話
 * GET /api/conversations?userId=xxx
 */
router.get('/conversations', async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: '缺少 userId' });
    }

    const result = await conversationService.getUserConversations(userId);

    if (result.success) {
      res.json(result.data);
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 取得單一對話
 * GET /api/conversations/:id
 */
router.get('/conversations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: '缺少 userId' });
    }

    const result = await conversationService.getConversation(id, userId);

    if (result.success) {
      res.json(result.data);
    } else {
      res.status(404).json({ error: result.error });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 更新對話標題
 * PUT /api/conversations/:id
 */
router.put('/conversations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, title } = req.body;

    if (!userId || !title) {
      return res.status(400).json({ error: '缺少必要參數' });
    }

    const result = await conversationService.updateConversationTitle(
      id,
      userId,
      title
    );

    if (result.success) {
      res.json(result.data);
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 刪除對話
 * DELETE /api/conversations/:id
 */
router.delete('/conversations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: '缺少 userId' });
    }

    const result = await conversationService.deleteConversation(id, userId);

    if (result.success) {
      res.json({ message: '對話已刪除', data: result.data });
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// 訊息 API
// ============================================

/**
 * 取得對話的所有訊息
 * GET /api/conversations/:id/messages
 */
router.get('/conversations/:id/messages', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: '缺少 userId' });
    }

    const result = await messageService.getMessages(id, userId);

    if (result.success) {
      res.json(result.data);
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 傳送訊息並取得 AI 回應
 * POST /api/conversations/:id/messages
 */
router.post('/conversations/:id/messages', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, content, llmProvider } = req.body;

    console.log('📨 收到訊息請求:', { conversationId: id, userId, llmProvider, contentLength: content?.length });

    if (!userId || !content) {
      console.error('❌ 缺少必要參數:', { userId: !!userId, content: !!content });
      return res.status(400).json({
        error: '缺少必要參數',
        details: {
          userId: !userId ? '缺少 userId' : 'OK',
          content: !content ? '缺少 content' : 'OK'
        }
      });
    }

    // 處理使用者訊息並產生回應（使用用戶指定的LLM提供商）
    console.log('🤖 使用 LLM 提供商:', llmProvider || '默認');
    const result = await messageService.processUserMessage(id, userId, content, llmProvider);

    if (result.success) {
      console.log('✅ 訊息處理成功');

      // 檢查是否需要產生自動總結
      const summaryCheck = await summaryService.checkAutoSummary(id, userId);

      if (summaryCheck.success && summaryCheck.needsSummary) {
        console.log('🔄 觸發自動總結機制...');
        // 非同步產生總結（不阻塞回應）
        summaryService.generateSummary(id, userId).catch(err => {
          console.error('❌ 自動總結失敗:', err);
        });
      }

      res.status(201).json(result.data);
    } else {
      console.error('❌ 訊息處理失敗:', result.error);
      res.status(500).json({
        error: result.error,
        details: 'LLM API 呼叫失敗，請檢查 API Key 配置'
      });
    }
  } catch (error) {
    console.error('❌ 伺服器錯誤:', error);
    res.status(500).json({
      error: error.message,
      type: error.name,
      details: '伺服器內部錯誤'
    });
  }
});

// ============================================
// 總結 API
// ============================================

/**
 * 取得對話的所有總結
 * GET /api/conversations/:id/summaries
 */
router.get('/conversations/:id/summaries', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: '缺少 userId' });
    }

    const result = await summaryService.getSummaries(id, userId);

    if (result.success) {
      res.json(result.data);
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 手動產生對話總結
 * POST /api/conversations/:id/summaries
 */
router.post('/conversations/:id/summaries', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: '缺少 userId' });
    }

    const result = await summaryService.generateSummary(id, userId);

    if (result.success) {
      res.status(201).json(result.data);
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 取得最新總結
 * GET /api/conversations/:id/summaries/latest
 */
router.get('/conversations/:id/summaries/latest', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: '缺少 userId' });
    }

    const result = await summaryService.getLatestSummary(id, userId);

    if (result.success) {
      res.json(result.data);
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// 使用者設定 API
// ============================================

/**
 * 取得使用者檔案
 * GET /api/users/profile
 */
router.get('/users/profile', async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: '缺少 userId' });
    }

    const result = await userService.getUserProfile(userId);

    if (result.success) {
      res.json(result.data);
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 更新使用者語言設定
 * PUT /api/users/language
 */
router.put('/users/language', async (req, res) => {
  try {
    const { userId, language } = req.body;

    if (!userId || !language) {
      return res.status(400).json({ error: '缺少必要參數' });
    }

    const result = await userService.updateAllLanguageSettings(userId, language);

    if (result.success) {
      res.json({
        message: '語言設定已更新',
        data: result.data,
        elderUpdated: result.elderUpdated
      });
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 更新使用者偏好設定
 * PUT /api/users/preferences
 */
router.put('/users/preferences', async (req, res) => {
  try {
    const { userId, preferences } = req.body;

    if (!userId || !preferences) {
      return res.status(400).json({ error: '缺少必要參數' });
    }

    const result = await userService.updatePreferences(userId, preferences);

    if (result.success) {
      res.json({
        message: '偏好設定已更新',
        data: result.data
      });
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 取得支援的語言列表
 * GET /api/users/languages
 */
router.get('/users/languages', (req, res) => {
  const result = userService.getSupportedLanguages();
  res.json(result.data);
});

// ============================================
// 健康檢查
// ============================================

router.get('/health', (req, res) => {
  // 檢查環境變數是否設定
  const envCheck = {
    SUPABASE_URL: !!process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: !!process.env.SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_KEY: !!process.env.SUPABASE_SERVICE_KEY,
  };

  // LLM 提供商檢查
  const llmCheck = {
    currentProvider: process.env.LLM_PROVIDER || 'gemini',
    openai: {
      configured: !!process.env.OPENAI_API_KEY,
      keyPrefix: process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.substring(0, 7) + '...' : null
    },
    gemini: {
      configured: !!process.env.GEMINI_API_KEY,
      keyPrefix: process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.substring(0, 6) + '...' : null
    },
    deepseek: {
      configured: !!process.env.DEEPSEEK_API_KEY,
      keyPrefix: process.env.DEEPSEEK_API_KEY ? process.env.DEEPSEEK_API_KEY.substring(0, 7) + '...' : null
    }
  };

  // 檢查當前提供商是否已配置
  const currentProviderConfigured = llmCheck[llmCheck.currentProvider]?.configured || false;
  const allCoreConfigured = Object.values(envCheck).every(v => v === true) && currentProviderConfigured;

  res.json({
    status: allCoreConfigured ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    service: 'ElderCare Backend API',
    environment: {
      configured: envCheck,
      allConfigured: Object.values(envCheck).every(v => v === true),
      missing: Object.keys(envCheck).filter(key => !envCheck[key])
    },
    llm: {
      currentProvider: llmCheck.currentProvider,
      currentProviderConfigured: currentProviderConfigured,
      providers: {
        openai: {
          available: llmCheck.openai.configured,
          keyPrefix: llmCheck.openai.keyPrefix
        },
        gemini: {
          available: llmCheck.gemini.configured,
          keyPrefix: llmCheck.gemini.keyPrefix
        },
        deepseek: {
          available: llmCheck.deepseek.configured,
          keyPrefix: llmCheck.deepseek.keyPrefix
        }
      }
    }
  });
});

export default router;
