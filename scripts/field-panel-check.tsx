/**
 * Phase 26 Plan 26-07 Task 1 — Pattern C field-panel behavioural harness (P14).
 *
 * Proves the anchored FieldPanel + ArrayFieldEditor EDIT + PERSIST array/config
 * fields through the SAME Zod-validated, lossless commit path (commitFieldToContent
 * → updateBlockProps) that the inline A/B/D controls use — AND that the panel
 * actually MOUNTS the array editor + add affordance, and BlockEditShell mounts the
 * ⚙ edit-fields trigger (guards the 2026-06-05 dead-feature trap: a passing commit
 * fn is worthless if no control calls it).
 *
 * tsx subprocess (not in-Playwright): the phase26 project has no `@/` alias + can't
 * load React/CSS in-process (same pattern as scripts/field-patterns-check.tsx).
 * CLI: npx tsx scripts/field-panel-check.tsx
 *
 * NOTE: shell renders pass `editing: true`. Field editors live in EDIT mode only.
 * Read mode renders the worker block and NO field strip — the strip used to be
 * mounted always at opacity-0 beneath the body, which restated the block's own
 * content as a column of inputs and consumed layout height on every card. So
 * reachability is asserted in the mode that owns the fields; the read-mode
 * negative (no duplicate inputs) is asserted in field-patterns-check.tsx.
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
const { commitFieldToContent, isFieldValueValid } =
  require('../src/components/admin/builder-v2/fields/field-commit') as typeof import('../src/components/admin/builder-v2/fields/field-commit')
const { FieldPanel } =
  require('../src/components/admin/builder-v2/fields/FieldPanel') as typeof import('../src/components/admin/builder-v2/fields/FieldPanel')
const { BlockEditShell } =
  require('../src/components/admin/builder-v2/BlockEditShell') as typeof import('../src/components/admin/builder-v2/BlockEditShell')

type Item = { type: string; props: Record<string, unknown> & { id: string } }
const failures: string[] = []
const check = (cond: boolean, msg: string) => {
  if (!cond) failures.push(msg)
}

const meta = {
  junctionId: 'junc-c',
  block_provenance: { region: { page: 2 }, parser_run_id: 'run-c', parser_version: 1 },
}

// ── PPECard items[] (string-array): add row persists; empty item rejected. ─────
{
  let c: Item[] = [{ type: 'PPECardBlock', props: { id: 'p', title: 'PPE', items: ['Gloves'], ...meta } }]
  c = commitFieldToContent(c as any, 'p', 'PPECardBlock', 'items', ['Gloves', 'Goggles']) as any
  check(Array.isArray(c[0].props.items) && (c[0].props.items as string[]).length === 2, 'PPE add row did not persist 2 items')
  check((c[0].props.items as string[])[1] === 'Goggles', 'PPE new item value not written')
  // Empty item violates z.string().min(1) → whole array rejected, prior kept.
  c = commitFieldToContent(c as any, 'p', 'PPECardBlock', 'items', ['Gloves', '']) as any
  check((c[0].props.items as string[]).length === 2 && (c[0].props.items as string[])[1] === 'Goggles', 'empty PPE item should keep prior array')
  check(c[0].props.junctionId === 'junc-c', 'junctionId dropped on PPE array commit')
  check(Boolean(c[0].props.block_provenance), 'block_provenance dropped on PPE array commit')
}

// ── Decision options[] (object-array): edit label + reorder persist; <2 blocked;
//    unknown row key (nextStepId) preserved losslessly. ─────────────────────────
{
  const opts = [
    { label: 'Yes', nextStepId: '11111111-1111-4111-8111-111111111111' },
    { label: 'No', isEscalation: true },
  ]
  let c: Item[] = [{ type: 'DecisionBlock', props: { id: 'd', question: 'Guard in place?', options: opts, ...meta } }]
  // Edit first option's label — nextStepId must survive (spread-merge row).
  const edited = [{ ...opts[0], label: 'Yes — continue' }, opts[1]]
  c = commitFieldToContent(c as any, 'd', 'DecisionBlock', 'options', edited) as any
  const got = c[0].props.options as any[]
  check(got[0].label === 'Yes — continue', 'Decision label edit did not persist')
  check(got[0].nextStepId === '11111111-1111-4111-8111-111111111111', 'Decision nextStepId dropped on label edit (lossless row-merge failed)')
  // Reorder persists order.
  c = commitFieldToContent(c as any, 'd', 'DecisionBlock', 'options', [edited[1], edited[0]]) as any
  check((c[0].props.options as any[])[0].label === 'No', 'Decision reorder did not persist order')
  // Removing below Zod min(2) → rejected, prior 2-option array kept.
  const before = (c[0].props.options as any[]).length
  c = commitFieldToContent(c as any, 'd', 'DecisionBlock', 'options', [edited[0]]) as any
  check((c[0].props.options as any[]).length === before && before === 2, 'removing a Decision option below 2 should be blocked by Zod min')
  check(isFieldValueValid(c[0].props, 'DecisionBlock', 'options', [edited[0]]) === false, 'isFieldValueValid should report a 1-option array as invalid')
}

// ── Inspect items[]: toggle requirePhoto persists. ─────────────────────────────
{
  let c: Item[] = [{ type: 'InspectBlock', props: { id: 'i', title: 'Pre-start', items: [{ label: 'Guards', requirePhoto: false }], ...meta } }]
  c = commitFieldToContent(c as any, 'i', 'InspectBlock', 'items', [{ label: 'Guards', requirePhoto: true }]) as any
  check((c[0].props.items as any[])[0].requirePhoto === true, 'Inspect requirePhoto toggle did not persist')
}

// ── ModelBlock assetUrl (scalar-C): valid URL writes; non-URL kept. ────────────
{
  let c: Item[] = [{ type: 'ModelBlock', props: { id: 'm', assetUrl: 'https://x.test/a.glb', hotspots: [], defaultLayers: [] } }]
  c = commitFieldToContent(c as any, 'm', 'ModelBlock', 'assetUrl', 'https://x.test/b.glb') as any
  check(c[0].props.assetUrl === 'https://x.test/b.glb', 'Model assetUrl valid URL did not persist')
  c = commitFieldToContent(c as any, 'm', 'ModelBlock', 'assetUrl', 'not-a-url') as any
  check(c[0].props.assetUrl === 'https://x.test/b.glb', 'Model assetUrl non-URL should keep prior value')
}

// ── Wiring: FieldPanel mounts the array editor + add; shell mounts ⚙ trigger. ──
{
  const decision: Item = { type: 'DecisionBlock', props: { id: 'd2', question: 'Q', options: [{ label: 'Yes' }, { label: 'No' }], ...meta } }
  const panel = renderToStaticMarkup(
    createElement(FieldPanel as any, { item: decision, onCommitField: () => {}, onClose: () => {} })
  )
  check(panel.includes('data-field-panel'), 'FieldPanel did not render its .pk panel card')
  check(panel.includes('data-array-editor'), 'FieldPanel did not mount an ArrayFieldEditor for options')
  check(panel.includes('data-array-add'), 'ArrayFieldEditor did not render an add-row affordance')
  check(panel.includes('data-array-row'), 'ArrayFieldEditor did not render existing option rows')

  const ppe: Item = { type: 'PPECardBlock', props: { id: 'p2', title: 'PPE', items: ['Gloves'], ...meta } }
  const shell = renderToStaticMarkup(
    createElement(BlockEditShell as any, { item: ppe, onCommitField: () => {}, onDuplicate: () => {}, onDelete: () => {}, editing: true })
  )
  check(shell.includes('data-edit-fields-tool'), 'BlockEditShell did not render the ⚙ edit-fields trigger for a C-field block')
  check(shell.includes('data-open-field-panel'), 'BlockEditShell strip did not render the per-field open-panel affordance')

  // A block with no C field (Text) shows NO ⚙ trigger.
  const text: Item = { type: 'TextBlock', props: { id: 't', content: 'hi', ...meta } }
  const textShell = renderToStaticMarkup(
    createElement(BlockEditShell as any, { item: text, onCommitField: () => {}, onDuplicate: () => {}, onDelete: () => {}, editing: true })
  )
  check(!textShell.includes('data-edit-fields-tool'), 'TextBlock (no C field) should NOT render the ⚙ edit-fields trigger')
}

if (failures.length > 0) {
  console.error('FIELD-PANEL FAILED:')
  for (const f of failures) console.error('  -', f)
  process.exit(1)
}
console.log(
  'FIELD-PANEL OK — Pattern C array/config edit+persist through the Zod-validated lossless path; <2 blocked; nextStepId preserved; panel + ⚙ trigger mount (P14).'
)
