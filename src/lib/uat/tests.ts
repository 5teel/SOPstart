/**
 * UAT / Design-Feedback test catalogue.
 *
 * These are the test DEFINITIONS rendered on /uat. They are version-controlled
 * (not stored in the DB) so adding a test is a code change and shows up in git.
 * Team RESPONSES live in the `uat_feedback` table (migration 00034) and can be
 * exported for an AI agent via GET /api/uat/export.
 *
 * WRITING FOR NON-TECHNICAL REVIEWERS:
 *  - `summary` is plain English: what this is + what we want to know. 1-2 sentences.
 *  - `questions` are simple, positively-phrased questions a reviewer answers
 *    Yes / No / Not sure (Yes = good). No jargon.
 *  - `tryIt` are friendly "have a look" steps.
 *  - `background` is OPTIONAL technical context, shown only behind a "Why we're
 *    asking" toggle and included in the AI export — keep jargon HERE, not above.
 *
 * To add a design choice for the team, use `directions` + `screenshot` per option.
 * See the template at the bottom.
 */

export type CriterionResponse = 'pass' | 'fail' | 'na' // shown as Yes / No / Not sure
export type OverallVerdict = 'approve' | 'needs_work' | 'reject'

export interface UatQuestion {
  /** Stable id, unique WITHIN a test. Used as the key in criteria_responses. */
  id: string
  /** A plain Yes/No question — phrase it so "Yes" means it worked / felt good. */
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
  /** Image path/URL (e.g. /uat/screens/foo.png). */
  screenshot?: string
}

export interface UatTest {
  /** Stable unique slug. Becomes test_id in uat_feedback — DO NOT rename later. */
  id: string
  /** ISO date the test was added/last revised. */
  dateAdded: string
  /** Friendly grouping label, e.g. "Procedure builder", "Design choices". */
  category: string
  /** Plain-English title, ideally a question. */
  title: string
  status: 'active' | 'archived'
  /** Plain English: what this is + what we want to know. 1-2 sentences. */
  summary: string
  /** Friendly "have a look" steps. */
  tryIt?: string[]
  /** Buttons that open the thing under review (new tab). */
  links?: UatLink[]
  /** Design options to choose between (renders a tap-to-pick image picker). */
  directions?: UatDirection[]
  /** Standalone screenshots for context. */
  screenshots?: string[]
  /** Plain label of the exact area being tested, e.g. "The list down the left side". */
  spotlight?: string
  /** Before/after comparison — the old version vs the new one (drag-to-compare slider). */
  comparison?: {
    /** Plain one-liner: what got better vs the previous version. */
    improvement: string
    before: { image: string; caption?: string }
    after: { image: string; caption?: string }
  }
  /** Simple Yes / No / Not sure questions. */
  questions: UatQuestion[]
  /** OPTIONAL technical context — hidden behind "Why we're asking"; jargon ok here. */
  background?: string
}

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

