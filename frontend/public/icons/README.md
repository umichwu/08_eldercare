# PWA 圖示產生指南

## 需要的圖示尺寸

- 72x72
- 96x96
- 128x128
- 144x144
- 152x152
- 192x192
- 384x384
- 512x512

## 🎨 設計建議

### 主題
- 醫療/照護相關
- 使用 🏥 或 ❤️ 圖示
- 顏色: #667eea (主題紫色)

### 風格
- 簡潔明瞭
- 高對比度（方便長輩辨識）
- 圓角設計

## 🛠️ 產生圖示的方法

### 方法 1: 線上工具（推薦）

1. 前往 [PWA Icon Generator](https://www.pwabuilder.com/imageGenerator)
2. 上傳您的 512x512 原始圖示
3. 下載所有尺寸的圖示
4. 解壓縮到此目錄

### 方法 2: 使用 ImageMagick（命令列）

如果您有一張 512x512 的原始圖示 `icon-512x512.png`：

```bash
# 安裝 ImageMagick (如果還沒安裝)
# Windows: choco install imagemagick
# Mac: brew install imagemagick
# Linux: sudo apt-get install imagemagick

# 產生所有尺寸
convert icon-512x512.png -resize 72x72 icon-72x72.png
convert icon-512x512.png -resize 96x96 icon-96x96.png
convert icon-512x512.png -resize 128x128 icon-128x128.png
convert icon-512x512.png -resize 144x144 icon-144x144.png
convert icon-512x512.png -resize 152x152 icon-152x152.png
convert icon-512x512.png -resize 192x192 icon-192x192.png
convert icon-512x512.png -resize 384x384 icon-384x384.png
```

### 方法 3: 使用 Figma/Canva

1. 建立 512x512 的設計
2. 匯出為 PNG
3. 使用線上工具調整尺寸

## 📝 暫時方案

目前可以使用 emoji 作為暫時圖示：

1. 前往 [Emoji to PNG](https://www.emojibase.com/)
2. 選擇 🏥 emoji
3. 下載 512x512
4. 使用線上工具產生其他尺寸

## ✅ 檢查清單

- [ ] 產生所有8種尺寸的圖示
- [ ] 確認圖示是正方形
- [ ] 確認圖示背景是透明或白色
- [ ] 測試在不同設備上的顯示效果
- [ ] 更新 manifest.json 中的圖示路徑（已完成）
