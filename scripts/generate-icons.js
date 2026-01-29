/**
 * Icon Generation Script for GyroMaze
 * 
 * This script generates PNG icons at various sizes from the source SVG.
 * 
 * Prerequisites:
 * - Node.js 18+
 * - npm install sharp (optional, for high-quality PNG generation)
 * 
 * Usage:
 * - node scripts/generate-icons.js
 * 
 * Alternative methods:
 * 1. Use an online SVG to PNG converter
 * 2. Use Inkscape CLI: inkscape -w 512 -h 512 icon.svg -o icon-512.png
 * 3. Use ImageMagick: convert -background none icon.svg -resize 512x512 icon-512.png
 */

const fs = require('fs');
const path = require('path');

const ICON_SIZES = [72, 96, 128, 144, 152, 192, 384, 512];
const SOURCE_SVG = path.join(__dirname, '../icons/icon.svg');
const OUTPUT_DIR = path.join(__dirname, '../icons');

async function generateIcons() {
    console.log('🎨 GyroMaze Icon Generator\n');
    
    // Check if sharp is available
    let sharp;
    try {
        sharp = require('sharp');
        console.log('✓ Sharp library found - generating high-quality PNGs\n');
    } catch (e) {
        console.log('⚠ Sharp library not found.');
        console.log('  Install with: npm install sharp');
        console.log('  Or use alternative methods described in this script.\n');
        generatePlaceholders();
        return;
    }
    
    // Read SVG
    if (!fs.existsSync(SOURCE_SVG)) {
        console.error('✗ Source SVG not found:', SOURCE_SVG);
        process.exit(1);
    }
    
    const svgBuffer = fs.readFileSync(SOURCE_SVG);
    
    // Generate each size
    for (const size of ICON_SIZES) {
        const outputPath = path.join(OUTPUT_DIR, `icon-${size}.png`);
        
        try {
            await sharp(svgBuffer)
                .resize(size, size)
                .png()
                .toFile(outputPath);
            
            console.log(`✓ Generated: icon-${size}.png`);
        } catch (err) {
            console.error(`✗ Failed to generate icon-${size}.png:`, err.message);
        }
    }
    
    console.log('\n✅ Icon generation complete!');
}

function generatePlaceholders() {
    console.log('Generating placeholder icon info...\n');
    
    console.log('To generate icons, use one of these methods:\n');
    
    console.log('Method 1: Online converter');
    console.log('  - Visit https://cloudconvert.com/svg-to-png');
    console.log('  - Upload icons/icon.svg');
    console.log('  - Generate at sizes:', ICON_SIZES.join(', '));
    console.log('  - Save as icon-{size}.png\n');
    
    console.log('Method 2: Inkscape CLI');
    ICON_SIZES.forEach(size => {
        console.log(`  inkscape -w ${size} -h ${size} icons/icon.svg -o icons/icon-${size}.png`);
    });
    console.log();
    
    console.log('Method 3: ImageMagick');
    ICON_SIZES.forEach(size => {
        console.log(`  convert -background none icons/icon.svg -resize ${size}x${size} icons/icon-${size}.png`);
    });
    console.log();
    
    console.log('Method 4: Install Sharp and re-run');
    console.log('  npm install sharp');
    console.log('  node scripts/generate-icons.js\n');
    
    // Create a simple HTML file that can render the icons
    const htmlContent = `<!DOCTYPE html>
<html>
<head>
    <title>GyroMaze Icon Preview</title>
    <style>
        body { 
            background: #1a1a2e; 
            color: white; 
            font-family: sans-serif;
            padding: 20px;
        }
        .icon-grid {
            display: flex;
            flex-wrap: wrap;
            gap: 20px;
        }
        .icon-item {
            text-align: center;
        }
        .icon-item img {
            display: block;
            margin-bottom: 8px;
            border: 1px solid #333;
        }
    </style>
</head>
<body>
    <h1>GyroMaze Icon Preview</h1>
    <div class="icon-grid">
        ${ICON_SIZES.map(size => `
        <div class="icon-item">
            <img src="icon.svg" width="${size}" height="${size}" alt="Icon ${size}x${size}">
            <span>${size}x${size}</span>
        </div>
        `).join('')}
    </div>
    <h2>Instructions</h2>
    <p>Right-click each icon and save as PNG, or use the methods described in generate-icons.js</p>
</body>
</html>`;
    
    fs.writeFileSync(path.join(OUTPUT_DIR, 'preview.html'), htmlContent);
    console.log('Created icons/preview.html - open in browser to preview icons\n');
}

// Run
generateIcons().catch(console.error);
