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
      { id: 'auth', type: 'action', label: 'Enter email + password', detail: 'Supabase Auth verifies and sets a session. roleHome(role) picks the landing screen (UX-01).' },
      { id: 'legacy-dash', type: 'screen', label: 'Legacy /dashboard link (optional)', route: '/dashboard', detail: 'Redirect-only shim (UX-01 decision #5) — old bookmarks and internal guard fallbacks forward through roleHome(role) to the real role home. No UI renders here.' },
      { id: 'role', type: 'decision', label: 'Role?', branches: [
        { label: 'Worker', to: 'worker-home' },
        { label: 'Supervisor / Safety manager', to: 'super-home' },
        { label: 'Admin', to: 'admin-home' },
        { label: 'No role yet', to: 'pending-home' },
      ] },
      { id: 'worker-home', type: 'screen', label: 'SOP library', route: '/sops' },
      { id: 'super-home', type: 'screen', label: 'Sign-off', route: '/activity' },
      { id: 'admin-home', type: 'screen', label: 'Admin SOP library', route: '/admin/sops' },
      { id: 'pending-home', type: 'screen', label: 'Account pending', route: '/pending', detail: 'Holding screen until an admin assigns a role.' },
      { id: 'e', type: 'end', label: 'Signed in' },
    ],
  },
  {
    id: 'roster-login',
    group: 'Getting started',
    persona: 'Worker (shared device)',
    title: 'Roster name-select login (D-11)',
    summary: 'A worker on a shared device selects their name from the org roster — no password required. This is a standard browser login page; the shared-device account session (role=worker) is established once by an admin. Completing the SOP is the legal signature (D-09).',
    steps: [
      { id: 's', type: 'start', label: 'Shared device (admin-authenticated shared-device account)' },
      { id: 'roster', type: 'screen', label: 'Roster name-select', route: '/login/roster', detail: 'RosterSelector fetches org worker roster (/api/roster) and renders large glove-friendly tap-target name buttons. Admin/supervisor sessions are redirected to their role home (escalation guard T-23-06-02).' },
      { id: 'select', type: 'action', label: 'Tap name from roster', detail: 'roster_worker_id stored in sessionStorage. Shared-device account (RLS key) session unchanged.' },
      { id: 'sops', type: 'screen', label: 'SOP library', route: '/sops', detail: 'Worker browses SOPs. "Updated since last completion" badge appears on any SOP newer than their last completion (AFL-VER-04 / D-08).' },
      { id: 'detail', type: 'screen', label: 'Procedure detail', route: '/sops/[sopId]', detail: 'Reads the SOP before walking it.' },
      { id: 'walk', type: 'screen', label: 'Step-by-step walkthrough (Walk it tab)', route: '/sops/[sopId]', detail: 'Worker steps through using tap or voice (Phase 22). Walk it tab on the SOP detail (?tab=walk; legacy ?tab=walkthrough still lands).' },
      { id: 'complete', type: 'action', label: 'Complete + worker self-sign', detail: 'Completing the SOP IS the worker signature (D-09). recordSignature() binds roster_worker_id to the completion record for attribution.' },
      { id: 'countersign', type: 'decision', label: 'Counter-sign required?', branches: [
        { label: 'Yes — supervisor counter-signs', to: 'sup' },
        { label: 'No', to: 'e' },
      ] },
      { id: 'sup', type: 'screen', label: 'Supervisor review + counter-sign', route: '/activity/[completionId]', detail: 'Supervisor selects their name from roster and counter-signs. Second immutable record (D-10).' },
      { id: 'e', type: 'end', label: 'SOP completion signed and recorded' },
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
      { id: 'home', type: 'screen', label: 'Admin home — SOP library', route: '/admin/sops' },
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
      { id: 'home', type: 'screen', label: 'Role home (workers → SOP library)', route: '/sops', detail: 'roleHome(role) dispatch — join-by-code always joins as worker.' },
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
      { id: 'lib', type: 'screen', label: 'SOP library', route: '/sops', detail: 'Browse, search, filter by trade. "Updated since last completion" badge (AFL-VER-04) marks any SOP published after the worker\'s last completion. Phase 36 (REF-01): a "Refresher due"/"Refresher overdue" chip appears alongside it once the SOP\'s refresher interval has elapsed since the worker\'s last completion — informational only, never blocks opening the card.' },
      { id: 'detail', type: 'screen', label: 'Procedure detail', route: '/sops/[sopId]', detail: 'Tabs: read, walk, flow (Phase 30 UX-05 — Read merges the old Overview/Tools/Hazards brief; legacy ?tab= params map onto the new tabs). Flow tab defaults to spatial graph on desktop (≥1024px) with a List/Graph toggle; mobile defaults to list. Admins/safety managers see an "Edit in builder" link here to deliberately open this SOP in the admin builder.' },
      { id: 'go', type: 'decision', label: 'Ready to start?', branches: [
        { label: 'Yes — walk it', to: 'walk' },
        { label: 'Just reading', to: 'e' },
      ] },
      { id: 'walk', type: 'screen', label: 'Step-by-step walkthrough (Walk it tab)', route: '/sops/[sopId]', detail: 'Walk it tab (?tab=walk).' },
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
      { id: 's', type: 'start', label: 'In the walkthrough (Walk it tab)', route: '/sops/[sopId]' },
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
      { id: 'ask', type: 'action', label: '(Optional) Voice interaction — ask a question or say "next"/"done"', detail: 'Phase 22: voice-driven mode on the mobile immersive surface. Mic pill → push-to-talk → classifyIntent routes to: (a) voice "next"/"done" → handleMarkComplete (same D-02 safety-ack path as the tap button); (b) voice question → AI Q&A grounded in this SOP, answer read aloud via TTS; step text is read aloud on each advance (VDW-LIT-03). Always-on tap equivalents remain (D-04). No new route — voice is a mode layer on the SOP detail Walk it tab (?tab=walk).' },
      { id: 'next', type: 'decision', label: 'More steps?', branches: [
        { label: 'Yes', to: 'read' },
        { label: 'Last step done', to: 'complete' },
      ] },
      { id: 'complete', type: 'action', label: 'Complete + worker self-sign', detail: 'Creates an append-only completion record. Completing IS the worker signature (D-09). recordSignature() binds roster_worker_id for attribution (AFL-VER-05).' },
      { id: 'signoff', type: 'decision', label: 'Supervisor counter-sign required?', branches: [
        { label: 'Yes → supervisor counter-signs', to: 'sup' },
        { label: 'No', to: 'e' },
      ] },
      { id: 'sup', type: 'screen', label: 'Supervisor review + counter-sign', route: '/activity/[completionId]', detail: 'Supervisor counter-signs — second immutable record (D-10 / AFL-VER-05).' },
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
      { id: 'activity', type: 'screen', label: 'Sign-off records', route: '/activity', detail: 'All completions for the org. Admins see the same sign-off queue (no longer redirected to /admin/sops).' },
      { id: 'one', type: 'screen', label: 'Completion detail', route: '/activity/[completionId]', detail: 'Steps, photos, measurements, who/when.' },
      { id: 'ok', type: 'decision', label: 'Done correctly?', branches: [
        { label: 'Yes — sign off', to: 'sign' },
        { label: 'No — follow up', to: 'e' },
      ] },
      { id: 'sign', type: 'action', label: 'Sign off', detail: 'Append-only sign-off record (legal defensibility).' },
      { id: 'e', type: 'end', label: 'Reviewed' },
    ],
  },

  {
    id: 'record-observation',
    group: 'Supervisor',
    persona: 'Supervisor',
    title: 'Record an observation of a worker',
    summary: 'A supervisor watches a worker perform a SOP in person and records a verdict + optional note — supervisor-initiated counter-evidence to worker-initiated completions (D-01/D-03).',
    steps: [
      { id: 's', type: 'start', label: 'Watched a worker perform a SOP' },
      { id: 'entry', type: 'decision', label: 'Where from?', branches: [
        { label: 'Walking the floor — org chart/team', to: 'team' },
        { label: 'Just watched a completion', to: 'activity' },
      ] },
      { id: 'team', type: 'screen', label: 'Team — person panel', route: '/admin/team', detail: 'Click a person chip on the org chart or columns board to open their PersonPanel; "Record observation" pre-fills the worker.' },
      { id: 'activity', type: 'screen', label: 'Sign-off — record button / row action', route: '/activity', detail: '"Record observation" header button, or a per-completion "I observed this" row action pre-filling worker + SOP + completion_id.' },
      { id: 'modal', type: 'screen', label: 'Record observation modal', detail: 'Shared modal: worker chip, SOP picker (assigned-first), verdict buttons, optional note. "Permanent record — cannot be edited or deleted after saving" (D-08).' },
      { id: 'assessor-check', type: 'decision', label: 'Recording "performed to SOP"? Is the recorder a signed-off assessor on this SOP? (ASR-01 gate — "needs support" is never gated, D-04)', branches: [
        { label: 'Signed off — proceed as normal', to: 'save' },
        { label: 'Not signed off, but admin/safety manager', to: 'override' },
        { label: 'Not signed off, plain supervisor', to: 'blocked' },
      ] },
      { id: 'override', type: 'action', label: 'Assessor override', detail: 'Admin/safety manager without assessor status types a reason (min 10 characters); the record is stamped is_assessor_override + the reason for the permanent audit trail, then saves (D-05/D-06).' },
      { id: 'blocked', type: 'action', label: 'Blocked — request assessment', detail: 'A plain supervisor without assessor status cannot record "performed to SOP" on this SOP. A one-tap "Request assessment" notifies the org’s admins/safety managers (D-08); recording "needs support" is unaffected.' },
      { id: 'save', type: 'action', label: 'Save observation', detail: 'recordObservation() inserts append-only; sop_version server-resolved (D-10).' },
      { id: 'e', type: 'end', label: 'Observation saved' },
    ],
  },
  {
    id: 'request-assessment',
    group: 'Supervisor',
    persona: 'Supervisor / Admin',
    title: 'Request and resolve an assessment',
    summary: 'A blocked supervisor asks to be signed off on a SOP; an admin or safety manager sees the request and assesses them directly from the inbox (closes the D-08 request loop, ASR-01).',
    steps: [
      { id: 's', type: 'start', label: 'Supervisor tapped "Request assessment"' },
      { id: 'notify', type: 'action', label: 'Request sent', detail: 'requestAssessorReview() notifies every admin/safety manager in the org; repeat taps are deduped.' },
      { id: 'team', type: 'screen', label: 'Team — assessment requests', route: '/admin/team', detail: 'AssessmentRequestsPanel lists open requests: who asked, which SOP.' },
      { id: 'assess', type: 'action', label: 'Assess now', detail: 'Opens the same Record observation modal, preset to that person + SOP.' },
      { id: 'save', type: 'action', label: 'Save observation', detail: 'A "performed to SOP" verdict here signs the supervisor off — the assessor gate resolves for them with no further overrides needed (D-05).' },
      { id: 'e', type: 'end', label: 'Request resolved' },
    ],
  },
  {
    id: 'worker-sees-observations',
    group: 'Worker',
    persona: 'Worker',
    title: 'See observations recorded about you',
    summary: 'A worker views every observation their supervisors have made about them, in full — verdict, note, observer, date, SOP version — with no ability to edit, delete or hide any of it (D-08).',
    steps: [
      { id: 's', type: 'start', label: 'Wants to check their training evidence' },
      { id: 'profile', type: 'screen', label: 'Profile', route: '/profile', detail: '"Observations about you" section, with a plain-language trust banner (NZ Privacy Act framing).' },
      { id: 'read', type: 'action', label: 'Read observation history', detail: 'Verdict, note, observer name, date, SOP version — every row where observed_worker_id = self, newest first.' },
      { id: 'e', type: 'end', label: 'Sees the full record' },
    ],
  },

  // ============================ Create an SOP ============================
  {
    id: 'enter-admin-tools',
    group: 'Create an SOP',
    persona: 'SOP Admin',
    title: 'Switch into admin tools',
    summary: 'An admin signs in and lands directly on the admin SOP library (UX-01 one home per role). Worker surfaces remain reachable from the primary nav; from any worker surface, the account menu’s single "Admin" link returns here (UX-02 one door to admin).',
    steps: [
      { id: 's', type: 'start', label: 'Signed in as admin / safety manager' },
      { id: 'home', type: 'screen', label: 'Admin home — SOP library', route: '/admin/sops', detail: 'roleHome(admin) lands here — the brand mark and the account menu’s one "Admin" link both resolve here too. Worker surfaces (SOPs · Sign-off) stay one tap away in the primary nav.' },
      { id: 'menu', type: 'decision', label: 'Open another admin surface? (shared AdminNav: SOPs · Governance · Blocks · Team · Settings)', branches: [
        { label: 'SOPs', to: 'sops' },
        { label: 'Governance (SOPs needing attention)', to: 'sops' },
        { label: 'Blocks', to: 'blocks' },
        { label: 'Team', to: 'team' },
        { label: 'Settings', to: 'settings' },
        { label: 'Stay on worker path', to: 'e' },
      ] },
      { id: 'sops', type: 'screen', label: 'SOP management', route: '/admin/sops', detail: 'The Governance nav item deep-links /admin/sops?view=attention — the folded needs-attention view (UX-03): governance queue, filter chips, header flag counts. An "Access" tab deep-links /admin/sops?view=access — the D-hybrid wiring surface (D-09), a third fold of this same route.' },
      { id: 'blocks', type: 'screen', label: 'Block library', route: '/admin/blocks' },
      { id: 'team', type: 'screen', label: 'Team & org model', route: '/admin/team', detail: 'Org model surface (D-08) — Node Chart default, ▤ Columns toggle absorbs member management.' },
      { id: 'settings', type: 'screen', label: 'Settings hub', route: '/admin/settings', detail: 'Groups AI Settings, Departments, the AI agent layer, and the approval-chain editor under one home.' },
      { id: 'ai', type: 'screen', label: 'AI Settings', route: '/admin/ai-settings', detail: 'Reached from the Settings hub. Per-organisation AI model overrides (parse pipeline) + read-only view of every env-managed model.' },
      { id: 'e', type: 'end', label: 'On the chosen path' },
    ],
  },
  {
    id: 'create-from-document',
    group: 'Create an SOP',
    persona: 'SOP Admin',
    title: 'Create from a document',
    summary: 'An admin uploads an existing Word/PDF/Excel/PowerPoint/photo and AI turns it into a structured, mobile-friendly procedure.',
    steps: [
      { id: 's', type: 'start', label: 'Has an existing SOP doc' },
      { id: 'lib', type: 'screen', label: 'SOP management', route: '/admin/sops', detail: 'Single "New SOP" button (UX-04 — the one create entry).' },
      { id: 'picker', type: 'screen', label: 'New SOP method picker', route: '/admin/sops/new', detail: '4 tiles, Upload first: Upload a document · Talk it through · Describe it · Start blank.' },
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
      { id: 'picker', type: 'screen', label: 'New SOP method picker', route: '/admin/sops/new', detail: 'Video lives behind "Upload a document".' },
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
      { id: 'picker', type: 'screen', label: 'New SOP method picker', route: '/admin/sops/new', detail: '"Describe it" tile.' },
      { id: 'ai', type: 'screen', label: 'AI draft', route: '/admin/sops/new/ai' },
      { id: 'prompt', type: 'action', label: 'Describe the procedure', detail: 'AI generates structured sections + steps.' },
      { id: 'builder', type: 'screen', label: 'Builder', route: '/admin/sops/builder/[sopId]' },
      { id: 'e', type: 'end', label: 'Draft ready' },
    ],
  },
  {
    id: 'machine-qr',
    group: 'Follow a SOP',
    persona: 'Worker',
    title: 'Scan the machine QR code',
    summary: 'Admin prints a QR sticker for the machine; the worker at the machine scans it and lands directly on that procedure — no library browsing.',
    steps: [
      { id: 's', type: 'start', label: 'Admin: SOP is published' },
      { id: 'qr', type: 'screen', label: 'Print QR sticker', route: '/admin/sops/[sopId]/qr', detail: 'Server-rendered QR encoding the worker deep link. Stick it on the machine/work area.' },
      { id: 'scan', type: 'action', label: 'Worker scans sticker on the machine' },
      { id: 'detail', type: 'screen', label: 'Procedure detail', route: '/sops/[sopId]' },
      { id: 'walk', type: 'screen', label: 'Walkthrough (Walk it tab)', route: '/sops/[sopId]', detail: 'Walk it tab (?tab=walk).' },
      { id: 'e', type: 'end', label: 'Right SOP, zero searching' },
    ],
  },
  {
    id: 'create-with-voice',
    group: 'Create an SOP',
    persona: 'SOP Admin',
    title: 'Talk through a SOP (voice draft)',
    summary: 'An admin describes the procedure out loud; an AI interviewer asks follow-up questions, builds a brief, then drafts through the same AI pipeline.',
    steps: [
      { id: 's', type: 'start', label: 'Easier to say than type' },
      { id: 'picker', type: 'screen', label: 'New SOP method picker', route: '/admin/sops/new', detail: '"Talk it through" tile deep-links ?mode=voice (honoured by AiDraftTabs).' },
      { id: 'voice', type: 'screen', label: 'Voice draft conversation (Talk it through tab)', route: '/admin/sops/new/ai', detail: 'Mic → live transcription → AI follow-up questions (spoken + text). Brief accumulates as you talk.' },
      { id: 'gen', type: 'action', label: 'Generate draft', detail: 'The accumulated brief feeds the same /api/sops/ai-prompt pipeline as the typed workflow.' },
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
      { id: 'picker', type: 'screen', label: 'New SOP method picker', route: '/admin/sops/new', detail: '"Start blank" tile.' },
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
    summary: 'The core editing flow: shape the content, check it against the source with AI help, verify every safety block, then publish. Create-from-scratch, AI-convert and edit-draft all converge on this one bespoke builder surface (Phase 26 D-01: Puck removed — inline block editing, no separate field popovers).',
    steps: [
      { id: 's', type: 'start', label: 'Have a draft' },
      { id: 'build', type: 'screen', label: 'Build stage', route: '/admin/sops/builder/[sopId]', detail: 'Bespoke editor: step-centric rail; the admin edits the SAME block components the worker reads, in place (edit==worker parity, R2). Add/edit/reorder/duplicate blocks inline; every field reachable (P14, 0 unreachable). Image blocks open a Konva annotation layer (arrows/boxes/text, palm-reject) that bakes to a flat PNG on publish. A light Wayfinder header (Phase 33 SC-6) tops every stage: back-to-library / you\'re-editing / next-stage zones, with a single "Tools for this SOP" menu (assign, versions, video, QR, flow diagram, delete draft).' },
      { id: 'review', type: 'action', label: 'Review stage', detail: 'Source viewer side-by-side; AI reviewer flags omissions/anchoring; per-block verify checklist. The Wayfinder header\'s forward chip states the lock reason inline ("Locked — N steps below still need checking").' },
      { id: 'verify', type: 'decision', label: 'Every block verified?', branches: [
        { label: 'Yes', to: 'pubstage' },
        { label: 'No — gate blocks publish', to: 'review' },
      ] },
      { id: 'pubstage', type: 'action', label: 'Publish stage', detail: 'Single publish trigger; gated on full verification.' },
      { id: 'publish', type: 'action', label: 'Publish', route: '/admin/sops/[sopId]/publish', detail: 'SOP goes live for assigned workers. A "Choose who sees it →" CTA appears once published (D-12a).' },
      { id: 'e', type: 'end', label: 'Published' },
    ],
  },
  {
    id: 'wire-up-access',
    group: 'Refine & publish',
    persona: 'SOP Admin',
    title: 'Choose who sees a SOP',
    summary: 'An admin picks which org units (and people) can see a SOP in their library on the Access map — full site→area→department→role→person ladder on the left, collections expandable to their SOPs on the right (33-08), every screen answering "Who can see this?" / "What can they see?" in plain language (33-09). The same surface also works as a library filter (SC-4) and reaches any SOP organically, pinned or drilled-down (D-12b).',
    steps: [
      { id: 's', type: 'start', label: 'SOP just published (or any existing SOP)' },
      { id: 'cta', type: 'action', label: '"Choose who sees it →" CTA on the Publish stage', detail: 'D-12a — only shown once the SOP is published; jumps straight into choose-mode for it.' },
      { id: 'access', type: 'screen', label: 'Access map', route: '/admin/sops?view=access', detail: 'Site→area→department→role→person on the left, collections on the right — expand a collection to see the SOPs inside it (33-08 SC-2). The CTA pins this SOP tagged NEW atop its collection; opening the map directly (D-12b) or drilling into any collection reaches any SOP the same way.' },
      { id: 'connect', type: 'action', label: 'Choose people, roles or teams', detail: 'Each choice draws a live line and updates a plain "N people can see this" blast-radius banner.' },
      { id: 'done', type: 'action', label: '✓ Save — done', detail: 'Writes an additive SOP-target grant (D-11) via createGrant, materializing into sop_departments/sop_access_people — the SOP becomes "chosen by name" and stops following its collection until every named person is removed again (33-05).' },
      { id: 'panel', type: 'action', label: 'Read the answer panel', detail: 'Below the map, a plain-language panel states who can see the selected SOP/collection (or what a selected person/team can see) — no "wire"/"grant"/"UNWIRED" wording anywhere (33-09 SC-5).' },
      { id: 'filter', type: 'action', label: 'Focus a unit to filter the library', detail: 'Clicking a department/collection jack surfaces an "Open in library →" link to /admin/sops?departments=<id> or ?collection=<id> — the same viz doubles as a filter (SC-4).' },
      { id: 'e', type: 'end', label: 'Access set' },
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
    summary: 'An admin revises a live procedure via clone-to-draft or file upload; the new version supersedes the old and assigned workers are told to re-read. Admins can also compare any two versions side-by-side or restore an old version as a new draft. (Phase 23-05: D-05 clone, D-06 restore, D-07 diff)',
    steps: [
      { id: 's', type: 'start', label: 'SOP needs an update' },
      { id: 'versions', type: 'screen', label: 'Version history', route: '/admin/sops/[sopId]/versions', detail: 'Edit into new version (clone), Upload new version, Restore old version, or Compare two versions. Phase 36 (TRN-03): each version row also shows a completion-count breakdown (how many workers completed that version, expandable to names + dates), an "outdated version" coaching note for stragglers, and a refresher-interval control (REF-01/REF-02) for how often workers must re-walk this SOP — informational/admin-only, never gates a worker\'s read access.' },
      { id: 'choose', type: 'decision', label: 'How to create the new version?', branches: [
        { label: 'Edit into new version (clone)', to: 'clone' },
        { label: 'Upload a new file', to: 'builder' },
        { label: 'Restore an old version', to: 'restore' },
        { label: 'Compare versions', to: 'diff' },
      ] },
      { id: 'clone', type: 'action', label: 'Clone published SOP → new draft', detail: 'cloneSopAsDraft() copies sections/steps/blocks into a new draft. History stays append-only.' },
      { id: 'restore', type: 'action', label: 'Restore old version → new draft', detail: 'restoreVersionAsNew() copies old content forward as a new draft. Old row never mutated (D-06).' },
      { id: 'diff', type: 'screen', label: 'Side-by-side version diff', route: '/admin/sops/[sopId]/versions/diff', detail: 'diffBlockContent() compares two versions client-side. Both fetched via admin client (superseded visible, D-07).' },
      { id: 'builder', type: 'screen', label: 'Builder (edit draft)', route: '/admin/sops/builder/[sopId]' },
      { id: 'republish', type: 'action', label: 'Republish', detail: 'Supersedes the prior version; workers notified. Updated badge appears on worker SOP card (D-08).' },
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
  {
    id: 'agent-layer',
    group: 'Refine & publish',
    persona: 'SOP Admin',
    title: 'Inspect the machine layer & review proposals',
    summary: 'An admin peeks behind the human-facing SOP at what the AI agent has synthesised — a read-only per-SOP/per-block metadata panel in the builder — then reviews and decides on the evidence-backed proposals it has raised across the whole org.',
    steps: [
      { id: 's', type: 'start', label: 'Curious what the agent has synthesised' },
      { id: 'build', type: 'screen', label: 'Builder', route: '/admin/sops/builder/[sopId]', detail: 'Toggle "⚇ Agent layer" reveals a read-only purple panel: summary, tags, entities, embedding status, links, plus per-block metadata rows keyed by junction id.' },
      { id: 'toggle', type: 'action', label: 'Toggle ⚇ Agent layer', detail: 'Strictly read-only — nothing here is hand-editable, it regenerates on publish (D-10).' },
      { id: 'dash', type: 'screen', label: 'Org agent dashboard', route: '/admin/agent', detail: 'Evidence-backed proposals queue (primary) + recent memory/metadata-refresh activity feed (secondary). No cross-SOP graph viz this phase (D-11/D-13).' },
      { id: 'decide', type: 'decision', label: 'Act on a proposal?', branches: [
        { label: 'Approve', to: 'e' },
        { label: 'Decline', to: 'e' },
      ] },
      { id: 'e', type: 'end', label: 'Proposal decided, row leaves the queue' },
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
      { id: 'team', type: 'screen', label: 'Team & org model', route: '/admin/team', detail: 'Phase 32 (D-08): the Team tab is now the org model. Node Chart (org -> area -> department -> role, people as chips) renders by default with an in-page ⊞ Chart / ▤ Columns toggle; Columns absorbs the old member roster (invite, org-privilege role, department picker) as a collapsible sub-panel.' },
      { id: 'roles', type: 'action', label: 'Set org roles + job roles + departments', detail: 'Org-privilege role (Worker / Supervisor / SOP Admin / Safety Manager) via the Columns sub-panel; job roles + vacancies + headcount live on the org chart itself (D-05).' },
      { id: 'e', type: 'end', label: 'Access configured' },
    ],
  },

  {
    id: 'training-matrix-records',
    group: 'Library & team',
    persona: 'Supervisor / Admin',
    title: 'See training status & records',
    summary: 'A supervisor or admin opens the training matrix to see who has read, been observed on, or been signed off for each required SOP, drills into one worker\'s record, and exports a SuccessFactors-shaped CSV for an audit. Workers see their own states too, read-only.',
    steps: [
      { id: 's', type: 'start', label: 'Needs a pre-audit training scan' },
      { id: 'team', type: 'screen', label: 'Team & org model', route: '/admin/team', detail: 'Phase 35 (D-06): a third ▦ Matrix view mode alongside ⊞ Chart / ▤ Columns.' },
      { id: 'toggle', type: 'action', label: 'Toggle ▦ Matrix', detail: 'Department-first cut with labelled state pills + both-axis rollups; MTX-03 department/worker/SOP filters narrow it further.' },
      { id: 'cell', type: 'action', label: 'Click a state pill cell', detail: 'onSelectCell opens the PersonPanel focused on that person + SOP (D-09).' },
      { id: 'record', type: 'screen', label: 'PersonPanel training record', route: '/admin/team', detail: 'Grouped-by-SOP evidence trail + "Other completed SOPs" section (TRN-01/D-12/D-13).' },
      { id: 'export', type: 'action', label: 'Export CSV', detail: 'Matrix header (filtered cut) or PersonPanel (one worker) — both call the same exportTrainingCsv generator (D-16/TRN-02).' },
      { id: 'own', type: 'screen', label: 'Worker sees their own competency state', route: '/profile', detail: '"My competency" section — read-only, informational, never gates access (CMP-04). Phase 36 (REF-01/CMP-03): each SOP row can also carry an "Outdated version" chip (their last completion predates the current version, but their evidence is never lost or reset) and a "Refresher due"/"Refresher overdue" chip — both passive coaching signals, never a lock.' },
      { id: 'e', type: 'end', label: 'Training status visible, evidence exportable' },
    ],
  },
  {
    id: 'governance-queue',
    group: 'Library & team',
    persona: 'SOP Admin',
    title: 'Work the needs-attention queue',
    summary: 'An admin keeps every SOP owned, current, and approved from the SOP library’s "Needs attention" view (UX-03 fold) — filter by Overdue / Due soon / Unowned / Stale-role / Awaiting approval, and act inline without leaving the page.',
    steps: [
      { id: 's', type: 'start', label: 'SOPs are drifting out of date, ownerless, or awaiting approval' },
      { id: 'legacy', type: 'screen', label: 'Legacy governance URL (optional)', route: '/admin/governance', detail: 'Redirect shim → /admin/sops?view=attention — legacy ?filter=X deep-links map onto the folded view’s filter param (GQ-04 bookmarks keep working).' },
      { id: 'queue', type: 'screen', label: 'Needs attention view', route: '/admin/sops', detail: 'The governance queue folded into the SOP library (?view=attention). Header chips count each flag with deep-links; one list, filter chips, ONE primary action per row. Computed on read — no jobs, no materialized state (D28-05).' },
      { id: 'action', type: 'decision', label: 'What does the row need?', branches: [
        { label: 'Approve (awaiting approval)', to: 'approve' },
        { label: 'Confirm current (overdue/due soon)', to: 'confirm' },
        { label: 'Assign owner (unowned)', to: 'assign' },
        { label: 'Fix assignment (stale-role)', to: 'fix' },
      ] },
      { id: 'approve', type: 'action', label: 'Approve step', detail: 'One-click approveStep — shown only when the caller matches the chain’s next step (APR-03/APR-04); also available from the builder Send-to-workers stage.' },
      { id: 'confirm', type: 'action', label: 'Confirm current', detail: 'One click; stamps last_reviewed_at + resets review_due_at; appends an audited sop_review_events row (D28-04).' },
      { id: 'assign', type: 'action', label: 'Reassign owner inline', detail: 'OwnerPicker popover — ≤2 clicks total via setSopOwner (OWN-02).' },
      { id: 'fix', type: 'screen', label: 'Assign to team', route: '/admin/sops/[sopId]/assign', detail: 'Stale-role rows deep-link here to fix dangling/renamed department refs (GQ-03).' },
      { id: 'e', type: 'end', label: 'Row leaves the queue' },
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
      { id: 'menu', type: 'action', label: 'Open the account menu', detail: 'Pathways + Feedback live under the avatar menu — internal team tooling, out of the primary nav (UX-08).' },
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
