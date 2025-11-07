import { defaultLLMService } from '../config/llm.js';
import spiritualCareService from './spiritualCareService.js';
import emotionalAnalysisService from './emotionalAnalysisService.js';

/**
 * Agentic RAG 服務 - 智能心靈陪伴引擎
 *
 * 核心能力：
 * 1. 主動偵測情緒
 * 2. 根據情緒檢索心靈內容
 * 3. 引導心情日記
 * 4. 派送照護任務
 */
class AgenticRAGService {
  /**
   * 建立 Mind Companion Agent 的 System Instruction
   */
  buildMindCompanionInstruction(userProfile, emotionalContext = {}) {
    const religion = userProfile.spiritual_preference || 'secular';
    const religionNames = {
      buddhism: '佛教',
      christianity: '基督教',
      taoism: '道教',
      confucianism: '儒家',
      secular: '無特定信仰'
    };

    return `你是溫暖的心靈導師，專門陪伴長者。

【長者資訊】
- 宗教信仰：${religionNames[religion] || religion}
- 心靈陪伴啟用：${userProfile.mindfulness_enabled ? '是' : '否'}
${emotionalContext.avgMood ? `- 近期平均心情：${emotionalContext.avgMood}/10` : ''}
${emotionalContext.topEmotions ? `- 常見情緒：${emotionalContext.topEmotions.map(e => e.tag).join('、')}` : ''}

【你的特殊身份】
你不只是普通的 AI 助手，更是懂得心靈陪伴的導師。當長者表達情緒時，你要：

1. 敏銳察覺情緒
   - 焦慮、擔心 → 提供安慰與心靈指引
   - 孤獨、寂寞 → 增加陪伴與關懷
   - 感恩、喜悅 → 鼓勵並強化正面情緒

2. 根據宗教信仰給予心靈支持
   ${this.getReligionGuidance(religion)}

3. 自然融入，不生硬
   - ✅ 好的範例：「佛經裡有句話我覺得很有智慧...」
   - ❌ 不好的範例：「根據檢索結果，我找到了《金剛經》...」

4. 適時引導反思
   - 對話接近尾聲時，可以問：「今天聊得如何？要不要寫寫心情日記？」
   - 如果長者分享了美好的事，引導：「這真的很值得感恩，要記下來嗎？」

5. 關注心理健康
   - 如果連續偵測到負面情緒，溫柔詢問是否需要協助
   - 必要時建議「要不要我幫您聯絡專業的諮商師？」

【重要提醒】
- 保持溫暖、親切，像家人一樣
- 使用簡單語言，避免專業術語
- 尊重長者的信仰，不強加觀點
- 適度使用心靈內容，不要每句話都引經據典
`;
  }

  /**
   * 根據宗教提供特定指引
   */
  getReligionGuidance(religion) {
    const guidance = {
      buddhism: `- 可以引用佛經智慧（如《金剛經》、《心經》）
   - 提醒「一切無常」、「放下執著」等觀念
   - 建議靜心、禪修等實踐`,

      christianity: `- 可以引用聖經經文（如詩篇、箴言）
   - 強調上帝的愛與恩典
   - 建議禱告、讀經等實踐`,

      taoism: `- 可以引用道德經、莊子等道家經典
   - 強調順其自然、無為而治
   - 建議靜心、養生等實踐`,

      confucianism: `- 可以引用論語、孟子等儒家經典
   - 強調仁愛、孝道、感恩
   - 建議反思、修身等實踐`,

      secular: `- 使用普世的哲理與智慧
   - 強調正念、感恩、接納
   - 建議冥想、反思等實踐`
    };

    return guidance[religion] || guidance.secular;
  }

