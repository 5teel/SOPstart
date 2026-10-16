// Renders the SOP chip + hazard tape (sketch 010 wordmark) into the favicon and PWA icons.
// Run from the repo root after a wordmark change: node scripts/generate-icons.mjs
import { writeFileSync } from 'node:fs'
import { chromium } from 'playwright'
import sharp from 'sharp'
const P = ''
const INK = '#09090b', PAPER = '#fafafa', YELLOW = '#fbbf24'

// round: corner radius as fraction of size (0 = full bleed for maskable / iOS)
// pad: content scale (maskable needs content inside the 80% safe zone)
const html = (s, round, scale) => `<!doctype html><html><head>
<link href="https://fonts.googleapis.com/css2?family=Saira+Semi+Condensed:wght@800&display=block" rel="stylesheet">
<style>html,body{margin:0;background:transparent}
#i{width:${s}px;height:${s}px;background:${INK};border-radius:${round * s}px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:'Saira Semi Condensed';font-weight:800;color:${PAPER}}
#t{font-size:${0.5 * scale * s}px;line-height:.9;letter-spacing:-.01em}
#tape{width:${0.74 * scale * s}px;height:${0.11 * scale * s}px;margin-top:${0.06 * scale * s}px;background:repeating-linear-gradient(-45deg,${YELLOW} 0 ${0.075 * scale * s}px,transparent ${0.075 * scale * s}px ${0.15 * scale * s}px)}
</style></head><body><div id="i"><div id="t">SOP</div><div id="tape"></div></div></body></html>`

const b = await chromium.launch()
const pg = await b.newPage()
async function shot(s, round, scale) {
  await pg.setViewportSize({ width: s, height: s })
  await pg.setContent(html(s, round, scale), { waitUntil: 'networkidle' })
  await pg.evaluate(() => document.fonts.ready)
  if (!(await pg.evaluate(() => document.fonts.check("800 10px 'Saira Semi Condensed'")))) throw new Error('font not loaded')
  return pg.locator('#i').screenshot({ omitBackground: true })
}
// Render big, downscale with sharp for crisp small sizes
const tab = await shot(512, 0.18, 1.12)
const bleed = await shot(512, 0, 1.0)
const mask = await shot(512, 0, 0.8)
await b.close()

const png = (buf, s) => sharp(buf).resize(s, s).png().toBuffer()
writeFileSync(P + 'public/icons/icon-192-any.png', await png(tab, 192))
writeFileSync(P + 'public/icons/icon-192.png', await png(mask, 192))
writeFileSync(P + 'public/icons/icon-512.png', mask)
writeFileSync(P + 'public/apple-touch-icon.png', await png(bleed, 180))

// ICO with PNG payloads (16/32/48)
const sizes = [16, 32, 48], imgs = await Promise.all(sizes.map(s => png(tab, s)))
const head = Buffer.alloc(6 + 16 * sizes.length)
head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(sizes.length, 4)
let off = head.length
sizes.forEach((s, i) => {
  const e = 6 + 16 * i
  head.writeUInt8(s, e); head.writeUInt8(s, e + 1); head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6)
  head.writeUInt32LE(imgs[i].length, e + 8); head.writeUInt32LE(off, e + 12); off += imgs[i].length
})
writeFileSync(P + 'src/app/favicon.ico', Buffer.concat([head, ...imgs]))
console.log('ok')
