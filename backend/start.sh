#!/bin/bash

echo "======================================================================"
echo "🏥 ElderCare 長輩陪伴系統 - 啟動腳本"
echo "======================================================================"
echo ""

# 1. 清理舊進程
echo "🔄 步驟 1/3: 清理舊的 Node 進程..."
pkill -f "node server.js" 2>/dev/null || true
pkill -f "python3 -m http.server 8080" 2>/dev/null || true
sleep 1
echo "✅ 清理完成"
echo ""

# 2. 啟動前端靜態服務器（背景執行）
echo "🌐 步驟 2/3: 啟動前端靜態服務器（Port 8080）..."
cd ../frontend/public
python3 -m http.server 8080 > /dev/null 2>&1 &
FRONTEND_PID=$!
echo "✅ 前端服務器已啟動 (PID: $FRONTEND_PID)"
echo ""

# 3. 啟動後端 API 服務器
echo "🚀 步驟 3/3: 啟動後端 API 服務器（Port 3000）..."
cd ../../backend
npm start &
BACKEND_PID=$!

# 等待服務器啟動
sleep 3

echo ""
echo "======================================================================"
echo "✅ ElderCare 系統啟動完成！"
echo "======================================================================"
echo ""
echo "📋 進程 ID:"
echo "   前端服務器 PID: $FRONTEND_PID"
echo "   後端服務器 PID: $BACKEND_PID"
echo ""
echo "🌐 可用的測試 URL:"
echo "======================================================================"
echo ""
echo "【主要應用】"
echo "   登入頁面:     http://localhost:8080/login.html"
echo "   註冊頁面:     http://localhost:8080/register.html"
echo "   主應用:       http://localhost:8080/index.html"
echo "   (需要先登入才能訪問)"
echo ""
echo "【功能頁面】"
echo "   用藥管理:     http://localhost:8080/medications.html"
echo "   家屬監控:     http://localhost:8080/family-dashboard.html"
echo ""
echo "【測試頁面】"
echo "   API 測試:     http://localhost:8080/test-api.html"
echo "   用藥設定測試: http://localhost:8080/test-medication-setup.html"
echo "   簡單測試:     http://localhost:8080/test-simple.html"
echo ""
echo "【後端 API】"
echo "   API 根路徑:   http://localhost:3000/"
echo "   健康檢查:     http://localhost:3000/api/health"
echo ""
echo "======================================================================"
echo "💡 建議測試流程:"
echo "======================================================================"
echo ""
echo "1️⃣  開啟瀏覽器訪問: http://localhost:8080/register.html"
echo "   → 使用 Email 註冊測試帳號（例如：test@example.com）"
echo ""
echo "2️⃣  完成註冊後會自動導向 onboarding 頁面，完成初始設定"
echo ""
echo "3️⃣  設定完成後會自動導向主應用 (index.html)"
echo ""
echo "4️⃣  測試用藥管理功能: http://localhost:8080/medications.html"
echo ""
echo "5️⃣  測試 API: http://localhost:3000/api/health"
echo ""
echo "======================================================================"
echo "🛑 停止服務器:"
echo "======================================================================"
echo ""
echo "   方法 1: 按 Ctrl+C（會同時停止前後端）"
echo ""
echo "   方法 2: 手動停止"
echo "      kill $FRONTEND_PID $BACKEND_PID"
echo ""
echo "   方法 3: 使用停止腳本（如果存在）"
echo "      ./stop.sh"
echo ""
echo "======================================================================"
echo "📝 測試帳號資訊（建議）:"
echo "======================================================================"
echo ""
echo "   Email:    test@example.com"
echo "   密碼:     test123456"
echo "   角色:     elder（長輩）或 family_member（家屬）"
echo ""
echo "======================================================================"
echo ""

# 等待後端進程
wait $BACKEND_PID
