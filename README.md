# ElderCare Companion - 長者照護系統

> 完整的文檔請查看 [docs/README_MAIN.md](docs/README_MAIN.md)

## 快速導航

- 📖 **[主要文檔](docs/README_MAIN.md)** - 專案完整說明
- 📚 **[文檔中心](docs/README.md)** - 所有文檔索引
- 🚀 **[部署指南](docs/deployment-guide.md)** - 部署步驟
- 🔧 **[後端指南](docs/backend-guide.md)** - 後端開發
- 🗄️ **[資料庫](database/supabase_complete_schema_with_auth_v4.sql)** - 完整 Schema

## 專案結構

```
eldercare-app/
├── frontend/          # 前端程式碼
├── backend/           # 後端程式碼
├── database/          # 資料庫 Schema
├── docs/              # 所有文檔
└── docs_delete/       # 過時檔案（可刪除）
```

## 快速開始

```bash
# 1. 安裝依賴
cd backend && npm install

# 2. 設定環境變數
cp .env.example .env
# 編輯 .env 填入您的 API keys

# 3. 初始化資料庫
# 在 Supabase 執行: database/supabase_complete_schema_with_auth_v4.sql

# 4. 啟動服務
npm run dev
```

## 線上展示

🌐 **前端**: https://08-eldercare.vercel.app/

---

**詳細文檔請參閱**: [docs/README_MAIN.md](docs/README_MAIN.md)
