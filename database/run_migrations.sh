#!/bin/bash

# ============================================================================
# 執行資料庫 Migration 腳本
# ============================================================================

echo "正在執行資料庫 migration..."

# 設定顏色
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 檢查是否有 .env 檔案
if [ ! -f "../.env" ]; then
    echo -e "${RED}錯誤: 找不到 .env 檔案${NC}"
    echo "請先複製 .env.example 並設定正確的 Supabase 連線資訊"
    exit 1
fi

# 讀取 .env 檔案
source ../.env

# 檢查必要的環境變數
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_KEY" ]; then
    echo -e "${RED}錯誤: SUPABASE_URL 或 SUPABASE_SERVICE_KEY 未設定${NC}"
    exit 1
fi

# 取得 Supabase Project Reference
PROJECT_REF=$(echo $SUPABASE_URL | sed -n 's/.*https:\/\/\([^.]*\).*/\1/p')

echo -e "${YELLOW}Project Reference: $PROJECT_REF${NC}"
echo ""

# 執行 migration 檔案
MIGRATIONS=(
    "001_fix_summary_fields.sql"
    "002_add_single_conversation_summary.sql"
)

for migration in "${MIGRATIONS[@]}"
do
    echo -e "${YELLOW}執行: $migration${NC}"

    # 使用 psql 或 Supabase CLI 執行（這裡提供兩種方式）

    # 方式 1: 如果你有安裝 Supabase CLI
    # supabase db execute -f "migrations/$migration"

    # 方式 2: 直接使用 curl 呼叫 Supabase REST API
    # 注意：這需要有資料庫直接連線權限

    echo -e "${GREEN}✓ $migration 已準備好${NC}"
    echo "請手動在 Supabase Dashboard 的 SQL Editor 中執行此檔案"
    echo ""
done

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}所有 migration 檔案已準備完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "請按照以下步驟執行："
echo "1. 前往 Supabase Dashboard: ${SUPABASE_URL/https:\/\//https://supabase.com/dashboard/project/}"
echo "2. 點擊左側選單的 'SQL Editor'"
echo "3. 依序執行以下檔案："
for migration in "${MIGRATIONS[@]}"
do
    echo "   - database/migrations/$migration"
done
echo ""
echo "或者，如果你有安裝 Supabase CLI，可以執行："
echo "   cd database/migrations"
echo "   supabase db execute -f 001_fix_summary_fields.sql"
echo "   supabase db execute -f 002_add_single_conversation_summary.sql"
