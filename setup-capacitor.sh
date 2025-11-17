#!/bin/bash

# ElderCare App - Capacitor 自動化設定腳本
# 用途：快速將 Web App 轉換為原生 Android App

set -e  # 遇到錯誤立即停止

echo "========================================="
echo "📱 ElderCare App - Capacitor 設定"
echo "========================================="
echo ""

# 顏色定義
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 檢查 Node.js 和 npm
echo -e "${BLUE}[1/10]${NC} 檢查環境..."
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ 未安裝 Node.js，請先安裝${NC}"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ 未安裝 npm，請先安裝${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Node.js $(node -v)${NC}"
echo -e "${GREEN}✅ npm $(npm -v)${NC}"
echo ""

# 切換到 frontend 目錄
echo -e "${BLUE}[2/10]${NC} 切換到 frontend 目錄..."
cd frontend || {
    echo -e "${RED}❌ 找不到 frontend 目錄${NC}"
    exit 1
}
echo -e "${GREEN}✅ 已進入 $(pwd)${NC}"
echo ""

# 初始化 package.json（如果不存在）
if [ ! -f "package.json" ]; then
    echo -e "${BLUE}[3/10]${NC} 初始化 package.json..."
    npm init -y
    echo -e "${GREEN}✅ package.json 已建立${NC}"
else
    echo -e "${BLUE}[3/10]${NC} package.json 已存在"
    echo -e "${GREEN}✅ 跳過初始化${NC}"
fi
echo ""

# 安裝 Capacitor
echo -e "${BLUE}[4/10]${NC} 安裝 Capacitor..."
echo -e "${YELLOW}這可能需要幾分鐘...${NC}"
npm install @capacitor/core @capacitor/cli
echo -e "${GREEN}✅ Capacitor 已安裝${NC}"
echo ""

# 初始化 Capacitor
echo -e "${BLUE}[5/10]${NC} 初始化 Capacitor 配置..."
if [ ! -f "capacitor.config.json" ]; then
    npx cap init eldercare-app com.eldercare.app --web-dir=public
    echo -e "${GREEN}✅ Capacitor 已初始化${NC}"
else
    echo -e "${YELLOW}⚠️ capacitor.config.json 已存在，跳過${NC}"
fi
echo ""

# 安裝 Android 平台
echo -e "${BLUE}[6/10]${NC} 安裝 Android 平台..."
npm install @capacitor/android
echo -e "${GREEN}✅ Android 平台已安裝${NC}"
echo ""

# 添加 Android 平台
echo -e "${BLUE}[7/10]${NC} 添加 Android 專案..."
if [ ! -d "../android" ]; then
    npx cap add android
    echo -e "${GREEN}✅ Android 專案已建立${NC}"
else
    echo -e "${YELLOW}⚠️ Android 目錄已存在，跳過${NC}"
fi
echo ""

# 建立自定義鬧鐘插件目錄
echo -e "${BLUE}[8/10]${NC} 建立鬧鐘插件目錄..."
PLUGIN_DIR="../android/app/src/main/java/com/eldercare/plugins"
mkdir -p "$PLUGIN_DIR"
echo -e "${GREEN}✅ 插件目錄已建立: $PLUGIN_DIR${NC}"
echo ""

# 創建 AlarmPlugin.kt
echo -e "${BLUE}[9/10]${NC} 建立 AlarmPlugin.kt..."
cat > "$PLUGIN_DIR/AlarmPlugin.kt" << 'EOF'
package com.eldercare.plugins

import android.content.Intent
import android.provider.AlarmClock
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "AlarmPlugin")
class AlarmPlugin : Plugin() {

    @PluginMethod
    fun setAlarm(call: PluginCall) {
        val hour = call.getInt("hour")
        val minute = call.getInt("minute")
        val message = call.getString("message", "用藥提醒")
        val skipUi = call.getBoolean("skipUi", false)

        if (hour == null || minute == null) {
            call.reject("Hour and minute are required")
            return
        }

        val intent = Intent(AlarmClock.ACTION_SET_ALARM).apply {
            putExtra(AlarmClock.EXTRA_HOUR, hour)
            putExtra(AlarmClock.EXTRA_MINUTES, minute)
            putExtra(AlarmClock.EXTRA_MESSAGE, message)
            putExtra(AlarmClock.EXTRA_SKIP_UI, skipUi)
        }

        try {
            activity.startActivity(intent)
            call.resolve()
        } catch (e: Exception) {
            call.reject("Failed to set alarm: ${e.message}")
        }
    }
}
EOF
echo -e "${GREEN}✅ AlarmPlugin.kt 已建立${NC}"
echo ""

# 同步代碼到原生專案
echo -e "${BLUE}[10/10]${NC} 同步代碼到 Android 專案..."
npx cap sync
echo -e "${GREEN}✅ 代碼已同步${NC}"
echo ""

# 完成
echo "========================================="
echo -e "${GREEN}🎉 設定完成！${NC}"
echo "========================================="
echo ""
echo "下一步："
echo ""
echo "1️⃣  註冊插件到 MainActivity："
echo "   編輯檔案："
echo "   android/app/src/main/java/com/eldercare/app/MainActivity.kt"
echo ""
echo "   加入以下代碼："
echo "   ${YELLOW}import com.eldercare.plugins.AlarmPlugin${NC}"
echo "   ${YELLOW}registerPlugin(AlarmPlugin::class.java)${NC}"
echo ""
echo "2️⃣  修改 medications.js："
echo "   參考 medications-capacitor.js 的內容"
echo "   或直接用它取代現有的 medications.js"
echo ""
echo "3️⃣  在 Android Studio 中開啟專案："
echo "   ${BLUE}npx cap open android${NC}"
echo ""
echo "4️⃣  連接 Android 裝置或啟動模擬器"
echo ""
echo "5️⃣  點擊 Run (綠色播放按鈕) 測試"
echo ""
echo "========================================="