export const UAT_TESTS: UatTest[] = [
  // ===================== Design choices (pick A or B) =====================
  {
    id: 'builder-rail-density',
    dateAdded: '2026-06-09',
    category: 'Design choices',
    title: 'Which list layout is easier to use?',
    status: 'active',
    summary:
      "When you build a procedure, there's a list of its steps down the left side. We're trying two looks — a tighter one and a more spacious one. Have a look at both and tell us which feels easier for you.",
    directions: [
      {
        id: 'compact',
        label: 'Tighter',
        description: 'More fits on the screen at once. Good for long procedures with lots of steps.',
        screenshot: '/uat/screens/rail-compact.png',
      },
      {
        id: 'roomy',
        label: 'More spacious',
        description: 'Bigger and easier to read and tap. Fewer items on screen at once.',
        screenshot: '/uat/screens/rail-roomy.png',
      },
    ],
    questions: [
      { id: 'readable', text: 'Is your preferred option easy to read?' },
      { id: 'touch', text: 'Would it be comfortable to use on a phone or tablet?' },
    ],
    background:
      'BuilderTreeRail default row density. Compact ≈ 32px rows, Roomy ≈ 40px. Affects scroll length vs tap-target comfort.',
  },
  {
    id: 'builder-rail-add-affordance',
    dateAdded: '2026-06-09',
    category: 'Design choices',
    title: "Where's the best place to add a new step?",
    status: 'active',
    summary:
      "Two ideas for adding a step. Option A is one '＋ Add' button at the bottom. Option B shows a small '＋' between steps so you can add right where you want. Which feels easier?",
    directions: [
      {
        id: 'end-button',
        label: "One '＋ Add' button at the end",
        description: 'Simple and tidy. To add a step in the middle, you add it then drag it up.',
        screenshot: '/uat/screens/rail-add-end.png',
      },
      {
        id: 'inline-insert',
        label: "A '＋' between steps",
        description: 'A small ＋ appears between steps and adds one right there. Quicker for adding in the middle.',
        screenshot: '/uat/screens/rail-add-inline.png',
      },
    ],
    questions: [
      { id: 'obvious', text: 'Is it obvious how to add a step in your preferred option?' },
      { id: 'tidy', text: 'Does it feel uncluttered (not too busy)?' },
    ],
    background: 'Add affordance placement in BuilderTreeRail — single end control vs inline hover insert points.',
  },
  {
    id: 'builder-rail-nesting-depth',
    dateAdded: '2026-06-09',
    category: 'Design choices',
    title: 'How much detail should the side list show?',
    status: 'active',
    summary:
      'The side list can show everything — sections, steps, and the items inside each step — or just the sections and steps to keep it short. Which do you prefer?',
    directions: [
      {
        id: 'full-tree',
        label: 'Show everything',
        description: 'Sections, steps, and the items inside each step. A complete map, but it can get long.',
        screenshot: '/uat/screens/rail-nest-full.png',
      },
      {
        id: 'steps-only',
        label: 'Just sections and steps',
        description: "Shows steps with a small note like '2 items'. Shorter and quicker to scan.",
        screenshot: '/uat/screens/rail-nest-steps.png',
      },
    ],
    questions: [
      { id: 'find', text: 'Can you find what you need easily in your preferred option?' },
      { id: 'manageable', text: 'Does it feel manageable, not overwhelming?' },
    ],
    background: 'Rail tree depth (deriveStepTree) — 3 levels vs sections+steps with a block count.',
  },

  // ===================== Procedure builder (have a look) =====================
  {
    id: '21.6-rail-step-centric',
    dateAdded: '2026-06-09',
    category: 'Procedure builder',
    title: 'Is the procedure outline clear?',
    status: 'active',
    summary:
      "When you open a procedure to edit it, there's a list on the left showing its sections and steps. We want to know if it's clear and easy to follow.",
    spotlight: 'The list down the left side',
    comparison: {
      improvement:
        "Before, there were two technical lists full of code-style names like 'StepBlock' and 'Block'. Now it's one simple list of numbered steps in plain words.",
      before: { image: '/uat/screens/rail-before.png', caption: 'Before — two lists, technical names' },
      after: { image: '/uat/screens/rail-after.png', caption: 'After — one plain, numbered list' },
    },
    tryIt: ['Open any procedure to edit it.', 'Look at the list down the left side.'],
    links: [{ label: 'Open a procedure', href: '/admin/sops' }],
    questions: [
      { id: 'glance', text: 'Can you tell what the sections and steps are at a glance?' },
      { id: 'numbered', text: 'Are the steps clearly numbered (Step 1, Step 2…)?' },
      { id: 'plain', text: 'Is it free of confusing technical words?' },
    ],
    background:
      'Build-stage left rail (BuilderTreeRail): step-centric outline, blocks nested under steps, no raw PascalCase block-type names.',
  },
  {
    id: '21.6-add-menu-insert',
    dateAdded: '2026-06-09',
    category: 'Procedure builder',
    title: 'Is it easy to add a step or block?',
    status: 'active',
    summary:
      "There's a '＋ Add step or block' button for adding new content. We want to know if it's easy to find and works the way you'd expect.",
    spotlight: 'The Add menu',
    comparison: {
      improvement:
        "Before, adding meant scrolling a long list of technical names ('TextBlock', 'HazardCardBlock'). Now it's a short, grouped menu with plain names like 'Step', 'Hazard' and 'Measurement'.",
      before: { image: '/uat/screens/addmenu-before.png', caption: 'Before — raw component list' },
      after: { image: '/uat/screens/addmenu-after.png', caption: 'After — grouped, plain names' },
    },
    tryIt: ['Open a procedure.', "Click '＋ Add step or block'.", 'Pick something from the menu.'],
    links: [{ label: 'Open a procedure', href: '/admin/sops' }],
    questions: [
      { id: 'findable', text: 'Was it easy to find how to add something?' },
      { id: 'labels', text: 'Were the choices in the menu easy to understand?' },
      { id: 'appeared', text: 'Did your new item appear where you expected?' },
    ],
    background: 'AddMenu: grouped humanised labels (STEPS / ANNOTATIONS / SAFETY / STRUCTURED); inserts at the step anchor.',
  },
  {
    id: '21.6-inline-edit-persists',
    dateAdded: '2026-06-09',
    category: 'Procedure builder',
    title: 'Can you edit text easily?',
    status: 'active',
    summary:
      'You can click on text in a procedure to change it. We want to know if editing feels natural and your changes are saved.',
    tryIt: ["Click on a step's text.", 'Type a change.', 'Wait a moment, then refresh the page.'],
    links: [{ label: 'Open a procedure', href: '/admin/sops' }],
    questions: [
      { id: 'click-edit', text: 'Could you edit the text just by clicking on it?' },
      { id: 'saved', text: 'Did it show that your change was saved?' },
      { id: 'persisted', text: 'Was your change still there after refreshing?' },
    ],
    background: 'Inline contentEditable on canvas blocks; autosave (Dexie → Supabase) round-trip.',
  },
  {
    id: '21.6-structured-popover',
    dateAdded: '2026-06-09',
    category: 'Procedure builder',
    title: 'Are measurement / decision details easy to fill in?',
    status: 'active',
    summary:
      'Some blocks (like a measurement or a yes/no decision) have extra details. Clicking one opens a small panel to fill them in. We want to know if that feels clear.',
    tryIt: ['Click a measurement or decision block.', 'Try changing a value.', 'Press Escape to close it.'],
    links: [{ label: 'Open a procedure', href: '/admin/sops' }],
    questions: [
      { id: 'anchored', text: 'Did a panel open right next to the block you clicked?' },
      { id: 'clear', text: 'Was it clear what to fill in?' },
      { id: 'close', text: 'Did closing it (or pressing Escape) work as expected?' },
    ],
    background: 'StructuredFieldPopover anchored to the selected structured block; Puck field threading + autosave.',
  },
  {
    id: '21.6-orphan-photos-relabel',
    dateAdded: '2026-06-09',
    category: 'Procedure builder',
    title: 'Is the photo group label clear?',
    status: 'active',
    summary:
      "When a procedure has loose photos that aren't tied to a step, we group them together. We just want to check the label reads as plain English.",
    spotlight: 'The photo group label',
    comparison: {
      improvement:
        "Before, this group was labelled 'Unanchored figures' — confusing jargon. Now it reads 'Reference images'.",
      before: { image: '/uat/screens/photo-before.png', caption: 'Before' },
      after: { image: '/uat/screens/photo-after.png', caption: 'After' },
    },
    tryIt: ['Open a procedure that has a group of reference photos.', 'Look at the label on that group.'],
    links: [{ label: 'Open a procedure', href: '/admin/sops' }],
    questions: [
      { id: 'reference', text: "Does the photo group read as 'Reference images'?" },
      { id: 'no-jargon', text: 'Is the label clear and free of jargon?' },
    ],
    background: "Orphan PhotoGrid relabel — rail row + canvas chip must read 'Reference images', never 'Unanchored figures'.",
  },
  {
    id: '21.6-section-reorder',
    dateAdded: '2026-06-09',
    category: 'Procedure builder',
    title: 'Can you reorder sections easily?',
    status: 'active',
    summary:
      'You can drag sections into a different order. We want to know if that feels easy and the new order sticks.',
    tryIt: ['Drag a section up or down in the side list.', 'Refresh the page to check the order stuck.'],
    links: [{ label: 'Open a procedure', href: '/admin/sops' }],
    questions: [
      { id: 'drag', text: 'Could you drag a section into a new position?' },
      { id: 'stuck', text: 'Did the new order stay after refreshing?' },
    ],
    background: 'BuilderTreeRail drag-reorder via reorderSections server action; optimistic + revert-on-error.',
  },
  {
    id: '21.6-publish-gate',
    dateAdded: '2026-06-09',
    category: 'Procedure builder',
    title: 'Does it stop you publishing an unfinished procedure?',
    status: 'active',
    summary:
      "A procedure shouldn't go live until every safety point has been checked off. We want to confirm it stops you — with a clear message — until then.",
    tryIt: ['Try to publish a procedure that still has unchecked safety items.'],
    links: [{ label: 'Open a procedure', href: '/admin/sops' }],
    questions: [
      { id: 'blocked', text: 'Were you stopped from publishing while items were unchecked?' },
      { id: 'explained', text: 'Was the reason explained clearly?' },
      { id: 'then-publish', text: 'Once everything was checked, could you publish?' },
    ],
    background: 'Publish gate (POST /api/sops/[sopId]/publish) returns 400 unverified_blocks; UI surfaces the error.',
  },

  // ---------------------------------------------------------------------------
  // TEMPLATE — copy this to put a new design choice or check to the team.
  // Set status:'archived' once it's decided.
  // ---------------------------------------------------------------------------
  {
    id: 'example-direction-template',
    dateAdded: '2026-06-09',
    category: 'Examples',
    title: '[Example] How to ask the team a design question',
    status: 'active',
    summary:
      'This is an example showing the format. Replace it with a real question, swap in your own screenshots, then archive it once the team has decided.',
    directions: [
      { id: 'option-a', label: 'Option A', description: 'Describe the first option in plain language.' },
      { id: 'option-b', label: 'Option B', description: 'Describe the second option in plain language.' },
    ],
    questions: [
      { id: 'easy', text: 'Is your preferred option easy to use?' },
      { id: 'comfortable', text: 'Would it work well on a phone or tablet?' },
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

// ---------------------------------------------------------------------------
// Feedback row shapes (uat_feedback table, migration 00034). Shared client/server.
// ---------------------------------------------------------------------------

/** A row from the uat_feedback table. */
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
