import { supabase, supabaseAdmin } from '../config/supabase.js';
import { defaultLLMService } from '../config/llm.js';

/**
 * 心靈照護核心服務
 */
class SpiritualCareService {
  /**
   * 取得使用者的心靈偏好設定
   */
  async getSpiritualPreferences(userId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('user_profiles')
        .select('spiritual_preference, spiritual_details, mindfulness_enabled, emotional_privacy_level')
        .eq('auth_user_id', userId)
        .single();

      if (error) throw error;

      return {
        success: true,
        data: data || {
          spiritual_preference: null,
          spiritual_details: {},
          mindfulness_enabled: true,
          emotional_privacy_level: 'family_visible'
        }
      };
    } catch (error) {
      console.error('❌ 取得心靈偏好失敗:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * 設定使用者的心靈偏好
   */
  async setSpiritualPreferences(userId, preferences) {
    try {
      const { data, error } = await supabaseAdmin
        .from('user_profiles')
        .update({
          spiritual_preference: preferences.religion,
          spiritual_details: preferences.details || {},
          mindfulness_enabled: preferences.mindfulness_enabled !== false,
          emotional_privacy_level: preferences.privacy_level || 'family_visible'
        })
        .eq('auth_user_id', userId)
        .select()
        .single();

      if (error) throw error;

      console.log('✅ 心靈偏好已更新:', userId);
      return { success: true, data };
    } catch (error) {
      console.error('❌ 設定心靈偏好失敗:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * 檢索心靈內容（經文、故事、禱詞）
   * 注意：這是簡化版，完整版需要向量檢索
   */
  async retrieveSpiritualContent({ emotion, religion, category, limit = 3 }) {
    try {
      let query = supabaseAdmin
        .from('spiritual_contents')
        .select('*')
        .eq('verified', true);

      if (religion) {
        query = query.eq('religion', religion);
      }

      if (category) {
        query = query.eq('category', category);
      } else if (emotion) {
        // 根據情緒映射到類別
        const emotionCategoryMap = {
          anxiety: 'anxiety',
          grief: 'grief',
          loneliness: 'loneliness',
          gratitude: 'gratitude',
          peace: 'peace'
        };
        const mappedCategory = emotionCategoryMap[emotion];
        if (mappedCategory) {
          query = query.eq('category', mappedCategory);
        }
      }

      query = query.limit(limit);

      const { data, error } = await query;

      if (error) throw error;

      console.log(`✅ 檢索到 ${data.length} 條心靈內容`);
      return { success: true, data };
    } catch (error) {
      console.error('❌ 檢索心靈內容失敗:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * 新增心情日記
   */
  async addEmotionalJournal(userId, journalData) {
    try {
      // 先取得 user_profile_id
      const { data: profile } = await supabaseAdmin
        .from('user_profiles')
        .select('id')
        .eq('auth_user_id', userId)
        .single();

      if (!profile) {
        throw new Error('找不到使用者 profile');
      }

      const { data, error } = await supabaseAdmin
        .from('emotional_journals')
        .insert([{
          user_profile_id: profile.id,
          auth_user_id: userId,
          journal_date: journalData.date || new Date().toISOString().split('T')[0],
          mood_score: journalData.mood_score,
          mood_tags: journalData.mood_tags || [],
          gratitude_items: journalData.gratitude_items || [],
          concerns: journalData.concerns || [],
          daily_summary: journalData.daily_summary,
          ai_insights: journalData.ai_insights,
          spiritual_guidance: journalData.spiritual_guidance,
          emotion_analysis: journalData.emotion_analysis || {}
        }])
        .select()
        .single();

      if (error) throw error;

      console.log('✅ 心情日記已儲存:', data.id);
      return { success: true, data };
    } catch (error) {
      console.error('❌ 儲存心情日記失敗:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * 取得使用者的心情日記
   */
  async getEmotionalJournals(userId, options = {}) {
    try {
      const { limit = 30, startDate, endDate } = options;

      let query = supabaseAdmin
        .from('emotional_journals')
        .select('*')
        .eq('auth_user_id', userId)
        .order('journal_date', { ascending: false });

      if (startDate) {
        query = query.gte('journal_date', startDate);
      }

      if (endDate) {
        query = query.lte('journal_date', endDate);
      }

      query = query.limit(limit);

      const { data, error } = await query;

      if (error) throw error;

      console.log(`✅ 取得 ${data.length} 則心情日記`);
      return { success: true, data };
    } catch (error) {
      console.error('❌ 取得心情日記失敗:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * 取得特定日期的心情日記
   */
  async getJournalByDate(userId, date) {
    try {
      const { data, error } = await supabaseAdmin
        .from('emotional_journals')
        .select('*')
        .eq('auth_user_id', userId)
        .eq('journal_date', date)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = 找不到記錄
        throw error;
      }

      return { success: true, data: data || null };
    } catch (error) {
      console.error('❌ 取得日記失敗:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * 生成每日心靈摘要
   */
  async generateDailySummary(userId, conversationSummary, emotions) {
    try {
      // 取得使用者的心靈偏好
      const preferencesResult = await this.getSpiritualPreferences(userId);
      if (!preferencesResult.success) {
        throw new Error('無法取得心靈偏好');
      }

      const preferences = preferencesResult.data;
      const religion = preferences.spiritual_preference || 'secular';

      // 使用 AI 生成摘要
      const prompt = `
你是一位溫暖的心靈導師。請根據以下資訊，為長者生成今日心靈摘要：

【長者資訊】
宗教信仰：${religion}

【今日對話摘要】
${conversationSummary}

【今日情緒】
主要情緒：${emotions.primary || '平靜'}
情緒強度：${emotions.intensity || 0.5}

【任務】
請生成一段 50-100 字的心靈摘要，包含：
1. 今日心理狀態的簡短總結
2. 根據宗教信仰給予的心靈建議（如果有宗教信仰）
3. 正向鼓勵

語氣要溫暖、親切，像是家人在關心。
`;

      const response = await defaultLLMService.generateResponse([
        { role: 'user', content: prompt }
      ], { temperature: 0.7, maxTokens: 200 });

      return {
        success: true,
        summary: response.content
      };
    } catch (error) {
      console.error('❌ 生成每日摘要失敗:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * 派送心靈照護任務
   */
  async dispatchCareTask(userId, taskData) {
    try {
      // 取得 user_profile_id
      const { data: profile } = await supabaseAdmin
        .from('user_profiles')
        .select('id')
        .eq('auth_user_id', userId)
        .single();

      if (!profile) {
        throw new Error('找不到使用者 profile');
      }

      const { data, error } = await supabaseAdmin
        .from('spiritual_care_tasks')
        .insert([{
          user_profile_id: profile.id,
          task_type: taskData.type,
          priority: taskData.priority || 'normal',
          title: taskData.title,
          description: taskData.description,
          assigned_to: taskData.assigned_to || 'ai',
          assigned_contact: taskData.contact || {},
          triggered_by: taskData.triggered_by || 'ai_detection',
          trigger_context: taskData.context || {},
          status: 'pending',
          scheduled_at: taskData.scheduled_at || new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;

      console.log('✅ 照護任務已派送:', data.id);
      return { success: true, data };
    } catch (error) {
      console.error('❌ 派送照護任務失敗:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * 計算心情趨勢
   */
  async getMoodTrends(userId, days = 30) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const journalsResult = await this.getEmotionalJournals(userId, {
        limit: days,
        startDate: startDate.toISOString().split('T')[0]
      });

      if (!journalsResult.success) {
        throw new Error('無法取得日記');
      }

      const journals = journalsResult.data;

      // 計算統計資料
      const moodScores = journals.map(j => j.mood_score).filter(s => s != null);
      const avgMood = moodScores.length > 0
        ? (moodScores.reduce((a, b) => a + b, 0) / moodScores.length).toFixed(1)
        : 0;

      // 收集所有情緒標籤
      const allTags = journals.flatMap(j => j.mood_tags || []);
      const tagCounts = {};
      allTags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });

      // 排序取前 3
      const topTags = Object.entries(tagCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([tag, count]) => ({ tag, count, percentage: ((count / journals.length) * 100).toFixed(0) }));

      // 判斷趨勢
      let trend = 'stable';
      if (moodScores.length >= 7) {
        const recentAvg = moodScores.slice(0, 7).reduce((a, b) => a + b, 0) / 7;
        const olderAvg = moodScores.slice(7, 14).reduce((a, b) => a + b, 0) / Math.min(7, moodScores.length - 7);

        if (recentAvg > olderAvg + 0.5) trend = 'improving';
        else if (recentAvg < olderAvg - 0.5) trend = 'declining';
      }

      return {
        success: true,
        data: {
          avgMood: parseFloat(avgMood),
          trend,
          journalCount: journals.length,
          topEmotions: topTags,
          moodScores: moodScores.slice(0, 30)
        }
      };
    } catch (error) {
      console.error('❌ 計算心情趨勢失敗:', error.message);
      return { success: false, error: error.message };
    }
  }
}

export default new SpiritualCareService();
