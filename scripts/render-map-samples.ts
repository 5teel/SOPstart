/**
 * Phase 63 (63-10) -- render the site map for synthetic libraries and the real organisation's
 * shape, whole-site and zoomed, desktop and 390 px, to PNGs for visual review (CLAUDE.md
 * 2026-10-05: geometry and CSS tokens are invisible to assertions -- look at them).
 *
 *   npx tsx scripts/render-map-samples.ts
 *
 * Output: .planning/phases/63-.../map-samples/<sample>-<whole|zoom>-<desktop|phone>.png
 * Samples: 1 area x 1 SOP, 3 x 6, 8 x mixed (1..15, every kind), 12 x 15, and the real org (3 areas).
 */
import fs from 'node:fs'
import path from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import postcss from 'postcss'
import tailwind from '@tailwindcss/postcss'
import { chromium } from '@playwright/test'
import { SiteMap, type MapRow } from '../src/components/home/map/SiteMap'
import { OBJECT_KINDS, type ObjectKind } from '../src/lib/library/object-kind'
import type { LibraryArea } from '../src/lib/library/areas'
import type { RowStatus } from '../src/lib/library/status'

const OUT = path.resolve(__dirname, '..', '.planning/phases/63-sop-first-home-library-site-map-and-the-sopstart-start/map-samples')

const NAMES = ['Forming', 'Engineering', 'Packaging', 'Warehouse', 'Quality assurance', 'Maintenance', 'Dispatch', 'Site-wide', 'Laboratory', 'Cold end', 'Hot end', 'Health and safety']
const TITLES = ['Annealing lehr maintenance', 'Cold-end inspection line', 'Alkaline cleaning tank operation', 'Forklift pre-start check', 'Lockout and tagout', 'Chemical spill response', 'Shift handover', 'Fire evacuation', 'Hot work permit', 'Confined space entry', 'Pallet racking inspection', 'Bench calibration', 'Sample challenge recording', 'Dog bathing and grooming', 'Mould change']
const STATUSES: Array<RowStatus | null> = [
  null,
  { kind: 'signed', text: 'Signed off 2 Oct' },
  { kind: 'stopped', step: 3, total: 9, text: 'You stopped at step 3' },
  { kind: 'waiting', text: 'Waiting for sign-off' },
  { kind: 'updated', text: 'Updated since you last did it' },
]

interface Sample { id: string; org: string; areas: LibraryArea[]; rows: MapRow[] }

function build(id: string, org: string, spec: Array<{ name: string; kinds: ObjectKind[] }>): Sample {
  const areas: LibraryArea[] = []
  const rows: MapRow[] = []
  spec.forEach((s, i) => {
    const aid = `a${i + 1}`
    const sopIds = s.kinds.map((_, j) => `${aid}-s${j + 1}`)
    areas.push({ id: aid, name: s.name, colourVar: `var(--area-${(i % 8) + 1})`, index: i + 1, sopIds })
    s.kinds.forEach((kind, j) => rows.push({ id: sopIds[j], title: TITLES[(i * 5 + j) % TITLES.length], areaId: aid, kind, status: STATUSES[(i + j) % STATUSES.length] }))
  })
  return { id, org, areas, rows }
}

const cycle = (n: number, from = 0): ObjectKind[] => Array.from({ length: n }, (_, i) => OBJECT_KINDS[(i + from) % OBJECT_KINDS.length])

const SAMPLES: Sample[] = [
  build('1-area-1-sop', 'Kauri Springs Bottling', [{ name: 'Site-wide', kinds: ['board'] }]),
  build('3-areas-6-sops', 'Kauri Springs Bottling', [0, 1, 2].map((i) => ({ name: NAMES[i], kinds: cycle(6, i) }))),
  build('8-areas-mixed', 'Kauri Springs Bottling', [1, 3, 6, 9, 15, 2, 4, 7].map((n, i) => ({ name: NAMES[i], kinds: cycle(n, i) }))),
  build('12-areas-15-sops', 'Kauri Springs Bottling', NAMES.map((name, i) => ({ name, kinds: cycle(15, i) }))),
  // the real organisation (63-RESEARCH § 2): Engineering 1 tank, Forming 2 conveyors, General 1 board
  build('real-org-3-areas', 'SOPstart', [
    { name: 'Engineering', kinds: ['tank'] },
    { name: 'Forming', kinds: ['conveyor', 'conveyor'] },
    { name: 'General', kinds: ['board'] },
  ]),
]
// the real org's titles
const real = SAMPLES[4]
;['Alkaline Cleaning Tank Operation', 'OTG Probe Maintenance', 'Automated Sample Challenge Recording', 'Dog Bathing and Grooming'].forEach((t, i) => (real.rows[i].title = t))

const VIEWS = [
  { name: 'desktop', width: 1280, height: 800, pane: 660, scale: 1 },
  { name: 'phone', width: 390, height: 844, pane: 390, scale: 2 },
] as const

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const cssPath = path.resolve(__dirname, '..', 'src/app/globals.css')
  const css = (await postcss([tailwind()]).process(fs.readFileSync(cssPath, 'utf8'), { from: cssPath })).css

  const browser = await chromium.launch()
  let n = 0
  for (const s of SAMPLES) {
    // zoom the busiest area
    const busiest = [...s.areas].sort((a, b) => b.sopIds.length - a.sopIds.length)[0].id
    for (const state of ['whole', 'zoom'] as const) {
      for (const v of VIEWS) {
        const render = (initialSize?: { w: number; h: number }) => {
          const markup = renderToStaticMarkup(
            createElement(SiteMap, { areas: s.areas, rows: s.rows, area: state === 'zoom' ? busiest : null, onArea() {}, onOpenSop() {}, orgName: s.org, initialSize }),
          )
          return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head>
<body data-theme="paper" style="margin:0"><div style="margin-left:auto;width:${v.pane}px;height:${v.height}px;background:var(--paper-1);border-left:1px solid var(--ink-200)">${markup}</div></body></html>`
        }
        const page = await browser.newPage({ viewport: { width: v.width, height: v.height }, deviceScaleFactor: v.scale })
        // pass 1 measures the drawing area, pass 2 sizes the text from it (what the ResizeObserver does in the app)
        await page.setContent(render())
        const box = await page.locator('[data-testid="site-map"]').boundingBox()
        await page.setContent(render(box ? { w: Math.round(box.width), h: Math.round(box.height) } : undefined))
        const file = `${s.id}-${state}-${v.name}.png`
        await page.screenshot({ path: path.join(OUT, file) })
        await page.close()
        n++
        console.log('wrote', file)
      }
    }
  }
  await browser.close()
  console.log(`${n} renders in ${OUT}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
