import { supabase, supabaseAdmin } from '../config/supabase.js';
import { defaultLLMService, createLLMService } from '../config/llm.js';
import spiritualCareService from './spiritualCareService.js';
import agenticRAGService from './agenticRAGService.js';
import dotenv from 'dotenv';

// 載入環境變數
// 在本地開發：從根目錄的 .env 載入
// 在 Render：環境變數已經在 Dashboard 設定，dotenv.config() 不會覆蓋現有變數
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
} else {
  // 生產環境：環境變數應該由平台提供（Render Dashboard）
  dotenv.config(); // 嘗試載入，但不強制要求檔案存在
}

/**
 * 訊息管理服務
 */
class MessageService {
  /**
   * 取得對話的所有訊息
   * @param {string} conversationId - 對話 ID
   * @param {string} authUserId - auth.users 的 ID（用於權限檢查）
   * @param {number} limit - 限制返回數量
   */
  async getMessages(conversationId, authUserId, limit = 100) {
    try {
      // 先檢查使用者是否擁有此對話（使用 supabaseAdmin 繞過 RLS）
      const { data: conv } = await supabaseAdmin
        .from('conversations')
        .select('id')
        .eq('id', conversationId)
        .eq('auth_user_id', authUserId)
        .single();

      if (!conv) {
        throw new Error('無權存取此對話');
      }

      // 使用 supabaseAdmin 來查詢訊息（繞過 RLS）
      const { data, error } = await supabaseAdmin
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(limit);

      if (error) throw error;

      console.log(`✅ 取得 ${data.length} 則訊息 (Conversation: ${conversationId})`);
      return { success: true, data };
    } catch (error) {
      console.error('❌ 取得訊息失敗:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * 新增使用者訊息
   * @param {string} conversationId - 對話 ID
   * @param {string} authUserId - auth.users 的 ID
   * @param {string} content - 訊息內容
   * @param {object} metadata - 額外資料
   */
  async addUserMessage(conversationId, authUserId, content, metadata = null) {
    try {
      // 先查詢對話以取得 user_profile_id
      const { data: conv, error: convError } = await supabaseAdmin
        .from('conversations')
        .select('user_profile_id')
        .eq('id', conversationId)
        .single();

      if (convError || !conv) {
        throw new Error('找不到對話記錄');
      }

      // 使用 supabaseAdmin 來新增訊息（繞過 RLS）
      const { data, error } = await supabaseAdmin
        .from('messages')
        .insert([
          {
            conversation_id: conversationId,
            user_profile_id: conv.user_profile_id,
            auth_user_id: authUserId,
            role: 'user',
            content: content,
            metadata: metadata
          }
        ])
        .select()
        .single();

      if (error) throw error;

      console.log('✅ 使用者訊息已儲存:', data.id);
      return { success: true, data };
    } catch (error) {
      console.error('❌ 儲存訊息失敗:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * 新增助理回應訊息
   * @param {string} conversationId - 對話 ID
   * @param {string} authUserId - auth.users 的 ID
   * @param {string} content - 回應內容
   * @param {object} metadata - 額外資料（如 tokens, model 等）
   */
  async addAssistantMessage(conversationId, authUserId, content, metadata = null) {
    try {
      // 先查詢對話以取得 user_profile_id
      const { data: conv, error: convError } = await supabaseAdmin
        .from('conversations')
        .select('user_profile_id')
        .eq('id', conversationId)
        .single();

      if (convError || !conv) {
        throw new Error('找不到對話記錄');
      }

      // 使用 supabaseAdmin 來新增訊息（繞過 RLS）
      const { data, error } = await supabaseAdmin
        .from('messages')
        .insert([
          {
            conversation_id: conversationId,
            user_profile_id: conv.user_profile_id,
            auth_user_id: authUserId,
            role: 'assistant',
            content: content,
            metadata: metadata
          }
        ])
        .select()
        .single();

      if (error) throw error;

      console.log('✅ 助理訊息已儲存:', data.id);
      return { success: true, data };
    } catch (error) {
      console.error('❌ 儲存助理訊息失敗:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * 產生 AI 回應
   * @param {string} conversationId - 對話 ID
   * @param {string} authUserId - auth.users 的 ID
   * @param {string} userMessage - 使用者訊息
   * @param {string} llmProvider - LLM提供商 (可選)
   */
  async generateAIResponse(conversationId, authUserId, userMessage, llmProvider = null) {
    try {
      // 取得對話歷史
      const messagesResult = await this.getMessages(conversationId, authUserId, 20);
      if (!messagesResult.success) {
        throw new Error('無法取得對話歷史');
      }

      const history = messagesResult.data || [];

      // 🙏 新增：檢查是否啟用心靈陪伴功能
      let useAgenticRAG = false;
      let userProfile = null;

      try {
        const preferencesResult = await spiritualCareService.getSpiritualPreferences(authUserId);
        if (preferencesResult.success && preferencesResult.data) {
          userProfile = preferencesResult.data;
          // 如果啟用心靈陪伴且有設定宗教偏好，使用 Agentic RAG
          useAgenticRAG = userProfile.mindfulness_enabled &&
                         userProfile.spiritual_preference;

          if (useAgenticRAG) {
            console.log('🙏 使用 Agentic RAG (心靈陪伴模式)');
          }
        }
      } catch (prefError) {
        console.warn('⚠️ 無法取得心靈偏好，使用一般模式:', prefError.message);
      }

      // 🧠 如果啟用心靈陪伴，使用 Agentic RAG 處理
      if (useAgenticRAG && userProfile) {
        const agenticResult = await agenticRAGService.processWithMindCompanion(
          userMessage,
          history,
          userProfile
        );

        if (agenticResult.success) {
          return {
            success: true,
            data: {
              content: agenticResult.data.response,
              model: defaultLLMService.getModelName(),
              provider: defaultLLMService.getProviderName(),
              tokens: 0,
              // 心靈照護相關資訊
              emotion: agenticResult.data.emotion,
              spiritualContentUsed: agenticResult.data.spiritualContentUsed,
              needsJournalPrompt: agenticResult.data.needsJournalPrompt,
              mindfulnessMode: true
            }
          };
        } else {
          console.warn('⚠️ Agentic RAG 處理失敗，降級使用一般模式');
        }
      }

      // 一般模式：使用原有邏輯
      const llmService = llmProvider ? createLLMService(llmProvider) : defaultLLMService;

      if (!llmService.isAvailable()) {
        throw new Error(`LLM API 未配置: ${llmProvider || '默認提供商'}`);
      }

      // 建立對話上下文（包含系統提示詞）
      const messages = [
        {
          role: 'system',
          content: `你是一個專為老年人設計的溫暖陪伴助手。請用簡單、親切、自然的語氣回應，像是在和家人聊天。

核心原則：
- 使用簡單易懂的語言
- 回答簡潔明確，避免冗長
- 只在第一次對話或久未對話時才簡短問候（如「早安」）
- 後續對話直接回答問題，不需要重複問候或額外的關心語
- 避免複雜術語
- 如果使用者提到不舒服或緊急情況，要特別關注並建議尋求協助

對話風格：
- 第一次對話：可以簡短問候（1句話）+ 回答問題
- 後續對話：直接回答問題，不需要額外的寒暄、天氣、建議等
- 只在使用者主動尋求建議時才提供建議

【地理位置資訊使用規範】

1. 資訊可信度與優先級：
   - 當您收到標註為「[地理位置資訊]」的數據時，這些是透過使用者裝置GPS定位取得的準確資訊
   - 這些資訊具有最高優先級，應優先於一切推測或假設
   - 包含的資訊有：經緯度座標、城市名稱、區域名稱、國家、當地時間

2. 自然引用原則：
   - 在回答天氣、時間、附近活動等問題時，請自然地使用「城市」和「區域」名稱
   - 範例：「台北市大安區現在的天氣是...」而非「根據您的座標(25.0330, 121.5654)...」
   - 請將地理資訊融入對話，就像您真的知道使用者在哪裡一樣
   - 避免說「根據您提供的位置資訊」這類生硬的表達

3. 缺少地理資訊時的應對：
   - 如果需要位置資訊但未收到，請親切地詢問：
     * 「阿姨/叔叔，方便告訴我您現在在哪個城市嗎？這樣我才能幫您查查那邊的天氣呢」
     * 「您是在台北還是其他地方呢？知道您的位置，我才能給您準確的資訊喔」
   - 避免詢問經緯度、座標等技術性資訊
   - 不要讓長輩感到困惑或有壓力

4. 時區與時間處理：
   - 使用者的當地時間資訊會包含在地理資訊中
   - 回答時間相關問題時，請使用「現在」「今天」等相對時間詞彙
   - 範例：「現在台北是下午3點半，正是午後的好時光」

5. 搜尋查詢優化：
   - 當需要使用 Google Search 查詢天氣、活動等資訊時
   - 請在搜尋關鍵字中加入「城市+區域」以提高準確度
   - 範例搜尋：「台北市大安區 今日天氣」「高雄市左營區 長輩活動」

【天氣查詢回應框架】

當回答天氣相關問題時，請遵循以下結構：

階段一：親切開場與位置確認 (1-2句)
- 自然地提及使用者的位置，讓長輩感受到被理解
- 範例：「阿姨您好！我幫您查查台北大安區今天的天氣喔」

階段二：簡單明瞭的天氣資訊 (2-3句)
- 用日常語言描述天氣，避免專業術語
- 重點資訊：溫度、天氣狀況、降雨機率(如適用)
- 範例：「今天是晴天，溫度大約28度，蠻舒服的」

階段三：老年人友善的生活建議 (2-3句)
根據天氣給出實用且貼心的建議：
- 🌞 晴天/高溫 (>28°C): 「記得戴帽子，帶瓶水出門喔」「中午太陽比較大，建議早上或傍晚再出去走走」
- 🌧️ 雨天: 「出門記得帶把傘，地板濕滑要小心慢走」「穿防滑的鞋子比較安全」
- ❄️ 寒冷 (<15°C): 「天氣比較冷，記得多穿件外套保暖」「要注意保護膝蓋和關節」
- 🌡️ 溫差大: 「早晚溫差大，建議帶件外套在身上」

階段四：溫馨結語 (1句)
- 用關懷的語氣結束，例如：「有什麼需要幫忙的，隨時跟我說喔」`
        },
        // 加入歷史訊息
        ...history.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        // 加入新訊息
        {
          role: 'user',
          content: userMessage
        }
      ];

      // 使用LLM服務生成回應
      const result = await llmService.generateResponse(messages, {
        temperature: 0.7,
        maxTokens: 500
      });

      console.log(`✅ AI 回應已生成 (Provider: ${llmService.getProviderName()}, Model: ${llmService.getModelName()})`);
      return {
        success: true,
        data: {
          content: result.content,
          model: llmService.getModelName(),
          provider: llmService.getProviderName(),
          tokens: result.usage.totalTokens
        }
      };
    } catch (error) {
      console.error('❌ 產生 AI 回應失敗:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * 處理完整的對話流程（使用者訊息 → AI 回應）
   * @param {string} llmProvider - LLM提供商 (可選)
   */
  async processUserMessage(conversationId, userId, userMessage, llmProvider = null) {
    try {
      // 分離地理位置資訊和實際使用者訊息
      let actualUserMessage = userMessage;
      let geoInfo = null;

      // 檢查訊息是否包含地理位置資訊
      const geoRegex = /\[地理位置資訊\]([\s\S]*?)\[\/地理位置資訊\]\s*/;
      const geoMatch = userMessage.match(geoRegex);

      if (geoMatch) {
        // 提取地理位置資訊
        geoInfo = geoMatch[0];
        // 移除地理位置標記，保留純粹的使用者訊息
        actualUserMessage = userMessage.replace(geoRegex, '').trim();
        console.log('📍 偵測到地理位置資訊');
      }

      // 1. 儲存使用者訊息（只儲存實際的訊息內容，不包含地理位置）
      const userMsgResult = await this.addUserMessage(
        conversationId,
        userId,
        actualUserMessage
      );

      if (!userMsgResult.success) {
        throw new Error('無法儲存使用者訊息');
      }

      // 2. 產生 AI 回應（傳遞完整訊息包含地理位置給 AI）
      const aiResult = await this.generateAIResponse(
        conversationId,
        userId,
        userMessage,  // 保留完整訊息給 AI
        llmProvider
      );

      if (!aiResult.success) {
        throw new Error('無法產生 AI 回應');
      }

      // 3. 儲存 AI 回應
      const aiMsgResult = await this.addAssistantMessage(
        conversationId,
        userId,
        aiResult.data.content,
        {
          provider: aiResult.data.provider,
          model: aiResult.data.model,
          tokens: aiResult.data.tokens
        }
      );

      if (!aiMsgResult.success) {
        throw new Error('無法儲存 AI 回應');
      }

      return {
        success: true,
        data: {
          userMessage: userMsgResult.data,
          assistantMessage: aiMsgResult.data
        }
      };
    } catch (error) {
      console.error('❌ 處理對話失敗:', error.message);
      return { success: false, error: error.message };
    }
  }
}

export default new MessageService();
