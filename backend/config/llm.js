import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import geminiKeyPool from './geminiKeyPool.js';

// 取得當前檔案的目錄
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 載入環境變數
// 在本地開發：從根目錄的 .env 載入
// 在 Render：環境變數已經在 Dashboard 設定，dotenv.config() 不會覆蓋現有變數
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: path.resolve(__dirname, '../../.env') });
} else {
  // 生產環境：環境變數應該由平台提供（Render Dashboard）
  dotenv.config(); // 嘗試載入，但不強制要求檔案存在
}

// 支持的LLM提供商
export const LLM_PROVIDERS = {
  OPENAI: 'openai',
  GEMINI: 'gemini',
  DEEPSEEK: 'deepseek'
};

// 每个提供商的默认模型
const DEFAULT_MODELS = {
  [LLM_PROVIDERS.OPENAI]: 'gpt-4o-mini',
  [LLM_PROVIDERS.GEMINI]: 'gemini-2.0-flash-exp',
  [LLM_PROVIDERS.DEEPSEEK]: 'deepseek-chat'
};

// 从环境变量获取配置
const currentProvider = process.env.LLM_PROVIDER || LLM_PROVIDERS.GEMINI;
const openaiApiKey = process.env.OPENAI_API_KEY;
const deepseekApiKey = process.env.DEEPSEEK_API_KEY;

// 初始化各个LLM客户端
let openaiClient = null;
let deepseekClient = null;

if (openaiApiKey) {
  openaiClient = new OpenAI({ apiKey: openaiApiKey });
  console.log('✅ OpenAI client initialized');
}

// ✅ Gemini 使用 Key Pool（支持多個 API Keys）
console.log('✅ Gemini Key Pool initialized');

if (deepseekApiKey) {
  deepseekClient = new OpenAI({
    apiKey: deepseekApiKey,
    baseURL: 'https://api.deepseek.com'
  });
  console.log('✅ Deepseek client initialized');
}

// 统一的LLM接口
export class LLMService {
  constructor(provider = currentProvider) {
    this.provider = provider;
    this.client = this.getClient(provider);
    this.defaultModel = DEFAULT_MODELS[provider];
  }

  getClient(provider) {
    switch (provider) {
      case LLM_PROVIDERS.OPENAI:
        if (!openaiClient) {
          console.warn('⚠️  OpenAI API key not configured');
        }
        return openaiClient;
      case LLM_PROVIDERS.GEMINI:
        // ✅ Gemini 使用 Key Pool，在 generateGeminiResponse 中動態取得
        if (!geminiKeyPool.hasAvailableKeys()) {
          console.warn('⚠️  Gemini Key Pool 中沒有可用的 Keys');
          return null;
        }
        return 'gemini-key-pool'; // 返回特殊標記
      case LLM_PROVIDERS.DEEPSEEK:
        if (!deepseekClient) {
          console.warn('⚠️  Deepseek API key not configured');
        }
        return deepseekClient;
      default:
        console.error(`❌ Unknown LLM provider: ${provider}`);
        return null;
    }
  }

  async generateResponse(messages, options = {}) {
    if (!this.client) {
      const errorMsg = `LLM client not initialized for provider: ${this.provider}`;
      console.error(`❌ ${errorMsg}`);
      console.error(`   Available API Keys:`, {
        openai: !!openaiApiKey,
        gemini: !!geminiApiKey,
        deepseek: !!deepseekApiKey
      });
      throw new Error(errorMsg);
    }

    const temperature = options.temperature || 0.7;
    const maxTokens = options.maxTokens || 500;

    console.log(`🤖 Generating response with ${this.provider} (${this.defaultModel})`);
    console.log(`   Temperature: ${temperature}, MaxTokens: ${maxTokens}`);
    console.log(`   Messages count: ${messages.length}`);

    try {
      let result;
      if (this.provider === LLM_PROVIDERS.GEMINI) {
        result = await this.generateGeminiResponse(messages, temperature, maxTokens);
      } else {
        // OpenAI and Deepseek use the same API format
        result = await this.generateOpenAICompatibleResponse(messages, temperature, maxTokens);
      }

      console.log(`✅ Response generated successfully from ${this.provider}`);
      console.log(`   Content length: ${result.content?.length || 0} chars`);
      return result;
    } catch (error) {
      console.error(`❌ Error generating response from ${this.provider}:`, error.message);
      console.error(`   Error details:`, error);
      throw error;
    }
  }

