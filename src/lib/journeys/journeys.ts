/**
 * SafeStart — current user-experience pathways (single source of truth).
 *
 * The /pathways page renders ENTIRELY from this file. To change what the team
 * sees, edit a journey here — the diagram and the route-coverage view update
 * automatically. The live "All screens" list on that page is generated from the
 * app's actual route tree, so new screens show up on their own and any screen
 * not yet covered by a journey is flagged.
 *
 * Keep each journey to the real, current flow (not aspirational). A step's
 * `route` should be a real path so the diagram can link straight to it and the
 * coverage check can tick it off.
 */

export type StepType = 'start' | 'screen' | 'action' | 'decision' | 'end'

export interface JourneyStep {
  id: string
  type: StepType
  label: string
  /** Real route this step shows, e.g. '/sops/[sopId]'. Enables deep-link + coverage. */
  route?: string
  /** One-line plain description. */
  detail?: string
  /** For decisions / jumps: labelled outcomes pointing at another step id, 'continue', or 'end'. */
  branches?: { label: string; to: string }[]
}

export interface Journey {
  id: string
  /** Index grouping, e.g. 'Worker', 'Create an SOP'. */
  group: string
  /** Who walks this path. */
  persona: string
  title: string
  summary: string
  steps: JourneyStep[]
}

export const JOURNEY_GROUPS = [
  'Getting started',
  'Worker',
  'Supervisor',
  'Create an SOP',
  'Refine & publish',
  'Library & team',
  'Everyone',
] as const

