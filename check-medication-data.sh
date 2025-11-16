#!/bin/bash

SUPABASE_URL="https://oatdjdelzybcacwqafkk.supabase.co"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9hdGRqZGVsenliY2Fjd3FhZmtrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyMDM5ODUsImV4cCI6MjA3Njc3OTk4NX0.Flk-9yHREG7gWr1etG-TEc2ufPjP-zvW2Ejd2gCqG4w"

echo "🔍 檢查用藥資料..."
echo ""

echo "📋 步驟 1: 查詢所有藥物（最近 10 個）"
echo "----------------------------------------"
curl -s "${SUPABASE_URL}/rest/v1/medications?select=*&order=created_at.desc&limit=10" \
  -H "apikey: ${ANON_KEY}" \
  -H "Authorization: Bearer ${ANON_KEY}"
echo ""
echo ""

echo "📋 步驟 2: 查詢所有用藥提醒（medication_reminders）"
echo "----------------------------------------"
curl -s "${SUPABASE_URL}/rest/v1/medication_reminders?select=*,medications(medication_name)" \
  -H "apikey: ${ANON_KEY}" \
  -H "Authorization: Bearer ${ANON_KEY}"
echo ""
echo ""

echo "📋 步驟 3: 查詢今日的用藥記錄（medication_logs）"
echo "----------------------------------------"
TODAY=$(date -u +"%Y-%m-%d")
curl -s "${SUPABASE_URL}/rest/v1/medication_logs?select=*,medications(medication_name)&scheduled_time=gte.${TODAY}T00:00:00Z&scheduled_time=lt.${TODAY}T23:59:59Z" \
  -H "apikey: ${ANON_KEY}" \
  -H "Authorization: Bearer ${ANON_KEY}"
echo ""
echo ""

echo "✅ 檢查完成"
