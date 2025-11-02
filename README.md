# 🏥 ElderCare AI 陪伴助手

> 專為老年人設計的智能對話陪伴系統

**線上體驗**: https://08-eldercare.vercel.app/

---

## ✨ 主要特色

### 🎯 老年人友善設計
- 超大字體（18-40px 可調）
- 高對比色彩
- 語音輸入/播報
- 簡潔直覺介面

### 🤖 智能 AI 對話
- Google Gemini 2.0 / OpenAI / Deepseek
- 溫暖陪伴語氣
- 自動對話總結
- 完整歷史記錄

### 🌍 多語言支援
- 繁體中文 / 簡體中文 / English / 日本語 / 한국어

### 🆘 安全關懷
- 快捷功能按鈕（緊急聯絡、用藥提醒、健康記錄）
- 智能健康關注

### 💊 用藥提醒系統（NEW!）
- 📧 Email 自動通知（Resend，免費 3000 封/月）
- 📱 FCM 推播通知（完全免費）
- ⏰ Cron 排程自動提醒
- 👨‍👩‍👧 未服藥時通知家屬
- 📊 用藥記錄追蹤與統計
- 🌏 多語言 Email 模板（繁中、簡中、英文）

---

## 🚀 快速開始

### 線上體驗（無需配置）

訪問 https://08-eldercare.vercel.app/ 立即開始！

### 本地開發

```bash
# 1. 安裝依賴
npm install
cd backend && npm install && cd ..

# 2. 設定環境變數
cp .env.example .env
# 編輯 .env，填入你的 API Keys

# 3. 啟動服務
npm run dev

# 4. 訪問
http://localhost:8080
```

### 環境變數設定

```env
# Supabase
SUPABASE_URL=你的 Supabase URL
SUPABASE_ANON_KEY=你的 Anon Key
SUPABASE_SERVICE_ROLE_KEY=你的 Service Role Key

# LLM (至少配置一個)
LLM_PROVIDER=gemini  # 或 openai, deepseek
GEMINI_API_KEY=你的 Gemini Key  # 推薦！免費額度充足
# OPENAI_API_KEY=你的 OpenAI Key

# Email 通知（用藥提醒功能，可選）
RESEND_API_KEY=re_your_api_key  # Resend API Key
RESEND_FROM_EMAIL=ElderCare <noreply@yourdomain.com>
```

**如何取得 API Keys?**
- **Gemini**: https://aistudio.google.com/app/apikey（推薦，免費）
- **OpenAI**: https://platform.openai.com/api-keys（需付費）
- **Supabase**: https://supabase.com/dashboard（免費）
- **Resend**: https://resend.com/（Email 通知，免費 3000 封/月）

---

## 📚 文件

| 文件 | 說明 |
|------|------|
| **[COMPLETE_DOCUMENTATION.md](COMPLETE_DOCUMENTATION.md)** | 📖 完整文件（系統架構、API、部署） |
| **[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)** | 🚀 詳細部署指南（Vercel + Render + FCM） |
| **[MEDICATION_REMINDER_SETUP.md](MEDICATION_REMINDER_SETUP.md)** | 💊 用藥提醒設定指南（Email 通知） |
| **[QUICKSTART.md](QUICKSTART.md)** | ⚡ 5分鐘快速啟動 |

---

## 🏗️ 技術架構

```
前端 (Vercel)           後端 (Render)         資料庫 (Supabase)
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│ Vanilla JS   │ ────> │ Node.js      │ ────> │ PostgreSQL   │
│ HTML/CSS     │       │ Express      │       │ + RLS        │
└──────────────┘       └──────────────┘       └──────────────┘
                              │
                              ↓
                       ┌──────────────┐
                       │ Gemini API   │
                       │ / OpenAI     │
                       └──────────────┘
```

---

## 📁 專案結構

```
eldercare-app/
├── backend/                # Node.js 後端
│   ├── services/          # 業務邏輯
│   ├── routes/            # API 路由
│   └── config/            # 配置
├── frontend/public/        # 前端靜態檔案
│   ├── index.html         # 主頁面
│   ├── app.js             # 主要邏輯
│   ├── i18n.js            # 多語言
│   └── settings.js        # 設定管理
├── database/              # 資料庫腳本
│   └── migrations/        # Migration
├── docs_archive/          # 歷史文件
├── .env                   # 環境變數
└── package.json           # 專案設定
```

---

## 🔧 常用指令

```bash
# 開發模式（同時啟動前後端）
npm run dev

# 只啟動後端
npm run dev:backend

# 只啟動前端
npm run dev:frontend

# 生產模式
npm run backend
```

---

## 🌐 部署

### 快速部署到雲端

1. **後端**: Render.com（免費）
2. **前端**: Vercel（免費）
3. **資料庫**: Supabase（免費）

詳細步驟請參考 **[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)**

### 成本

- **開發/測試**: 完全免費（使用 Gemini API）
- **生產環境**: $0-7/月（Render 免費層有休眠限制）

---

## 💡 常見問題

### 如何切換 AI 模型？

在設定頁面選擇 Gemini、OpenAI 或 Deepseek

### 支援哪些語言？

繁中、簡中、英文、日文、韓文

### 如何調整字體大小？

設定 → 字體大小 → 選擇 18-40px

### 語音功能如何使用？

點擊麥克風按鈕（需使用 Chrome/Edge 瀏覽器）

---

## 🎯 適用場景

- 👴 **獨居長輩**: 日常陪伴與關懷
- 🏥 **長照機構**: 輔助照護人員
- 👨‍👩‍👧 **家庭照顧**: 遠距關懷長輩
- 🏢 **醫療展示**: 創新長照解決方案

