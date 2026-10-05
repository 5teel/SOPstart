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
      'Tap between the rooms on the site (Office, Workshop, Smoko room, Noticeboard) and open Sign-off from the Office.',
      'If you are an admin, open the Office and switch between the inbox, Team and Settings.',
      'Open a SOP from a machine or the Noticeboard, go back, and open another one.',
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
      'The old "Activity" page is now called "Sign-off", reached from the Office, and admins see the sign-off queue there instead of being bounced to the SOP admin area.',
    tryIt: [
      'Sign in and open the Office on the site: Sign-off is listed there.',
      'Tap Sign-off — you should see completed procedures waiting for review, not an editing screen.',
      'If you are an admin: the Office shows Team and Settings, and the Workshop shows New SOP. Open New SOP — it should take you straight to the four ways of making a SOP.',
    ],
    questions: [
      { id: 'clear', text: 'Without anyone explaining it, could you guess what lives under "SOPs" and what lives under "Sign-off"?' },
      { id: 'signoff-name', text: 'Is "Sign-off" a good name for the page where completed work gets reviewed? If not, what would you call it?' },
      { id: 'lost', text: 'In your first five taps, did you ever land somewhere you did not expect?' },
    ],
    background:
      'Nav clarity pass (2026-07-30): "Activity" renamed to "Sign-off" (the header it was renamed in is gone since Phase 57); /activity no longer redirects admins to the old admin SOP page (they see the supervisor sign-off queue).',
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
      'Walk through and complete the new version.',
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
      'The Office now opens an "Access" screen: a wiring diagram where you click an area, department or person to trace which library collections they can see, and click a new SOP to wire it up to the right parts of your org. The same view doubles as a library filter.',
    tryIt: [
      'Publish a SOP and click the "Choose who sees it →" button that appears — you should land on the Access view with that SOP tagged "NEW".',
      'Click a department or person on the left to see the lines light up and a plain "N people can see this" banner.',
      'Click the new SOP, choose a department or two, and hit "✓ Save — done" — confirm the banner and the "Who can see this?" panel below update live.',
      'With something focused, click "Open in the SOP list →" and confirm the site opens on that department place.',
    ],
    links: [{ label: 'Access (from the Office)', href: '/?place=office&tab=access' }],
    questions: [
      { id: 'trace-clear', text: 'Was it clear which SOPs an area/department/person can see when you clicked it?' },
      { id: 'wireup-easy', text: 'Was wiring up a new SOP\'s access straightforward?' },
      { id: 'filter-useful', text: 'Was jumping from the diagram to that department on the site useful?' },
      { id: 'blast-radius-trust', text: 'Did the "N people can see this" count feel trustworthy before you confirmed?' },
    ],
    background:
      'D-09 (the Access view, now the Office Access tab), D-12 (wire-up entry from both the post-publish CTA and organically), D-11 (additive-only grants — no in-place revoke here), SC-4 (viz-as-library-filter deep-links). WiringPatchBay/SelectionStrip built in 32-08; the page arm, deep-links, and publish CTA land in 32-09; drill-down + plain-language copy + the answer panel land in 33-08/33-09 (see the Phase 33 — Access map entries below for current copy).',
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
    links: [{ label: 'Access (from the Office)', href: '/?place=office&tab=access' }],
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
    links: [{ label: 'Access (from the Office)', href: '/?place=office&tab=access' }],
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
      'Supervisors can now record that they personally watched a worker perform a SOP — a verdict (performed to SOP / needs support) plus an optional note. You can start this from a person\'s panel in Team, or straight from a completion in Activity.',
    tryIt: [
      'Open the Training matrix from the Smoko room, click a cell to open the panel for that person, then click "Record observation".',
      'Pick a SOP, choose a verdict, add a short note, and save — check it appears in their observation history.',
      'Now try the other way in: open Activity, find a completion, and use the "I observed this" row action instead — confirm it pre-fills the worker and SOP.',
    ],
    links: [{ label: 'Training matrix', href: '/admin/training' }, { label: 'Activity', href: '/activity' }],
    questions: [
      { id: 'entry-found', text: 'Was it easy to find "Record observation" from both Team and Activity?' },
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
      'Open the Smoko room and press Training matrix.',
      'Look at the matrix of people and procedures.',
      'Look down a column and along a row — each cell should be a coloured/labelled pill.',
    ],
    links: [{ label: 'Training matrix', href: '/admin/training' }],
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
    links: [{ label: 'Training matrix', href: '/admin/training' }],
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
    links: [{ label: 'Training matrix', href: '/admin/training' }],
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
    links: [{ label: 'Training matrix', href: '/admin/training' }],
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
      'Admins can set how often workers should re-walk a procedure (e.g. every 6 months). Once that time passes, workers see a friendly reminder — it never stops them opening or completing the procedure.',
    tryIt: [
      'Set a refresher interval on a procedure (e.g. 1 month, to see it trigger quickly for testing).',
      'As a worker who\'s already completed that procedure, check the "Next for you" card on the site and the training matrix for a reminder.',
      'Try opening and completing the procedure again — confirm nothing blocks you.',
    ],
    links: [{ label: 'Training matrix', href: '/admin/training' }],
    questions: [
      { id: 'cadence-clear', text: 'Was it clear how often workers need to re-walk this procedure?' },
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
      'As a supervisor, open a worker\'s panel in Team (or a completion in Activity) and start recording an observation for a procedure you\'ve never been signed off on yourself.',
      'Try to pick "performed to SOP" (done correctly) and see what happens.',
      'Check the coaching option ("needs support") still works normally.',
      'Look for a way to ask someone to sign you off, and try it.',
    ],
    links: [{ label: 'Training matrix', href: '/admin/training' }, { label: 'Activity', href: '/activity' }],
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
    links: [{ label: 'Training matrix', href: '/admin/training' }],
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
    links: [{ label: 'Training matrix', href: '/admin/training' }],
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
    title: 'Does the Office show you what needs doing?',
    status: 'active',
    summary:
      'Admins now have a Governance page: a list of things that need attention, with a picture of the site next to it.',
    tryIt: [
      'Open the Office from the site.',
      'Look at the list and the numbers on the filters above it.',
      'Give one procedure an owner.',
      'Look at the picture of the site beside the list.',
      'Click a machine with a red mark on it.',
    ],
    links: [{ label: 'Office inbox', href: '/?place=office' }],
    questions: [
      { id: 'row-clear', text: 'Was it clear what each row wanted you to do?' },
      { id: 'row-disappears', text: 'Did the row disappear once you had done it?' },
      { id: 'site-marks-make-sense', text: 'Did the red and orange marks on the site picture make sense?' },
    ],
    background:
      'Phase 54 (D-01/D-02) — the inbox is listGovernanceQueue + listAdminSopRows + listSiteHealthForOrg derived into InboxItem[] by deriveInbox(); Phase 59 moved it into the Office Inbox tab and the old governance page redirects there.',
  },
  {
    id: 'p59-office',
    dateAdded: '2026-10-06',
    category: 'Admin home',
    title: 'Is the Office the one place to get things done?',
    status: 'active',
    summary:
      'The Office now holds everything that used to be spread over Governance, Team and Access: an Inbox of things waiting on you, a Decisions record, People and roles, and who can see which SOPs.',
    tryIt: [
      'Open the Office from the site.',
      'In the Inbox, sign a walk off or mark one of your own SOPs as reviewed. Do it without leaving the row.',
      'Look at the Decisions tab and find what you just did.',
      'Open People and roles and look at who is on the team.',
      'Open Access and pick a SOP to see who can see it.',
      'Type an old address such as /governance into the browser.',
    ],
    links: [
      { label: 'Office inbox', href: '/?place=office' },
      { label: 'Decisions', href: '/?place=office&tab=decisions' },
      { label: 'People & roles', href: '/?place=office&tab=people' },
      { label: 'Access', href: '/?place=office&tab=access' },
    ],
    questions: [
      { id: 'inbox-one-action', text: 'Was it clear what each row in the Inbox wanted you to do?' },
      { id: 'decision-recorded', text: 'Did your action show up on the Decisions tab?' },
      { id: 'old-address', text: 'Did the old address take you to the right place in the Office?' },
      { id: 'supervisor-inbox-only', text: 'As a supervisor, did you see only the Inbox, with no tabs?' },
    ],
    background:
      'Phase 59 — tabs live at /?place=office&tab=inbox|decisions|people|access (tabsForRole decides what mounts; each tab\'s server read is the gate). The old governance, team and access addresses redirect in the proxy via officeRedirectFor(); the training matrix stays on /admin/training until Phase 61.',
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
      'Archived 2026-10-05 (Phase 57, D-13): the admin table page was deleted. Drafts list in the Workshop and machine and site SOPs sit on the one screen; the health marks live on the machine pins and the Governance inbox.',
  },
  {
    id: 'plant-home-worker',
    dateAdded: '2026-09-29',
    category: 'Worker home',
    title: 'Can a worker find their next job from the site map?',
    status: 'active',
    summary:
      'On a computer, a worker\'s home screen shows a picture of the site instead of a list. We want to know if it\'s obvious how to find a job from it.',
    tryIt: [
      'Sign in as a worker on a computer (not a phone).',
      'Look at the drawing of the site.',
      'Click a machine that has an orange number on it.',
      'Open a job from the list that slides in.',
    ],
    links: [{ label: 'Open SOPs', href: '/' }],
    questions: [
      { id: 'pin-numbers-make-sense', text: 'Did the orange numbers on the machines make sense?' },
      { id: 'click-shows-right-jobs', text: 'Did clicking a machine show you the right jobs for it?' },
      { id: 'now-card-right-job', text: 'Did the "Next for you" card show the job you\'d actually do first?' },
    ],
    background:
      'HOM-01..06 (Phase 52) — a desktop, non-admin worker whose org has a drawn site (>=1 machine) saw the plant home (replaced by the one screen in Phase 57) instead of the Miller frame; pins/Now card/ask bar all derive from worker-signal.ts, never stored. Admins and phone widths are unaffected this phase (Phase 53/54).',
  },
  {
    id: 'phone-home-worker',
    dateAdded: '2026-09-29',
    category: 'Worker home',
    title: 'Can a worker get to a machine\'s jobs from their phone?',
    status: 'archived',
    summary:
      'On a phone, the home screen now starts with a search box, the next job, a picture of the site and a Scan button.',
    tryIt: [
      'Sign in as a worker on your phone.',
      'Look at the top of the home screen.',
      'Tap the picture of the site and pick a machine.',
      'Go back and tap Scan a machine plate — point it at a printed plate, or type the code under it.',
    ],
    questions: [
      { id: 'clear-first-step', text: 'Was it clear what to do first?' },
      { id: 'right-jobs', text: 'Did picking a machine show the right jobs?' },
      { id: 'scan-right-machine', text: 'Did scanning (or typing the code) take you to the right machine?' },
    ],
    background:
      'PHN-01..03 (Phase 53) — below 1024px a worker (or an admin on a phone) whose org has a drawn site sees the phone home: ask bar, Now card, floor thumbnail → department-grouped machine sheet, and an in-app QR scanner with a typed-code fallback, all resolving to /m/<code>.',
  },
  {
    id: 'p58-focus-screen',
    dateAdded: '2026-10-05',
    category: 'The SOP screen',
    title: 'Is the one SOP screen clear — read it, walk it, and (for admins) edit it?',
    status: 'active',
    summary:
      'A SOP is now one screen. Workers read it, press Start walking and are led through the steps one at a time; admins flip the same screen to Edit and change the steps in place.',
    tryIt: [
      'Open a SOP from a machine or the Noticeboard and read down the page.',
      'Press Start walking: do a hazard step, a step that needs a photo, then Send for sign-off.',
      'If you are an admin: switch the same SOP to Edit, change a step, tick it, and look at the Publish bar.',
    ],
    links: [{ label: 'The site', href: '/' }],
    questions: [
      { id: 'one-screen', text: 'Did it feel like one screen you could read, walk and (as an admin) edit, rather than several pages?' },
      { id: 'walk-clear', text: 'While walking, was it always obvious what to do next?' },
      { id: 'edit-clear', text: 'As an admin, was it obvious which steps still needed checking before you could publish?' },
    ],
    background:
      'Phase 58: the tabbed SOP page, the old walkthroughs, the builder and the versions page are replaced by the focus screen (Browse, Walk, Edit). Steps are the one model; the publish gate counts unchecked steps and open AI findings. Deployed eval: tests/evals/sop-focus.eval.ts.',
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