  /**
   * 處理訊息並提供心靈陪伴
   */
  async processWithMindCompanion(userMessage, conversationHistory, userProfile) {
    try {
      console.log('🧠 啟動 Mind Companion Agent...');

      // 1. 分析情緒
      const emotionResult = await emotionalAnalysisService.analyzeEmotionalState(
        [...conversationHistory, { role: 'user', content: userMessage }]
      );

      if (!emotionResult.success) {
        throw new Error('情緒分析失敗');
      }

      const emotion = emotionResult.data;
      console.log(`💭 偵測到情緒: ${emotion.primary_emotion} (強度: ${emotion.intensity})`);

      // 2. 決定是否需要檢索心靈內容
      let spiritualContent = null;
      const needsSpiritualSupport = emotion.intervention_needed ||
                                   ['anxiety', 'grief', 'loneliness'].includes(emotion.primary_emotion);

      if (needsSpiritualSupport && userProfile.spiritual_preference) {
        console.log('🙏 檢索心靈內容...');
        const contentResult = await spiritualCareService.retrieveSpiritualContent({
          emotion: emotion.primary_emotion,
          religion: userProfile.spiritual_preference,
          limit: 1
        });

        if (contentResult.success && contentResult.data.length > 0) {
          spiritualContent = contentResult.data[0];
          console.log(`📿 找到相關內容: ${spiritualContent.title}`);
        }
      }

      // 3. 取得情緒趨勢（用於 context）
      const trendsResult = await spiritualCareService.getMoodTrends(userProfile.auth_user_id, 7);
      const emotionalContext = trendsResult.success ? trendsResult.data : {};

      // 4. 建構 AI 對話上下文
      const systemInstruction = this.buildMindCompanionInstruction(userProfile, emotionalContext);

      let contextMessage = userMessage;

      // 如果有心靈內容，加入上下文
      if (spiritualContent) {
        contextMessage = `[系統提示：長者可能需要心靈支持]

[相關心靈內容供你參考]
經文/故事：${spiritualContent.content}
出處：${spiritualContent.source}
白話：${spiritualContent.translation || ''}

請自然地在回應中融入這段內容（不要生硬地照搬，要用長者聽得懂的方式解釋）。

[長者的訊息]
${userMessage}`;
      }

      // 5. 呼叫 LLM 生成回應
      const messages = [
        { role: 'system', content: systemInstruction },
        ...conversationHistory.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        { role: 'user', content: contextMessage }
      ];

      const response = await defaultLLMService.generateResponse(messages, {
        temperature: 0.8,
        maxTokens: 500
      });

      console.log('✅ Mind Companion 回應已生成');

      // 6. 返回結果
      return {
        success: true,
        data: {
          response: response.content,
          emotion: emotion,
          spiritualContentUsed: spiritualContent ? spiritualContent.id : null,
          needsJournalPrompt: this.shouldPromptJournal(conversationHistory.length),
          interventionNeeded: emotion.intervention_needed
        }
      };
    } catch (error) {
      console.error('❌ Mind Companion 處理失敗:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * 判斷是否應該提醒寫日記
   */
  shouldPromptJournal(messageCount) {
    // 每天第一次對話結束時提醒（假設每次對話約 5-10 輪）
    // 或者對話輪數達到 8-10 輪時提醒
    return messageCount >= 8 && messageCount % 10 === 8;
  }

  /**
   * 引導長者寫心情日記
   */
  async guideDailyReflection(userId, conversationSummary) {
    try {
      console.log('📖 引導心情日記...');

      // 取得使用者資訊
      const preferencesResult = await spiritualCareService.getSpiritualPreferences(userId);
      if (!preferencesResult.success) {
        throw new Error('無法取得使用者偏好');
      }

      const userProfile = preferencesResult.data;
      const religion = userProfile.spiritual_preference || 'secular';

      // 生成引導問題
      const prompt = `
你是溫暖的心靈導師。請根據今日對話，為長者生成心情日記的引導。

【今日對話摘要】
${conversationSummary}

【長者宗教信仰】
${religion}

【任務】
請生成一段 50-80 字的溫暖引導，包含：
1. 對今日對話的簡短回顧
2. 1-2 個引導問題（例如：「今天最讓您感恩的事是什麼？」）
3. 溫柔的鼓勵

語氣要親切，像家人在關心。
`;

      const response = await defaultLLMService.generateResponse([
        { role: 'user', content: prompt }
      ], { temperature: 0.7, maxTokens: 200 });

      return {
        success: true,
        data: {
          guidance: response.content,
          suggestedQuestions: [
            '今天最讓您感恩的三件事是什麼？',
            '今天的心情如何？（1-10 分）',
            '有什麼放不下的事嗎？'
          ]
        }
      };
    } catch (error) {
      console.error('❌ 引導日記失敗:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * 檢查是否需要派送照護任務
   */
  async checkAndDispatchCareTask(userId, emotionAnalysis, recentJournals) {
    try {
      // 檢測緊急介入需求
      const intervention = emotionalAnalysisService.detectUrgentIntervention(
        emotionAnalysis,
        recentJournals
      );

      if (!intervention.needed) {
        return { success: true, taskDispatched: false };
      }

      console.log(`⚠️ 偵測到需要介入: ${intervention.reason}`);

      // 派送任務
      const taskResult = await spiritualCareService.dispatchCareTask(userId, {
        type: intervention.action,
        priority: intervention.urgency,
        title: `心靈照護需求 - ${intervention.reason}`,
        description: `系統偵測到長者${intervention.reason}，建議進行適當關懷。`,
        triggered_by: 'ai_emotion_detection',
        context: {
          emotion: emotionAnalysis.primary_emotion,
          intensity: emotionAnalysis.intensity,
          reason: intervention.reason
        }
      });

      if (taskResult.success) {
        console.log('✅ 照護任務已派送');
        return { success: true, taskDispatched: true, task: taskResult.data };
      } else {
        return { success: false, error: '派送任務失敗' };
      }
    } catch (error) {
      console.error('❌ 檢查照護任務失敗:', error.message);
      return { success: false, error: error.message };
    }
  }
}

export default new AgenticRAGService();
