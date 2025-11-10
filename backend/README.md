# ElderCare Backend - 快速啟動指南

## 🚀 一鍵啟動

```bash
./start.sh
```

這個腳本會自動：
1. ✅ 清理舊的進程
2. ✅ 啟動前端靜態服務器（Port 8080）
3. ✅ 啟動後端 API 服務器（Port 3000）
4. ✅ 顯示所有可用的測試 URL

## 🌐 啟動後可訪問的 URL

### 📱 前端頁面（需登入）
- **登入頁面**: http://localhost:8080/login.html
- **註冊頁面**: http://localhost:8080/register.html
- **主應用**: http://localhost:8080/index.html
- **用藥管理**: http://localhost:8080/medications.html

### 🧪 測試頁面（無需登入）
- **API 測試**: http://localhost:8080/test-api.html
- **用藥設定測試**: http://localhost:8080/test-medication-setup.html

### 🔧 後端 API
- **API 根路徑**: http://localhost:3000/
- **健康檢查**: http://localhost:3000/api/health

## 📝 建議測試流程

1. 開啟瀏覽器訪問 http://localhost:8080/register.html
2. 註冊測試帳號（例如：test@example.com）
3. 完成 onboarding 設定
4. 開始測試各項功能

## 🛑 停止服務器

```bash
./stop.sh
```

或按 `Ctrl+C`

## 📚 詳細文檔

查看 [TESTING.md](./TESTING.md) 獲取完整的測試指南和故障排除方法。
