/**
 * Phase 26 Plan 26-12 Task 1 — P12 selection-sync RE-WIRE (behavioural parity).
 *
 * Puck's `componentOverlay` fired `onItemSelected` → `setActiveProvenance` and
 * a reverse `[data-puck-item-id]` lookup for free. This harness proves the
 * bespoke re-wire behaviourally (CLAUDE.md 2026-06-05 — presence tests shipped
 * dead features before):
 *   - forward: `selectBlock` (the exact fn BlockEditShell's focus handler runs)
 *     fires `setActiveProvenance(region, junctionId)`; an inline block clears it.
 *   - forward resolution: `resolveRegion` reads block_provenance off the junction.
 *   - reverse: `resolveComponentIdFromSource` maps a source junction id back to
 *     the canvas componentId ([data-puck-item-id] → [data-block-id] repoint).
 *   - wiring: a selectable shell is focusable + renders the data-block-id reverse
 *     target; a non-convert shell is inert.
 *
 * tsx subprocess (not in-Playwright) for the same reason as the 26-04 harnesses:
 * the phase26 project has no `@/` alias + can't load React/CSS in-process.
 * CLI: npx tsx scripts/selection-sync-check.tsx
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
const {
  selectBlock,
  resolveComponentIdFromSource,
  resolveRegion,
} = require('../src/components/admin/builder-v2/selection-bridge') as typeof import('../src/components/admin/builder-v2/selection-bridge')
const { BlockEditShell } =
  require('../src/components/admin/builder-v2/BlockEditShell') as typeof import('../src/components/admin/builder-v2/BlockEditShell')

const failures: string[] = []
const check = (cond: boolean, msg: string) => {
  if (!cond) failures.push(msg)
}

const region = { kind: 'pdf', page: 1, bbox: [0, 0, 1, 1] } as any
const junctionMap = new Map<string, any>([['junc-1', { id: 'junc-1', block_provenance: region }]])
const componentIdToJunction = new Map<string, any>([['comp-1', { id: 'junc-1' }]])

// ── Forward — selectBlock fires setActiveProvenance(region, junctionId). ───────
{
  const calls: Array<[unknown, unknown]> = []
  const spy = (r: unknown, b?: unknown) => calls.push([r, b])
  selectBlock(spy as any, region, 'junc-1')
  check(
    calls.length === 1 && calls[0][0] === region && calls[0][1] === 'junc-1',
    `selectBlock should fire (region, junctionId); got ${JSON.stringify(calls)}`,
  )
  // Inline-authored block (no junctionId) clears any prior highlight.
  calls.length = 0
  selectBlock(spy as any, region, null)
  check(
    calls.length === 1 && calls[0][0] === null && calls[0][1] === null,
    `inline block should clear highlight (null,null); got ${JSON.stringify(calls)}`,
  )
}

// ── Forward resolution — region read from the junction's block_provenance. ─────
{
  check(resolveRegion(junctionMap as any, 'junc-1') === region, 'resolveRegion should return block_provenance region')
  check(resolveRegion(junctionMap as any, null) === null, 'resolveRegion(null) should be null')
  check(resolveRegion(junctionMap as any, 'missing') === null, 'resolveRegion(unknown junctionId) should be null')
}

// ── Reverse — source junction id → canvas componentId. ─────────────────────────
{
  check(
    resolveComponentIdFromSource(componentIdToJunction as any, 'junc-1') === 'comp-1',
    'reverse: junc-1 should resolve to componentId comp-1',
  )
  check(
    resolveComponentIdFromSource(componentIdToJunction as any, 'nope') === null,
    'reverse: unknown source id should resolve to null',
  )
}

// ── Wiring — selectable shell is focusable + renders the reverse target. ───────
{
  const item = { type: 'TextBlock', props: { id: 'comp-1', content: 'hi', junctionId: 'junc-1' } }
  const markup = renderToStaticMarkup(
    createElement(BlockEditShell as any, {
      item,
      onCommitField: () => {},
      onDuplicate: () => {},
      onDelete: () => {},
      selectable: true,
      junctionId: 'junc-1',
      region,
    }),
  )
  check(markup.includes('data-block-id="comp-1"'), 'shell missing data-block-id reverse target')
  check(markup.includes('tabindex="0"'), 'selectable shell should be focusable (fires selection on focus)')
  check(markup.includes('data-selectable="true"'), 'selectable marker missing')

  const inert = renderToStaticMarkup(
    createElement(BlockEditShell as any, {
      item,
      onCommitField: () => {},
      onDuplicate: () => {},
      onDelete: () => {},
      selectable: false,
    }),
  )
  check(!inert.includes('tabindex="0"'), 'non-convert shell must NOT be focusable')
  check(!inert.includes('data-selectable'), 'non-convert shell must NOT carry the selectable marker')
}

if (failures.length > 0) {
  console.error('SELECTION-SYNC FAILED:')
  for (const f of failures) console.error('  -', f)
  process.exit(1)
}
console.log(
  'SELECTION-SYNC OK — forward fire (region,junctionId)+inline-clear, forward region resolve, reverse id→componentId, shell focusable w/ data-block-id; non-convert inert (P12).',
)
