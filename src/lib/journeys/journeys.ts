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
      { id: 'auth', type: 'action', label: 'Enter email + password', detail: 'Supabase Auth verifies and sets a session. roleHome(role) sends every role to the one screen, or to /pending when there is no role (UX-01, Phase 57).' },
      { id: 'role', type: 'decision', label: 'Role?', branches: [
        { label: 'Worker, supervisor, safety manager or admin', to: 'one-screen' },
        { label: 'No role yet', to: 'pending-home' },
      ] },
      { id: 'one-screen', type: 'screen', label: 'The one screen — list, isometric site and detail', route: '/', detail: 'Every role lands here (Phase 57 D-10). Admins also see the Office card, the rooms and edit mode.' },
      { id: 'pending-home', type: 'screen', label: 'Account pending', route: '/pending', detail: 'Holding screen until an admin assigns a role.' },
      { id: 'e', type: 'end', label: 'Signed in' },
    ],
  },
  {
    id: 'sign-up',
    group: 'Getting started',
    persona: 'Uninvited visitor',
    title: 'Asked to sign up without an invitation',
    summary: 'SOPstart is invitation-only; there is no self-service sign-up.',
    steps: [
      { id: 's', type: 'start', label: 'Visitor with no invitation' },
      { id: 'signup', type: 'screen', label: 'Sign-up screen', route: '/sign-up', detail: 'Says SOPstart is by invitation and to ask your admin; links to log in and to join with a code.' },
      { id: 'e', type: 'end', label: 'Asks their admin' },
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
      { id: 'home', type: 'screen', label: 'Role home — the one screen', route: '/', detail: 'roleHome(role) dispatch sends every role to the one screen — join-by-code always joins as worker.' },
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
      { id: 'site', type: 'screen', label: 'The one screen — the site, with every machine clickable', route: '/', detail: 'The isometric site (Phase 52, now the one screen of Phase 57). An amber pin on a machine counts that worker\'s procedures there that are due, never done, or updated — worked out live from the worker\'s own list, never stored. The "Next for you" card shows the single next procedure with Walk it and Show me. There is no separate SOP list: site-wide SOPs are on the Noticeboard and each machine\'s are on the machine.' },
      { id: 'pick', type: 'decision', label: 'How do they get there?', branches: [
        { label: 'Click a machine', to: 'panel' },
        { label: 'Open the Noticeboard', to: 'board' },
        { label: 'Now card → Walk it', to: 'walk' },
      ] },
      { id: 'panel', type: 'screen', label: 'Machine in the detail pane', route: '/', detail: 'The machine\'s photo (or "no photo yet"), its department named in that department\'s colour, then its procedures to-do first with the shared badge (Due, Updated, Never done, Done — "Updated" marks any SOP published after the worker\'s last completion, AFL-VER-04), a Walk › link and a plain Read link. A refresher chip never blocks opening the card (Phase 36).', branches: [
        { label: 'Walk ›', to: 'walk' },
        { label: 'Read', to: 'detail' },
      ] },
      { id: 'board', type: 'screen', label: 'Noticeboard room', route: '/', detail: 'The site-wide SOPs in the detail pane, each with the same shared badge, Walk › and Read links.', branches: [
        { label: 'Walk ›', to: 'walk' },
        { label: 'Read', to: 'detail' },
      ] },
      { id: 'detail', type: 'screen', label: 'Procedure detail', route: '/sops/[sopId]', detail: 'Read is the SOP as one document (2026-09-27): Orient → Prepare → Do. A SOP holding several procedures shows a "Which job are you doing?" chooser (?job=); Prepare lists tools and parts for that job and lets the worker acknowledge the safety requirements inline; Do lists the job\'s steps in full with a "Walk it step by step" button. Walk it walks the chosen job only (Step 1 of 6, not 1 of 40) and skips the "Before you start" screen when already acknowledged or when there is nothing to acknowledge. Workers see Read + Walk it; the Desktop/Mobile preview toggle is admin-only. Legacy ?tab= params still map onto the tabs. Admins/safety managers see an "Edit in builder" link here.' },
      { id: 'go', type: 'decision', label: 'Ready to start?', branches: [
        { label: 'Yes — walk it', to: 'walk' },
        { label: 'Just reading', to: 'e' },
      ] },
      { id: 'walk', type: 'screen', label: 'Step-by-step walkthrough (Walk it tab)', route: '/sops/[sopId]', detail: 'Walk ›, Walk it and Show me all open /sops/<id>?from=<the machine or room it came from>, so Back returns there (Phase 58-10; the focus screen replaces the tabs in 58-11).' },
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
        { label: 'Add a photo', to: 'photo' },
        { label: 'Enter a measurement', to: 'meas' },
        { label: 'Make a yes/no decision', to: 'decide' },
      ] },
      { id: 'photo', type: 'action', label: 'Capture photo', detail: "Compressed and uploaded straight away; the step can't be finished until the photo shows Uploaded." },
      { id: 'meas', type: 'action', label: 'Enter reading', detail: 'Flagged if out of range.' },
      { id: 'decide', type: 'action', label: 'Choose path', detail: 'May branch or escalate.' },
      { id: 'next', type: 'decision', label: 'More steps?', branches: [
        { label: 'Yes', to: 'read' },
        { label: 'Last step done', to: 'complete' },
      ] },
      { id: 'complete', type: 'action', label: 'Complete + worker self-sign', detail: 'Creates an append-only completion record. Completing IS the worker signature (D-09). The worker who is signed in is the one recorded (AFL-VER-05).' },
      { id: 'signoff', type: 'decision', label: 'Supervisor counter-sign required?', branches: [
        { label: 'Yes → supervisor counter-signs', to: 'sup' },
        { label: 'No', to: 'e' },
      ] },
      { id: 'sup', type: 'screen', label: 'Supervisor review + counter-sign', route: '/activity/[completionId]', detail: 'Supervisor counter-signs — second immutable record (D-10 / AFL-VER-05).' },
      { id: 'e', type: 'end', label: 'Job recorded' },
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
      { id: 'activity', type: 'screen', label: 'Sign-off records', route: '/activity', detail: 'All completions for the org. Admins see the same sign-off queue.' },
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
      { id: 'activity', type: 'screen', label: 'Sign-off — record button / row action', route: '/activity', detail: '"Record observation" button, or a per-completion "I observed this" row action pre-filling worker + SOP + completion_id.' },
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
    summary: 'An admin signs in and lands on the one screen — the SOP list, the isometric site and the detail pane. The Office card and the rooms (Office, Smoko room, Workshop, Noticeboard) carry the admin surfaces; every page they open has one Back to the site bar.',
    steps: [
      { id: 's', type: 'start', label: 'Signed in as admin / safety manager' },
      { id: 'home', type: 'screen', label: 'Admin home — the one screen', route: '/', detail: 'roleHome(admin) lands here. The Office card (sign-offs, inbox, team) and the rooms open Governance, Team, Settings and the new-SOP wizard; edit mode (Edit the site) is on the same screen. Profile, Sign out, Pathways and Feedback sit in the account control at the foot of the list.' },
      { id: 'menu', type: 'decision', label: 'Open another admin surface? (the Office card and rooms: Governance · Write a new SOP · Team · Settings; Site is Edit the site on the same screen)', branches: [
        { label: 'SOPs', to: 'sops' },
        { label: 'Governance inbox', to: 'gov' },
        { label: 'Team', to: 'team' },
        { label: 'Site', to: 'site' },
        { label: 'Settings', to: 'settings' },
        { label: 'Stay on worker path', to: 'e' },
      ] },
      { id: 'gov', type: 'screen', label: 'Governance inbox', route: '/governance', detail: 'One-action rows — no owner, review overdue, awaiting approval, stuck converting, machines with no procedures — counted chips and an All clear empty state (Phase 54, D-01/D-02).' },
      { id: 'sops', type: 'screen', label: 'Workshop room — SOPs that are not published yet', route: '/', detail: 'The Workshop lists every SOP that is not published yet, with Write a new SOP; a machine\'s SOPs open in the detail pane when the machine is selected, each with its owner and review line and Edit into the builder. Who sees a SOP is edited on the Access page (/admin/access), reached from the Office panel.' },
      { id: 'team', type: 'screen', label: 'Team & org model', route: '/admin/team', detail: 'Org model surface (D-08) — Node Chart default, ▤ Columns toggle absorbs member management.' },
      { id: 'site', type: 'screen', label: 'Site map — edit mode', route: '/', detail: 'The plant-floor scene and its machines (Phase 51) — draw/name/tag machines, link SOPs to them. Edit mode is /?place=edit on the one screen (Phase 57); the old /admin/site address redirects there.' },
      { id: 'settings', type: 'screen', label: 'Settings hub', route: '/admin/settings', detail: 'Groups AI Settings, a link to Departments (site edit mode), the AI agent layer, and the approval-chain editor under one home.' },
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
      { id: 'picker', type: 'screen', label: 'New SOP method picker', route: '/admin/sops/new', detail: 'The Workshop room "Write a new SOP" link (admin roles) lands here directly. 3 tiles, Upload first: Upload a document · Draft it with AI · Start blank. The type-vs-talk choice moved off this screen onto /admin/sops/new/ai.' },
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
    summary: 'An admin uploads a video or records one; the audio is transcribed into a draft procedure.',
    steps: [
      { id: 's', type: 'start', label: 'Has a video of the task' },
      { id: 'picker', type: 'screen', label: 'New SOP method picker', route: '/admin/sops/new', detail: 'Video lives behind "Upload a document".' },
      { id: 'up', type: 'screen', label: 'Upload / record', route: '/admin/sops/upload' },
      { id: 'trans', type: 'action', label: 'Transcribe audio', detail: 'Domain vocabulary prompt; numbers + chemicals flagged for confirmation.' },
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
      { id: 'picker', type: 'screen', label: 'New SOP method picker', route: '/admin/sops/new', detail: '"Draft it with AI" tile.' },
      { id: 'ai', type: 'screen', label: 'AI draft', route: '/admin/sops/new/ai', detail: 'Type a brief; the AI drafts the SOP and opens it in the builder.' },
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
    summary: 'The core editing flow: shape the content, check it against the source with AI help, verify every safety step, then publish. Create-from-scratch, AI-convert and edit-draft all converge on this one bespoke builder surface (Phase 26 D-01: Puck removed — inline content editing, no separate field popovers).',
    steps: [
      { id: 's', type: 'start', label: 'Have a draft' },
      { id: 'build', type: 'screen', label: 'Build stage', route: '/admin/sops/builder/[sopId]', detail: 'Bespoke editor: step-centric rail; the admin edits the SAME content components the worker reads, in place (edit==worker parity, R2). Add/edit/reorder/duplicate steps inline; every field reachable (P14, 0 unreachable). Image content opens a Konva annotation layer (arrows/boxes/text, palm-reject) that bakes to a flat PNG on publish. A light Wayfinder header (Phase 33 SC-6) tops every stage: back-to-library / you\'re-editing / next-stage zones, with a single "Tools for this SOP" menu (assign, versions, pick machines, change category, standards, delete draft).' },
      { id: 'review', type: 'action', label: 'Review stage', detail: 'Source viewer side-by-side; AI reviewer flags omissions/anchoring; per-step verify checklist. The Wayfinder header\'s forward chip states the lock reason inline ("Locked — N steps below still need checking").' },
      { id: 'verify', type: 'decision', label: 'Every step verified?', branches: [
        { label: 'Yes', to: 'pubstage' },
        { label: 'No — gate blocks publish', to: 'review' },
      ] },
      { id: 'pubstage', type: 'action', label: 'Publish stage', detail: 'Single publish trigger; gated on full verification.' },
      { id: 'publish', type: 'action', label: 'Publish', route: '/api/sops/[sopId]/publish', detail: 'SOP goes live for assigned workers. A "Choose who sees it →" CTA appears once published (D-12a).' },
      { id: 'e', type: 'end', label: 'Published' },
    ],
  },
  {
    id: 'label-with-standards',
    group: 'Refine & publish',
    persona: 'SOP Admin',
    title: 'Label a SOP with a standard',
    summary: 'An admin keeps one list of standards for the whole organisation (LOTO, Hot Work and so on) and puts any of them on a whole SOP, on a section, or on a single step.',
    steps: [
      { id: 's', type: 'start', label: 'Has a SOP' },
      { id: 'builder', type: 'screen', label: 'Builder', route: '/admin/sops/builder/[sopId]' },
      { id: 'tools', type: 'action', label: 'Tools for this SOP → Standards' },
      { id: 'manage', type: 'action', label: 'Add, rename or remove a standard', detail: 'One list for the whole organisation, seeded with LOTO, Hot Work, Confined Space, Working at Height, Manual Handling and Electrical Isolation. Removing one takes it off everywhere, and the panel says how many places before it does.' },
      { id: 'attach', type: 'action', label: 'Put a standard on the SOP, a section or a step' },
      { id: 'sop', type: 'screen', label: 'SOP page', route: '/sops/[sopId]', detail: 'The label shows beside the SOP title and beside each labelled section, also on the walk. Step labels reach the walk in Phase 58.' },
      { id: 'e', type: 'end', label: 'Labelled' },
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
      { id: 'access', type: 'screen', label: 'Access map', route: '/admin/access', detail: 'Reached from the Access link in the Office panel, or the Choose who sees it link in the builder (which pins the SOP with ?sop=). Site→area→department→role→person on the left, collections on the right — expand a collection to see the SOPs inside it (33-08 SC-2). The CTA pins this SOP tagged NEW atop its collection; opening the map directly (D-12b) or drilling into any collection reaches any SOP the same way.' },
      { id: 'connect', type: 'action', label: 'Choose people, roles or teams', detail: 'Each choice draws a live line and updates a plain "N people can see this" blast-radius banner.' },
      { id: 'done', type: 'action', label: '✓ Save — done', detail: 'Writes an additive SOP-target grant (D-11) via createGrant, materializing into sop_departments/sop_access_people — the SOP becomes "chosen by name" and stops following its collection until every named person is removed again (33-05).' },
      { id: 'panel', type: 'action', label: 'Read the answer panel', detail: 'Below the map, a plain-language panel states who can see the selected SOP/collection (or what a selected person/team can see) — no "wire"/"grant"/"UNWIRED" wording anywhere (33-09 SC-5).' },
      { id: 'filter', type: 'action', label: 'Focus a unit to filter the SOP surface', detail: 'Clicking a department jack surfaces an "Open" link that takes the admin to that department\'s place on the one screen — the same viz doubles as a filter (SC-4).' },
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
      { id: 'lib', type: 'screen', label: 'Workshop room on the one screen', route: '/' },
      { id: 'assign', type: 'screen', label: 'Assign', route: '/admin/sops/[sopId]/assign', detail: 'By role / trade / sub-trade.' },
      { id: 'notify', type: 'action', label: 'Workers notified', detail: 'Appears in their SOP list on the one screen.' },
      { id: 'e', type: 'end', label: 'Assigned' },
    ],
  },
  {
    id: 'version-supersede',
    group: 'Refine & publish',
    persona: 'SOP Admin',
    title: 'Publish a new version',
    summary: 'An admin revises a live procedure via clone-to-draft or file upload; the new version supersedes the old and assigned workers are told to re-read. (Phase 23-05: D-05 clone. Compare and restore were retired in Phase 55-10.)',
    steps: [
      { id: 's', type: 'start', label: 'SOP needs an update' },
      { id: 'versions', type: 'screen', label: 'Version history', route: '/admin/sops/[sopId]/versions', detail: 'Edit into new version (clone) or Upload new version. Phase 36 (TRN-03): each version row also shows a completion-count breakdown (how many workers completed that version, expandable to names + dates), an "outdated version" coaching note for stragglers, and a refresher-interval control (REF-01/REF-02) for how often workers must re-walk this SOP — informational/admin-only, never gates a worker\'s read access.' },
      { id: 'choose', type: 'decision', label: 'How to create the new version?', branches: [
        { label: 'Edit into new version (clone)', to: 'clone' },
        { label: 'Upload a new file', to: 'builder' },
      ] },
      { id: 'clone', type: 'action', label: 'Clone published SOP → new draft', detail: 'cloneSopAsDraft() copies sections/steps/blocks into a new draft. History stays append-only.' },
      { id: 'builder', type: 'screen', label: 'Builder (edit draft)', route: '/admin/sops/builder/[sopId]' },
      { id: 'republish', type: 'action', label: 'Republish', detail: 'Supersedes the prior version; workers notified. Updated badge appears on worker SOP card (D-08).' },
      { id: 'e', type: 'end', label: 'New version live' },
    ],
  },
  {
    id: 'agent-layer',
    group: 'Refine & publish',
    persona: 'SOP Admin',
    title: 'Inspect the machine layer & review proposals',
    summary: 'An admin peeks behind the human-facing SOP at what the AI agent has synthesised — a read-only per-SOP/per-step metadata panel in the builder — then reviews and decides on the evidence-backed proposals it has raised across the whole org.',
    steps: [
      { id: 's', type: 'start', label: 'Curious what the agent has synthesised' },
      { id: 'build', type: 'screen', label: 'Builder', route: '/admin/sops/builder/[sopId]', detail: 'Toggle "⚇ Agent layer" reveals a read-only purple panel: summary, tags, entities, embedding status, links, plus per-step metadata rows keyed by junction id.' },
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
    summary: 'An admin opens Governance and works an inbox of one-action rows — no owner, review overdue, waiting on their approval, stuck converting, machines with no procedures — until it reads All clear.',
    steps: [
      { id: 's', type: 'start', label: 'SOPs are drifting out of date, ownerless, or awaiting approval' },
      { id: 'queue', type: 'screen', label: 'Governance inbox', route: '/governance', detail: 'One-action rows — no owner, review overdue, awaiting the caller\'s approval, stuck converting, machines with no procedures. Counted chips: All · No owner · Overdue · Approve · Stuck · Machines. One action per row: Assign owner · Approve · Confirm current · Fix assignment · Retry · Add. An empty inbox shows the All clear state. Computed on read — no jobs, no materialized state (D28-05).' },
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
    summary: 'An admin creates departments, assigns owners, and uses them to organise SOPs, content, and team members.',
    steps: [
      { id: 's', type: 'start', label: 'Need to organise by department' },
      { id: 'depts', type: 'screen', label: 'Departments strip — edit mode', route: '/', detail: 'Edit mode (/?place=edit) carries the departments strip: add, rename, recolour, remove. The old /admin/departments address redirects there. Per-person department membership stays on /admin/team.' },
      { id: 'create', type: 'action', label: 'Create department', detail: 'Name, code, colour, icon, owner.' },
      { id: 'owner', type: 'action', label: 'Set owner', detail: 'Clears the "No owner assigned" warning.' },
      { id: 'e', type: 'end', label: 'Department ready' },
    ],
  },
  {
    id: 'map-the-site',
    group: 'Library & team',
    persona: 'SOP Admin',
    title: 'Map the site and its machines',
    summary: 'An admin turns the plant floor into a drawing — a scene image with named, departmentised machines — so any SOP can say which machines it belongs to.',
    steps: [
      { id: 's', type: 'start', label: 'Admin opens Edit the site on the one screen' },
      { id: 'empty', type: 'screen', label: 'No site yet', route: '/', detail: 'Edit mode (/?place=edit). Two choices: Generate from a description (shown only when scene generation is set up on the server), or Upload a JPG/PNG up to 15 MB.' },
      { id: 'method', type: 'decision', label: 'How to make the scene?', branches: [
        { label: 'Generate', to: 'generate' },
        { label: 'Upload', to: 'upload' },
      ] },
      { id: 'generate', type: 'action', label: 'Describe the site and generate the scene' },
      { id: 'upload', type: 'action', label: 'Upload a JPG or PNG of the site' },
      { id: 'editor', type: 'screen', label: 'Site map editor', route: '/', detail: 'Edit mode (/?place=edit). Scene at full size, drag to pan, scroll to zoom.' },
      { id: 'draw', type: 'action', label: 'Draw machine', detail: 'Click each corner, click the first to finish; name it, pick its department.' },
      { id: 'link', type: 'action', label: 'Show SOPs on a machine', detail: 'Link or unlink SOPs from the machine panel.' },
      { id: 'builder', type: 'screen', label: 'Builder → Tools for this SOP → Pick machines for this SOP', route: '/admin/sops/builder/[sopId]', detail: 'The same links, edited from the SOP side. The picker says where the SOP lives: its machines and their department, or Whole site. The Whole site button clears every machine, and a SOP with no machine is site-wide (Phase 56, D-09/D-10). The department shown comes from the machines; who can see the SOP is still the access wiring. The same Tools menu also carries "Change category" (BuilderCategoryButton, D-09) — the category fix that used to live in the retired list detail pane.' },
      { id: 'e', type: 'end', label: 'Site mapped' },
    ],
  },

  // ================================ Everyone ================================
  {
    id: 'one-screen',
    group: 'Everyone',
    persona: 'Everyone',
    title: 'The one screen',
    summary: 'Signed-in members open / and get the list, the isometric site and a detail pane in one screen.',
    steps: [
      { id: 's', type: 'start', label: 'Opens the site' },
      { id: 'screen', type: 'screen', label: 'The one screen - list, site, detail', route: '/', detail: 'Rooms are always signposted on the site. Selecting a machine or the Noticeboard lists its SOPs with Walk. Searching lights the matching shapes. Esc returns to the overview. Every place has an address, /?place=... A visitor who is not signed in sees the landing with Log In instead; a member with no role goes to the holding screen.' },
      { id: 'walk', type: 'action', label: 'Walk a SOP', detail: 'Walk beside a SOP row, or Walk it on the Now card.' },
      { id: 'sop', type: 'screen', label: 'Procedure', route: '/sops/[sopId]' },
      { id: 'smoko', type: 'screen', label: 'Smoko room - my record', route: '/activity', detail: 'The Smoko room and the Office both bridge to Activity.' },
      { id: 'e', type: 'end', label: 'Back on the site' },
    ],
  },
  {
    id: 'one-screen-admin',
    group: 'Library & team',
    persona: 'SOP Admin',
    title: 'Run the site from the one screen',
    summary: 'An admin opens / and sees health marks on the site, the Office inbox count, the Workshop drafts and the Noticeboard, and can start a SOP for a machine or edit the site without leaving the screen.',
    steps: [
      { id: 's', type: 'start', label: 'Opens the site' },
      { id: 'screen', type: 'screen', label: 'The one screen (admin)', route: '/', detail: 'Machines carry a red, amber or green mark from the SOPs linked to them. The Office pin and the Office card show the same inbox count. Selecting a machine lists its SOPs with a badge each (no owner, review due, draft, ok), Walk on published ones, Edit on any.', branches: [
        { label: 'Open the Office', to: 'office' },
        { label: 'Open the Workshop', to: 'workshop' },
        { label: 'Select a machine', to: 'machine' },
        { label: 'Edit site', to: 'edit' },
      ] },
      { id: 'office', type: 'screen', label: 'Office - inbox summary', route: '/governance', detail: 'Summarises the inbox and opens it. Completions waiting for sign-off are a separate line that opens Activity. People & roles and Settings are linked from here.', branches: [
        { label: 'Done', to: 'e' },
      ] },
      { id: 'workshop', type: 'screen', label: 'Workshop - drafts', route: '/admin/sops/builder/[sopId]', detail: 'Every draft in the organisation with its state; Open goes to the builder.', branches: [
        { label: 'Write a new SOP', to: 'new' },
        { label: 'Done', to: 'e' },
      ] },
      { id: 'new', type: 'screen', label: 'New SOP', route: '/admin/sops/new', branches: [
        { label: 'Done', to: 'e' },
      ] },
      { id: 'machine', type: 'screen', label: 'Machine - SOPs and New SOP for this machine', route: '/admin/sops/new/blank', detail: 'New SOP for this machine opens the blank wizard with the machine already chosen; the new SOP is linked to it when it is created.', branches: [
        { label: 'Done', to: 'e' },
      ] },
      { id: 'edit', type: 'action', label: 'Edit site', detail: 'The site editor replaces the stage and detail panes, with the departments strip above it. Done returns to the overview with fresh marks.', branches: [
        { label: 'Done', to: 'e' },
      ] },
      { id: 'e', type: 'end', label: 'Back on the site' },
    ],
  },
  {
    id: 'give-feedback',
    group: 'Everyone',
    persona: 'Everyone',
    title: 'Give product feedback',
    summary: 'The team reviews design directions and before/after changes and leaves structured feedback for analysis.',
    steps: [
      { id: 's', type: 'start', label: 'Asked to review' },
      { id: 'menu', type: 'action', label: 'Open the account control', detail: 'Pathways + Feedback live in the account control at the foot of the list — internal team tooling, admin only (UX-08).' },
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
