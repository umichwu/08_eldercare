import { supabase, supabaseAdmin } from '../config/supabase.js';
import { defaultLLMService, createLLMService } from '../config/llm.js';
import dotenv from 'dotenv';

dotenv.config();

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
      // 根據用戶選擇的提供商創建LLM服務
      const llmService = llmProvider ? createLLMService(llmProvider) : defaultLLMService;

      if (!llmService.isAvailable()) {
        throw new Error(`LLM API 未配置: ${llmProvider || '默認提供商'}`);
      }

      // 取得對話歷史
      const messagesResult = await this.getMessages(conversationId, authUserId, 20);
      if (!messagesResult.success) {
        throw new Error('無法取得對話歷史');
      }

      const history = messagesResult.data || [];

      // 建立對話上下文（包含系統提示詞）
      const messages = [
        {
          role: 'system',
          content: `你是一個專為老年人設計的溫暖陪伴助手。請用簡單、親切、有耐心的語氣回應。
特點：
- 使用簡單易懂的語言
- 語氣溫暖友善，像是在和家人聊天
- 回答要清楚明確，避免複雜術語
- 關心使用者的身體健康和情緒
- 提供實用的生活建議
- 如果使用者提到不舒服或緊急情況，要特別關注並建議尋求協助`
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
      // 1. 儲存使用者訊息
      const userMsgResult = await this.addUserMessage(
        conversationId,
        userId,
        userMessage
      );

      if (!userMsgResult.success) {
        throw new Error('無法儲存使用者訊息');
      }

      // 2. 產生 AI 回應（使用用戶指定的LLM提供商）
      const aiResult = await this.generateAIResponse(
        conversationId,
        userId,
        userMessage,
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