---

## 📊 功能清單

- ✅ AI 智能對話
- ✅ 自動對話總結
- ✅ 多語言支援
- ✅ 語音輸入/播報
- ✅ 字體大小調整
- ✅ 淺色/深色主題
- ✅ 快捷功能按鈕
- ✅ 對話歷史記錄
- ✅ 跨裝置同步
- ✅ 用藥提醒系統（Email + FCM 推播）
- ✅ 未服藥家屬通知
- ✅ 用藥記錄追蹤

---

## 🚀 未來規劃

### 短期目標（1-3 個月）

#### 🏥 健康管理功能
- [ ] **健康數據整合**
  - 血壓、血糖、心率記錄
  - 數據趨勢圖表顯示
  - 異常數值警示

- [x] **用藥提醒系統** ✅ 已完成
  - ✅ Email 自動通知（Resend）
  - ✅ FCM 推播通知
  - ✅ Cron 排程自動提醒
  - ✅ 用藥記錄追蹤
  - ✅ 未服藥時通知家屬
  - ✅ 多語言 Email 模板

- [ ] **語音功能強化**
  - 離線語音辨識
  - 多方言支援（台語、客語）
  - 語音指令快捷操作

#### 👨‍👩‍👧 家屬端功能
- [ ] **家屬監控面板**
  - 查看長輩對話記錄
  - 健康數據儀表板
  - 異常行為提醒

- [ ] **遠程關懷**
  - 家屬可發送關懷訊息
  - 設定提醒事項
  - 查看活動狀態

### 中期目標（3-6 個月）

#### 🤖 AI 智能升級
- [ ] **情緒識別與關懷**
  - 分析對話中的情緒變化
  - 主動提供情緒支持
  - 異常情緒警示通知家屬

- [ ] **個性化建議系統**
  - 根據歷史對話學習偏好
  - 主動推薦適合的活動
  - 個人化健康建議

- [ ] **多模態互動**
  - 圖片分享與辨識
  - 語音留言功能
  - 視訊通話整合

#### 📱 行動應用
- [ ] **原生 APP 開發**
  - iOS / Android 雙平台
  - 推播通知功能
  - 離線使用支援

- [ ] **PWA 完整支援**
  - 桌面圖示安裝
  - 離線快取機制
  - 背景同步功能

### 長期目標（6-12 個月）

#### 🏢 機構版功能
- [ ] **長照機構管理系統**
  - 多位長輩管理
  - 照護人員協作平台
  - 機構數據統計分析

- [ ] **專業醫療整合**
  - 醫療院所系統對接
  - 遠距醫療諮詢
  - 電子病歷整合

#### ⌚ 智能設備整合
- [ ] **穿戴式裝置連接**
  - 智慧手錶/手環數據同步
  - 即時健康監測
  - 跌倒偵測警報

- [ ] **智慧家居整合**
  - 語音控制家電
  - 環境感測器連動
  - 居家安全監控

#### 🆘 緊急救護系統
- [ ] **智能緊急通報**
  - 一鍵撥打 119
  - 自動發送位置資訊
  - 通知緊急聯絡人

- [ ] **跌倒檢測與通報**
  - 整合穿戴裝置
  - 自動偵測異常狀況
  - 即時通報家屬/救護單位

### 研究方向

#### 🧠 AI 技術研發
- [ ] **本地化 LLM 部署**
  - 降低 API 成本
  - 提升回應速度
  - 保護隱私數據

- [ ] **語音合成優化**
  - 更自然的 TTS 語音
  - 台灣腔調優化
  - 情感語音表達

#### 🔐 安全與隱私
- [ ] **醫療級資料加密**
  - 符合 HIPAA 標準
  - 端對端加密通訊
  - 定期安全稽核

- [ ] **隱私保護機制**
  - 敏感資料匿名化
  - 使用者資料控制權
  - 符合 GDPR 規範

### 商業化規劃

#### 💰 營收模式
- [ ] **免費版 + 進階版**
  - 基礎功能永久免費
  - 進階功能訂閱制
  - 機構版企業授權

- [ ] **B2B 合作**
  - 長照機構合作方案
  - 醫療院所整合
  - 保險公司合作

---

### 📊 優先順序評估

| 功能 | 優先級 | 預估工時 | 狀態 |
|------|--------|----------|------|
| 用藥提醒系統 | 🔴 高 | 2 週 | ✅ 已完成 |
| 家屬監控面板 | 🔴 高 | 3 週 | 🔄 進行中 |
| 健康數據整合 | 🟡 中 | 3 週 | 資料庫擴充 |
| 語音功能強化 | 🟡 中 | 4 週 | 語音引擎 |
| 原生 APP 開發 | 🟢 低 | 8 週 | React Native |
| 智能設備整合 | 🟢 低 | 12 週 | 硬體合作 |

---

### 🎯 2025 年度目標

**Q2**: 完成家屬端功能 + 用藥提醒系統
**Q3**: 推出 iOS/Android APP
**Q4**: 開始機構版試點合作

---

**我們歡迎社群貢獻！如果您對任何功能有興趣，歡迎聯繫我們討論合作。** 🤝

---

## 🤝 貢獻

歡迎提交 Issue 和 Pull Request！

---

## 📄 授權

MIT License

---

## 👥 聯絡

- **線上體驗**: https://08-eldercare.vercel.app/
- **問題回報**: GitHub Issues

---

**用心陪伴每一位長輩 ❤️**
