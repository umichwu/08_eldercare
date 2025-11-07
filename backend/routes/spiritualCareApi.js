import express from 'express';
import spiritualCareService from '../services/spiritualCareService.js';
import emotionalAnalysisService from '../services/emotionalAnalysisService.js';
import agenticRAGService from '../services/agenticRAGService.js';

const router = express.Router();

// ===================================
// 心靈偏好設定 API
// ===================================

/**
 * GET /api/spiritual/preferences/:userId
 * 取得使用者的心靈偏好設定
 */
router.get('/preferences/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await spiritualCareService.getSpiritualPreferences(userId);

    if (result.success) {
      res.json(result.data);
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    console.error('❌ API Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/spiritual/preferences/:userId
 * 設定使用者的心靈偏好
 */
router.post('/preferences/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const preferences = req.body;

    const result = await spiritualCareService.setSpiritualPreferences(userId, preferences);

    if (result.success) {
      res.json(result.data);
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    console.error('❌ API Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===================================
// 心情日記 API
// ===================================

/**
 * POST /api/spiritual/journals
 * 新增心情日記
 */
router.post('/journals', async (req, res) => {
  try {
    const { userId, ...journalData } = req.body;

    const result = await spiritualCareService.addEmotionalJournal(userId, journalData);

    if (result.success) {
      res.json(result.data);
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    console.error('❌ API Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/spiritual/journals/:userId
 * 取得使用者的心情日記列表
 */
router.get('/journals/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit, startDate, endDate } = req.query;

    const result = await spiritualCareService.getEmotionalJournals(userId, {
      limit: limit ? parseInt(limit) : 30,
      startDate,
      endDate
    });

    if (result.success) {
      res.json(result.data);
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    console.error('❌ API Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/spiritual/journals/:userId/:date
 * 取得特定日期的心情日記
 */
router.get('/journals/:userId/:date', async (req, res) => {
  try {
    const { userId, date } = req.params;

    const result = await spiritualCareService.getJournalByDate(userId, date);

    if (result.success) {
      res.json(result.data);
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    console.error('❌ API Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===================================
// 心靈內容 API
// ===================================

/**
 * GET /api/spiritual/contents
 * 檢索心靈內容（經文、故事、禱詞）
 */
router.get('/contents', async (req, res) => {
  try {
    const { emotion, religion, category, limit } = req.query;

    const result = await spiritualCareService.retrieveSpiritualContent({
      emotion,
      religion,
      category,
      limit: limit ? parseInt(limit) : 3
    });

    if (result.success) {
      res.json(result.data);
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    console.error('❌ API Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===================================
// 心情趨勢 API
// ===================================

/**
 * GET /api/spiritual/trends/:userId
 * 取得心情趨勢分析
 */
router.get('/trends/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { days } = req.query;

    const result = await spiritualCareService.getMoodTrends(
      userId,
      days ? parseInt(days) : 30
    );

    if (result.success) {
      res.json(result.data);
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    console.error('❌ API Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===================================
// 情緒分析 API
// ===================================

/**
 * POST /api/spiritual/analyze-emotion
 * 分析情緒狀態
 */
router.post('/analyze-emotion', async (req, res) => {
  try {
    const { messages, historicalEmotions } = req.body;

    const result = await emotionalAnalysisService.analyzeEmotionalState(
      messages,
      historicalEmotions
    );

    if (result.success) {
      res.json(result.data);
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    console.error('❌ API Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===================================
// 心情日記引導 API
// ===================================

/**
 * POST /api/spiritual/guide-journal
 * 引導寫心情日記
 */
router.post('/guide-journal', async (req, res) => {
  try {
    const { userId, conversationSummary } = req.body;

    const result = await agenticRAGService.guideDailyReflection(
      userId,
      conversationSummary
    );

    if (result.success) {
      res.json(result.data);
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    console.error('❌ API Error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
