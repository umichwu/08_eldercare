/**
 * Generate PWA Icons from SVG
 * 從 SVG 生成所有需要的 PNG 尺寸
 */

const fs = require('fs');
const { createCanvas, loadImage } = require('canvas');

// 需要生成的尺寸
const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];

// SVG 源文件
const SVG_SOURCE = './icon-source.svg';

// 使用 Canvas 生成 PNG（不需要額外依賴）
async function generatePNGFromSVG() {
  console.log('🎨 開始生成 PWA Icons...\n');

  // 讀取 SVG
  const svgContent = fs.readFileSync(SVG_SOURCE, 'utf8');

  for (const size of SIZES) {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');

    // 繪製背景色
    ctx.fillStyle = '#667eea';
    ctx.fillRect(0, 0, size, size);

    // 繪製圓角矩形背景
    const radius = size * 0.15625; // 80/512
    ctx.beginPath();
    ctx.moveTo(radius, 0);
    ctx.lineTo(size - radius, 0);
    ctx.quadraticCurveTo(size, 0, size, radius);
    ctx.lineTo(size, size - radius);
    ctx.quadraticCurveTo(size, size, size - radius, size);
    ctx.lineTo(radius, size);
    ctx.quadraticCurveTo(0, size, 0, size - radius);
    ctx.lineTo(0, radius);
    ctx.quadraticCurveTo(0, 0, radius, 0);
    ctx.closePath();
    ctx.fillStyle = '#667eea';
    ctx.fill();

    // 繪製十字（白色）
    ctx.fillStyle = '#ffffff';
    const crossWidth = size * 0.15625; // 80/512
    const crossHeight = size * 0.53125; // 272/512
    const crossX = (size - crossWidth) / 2;
    const crossY = size * 0.234375; // 120/512

    // 垂直線
    ctx.fillRect(crossX, crossY, crossWidth, crossHeight);
    // 水平線
    ctx.fillRect(crossY, crossX, crossHeight, crossWidth);

    // 繪製愛心（粉紅色）
    const heartY = size * 0.664; // 340/512
    ctx.fillStyle = '#ff6b9d';
    ctx.globalAlpha = 0.9;

    // 簡化的愛心
    const heartSize = size * 0.109375; // 56/512
    const heartX = size * 0.390625; // 200/512

    ctx.beginPath();
    ctx.arc(heartX, heartY, heartSize * 0.5, 0, Math.PI * 2);
    ctx.arc(heartX + heartSize * 0.5, heartY, heartSize * 0.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(heartX - heartSize * 0.5, heartY);
    ctx.quadraticCurveTo(heartX - heartSize * 0.5, heartY + heartSize, heartX + heartSize * 0.25, heartY + heartSize * 1.3);
    ctx.quadraticCurveTo(heartX + heartSize, heartY + heartSize, heartX + heartSize, heartY);
    ctx.fill();

    // 繪製微笑（白色半透明）
    ctx.globalAlpha = 0.7;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = size * 0.0234375; // 12/512
    ctx.lineCap = 'round';

    ctx.beginPath();
    const smileY = size * 0.859375; // 440/512
    const smileX1 = size * 0.3515625; // 180/512
    const smileX2 = size * 0.6484375; // 332/512
    ctx.moveTo(smileX1, smileY);
    ctx.quadraticCurveTo(size * 0.5, smileY + size * 0.0585938, smileX2, smileY);
    ctx.stroke();

    // 儲存為 PNG
    const buffer = canvas.toBuffer('image/png');
    const filename = `icon-${size}x${size}.png`;
    fs.writeFileSync(filename, buffer);

    console.log(`✅ 已生成: ${filename}`);
  }

  console.log('\n🎉 所有 Icons 生成完成！');
}

// 如果 canvas 套件不可用，使用簡單的單色 icon
function generateSimpleIcons() {
  console.log('⚠️  canvas 套件未安裝，生成簡單版 Icons...\n');

  // 這裡我們改用 HTML Canvas 的方式
  // 創建一個 HTML 檔案來生成
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Icon Generator</title>
</head>
<body>
    <h2>PWA Icon Generator</h2>
    <p>正在生成 Icons...</p>
    <canvas id="canvas"></canvas>
    <div id="downloads"></div>

    <script>
        const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
        const canvas = document.getElementById('canvas');
        const ctx = canvas.getContext('2d');
        const downloads = document.getElementById('downloads');

        sizes.forEach(size => {
            canvas.width = size;
            canvas.height = size;

            // 背景
            ctx.fillStyle = '#667eea';
            ctx.fillRect(0, 0, size, size);

            // 圓角
            const radius = size * 0.15625;
            ctx.beginPath();
            ctx.moveTo(radius, 0);
            ctx.arcTo(size, 0, size, size, radius);
            ctx.arcTo(size, size, 0, size, radius);
            ctx.arcTo(0, size, 0, 0, radius);
            ctx.arcTo(0, 0, size, 0, radius);
            ctx.closePath();
            ctx.fillStyle = '#667eea';
            ctx.fill();

            // 十字
            ctx.fillStyle = '#ffffff';
            const crossWidth = size * 0.15625;
            const crossHeight = size * 0.53125;
            const crossX = (size - crossWidth) / 2;
            const crossY = size * 0.234375;

            ctx.fillRect(crossX, crossY, crossWidth, crossHeight);
            ctx.fillRect(crossY, crossX, crossHeight, crossWidth);

            // 愛心
            const heartY = size * 0.664;
            ctx.fillStyle = '#ff6b9d';
            ctx.globalAlpha = 0.9;
            const heartSize = size * 0.109375;
            const heartX = size * 0.390625;

            ctx.beginPath();
            ctx.arc(heartX, heartY, heartSize * 0.5, 0, Math.PI * 2);
            ctx.arc(heartX + heartSize * 0.5, heartY, heartSize * 0.5, 0, Math.PI * 2);
            ctx.fill();

            ctx.beginPath();
            ctx.moveTo(heartX - heartSize * 0.5, heartY);
            ctx.quadraticCurveTo(heartX - heartSize * 0.5, heartY + heartSize, heartX + heartSize * 0.25, heartY + heartSize * 1.3);
            ctx.quadraticCurveTo(heartX + heartSize, heartY + heartSize, heartX + heartSize, heartY);
            ctx.fill();

            // 微笑
            ctx.globalAlpha = 0.7;
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = size * 0.0234375;
            ctx.lineCap = 'round';

            ctx.beginPath();
            const smileY = size * 0.859375;
            const smileX1 = size * 0.3515625;
            const smileX2 = size * 0.6484375;
            ctx.moveTo(smileX1, smileY);
            ctx.quadraticCurveTo(size * 0.5, smileY + size * 0.0585938, smileX2, smileY);
            ctx.stroke();

            // 創建下載連結
            canvas.toBlob(blob => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = \`icon-\${size}x\${size}.png\`;
                a.textContent = \`下載 \${size}x\${size}\`;
                a.style.display = 'block';
                a.style.margin = '5px';
                downloads.appendChild(a);

                // 自動點擊下載
                setTimeout(() => a.click(), 100 * sizes.indexOf(size));
            });
        });

        setTimeout(() => {
            document.querySelector('p').textContent = '✅ 所有 Icons 已生成！請點擊下方連結下載。';
        }, 1000);
    </script>
</body>
</html>
  `;

  fs.writeFileSync('icon-generator.html', htmlContent);
  console.log('✅ 已生成 icon-generator.html');
  console.log('📝 請用瀏覽器開啟此檔案，然後下載所有 icons');
  console.log('\n使用方式：');
  console.log('1. 在瀏覽器開啟 icon-generator.html');
  console.log('2. Icons 會自動下載');
  console.log('3. 將下載的檔案移到 icons/ 資料夾\n');
}

// 執行
try {
  require('canvas');
  generatePNGFromSVG();
} catch (e) {
  generateSimpleIcons();
}