export const JOURNEYS: Journey[] = [
  // ============================ Getting started ============================
  {
    id: 'log-in',
    group: 'Getting started',
    persona: 'Everyone',
    title: 'Log in',
    summary: 'An existing member signs in and lands on their home screen.',
    steps: [
      { id: 's', type: 'start', label: 'Has an account' },
      { id: 'login', type: 'screen', label: 'Login screen', route: '/login' },
      { id: 'auth', type: 'action', label: 'Enter email + password', detail: 'Supabase Auth verifies and sets a session.' },
      { id: 'home', type: 'screen', label: 'Home / dashboard', route: '/dashboard', detail: 'Role-aware landing.' },
      { id: 'e', type: 'end', label: 'Signed in' },
    ],
  },
  {
    id: 'sign-up',
    group: 'Getting started',
    persona: 'New organisation',
    title: 'Sign up & create an organisation',
    summary: 'A new admin creates an account and a fresh organisation.',
    steps: [
      { id: 's', type: 'start', label: 'New user' },
      { id: 'signup', type: 'screen', label: 'Sign-up screen', route: '/sign-up' },
      { id: 'create', type: 'action', label: 'Create account + organisation', detail: 'Becomes the org’s first admin.' },
      { id: 'home', type: 'screen', label: 'Dashboard', route: '/dashboard' },
      { id: 'e', type: 'end', label: 'Org ready' },
    ],
  },
  {
    id: 'join-team',
    group: 'Getting started',
    persona: 'Invited member',
    title: 'Join a team',
    summary: 'A worker or supervisor joins an existing organisation via an invite link or join code.',
    steps: [
      { id: 's', type: 'start', label: 'Got an invite' },
      { id: 'choose', type: 'decision', label: 'How were they invited?', branches: [
        { label: 'Email invite link', to: 'invite' },
        { label: 'Join code', to: 'join' },
      ] },
      { id: 'invite', type: 'screen', label: 'Accept invite', route: '/invite/accept' },
      { id: 'join', type: 'screen', label: 'Join with code', route: '/join' },
      { id: 'added', type: 'action', label: 'Added to the org with a role' },
      { id: 'home', type: 'screen', label: 'Dashboard', route: '/dashboard' },
      { id: 'e', type: 'end', label: 'On the team' },
    ],
  },

  // ================================ Worker ================================
  {
    id: 'find-follow-sop',
    group: 'Worker',
    persona: 'Worker',
    title: 'Find & open a procedure',
    summary: 'A worker finds the right SOP and opens it to read before starting work.',
    steps: [
      { id: 's', type: 'start', label: 'Needs to do a task' },
      { id: 'home', type: 'screen', label: 'Dashboard', route: '/dashboard', detail: 'Shows assigned SOPs.' },
      { id: 'lib', type: 'screen', label: 'SOP library', route: '/sops', detail: 'Browse, search, filter by trade.' },
      { id: 'detail', type: 'screen', label: 'Procedure detail', route: '/sops/[sopId]', detail: 'Tabs: overview, tools, hazards, flow, model. Flow tab defaults to spatial graph on desktop (≥1024px) with a List/Graph toggle; mobile defaults to list.' },
      { id: 'go', type: 'decision', label: 'Ready to start?', branches: [
        { label: 'Yes — walk it', to: 'walk' },
        { label: 'Just reading', to: 'e' },
      ] },
      { id: 'walk', type: 'screen', label: 'Step-by-step walkthrough', route: '/sops/[sopId]/walkthrough' },
      { id: 'e', type: 'end', label: 'Procedure open' },
    ],
  },
  {
    id: 'walkthrough-complete',
    group: 'Worker',
    persona: 'Worker',
    title: 'Follow a procedure & complete it',
    summary: 'A worker walks each step on their phone, captures evidence, and completes the job with a tamper-proof record.',
    steps: [
      { id: 's', type: 'start', label: 'In the walkthrough', route: '/sops/[sopId]/walkthrough' },
      { id: 'read', type: 'action', label: 'Read & acknowledge the step', detail: 'Must acknowledge to advance (safety).' },
      { id: 'kind', type: 'decision', label: 'What does the step need?', branches: [
        { label: 'Just read it', to: 'next' },
        { label: 'Take a photo', to: 'photo' },
        { label: 'Enter a measurement', to: 'meas' },
        { label: 'Make a yes/no decision', to: 'decide' },
      ] },
      { id: 'photo', type: 'action', label: 'Capture photo', detail: 'Compressed + queued (works offline).' },
      { id: 'meas', type: 'action', label: 'Enter reading', detail: 'Flagged if out of range.' },
      { id: 'decide', type: 'action', label: 'Choose path', detail: 'May branch or escalate.' },
      { id: 'ask', type: 'action', label: '(Optional) Ask the SOP a question', detail: 'Voice Q&A, grounded in this SOP only.' },
      { id: 'next', type: 'decision', label: 'More steps?', branches: [
        { label: 'Yes', to: 'read' },
        { label: 'Last step done', to: 'complete' },
      ] },
      { id: 'complete', type: 'action', label: 'Complete the procedure', detail: 'Creates an append-only completion record.' },
      { id: 'signoff', type: 'decision', label: 'Sign-off required?', branches: [
        { label: 'Yes → supervisor reviews', to: 'sup' },
        { label: 'No', to: 'e' },
      ] },
      { id: 'sup', type: 'screen', label: 'Supervisor review', route: '/activity/[completionId]' },
      { id: 'e', type: 'end', label: 'Job recorded' },
    ],
  },
  {
    id: 'offline-use',
    group: 'Worker',
    persona: 'Worker',
    title: 'Work offline',
    summary: 'A worker downloads a procedure ahead of time and follows it with no signal, syncing when back online.',
    steps: [
      { id: 's', type: 'start', label: 'Going somewhere with no signal' },
      { id: 'detail', type: 'screen', label: 'Procedure detail', route: '/sops/[sopId]' },
      { id: 'dl', type: 'action', label: 'Download for offline', detail: 'Cached in the browser (Dexie + service worker).' },
      { id: 'offline', type: 'action', label: 'Open & follow offline', detail: 'Steps, photos, measurements all work.' },
      { id: 'miss', type: 'decision', label: 'Open an uncached page?', branches: [
        { label: 'Yes', to: 'fallback' },
        { label: 'No', to: 'recon' },
      ] },
      { id: 'fallback', type: 'screen', label: 'Offline fallback', route: '/~offline' },
      { id: 'recon', type: 'action', label: 'Back online → sync', detail: 'Queued photos + completions reconcile automatically.' },
      { id: 'e', type: 'end', label: 'Everything saved' },
    ],
  },

  // ============================== Supervisor ==============================
  {
    id: 'review-signoff',
    group: 'Supervisor',
    persona: 'Supervisor',
    title: 'Review & sign off a completion',
    summary: 'A supervisor checks a worker’s completed procedure and signs it off, creating a second immutable record.',
    steps: [
      { id: 's', type: 'start', label: 'Completion submitted' },
      { id: 'activity', type: 'screen', label: 'Activity records', route: '/activity', detail: 'All completions for the org.' },
      { id: 'one', type: 'screen', label: 'Completion detail', route: '/activity/[completionId]', detail: 'Steps, photos, measurements, who/when.' },
      { id: 'ok', type: 'decision', label: 'Done correctly?', branches: [
        { label: 'Yes — sign off', to: 'sign' },
        { label: 'No — follow up', to: 'e' },
      ] },
      { id: 'sign', type: 'action', label: 'Sign off', detail: 'Append-only sign-off record (legal defensibility).' },
      { id: 'e', type: 'end', label: 'Reviewed' },
    ],
  },

  // ============================ Create an SOP ============================
  {
    id: 'create-from-document',
    group: 'Create an SOP',
    persona: 'SOP Admin',
    title: 'Create from a document',
    summary: 'An admin uploads an existing Word/PDF/Excel/PowerPoint/photo and AI turns it into a structured, mobile-friendly procedure.',
    steps: [
      { id: 's', type: 'start', label: 'Has an existing SOP doc' },
      { id: 'lib', type: 'screen', label: 'SOP management', route: '/admin/sops' },
      { id: 'up', type: 'screen', label: 'Upload', route: '/admin/sops/upload', detail: 'Drag in .docx/.pdf/.xlsx/.pptx/photo.' },
      { id: 'parse', type: 'action', label: 'AI parses the document', detail: 'Async pipeline (30–120s); extracts sections, steps, hazards.' },
      { id: 'status', type: 'decision', label: 'Parse result?', branches: [
        { label: 'Done → review it', to: 'builder' },
        { label: 'Failed → retry', to: 'up' },
      ] },
      { id: 'builder', type: 'screen', label: 'Builder (review & publish)', route: '/admin/sops/builder/[sopId]' },
      { id: 'e', type: 'end', label: 'Draft ready to refine' },
    ],
  },
  {
    id: 'create-from-video',
    group: 'Create an SOP',
    persona: 'SOP Admin',
    title: 'Create from a video or recording',
    summary: 'An admin uploads a video, records one, or pastes a YouTube link; the audio is transcribed into a draft procedure.',
    steps: [
      { id: 's', type: 'start', label: 'Has a video of the task' },
      { id: 'up', type: 'screen', label: 'Upload / record / YouTube', route: '/admin/sops/upload' },
      { id: 'trans', type: 'action', label: 'Transcribe audio', detail: 'Domain vocabulary prompt; numbers + chemicals flagged for confirmation.' },
      { id: 'pipe', type: 'screen', label: 'Pipeline progress', route: '/admin/sops/pipeline/[pipelineId]' },
      { id: 'builder', type: 'screen', label: 'Builder', route: '/admin/sops/builder/[sopId]' },
      { id: 'e', type: 'end', label: 'Draft ready' },
    ],
  },
  {
    id: 'create-with-ai',
    group: 'Create an SOP',
    persona: 'SOP Admin',
    title: 'Draft with AI',
    summary: 'An admin describes the procedure in plain words and AI drafts a first version.',
    steps: [
      { id: 's', type: 'start', label: 'No document — just knowledge' },
      { id: 'ai', type: 'screen', label: 'AI draft', route: '/admin/sops/new/ai' },
      { id: 'prompt', type: 'action', label: 'Describe the procedure', detail: 'AI generates structured sections + steps.' },
      { id: 'builder', type: 'screen', label: 'Builder', route: '/admin/sops/builder/[sopId]' },
      { id: 'e', type: 'end', label: 'Draft ready' },
    ],
  },
  {
    id: 'create-blank',
    group: 'Create an SOP',
    persona: 'SOP Admin',
    title: 'Author from blank',
    summary: 'An admin builds a procedure from scratch using a guided wizard, then the builder.',
    steps: [
      { id: 's', type: 'start', label: 'Build it by hand' },
      { id: 'blank', type: 'screen', label: 'Blank wizard', route: '/admin/sops/new/blank', detail: 'Title, sections, category.' },
      { id: 'builder', type: 'screen', label: 'Builder', route: '/admin/sops/builder/[sopId]' },
      { id: 'e', type: 'end', label: 'Draft ready' },
    ],
  },

  // =========================== Refine & publish ===========================
  {
    id: 'builder-review-publish',
    group: 'Refine & publish',
    persona: 'SOP Admin',
    title: 'Review, verify & publish in the builder',
    summary: 'The core editing flow: shape the content, check it against the source with AI help, verify every safety block, then publish.',
    steps: [
      { id: 's', type: 'start', label: 'Have a draft' },
      { id: 'build', type: 'screen', label: 'Build stage', route: '/admin/sops/builder/[sopId]', detail: 'Step-centric rail; add/edit blocks inline.' },
      { id: 'review', type: 'action', label: 'Review stage', detail: 'Source viewer side-by-side; AI reviewer flags omissions/anchoring; per-block verify checklist.' },
      { id: 'verify', type: 'decision', label: 'Every block verified?', branches: [
        { label: 'Yes', to: 'pubstage' },
        { label: 'No — gate blocks publish', to: 'review' },
      ] },
      { id: 'pubstage', type: 'action', label: 'Publish stage', detail: 'Single publish trigger; gated on full verification.' },
      { id: 'publish', type: 'action', label: 'Publish', route: '/admin/sops/[sopId]/publish', detail: 'SOP goes live for assigned workers.' },
      { id: 'e', type: 'end', label: 'Published' },
    ],
  },
  {
    id: 'assign-sop',
    group: 'Refine & publish',
    persona: 'SOP Admin',
    title: 'Assign to the team',
    summary: 'An admin assigns a published procedure to roles, trades or specific sub-trades; workers get notified.',
    steps: [
      { id: 's', type: 'start', label: 'SOP published' },
      { id: 'lib', type: 'screen', label: 'SOP management', route: '/admin/sops' },
      { id: 'assign', type: 'screen', label: 'Assign', route: '/admin/sops/[sopId]/assign', detail: 'By role / trade / sub-trade.' },
      { id: 'notify', type: 'action', label: 'Workers notified', detail: 'Appears in their library + dashboard.' },
      { id: 'e', type: 'end', label: 'Assigned' },
    ],
  },
  {
    id: 'version-supersede',
    group: 'Refine & publish',
    persona: 'SOP Admin',
    title: 'Publish a new version',
    summary: 'An admin revises a live procedure; the new version supersedes the old and assigned workers are told to re-read.',
    steps: [
      { id: 's', type: 'start', label: 'SOP needs an update' },
      { id: 'versions', type: 'screen', label: 'Version history', route: '/admin/sops/[sopId]/versions' },
      { id: 'new', type: 'action', label: 'Start a new version' },
      { id: 'builder', type: 'screen', label: 'Builder (re-review)', route: '/admin/sops/builder/[sopId]' },
      { id: 'republish', type: 'action', label: 'Republish', detail: 'Supersedes the prior version; workers notified.' },
      { id: 'e', type: 'end', label: 'New version live' },
    ],
  },
  {
    id: 'generate-video',
    group: 'Refine & publish',
    persona: 'SOP Admin',
    title: 'Generate a video',
    summary: 'An admin turns a published procedure into a narrated video.',
    steps: [
      { id: 's', type: 'start', label: 'Want a video version' },
      { id: 'video', type: 'screen', label: 'Generate video', route: '/admin/sops/[sopId]/video', detail: 'Pick a format.' },
      { id: 'pipe', type: 'action', label: 'Render pipeline', detail: 'Narrated slideshow / screen recording.' },
      { id: 'e', type: 'end', label: 'Video ready' },
    ],
  },

  // ============================ Library & team ============================
  {
    id: 'reusable-blocks',
    group: 'Library & team',
    persona: 'SOP Admin',
    title: 'Manage reusable blocks',
    summary: 'Admins keep a library of reusable safety blocks; when a block changes, SOPs using it flag the update for review.',
    steps: [
      { id: 's', type: 'start', label: 'Standardise a hazard / PPE / step' },
      { id: 'blocks', type: 'screen', label: 'Block library', route: '/admin/blocks' },
      { id: 'edit', type: 'screen', label: 'Edit a block', route: '/admin/blocks/[blockId]' },
      { id: 'update', type: 'action', label: 'Block updated', detail: 'SOPs using it show an “update available” badge.' },
      { id: 'review', type: 'decision', label: 'Per SOP', branches: [
        { label: 'Accept update', to: 'e' },
        { label: 'Decline (keep snapshot)', to: 'e' },
      ] },
      { id: 'e', type: 'end', label: 'Library consistent' },
    ],
  },
  {
    id: 'manage-team',
    group: 'Library & team',
    persona: 'SOP Admin',
    title: 'Manage team & roles',
    summary: 'An admin manages members, sets roles, and assigns sub-trades that gate which SOPs each worker sees.',
    steps: [
      { id: 's', type: 'start', label: 'Set up the team' },
      { id: 'team', type: 'screen', label: 'Team management', route: '/admin/team' },
      { id: 'roles', type: 'action', label: 'Set roles + sub-trades + departments', detail: 'Worker / Supervisor / SOP Admin / Safety Manager. Departments gate SOP visibility.' },
      { id: 'e', type: 'end', label: 'Access configured' },
    ],
  },

  {
    id: 'manage-departments',
    group: 'Library & team',
    persona: 'SOP Admin',
    title: 'Manage departments',
    summary: 'An admin creates departments, assigns owners, and uses them to organise SOPs, blocks, and team members.',
    steps: [
      { id: 's', type: 'start', label: 'Need to organise by department' },
      { id: 'depts', type: 'screen', label: 'Departments', route: '/admin/departments' },
      { id: 'create', type: 'action', label: 'Create department', detail: 'Name, code, colour, icon, owner.' },
      { id: 'owner', type: 'action', label: 'Set owner', detail: 'Clears the "No owner assigned" warning.' },
      { id: 'e', type: 'end', label: 'Department ready' },
    ],
  },

  // ================================ Everyone ================================
  {
    id: 'give-feedback',
    group: 'Everyone',
    persona: 'Everyone',
    title: 'Give product feedback',
    summary: 'The team reviews design directions and before/after changes and leaves structured feedback for analysis.',
    steps: [
      { id: 's', type: 'start', label: 'Asked to review' },
      { id: 'paths', type: 'screen', label: 'Review current workflows', route: '/pathways', detail: 'See how the app works today (this page).' },
      { id: 'uat', type: 'screen', label: 'Feedback hub', route: '/uat' },
      { id: 'open', type: 'action', label: 'Open a test → compare before/after' },
      { id: 'answer', type: 'action', label: 'Answer + save', detail: 'Yes/No/Not sure, overall, comments.' },
      { id: 'export', type: 'action', label: 'AI analyses results', route: '/api/uat/export' },
      { id: 'e', type: 'end', label: 'Feedback captured' },
    ],
  },
  {
    id: 'manage-account',
    group: 'Everyone',
    persona: 'Everyone',
    title: 'Manage your account',
    summary: 'A member views and updates their own profile and preferences.',
    steps: [
      { id: 's', type: 'start', label: 'Open your account' },
      { id: 'profile', type: 'screen', label: 'Profile', route: '/profile', detail: 'Your details, preferences, and sign out.' },
      { id: 'save', type: 'action', label: 'Update details' },
      { id: 'e', type: 'end', label: 'Account updated' },
    ],
  },
]

export function journeysByGroup(): { group: string; journeys: Journey[] }[] {
  return JOURNEY_GROUPS.map((group) => ({
    group,
    journeys: JOURNEYS.filter((j) => j.group === group),
  })).filter((g) => g.journeys.length > 0)
}

/** Every route referenced by any journey step (normalised). */
export function coveredRoutes(): Set<string> {
  const s = new Set<string>()
  for (const j of JOURNEYS) for (const step of j.steps) if (step.route) s.add(step.route)
  return s
}

/** Which journeys touch a given route. */
export function journeysForRoute(route: string): Journey[] {
  return JOURNEYS.filter((j) => j.steps.some((s) => s.route === route))
}
