/**
 * Phase 26 Plan 26-12 Task 2 — P13 AI-flag overlay + P9 orphan chip (behavioural).
 *
 * Puck's `componentOverlay` gave AI-flag badges + the inline flags panel + the
 * orphan-image chip for free. This harness proves the bespoke re-implementation
 * behaviourally (CLAUDE.md 2026-06-05), reusing `ReviewerFlagsPanel` +
 * `PuckItemBadgeOverlay` AS-IS:
 *   - a block with an OPEN reviewer flag → header ⚑ count badge + (when expanded)
 *     the real `ReviewerFlagsPanel` renders the flag rows (query seeded, not grep);
 *   - a verified/clean block → NO badge, NO panel;
 *   - a Heading whose text starts "Unanchored figures…" → the Reference-images chip.
 *
 * The reviewer query is SEEDED via QueryClient.setQueryData so `useReviewerFlags`
 * resolves synchronously under renderToStaticMarkup (no network). tsx subprocess
 * for the same reason as the sibling 26-xx harnesses (no `@/` alias in-process).
 * CLI: npx tsx scripts/ai-overlay-check.tsx
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
const { QueryClient, QueryClientProvider } = require('@tanstack/react-query')
const {
  SourceViewerSelectionProvider,
} = require('../src/components/admin/source-viewer/useSelectionSync') as typeof import('../src/components/admin/source-viewer/useSelectionSync')
const { BlockEditShell } =
  require('../src/components/admin/builder-v2/BlockEditShell') as typeof import('../src/components/admin/builder-v2/BlockEditShell')

const failures: string[] = []
const check = (cond: boolean, msg: string) => {
  if (!cond) failures.push(msg)
}

const SOP_ID = 'sop-1'
// Seed the reviewer-flags query (key + envelope shape per useReviewerFlags).
const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
qc.setQueryData(['reviewer-flags', SOP_ID], {
  parse_job_id: 'pj-1',
  ran_at: new Date().toISOString(),
  model: 'test',
  jobs_run: ['A'],
  usage: { input_tokens: 0, output_tokens: 0, cache_create_tokens: 0, cache_read_tokens: 0, cost_usd: 0 },
  flags: [
    {
      job: 'A',
      severity: 'critical',
      kind: 'hallucination',
      block_id: 'junc-flagged',
      source_location_hint: 'page 1',
      description: 'Torque value not present in source',
    },
  ],
})

function render(props: Record<string, unknown>): string {
  return renderToStaticMarkup(
    createElement(
      QueryClientProvider as any,
      { client: qc },
      createElement(
        SourceViewerSelectionProvider as any,
        null,
        createElement(BlockEditShell as any, props),
      ),
    ),
  )
}

const base = { onCommitField: () => {}, onDuplicate: () => {}, onDelete: () => {}, selectable: true, sopId: SOP_ID }

// ── Open AI flag → badge + expanded panel renders the real flag row. ───────────
{
  const item = { type: 'StepBlock', props: { id: 'comp-flagged', text: 'Torque to 40 Nm', junctionId: 'junc-flagged' } }
  const markup = render({
    ...base,
    item,
    junctionId: 'junc-flagged',
    junction: { id: 'junc-flagged', update_available: false },
    flagsCount: 1,
    flagsOpen: true,
  })
  check(markup.includes('data-ai-flag-badge'), 'flagged block should render the ⚑ AI-flag header badge')
  check(markup.includes('data-flags-panel'), 'expanded flagged block should mount the flags panel container')
  check(markup.includes('data-testid="reviewer-flags-panel"'), 'reused ReviewerFlagsPanel should render for the flagged block')
  check(markup.includes('data-testid="reviewer-flag-badge"'), 'the real flag row (FlagBadge) should render inside the panel')
}

// ── Verified / clean block → no badge, no panel. ───────────────────────────────
{
  const item = { type: 'StepBlock', props: { id: 'comp-clean', text: 'Close the guard', junctionId: 'junc-clean' } }
  const markup = render({
    ...base,
    item,
    junctionId: 'junc-clean',
    junction: { id: 'junc-clean', update_available: false, verified_by_admin_id: 'admin-1' },
    flagsCount: 0,
    flagsOpen: false,
  })
  check(!markup.includes('data-ai-flag-badge'), 'clean block must NOT render an AI-flag badge')
  check(!markup.includes('data-flags-panel'), 'clean block must NOT mount a flags panel')
  check(!markup.includes('data-testid="reviewer-flag-badge"'), 'clean block must NOT render any flag row')
}

// ── P9 orphan-image chip on "Unanchored figures…" heading; not on normal ones. ─
{
  const orphan = { type: 'HeadingBlock', props: { id: 'comp-orphan', text: 'Unanchored figures from the source', level: 'h2', junctionId: 'junc-orphan' } }
  const orphanMarkup = render({ ...base, item: orphan, junctionId: 'junc-orphan', junction: { id: 'junc-orphan', update_available: false }, flagsCount: 0 })
  check(orphanMarkup.includes('data-reference-images-chip'), 'orphan-figures heading should render the Reference-images chip')
  check(orphanMarkup.includes('Reference images'), 'chip label "Reference images" missing')

  const normal = { type: 'HeadingBlock', props: { id: 'comp-normal', text: 'Safety checklist', level: 'h2', junctionId: 'junc-normal' } }
  const normalMarkup = render({ ...base, item: normal, junctionId: 'junc-normal', junction: { id: 'junc-normal', update_available: false }, flagsCount: 0 })
  check(!normalMarkup.includes('data-reference-images-chip'), 'a normal heading must NOT render the Reference-images chip')
}

if (failures.length > 0) {
  console.error('AI-OVERLAY FAILED:')
  for (const f of failures) console.error('  -', f)
  process.exit(1)
}
console.log(
  'AI-OVERLAY OK — open-flag → badge + real ReviewerFlagsPanel row; clean → none; orphan heading → Reference-images chip (P13/P9).',
)
