#!/bin/bash

echo "🔍 測試 Render 後端生成今日用藥記錄..."
echo ""

# Render 後端 URL
BACKEND_URL="https://eldercare-backend-8o4k.onrender.com"

echo "📡 呼叫 API: POST ${BACKEND_URL}/api/scheduler/generate-today-logs"
echo ""

# 呼叫 API（不需要 elderId，API 會生成所有活躍用戶的記錄）
response=$(curl -s -X POST \
  "${BACKEND_URL}/api/scheduler/generate-today-logs" \
  -H "Content-Type: application/json" \
  -d '{}')

echo "📋 回應:"
echo "$response" | jq . 2>/dev/null || echo "$response"
echo ""

echo "✅ 完成！請重新載入網頁，檢查「今日用藥」分頁"
