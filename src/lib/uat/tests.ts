/**
 * UAT / Design-Feedback test catalogue.
 *
 * These are the test DEFINITIONS rendered on /uat. They are version-controlled
 * (not stored in the DB) so adding a test is a code change and shows up in git.
 * The team's RESPONSES are stored in the `uat_feedback` table (migration 00034)
 * and can be exported for an AI agent via GET /api/uat/export.
 *
 * To add a test: append a UatTest object below. Give it a stable, unique `id`
 * (kebab-case), a `dateAdded` (ISO), and 1-N criteria. For a design-direction
 * comparison, use `directions` + optional `screenshots`. See the template at the
 * bottom of this file.
 */

export type CriterionResponse = 'pass' | 'fail' | 'na'
export type OverallVerdict = 'approve' | 'needs_work' | 'reject'

/** A row from the uat_feedback table (migration 00034). Shared client/server shape. */
export interface UatFeedbackRow {
  id: string
  test_id: string
  user_id: string
  user_email: string | null
  criteria_responses: Record<string, CriterionResponse>
  preferred_direction: string | null
  overall_verdict: OverallVerdict | null
  rating: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

/** What the client sends when saving feedback for one test. */
export interface UatFeedbackInput {
  testId: string
  criteriaResponses: Record<string, CriterionResponse>
  preferredDirection: string | null
  overallVerdict: OverallVerdict | null
  rating: number | null
  notes: string | null
}

export interface UatCriterion {
  /** Stable id, unique WITHIN a test. Used as the key in criteria_responses. */
  id: string
  /** What the reviewer is checking. */
  text: string
}

export interface UatLink {
  label: string
  href: string
}

/** A named design/UX direction being put to the team for a preference call. */
export interface UatDirection {
  id: string
  label: string
  description: string
  /** Optional image path/URL (e.g. /uat/screens/foo.png or a Supabase URL). */
  screenshot?: string
}

export interface UatTest {
  /** Stable unique slug. Becomes test_id in uat_feedback — DO NOT rename later. */
  id: string
  /** ISO date the test was added/last revised. */
  dateAdded: string
  /** Grouping label, e.g. "Builder", "Walkthrough". */
  category: string
  title: string
  status: 'active' | 'archived'
  /** Why this test exists — what question are we answering? */
  purpose: string
  /** The page / feature / component under test. */
  target: string
  /** What success looks like — the intended outcome. */
  intendedOutcome: string
  /** Optional how-to-test steps (rendered as an ordered list when present). */
  howToTest?: string[]
  /** Deep links to the thing under test (opens in a new tab). */
  links?: UatLink[]
  /** Optional design directions to choose between (renders a preference picker). */
  directions?: UatDirection[]
  /** Optional standalone screenshots for context. */
  screenshots?: string[]
  /** Pass/fail/na criteria the reviewer ticks. */
  criteria: UatCriterion[]
}

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

export const UAT_TESTS: UatTest[] = [
  // ---- Phase 21.6 — Builder Edit Stage Redesign (real runtime UAT) ----
  {
    id: '21.6-rail-step-centric',
    dateAdded: '2026-06-09',
    category: 'Builder · Phase 21.6',
    title: 'Step-centric rail renders without jargon',
    status: 'active',
    purpose:
      'The Build stage was redesigned to drop Puck jargon and present a single, step-centric outline. We need to confirm a first-time admin sees a clear structure, not internal block-type names.',
    target: 'Build stage left rail (BuilderTreeRail) at /admin/sops/builder/[sopId]',
    intendedOutcome:
      'The left rail shows a SECTIONS heading, section rows, and for the active section an ordered Step 1 / Step 2 list with nested block rows underneath. No PascalCase block names appear anywhere in the rail or canvas headers.',
    howToTest: [
      'Open any SOP in the Build stage.',
      'Expand a section and look at the rail + canvas headers.',
    ],
    links: [{ label: 'Open a SOP builder', href: '/admin/sops' }],
    criteria: [
      { id: 'sections-heading', text: 'A "SECTIONS" heading is visible at the top of the rail' },
      { id: 'numbered-steps', text: 'Steps are shown as an ordered Step 1 / Step 2 list' },
      { id: 'nested-blocks', text: 'Non-step blocks are nested/indented under their parent step' },
      { id: 'no-pascalcase', text: 'No raw block-type names (e.g. "StepBlock", "HazardCardBlock") appear anywhere' },
    ],
  },
  {
    id: '21.6-add-menu-insert',
    dateAdded: '2026-06-09',
    category: 'Builder · Phase 21.6',
    title: 'Add menu opens and inserts a block',
    status: 'active',
    purpose:
      'The central "+ Add" affordance replaces the old palette. Confirm it opens with humanised labels and actually inserts a block on the canvas.',
    target: '"＋ Add step or block" control + AddMenu',
    intendedOutcome:
      'Clicking "＋ Add step or block" opens a grouped menu (STEPS / ANNOTATIONS / SAFETY / STRUCTURED) with humanised labels; selecting a type inserts a block on the canvas and the menu closes.',
    links: [{ label: 'Open a SOP builder', href: '/admin/sops' }],
    criteria: [
      { id: 'opens', text: 'The Add menu opens when the control is clicked' },
      { id: 'grouped-labels', text: 'Options are grouped (STEPS / ANNOTATIONS / SAFETY / STRUCTURED) with plain-English labels' },
      { id: 'inserts', text: 'Selecting a type inserts a block on the canvas' },
      { id: 'closes', text: 'The menu closes after insertion' },
    ],
  },
  {
    id: '21.6-inline-edit-persists',
    dateAdded: '2026-06-09',
    category: 'Builder · Phase 21.6',
    title: 'Inline canvas editing persists',
    status: 'active',
    purpose:
      'Content editing moved from a cramped side rail into the canvas. Confirm inline edits save and survive a reload.',
    target: 'Canvas text editing (StepBlock / TextBlock) + autosave',
    intendedOutcome:
      'Clicking a StepBlock or TextBlock makes its text directly editable inline; a typed change persists via autosave and is visible after reloading the page.',
    howToTest: [
      'Click a step or text block on the canvas.',
      'Type a change, wait for the SAVED pill, then reload.',
    ],
    links: [{ label: 'Open a SOP builder', href: '/admin/sops' }],
    criteria: [
      { id: 'editable', text: 'Clicking the block makes its text editable inline (in the canvas)' },
      { id: 'saved-pill', text: 'The SAVED indicator confirms the change was saved' },
      { id: 'survives-reload', text: 'The change is still there after a full page reload' },
    ],
  },
  {
    id: '21.6-structured-popover',
    dateAdded: '2026-06-09',
    category: 'Builder · Phase 21.6',
    title: 'Structured field popover anchors and saves',
    status: 'active',
    purpose:
      'Structured blocks (measurements, decisions) use a popover instead of the side rail. Confirm it anchors correctly and saves.',
    target: 'StructuredFieldPopover (Measurement / Decision blocks)',
    intendedOutcome:
      'Clicking a Measurement or Decision block opens a popover anchored beneath the block with a humanised title; Escape dismisses it; a field change saves.',
    links: [{ label: 'Open a SOP builder', href: '/admin/sops' }],
    criteria: [
      { id: 'anchors', text: 'The popover opens anchored beneath the selected block' },
      { id: 'humanised-title', text: 'Its title is plain-English (not a block-type name)' },
      { id: 'escape', text: 'Pressing Escape dismisses the popover' },
      { id: 'saves', text: 'Editing a field value saves' },
    ],
  },
  {
    id: '21.6-orphan-photos-relabel',
    dateAdded: '2026-06-09',
    category: 'Builder · Phase 21.6',
    title: 'Orphan photos relabel to "Reference images"',
    status: 'active',
    purpose:
      'Parsed orphan photo groups previously showed the internal label "Unanchored figures". Confirm they now read "Reference images" everywhere.',
    target: 'PhotoGrid rail row + canvas chip',
    intendedOutcome:
      'A section with an orphan-photo block shows "Reference images" in both the rail row and the canvas chip — never "Unanchored figures".',
    criteria: [
      { id: 'rail-label', text: 'The rail row reads "Reference images"' },
      { id: 'canvas-chip', text: 'The canvas chip reads "Reference images"' },
      { id: 'no-unanchored', text: '"Unanchored figures" does not appear anywhere' },
    ],
  },
  {
    id: '21.6-section-reorder',
    dateAdded: '2026-06-09',
    category: 'Builder · Phase 21.6',
    title: 'Section drag-reorder is stable',
    status: 'active',
    purpose: 'Confirm reordering sections in the rail persists.',
    target: 'BuilderTreeRail drag-reorder (reorderSections)',
    intendedOutcome:
      'Dragging sections in the rail updates their order; the new order survives a page reload and navigating away and back.',
    criteria: [
      { id: 'drag-works', text: 'Sections can be dragged into a new order' },
      { id: 'survives-reload', text: 'The new order is preserved after a reload' },
      { id: 'survives-nav', text: 'The order is stable after navigating away and back' },
    ],
  },
  {
    id: '21.6-publish-gate',
    dateAdded: '2026-06-09',
    category: 'Builder · Phase 21.6',
    title: 'Publish gate unchanged — no safety regression',
    status: 'active',
    purpose:
      'The redesign must not weaken the safety gate. Confirm publishing a draft with unverified blocks is still blocked.',
    target: 'Publish flow (POST /api/sops/[sopId]/publish)',
    intendedOutcome:
      'Publishing a draft SOP that still has unverified blocks is rejected and the UI surfaces a clear error — the gate behaves exactly as before.',
    criteria: [
      { id: 'blocked', text: 'Publishing with unverified blocks is blocked' },
      { id: 'error-shown', text: 'The UI shows a clear "needs verification" error' },
      { id: 'publishes-when-clean', text: 'Once all blocks are verified, publishing succeeds' },
    ],
  },

  // ---- Builder rail — design directions for the team to weigh in on ----
  {
    id: 'builder-rail-density',
    dateAdded: '2026-06-09',
    category: 'Builder · Direction',
    title: 'Builder rail density — compact or roomy?',
    status: 'active',
    purpose:
      'The Build-stage left rail lists sections, steps and nested blocks. On long SOPs it gets tall and needs scrolling; on short ones it feels sparse. We need to agree the default row density.',
    target: 'BuilderTreeRail (left rail) at /admin/sops/builder/[sopId]',
    intendedOutcome:
      'A default density the team agrees scans well without excessive scrolling, while staying comfortable to click and drag.',
    links: [{ label: 'Open the current rail', href: '/admin/sops' }],
    directions: [
      {
        id: 'compact',
        label: 'Compact (~32px rows)',
        description:
          'Tighter rows and indents — more of the SOP visible at once. Best for 20+ step procedures. Trades some breathing room.',
      },
      {
        id: 'roomy',
        label: 'Roomy (~40px rows)',
        description:
          'Generous spacing and larger hit areas — easier to scan and click, consistent with the glove-friendly worker UI. Fewer rows per screen.',
      },
    ],
    criteria: [
      { id: 'scan', text: 'A long SOP is easy to scan in the preferred density' },
      { id: 'click', text: 'Rows are comfortable to click and drag without mis-hits' },
      { id: 'consistency', text: 'The density feels consistent with the rest of the app' },
    ],
  },
  {
    id: 'builder-rail-add-affordance',
    dateAdded: '2026-06-09',
    category: 'Builder · Direction',
    title: 'Where should "Add" live in the rail?',
    status: 'active',
    purpose:
      'Today a single "＋ Add step or block" control sits at the end of a section and opens the Add menu. Admins building multi-step SOPs often want to insert in the middle. We need to decide the add model.',
    target: '"＋ Add step or block" control + insertion anchor in BuilderTreeRail',
    intendedOutcome:
      'An add model that makes inserting at any position obvious and fast, without cluttering the rail.',
    links: [{ label: 'Open the current rail', href: '/admin/sops' }],
    directions: [
      {
        id: 'end-button',
        label: 'Single end-of-section button (current)',
        description:
          'One clear ＋ control per section; to insert mid-list you add then drag into place. Clean, but a mid-list insert is a two-step move.',
      },
      {
        id: 'inline-insert',
        label: 'Inline insert points',
        description:
          'A subtle ＋ appears between steps on hover and inserts exactly there. Faster mid-SOP authoring, at the cost of more affordances on screen.',
      },
    ],
    criteria: [
      { id: 'discoverable', text: 'It is obvious how to add a block' },
      { id: 'mid-insert', text: 'Inserting a block in the middle of a section is quick' },
      { id: 'uncluttered', text: 'The rail does not feel busy or noisy' },
    ],
  },
  {
    id: 'builder-rail-nesting-depth',
    dateAdded: '2026-06-09',
    category: 'Builder · Direction',
    title: 'How much should the rail show — blocks too, or just steps?',
    status: 'active',
    purpose:
      'The rail currently shows three levels: sections → steps → the blocks nested under each step. On block-heavy steps this gets deep. Should the rail stay a full tree, or collapse to sections + steps and leave block detail to the canvas?',
    target: 'BuilderTreeRail tree depth (deriveStepTree nesting)',
    intendedOutcome:
      'The right amount of detail in the rail — enough to navigate, not so much it overwhelms.',
    links: [{ label: 'Open the current rail', href: '/admin/sops' }],
    directions: [
      {
        id: 'full-tree',
        label: 'Full 3-level tree (current)',
        description:
          'Sections → steps → nested block rows. A complete map of the SOP, but can get long on block-heavy steps.',
      },
      {
        id: 'steps-only',
        label: 'Sections + steps only',
        description:
          'Blocks are shown and edited on the canvas, not in the rail. Much shorter rail and faster navigation; less at-a-glance detail.',
      },
    ],
    criteria: [
      { id: 'navigate', text: 'It is easy to jump to the part of the SOP you want' },
      { id: 'overwhelm', text: 'The rail does not feel overwhelming on a complex SOP' },
      { id: 'findability', text: 'You can still find a specific block quickly' },
    ],
  },

  // ---------------------------------------------------------------------------
  // TEMPLATE — copy this block to put a design/UX DIRECTION to the team.
  // Delete or set status:'archived' once a direction is chosen.
  // ---------------------------------------------------------------------------
  {
    id: 'example-direction-template',
    dateAdded: '2026-06-09',
    category: 'Examples',
    title: '[Example] Builder rail density — which direction?',
    status: 'active',
    purpose:
      'Template showing how to surface a design direction for a team preference call. Replace with a real question, add screenshots, then archive once decided.',
    target: 'Example only — not a live feature',
    intendedOutcome:
      'The team converges on a preferred direction with rationale captured in notes.',
    directions: [
      {
        id: 'compact',
        label: 'Compact',
        description: 'Tighter rows, more steps visible at once — better for long SOPs.',
      },
      {
        id: 'roomy',
        label: 'Roomy',
        description: 'Larger tap targets and spacing — easier to scan, fewer steps per screen.',
      },
    ],
    criteria: [
      { id: 'readable', text: 'The preferred direction is easy to scan' },
      { id: 'glove-friendly', text: 'Tap targets are comfortable on a touch device' },
    ],
  },
]

export const ACTIVE_UAT_TESTS = UAT_TESTS.filter((t) => t.status === 'active')

export function getUatTest(id: string): UatTest | undefined {
  return UAT_TESTS.find((t) => t.id === id)
}

export function uatCategories(): string[] {
  return Array.from(new Set(UAT_TESTS.map((t) => t.category)))
}
