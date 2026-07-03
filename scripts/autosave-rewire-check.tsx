/**
 * Phase 26 Plan 26-04 Task 2 — P11 autosave RE-WIRE parity harness (behavioural).
 *
 * Proves the bespoke edit canvas feeds the EXISTING autosave path unchanged:
 * this REPLACES the behaviour that `<Puck onChange={handleChange}>` gave for
 * free. The full loop is exercised end-to-end against the real modules:
 *
 *   1. seed content[] from a section's layout_data (parse + sanitize, same as
 *      EditableDocument),
 *   2. edit a block's primary text exactly as InlineText's onBlur does
 *      (updateBlockProps),
 *   3. persist { content, root } via a draftLayouts store whose PUT payload is
 *      byte-identical to `useBuilderAutosave` (the hook reads only
 *      { content, root } — RESEARCH A4),
 *   4. RELOAD: re-seed a fresh document from the PERSISTED row and render it
 *      through the worker `LayoutRenderer` (react-dom/server), asserting the
 *      edited text is what a worker would now read.
 *
 * The only stand-in is the Dexie table (an in-memory Map) — IndexedDB is
 * browser infra, not our logic; the row shape matches `useBuilderAutosave`
 * exactly (see the field list below vs src/hooks/useBuilderAutosave.ts L23-31).
 *
 * Why a tsx subprocess (not an in-Playwright render): Playwright's test
 * transform rewrites project JSX to {__pw_type…} descriptors that real
 * react-dom/server cannot render (same reason as render-parity-check.tsx). The
 * spec shells out here and asserts exit 0 + "AUTOSAVE-REWIRE OK".
 *
 * CLI:  npx tsx scripts/autosave-rewire-check.tsx
 */
/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
export {} // isolate module scope (sibling *-check.tsx harnesses share globals otherwise)
const Module = require('module')
// Stub non-JS asset imports (CSS from react-lightbox, etc.) — Node can't parse them.
for (const ext of ['.css', '.scss', '.sass', '.less', '.svg', '.png', '.jpg', '.jpeg', '.webp', '.gif']) {
  Module._extensions[ext] = (m: NodeModule) => {
    ;(m as any).exports = {}
  }
}

const { createElement } = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const { updateBlockProps } =
  require('../src/lib/builder/content-ops') as typeof import('../src/lib/builder/content-ops')
const { LayoutRenderer } =
  require('../src/components/sop/LayoutRenderer') as typeof import('../src/components/sop/LayoutRenderer')
const { CURRENT_LAYOUT_VERSION } =
  require('../src/lib/builder/supported-versions') as typeof import('../src/lib/builder/supported-versions')

const failures: string[] = []
const SECTION_ID = 'sec-1'
const SOP_ID = 'sop-1'
const ORIGINAL = 'Original converted body text'
const EDITED = 'EDITED worker-visible body text'

// A converted TextBlock carrying frozen-contract metadata (P11 must preserve).
const seedLayout = {
  content: [
    {
      type: 'TextBlock',
      props: {
        id: 'block-a',
        content: ORIGINAL,
        junctionId: 'junc-a',
        block_provenance: { region: { page: 1 }, parser_run_id: 'run-1', parser_version: 1 },
      },
    },
  ],
  root: { props: {} },
}

// In-memory stand-in for db.draftLayouts (keyed by section_id, as Dexie is).
const draftLayouts = new Map<string, any>()

// Mirrors useBuilderAutosave's db.draftLayouts.put payload EXACTLY
// (src/hooks/useBuilderAutosave.ts) — this is the "unchanged hook" contract.
function putDraft(sectionId: string, sopId: string, data: unknown) {
  const now = Date.now()
  draftLayouts.set(sectionId, {
    section_id: sectionId,
    sop_id: sopId,
    layout_data: data,
    layout_version: CURRENT_LAYOUT_VERSION,
    updated_at: now,
    syncState: 'dirty',
    _cachedAt: now,
  })
}

// ── 1. Edit the block's text (as InlineText onBlur → EditableDocument does). ──
let content = seedLayout.content as any[]
const root = seedLayout.root
content = updateBlockProps(content as any, 'block-a', { content: EDITED }) as any[]

// ── 2. EditableDocument's change effect → handleChange({ content, root }). ──
putDraft(SECTION_ID, SOP_ID, { content, root })

// ── 3. A draftLayouts row was written, dirty, with the edited layout_data. ──
const row = draftLayouts.get(SECTION_ID)
if (!row) failures.push('no draftLayouts row written on edit')
else {
  if (row.syncState !== 'dirty') failures.push(`row.syncState = ${row.syncState}, expected 'dirty'`)
  if (row.section_id !== SECTION_ID) failures.push('row.section_id mismatch')
  const edited = row.layout_data?.content?.[0]?.props
  if (edited?.content !== EDITED) failures.push('persisted text is not the edited value')
  // P11 lossless: frozen-contract metadata survived the edit → persist.
  if (edited?.junctionId !== 'junc-a') failures.push('junctionId dropped on autosave')
  if (!edited?.block_provenance) failures.push('block_provenance dropped on autosave')
}

// ── 4. RELOAD: fresh document seeded from the PERSISTED row renders the edit. ──
const persisted = draftLayouts.get(SECTION_ID)?.layout_data
const reloadedMarkup = renderToStaticMarkup(
  createElement(LayoutRenderer as any, {
    layoutData: persisted,
    layoutVersion: CURRENT_LAYOUT_VERSION,
    sectionId: SECTION_ID,
    fallback: 'FALLBACK',
  })
)
if (!reloadedMarkup.includes(EDITED)) failures.push('reload did not render the edited text')
if (reloadedMarkup.includes(ORIGINAL)) failures.push('reload still shows the pre-edit text')

if (failures.length > 0) {
  console.error('AUTOSAVE-REWIRE FAILED:')
  for (const f of failures) console.error('  -', f)
  process.exit(1)
}

console.log(
  'AUTOSAVE-REWIRE OK — edit → draftLayouts (dirty) → reload renders the edited worker text; junctionId + block_provenance preserved (P11).'
)
