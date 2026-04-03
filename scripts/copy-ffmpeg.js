// scripts/copy-ffmpeg.js
// Cross-platform script to copy FFmpeg WASM binaries from node_modules to public/
// Run manually: node scripts/copy-ffmpeg.js
// Also runs automatically via postinstall hook in package.json
const fs = require('fs')
const path = require('path')

const src = path.join(__dirname, '..', 'node_modules', '@ffmpeg', 'core', 'dist', 'umd')
const dest = path.join(__dirname, '..', 'public', 'ffmpeg')

if (!fs.existsSync(src)) {
  console.log('FFmpeg core not found — install @ffmpeg/core first: npm install @ffmpeg/core')
  process.exit(0) // Non-fatal — dev may not need WASM locally
}

fs.mkdirSync(dest, { recursive: true })

const files = ['ffmpeg-core.js', 'ffmpeg-core.wasm']
for (const file of files) {
  const srcFile = path.join(src, file)
  const destFile = path.join(dest, file)
  if (fs.existsSync(srcFile)) {
    fs.cpSync(srcFile, destFile)
    console.log(`Copied ${file} to public/ffmpeg/`)
  } else {
    console.warn(`Warning: ${file} not found in @ffmpeg/core`)
  }
}