  async generateOpenAICompatibleResponse(messages, temperature, maxTokens) {
    const completion = await this.client.chat.completions.create({
      model: this.defaultModel,
      messages: messages,
      temperature: temperature,
      max_tokens: maxTokens
    });

    return {
      content: completion.choices[0].message.content,
      usage: {
        promptTokens: completion.usage.prompt_tokens,
        completionTokens: completion.usage.completion_tokens,
        totalTokens: completion.usage.total_tokens
      }
    };
  }

  async generateGeminiResponse(messages, temperature, maxTokens) {
    // ✅ 使用 Key Pool 獲取可用的 Client（支持重試）
    const { client, keyInfo } = await geminiKeyPool.getClientWithRetry();

    try {
      const model = client.getGenerativeModel({
        model: this.defaultModel,
        generationConfig: {
          temperature: temperature,
          maxOutputTokens: maxTokens,
        }
      });

      // 转换消息格式为Gemini格式
      const systemMessage = messages.find(m => m.role === 'system');
      const chatMessages = messages.filter(m => m.role !== 'system');

      // 构建聊天历史
      let history = chatMessages.slice(0, -1).map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      }));

      // 获取最后一条用户消息
      const lastMessage = chatMessages[chatMessages.length - 1];

      // 将系统消息合并到第一条消息中
      let prompt = lastMessage.content;
      if (systemMessage) {
        if (history.length === 0) {
          // 如果没有历史，将系统消息添加到当前消息前
          prompt = `${systemMessage.content}\n\n用户问题：${prompt}`;
        } else {
          // 如果有历史，将系统消息作为对话历史的第一组交互
          // 注意：Gemini API 要求第一条消息必须是 user 角色
          const systemHistory = [
            {
              role: 'user',
              parts: [{ text: systemMessage.content }]
            },
            {
              role: 'model',
              parts: [{ text: '好的，我明白了。我會用簡單、親切、有耐心的語氣來陪伴老年人。' }]
            }
          ];
          history = [...systemHistory, ...history];
        }
      }

      const chat = model.startChat({
        history: history
      });

      const result = await chat.sendMessage(prompt);
      const response = result.response;
      const text = response.text();

      // ✅ 標記為成功
      geminiKeyPool.markSuccess(keyInfo);

      return {
        content: text,
        usage: {
          promptTokens: 0, // Gemini API doesn't return token counts in the same way
          completionTokens: 0,
          totalTokens: 0
        }
      };
    } catch (error) {
      // ✅ 檢查是否為配額錯誤
      const isQuotaError = error.message && (
        error.message.includes('quota') ||
        error.message.includes('429') ||
        error.message.includes('Too Many Requests') ||
        error.message.includes('RESOURCE_EXHAUSTED')
      );

      if (isQuotaError) {
        console.warn(`❌ ${keyInfo.id} 配額錯誤，標記為不可用`);
        geminiKeyPool.markQuotaError(keyInfo);

        // 重試：嘗試使用下一個 Key
        if (geminiKeyPool.hasAvailableKeys()) {
          console.log('🔄 嘗試使用下一個可用的 API Key...');
          return this.generateGeminiResponse(messages, temperature, maxTokens);
        }
      } else {
        geminiKeyPool.markError(keyInfo, error);
      }

      throw error;
    }
  }

  isAvailable() {
    // ✅ 特殊處理 Gemini Key Pool
    if (this.provider === LLM_PROVIDERS.GEMINI) {
      return geminiKeyPool.hasAvailableKeys();
    }
    return this.client !== null;
  }

  getProviderName() {
    return this.provider;
  }

  getModelName() {
    return this.defaultModel;
  }
}

// 导出默认实例
export const defaultLLMService = new LLMService(currentProvider);

// 导出辅助函数用于创建特定提供商的实例
export function createLLMService(provider) {
  return new LLMService(provider);
}

// 日志当前配置
console.log('📋 LLM Configuration:');
console.log('   Current Provider:', currentProvider);
console.log('   Default Model:', DEFAULT_MODELS[currentProvider]);
console.log('   OpenAI API Key:', openaiApiKey ? 'Configured' : 'Not configured');
console.log('   Gemini Key Pool:', geminiKeyPool.keys.length > 0 ? `${geminiKeyPool.keys.length} Keys` : 'Not configured');
console.log('   Deepseek API Key:', deepseekApiKey ? 'Configured' : 'Not configured');

// 顯示 Gemini Key Pool 詳細資訊
if (geminiKeyPool.keys.length > 0) {
  console.log('\n🔑 Gemini API Key Pool Status:');
  geminiKeyPool.keys.forEach((key, index) => {
    console.log(`   #${index + 1} ${key.id}: ${key.prefix} - ${key.isHealthy ? '✅ Healthy' : '❌ Unhealthy'}`);
  });
}
