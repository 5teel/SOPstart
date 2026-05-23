/**
 * One-shot brand-icon generator for SOPstart.
 *
 * Renders the paper/ink shield mark to:
 *   - public/icons/icon-192.png      (maskable, 192x192, safe-zone inset)
 *   - public/icons/icon-512.png      (maskable, 512x512, safe-zone inset)
 *   - public/icons/icon-192-any.png  (any, 192x192, tighter)
 *   - public/apple-touch-icon.png    (any, 180x180, tighter)
 *
 * Maskable spec: 80% safe zone — the central 80% of the canvas (radius 40%
 * from center) must contain all critical content; outer 10% padding can
 * be cropped by the host OS. We use ~70% content area for headroom.
 */
import sharp from 'sharp'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const PAPER = '#fafaf7'
const INK = '#18181b'

function shieldSvg({ size, contentScale }) {
  // Canvas is `size`px square. Content area is centered, sized to contentScale.
  // contentScale 0.7 means content occupies ~70% of canvas (safe for maskable).
  const inset = (1 - contentScale) / 2
  // Stroke and font scale with content size, not canvas size.
  const strokeW = Math.max(2, size * contentScale * 0.04)
  const fontSize = size * contentScale * 0.5
  // Shield path expressed in 32x32 design units, then translated/scaled into the
  // safe zone via a transform group.
  const scale = (size * contentScale) / 32
  const translateX = size * inset
  const translateY = size * inset
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${PAPER}"/>
  <g transform="translate(${translateX} ${translateY}) scale(${scale})">
    <path
      d="M16 3 L27 6.5 L27 15 C27 21.5 21.5 27 16 29 C10.5 27 5 21.5 5 15 L5 6.5 Z"
      fill="none"
      stroke="${INK}"
      stroke-width="${strokeW / scale}"
      stroke-linejoin="round"
    />
    <text
      x="16"
      y="21"
      text-anchor="middle"
      font-family="ui-monospace, 'JetBrains Mono', Menlo, monospace"
      font-size="${fontSize / scale}"
      font-weight="700"
      fill="${INK}"
    >S</text>
  </g>
</svg>`
}

async function renderPng(svgString, outPath) {
  const buf = Buffer.from(svgString)
  const png = await sharp(buf).png({ compressionLevel: 9 }).toBuffer()
  await mkdir(dirname(outPath), { recursive: true })
  await writeFile(outPath, png)
  console.log(`  ✓ ${outPath} (${(png.length / 1024).toFixed(1)} KB)`)
}

async function main() {
  console.log('Generating SOPstart brand icons...')

  // Maskable variants — content lives in ~70% safe zone, outer ring is paper.
  await renderPng(
    shieldSvg({ size: 192, contentScale: 0.7 }),
    resolve(ROOT, 'public/icons/icon-192.png'),
  )
  await renderPng(
    shieldSvg({ size: 512, contentScale: 0.7 }),
    resolve(ROOT, 'public/icons/icon-512.png'),
  )

  // 'any' purpose — tighter, no crop concern.
  await renderPng(
    shieldSvg({ size: 192, contentScale: 0.85 }),
    resolve(ROOT, 'public/icons/icon-192-any.png'),
  )

  // Apple touch icon — 180x180, 'any' purpose, tighter.
  await renderPng(
    shieldSvg({ size: 180, contentScale: 0.85 }),
    resolve(ROOT, 'public/apple-touch-icon.png'),
  )

  console.log('Done.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
