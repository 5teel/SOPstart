/**
 * Phase 26.5 Plan 07 Task 2 — agent panel read-only behavioural check (D-09/D-10).
 *
 * Renders AgentPanel / AgentBlockMeta / AgentBanner through real react-dom/server
 * (not Playwright's JSX transform, which rewrites elements to {__pw_type…}
 * descriptors incompatible with a genuine react-dom/server render — same
 * tsx-subprocess pattern as scripts/render-parity-check.tsx and
 * scripts/ai-overlay-check.tsx). Asserts the rendered MARKUP contains zero
 * edit affordance on any metadata field (CLAUDE.md 2026-06-05: assert absence
 * of a handler, not just a CSS class string) and that AgentBlockMeta keys its
 * rows by junctionId (D-02).
 *
 * CLI: npx tsx scripts/agent-panel-check.tsx
 */
/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
export {} // isolate module scope (sibling *-check.tsx harnesses share globals otherwise)

const { createElement } = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const { AgentPanel } =
  require('../src/components/admin/builder-v2/agent/AgentPanel') as typeof import('../src/components/admin/builder-v2/agent/AgentPanel')
const { AgentBlockMeta } =
  require('../src/components/admin/builder-v2/agent/AgentBlockMeta') as typeof import('../src/components/admin/builder-v2/agent/AgentBlockMeta')
const { AgentBanner } =
  require('../src/components/admin/builder-v2/agent/AgentBanner') as typeof import('../src/components/admin/builder-v2/agent/AgentBanner')

const failures: string[] = []
const check = (cond: boolean, msg: string) => {
  if (!cond) failures.push(msg)
}

// ── AgentPanel — full data + one pending proposal (approve/decline are the
// ONLY sanctioned interactive affordance, D-10). ─────────────────────────────
const panelMarkup = renderToStaticMarkup(
  createElement(AgentPanel, {
    data: {
      summary: 'Isolates glass forming line before maintenance',
      tags: ['loto', 'hot-surface'],
      entities: { equipment: 'IS machine' },
      assessment: 'fresh',
      links: { crossSop: [], blockLibrary: [] },
      hasEmbedding: true,
      lastSynthesisStatus: 'ok',
      lastSynthesisError: null,
      regeneratedAt: new Date().toISOString(),
    },
    loading: false,
    pendingProposals: [
      {
        id: 'prop-1',
        sopId: 'sop-1',
        kind: 'tag-suggestion',
        description: 'Add PPE:gloves tag',
        evidence: {},
        createdAt: new Date().toISOString(),
      },
    ],
    onApprove: () => {},
    onDecline: () => {},
  })
)

check(!panelMarkup.includes('<input'), 'AgentPanel must render zero <input> elements')
check(!panelMarkup.includes('<textarea'), 'AgentPanel must render zero <textarea> elements')
check(!panelMarkup.includes('contentEditable'), 'AgentPanel must render zero contentEditable elements')
check(!/onchange=/i.test(panelMarkup), 'AgentPanel must attach no onChange to any metadata field')
check(panelMarkup.includes('loto'), 'AgentPanel should render tags as static chip text')
check(panelMarkup.includes('Add PPE:gloves tag'), 'AgentPanel should render the pending proposal description')
check(panelMarkup.includes('<button'), 'AgentPanel approve/decline buttons are the sanctioned interactive affordance')

// ── AgentBlockMeta — keyed by junctionId (D-02), read-only. ──────────────────
const blockMarkup = renderToStaticMarkup(
  createElement(AgentBlockMeta, {
    rows: [
      {
        junctionId: 'junc-abc123',
        tags: ['step', 'loto'],
        entities: { unit: 'mm' },
        hasEmbedding: true,
        regeneratedAt: null,
      },
    ],
  })
)
check(!blockMarkup.includes('<input'), 'AgentBlockMeta must render zero <input> elements')
check(!blockMarkup.includes('<textarea'), 'AgentBlockMeta must render zero <textarea> elements')
check(!blockMarkup.includes('contentEditable'), 'AgentBlockMeta must render zero contentEditable elements')
check(!/onchange=/i.test(blockMarkup), 'AgentBlockMeta must attach no onChange to any metadata field')
check(!blockMarkup.includes('<button'), 'AgentBlockMeta has no interactive affordance at all')
check(
  blockMarkup.includes('data-junction-id="junc-abc123"') && blockMarkup.includes('junc-abc123'),
  'AgentBlockMeta must key/display rows by junctionId (D-02)'
)

// ── AgentBanner — passive, no handlers. ──────────────────────────────────────
const bannerMarkup = renderToStaticMarkup(createElement(AgentBanner, {}))
check(!bannerMarkup.includes('<input'), 'AgentBanner must render zero <input> elements')
check(!bannerMarkup.includes('<button'), 'AgentBanner is a passive banner, not an interactive control')

if (failures.length > 0) {
  console.error('AGENT-PANEL-CHECK FAILURES:')
  for (const f of failures) console.error(' - ' + f)
  process.exit(1)
}
console.log('AGENT-PANEL-CHECK OK')
