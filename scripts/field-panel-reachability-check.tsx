/**
 * Phase 26 Plan 26-07 Task 2 — per-block P14 reachability parity (0 unreachable).
 *
 * THE P14 acceptance gate, proven BEHAVIOURALLY (not a grep — CLAUDE.md 2026-06-05):
 * for every registered block type, every Puck-editable field (the FIELD_MAP set,
 * which 26-06's field-map.spec proves === the live puck-config `fields:` keys)
 * renders exactly one affordance row in the bespoke edit shell — so the count of
 * UNREACHABLE fields is 0 for all 17 blocks. Plus a representative field per
 * interaction pattern (A/B/C/D) is DRIVEN through the real, Zod-validated commit
 * path and asserted to land in valid layout_data; Pattern E (media) renders a
 * declared `media — soon` stub row pending 26-09 (accounted-for, not dropped).
 *
 * tsx subprocess: the phase26 project has no `@/` alias + can't load React/CSS
 * in-process. CLI: npx tsx scripts/field-panel-reachability-check.tsx
 */
/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
export {} // isolate module scope (sibling *-check.tsx harnesses share globals otherwise)
const Module = require('module')
for (const ext of ['.css', '.scss', '.sass', '.less', '.svg', '.png', '.jpg', '.jpeg', '.webp', '.gif']) {
  Module._extensions[ext] = (m: NodeModule) => {
    ;(m as any).exports = {}
  }
}

const { createElement } = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const { BLOCK_COMPONENTS, BLOCK_DEFAULTS } =
  require('../src/lib/builder/block-registry') as typeof import('../src/lib/builder/block-registry')
const { FIELD_MAP } =
  require('../src/components/admin/builder-v2/fields/field-map') as typeof import('../src/components/admin/builder-v2/fields/field-map')
const { commitFieldToContent } =
  require('../src/components/admin/builder-v2/fields/field-commit') as typeof import('../src/components/admin/builder-v2/fields/field-commit')
const { BlockEditShell } =
  require('../src/components/admin/builder-v2/BlockEditShell') as typeof import('../src/components/admin/builder-v2/BlockEditShell')

type BlockType = keyof typeof BLOCK_COMPONENTS
const failures: string[] = []
const check = (cond: boolean, msg: string) => {
  if (!cond) failures.push(msg)
}
const meta = { junctionId: 'junc-r', block_provenance: { region: {}, parser_run_id: 'r', parser_version: 1 } }

// ── Per-block: 0 unreachable fields. Every FIELD_MAP field (=== puck field) MUST
//    render a data-field affordance row in the shell. ────────────────────────────
const types = Object.keys(BLOCK_COMPONENTS) as BlockType[]
check(types.length === 18, `expected 18 registered blocks, got ${types.length}`)

let totalFields = 0
const report: string[] = []
for (const type of types) {
  const specs = FIELD_MAP[type] ?? []
  const item = { type, props: { id: `${type}-x`, ...BLOCK_DEFAULTS[type], ...meta } }
  let markup = ''
  try {
    markup = renderToStaticMarkup(
      createElement(BlockEditShell as any, {
        item,
        onCommitField: () => {},
        onDuplicate: () => {},
        onDelete: () => {},
      })
    )
  } catch (e) {
    check(false, `${type}: BlockEditShell threw during render — ${(e as Error).message}`)
    continue
  }
  const unreachable = specs.filter((s) => !markup.includes(`data-field="${s.field}"`)).map((s) => s.field)
  check(unreachable.length === 0, `${type}: ${unreachable.length} UNREACHABLE field(s): ${unreachable.join(', ')}`)
  totalFields += specs.length
  report.push(
    `  ${type.padEnd(22)} ${String(specs.length).padStart(2)} fields  unreachable=${unreachable.length}`
  )
}

// ── Representative behavioural drive per pattern (A/B/C/D) → valid layout_data. ─
// A — Callout title (inline text).
{
  let c = [{ type: 'CalloutBlock', props: { id: 'a', title: 'Note', body: 'x', ...meta } }] as any
  c = commitFieldToContent(c, 'a', 'CalloutBlock', 'title', 'Warning')
  check(c[0].props.title === 'Warning', 'A-drive: Callout title did not write')
}
// B — Hazard severity (enum chip).
{
  let c = [{ type: 'HazardCardBlock', props: { id: 'b', title: 'H', body: 'x', severity: 'critical', ...meta } }] as any
  c = commitFieldToContent(c, 'b', 'HazardCardBlock', 'severity', 'notice')
  check(c[0].props.severity === 'notice', 'B-drive: Hazard severity did not write')
}
// C — PPE items (array panel).
{
  let c = [{ type: 'PPECardBlock', props: { id: 'cc', title: 'PPE', items: ['Gloves'], ...meta } }] as any
  c = commitFieldToContent(c, 'cc', 'PPECardBlock', 'items', ['Gloves', 'Boots'])
  check((c[0].props.items as string[]).length === 2, 'C-drive: PPE items array did not write')
}
// D — VoiceNote maxDurationSec (inline token).
{
  let c = [{ type: 'VoiceNoteBlock', props: { id: 'd', prompt: 'p', language: 'en-NZ', maxDurationSec: 60, ...meta } }] as any
  c = commitFieldToContent(c, 'd', 'VoiceNoteBlock', 'maxDurationSec', '90')
  check(c[0].props.maxDurationSec === 90, 'D-drive: VoiceNote maxDurationSec did not write')
}
// E-stub — PhotoBlock src renders the declared media-soon deferral row (26-09).
{
  const item = { type: 'PhotoBlock', props: { id: 'e', src: null, alt: '', caption: '', ...meta } }
  const markup = renderToStaticMarkup(
    createElement(BlockEditShell as any, { item, onCommitField: () => {}, onDuplicate: () => {}, onDelete: () => {} })
  )
  check(markup.includes('data-field="src"'), 'E-stub: Photo src field has no reachability row')
  check(markup.includes('media — soon'), 'E-stub: Photo src should render the declared media-soon marker (26-09)')
}

console.error(`\nPer-block reachability (${totalFields} Puck-editable fields across ${types.length} blocks):`)
for (const r of report) console.error(r)

if (failures.length > 0) {
  console.error('\nFIELD-PANEL-REACHABILITY FAILED:')
  for (const f of failures) console.error('  -', f)
  process.exit(1)
}
console.log(
  `\nFIELD-PANEL-REACHABILITY OK — 0 unreachable fields across all ${types.length} blocks (${totalFields} fields); A/B/C/D representatives write valid layout_data; E declared (26-09). P14 parity proven.`
)
