#!/bin/bash

# ElderCare App - 重建 Android 應用程式
# 此腳本會同步前端程式碼到 Android 專案並重建 APK

echo "📱 開始重建 ElderCare Android App..."
echo ""

# 1. 進入前端目錄
cd frontend

# 2. 同步前端程式碼到 Android 專案
echo "🔄 同步前端程式碼到 Android..."
npx cap sync android

# 3. 開啟 Android Studio (選用)
echo ""
echo "✅ 同步完成！"
echo ""
echo "接下來請執行以下其中一個選項："
echo ""
echo "選項 1：使用 Android Studio (建議)"
echo "  npx cap open android"
echo "  然後在 Android Studio 中點擊 Build > Build Bundle(s) / APK(s) > Build APK(s)"
echo ""
echo "選項 2：使用命令列建置"
echo "  cd android"
echo "  ./gradlew assembleDebug"
echo "  建置完成後，APK 會在 android/app/build/outputs/apk/debug/"
echo ""
