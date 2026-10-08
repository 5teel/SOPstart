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
  /** Friendly grouping label, e.g. "The SOP screen", "Design choices". */
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
      'Tap between the sections in the menu (or the tab bar on a phone) and open Sign-offs.',
      'If you are an admin, open Sign-offs and switch between Inbox, Requests and Decisions.',
      'Open a SOP from the list, go back, and open another one.',
    ],
    questions: [
      { id: 'instant', text: 'Did something visibly happen the instant you tapped each link?' },
      { id: 'faster', text: 'Does moving around the app feel faster than before?' },
      { id: 'no-dead-taps', text: 'Did you avoid any "did my tap register?" moments?' },
    ],
    background:
      'Navigation-responsiveness pass (2026-07-13): route-level loading.tsx skeletons so the App Router paints instantly on navigation; useLinkStatus pending spinners on BottomTabBar/the old header/AdminNav; middleware getUser()→getClaims() (local ES256 JWT verify, no per-request Supabase Auth round-trip); per-request cached getSessionContext deduplicating auth+role queries; Promise.all on independent server-page fetches.',
  },

  {
    id: 'nav-signoff-clarity',
    dateAdded: '2026-07-30',
    category: 'Speed & feel',
    title: 'Do the main menu names make sense?',
    status: 'active',
    summary:
      'The old "Activity" page is now two things: Sign-offs (the queue of finished SOPs waiting for review) and My record (your own finished SOPs).',
    tryIt: [
      'Sign in as a supervisor or admin and open Sign-offs: finished SOPs waiting for review are listed in the Inbox.',
      'Open a sign-off row — you should see the steps and photos in place, with Sign off and Reject, not an editing screen.',
      'If you are an admin: the menu shows People and Manage SOPs. Open New SOP in Manage SOPs - it should take you straight to the ways of making a SOP.',
    ],
    questions: [
      { id: 'clear', text: 'Without anyone explaining it, could you guess what lives under "SOPs" and what lives under "Sign-off"?' },
      { id: 'signoff-name', text: 'Is "Sign-off" a good name for the page where completed work gets reviewed? If not, what would you call it?' },
      { id: 'lost', text: 'In your first five taps, did you ever land somewhere you did not expect?' },
    ],
    background:
      'Nav clarity pass (2026-07-30): "Activity" renamed to "Sign-off" (the header it was renamed in is gone since Phase 57); Phase 59: sign-off happens on the Sign-offs inbox row; Phase 63: /activity redirects to My record, your own finished SOPs.',
  },

  {
    id: 'p23-roster-login',
    dateAdded: '2026-06-26',
    category: 'Phase 23 — AI Field Layer + Version Supersede',
    title: 'Can a worker sign in on a shared device by picking their name?',
    status: 'archived',
    summary:
      'Workers on a shared device sign in by tapping their name from a list — no password needed. We want to confirm the name-select screen works and the right SOPs appear after selecting a name.',
    tryIt: [
      'On a shared device, open the roster login page.',
      'Pick a worker name from the list.',
      'Confirm you land on the SOP library and can see the procedures assigned to that worker.',
      'Complete a short SOP and confirm the completion is recorded against the selected worker name.',
      'Switch to a different worker name and confirm you only see that worker\'s assigned SOPs (not the first worker\'s private data).',
    ],
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
    links: [{ label: 'SOPs', href: '/' }],
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
      'Open the new version, start it and finish it.',
      'Confirm the badge disappears after completing the updated version.',
    ],
    links: [
      { label: 'SOPs (worker view)', href: '/' },
      { label: 'SOPs (admin — publish new version)', href: '/' },
    ],
    questions: [
      { id: 'badge-appears', text: 'Did the badge appear on the SOP card after the new version was published?' },
      { id: 'badge-clear', text: 'Was it clear that the badge meant the SOP had been updated?' },
      { id: 'badge-goes', text: 'Did the badge go away after you completed the new version?' },
    ],
    background:
      'AFL-VER-04 / D-08 (updated-since indicator). Badge triggers when sop.published_at > worker\'s last completion. The Updated signal now rides the rel badge on the one screen (the old SOP card is gone, Phase 57). The prop is derived server-side by comparing the SOP\'s current published_at against the most recent sop_completions.completed_at for that worker+SOP pair.',
  },
  {
    id: 'agent-layer-dashboard',
    dateAdded: '2026-07-05',
    category: 'Phase 26.5 — Agent Metadata Layer',
    title: 'Does the AI agent layer feel useful, not intrusive?',
    status: 'active',
    summary:
      'There is now a machine layer working quietly behind every procedure — it reads what happens in the field and suggests improvements. You review its suggestions on one org-wide dashboard.',
    tryIt: [
      'Open the agent dashboard and look at the proposals queue and the recent activity feed.',
      'If there is a pending proposal, approve or decline it and confirm it leaves the queue.',
    ],
    links: [
      { label: 'Agent dashboard', href: '/admin/agent' },
    ],
    questions: [
      { id: 'evidence-clear', text: 'Was it clear what evidence a proposal was based on?' },
      { id: 'decide-works', text: 'Did approving/declining a proposal remove it from the queue?' },
      { id: 'not-intrusive', text: 'Did the agent layer feel useful rather than getting in the way?' },
    ],
    background:
      'D-09 (the SOP-level agent panel retired with the builder in Phase 58; the org /admin/agent dashboard remains), D-10 (strictly read-only metadata + approve/decline the only interactive affordance), D-11 (proposals queue primary, activity feed secondary, no cross-SOP graph viz), D-14 (activity feed proves the layer is alive). Both server actions and UI verified behaviourally (agent-dashboard.spec.ts) — this UAT entry is the human "does it feel right" check.',
  },

  {
    id: 'p32-wiring-access-view',
    dateAdded: '2026-07-18',
    category: 'Phase 32 — Visual Org Model',
    title: 'Is it clear who can see a SOP, and easy to wire up a new one?',
    status: 'active',
    summary:
      'People now has an "Access" tab: a wiring diagram where you click an area, department or person to trace which library collections they can see, and click a new SOP to wire it up to the right parts of your org. The same view doubles as a library filter.',
    tryIt: [
      'Publish a SOP and click the "Choose who sees it →" button that appears — you should land on the Access view with that SOP tagged "NEW".',
      'Click a department or person on the left to see the lines light up and a plain "N people can see this" banner.',
      'Click the new SOP, choose a department or two, and hit "✓ Save — done" — confirm the banner and the "Who can see this?" panel below update live.',
      'With something focused, click "Open in the SOP list →" and confirm the site opens on that department place.',
    ],
    links: [{ label: 'Access (in People)', href: '/?s=people&tab=access' }],
    questions: [
      { id: 'trace-clear', text: 'Was it clear which SOPs an area/department/person can see when you clicked it?' },
      { id: 'wireup-easy', text: 'Was wiring up a new SOP\'s access straightforward?' },
      { id: 'filter-useful', text: 'Was jumping from the diagram to that department on the site useful?' },
      { id: 'blast-radius-trust', text: 'Did the "N people can see this" count feel trustworthy before you confirmed?' },
    ],
    background:
      'D-09 (the Access view, now the People access tab), D-12 (wire-up entry from both the post-publish CTA and organically), D-11 (additive-only grants — no in-place revoke here), SC-4 (viz-as-library-filter deep-links). WiringPatchBay/SelectionStrip built in 32-08; the page arm, deep-links, and publish CTA land in 32-09; drill-down + plain-language copy + the answer panel land in 33-08/33-09 (see the Phase 33 — Access map entries below for current copy).',
  },

  {
    id: 'p33-plain-language-access',
    dateAdded: '2026-07-19',
    category: 'Phase 33 — Access map',
    title: 'Can you find a SOP inside its folder and understand who sees it, without any jargon?',
    status: 'active',
    summary:
      'The Access map now lets you open a collection and see the SOPs inside it, and every screen answers a plain question — "Who can see this?" or "What can they see?" — instead of talking about "wiring" or "grants".',
    tryIt: [
      'Open the Access view and click a collection on the right to open it — you should see the SOPs inside it listed underneath.',
      'Click one of those SOPs, then click a department or person on the left to choose who sees it, and click "Save — done".',
      'Read the panel that appears under the map out loud — does it plainly say who can see the SOP you picked?',
      'Click a person or team on the left instead — the same panel should flip to say what THEY can see.',
      'Look through the whole screen for the words "wire", "wiring", "grant" or "UNWIRED" — you shouldn\'t find any.',
    ],
    links: [{ label: 'Access (in People)', href: '/?s=people&tab=access' }],
    questions: [
      { id: 'drilldown-clear', text: 'Was it obvious you could open a collection and pick one of the SOPs inside it?' },
      { id: 'panel-plain', text: 'Did the "Who can see this?" / "What can they see?" panel read like plain English, not tech jargon?' },
      { id: 'no-jargon-spotted', text: 'Did you find the screen free of words like "wire", "wiring", "grant" or "UNWIRED"?' },
    ],
    background:
      'SC-2/SC-3 (33-08) — collection→SOP drill-down + organic choose-mode, any SOP wireable by name via a SOP-target grant. SC-5 (33-09) — full jargon sweep + the absorbed AccessAnswerPanel (sketches/access-hierarchy concept B, adopted into the shipped concept A per its README § Decisions).',
  },

  {
    id: 'p33-wr02-plenum-chamber',
    dateAdded: '2026-07-19',
    category: 'Phase 33 — Access map',
    title: 'One SOP\'s access needs a deliberate call — can you set it?',
    status: 'active',
    summary:
      '"Changing Plenum Chamber — IS Machine Forming Section" is the one SOP flagged during Phase 32 review as about to widen to a department it didn\'t originally reach, the next time anything else in its collection changes. This phase gives you the tool to fix that — pick exactly who should see this one SOP by name.',
    tryIt: [
      'Open the Access view and find "Changing Plenum Chamber — IS Machine Forming Section" (drill into its collection if it\'s not pinned).',
      'Click it and read the "Who can see this?" panel — it currently follows its collection, which is wider than intended.',
      'Choose the department(s)/person(s) who should actually see this one SOP, then click "Save — done".',
      'Confirm the panel now says the SOP is "chosen by name" and no longer follows the wider collection.',
    ],
    links: [{ label: 'Access (in People)', href: '/?s=people&tab=access' }],
    questions: [
      { id: 'wr02-found', text: 'Could you find this SOP and see the plain-language explanation of who currently sees it?' },
      { id: 'wr02-narrowed', text: 'Were you able to choose the right people/department by name and save it?' },
    ],
    background:
      '32-REVIEW-FIX.md WR-02 / 32-VERIFICATION.md human-item 6: SOP `95772b8e` would GAIN department `4587a6ed` on the next unrelated re-materialization of its collection — a live, still-open product decision. This phase\'s SOP-target grant mechanism (33-05) is the intended closure: expressing the narrow intent explicitly via the UI pins the divergence deliberately instead of leaving it to drift.',
  },

  // ---------------------------------------------------------------------------
  // TEMPLATE — copy this to put a new design choice or check to the team.
  // Set status:'archived' once it's decided.
  // ---------------------------------------------------------------------------
  {
    id: 'p34-record-observation',
    dateAdded: '2026-07-20',
    category: 'Phase 34 — Supervisor observations',
    title: 'Can you record an observation of a worker doing a SOP right?',
    status: 'active',
    summary:
      'Supervisors can now record that they personally watched a worker perform a SOP — a verdict (performed to SOP / needs support) plus an optional note. Admins start this from the Training section. Supervisors have no entry point for it yet.',
    tryIt: [
      'Open the Training section, click a cell to open the panel for that person, then click "Record observation".',
      'Pick a SOP, choose a verdict, add a short note, and save — check it appears in their observation history.',
    ],
    links: [{ label: 'Training matrix', href: '/?s=training' }],
    questions: [
      { id: 'entry-found', text: 'Was it easy to find "Record observation" from the Training matrix?' },
      { id: 'save-clear', text: 'Was it clear the record is permanent once saved (can\'t be edited or deleted)?' },
      { id: 'appears-history', text: 'Did the new observation show up straight away in that worker\'s history?' },
    ],
    background:
      'OBS-01 (34-04/34-06/34-07) — recordObservation() writes an append-only row (D-12, RLS-gated); shared RecordObservationModal (34-05) is mounted from both entry points (D-03).',
  },

  {
    id: 'p34-worker-sees-observations',
    dateAdded: '2026-07-20',
    category: 'Phase 34 — Supervisor observations',
    title: 'As a worker, can you see the observations your supervisor recorded about you?',
    status: 'active',
    summary:
      'Full transparency is the point — anything a supervisor records about you shows up on your own Profile page, in plain language, and you can\'t edit, delete or hide it.',
    tryIt: [
      'As a worker, open Profile — scroll to "Observations about you".',
      'Read the banner explaining why these records exist and that nothing is hidden from you.',
      'Check each observation shows the SOP, the verdict, any note your supervisor wrote, who observed you, and when.',
      'Confirm there is no button to edit, delete, or dismiss any of them.',
    ],
    links: [{ label: 'Profile', href: '/profile' }],
    questions: [
      { id: 'section-found', text: 'Was it easy to find the observations about you on your Profile page?' },
      { id: 'banner-clear', text: 'Did the explanation banner make it clear these records are for your training and not hidden from you?' },
      { id: 'no-edit-control', text: 'Did you confirm there\'s no way to edit, delete, or hide an observation?' },
    ],
    background:
      'OBS-02 (34-08) — listObservationsForWorker() is self-scoped (observed_worker_id = auth.uid()); ObservationsSection ships in the same change as the write UI per D-08 (worker visibility is what makes this coaching evidence, not surveillance).',
  },

  {
    id: 'p35-training-matrix',
    dateAdded: '2026-07-24',
    category: 'Phase 35 — Training matrix & records',
    title: 'Open the Training matrix — do you see each person\'s training state per SOP?',
    status: 'active',
    summary:
      'Team now has a third view: a Matrix showing, for each person and each procedure they need to know, whether they\'ve read it, been watched doing it, or been signed off.',
    tryIt: [
      'Open the Training section.',
      'Look at the matrix of people and procedures.',
      'Look down a column and along a row — each cell should be a coloured/labelled pill.',
    ],
    links: [{ label: 'Training matrix', href: '/?s=training' }],
    questions: [
      { id: 'matrix-clear', text: 'Was it clear which SOPs each person has and hasn\'t completed?' },
      { id: 'labels-clear', text: 'Were the labels (e.g. "Signed off", "Read only") easy to understand?' },
    ],
  },
  {
    id: 'p35-cell-click-record',
    dateAdded: '2026-07-24',
    category: 'Phase 35 — Training matrix & records',
    title: 'Click a coloured cell — does the person\'s record open at that SOP?',
    status: 'active',
    summary:
      'Clicking any cell in the Matrix should open that person\'s side panel, scrolled straight to the procedure you clicked, showing what evidence exists for it.',
    tryIt: [
      'From the Matrix view, click any cell.',
      'Check the panel opens for the right person, and that the procedure you clicked is highlighted or already in view.',
    ],
    links: [{ label: 'Training matrix', href: '/?s=training' }],
    questions: [
      { id: 'right-person', text: 'Did the panel open for the right person?' },
      { id: 'right-sop', text: 'Was the procedure you clicked already scrolled into view?' },
    ],
  },
  {
    id: 'p35-export-csv',
    dateAdded: '2026-07-24',
    category: 'Phase 35 — Training matrix & records',
    title: 'Press Export CSV and open the file — are the columns and the completion-date range right?',
    status: 'active',
    summary:
      'Both the Matrix and a person\'s panel have an "Export CSV" button that downloads a spreadsheet of training records — useful for handing to an auditor.',
    tryIt: [
      'From the Matrix, press "Export CSV" and open the downloaded file in Excel/Sheets.',
      'From a person\'s panel, press their "Export CSV" and open that file too.',
      'Check the worker name/email, procedure, dates, and sign-off columns look right.',
    ],
    links: [{ label: 'Training matrix', href: '/?s=training' }],
    questions: [
      { id: 'file-opens', text: 'Did the downloaded file open cleanly in a spreadsheet program?' },
      { id: 'columns-right', text: 'Did the columns (worker, procedure, dates, sign-off) look correct?' },
    ],
  },
  {
    id: 'p36-outdated-version',
    dateAdded: '2026-07-27',
    category: 'Phase 36 — Refresher cadence & version currency',
    title: 'Publish a new version of a procedure — can you tell who\'s still trained on the old one?',
    status: 'active',
    summary:
      'When a procedure gets updated, workers who already did the old version keep their training record — they just get a gentle "outdated version" note until they read the new one.',
    tryIt: [
      'Pick a procedure someone has already completed, and publish a new version of it (Edit into new version, then publish).',
      'Open Team → Matrix, or that person\'s training record, and look at that procedure.',
    ],
    links: [{ label: 'Training matrix', href: '/?s=training' }],
    questions: [
      { id: 'outdated-visible', text: 'Could you tell at a glance who is still trained on the older version?' },
      { id: 'record-intact', text: 'Did their existing training record stay intact (nothing was reset or removed)?' },
    ],
  },
  {
    id: 'p36-refresher-cadence',
    dateAdded: '2026-07-27',
    category: 'Phase 36 — Refresher cadence & version currency',
    title: 'Set a refresher reminder on a procedure — does it show up without blocking anyone?',
    status: 'archived', // 58-16: the setting lived on the retired Version History page; its new home is not built yet
    summary:
      'Admins can set how often workers should redo a procedure (e.g. every 6 months). Once that time passes, workers see a friendly reminder — it never stops them opening or completing the procedure.',
    tryIt: [
      'Set a refresher interval on a procedure (e.g. 1 month, to see it trigger quickly for testing).',
      'As a worker who\'s already completed that procedure, check the SOP\'s "Updated since you last did it" line and the training matrix for a reminder.',
      'Try opening and completing the procedure again — confirm nothing blocks you.',
    ],
    links: [{ label: 'Training matrix', href: '/?s=training' }],
    questions: [
      { id: 'cadence-clear', text: 'Was it clear how often workers need to redo this procedure?' },
      { id: 'reminder-visible', text: 'Did the reminder appear where you\'d expect (the site / the matrix)?' },
      { id: 'never-blocked', text: 'Did it ever stop anyone from opening or completing the SOP?' },
    ],
  },
  {
    id: 'p37-blocked-supervisor',
    dateAdded: '2026-07-28',
    category: 'Phase 37 — Assessor governance',
    title: 'As a supervisor who hasn\'t been signed off on a procedure yet, try to record that someone else did it correctly',
    status: 'active',
    summary:
      'Only someone who has themselves been checked off on a procedure can vouch for someone else doing it right. If you haven\'t been signed off yet, that one option is turned off for you — everything else about recording what you saw still works.',
    tryIt: [
      'As a supervisor, open a worker\'s panel in the Training matrix and start recording an observation for a procedure you\'ve never been signed off on yourself.',
      'Try to pick "performed to SOP" (done correctly) and see what happens.',
      'Check the coaching option ("needs support") still works normally.',
      'Look for a way to ask someone to sign you off, and try it.',
    ],
    links: [{ label: 'Training matrix', href: '/?s=training' }],
    questions: [
      { id: 'option-unavailable', text: 'Was it clear that "done correctly" wasn\'t available to you yet?' },
      { id: 'explanation-clear', text: 'Did the on-screen message explain why, in a way that made sense?' },
      { id: 'coaching-still-works', text: 'Could you still record "needs support" for coaching purposes?' },
      { id: 'can-request', text: 'Was it easy to ask someone to sign you off?' },
    ],
    background:
      'ASR-01 (37-03/37-04/37-05) — recordObservation/signOffCompletion gate the advancing verdict on isSignedOffAssessor (D-03/D-04); requestAssessorReview closes the D-08 request loop.',
  },
  {
    id: 'p37-admin-override',
    dateAdded: '2026-07-28',
    category: 'Phase 37 — Assessor governance',
    title: 'As an admin on a brand-new organisation with nobody signed off yet, record that a worker did a procedure correctly',
    status: 'active',
    summary:
      'On day one, nobody at a new organisation has been formally signed off on anything yet — so nobody could ever record the first "done correctly" result. Admins and safety managers can break that deadlock, as long as they give a reason, which goes on the permanent record.',
    tryIt: [
      'As an admin (or safety manager) at a new organisation with no one signed off yet, record an observation for a worker and choose "performed to SOP" (done correctly).',
      'Check that you\'re asked to type a reason before it will save.',
      'Read the on-screen message about what happens to that reason.',
      'Save it and confirm it goes through.',
    ],
    links: [{ label: 'Training matrix', href: '/?s=training' }],
    questions: [
      { id: 'asked-for-reason', text: 'Were you asked for a reason before it would let you save?' },
      { id: 'permanent-record-explained', text: 'Did the screen make it clear this goes on the permanent record?' },
      { id: 'saved-successfully', text: 'Did it save without any confusing errors?' },
    ],
    background:
      'ASR-01/D-05 — the override path is admin/safety_manager only, mandatory reason enforced by Zod, the server action, and a DB CHECK constraint three layers deep; is_assessor_override + override_reason stamped on the row.',
  },
  {
    id: 'p37-assessment-requests',
    dateAdded: '2026-07-28',
    category: 'Phase 37 — Assessor governance',
    title: 'As an admin or safety manager, check the assessment-requests list on the Training matrix page',
    status: 'active',
    summary:
      'When a supervisor who isn\'t signed off yet asks to be assessed, it shows up in a short list for admins and safety managers, with a one-tap way to go and assess them.',
    tryIt: [
      'Open the Training matrix page as an admin or safety manager.',
      'Find the assessment-requests list and check it shows who asked and which procedure it\'s for.',
      'Click "Assess now" on one of the requests.',
      'Confirm the recording screen opens with the right person and procedure already filled in.',
    ],
    links: [{ label: 'Training matrix', href: '/?s=training' }],
    questions: [
      { id: 'list-shows-who-and-what', text: 'Was it clear who asked and which procedure they need to be assessed on?' },
      { id: 'assess-now-prefilled', text: 'Did "Assess now" open the form with the right person and procedure already filled in?' },
    ],
    background:
      'ASR-01/D-08 — AssessmentRequestsPanel (37-05) reads listAssessmentRequests() and mounts the shared RecordObservationModal preset to the requester + SOP; requestAssessorReview (37-03) writes the underlying worker_notifications row.',
  },
  {
    id: 'governance-inbox',
    dateAdded: '2026-09-29',
    category: 'Admin home',
    title: 'Does Sign-offs show you what needs doing?',
    status: 'active',
    summary:
      'Admins get a Sign-offs section: a list of things that need attention, one action per row.',
    tryIt: [
      'Open Sign-offs from the menu.',
      'Look at the list and the numbers on the filters above it.',
      'Give one procedure an owner.',
      'Open a row that wants you to look at a SOP.',
    ],
    links: [{ label: 'Sign-offs inbox', href: '/?s=signoffs' }],
    questions: [
      { id: 'row-clear', text: 'Was it clear what each row wanted you to do?' },
      { id: 'row-disappears', text: 'Did the row disappear once you had done it?' },
      { id: 'site-marks-make-sense', text: 'When a row opened a SOP, was it clear how to get back to Sign-offs?' },
    ],
    background:
      'Phase 54 (D-01/D-02) — the inbox is listGovernanceQueue + listAdminSopRows + listSiteHealthForOrg derived into InboxItem[] by deriveInbox(); Phase 59 moved it into the Inbox tab and the old governance page redirects there; Phase 63 names the section Sign-offs.',
  },
  {
    id: 'p59-office',
    dateAdded: '2026-10-06',
    category: 'Admin home',
    title: 'Are Sign-offs and People the one place to get things done?',
    status: 'active',
    summary:
      'Sign-offs and People hold everything that used to be spread over Governance, Team and Access: an Inbox of things waiting on you, a Decisions record, people and roles, and who can see which SOPs.',
    tryIt: [
      'Open Sign-offs from the menu.',
      'In the Inbox, sign off a finished SOP or mark one of your own SOPs as reviewed. Do it without leaving the row.',
      'Look at the Decisions tab and find what you just did.',
      'Open People and look at who is on the team.',
      'Open the Access tab and pick a SOP to see who can see it.',
      'Type an old address such as /governance into the browser.',
    ],
    links: [
      { label: 'Sign-offs inbox', href: '/?s=signoffs' },
      { label: 'Decisions', href: '/?s=signoffs&tab=decisions' },
      { label: 'People', href: '/?s=people' },
      { label: 'Access', href: '/?s=people&tab=access' },
    ],
    questions: [
      { id: 'inbox-one-action', text: 'Was it clear what each row in the Inbox wanted you to do?' },
      { id: 'decision-recorded', text: 'Did your action show up on the Decisions tab?' },
      { id: 'old-address', text: 'Did the old address take you to the right section?' },
      { id: 'supervisor-inbox-only', text: 'As a supervisor, did you see only the Inbox, with no tabs?' },
    ],
    background:
      'Phase 59 tabs, re-homed by Phase 63: /?s=signoffs (inbox, requests, decisions) and /?s=people (people, access). tabsFor() decides what mounts; each tab\'s server read is the gate. The old governance, team, access and training addresses redirect in the proxy and next.config.',
  },
  {
    id: 'library-table',
    dateAdded: '2026-09-29',
    category: 'Admin home',
    title: 'Can you see at a glance which procedures need work?',
    status: 'archived',
    summary:
      'The admin SOPs page is now a table with a row of five circles per procedure — a quick health check without opening anything.',
    tryIt: [
      'Open SOPs as an admin.',
      'Read the row of five circles next to a procedure.',
      'Use the Status and Owner filters above the table.',
      'Click Edit on one procedure.',
    ],
    links: [{ label: 'SOPs', href: '/' }],
    questions: [
      { id: 'circles-make-sense', text: 'Do the five circles make sense without an explanation?' },
      { id: 'filters-find-expected', text: 'Do the Status and Owner filters find what you expect?' },
      { id: 'edit-right-place', text: 'Does Edit take you to the right place?' },
    ],
    background:
      'Archived 2026-10-05 (Phase 57, D-13): the admin table page was deleted. Drafts list in Manage SOPs and machine and site SOPs sit on the home; the health marks live on the site map and the Sign-offs inbox.',
  },
  {
    id: 'plant-home-worker',
    dateAdded: '2026-09-29',
    category: 'Worker home',
    title: 'Can a worker find their next job from the site map?',
    status: 'archived',
    summary:
      'Archived 2026-10-08: the picture-as-home with orange numbers on machines was replaced by the SOP-first home. See "The home: find, read and start a SOP" and "The site map".',
    questions: [
      { id: 'pin-numbers-make-sense', text: 'Did the orange numbers on the machines make sense?' },
      { id: 'click-shows-right-jobs', text: 'Did clicking a machine show you the right jobs for it?' },
      { id: 'now-card-right-job', text: 'Did the card at the top show the job you\'d actually do first?' },
    ],
    background:
      'HOM-01..06 (Phase 52), replaced by Phase 63 (ADR-0004): pins, to-do counts and the next-job card are retired; the home is search and the SOP list.',
  },
  {
    id: 'phone-home-worker',
    dateAdded: '2026-09-29',
    category: 'Worker home',
    title: 'Can a worker get to a machine\'s jobs from their phone?',
    status: 'archived',
    summary:
      'Archived 2026-10-08: the old phone home was replaced by the phone view of the SOP-first home. See "The home on a phone".',
    questions: [
      { id: 'clear-first-step', text: 'Was it clear what to do first?' },
      { id: 'right-jobs', text: 'Did picking a machine show the right jobs?' },
      { id: 'scan-right-machine', text: 'Did scanning (or typing the code) take you to the right machine?' },
    ],
    background:
      'PHN-01..03 (Phase 53); the machine plate address /m/<code> still resolves, the phone home around it is Phase 63\'s tab bar and List | Site map switch.',
  },
  {
    id: 'p58-focus-screen',
    dateAdded: '2026-10-05',
    category: 'The SOP screen',
    title: 'Is the one SOP screen clear - read it, start it, and (for admins) edit it?',
    status: 'active',
    summary:
      'A SOP is one screen. Workers read it, press start and are led through the steps one at a time; admins flip the same screen to Edit and change the steps in place.',
    tryIt: [
      'Open a SOP from the list and read down the page.',
      'Press start: do a hazard step, a step that needs a photo, then Send for sign-off.',
      'If you are an admin: switch the same SOP to Edit, change a step, tick it, and look at the Publish bar.',
    ],
    links: [{ label: 'The home', href: '/' }],
    questions: [
      { id: 'one-screen', text: 'Did it feel like one screen you could read, run and (as an admin) edit, rather than several pages?' },
      { id: 'walk-clear', text: 'While running the SOP, was it always obvious what to do next?' },
      { id: 'edit-clear', text: 'As an admin, was it obvious which steps still needed checking before you could publish?' },
    ],
    background:
      'Phase 58: the tabbed SOP page, the old step-by-step routes, the builder and the versions page are replaced by the focus screen (Browse, run, Edit). Steps are the one model; the publish gate counts unchecked steps and open AI findings. Deployed eval: tests/evals/sop-focus.eval.ts.',
  },

  {
    id: 'p60-site-overview',
    dateAdded: '2026-10-06',
    category: 'The home',
    title: 'Requests, notifications and objectives',
    status: 'active',
    summary:
      'What you have been told, what you have asked for and what the site is aiming for sit in My record and the Objectives list. A dot beside the menu shows something new.',
    tryIt: [
      'Open My record and look under your finished SOPs.',
      'Look at the dot beside search, then press it.',
      'Open a notification and check it takes you to the right place.',
      'Find My requests and look at what you asked and what was answered.',
    ],
    links: [{ label: 'The home', href: '/' }],
    questions: [
      { id: 'bell-clear', text: 'Was it obvious what the dot meant?' },
      { id: 'opens-right', text: 'Did opening a notification take you somewhere that made sense?' },
      { id: 'requests-found', text: 'Could you find your requests and see what happened to them?' },
    ],
    background:
      'Phase 60 content, re-homed by Phase 63: the bell is a dot (browser-client unread count, no polling); notifications, requests and objectives sit in My record. Evals: tests/evals/requests.eval.ts.',
  },

  // ===================== The SOP-first home (Phase 63) =====================
  {
    id: 'p63-home-find-read-start',
    dateAdded: '2026-10-08',
    category: 'The home',
    title: 'The home: find, read and start a SOP',
    status: 'active',
    summary:
      'The home is search and a list of SOPs. We want to know if a worker can find the right one in a few taps, read it, and start it.',
    tryIt: [
      'Sign in and look at the home. Find the Recent and Most used lists.',
      'Type part of a SOP name, a step or a tool into search and open a result.',
      'Press start. Do a step, press Stop, and notice where you land.',
      'Open the same SOP again and look at what the start button says.',
      'Search for something that does not exist and look at what you are offered.',
    ],
    links: [{ label: 'The home', href: '/' }],
    questions: [
      { id: 'found-fast', text: 'Did you find the SOP you wanted in a few taps?' },
      { id: 'start-obvious', text: 'Was it obvious how to start the SOP?' },
      { id: 'picks-up', text: 'When you came back, did it pick up where you left off?' },
      { id: 'miss-helpful', text: 'When nothing matched, was it clear how to ask for one?' },
    ],
    background:
      'Phase 63 (HOME-01..05, FUSE-01..02): SopList + ReadView on /, search over titles, steps and tools, Recent / Most used / All SOPs by area or type, start plays the merge and opens /sops/[sopId]?go=1. Evals: tests/evals/home.eval.ts, start.eval.ts.',
  },
  {
    id: 'p63-site-map',
    dateAdded: '2026-10-08',
    category: 'The home',
    title: 'The site map',
    status: 'active',
    summary:
      'The library drawn as a map of the site: areas, the objects in them, and the SOPs each one carries.',
    tryIt: [
      'Switch to the site map beside the list.',
      'Choose an area, then an object in it.',
      'Open one of its SOPs.',
      'Press Esc (or Back) and notice which level you return to.',
    ],
    links: [{ label: 'The home', href: '/' }],
    questions: [
      { id: 'map-clear', text: 'Was it clear what each area and object on the map stood for?' },
      { id: 'counts-right', text: 'Did the SOP count on an object match what you saw when you opened it?' },
      { id: 'back-one-level', text: 'Did Back take you up one level at a time?' },
    ],
    background:
      'Phase 63: library site map components in src/components/home/map; the area is carried in the address (/?area=<id>).',
  },
  {
    id: 'p63-sections',
    dateAdded: '2026-10-08',
    category: 'The home',
    title: 'Your sections',
    status: 'active',
    summary:
      'The menu shows only the sections your role can use: workers see SOPs and My record, supervisors add Sign-offs, admins and safety managers add People, Training and Manage SOPs.',
    tryIt: [
      'Look at the menu (the tab bar on a phone) and list the sections you see.',
      'Open each one and check it has something in it, or says plainly that it is empty.',
      'If you are an admin: in Sign-offs, open Inbox, Requests and Decisions; in People, open the people and access tabs.',
      'Type an address for a section you should not have, such as /?s=people as a worker.',
    ],
    links: [
      { label: 'Sign-offs', href: '/?s=signoffs' },
      { label: 'People', href: '/?s=people' },
      { label: 'Training', href: '/?s=training' },
      { label: 'Manage SOPs', href: '/?s=manage' },
    ],
    questions: [
      { id: 'sections-match-role', text: 'Did the menu show what you would expect for your role?' },
      { id: 'names-clear', text: 'Did each section name tell you what is inside it?' },
      { id: 'hidden-lands-home', text: 'Did a section you should not have take you to the home, not an error?' },
    ],
    background:
      'Phase 63: sectionsForRole() and tabsFor() in src/lib/shell/home-state.ts decide what mounts; each section\'s server read is the real gate (see CAPABILITY-MATRIX.md).',
  },
  {
    id: 'p63-my-record',
    dateAdded: '2026-10-08',
    category: 'The home',
    title: 'My record and notifications',
    status: 'active',
    summary:
      'Every role has a My record section: the SOPs you have finished, what you have been told and what you have asked for.',
    tryIt: [
      'Finish a SOP, then open My record.',
      'Open the completion and read the steps and photos.',
      'Press Back and notice where you land.',
      'Type /activity into the browser.',
    ],
    links: [{ label: 'My record', href: '/?s=record' }],
    questions: [
      { id: 'record-found', text: 'Was it easy to find the SOP you had just finished?' },
      { id: 'back-to-record', text: 'Did Back from a completion take you to My record?' },
      { id: 'old-address-record', text: 'Did the old /activity address take you to My record?' },
    ],
    background:
      'Phase 63 (63-09, 63-14): MyRecordSection + CompletionList on /?s=record; /activity redirects there in next.config.ts; /activity/[completionId] stays as the completion page.',
  },
  {
    id: 'p63-phone',
    dateAdded: '2026-10-08',
    category: 'The home',
    title: 'The home on a phone',
    status: 'active',
    summary:
      'On a phone the home is one column: a tab bar for the sections, a List | Site map switch, and Read that takes the whole screen.',
    tryIt: [
      'Open the home on your phone.',
      'Use the tab bar at the foot to move between sections.',
      'Switch to the site map and tap a number on it, then find that number in the key under the map.',
      'Open a SOP and use the back link at the top.',
    ],
    links: [{ label: 'The home', href: '/' }],
    questions: [
      { id: 'tabs-reachable', text: 'Could you reach every tab with one thumb?' },
      { id: 'key-clear', text: 'Did the numbered key tell you what each number on the map was?' },
      { id: 'back-link-clear', text: 'Was it obvious how to get back from a SOP to the list?' },
    ],
    background:
      'Phase 63 (63-11): TabBar, the List | Site map toggle and the numbered key; below the desktop breakpoint Read covers the list.',
  },

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
