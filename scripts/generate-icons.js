const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#3b82f6"/>
      <stop offset="100%" style="stop-color:#1d4ed8"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="96" fill="url(#bg)"/>
  <g fill="white">
    <path d="M384 272c0-44.2-35.8-80-80-80-8.8 0-17.3 1.4-25.2 4.1C268.4 156.5 230.8 128 186.7 128 128.5 128 80 176.5 80 234.7c0 5.5.4 10.9 1.2 16.2C52.5 260.8 32 288.5 32 320c0 44.2 35.8 80 80 80h272c44.2 0 80-35.8 80-80 0-27.3-13.7-51.4-34.6-65.8.4-4.1.6-8.2.6-12.2z" transform="translate(48, 48) scale(0.75)"/>
    <path d="M256 192l-64 64h48v96h32v-96h48l-64-64z" transform="translate(0, 48)"/>
  </g>
</svg>`;

const sizes = [192, 512];
const outputDir = path.join(__dirname, '..', 'public', 'icons');

async function generateIcons() {
  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  for (const size of sizes) {
    const outputPath = path.join(outputDir, `icon-${size}x${size}.png`);

    await sharp(Buffer.from(svgIcon))
      .resize(size, size)
      .png()
      .toFile(outputPath);

    console.log(`Generated: ${outputPath}`);
  }

  // Also generate apple-touch-icon (180x180)
  await sharp(Buffer.from(svgIcon))
    .resize(180, 180)
    .png()
    .toFile(path.join(outputDir, 'apple-touch-icon.png'));

  console.log('Generated: apple-touch-icon.png');
  console.log('Done!');
}

generateIcons().catch(console.error);
