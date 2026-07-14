/**
 * Phase 26 Plan 26-06 Task 2 — A/B/D field-editor behavioural harness (P14).
 *
 * Proves the three inline patterns EDIT + PERSIST through the real, unchanged
 * commit path (the Zod-validated, lossless `commitFieldToContent` that the shell
 * controls call → `updateBlockProps`), AND that BlockEditShell actually MOUNTS
 * an A/B/D control per FIELD_MAP entry (guards the 2026-06-05 dead-feature trap:
 * a passing commit function is worthless if the shell never renders the control
 * that calls it).
 *
 * Why a tsx subprocess (not an in-Playwright render): the phase26 project has no
 * `@/` alias resolution + can't load React/CSS in-process; and Playwright's JSX
 * transform is incompatible with real react-dom/server (same as the 26-04
 * autosave-rewire + render-parity harnesses). CLI: npx tsx scripts/field-patterns-check.tsx
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
const { commitFieldToContent } =
  require('../src/components/admin/builder-v2/fields/field-commit') as typeof import('../src/components/admin/builder-v2/fields/field-commit')
const { nextEnumValue, FIELD_MAP } =
  require('../src/components/admin/builder-v2/fields/field-map') as typeof import('../src/components/admin/builder-v2/fields/field-map')
const { BlockEditShell } =
  require('../src/components/admin/builder-v2/BlockEditShell') as typeof import('../src/components/admin/builder-v2/BlockEditShell')

type Item = { type: string; props: Record<string, unknown> & { id: string } }
const failures: string[] = []
const check = (cond: boolean, msg: string) => {
  if (!cond) failures.push(msg)
}

// Frozen-contract metadata every commit must preserve (R7).
const meta = {
  junctionId: 'junc-x',
  block_provenance: { region: { page: 1 }, parser_run_id: 'run-1', parser_version: 1 },
}

// ── Pattern B — enum chip cycles + writes the enum (Hazard severity). ──────────
{
  let content: Item[] = [
    { type: 'HazardCardBlock', props: { id: 'h', title: 'Guard', body: 'Keep clear', severity: 'critical', ...meta } },
  ]
  const opts = FIELD_MAP.HazardCardBlock.find((f) => f.field === 'severity')!.options!
  // critical → warning → notice (cycle-on-click for ≤3 options).
  const v1 = nextEnumValue('critical', opts)
  content = commitFieldToContent(content as any, 'h', 'HazardCardBlock', 'severity', v1) as any
  check(content[0].props.severity === 'warning', `severity cycle 1 = ${String(content[0].props.severity)}, expected warning`)
  const v2 = nextEnumValue(content[0].props.severity, opts)
  content = commitFieldToContent(content as any, 'h', 'HazardCardBlock', 'severity', v2) as any
  check(content[0].props.severity === 'notice', `severity cycle 2 = ${String(content[0].props.severity)}, expected notice`)
  // Frozen-contract metadata survives the enum write (R7).
  check(content[0].props.junctionId === 'junc-x', 'junctionId dropped on enum commit')
  check(Boolean(content[0].props.block_provenance), 'block_provenance dropped on enum commit')
}

// ── Pattern D — inline token writes number/string; invalid keeps prior value. ──
{
  // Numeric token (VoiceNote maxDurationSec).
  let content: Item[] = [
    { type: 'VoiceNoteBlock', props: { id: 'v', prompt: 'Describe noise', language: 'en-NZ', maxDurationSec: 60, ...meta } },
  ]
  content = commitFieldToContent(content as any, 'v', 'VoiceNoteBlock', 'maxDurationSec', '90') as any
  check(content[0].props.maxDurationSec === 90, `token write = ${String(content[0].props.maxDurationSec)} (${typeof content[0].props.maxDurationSec}), expected number 90`)
  // Non-numeric → Zod-guarded, prior value kept.
  content = commitFieldToContent(content as any, 'v', 'VoiceNoteBlock', 'maxDurationSec', 'abc') as any
  check(content[0].props.maxDurationSec === 90, 'non-numeric token should keep prior value')
  // Out-of-range (min 5) → kept.
  content = commitFieldToContent(content as any, 'v', 'VoiceNoteBlock', 'maxDurationSec', '3') as any
  check(content[0].props.maxDurationSec === 90, 'out-of-range token should keep prior value')

  // String token (Measurement unit).
  let m: Item[] = [
    { type: 'MeasurementBlock', props: { id: 'm', label: 'Gap', unit: 'mm', voiceEnabled: true, ...meta } },
  ]
  m = commitFieldToContent(m as any, 'm', 'MeasurementBlock', 'unit', 'cm') as any
  check(m[0].props.unit === 'cm', `unit token write = ${String(m[0].props.unit)}, expected cm`)
  // Empty string violates min(1) → kept.
  m = commitFieldToContent(m as any, 'm', 'MeasurementBlock', 'unit', '') as any
  check(m[0].props.unit === 'cm', 'empty unit should keep prior value')
  check(m[0].props.junctionId === 'junc-x', 'junctionId dropped on token commit')
}

// ── Pattern A — dual inline fields both persist (Callout title + body). ────────
{
  let content: Item[] = [
    { type: 'CalloutBlock', props: { id: 'c', title: 'Note', body: 'old body', ...meta } },
  ]
  content = commitFieldToContent(content as any, 'c', 'CalloutBlock', 'title', 'Warning') as any
  content = commitFieldToContent(content as any, 'c', 'CalloutBlock', 'body', 'Wear PPE at all times') as any
  check(content[0].props.title === 'Warning', 'callout title did not persist')
  check(content[0].props.body === 'Wear PPE at all times', 'callout body did not persist')
  check(content[0].props.junctionId === 'junc-x', 'junctionId dropped on A commit')
}

// ── Wiring: BlockEditShell mounts an A/B/D control per FIELD_MAP entry. ───────
// Fields are reachable in EDIT mode (`editing: true`). Read mode deliberately
// renders NO field strip: it used to mount the strip always at opacity-0 below
// the block, which restated the block's content as inputs and stole layout
// height on every card. Read or edit, never both — so reachability is asserted
// in the mode that owns it, plus a negative assertion that read mode is clean.
{
  const hazard: Item = {
    type: 'HazardCardBlock',
    props: { id: 'h2', title: 'Guard', body: 'Keep clear', severity: 'warning', ...meta },
  }
  const markup = renderToStaticMarkup(
    createElement(BlockEditShell as any, {
      item: hazard,
      onCommitField: () => {},
      onDuplicate: () => {},
      onDelete: () => {},
      editing: true,
    })
  )
  check(markup.includes('data-field-strip'), 'shell did not render the FIELD_MAP field strip')
  check(markup.includes('data-enum-chip'), 'shell did not render an EnumChip (Pattern B) for severity')
  check(markup.includes('Warning'), 'EnumChip did not show the current severity label')
  check(markup.includes('aria-label="Edit title"'), 'shell did not render an InlineText (A) for title')
  check(markup.includes('aria-label="Edit body"'), 'shell did not render an InlineText (A) for body')

  const voice: Item = {
    type: 'VoiceNoteBlock',
    props: { id: 'v2', prompt: 'Describe noise', language: 'en-NZ', maxDurationSec: 60, ...meta },
  }
  const vMarkup = renderToStaticMarkup(
    createElement(BlockEditShell as any, {
      item: voice,
      onCommitField: () => {},
      onDuplicate: () => {},
      onDelete: () => {},
      editing: true,
    })
  )
  check(vMarkup.includes('data-inline-token'), 'shell did not render an InlineToken (Pattern D) for maxDurationSec')
  check(vMarkup.includes('data-enum-chip'), 'shell did not render an EnumChip (Pattern B) for language')

  // Read mode (the default) must NOT duplicate the block as editable inputs.
  const readMarkup = renderToStaticMarkup(
    createElement(BlockEditShell as any, {
      item: hazard,
      onCommitField: () => {},
      onDuplicate: () => {},
      onDelete: () => {},
    })
  )
  check(
    !readMarkup.includes('data-field-strip'),
    'read mode still mounts the field strip — the block content is duplicated as inputs below itself'
  )
  check(
    !readMarkup.includes('aria-label="Edit body"'),
    'read mode still mounts an editable copy of the body text'
  )
  check(
    readMarkup.includes('Keep clear'),
    'read mode must still render the worker block itself'
  )
}

if (failures.length > 0) {
  console.error('FIELD-PATTERNS FAILED:')
  for (const f of failures) console.error('  -', f)
  process.exit(1)
}
console.log(
  'FIELD-PATTERNS OK — A/B/D edit+persist through the Zod-validated lossless path; invalid kept; shell mounts a control per FIELD_MAP entry (P14).'
)
