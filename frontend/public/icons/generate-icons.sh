#!/bin/bash

# PWA Icon Generator Script
# This script generates all required icon sizes from a source 512x512 image

# Check if ImageMagick is installed
if ! command -v convert &> /dev/null; then
    echo "❌ ImageMagick not found!"
    echo "Please install ImageMagick:"
    echo "  Windows (WSL): sudo apt-get install imagemagick"
    echo "  Mac: brew install imagemagick"
    echo "  Linux: sudo apt-get install imagemagick"
    exit 1
fi

# Check if source file exists
SOURCE="icon-512x512.png"
if [ ! -f "$SOURCE" ]; then
    echo "❌ Source file '$SOURCE' not found!"
    echo "Please place a 512x512 PNG image named '$SOURCE' in this directory first."
    exit 1
fi

echo "🎨 Generating PWA icons from $SOURCE..."

# Array of required sizes
sizes=(72 96 128 144 152 192 384 512)

# Generate each size
for size in "${sizes[@]}"; do
    output="icon-${size}x${size}.png"
    echo "  Creating ${output}..."
    convert "$SOURCE" -resize ${size}x${size} "$output"

    if [ $? -eq 0 ]; then
        echo "  ✅ ${output} created successfully"
    else
        echo "  ❌ Failed to create ${output}"
    fi
done

echo ""
echo "✨ Icon generation complete!"
echo "Generated icons:"
ls -lh icon-*.png

echo ""
echo "📱 Next steps:"
echo "1. Verify all 8 icon sizes are present"
echo "2. Check icons look good at different sizes"
echo "3. The manifest.json is already configured to use these icons"
echo "4. Run 'npm run dev' to test the PWA"
