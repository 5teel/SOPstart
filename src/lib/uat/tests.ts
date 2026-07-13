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
  // ===================== Speed & feel =====================
  {
    id: 'nav-instant-feedback',
    dateAdded: '2026-07-13',
    category: 'Speed & feel',
    title: 'Does the app respond instantly when you tap around?',
    status: 'active',
    summary:
      'Links and tabs now acknowledge your tap straight away — you should see the page start changing (a grey placeholder or a small spinner) the moment you tap, even if the content takes a second to arrive.',
    tryIt: [
      'Tap between SOPs, Activity and Profile in the bottom bar (phone) or the top tabs (desktop).',
      'In Admin, switch between the SOPs, Blocks, Team and Settings tabs.',
      'Open a SOP from the library, go back, and open another one.',
    ],
    questions: [
      { id: 'instant', text: 'Did something visibly happen the instant you tapped each link?' },
      { id: 'faster', text: 'Does moving around the app feel faster than before?' },
      { id: 'no-dead-taps', text: 'Did you avoid any "did my tap register?" moments?' },
    ],
    background:
      'Navigation-responsiveness pass (2026-07-13): route-level loading.tsx skeletons so the App Router paints instantly on navigation; useLinkStatus pending spinners on BottomTabBar/TopHeader/AdminNav; middleware getUser()→getClaims() (local ES256 JWT verify, no per-request Supabase Auth round-trip); per-request cached getSessionContext deduplicating auth+role queries; Promise.all on independent server-page fetches.',
  },

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
    spotlight: 'Editing text on the page',
    comparison: {
      improvement:
        'Before, you changed wording in a cramped panel off to the side. Now you click the text and type right where it sits.',
      before: { image: '/uat/screens/edit-before.png', caption: 'Before — edit in a side panel' },
      after: { image: '/uat/screens/edit-after.png', caption: 'After — type right on the page' },
    },
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
    spotlight: 'Filling in measurement & decision details',
    comparison: {
      improvement:
        'Before, these details were in a side panel away from the block. Now a small panel opens right beneath the block you clicked.',
      before: { image: '/uat/screens/struct-before.png', caption: 'Before — far-off side panel' },
      after: { image: '/uat/screens/struct-after.png', caption: 'After — opens beneath the block' },
    },
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
    spotlight: 'Reordering sections',
    comparison: {
      improvement:
        'Before, there was no easy way to change the order. Now each section has a drag handle — drag to reorder and it sticks.',
      before: { image: '/uat/screens/reorder-before.png', caption: 'Before — fixed order' },
      after: { image: '/uat/screens/reorder-after.png', caption: 'After — drag handles' },
    },
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
    spotlight: 'The publish safety check',
    comparison: {
      improvement:
        'Before, publishing just failed with a cryptic error code. Now it clearly lists exactly which safety items still need checking first.',
      before: { image: '/uat/screens/publish-before.png', caption: 'Before — cryptic error' },
      after: { image: '/uat/screens/publish-after.png', caption: 'After — clear checklist' },
    },
    tryIt: ['Try to publish a procedure that still has unchecked safety items.'],
    links: [{ label: 'Open a procedure', href: '/admin/sops' }],
    questions: [
      { id: 'blocked', text: 'Were you stopped from publishing while items were unchecked?' },
      { id: 'explained', text: 'Was the reason explained clearly?' },
      { id: 'then-publish', text: 'Once everything was checked, could you publish?' },
    ],
    background: 'Publish gate (POST /api/sops/[sopId]/publish) returns 400 unverified_blocks; UI surfaces the error.',
  },

  // ===================== Phase 23 — AI Field Layer + Version Supersede =====================
  {
    id: 'p23-roster-login',
    dateAdded: '2026-06-26',
    category: 'Phase 23 — AI Field Layer + Version Supersede',
    title: 'Can a worker sign in on a shared device by picking their name?',
    status: 'active',
    summary:
      'Workers on a shared device sign in by tapping their name from a list — no password needed. We want to confirm the name-select screen works and the right SOPs appear after selecting a name.',
    tryIt: [
      'On a shared device, open the roster login page.',
      'Pick a worker name from the list.',
      'Confirm you land on the SOP library and can see the procedures assigned to that worker.',
      'Complete a short SOP and confirm the completion is recorded against the selected worker name.',
      'Switch to a different worker name and confirm you only see that worker\'s assigned SOPs (not the first worker\'s private data).',
    ],
    links: [{ label: 'Roster name-select', href: '/login/roster' }],
    questions: [
      { id: 'name-list', text: 'Was it easy to find and tap your name on the list?' },
      { id: 'right-sops', text: 'Did the correct SOPs appear after selecting a name?' },
      { id: 'completion-attributed', text: 'Was the completed SOP recorded against the right worker name?' },
      { id: 'isolation', text: 'After switching workers, could you only see the new worker\'s SOPs (not the previous worker\'s)?' },
    ],
    background:
      'AFL-VER-05 / D-11 (roster name-select login). Per-org shared-device account (role=worker) established once by admin. roster_worker_id stored in sessionStorage; RLS uses the shared-device account session for org-scoping while the roster_worker_id attributes signatures. recordSignature() enforces org-scope via createAdminClient() with explicit organisation_id check.',
  },
  {
    id: 'p23-inline-ai-proposal',
    dateAdded: '2026-06-26',
    category: 'Phase 23 — AI Field Layer + Version Supersede',
    title: 'Does the AI proposal Accept/Reject work at a field?',
    status: 'active',
    summary:
      'The AI can suggest a change to a field in a published procedure. The proposed change appears inline — you can see the old and new value side by side, then Accept or Reject it. We want to confirm the experience is clear and the right thing happens when you choose.',
    tryIt: [
      'Trigger an AI field proposal on a published SOP (ask your admin to initiate one via the API, or use the test fixture if available).',
      'Look at the field — you should see both the current value and the proposed change.',
      'Try accepting the proposal and confirm the new value is applied.',
      'On a different field, try rejecting a proposal and confirm the old value stays.',
    ],
    links: [{ label: 'SOP management', href: '/admin/sops' }],
    questions: [
      { id: 'visible-diff', text: 'Could you clearly see what the AI proposed to change?' },
      { id: 'accept-works', text: 'Did accepting the proposal apply the new value correctly?' },
      { id: 'reject-works', text: 'Did rejecting the proposal keep the original value unchanged?' },
      { id: 'no-surprise', text: 'Were there any unexpected changes to other parts of the SOP?' },
    ],
    background:
      'AFL-AI-02 / D-03 (inline accept/reject). High-stakes (published SOP) field writes go to pending_approval via gateWrite(); the inline diff component renders the proposal at the field; Accept calls the write descriptor; Reject discards. Low-stakes fields (drafts, tags) auto-apply without a prompt.',
  },
  {
    id: 'p23-updated-since-badge',
    dateAdded: '2026-06-26',
    category: 'Phase 23 — AI Field Layer + Version Supersede',
    title: 'Does the "updated since last completion" badge appear when a new version is published?',
    status: 'active',
    summary:
      'When an admin publishes a new version of an SOP, workers who have already completed it should see a small badge on the SOP card telling them it has been updated. We want to confirm the badge appears at the right time and goes away after the worker completes the new version.',
    tryIt: [
      'As a worker, complete an SOP (confirm no badge before you start).',
      'As an admin, publish a new version of that same SOP.',
      'Log back in as the worker and open the SOP library.',
      'Confirm the SOP card now shows an "Updated since your last completion" badge.',
      'Walk through and complete the new version.',
      'Confirm the badge disappears after completing the updated version.',
    ],
    links: [
      { label: 'SOP library (worker view)', href: '/sops' },
      { label: 'SOP management (admin — publish new version)', href: '/admin/sops' },
    ],
    questions: [
      { id: 'badge-appears', text: 'Did the badge appear on the SOP card after the new version was published?' },
      { id: 'badge-clear', text: 'Was it clear that the badge meant the SOP had been updated?' },
      { id: 'badge-goes', text: 'Did the badge go away after you completed the new version?' },
    ],
    background:
      'AFL-VER-04 / D-08 (updated-since indicator). Badge triggers when sop.published_at > worker\'s last completion. SopLibraryCard renders data-updated-badge when the showUpdatedBadge prop is true. The prop is derived server-side by comparing the SOP\'s current published_at against the most recent sop_completions.completed_at for that worker+SOP pair.',
  },
  {
    id: 'p26-annotation-editor-feel',
    dateAdded: '2026-07-03',
    category: 'Phase 26 — SOP Builder Redesign',
    title: 'Does drawing on a diagram feel right on a real device?',
    status: 'active',
    summary:
      'When editing a procedure you can now draw on a diagram — arrows, boxes, circles, numbered markers and freehand — and drag or resize what you drew. This one is about how it FEELS to draw on a touchscreen or with a stylus, which we can only judge on a real device. (Available once the annotate button is wired in a later step; verify after that ships.)',
    tryIt: [
      'Open a procedure in the builder, add a Visual block, add a diagram, and open the annotation editor.',
      'Draw an arrow, a box, a numbered marker, and a freehand line.',
      'Tap one shape and resize/rotate it with the handles; undo and redo a couple of times.',
      'Turn on "Pen only" and confirm resting your palm or a finger does not draw while the pen does (iPad if you have one).',
      'Close and re-open the same diagram — confirm exactly what you drew comes back.',
    ],
    links: [
      { label: 'SOP management (admin — builder)', href: '/admin/sops' },
    ],
    questions: [
      { id: 'draw-feel', text: 'Did drawing shapes feel smooth and responsive?' },
      { id: 'transform', text: 'Could you easily select, move and resize a shape?' },
      { id: 'undo-redo', text: 'Did undo and redo behave as you expected?' },
      { id: 'palm-reject', text: 'With "Pen only" on, did it ignore your palm/finger while the pen drew?' },
      { id: 'reopen', text: 'After closing and re-opening, did your annotations reload exactly?' },
    ],
    background:
      'Phase 26-11 Task 3 residual (R5 / D-03 slice 2). The Konva annotation editor (AnnotationEditor.tsx + DiagramHotspotBlock.tsx, admin-only, dynamic-imported) plus its pure scene model (annotation-tools.ts) are built and machine-tested (14 phase26 specs green: primitives, undo/redo, non-destructive serialize, palm-reject, hotspot coordinate-stability; tsc clean; worker bundle Konva-free Δ0). The draw/transform/palm-reject FEEL is device-dependent and cannot be proven headless — carried as a deferred-residual per the v3.0 device-verification precedent. On-device verification is only possible once 26-13 wires the annotate→save→reopen launch point; run this item then, alongside the 26-13 persistence check.',
  },
  {
    id: 'p26-edit-worker-parity',
    dateAdded: '2026-07-03',
    category: 'Phase 26 — SOP Builder Redesign',
    title: 'Does the block you edit look the same as what the worker sees?',
    status: 'active',
    summary:
      'The builder was rebuilt so admins now edit the SAME block components the worker reads — no separate "editor look" vs "published look". This check is a visual side-by-side: edit a few block types, publish, then open the worker view and confirm they match.',
    tryIt: [
      'Open a published SOP in the builder and edit a Step, a Hazard card, and a Callout — change some text and a field (e.g. hazard severity).',
      'Note how each block looks while you are editing it.',
      'Publish, then open the same SOP in the worker view (/sops/[sopId]).',
      'Compare each block: the layout, colours, icons and spacing should match what you saw while editing.',
    ],
    links: [
      { label: 'SOP management (admin — builder)', href: '/admin/sops' },
      { label: 'SOP library (worker view)', href: '/sops' },
    ],
    questions: [
      { id: 'match', text: 'Did each block look the same in the editor as in the worker view?' },
      { id: 'no-surprise', text: 'Was there anything that looked different after publishing than while editing?' },
      { id: 'fields', text: 'Did field changes (e.g. hazard severity colour) carry through to the worker view?' },
    ],
    background:
      'R2 edit==worker visual parity (Phase 26 D-01). LayoutRenderer + BLOCK_COMPONENTS render the same components in both mode=edit (admin canvas / EditableDocument) and mode=read (worker /sops/[sopId]) — Puck is fully removed, so there is no separate Puck-render path to diverge. Machine-proven structurally (block-registry contract-check 18/18/18, convert-golden byte-equivalence, worker bundle Δ0); the visual "they truly look identical" judgment is a human check.',
  },
  {
    id: 'p26-baked-annotation-on-worker-read',
    dateAdded: '2026-07-03',
    category: 'Phase 26 — SOP Builder Redesign',
    title: 'Do annotations you draw show up baked onto the worker\'s diagram?',
    status: 'active',
    summary:
      'When you annotate a diagram in the builder (arrows/boxes/numbered markers) and publish, the worker should see those marks baked flat onto the image — no editing handles, exactly as drawn. This is the end-to-end annotate → publish → worker-read check on a real device.',
    tryIt: [
      'Open a procedure in the builder, add a Visual block with a diagram, and annotate it (arrow + box + a numbered marker).',
      'Close and re-open the annotation editor once to confirm your marks reload exactly (re-edit round-trip).',
      'Publish the SOP.',
      'Open the SOP as a worker (/sops/[sopId]) and find that diagram.',
      'Confirm the annotations appear baked onto the image — flat, in the right places, with no draggable handles or edit controls.',
    ],
    links: [
      { label: 'SOP management (admin — builder)', href: '/admin/sops' },
      { label: 'SOP library (worker view)', href: '/sops' },
    ],
    questions: [
      { id: 'baked', text: 'Did your annotations appear on the worker\'s diagram exactly where you drew them?' },
      { id: 'flat', text: 'On the worker view, were they flat (no edit handles or controls)?' },
      { id: 'reopen', text: 'When you re-opened the editor before publishing, did your marks reload exactly?' },
    ],
    background:
      'R5 / D-03 — annotate→re-edit→bake pipeline end-to-end. The non-destructive Konva scene (annotation-tools.ts) serializes to layout_data; on publish it bakes to a flat PNG for the worker read path (Konva stays admin-only, worker bundle Konva-free Δ0). Machine-tested for scene serialize/reopen + palm-reject + bundle isolation; the on-device annotate→publish→worker-read visual confirmation is a human check (run alongside p26-annotation-editor-feel once 26-13 wires the launch point).',
  },

  {
    id: 'agent-layer-dashboard',
    dateAdded: '2026-07-05',
    category: 'Phase 26.5 — Agent Metadata Layer',
    title: 'Does the AI agent layer feel useful, not intrusive?',
    status: 'active',
    summary:
      'There is now a machine layer working quietly behind every procedure — it reads what happens in the field and suggests improvements. You can peek at what it has learned in the builder (a purple "⚇ Agent layer" toggle) and review its suggestions on one org-wide dashboard.',
    tryIt: [
      'Open a published procedure in the builder and click the "⚇ Agent layer" toggle in the header.',
      'Check the panel is read-only — summary, tags, entities, and per-block metadata, nothing editable.',
      'Open the agent dashboard and look at the proposals queue and the recent activity feed.',
      'If there is a pending proposal, approve or decline it and confirm it leaves the queue.',
    ],
    links: [
      { label: 'SOP management (admin — builder)', href: '/admin/sops' },
      { label: 'Agent dashboard', href: '/admin/agent' },
    ],
    questions: [
      { id: 'panel-readonly', text: 'Was the agent panel in the builder clearly read-only (nothing to type into)?' },
      { id: 'evidence-clear', text: 'Was it clear what evidence a proposal was based on?' },
      { id: 'decide-works', text: 'Did approving/declining a proposal remove it from the queue?' },
      { id: 'not-intrusive', text: 'Did the agent layer feel useful rather than getting in the way?' },
    ],
    background:
      'D-09 (two surfaces: builder agentview panel, org /admin/agent dashboard), D-10 (strictly read-only metadata + approve/decline the only interactive affordance), D-11 (proposals queue primary, activity feed secondary, no cross-SOP graph viz), D-14 (activity feed proves the layer is alive). Both server actions and UI verified behaviourally (agent-panel-readonly.spec.ts, agent-dashboard.spec.ts) — this UAT entry is the human "does it feel right" check.',
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
