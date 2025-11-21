# ElderCare Companion - 文檔中心

> 完整的開發與部署文檔索引

## 📚 文檔導航

> 💡 **提示**: 每個文檔開頭都包含「📂 相關程式碼檔案」區塊，方便您快速找到對應的原始碼。

### 🚀 快速開始

| 文檔 | 說明 | 適合對象 |
|------|------|---------|
| [專案 README](../README.md) | 專案概述與快速開始 | 所有人 |
| [主要文檔](README_MAIN.md) | 完整的專案說明與功能介紹 | 所有人 |
| [部署指南](deployment-guide.md) | 完整的部署流程 | DevOps |
| [測試指南](testing-guide.md) | 測試方法與測試案例 | 開發者/QA |

### 🏗️ 架構與設定

| 文檔 | 說明 | 適合對象 |
|------|------|---------|
| [後端開發指南](backend-guide.md) | 後端架構與 API 開發 | 後端開發者 |
| [資料庫架構指南](database-schema-guide.md) | 資料庫設計與表格說明 | 資料庫管理員 |
| [資料庫欄位對應表](資料庫欄位對應表.md) | 前後端欄位對應 | 全端開發者 |

### 🔧 功能模組文檔

#### 認證與通知
| 文檔 | 說明 |
|------|------|
| [Firebase 設定指南](firebase-setup.md) | Firebase 專案設定 |
| [FCM 推播通知設定](FCM_SETUP_GUIDE.md) | FCM 推播詳細設定 |
| [通知服務文檔](NOTIFICATION_SERVICE_DOCUMENTATION.md) | Email/SMS 通知服務 |

#### 用藥管理
| 文檔 | 說明 |
|------|------|
| [用藥功能設定](medication-setup.md) | 用藥管理功能說明 |
| [語音用藥指南](voice-medication-guide.md) | 語音輸入用藥 |
| [用藥資料儲存機制](用藥資料儲存與刪除機制說明.md) | 資料儲存邏輯 |
| [Google Calendar 整合](google-calendar-integration.md) | 用藥提醒同步到日曆 |

#### 家屬監控
| 文檔 | 說明 |
|------|------|
| [家屬監控面板狀態](FAMILY_DASHBOARD_STATUS.md) | Dashboard 完成度報告 |
| [日期篩選功能實作](DATE_FILTER_IMPLEMENTATION.md) | 日期篩選詳細實作 |

#### 社交功能
| 文檔 | 說明 |
|------|------|
| [社交 API 文檔](SOCIAL_API_DOCUMENTATION.md) | 好友、聊天、動態 API |

#### AI 與語音
| 文檔 | 說明 |
|------|------|
| [Gemini Key Pool 指南](gemini-key-pool-guide.md) | Gemini API 金鑰池管理 |
| [台語 TTS 解決方案](taiwanese-tts-solution.md) | 台語語音播報實作 |
| [心靈照護 UI 設計](spiritual-care-ui-design.md) | 心靈照護介面設計 |
| [心靈照護 RAG 設計](spiritual-care-agentic-rag-design.md) | AI RAG 架構設計 |
| [心靈照護快速開始](spiritual-care-quickstart.md) | 快速啟動指南 |

#### 地理位置
| 文檔 | 說明 |
|------|------|
| [地理位置功能](geolocation-feature.md) | 地理位置追蹤 |
| [地理位置整合指南](geolocation-integration-guide.md) | 整合步驟 |
| [地理位置 Prompt 設計](geo-location-prompt-design.md) | AI Prompt 設計 |

#### PWA
| 文檔 | 說明 |
|------|------|
| [PWA 設定指南](pwa-setup-guide.md) | PWA 功能設定 |

## 📖 閱讀順序建議

### 對於新開發者
1. 閱讀 [專案 README](../README.md) 了解專案概況
2. 查看 [資料庫架構指南](database-schema-guide.md) 理解資料結構
3. 參考 [後端開發指南](backend-guide.md) 開始開發
4. 使用 [測試指南](testing-guide.md) 進行測試

### 對於部署人員
1. 閱讀 [部署指南](deployment-guide.md)
2. 設定 [Firebase](firebase-setup.md) 和 [FCM](FCM_SETUP_GUIDE.md)
3. 參考各功能模組的設定文檔

### 對於維護人員
1. 查看 [資料庫欄位對應表](資料庫欄位對應表.md)
2. 閱讀 [通知服務文檔](NOTIFICATION_SERVICE_DOCUMENTATION.md)
3. 參考 [社交 API 文檔](SOCIAL_API_DOCUMENTATION.md)

## 🔍 快速查詢

### 常見問題

**Q: 如何設定推播通知？**
A: 參考 [FCM 推播通知設定](FCM_SETUP_GUIDE.md)

**Q: 如何添加新的 API 端點？**
A: 參考 [後端開發指南](backend-guide.md)

**Q: 資料庫表格關係？**
A: 查看 [資料庫架構指南](database-schema-guide.md)

**Q: 如何部署到生產環境？**
A: 查看 [部署指南](deployment-guide.md)

**Q: Email/SMS 通知如何設定？**
A: 參考 [通知服務文檔](NOTIFICATION_SERVICE_DOCUMENTATION.md)

## 📝 文檔維護

### 更新文檔
1. 確保文檔保持最新
2. 添加清晰的範例代碼
3. 包含截圖或圖表（如適用）
4. 更新目錄和索引
5. **在文檔開頭添加「📂 相關程式碼檔案」區塊，列出相關的原始碼檔案**

### 文檔規範
- 使用 Markdown 格式
- 包含清晰的標題結構
- 提供實際可用的範例
- 註明最後更新日期
- **每個文檔開頭包含相關程式碼檔案索引**

## 🤝 貢獻

發現文檔錯誤或想要改進？
1. 創建 Issue 描述問題
2. 提交 Pull Request 修正
3. 聯繫維護團隊

## 📞 聯絡方式

如有疑問，請：
- 創建 GitHub Issue
- 聯繫專案維護者

---

## ✨ 最近更新

- **2025-01-21**: 完成家屬監控面板日期篩選功能 ✨ NEW
- **2025-01-21**: 新增日期篩選功能實作報告 (`DATE_FILTER_IMPLEMENTATION.md`)
- **2025-01-21**: 更新家屬監控面板完成度至 90%
- **2025-01-21**: 為所有文檔添加「📂 相關程式碼檔案」區塊，方便快速定位原始碼
- **2025-01-21**: 整理文檔結構，移動過時檔案到 `docs_delete/`
- **2025-01-21**: 建立文檔中心索引，統一文檔導航

---

**最後更新**: 2025-01-21
**維護者**: ElderCare Team
