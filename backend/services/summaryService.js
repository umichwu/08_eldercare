import { supabase, supabaseAdmin } from '../config/supabase.js';
import { openai, defaultModel } from '../config/openai.js';
import messageService from './messageService.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * 對話總結服務
 */
class SummaryService {
  /**
   * 檢查是否需要產生自動總結
   */
  async checkAutoSummary(conversationId, userId) {
    try {
      const threshold = parseInt(process.env.AUTO_SUMMARY_THRESHOLD) || 20;

      // 取得對話資訊
      const { data: conv, error } = await supabase
        .from('conversations')
        .select('message_count, messages_since_last_summary')
        .eq('id', conversationId)
        .eq('auth_user_id', userId)
        .single();

      if (error) throw error;

      const needsSummary = conv.messages_since_last_summary >= threshold;

      return {
        success: true,
        needsSummary,
        messageCount: conv.message_count,
        messagesSinceLastSummary: conv.messages_since_last_summary,
        threshold
      };
    } catch (error) {
      console.error('❌ 檢查自動總結失敗:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * 產生對話總結
   */
  async generateSummary(conversationId, userId) {
    try {
      if (!openai) {
        throw new Error('OpenAI API 未配置');
      }

      // 取得最近的訊息
      const messagesResult = await messageService.getMessages(
        conversationId,
        userId,
        50
      );

      if (!messagesResult.success || !messagesResult.data.length) {
        throw new Error('沒有可總結的訊息');
      }

      const messages = messagesResult.data;

      // 建立總結提示
      const conversationText = messages
        .map(msg => `${msg.role === 'user' ? '使用者' : '助理'}: ${msg.content}`)
        .join('\n\n');

      const summaryPrompt = `請為以下對話產生一個簡潔的中文總結，重點關注：
1. 使用者提到的主要話題
2. 使用者的健康狀況或關切事項
3. 重要的建議或資訊
4. 使用者的情緒狀態

對話內容：
${conversationText}

總結（請用 3-5 個要點列出）：`;

      // 呼叫 OpenAI API
      const completion = await openai.chat.completions.create({
        model: defaultModel,
        messages: [
          {
            role: 'system',
            content: '你是一個專業的對話總結助手，擅長從老年人的對話中提取重要資訊。'
          },
          {
            role: 'user',
            content: summaryPrompt
          }
        ],
        temperature: 0.3,
        max_tokens: 300
      });

      const summaryText = completion.choices[0].message.content;

      // 儲存總結到資料庫
      const { data: summary, error } = await supabase
        .from('conversation_summaries')
        .insert([
          {
            conversation_id: conversationId,
            user_profile_id: userId,
            summary: summaryText,
            summary_type: 'auto',
            token_count: completion.usage.total_tokens,
            is_latest: true
          }
        ])
        .select()
        .single();

      if (error) throw error;

      // 將之前的總結設為非最新
      await supabase
        .from('conversation_summaries')
        .update({ is_latest: false })
        .eq('conversation_id', conversationId)
        .neq('id', summary.id);

      // 重置訊息計數器
      await supabase
        .from('conversations')
        .update({ messages_since_last_summary: 0 })
        .eq('id', conversationId);

      console.log('✅ 對話總結已產生:', summary.id);
      return { success: true, data: summary };
    } catch (error) {
      console.error('❌ 產生總結失敗:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * 取得對話的所有總結
   */
  async getSummaries(conversationId, userId) {
    try {
      const { data, error } = await supabase
        .from('conversation_summaries')
        .select('*')
        .eq('conversation_id', conversationId)
        .eq('user_profile_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      console.error('❌ 取得總結失敗:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * 取得最新總結
   */
  async getLatestSummary(conversationId, userId) {
    try {
      const { data, error } = await supabase
        .from('conversation_summaries')
        .select('*')
        .eq('conversation_id', conversationId)
        .eq('user_profile_id', userId)
        .eq('is_latest', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      console.error('❌ 取得最新總結失敗:', error.message);
      return { success: false, error: error.message };
    }
  }
}

export default new SummaryService();
