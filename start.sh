#!/bin/bash

# ElderCare 啟動腳本
# 自動啟動後端和前端服務

echo "=========================================="
echo "🏥 ElderCare Companion System"
echo "=========================================="
echo ""

# 檢查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 錯誤: 找不到 Node.js"
    echo "   請先安裝 Node.js 18 或更新版本"
    echo "   下載位置: https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js 版本: $(node --version)"

# 檢查 .env 檔案
if [ ! -f .env ]; then
    echo "❌ 錯誤: 找不到 .env 檔案"
    echo "   請先複製 .env.example 為 .env 並填入您的設定"
    echo "   $ cp .env.example .env"
    exit 1
fi

echo "✅ 環境變數檔案存在"

# 檢查後端依賴
if [ ! -d "backend/node_modules" ]; then
    echo "📦 安裝後端依賴..."
    cd backend
    npm install
    cd ..
fi

echo "✅ 後端依賴已安裝"

# 啟動後端
echo ""
echo "🚀 啟動後端服務 (Port 3000)..."
cd backend
node server.js &
BACKEND_PID=$!
cd ..

# 等待後端啟動
echo "⏳ 等待後端啟動..."
sleep 6

# 檢查後端是否成功啟動
if curl -s http://localhost:3000/api/health > /dev/null; then
    echo "✅ 後端服務已啟動"
else
    echo "❌ 後端啟動失敗"
    kill $BACKEND_PID 2>/dev/null
    exit 1
fi

# 啟動前端
echo ""
echo "🚀 啟動前端服務 (Port 8080)..."
cd frontend/public

# 偵測可用的 HTTP 伺服器
if command -v python3 &> /dev/null; then
    echo "   使用 Python HTTP Server"
    python3 -m http.server 8080 &
    FRONTEND_PID=$!
elif command -v npx &> /dev/null; then
    echo "   使用 npx serve"
    npx serve -p 8080 &
    FRONTEND_PID=$!
else
    echo "❌ 錯誤: 找不到可用的 HTTP 伺服器"
    echo "   請安裝 Python 3 或 Node.js"
    kill $BACKEND_PID 2>/dev/null
    exit 1
fi

cd ../..

# 等待前端啟動
sleep 2

echo ""
echo "=========================================="
echo "✅ 所有服務已啟動！"
echo "=========================================="
echo ""
echo "📡 後端 API:  http://localhost:3000"
echo "🌐 前端頁面:  http://localhost:8080"
echo ""
echo "按 Ctrl+C 停止所有服務"
echo "=========================================="
echo ""

# 嘗試自動開啟瀏覽器
if command -v xdg-open &> /dev/null; then
    xdg-open http://localhost:8080
elif command -v open &> /dev/null; then
    open http://localhost:8080
fi

# 等待使用者中斷
trap "echo ''; echo '🛑 正在停止服務...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo '✅ 已停止'; exit 0" INT

# 保持腳本執行
wait
