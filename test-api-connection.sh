#!/bin/bash

# API 連接測試腳本
# 用於診斷 Render 後端部署問題

API_BASE="https://eldercare-api-v4wa.onrender.com"
FRONTEND_URL="https://08-eldercare.vercel.app"

echo "========================================"
echo "ElderCare API 連接測試"
echo "========================================"
echo ""

echo "🔍 測試 1: API 根路徑"
echo "URL: $API_BASE/"
echo "----------------------------------------"
response=$(curl -s -o /dev/null -w "%{http_code}" "$API_BASE/")
echo "HTTP 狀態碼: $response"
if [ "$response" = "200" ]; then
    echo "✅ API 根路徑正常"
    curl -s "$API_BASE/" | head -10
else
    echo "❌ API 根路徑無法訪問"
fi
echo ""

echo "🔍 測試 2: 健康檢查端點"
echo "URL: $API_BASE/api/health"
echo "----------------------------------------"
response=$(curl -s -o /dev/null -w "%{http_code}" "$API_BASE/api/health")
echo "HTTP 狀態碼: $response"
if [ "$response" = "200" ]; then
    echo "✅ 健康檢查端點正常"
    curl -s "$API_BASE/api/health"
else
    echo "❌ 健康檢查端點無法訪問"
fi
echo ""

echo "🔍 測試 3: CORS Preflight 請求"
echo "URL: $API_BASE/api/health"
echo "Origin: $FRONTEND_URL"
echo "----------------------------------------"
curl -s -X OPTIONS \
     -H "Origin: $FRONTEND_URL" \
     -H "Access-Control-Request-Method: GET" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -v "$API_BASE/api/health" 2>&1 | grep -i "access-control"

if [ $? -eq 0 ]; then
    echo "✅ CORS 標頭存在"
else
    echo "❌ CORS 標頭缺失"
fi
echo ""

echo "🔍 測試 4: DNS 解析"
echo "Host: eldercare-api-v4wa.onrender.com"
echo "----------------------------------------"
host eldercare-api-v4wa.onrender.com
echo ""

echo "🔍 測試 5: SSL 憑證"
echo "Host: eldercare-api-v4wa.onrender.com"
echo "----------------------------------------"
echo | openssl s_client -servername eldercare-api-v4wa.onrender.com \
     -connect eldercare-api-v4wa.onrender.com:443 2>/dev/null | \
     openssl x509 -noout -dates
echo ""

echo "========================================"
echo "診斷總結"
echo "========================================"
echo ""

# 檢查所有測試結果
root_status=$(curl -s -o /dev/null -w "%{http_code}" "$API_BASE/")
health_status=$(curl -s -o /dev/null -w "%{http_code}" "$API_BASE/api/health")

if [ "$health_status" = "200" ]; then
    echo "✅ 後端服務正常運行"
    echo ""
    echo "建議下一步："
    echo "1. 清除瀏覽器快取"
    echo "2. 重新整理前端頁面"
    echo "3. 檢查瀏覽器 Console 是否還有錯誤"
elif [ "$root_status" = "200" ] && [ "$health_status" != "200" ]; then
    echo "⚠️ 服務運行但健康檢查失敗"
    echo ""
    echo "可能原因："
    echo "1. 路由配置錯誤"
    echo "2. /api/health 端點未正確設定"
    echo ""
    echo "建議："
    echo "1. 檢查 Render 的 Runtime Logs"
    echo "2. 確認 server.js 中有 /api/health 路由"
elif [ "$root_status" = "404" ]; then
    echo "❌ 服務未運行或已暫停"
    echo ""
    echo "可能原因："
    echo "1. Render Free Plan 服務自動暫停（15分鐘無活動）"
    echo "2. 服務部署失敗"
    echo "3. 服務設定錯誤"
    echo ""
    echo "解決步驟："
    echo "1. 訪問 Render Dashboard: https://dashboard.render.com"
    echo "2. 找到 eldercare-backend 服務"
    echo "3. 檢查服務狀態："
    echo "   - 如果是 'Suspended': 點擊 'Resume'"
    echo "   - 如果是 'Failed': 檢查 Build Logs"
    echo "   - 如果是 'Live': 檢查 Root Directory 設定是否為 'backend'"
    echo "4. 如需要，手動觸發重新部署"
else
    echo "❌ 無法連接到後端服務"
    echo ""
    echo "可能原因："
    echo "1. 網路連接問題"
    echo "2. Render 服務宕機"
    echo "3. DNS 解析失敗"
    echo ""
    echo "建議："
    echo "1. 檢查網路連接"
    echo "2. 訪問 Render 狀態頁面: https://status.render.com"
    echo "3. 等待 5-10 分鐘後重試"
fi

echo ""
echo "========================================"
echo "詳細診斷文檔"
echo "========================================"
echo "請參考: RENDER_DEPLOY_GUIDE.md"
echo ""
