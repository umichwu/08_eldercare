#!/bin/bash

echo "🔄 清理舊的 Node 進程..."
pkill -f "node server.js" 2>/dev/null || true
sleep 1

echo "🚀 啟動 ElderCare 後端服務..."
npm start
