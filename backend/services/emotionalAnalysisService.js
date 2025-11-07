import { defaultLLMService } from '../config/llm.js';

/**
 * 情緒分析服務
 */
class EmotionalAnalysisService {
  /**
   * 分析訊息中的情緒狀態
   */
  async analyzeEmotionalState(messages, historicalEmotions = null) {
    try {
      // 構建分析提示詞
      const recentMessages = messages.slice(-5).map(m => {
        return `${m.role === 'user' ? '長者' : 'AI'}: ${m.content}`;
      }).join('\n');

      const prompt = `
你是專業的情緒分析師。請分析以下對話中長者的情緒狀態。

【近期對話】
${recentMessages}

${historicalEmotions ? `【歷史情緒】
近期平均心情：${historicalEmotions.avgMood}/10
常見情緒：${historicalEmotions.topEmotions?.map(e => e.tag).join(', ')}
` : ''}

【分析要求】
請以 JSON 格式返回（不要有任何其他文字，只要純 JSON）：
{
  "primary_emotion": "主要情緒（anxiety/grief/gratitude/loneliness/peace/neutral）",
  "secondary_emotions": ["次要情緒1", "次要情緒2"],
  "intensity": 0.0到1.0之間的數值,
  "triggers": ["觸發因素1", "觸發因素2"],
  "intervention_needed": true或false,
  "suggested_actions": ["建議行動1", "建議行動2"],
  "confidence": 0.0到1.0之間的數值
}

分析標準：
- primary_emotion: 從對話中提取的主要情緒
- intensity: 情緒強度（0.0=很弱, 1.0=很強）
- intervention_needed: 是否需要心靈介入（如連續提到負面情緒、失眠、孤獨等）
- confidence: 你對這個分析的信心程度
`;

      const response = await defaultLLMService.generateResponse([
        { role: 'user', content: prompt }
      ], { temperature: 0.3, maxTokens: 400 });

      // 解析 JSON
      let analysisResult;
      try {
        // 移除可能的 markdown 標記
        let jsonText = response.content.trim();
        if (jsonText.startsWith('```json')) {
          jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
        } else if (jsonText.startsWith('```')) {
          jsonText = jsonText.replace(/```\n?/g, '');
        }

        analysisResult = JSON.parse(jsonText);
      } catch (parseError) {
        console.warn('⚠️ JSON 解析失敗，使用後備方案:', parseError.message);
        // 後備方案：基於關鍵字的簡單分析
        analysisResult = this.keywordBasedAnalysis(recentMessages);
      }

      console.log('✅ 情緒分析完成:', analysisResult.primary_emotion);
      return {
        success: true,
        data: analysisResult
      };
    } catch (error) {
      console.error('❌ 情緒分析失敗:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * 基於關鍵字的簡單情緒分析（後備方案）
   */
  keywordBasedAnalysis(messagesText) {
    const text = messagesText.toLowerCase();

    // 情緒關鍵字字典
    const emotionKeywords = {
      anxiety: ['擔心', '焦慮', '睡不著', '害怕', '緊張', '不安'],
      grief: ['難過', '想念', '失去', '懷念', '傷心', '悲傷'],
      loneliness: ['孤單', '寂寞', '沒人', '一個人', '孤獨'],
      gratitude: ['感謝', '感恩', '謝謝', '幸福', '開心', '快樂'],
      peace: ['平靜', '安心', '舒服', '放鬆', '平和']
    };

    // 計算每種情緒的匹配分數
    const scores = {};
    for (const [emotion, keywords] of Object.entries(emotionKeywords)) {
      scores[emotion] = keywords.filter(kw => text.includes(kw)).length;
    }

    // 找出最高分
    const sortedEmotions = Object.entries(scores)
      .sort((a, b) => b[1] - a[1])
      .filter(([_, score]) => score > 0);

    const primary_emotion = sortedEmotions[0]?.[0] || 'neutral';
    const intensity = Math.min(sortedEmotions[0]?.[1] || 0 / 3, 1);

    return {
      primary_emotion,
      secondary_emotions: sortedEmotions.slice(1, 3).map(([e]) => e),
      intensity,
      triggers: ['自動偵測'],
      intervention_needed: ['anxiety', 'grief', 'loneliness'].includes(primary_emotion) && intensity > 0.5,
      suggested_actions: this.getSuggestedActions(primary_emotion),
      confidence: 0.6 // 關鍵字分析的信心較低
    };
  }

  /**
   * 根據情緒獲取建議行動
   */
  getSuggestedActions(emotion) {
    const actionMap = {
      anxiety: ['播放靜心音樂', '分享相關經文', '引導呼吸練習'],
      grief: ['傾聽陪伴', '分享安慰故事', '考慮派送關懷任務'],
      loneliness: ['增加互動', '建議聯絡家人', '推薦社群活動'],
      gratitude: ['鼓勵記錄', '分享感恩故事', '強化正面情緒'],
      peace: ['維持現狀', '分享平靜語錄', '鼓勵靜心練習'],
      neutral: ['日常陪伴', '輕鬆對話']
    };

    return actionMap[emotion] || actionMap.neutral;
  }

  /**
   * 檢測是否需要緊急介入
   */
  detectUrgentIntervention(analysisResult, recentJournals = []) {
    // 情況 1: 高強度負面情緒
    if (analysisResult.intensity > 0.7 &&
        ['anxiety', 'grief', 'loneliness'].includes(analysisResult.primary_emotion)) {
      return {
        needed: true,
        urgency: 'high',
        reason: '偵測到高強度負面情緒',
        action: 'immediate_support'
      };
    }

    // 情況 2: 連續多天低心情
    if (recentJournals.length >= 3) {
      const recentScores = recentJournals.slice(0, 3).map(j => j.mood_score);
      const avgScore = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;

      if (avgScore <= 4) {
        return {
          needed: true,
          urgency: 'medium',
          reason: '連續 3 天心情評分偏低',
          action: 'counseling_referral'
        };
      }
    }

    // 情況 3: 提及自傷或危險想法（關鍵字偵測）
    const dangerKeywords = ['不想活', '了結', '自殺', '結束生命'];
    const hasDangerSignal = analysisResult.triggers?.some(trigger =>
      dangerKeywords.some(kw => trigger.includes(kw))
    );

    if (hasDangerSignal) {
      return {
        needed: true,
        urgency: 'urgent',
        reason: '偵測到危險訊號',
        action: 'emergency_contact'
      };
    }

    return {
      needed: false,
      urgency: 'none'
    };
  }

  /**
   * 生成情緒追蹤報告
   */
  async generateEmotionalReport(journals, period = 'weekly') {
    try {
      if (!journals || journals.length === 0) {
        return {
          success: true,
          data: {
            summary: '本期尚無心情記錄',
            avgMood: 0,
            trend: 'no_data'
          }
        };
      }

      // 收集資料
      const moodScores = journals.map(j => j.mood_score).filter(s => s != null);
      const avgMood = moodScores.length > 0
        ? (moodScores.reduce((a, b) => a + b, 0) / moodScores.length).toFixed(1)
        : 0;

      const allTags = journals.flatMap(j => j.mood_tags || []);
      const allGratitude = journals.flatMap(j => j.gratitude_items || []);
      const allConcerns = journals.flatMap(j => j.concerns || []);

      // 使用 AI 生成報告摘要
      const prompt = `
請為長者生成${period === 'weekly' ? '本週' : '本月'}的心靈狀態報告。

【數據】
- 平均心情評分：${avgMood} / 10
- 記錄天數：${journals.length} 天
- 常見情緒：${[...new Set(allTags)].slice(0, 5).join(', ')}
- 感恩事項：${allGratitude.slice(0, 3).join('; ')}
- 擔憂事項：${allConcerns.slice(0, 3).join('; ')}

【要求】
請生成一段 100-150 字的溫暖摘要，包含：
1. 整體心理狀態評價
2. 值得肯定的正向表現
3. 需要關注的地方（如果有）
4. 給予的鼓勵或建議

語氣要溫暖、親切，像是家人在關心。
`;

      const response = await defaultLLMService.generateResponse([
        { role: 'user', content: prompt }
      ], { temperature: 0.7, maxTokens: 300 });

      return {
        success: true,
        data: {
          summary: response.content,
          avgMood: parseFloat(avgMood),
          journalCount: journals.length,
          topEmotions: [...new Set(allTags)].slice(0, 5),
          highlights: allGratitude.slice(0, 5),
          concerns: allConcerns.slice(0, 3)
        }
      };
    } catch (error) {
      console.error('❌ 生成情緒報告失敗:', error.message);
      return { success: false, error: error.message };
    }
  }
}

export default new EmotionalAnalysisService();
