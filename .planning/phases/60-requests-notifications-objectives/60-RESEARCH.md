# Phase 60: Requests, Notifications & Objectives - Research

**Researched:** 2026-10-06
**Domain:** Next.js 16 / Supabase (RLS + service-role cores) -- three new append-style tables, a tab in the Office pane, a bell + overview in the one-screen shell, AI-field extension, a header-authenticated cron route, deletion of the assign screen
**Confidence:** HIGH on code/data facts (every claim below was read from the tree or the live database on 2026-10-06); MEDIUM on three design calls flagged `[ASSUMED]` in the Assumptions Log

## Summary

Phase 60 is mostly **wiring onto Phase 56/59 machinery that already exists**: `recordDecision()` (one ledger writer), the 59 Office pane (`tabsForRole`, `OfficePane`, `ReasonDialog`, receipt slot, `SHELL_KEY` patch), the 57 shell (`ShellFrame` + `SiteSummary`), the 23 AI-field registry (`applyAiWrite` -> `gateWrite`), and the 26.5 cron idiom. Three new tables (`requests`, `notifications`, `objectives`) follow the `decisions` / `site_*` precedent: org-scoped SELECT policies only, every write through a server module with the service role and an explicit org filter. The migration is `00074`, the next free number; the live database is PostgreSQL 17.6 `[VERIFIED: Management API select version(), 2026-10-06]`.

Reading the code against CONTEXT.md found **twenty-three places where a locked decision assumes something the code does not do** (section "Spec-versus-code findings"). The ones that change the plan shape: (1) `sops.objective` already exists (Phase 58 D-20 says "Phase 60 migrates it") and CONTEXT is silent; (2) `worker_notifications` still has live readers (the Phase 37 assessment-request panel) and its live data is `completion_rejected` / `removal_request`, not `sop_updated`, so D-07's "copy unread rows as `sop_updated`" is wrong and a copy would light 28 stale bells; (3) `assignSopToRole/User` are admin-only (code *and* RLS) and each already writes an `assign` ledger row, so a supervisor's ask and "exactly ONE ledger row" both need a new service-role core; (4) a role-targeted ask is one dynamic `role` row, so a single person cannot "decline" it by removing it; (5) the bundle gate on `/` and `/sops/[sopId]` has no headroom, so the overview and every raise/ask surface must be lazy; (6) the daily sweep needs a second cron route AND a Railway cron schedule that is not in the repo and whose existence is unverified.

No new npm package is needed. The only external dependency is operational: a Railway cron schedule for the review-due / machine-without-SOP sweep.

**Primary recommendation:** Build in this order -- (1) migration `00074` + ledger-kind widening + pure models, (2) service-role cores and thin `'use server'` actions with the writer registry updated in the same commits, (3) wire the five notification triggers and the cron route, (4) UI (Requests tab, bell, lazy overview, objective lines, composer/ask picker), (5) delete the assign screen with the repoint inventory, (6) one deployed eval + one live-probe run. Keep notification reads and mark-read on the browser Supabase client under RLS (not server actions) so a notification tap that navigates can never orphan a server action (CLAUDE.md 2026-09-29).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Requests (RQS-01..04)**
- **D-01 -- One `requests` table, four kinds, three states.** Kinds: `change_sop` (about a SOP), `new_sop` (about a machine or the site), `observe_me` (about a SOP the asker does), `do_sop` (about a SOP, aimed at a role or a person). States: `open -> accepted | declined` (append the answer, never edit the ask); plus `withdrawn` by the asker while open. Every row carries `organisation_id`, `raised_by` (user id or agent name -- one of the two, enforced), `about` (`subject_type` + `subject_id`), `note`, and on answer: `answered_by`, `answer_note`, `decided_at`. Accept and decline each write exactly ONE ledger row via `recordDecision()` (new kinds `request_accepted` / `request_declined`; raising is not a decision). RLS: org-scoped; a person reads their own requests plus, for admin / safety_manager / supervisor, the org's open ones; writes go through server actions only.
- **D-02 -- A do-SOP ask from a supervisor or admin is auto-accepted on their authority.** *(Simon's pick.)* Raising it writes the request as `accepted`, writes the existing `sop_assignments` row(s) (role -> every member of that role; person -> that person) through the existing `assignSopToRole` / `assignSopToUser` core so `worker-signal`'s due logic, machine badges and the Now card change nothing, and notifies each person ("You've been asked to do <SOP>"). The person can **decline with a note**, which flips the request to `declined`, removes the assignment, writes the ledger row and notifies the asker -- that decline is the one worker-side answer in the system. Worker-raised kinds (`change_sop`, `new_sop`, `observe_me`) open in the Office Requests tab for accept/decline by an admin or supervisor.
- **D-03 -- Requests tab in the Office** (the fifth tab the Phase 59 contract listed): open requests newest first, one row = who asked - what - about - when, with **Accept** / **Decline** (decline requires a note >= 10 characters, the Phase 59 `ReasonDialog`); answered rows drop out with the "- logged in the decision ledger" receipt. The tab shares the Office pane, `select()`, chips and receipt slot (59 D-01/D-04). Supervisors see it (they answer requests); workers do not (their requests live on the overview, D-10). The Office pin count includes open requests the viewer can answer (59 D-05 `deriveInbox` optional input idiom).
- **D-04 -- Accepting a request does the obvious thing, nothing more.** `change_sop` accepted -> the SOP's editor opens for the answerer with a link in the receipt (no auto-fork, no auto-edit). `new_sop` accepted -> the receipt links the blank wizard pre-filled with the machine. `observe_me` accepted -> an observation record is NOT created here (Phase 61 observations); the request stays `accepted` and the asker is told who will observe. Declines just answer.
- **D-05 -- Agent-raised requests.** An agent raises through a server-side helper (`raiseRequestAsAgent(agentName, ...)`, service client, org from the caller), never through the client-reachable action; `raised_by_agent` is set and the row renders with the Phase 59 **agent** chip. First concrete producer this phase: the existing "machine with no SOP" inbox row becomes an agent-raised `new_sop` request (the Phase 54 `machines` kind retires into it). RQS-04 is proven by that producer.
- **D-06 -- Assignments become requests; the assign screen is deleted.** `/admin/sops/[sopId]/assign` is removed (proxy 307 -> the SOP's focus address). The ask lives in two places: the machine panel's admin SOP row ("Ask someone to do this") and the editor's This SOP block (same picker: role or person). `sop_assignments` survives as the materialised "due" table written only by accepted do-SOP requests and the existing self-add; `requestRemoveAssignment` / `removeAssignment` are re-pointed to withdraw/decline the request so the ledger sees every change. The Phase 54 "fix assignment" inbox row keeps working on the same table.

**Notifications (NTF-01, NTF-02)**
- **D-07 -- A new `notifications` table, read on open.** *(Simon's pick.)* Columns: `organisation_id`, `user_id`, `kind`, `title`, `place` (the `?place=` / focus address it opens -- stored as a path, never a full URL), `subject_type` + `subject_id`, `read_at`, `created_at`, optional `decision_id`. Written server-side by the same paths that write the ledger (and by the two non-ledger triggers below); never by the client. Opening a notification marks it read and navigates to `place`; the bell count = unread. Phase 9's `worker_notifications` + `useNotifications` are retired into it (data migration copies unread rows as `kind = 'sop_updated'`; table kept, not dropped, per the standing "no table dropped" constraint -- writes stop).
- **D-08 -- The five NTF-02 triggers, and where they fire:** (1) next to approve -> `approveStep` / `setApprovalChain` when the caller's step becomes current; (2) a SOP you own is due for review -> a daily sweep (the existing cron idiom from `synthesis-sweep`, header-authenticated, exempted in the proxy) that writes one notification per owner per SOP when `review_due_at` crosses into due; (3) completion waiting for your sign-off -> `submitCompletion` (walk branch) to the worker's supervisor(s); (4) request answered -> D-01's accept/decline; (5) new version of a SOP you do -> `performPublish`'s existing `notifyAssignedWorkers` (58 D-18) writes `notifications` rows instead of `worker_notifications`. Plus from D-02: "asked to do a SOP". Each trigger is idempotent per (user, kind, subject, day).
- **D-09 -- The bell sits in the list pane header beside search**, count badge = unread (hidden at 0), click = scroll the overview to its notifications section (the overview IS the notification list -- no popover, no toast, nothing over an open SOP per the focus rule). Esc/Close rules unchanged.

**Objectives (OBJ-01..03)**
- **D-10 -- Free text, one live objective per thing, optional "by" date.** *(Simon's pick.)* Table `objectives`: `organisation_id`, `subject_type` (`site | department | machine | sop | person`), `subject_id` (null for site), `text` (<= 200 chars), `due_on` (date, optional), `set_by` (user id or agent name -- one of the two), `confirmed_by` / `confirmed_at` (null until a person confirms an agent-set one), `set_at`. One live row per (org, subject_type, subject_id) -- setting again replaces (upsert) and the previous text goes to the ledger (new kind `objective_set`; removing writes `objective_cleared`). Admin and safety_manager set/change/remove; everyone in the org reads.
- **D-11 -- Shown as quiet metadata, never content:** one line on the detail panel of the thing -- site (overview header), department (its list group / panel), machine (panel header), SOP (browse state header + This SOP block), person (People tab row) -- "Objective - <text> - by 12 Nov - set by Jane" in the Phase 57 meta style; agent-set reads "set by <agent> - unconfirmed" with a one-tap **Confirm** for admins (confirm = `confirmed_by` set + ledger row `objective_confirmed`; editing it also confirms). Never a card, never beside an open SOP's steps.
- **D-12 -- Agents read and set through the existing AI field interface.** `objective` becomes an AI-writable field in `ai-fields.ts` for each subject type (the Phase 23 `applyAiWrite` -> proposal -> `acceptProposal` path): an agent write lands as the live objective with `set_by = agent` and unconfirmed; a person's Confirm is the acceptance. Agents read every objective of the org through the agent layer (`sop-pack` / `signals` gain the objective line). No new agent endpoint.

**Site overview (SHL-03)**
- **D-13 -- Nothing selected = the site overview, counts card on top.** *(Simon's pick.)* Order for every role: the Phase 57 site counts card (unchanged) -> **Objectives** (the site objective, then department objectives as a short list) -> **Notifications** (my unread, newest first, each a row that opens its place; "Show read" link) -> **My requests** (open ones I raised with state, then the last few answered with the answer note). Sections hide when empty; the pane's empty-empty state keeps the Phase 57 summary alone. Workers see exactly this; admins additionally see an "Open requests in the Office - N" link line. Phone: CSS collapse only (57 D-21).

### Claude's Discretion
- Where "Ask someone to do this" and the raise-a-request affordances sit precisely (the machine panel row menu vs. a button under the SOP meta line) -- follow the Phase 59 one-button idiom.
- The request picker UI (role vs person) -- reuse `OwnerPicker`'s popover shape.
- Notification copy per kind (plain words, no ids), relative time formatting (reuse `src/lib/office/format.ts`).
- Daily review-due sweep schedule and the exact cron route shape (copy `synthesis-sweep`).
- Whether `requests` and `notifications` get their own React Query keys or ride `SHELL_KEY` patches (59 A-11 -- patch, never invalidate the shell).
- Data migration of existing `sop_assignments` into `accepted` do-SOP requests: only if cheap and idempotent; otherwise leave history as-is and start from now.
- Deletion mechanics for the assign screen: dropped-features entry, sweeps asserting absence of references, repoint inventory, journeys / UAT / matrix in the same commits (Phases 57-59 idiom).

### Deferred Ideas (OUT OF SCOPE)
- **Workshop "Ask for a change" surface** and worker change-request UI polish -- Phase 61 (the request kind exists from this phase).
- **Observations** created from an accepted "observe me" -- Phase 61.
- **Several objectives per thing with measurable targets** an agent can score -- backlog.
- **Email / push delivery** of notifications -- out of scope for the MVP (in-app only).
- **Supervisor "Record observation" entry point** (lost in 59) -- Phase 61.
- **Org-wide forward-jump default** (58) -- backlog.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RQS-01 | Any user can raise a request (change a SOP, write a new SOP, observe me) and see the state of the requests they raised | `requests` table + `raiseRequest` action; "My requests" in the lazy overview; a raise affordance on the worker machine panel (F-22); live RLS "own rows" |
| RQS-02 | Admin or supervisor accepts / declines in the Office; answer written to the ledger; asker told | `answerRequest` core (one-row claim `state='open'`), `request_accepted` / `request_declined` kinds (00074 widen), `request_answered` notification, Requests tab with `ReasonDialog` |
| RQS-03 | Supervisor or admin asks a role or named person to do a SOP; once accepted shows as due on machines and the Now card | `askToDoSop` service-role core writing the existing `sop_assignments` shape (F-03/F-04); `worker-signal.ts` / `useWorkerSops` stay git-diff-empty |
| RQS-04 | An AI agent can raise a request (machine with no SOPs) and it appears in the Office marked as from an agent | `raiseRequestAsAgent` plain module + daily sweep (second cron route, F-08); `raised_by_agent` + agent chip |
| NTF-01 | Notifications in the overview, bell count in the list, a notification opens the place it is about | `notifications` table, client-side RLS read + mark-read (F-14), bell prop on `ShellFrame` (F-16), `notificationPlace()` safe builders |
| NTF-02 | Notified when next to approve, owned SOP due for review, completion awaiting sign-off, request answered, new version of a SOP I do | five writers: `publish/route.ts` divert + `approveStep`, review-due sweep, `submitCompletion`, `answerRequest`, `notifyAssignedWorkers`; dedupe key (F-12) |
| OBJ-01 | Admin sets / changes / removes an objective on site, department, machine, SOP, person | `objectives` table, `setObjective` / `clearObjective` core, migration of `sops.objective` (F-01) |
| OBJ-02 | Objective shown as quiet metadata saying who set it | `ObjectiveLine` in five places (site/overview, dept panel, machine headers, SOP browse + This SOP, People row) |
| OBJ-03 | Agent reads every objective and sets one through the AI field interface; marked until a person confirms | `objective.*` field descriptors + read-only `objectives.all`, `FieldContext` / `acceptProposal` widening (F-09), confirm action + `objective_confirmed` |
| SHL-03 | Nothing selected -> site overview: objectives, my notifications, my open requests | lazy `SiteOverview` under the unchanged `SiteSummary` counts card in both shells |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Raise / withdraw a request | API / Backend (server action, service-role core) | Browser (composer UI) | Table has no authenticated write policy by design (D-01); org + actor come from the session |
| Answer a request (accept / decline) | API / Backend | Database (state claim, ledger) | One-row claim `where state='open'`; one `recordDecision()` after the write |
| Ask a role / person to do a SOP | API / Backend (new core, service role) | Database (`sop_assignments`) | Existing admin-only action + RLS cannot serve a supervisor (F-03) |
| Materialised "due" | Browser (`useWorkerSops`, unchanged) | Database | Reads `sop_assignments`; Phase 60 must not touch the derivation |
| Notification writes | API / Backend (plain `src/lib/notifications/write.ts`) | -- | Written only by the paths that decide things; never the client (D-07) |
| Notification reads, count, mark-read | Browser (supabase client under RLS) | Database | Same precedent as the old `useNotifications`; avoids server actions on the navigation path (F-14) |
| Bell | Frontend (static, tiny, in `ShellFrame` list header) | -- | Must be visible on first paint in the home bundle |
| Overview sections | Frontend (lazy module under both shells) | API (`listMyRequests`, objectives read) | `/` bundle gate has no headroom (F-15) |
| Objective write / confirm / clear | API / Backend (plain core) | Database | Person path = server action; agent path = AI-field descriptor calling the same core |
| Objective read (lines on panels) | API (one `listObjectives` read) | Browser | One query feeds overview + every meta line |
| Review-due + machine-without-SOP sweep | API route (header auth, cron) | Railway cron (ops) | Machine endpoint; fail-closed bearer secret; proxy exemption |
| Agent read of objectives | API (`/api/ai-fields/read` + descriptors; `signals.ts`) | -- | Existing interface; no new endpoint (D-12) |
| Assign-page deletion + redirect | Proxy (`legacyRedirectFor`) | Test sweeps | Server-side redirect, never a client effect (CLAUDE.md 2026-09-29) |

## Spec-versus-code findings

Each row is a place CONTEXT.md assumes something the tree does not do. Evidence is `file:line`; "Resolution" is the recommendation the planner should lock.

| # | Finding | Evidence | Resolution |
|---|---------|----------|------------|
| F-01 | **`sops.objective` already exists** (<= 500 chars, set inline in This SOP, shown as the first paragraph of BrowseDocument, copied by `forkDraft`). 58 D-20 says "Phase 60 migrates it". CONTEXT D-10 caps the new text at 200 and never mentions the migration. Live data: 2 of 97 SOPs have one, longest 31 chars `[VERIFIED: Management API]`. | `00071_focus_editor_walk.sql:79-82`; `focus-steps.ts:369-393` (`setSopObjective`); `focus-read.ts:25,80`; `BrowseDocument.tsx:63`; `versions.ts:112`; `ThisSopBlock.tsx:58-87`; `58-CONTEXT.md` D-20 | Migration `00074` inserts one `objectives` row per non-null `sops.objective` (set_by = `owner_user_id`, else the org's first admin; the 2 live rows qualify). Stop reading/writing the column (leave it, no drop); delete `setSopObjective`, repoint `loadFocusSop` / `BrowseDocument` / `ThisSopBlock`, remove `objective:` from `forkDraft`. |
| F-02 | **`worker_notifications` is not dead.** `AssessmentRequestsPanel` (mounted in the `/admin/training` bridge) reads `assessment_requested` rows via `listAssessmentRequests` and marks them with `markNotificationRead`; `requestAssessorReview` writes them. Live data is 28 unread rows of 2 users, types `completion_rejected` and `removal_request` only, oldest 2026-06-09, **zero `sop_updated`** `[VERIFIED: Management API]`. `useNotifications` has no consumer. | `observations.ts:405-500`; `AssessmentRequestsPanel.tsx:5,31`; `versioning.ts:251,273`; `useNotifications.ts` (no importer) | Retire the **five NTF-02 writers** only; leave `requestAssessorReview` / `listAssessmentRequests` / `markNotificationRead` on `worker_notifications` untouched until Phase 61 re-homes the training bridge. **Do not copy the 28 unread rows** (they would put a stale count on two bells on first deploy); start the new table empty. Delete `useNotifications.ts`. Needs Simon's nod because it departs from D-07's data-migration sentence (Open Question 1). |
| F-03 | **`assignSopToRole/User` cannot serve a supervisor and double-log.** Both call `getAdminContext()` (admin / safety_manager only) and write with the session client; the RLS write policy is admin / safety_manager only. Each also already writes an `assign` ledger row, so reusing them under D-02 yields TWO rows for one decision vs "exactly ONE". | `assignments.ts:22-33,50-77,94-120`; `00007_sop_assignments.sql` policies `workers_can_view_own_assignments`, `admins_can_manage_assignments` (`current_user_role() IN ('admin','safety_manager')`); `scripts/decision-writers.json:30-32` | New plain core `askToDoSopCore()` (service role, explicit org filter, role guard `admin|safety_manager|supervisor`) inserts the assignment and the `requests` row, then records ONE `request_accepted`. Delete `assignSopToRole`, `assignSopToUser`, `removeAssignment`, `getAssignments` and update `decision-writers.json` + `LIVE_WRITERS` in `tests/phase56/decision-writers-sweep.spec.ts:44-46` in the same commit. `assign`/`unassign` stay in `DECISION_KINDS` (269 historical rows). |
| F-04 | **A role ask is one dynamic row, so a person cannot decline it.** `assignSopToRole` writes ONE `assignment_type='role'` row; `getUserSopAssignments` matches it by `ctx.role`. "Removes the assignment" on one worker's decline would remove it for every worker in the role. Live: 2 role rows (worker), 1 manager-assigned individual row, 2 self-added `[VERIFIED]`. | `assignments.ts:344-349`; `00007_...sql` unique `(sop_id, assignment_type, role)` | **Recommendation:** role-targeted `do_sop` = one request + one role row; the **decline control is offered only on person-targeted asks**. A role ask is withdrawn by the asker or an admin (a `withdrawn` state + `unassign`-style ledger via `request_declined` by the answerer). Open Question 2. |
| F-05 | **`getOrgMembers` is admin-only** and is the only member lister (names via `userLabels`, cap 1000). A supervisor's role/person picker has nothing to read. | `assignments.ts:189-219` | Add `listAskTargets()` (admin / safety_manager / supervisor; id + label + role only) built on `userLabels`; reuse `OwnerPicker`'s popover markup. Keep `getOrgMembers` (5 other importers: `approvals.ts:45`, `governance.ts:51`, `admin/settings/page.tsx:6`, `OwnerPicker.tsx:14`, `ApprovePanel.tsx:14`). |
| F-06 | **A supervisor's Office has one tab today** and specs/evals pin it: `tabsForRole('supervisor')` is `['inbox']` (A-04); the tablist is hidden when `tabs.length <= 1`; the idle-supervisor eval asserts "no tab control". Adding `requests` gives supervisors a tab bar. | `office-tabs.ts:16-20`; `OfficePane.tsx:93`; `tests/phase59/place-tab.spec.ts:30-35`; `tests/evals/office.eval.ts:477,878` | Intended (D-03). Same-commit repoints: `office-tabs.ts`, `place-tab.spec.ts`, `capability-matrix.spec.ts`, `office-pane-structure.spec.ts`, the two office eval cases. `Place.room.tab` is `Exclude<OfficeTab,'inbox'>` so `requests` is auto-whitelisted by `parsePlace`. |
| F-07 | **The Office pin == Inbox tab count is pinned by specs and evals.** `getAdminShell` sets `inboxCount = inbox.items.length`; `InboxTab.handleDone` patches `SHELL_KEY` with `freshItems.length`; `WorkerShell` `pending = inboxItems.length`; the evals assert pin equals the Inbox list. | `shell.ts:64`; `InboxTab.tsx:129-134`; `WorkerShell.tsx:72-78`; `tests/evals/one-screen.eval.ts` (pin cases) | Add requests as a **second list** on `loadInbox()` / `getOfficeInbox()` (one query, one cache key) and compute `pin = items.length + requests.length` in one pure helper used by `getAdminShell`, `WorkerShell` and the `SHELL_KEY` patch. Leave `deriveInbox` untouched except retiring `machines` (F-08). Repoint the eval pin assertions to "inbox + requests". |
| F-08 | **Retiring the `machines` inbox kind touches pinned surfaces and needs a producer + a cron that is not in the repo.** `INBOX_CHIPS` order is pinned (`inbox-model.spec.ts:125`); `deriveInbox` machines rows are asserted by `phase54/governance-inbox.spec.ts`; `office.eval.ts:403-451` asserts a "Machines" row with a "Write a SOP" link. The only cron in the tree is `/api/agent-layer/synthesis-sweep`; the proxy exempts it by **single-path equality**, and nothing in the repo proves a Railway schedule exists (STATE.md says the route "deploys as a Railway Cron job"; the CRON_SECRET was set 2026-07-12). | `inbox.ts:18,42,66,169-183`; `middleware.ts:40-41`; `synthesis-sweep/route.ts`; `STATE.md:458,705` | New route `POST /api/cron/daily-sweep` (copy `isAuthorized` verbatim; do not extract it -- `synthesis-sweep-auth.spec.ts` greps the route source). It does BOTH jobs: review-due notifications and machine-without-SOP agent requests. Extend the proxy exemption to a two-path set and add the matching source-contract assertion. **Ops step:** schedule it on Railway (checkpoint:human-action, or the Railway API with `RAILWAY_API_TOKEN` as in 59-16). Eval calls the route with `CRON_SECRET` from the local env so the producer is proven without waiting for a schedule. |
| F-09 | **The AI field interface does not model machine / department subjects and has no agent principal.** `FieldContextSchema` has only `sopId, sectionId, stepId, memberId`; `acceptProposal` rebuilds the context from exactly those four keys (`ai-fields.ts:192-199`); `isHighStakeContext` sends any context carrying a published `sopId` to a pending proposal, which on accept runs as the ADMIN (so `set_by` would be the admin, not the agent); the only agent allowlist entry is `SOPstart assistant`; there is no agent login -- an agent is the session user plus `agentName` (the ledger stores `invoked_by`). `applyAiWrite` already records an `ai_field_write` row for any applied write. | `validators/ai-fields.ts:43-55`; `ai-fields.ts:62-79,99-110,192-199`; `shape.ts:20,73-78` | (a) Add `subjectId` (uuid, optional) and `agentName` to `FieldContext` and to the `acceptProposal` rebuild; do NOT pass the SOP id as `sopId` for `objective.sop` (keep it in `subjectId`) so the published-SOP gate does not divert it. (b) Register `objective.site|department|machine|sop|person` (`stakeLevel: 'low'`, `write` calls the plain core with `setBy = agent`, which re-checks the session role is admin / safety_manager and the subject belongs to `ctx.organisationId`) and a read-only `objectives.all`. (c) The agent path relies on `applyAiWrite`'s `ai_field_write` row; the core writes `objective_set` only for the person path, so one change = one row. (d) Change `applyAiWrite`'s subject to `context.subjectId ?? sectionId ?? sopId`. |
| F-10 | **`packSopForPrompt` is byte-pinned and its output becomes the embedding text.** Adding an objective line changes the Anthropic prompt-cache key and pollutes `embedSop(fullText)`. | `sop-pack.ts:1-12`; `synthesis.ts:294`; `tests/phase55/sop-pack.spec.ts` | Do NOT touch `packSopForPrompt`. Give agents objectives through (1) the `objectives.all` / `objective.*` read descriptors on `/api/ai-fields/read`, and (2) a fifth `readObjectiveSignals()` in `signals.ts` (independent try/catch, same style) if the synthesis run should see them. |
| F-11 | **The "fix assignment" inbox row is a department-reference row, not an assignment row.** `stale_role` means dangling / renamed department refs; its button (`InboxRow.tsx:213-217`) links to the assign page, which never edited departments (it holds role toggles, `SubTradePicker`, per-person toggles). The page is also the ONLY place `SubTradePicker mode="sop"` mounts. Live `sops_sub_trades` rows: 0 `[VERIFIED]`; D-A10 in `one-screen-site.md` already cuts sub-trade placement. | `InboxRow.tsx:213-217`; `assign/page.tsx:260-275`; `classify.ts:41`; `sub-trades.ts:7`; `one-screen-site.md:131` | Repoint the `fix` branch to `focusHref(id, { mode: 'edit', from: 'office' })` and rename the button (no "assignment" in copy, per CONTEXT specifics -- e.g. "Open SOP"). Record "SOP sub-trade tagging UI retired (0 live rows)" in the dropped-features list; leave `SubTradePicker`, `sub-trades.ts` and the RLS untouched. Repoint `tests/e2e/sub-trade-assignment.spec.ts` (its "assign page integration" block). |
| F-12 | **"Idempotent per (user, kind, subject, day)" would re-notify an overdue owner every day** if the sweep runs daily. | D-08 text | Use a `dedupe_key text` with `unique (user_id, dedupe_key)` and `insert ... on conflict do nothing`. Keys: `review_due:<sopId>:<review_due_at date>` (fires once per due date; marking reviewed moves the date, so the next cycle re-arms), `approve_next:<sopId>:<version>:<stepIndex>`, `signoff:<completionId>`, `request_answered:<requestId>`, `asked:<requestId>`, `new_version:<newSopId>`. |
| F-13 | **`setApprovalChain` does not make anyone's step current.** A chain becomes active when the publish route diverts a draft to `approval_state='pending'` (step 0 current); later steps become current in `approveStep`. `scripts/verify-gate-check.tsx` loads that route with a `Module._load` collaborator list; any new server-only import reachable from the route crashes the harness (CLAUDE.md 2026-10-04). | `publish/route.ts:75`; `approvals.ts:169-250`; `verify-gate-check.tsx:97-118` | Hook (a) step 0 at the pending divert in `publish/route.ts`, (b) step `i+1` after a non-final approval in `approveStep`. Add `request.includes('lib/notifications')` to the harness stub list in the same commit; run `phase26` (`verify-gate`) with the plan. Chain steps name only admin / safety_manager (59 A-02), so recipients are role members or the named user, minus the actor. |
| F-14 | **Next 16.2.1 server-action queue orphan.** A tap that navigates while another server action is in flight can orphan the next action and freeze the router (CLAUDE.md 2026-09-29). A notification row opens a place -- often a real navigation to `/sops/<id>`. | `CLAUDE.md` Learnings 2026-09-29; `ShellFrame.tsx` (no router by spec) | Notification list, unread count and mark-read use the **browser Supabase client under RLS** (not server actions). `?place=` addresses open via `select()`; `/sops/...` addresses via `<Link>` / `router.push` (in the lazy overview module, not `ShellFrame`) after an awaited client `update`. No `refetchInterval` server-action polling; use `refetchOnWindowFocus` + a modest `staleTime`. |
| F-15 | **Both home bundles are at their limit.** Baseline `/page` 834 KB, recorded `/` = 833 after 59 review; `/sops/[sopId]/page` baseline 792, last read 794 (+2 = the tolerance edge). 59-12 lost +1.97 KB to a lazy CSS import in the module graph. The WorkerShell chunk is lazy and **excluded from the manifest figure**, so the risk is shared-runtime / chunk-graph churn, not the size of the new components. | `.bundle-baseline.json`; `59-12-SUMMARY.md`; `59-16-SUMMARY.md`; `check-bundle-size.ts:78-110` | Overview, composer, ask picker, objective editor = `next/dynamic({ ssr: false })` modules, no CSS imports, added to `/page` forbidden markers. Static additions limited to: bell (icon + count), `ObjectiveLine` (pure text), one tiny "Ask" button per worker SOP row. Run `npm run build` in every shell-touching plan. Never recapture the baseline (CLAUDE.md 2026-09-13). |
| F-16 | **`ShellFrame.tsx` is source-pinned**: no `router.`, no `next/navigation`, no `<header|<nav`, exactly one `setPlace(` and one `replaceState`, literal `lg:w-100`, `lg:w-64`. | `tests/phase57/shell-structure.spec.ts:47-111` | The bell is a prop slot (`bell?: ReactNode`) rendered next to the search `<label>` (`ShellFrame.tsx:175`); its click calls `select(OVERVIEW)` then scrolls (`scrollIntoView`) -- no navigation. The department objective line is a `deptMeta?(id)` slot. |
| F-17 | **Fork census.** `tests/phase58/fork-draft.spec.ts` fails if any table with an FK to `public.sops(id)` is neither copied nor on its `NOT_COPIED` allow-list. | `fork-draft.spec.ts:134-175` | Give the new tables **no FK to `sops`** (polymorphic `subject_id uuid`); clean up in `deleteSop` instead. If a FK is wanted later, add the disposition in the same commit. |
| F-18 | **`deleteSop` clears assignments and `worker_notifications` by hand.** | `sops.ts:382-384`; `tests/phase33/delete-sop-org-scope.spec.ts:98` | Add org-scoped deletes for `notifications` (`subject_type='sop'`), `requests` and `objectives` keyed on the SOP's lineage, in the same function; extend the spec. |
| F-19 | **Worker placeholders to replace.** `OfficeWorkerBody`: "Your requests will show here in a later update."; `WorkshopWorkerBody`: "Asking for a change ... arrives with requests in a later update." | `RoomBodies.tsx:29-40,73-80` | Office worker body -> point at "My requests" on the overview. The Workshop sentence stays until 61 (the surface is deferred). |
| F-20 | **`notifyAssignedWorkers` repoints assignments to the new version id**, so a `do_sop` request's `subject_id` (the version asked about) goes stale; a person's decline must find the assignment by lineage. | `versioning.ts:262-264`; `lineage-current.ts:25` (`lineageRoot`) | On decline, delete from `sop_assignments` where `sop_id in (select id from sops where id = :root or parent_sop_id = :root)` and the same target + `assigned_by = asker`. |
| F-21 | **Existing self-add rows collide with an ask.** `unique (sop_id, assignment_type, user_id)`; `isSelfAssigned = assigned_by === user.id` decides the removal path. | `00007_...sql`; `useWorkerSops.ts` `toRow` | On `23505` from an ask, `update ... set assigned_by = <asker>` on the existing row (it becomes manager-assigned) rather than failing. |
| F-22 | **RQS-01 needs a worker raise surface in Phase 60.** CONTEXT defers the Workshop "Ask for a change" screen to 61 but success criterion 2 is "any user raises a request and sees its state". The only per-SOP worker surface on the one screen is `MachineBody` / `SopRows` (home bundle). | `MachinePanel.tsx:27-57`; `RoomBodies.tsx:73-80` | One lazy `RequestComposer` (kind chooser + note, <= 500 chars) opened from: a small "Ask" action on each worker SOP row (`change_sop`, `observe_me`) and "Ask for a new SOP here" under the machine name (`new_sop`). Workshop surface (61) later reuses the same composer. Supervisors' "Ask someone to do this" opens the same lazy module with the picker (F-05). |
| F-23 | **Accepting `change_sop` links to the editor, which a supervisor cannot edit.** `requireSopEditAccess` is admin / safety_manager (or chain approver). | `guards.ts:71`; `CAPABILITY-MATRIX.md` "Edit SOP content" | Receipt link: editor address for admin / safety_manager; browse address (`focusHref(id)`) for a supervisor. |

## Standard Stack

### Core (all already in the repo -- no new packages)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.2.1 `[VERIFIED: CLAUDE.md learning 2026-09-29]` | App Router, server actions, route handlers, proxy | Project stack; note the 16.2.1 action-queue orphan bug (F-14) |
| `@supabase/supabase-js` + `@supabase/ssr` | existing | Session client (RLS reads), admin client (service role) | `createClient()` browser/server, `createAdminClient()` |
| `@tanstack/react-query` | existing | Query keys for requests / objectives / notifications | `SHELL_KEY` patch idiom (59 A-11) |
| `zod` | existing | `.strict()` action inputs (no org / user / agent fields) | CLAUDE.md 2026-09-30 |
| `lucide-react` | existing | Bell icon | Already imported by the shell |
| `@playwright/test` | 1.58.2 `[VERIFIED: 59-VALIDATION.md]` | Source-contract specs, evals | Project test runner |

### Supporting (internal modules to reuse -- Don't Hand-Roll)
| Module | Purpose | Use here |
|--------|---------|----------|
| `src/lib/decisions/record.ts` `recordDecision()` | the only ledger writer | accept / decline / objective set / clear / confirm |
| `src/lib/decisions/shape.ts` + `read.ts` | `DECISION_KINDS`, `AGENT_NAMES`, `KIND_GROUPS`, `KIND_WORDS` | widen with five kinds; `DEFAULT_AGENT_NAME` for the sweep |
| `src/components/office/ReasonDialog.tsx` | focused >= 10-char reason dialog | decline (Office) and the worker's decline of an ask |
| `src/lib/office/format.ts` | NZ-pinned relative time / day | notification + request times, "by 12 Nov" |
| `src/components/admin/governance/OwnerPicker.tsx` | popover markup + Esc handling | role / person ask picker |
| `src/lib/members/labels.ts` `userLabels` / `memberLabel` | the one place a person gets a name | request "who", objective "set by" |
| `src/lib/sop/focus-path.ts` `focusHref`, `src/lib/shell/place.ts` `formatPlace` | address builders | every stored notification `place` |
| `src/lib/sop/lineage-current.ts` `lineageRoot` | flat lineage | SOP objective subject, ask decline lookup |
| `scripts/apply-phase59-migration.mjs` | applier shape (db push -> Management API fallback -> assertions -> `NOTIFY pgrst`) | `apply-phase60-migration.mjs` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Browser-client notification reads | a `listNotifications` server action | Server action would put a mount-time action in the navigation path (F-14) and add bundle; client read is the precedent (`useNotifications`) |
| Requests inside `deriveInbox` as `kind:'request'` items (D-03's literal idiom) | Second list + pin helper (recommended) | Putting them in `items` forces the Inbox tab, chip counts, the empty state and the `SHELL_KEY` patch to special-case them; a second list keeps Inbox semantics and still gives one pin (F-07). Either honours "optional input" |
| `unique nulls not distinct` + `upsert` for the site objective | core does select -> update / insert, retry once on `23505` | PG 17.6 supports NULLS NOT DISTINCT, but PostgREST `onConflict` inference with it is unverified `[ASSUMED]`; the explicit path needs no assumption (the unique index is the race backstop) |
| Per-day dedupe | per-event `dedupe_key` | Day-keyed would spam an overdue owner daily (F-12) |

**Installation:** none. **Version verification:** not applicable (no package added).

## Package Legitimacy Audit

No external package is installed or recommended by this phase. `slopcheck` was not run because there is nothing to check.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| (none) | -- | -- | -- | -- | -- | -- |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
 Worker / Supervisor / Admin (browser, one screen at "/")
   |
   |-- ShellFrame list header: [search] [Bell n]  --click--> select(OVERVIEW) + scrollIntoView(notifications)
   |        bell count <-- supabase client (RLS): notifications where read_at is null
   |
   |-- Detail pane, nothing selected:
   |        SiteSummary (counts card, unchanged)
   |        + lazy SiteOverview: Objectives | Notifications | My requests (+ admin "Open requests in the Office - N")
   |              |- notification row --markRead (supabase client)--> select(place) or Link(/sops/..)
   |              `- request row: worker decline-with-note (ReasonDialog) for person-targeted asks
   |
   |-- Machine panel / SOP rows: [Ask] --> lazy RequestComposer ---> raiseRequest (server action)
   |-- Machine panel admin/supervisor row: "Ask someone to do this" --> lazy AskPicker --> askToDoSop (server action)
   |-- Office room > Requests tab (admin, safety_manager, supervisor): RequestRow Accept / Decline(ReasonDialog)
   |
   v
 server actions (thin, 'use server', async-only, zod .strict, org+actor from session)
   raiseRequest | withdrawRequest | answerRequest | askToDoSop | declineAsk | listMyRequests | listAskTargets
   setObjective | clearObjective | confirmObjective | listObjectives
   |
   v
 plain server-only cores (service role, explicit org filter on EVERY query)
   src/lib/requests/core.ts      insert / claim(open->accepted|declined) / materialise sop_assignments / raiseRequestAsAgent
   src/lib/objectives/core.ts    select -> update|insert (retry 23505) ; previous text returned for the ledger
   src/lib/notifications/write.ts  notify({...}) insert ... on conflict (user_id, dedupe_key) do nothing
   |        |                    |
   |        |                    +--> notifications   (RLS: select own; update(read_at) own)
   |        +--> recordDecision() --> decisions (append-only; request_accepted/declined, objective_set/cleared/confirmed)
   +--> requests / objectives / sop_assignments (service role writes only)

 Notification writers (all call write.ts, after the primary write, fail-soft)
   publish/route.ts divert + approveStep ........ approve_next
   cron: POST /api/cron/daily-sweep (Bearer CRON_SECRET, proxy-exempt)
        |- owned published SOPs, review_due_at <= now + 30d ........ review_due   (dedupe by due date)
        `- machines with no SOP link, no open/recent new_sop ....... raiseRequestAsAgent('SOPstart assistant', new_sop)
   submitCompletion (after recordSignature) ...... signoff (assigned supervisors + admins/safety managers)
   answerRequest / askToDoSop / declineAsk ....... request_answered / asked
   notifyAssignedWorkers (publish-core, lineage) . new_version

 Agents: POST /api/ai-fields/write { fieldId:'objective.machine', context:{subjectId}, agentName }
         --> applyAiWrite --> gateWrite(low) --> descriptor.write --> objectives core (set_by_agent, unconfirmed)
         --> one ledger row (ai_field_write).   GET /api/ai-fields/read?fieldId=objectives.all
```

### Recommended Project Structure
```
supabase/migrations/00074_requests_notifications_objectives.sql
scripts/apply-phase60-migration.mjs
src/lib/requests/{model.ts (plain), core.ts (server-only), agent.ts (server-only)}
src/lib/notifications/{kinds.ts, places.ts (plain), write.ts (server-only), review-due.ts (server-only)}
src/lib/objectives/{model.ts (plain), core.ts (server-only)}
src/lib/ai-fields/registrations/objectives.ts   (imported by the barrel)
src/actions/{requests.ts, objectives.ts}          ('use server', async exports only)
src/app/api/cron/daily-sweep/route.ts
src/components/office/{RequestsTab.tsx, RequestRow.tsx}
src/components/shell/{NotificationBell.tsx (static, tiny), SiteOverview.tsx (lazy), ObjectiveLine.tsx (static, text only)}
src/components/requests/{RequestComposer.tsx, AskPicker.tsx, ObjectiveEditor.tsx}   (all lazy)
tests/phase60/**   tests/evals/requests.eval.ts
```

### Pattern 1: Service-role core + thin action (CLAUDE.md 2026-06-15, 2026-10-04)
**What:** privileged reads/writes live in plain `src/lib/**` modules that import `'server-only'`; the `'use server'` file only parses input (zod `.strict()`, no `organisationId` / `userId` / `agent` field), calls `getSessionContext()` and delegates.
**When:** every write to `requests`, `objectives`, `notifications`, `sop_assignments`.
**Example:**
```typescript
// src/lib/requests/core.ts  (sketch; mirrors record.ts + guards idiom)
import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

export async function claimOpenRequest(orgId: string, id: string, patch: {
  state: 'accepted' | 'declined'; answered_by: string; answer_note: string | null
}) {
  const { data, error } = await createAdminClient()
    .from('requests')
    .update({ ...patch, decided_at: new Date().toISOString() })
    .eq('id', id)
    .eq('organisation_id', orgId)   // never a value read off a fetched row (CLAUDE.md 2026-07-28)
    .eq('state', 'open')            // the claim: a second click updates zero rows
    .select('id, kind, subject_type, subject_id, raised_by_user, target_role, target_user_id, note')
  if (error) throw error
  return data?.[0] ?? null          // null => "already answered" before any ledger row or notification
}
```
Source: `signOffCompletion` claim pattern, 59 review WR-01 (`59-REVIEW-FIX.md`).

### Pattern 2: One decision, one ledger row, written AFTER the primary write
`answerRequest`: claim -> (accept `do_sop` only: n/a, asks are auto-accepted) -> `recordDecision({ kind: 'request_accepted' | 'request_declined', subject: { kind: 'request', id }, sopId, summary: <literal words only>, details: { request_kind, note, answer_note } })` -> notify asker -> return `{ logged }` so the receipt says "logged in the decision ledger" only when `logged === true` (`OfficePane.receiptWords`). Free text (notes) goes in `details`, never `summary` (`shape.ts:28`; summary is 1-200 chars from literals).

### Pattern 3: Notification write with a dedupe key
```typescript
// src/lib/notifications/write.ts (server-only)
await createAdminClient().from('notifications').upsert(
  rows.map((r) => ({ ...r, organisation_id: orgId })),
  { onConflict: 'user_id,dedupe_key', ignoreDuplicates: true },
)
```
`place` comes from `src/lib/notifications/places.ts` builders (`focusHref`, `formatPlace`), never from user text; the table also CHECKs `place like '/%' and place not like '//%'` (defence in depth against an off-site redirect).

### Pattern 4: Lazy seam with a forbidden marker (59 A-11, 58-13)
`SiteOverview`, `RequestComposer`, `AskPicker`, `ObjectiveEditor` are reached only through `next/dynamic(..., { ssr: false })` from `WorkerShell` / `AdminShell` (or from inside an already-lazy chunk). Add one literal from each to the `/page` `forbiddenMarkers` in `scripts/check-bundle-size.ts` (marker self-validation then proves the literal exists somewhere in the build). Do not import a stylesheet from any of them (59-12 lesson).

### Pattern 5: Objective line = metadata, tokens only
`ObjectiveLine` renders `mono text-meta text-ink-500` (the `OwnerReviewMeta` idiom): `Objective · <text> · by 12 Nov · set by Jane`; agent-set: `set by SOPstart assistant · unconfirmed` plus the `bg-ai/10 text-ai border border-ai/40` agent chip (copy the `DecisionsTab.tsx:44` classes). Tokens only (`tests/lint/design-tokens.spec.ts`); the edit / confirm controls live in the lazy `ObjectiveEditor` and mount only when the viewer is admin / safety_manager (a UX convenience -- the action is the gate).

### Anti-Patterns to Avoid
- **Calling `assignSopToRole/User` from the ask path** -- admin-only and double-logs (F-03).
- **A client-reachable `raiseRequestAsAgent`** -- `'use server'` exports are POST-reachable (CLAUDE.md 2026-09-30); keep it in a plain module that the cron route and a future agent route import.
- **A write policy "because the action is trusted"** -- all three tables follow the `decisions` pattern: SELECT policies only.
- **Reading an org id off a fetched row to scope a write** -- use the session org (CLAUDE.md 2026-07-28).
- **Patching the shell with `invalidateQueries(SHELL_KEY)`** -- re-signs the scene image (59 F-02); use `setQueryData`.
- **Quoting a forbidden literal in a comment** (`security definer`, `ssr: false`, `router.`) -- the grep guards read comments (CLAUDE.md 2026-09-28).
- **A toast or popover for notifications** -- nothing over an open SOP (D-09, `one-screen-site.md` "What to avoid").

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Audit trail of accept / decline / objective changes | a new log table | `recordDecision()` + five new kinds | Append-only triggers, DEC-04 agent naming, the Decisions tab already renders it |
| Org / actor derivation | client-passed ids | `getSessionContext()` / `requireAdminContext()` | CLAUDE.md 2026-06-15, 2026-09-30 |
| Cron authentication | a new scheme | copy `isAuthorized` from `synthesis-sweep` (timing-safe, fails closed) | Pinned by an auth spec; scheme is proven |
| "Due" for workers | a new due calc | the existing `sop_assignments` shape read by `useWorkerSops` / `worker-signal.ts` | D-02 explicitly keeps it unchanged |
| Reason capture | a new modal | `ReasonDialog` (>= 10 chars, Esc closes only itself) | Esc/z-layer rules already solved (A-12) |
| Names for people | joins on `auth.users` in the client | `userLabels()` server-side | The one place a person gets a name (59 A-07) |
| Safe navigation targets | string-concatenated URLs | `focusHref` / `formatPlace` + table CHECK | Whitelist already tested (T-57-01, T-58-from) |
| Relative / NZ time | `toLocaleString()` | `src/lib/office/format.ts` | Server and client render the same text (no React #418) |
| Sweep org iteration | per-org cron | one route, loop orgs, caps like `MAX_SOPS_PER_SWEEP` | Cron is a one-shot process; keep it short |

**Key insight:** every hard part of this phase (ledger, claim-guard, registry sweep, lazy seam, deletion guards) has a 56-59 precedent. The risk is not inventing -- it is the pinned tests and the two tight bundle gates that a naive wiring trips.

## Runtime State Inventory

> Phase 60 deletes a screen and retires a notification writer set, so this section applies.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `worker_notifications`: 28 unread rows, 2 users, types `completion_rejected` / `removal_request`, oldest 2026-06-09 `[VERIFIED]`. `sop_assignments`: 5 rows (2 role-worker, 1 manager-assigned individual, 2 self-added) `[VERIFIED]`. `sops.objective`: 2 rows, max 31 chars `[VERIFIED]`. `sops_sub_trades`: 0 rows `[VERIFIED]`. Ledger: 269 rows incl. backfilled `assign` rows. | Code edit: stop the five writers. Data migration (idempotent, in `00074`): objective rows from `sops.objective`. **No** copy of `worker_notifications`; **no** backfill of assignments into requests (ledger already holds their `assign` rows). Table kept. |
| Live service config | A Railway cron schedule for `synthesis-sweep` is claimed in STATE.md but not verifiable from the repo; `CRON_SECRET` exists locally and on Railway (set 2026-07-12). No schedule exists for the new route. | Ops: create the Railway cron for `POST /api/cron/daily-sweep` (human action or Railway API). Verify the existing sweep's schedule at the same time. |
| OS-registered state | None -- verified: nothing on this machine schedules the sweep; production runs on Railway. | None |
| Secrets / env vars | `CRON_SECRET` reused (no new key). | None |
| Build artifacts / installed packages | `.next` caches compiled `assign/page.js`; `src/types/database.types.ts` is a generated file that does not know the new tables. | Regenerate or hand-add the three table types (precedent: other phases used `as any` casts on new tables -- prefer regenerating); delete the route directory, rebuild. |

**Nothing found in category "OS-registered state":** verified by search of the repo and the Windows task scheduler is not used by this project.

## Common Pitfalls

### Pitfall 1: A second ledger row for one decision
**What goes wrong:** an ask reuses `assignSopToRole` (writes `assign`) and then writes `request_accepted`; an agent objective write logs `ai_field_write` and `objective_set`.
**Why:** the sweep keys writers by file#function and every legacy writer already logs.
**How to avoid:** new cores do not log; the calling action logs exactly once. Update `scripts/decision-writers.json` (`tables` += `requests`, `objectives`; entries for `answerRequest`, `askToDoSop`, `declineAsk`, `setObjective`, `clearObjective`, `confirmObjective`; `allow` entries with reasons for `raiseRequest` / `raiseRequestAsAgent` ("raising is a request, not a decision") and for the new core's `sop_assignments` insert if it sits in a different function than the logging call) and `LIVE_WRITERS` in the same commits.
**Warning signs:** `decision-writers-sweep` discovery set differs from JSON; the Decisions tab shows two rows for one click.

### Pitfall 2: Pin equality breaks silently
**What goes wrong:** the Office pin counts requests but the Inbox tab, `SHELL_KEY` patch, supervisor card or an eval still compare to `items.length`.
**How to avoid:** one pure `officePinCount(items, requests)`; used in `getAdminShell`, `WorkerShell`, `InboxTab.handleDone`, `RequestsTab.handleDone`. Add a spec asserting all four call it; repoint the eval assertions.

### Pitfall 3: The eval-site org is shared
**What goes wrong:** the sweep raises an agent `new_sop` request for the fixture machine "EVAL Oven" (zero SOPs, added by the governance eval) and a later eval's "pin equals Inbox" assertion drifts (CLAUDE.md 2026-09-29).
**How to avoid:** assert by name, not count; the requests eval creates and answers its own rows and deletes leftovers with the service key at the end; the agent-request case runs the sweep itself and declines the row.

### Pitfall 4: Notification tap + server action = frozen router
See F-14. Reads and mark-read go through the browser client; never `router.replace` from a mount effect; no action polling.

### Pitfall 5: `acceptProposal` silently drops new context keys
It rebuilds `fieldContext` from four named keys (`ai-fields.ts:192-199`). Any new `FieldContext` key (`subjectId`, `agentName`) must be added there too, or an accepted proposal writes with an undefined subject. (Objective fields are `low` stake and never become proposals, but a high-stake field added later would hit this.)

### Pitfall 6: The new writer imports break the gate harness
`publish/route.ts` is executed by `scripts/verify-gate-check.tsx`; a `server-only` module reachable from it is unloadable under tsx (CLAUDE.md 2026-10-04). Stub `lib/notifications` in the harness list; run `--project=phase26` with the plan.

### Pitfall 7: A guard spec that bans an import is telling you where the read belongs
`createAdminClient` is banned in several `src/actions/*` files by CR-01-style specs (e.g. `sop-section-blocks`). Keep service-role reads in the plain cores; do not edit the guards.

### Pitfall 8: Stale `['user-sop-assignments']` hides a fresh ask
`useWorkerSops` caches assignments 5 minutes. A worker who is asked to do a SOP and opens the notification sees the SOP but the Now card / badge can lag. When the notification hook sees a new unread `asked` row, call `queryClient.invalidateQueries({ queryKey: ['user-sop-assignments'] })` (CLAUDE.md 2026-09-29 stale-local-cache class). After a decline, remove / invalidate the same key.

### Pitfall 9: Subject orphaning
No FKs on polymorphic `subject_id`. A deleted machine / department / member leaves objective and request rows that nothing displays. Objectives and requests for a deleted SOP are removed in `deleteSop` (F-18); machines / departments / members: the readers filter on existing subjects, no cleanup needed for correctness (note in the SUMMARY).

### Pitfall 10: Supabase email rate limit is not in play, but OTP budget is
Phase 60 sends no email. Each eval case that mints a session spends OTP budget (59 shared limit); the live RLS probe and the eval run once each (CLAUDE.md 2026-09-28).

### Pitfall 11: Quoted literals in comments trip lint guards
Describe patterns in words in new `src/` comments and in the new specs' header comments (CLAUDE.md 2026-09-28).

## Code Examples

### Migration skeleton (`00074_requests_notifications_objectives.sql`)
```sql
-- Widen the ledger kind check (all 18 existing + 5 new). Idempotent.
alter table public.decisions drop constraint if exists decisions_kind_check;
alter table public.decisions add constraint decisions_kind_check check (kind in (
  'approve','reject','sign_off','countersign','assign','unassign','publish',
  'owner_change','review','observation','verify','verify_withdrawn',
  'ai_finding_cleared','cadence_change','ai_field_write',
  'role_change','member_invited','member_removed',
  'request_accepted','request_declined','objective_set','objective_cleared','objective_confirmed'
));

create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  kind text not null check (kind in ('change_sop','new_sop','observe_me','do_sop')),
  state text not null default 'open' check (state in ('open','accepted','declined','withdrawn')),
  raised_by_user uuid references auth.users(id) on delete cascade,
  raised_by_agent text,
  subject_type text not null check (subject_type in ('sop','machine','site')),
  subject_id uuid,                                   -- polymorphic, no FK (F-17)
  target_role text check (target_role in ('worker','supervisor','admin','safety_manager')),
  target_user_id uuid,
  note text check (note is null or char_length(note) <= 500),
  answered_by uuid,
  answer_note text check (answer_note is null or char_length(answer_note) <= 500),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  constraint requests_one_raiser check ((raised_by_user is null) <> (raised_by_agent is null)),
  constraint requests_agent_named check (raised_by_agent is null or btrim(raised_by_agent) <> ''),
  constraint requests_target_shape check (
    (kind = 'do_sop' and ((target_role is null) <> (target_user_id is null)))
    or (kind <> 'do_sop' and target_role is null and target_user_id is null)),
  constraint requests_answered_shape check ((state in ('accepted','declined')) = (decided_at is not null) or state = 'withdrawn')
);
-- an agent never has two open new_sop asks for the same machine
create unique index if not exists requests_one_open_agent_new_sop
  on public.requests (organisation_id, subject_id)
  where kind = 'new_sop' and state = 'open' and raised_by_agent is not null;
create index if not exists requests_org_state_idx on public.requests (organisation_id, state, created_at desc);
create index if not exists requests_raiser_idx on public.requests (raised_by_user, created_at desc);
alter table public.requests enable row level security;

-- SELECT only: own raised, own target, own answered, or (admin|safety_manager|supervisor) the org's open ones.
drop policy if exists "requests_read" on public.requests;
create policy "requests_read" on public.requests for select to authenticated
using (
  organisation_id = public.current_organisation_id()
  and (
    raised_by_user = auth.uid() or target_user_id = auth.uid() or answered_by = auth.uid()
    or (target_role is not null and target_role = public.current_user_role())
    or (state = 'open' and public.current_user_role() in ('admin','safety_manager','supervisor'))
  )
);
-- no INSERT / UPDATE / DELETE policy of any kind (writes: service role only)

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  title text not null check (char_length(title) between 1 and 200),
  place text not null check (place like '/%' and place not like '//%' and char_length(place) <= 300),
  subject_type text not null,
  subject_id uuid not null,
  decision_id uuid,
  dedupe_key text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);
create index if not exists notifications_unread_idx on public.notifications (user_id, created_at desc) where read_at is null;
alter table public.notifications enable row level security;
drop policy if exists "notifications_read_own" on public.notifications;
create policy "notifications_read_own" on public.notifications for select to authenticated
  using (user_id = auth.uid() and organisation_id = public.current_organisation_id());
drop policy if exists "notifications_mark_own_read" on public.notifications;
create policy "notifications_mark_own_read" on public.notifications for update to authenticated
  using (user_id = auth.uid() and organisation_id = public.current_organisation_id())
  with check (user_id = auth.uid() and organisation_id = public.current_organisation_id());
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;   -- title / place can never be rewritten

create table if not exists public.objectives (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  subject_type text not null check (subject_type in ('site','department','machine','sop','person')),
  subject_id uuid,
  text text not null check (char_length(btrim(text)) between 1 and 200),
  due_on date,
  set_by_user uuid references auth.users(id) on delete set null,
  set_by_agent text,
  set_at timestamptz not null default now(),
  confirmed_by uuid,
  confirmed_at timestamptz,
  constraint objectives_one_setter check ((set_by_user is null) <> (set_by_agent is null)),   -- set null on user delete would violate: use cascade instead (see note)
  constraint objectives_site_no_subject check ((subject_type = 'site') = (subject_id is null)),
  constraint objectives_confirm_pair check ((confirmed_by is null) = (confirmed_at is null)),
  unique nulls not distinct (organisation_id, subject_type, subject_id)
);
alter table public.objectives enable row level security;
drop policy if exists "objectives_read_org" on public.objectives;
create policy "objectives_read_org" on public.objectives for select to authenticated
  using (organisation_id = public.current_organisation_id());
-- data: one row per non-null sops.objective (idempotent via the unique key); no worker_notifications copy.
```
Notes for the planner: (1) `set_by_user ... on delete set null` conflicts with `objectives_one_setter` when a user is deleted -- use `on delete cascade` or drop the FK and keep a plain uuid (decide in the plan; the `requests.raised_by_user` FK has the same shape). (2) `tests/lint/rls-org-scope.spec.ts` parses every policy on tables carrying `organisation_id`: each arm above conjoins `organisation_id = current_organisation_id()` and each `WITH CHECK` restates its `USING`. (3) No SECURITY DEFINER function is introduced. (4) The migration applier (`apply-phase60-migration.mjs`) must list `00074` in `MIGRATION_FILES` and assert: the 23 kinds in the constraint, exactly the policy set above (no non-SELECT policy on `requests` / `objectives`; one SELECT + one UPDATE on `notifications`), `has_column_privilege('authenticated','public.notifications','title','UPDATE') = false`, and that `sops.objective` rows equal objective rows by count. Check `npx supabase migration list` before `db push` (stale-history lesson, CLAUDE.md 2026-10-04).

### Person ask (core outline)
```typescript
// src/lib/requests/core.ts (server-only) -- one request, one assignment row, one ledger row (by the caller)
export async function askToDoSopCore(ctx: { orgId: string; askerId: string },
  input: { sopId: string; target: { role: AppRole } | { userId: string }; note: string | null }) {
  const db = createAdminClient()
  // 1. the SOP and (for a person) the target belong to ctx.orgId -- explicit .eq('organisation_id', ctx.orgId)
  // 2. insert requests row as 'accepted' (answered_by = asker, decided_at = now)
  // 3. insert sop_assignments { organisation_id, sop_id, assignment_type: 'role'|'individual', role|user_id, assigned_by: asker }
  //      on 23505: update that row's assigned_by = asker (F-21)
  // 4. return { requestId, recipients: user ids }   -- caller records request_accepted, then notifies each recipient
}
```

### Agent producer (sweep)
```typescript
// src/lib/requests/agent.ts (server-only; imported by the cron route; NOT a 'use server' file)
export async function raiseRequestAsAgent(a: { organisationId: string; agent: AgentName; kind: 'new_sop'; subject: { type: 'machine'; id: string }; note: string }) {
  // insert with raised_by_agent = a.agent; the partial unique index makes a repeat sweep a no-op (23505 => skipped)
  // also skip when a new_sop request for that machine was answered in the last 30 days (a declined ask must not return daily)
}
```

### Proxy exemption + redirect
```typescript
// middleware.ts: replace the single-path equality with a set; keep the source-contract spec pointing at the literals
const CRON_PATHS = ['/api/agent-layer/synthesis-sweep', '/api/cron/daily-sweep']
const isCronRoute = CRON_PATHS.includes(path)
// focus-path.ts legacyRedirectFor: extend the admin regex with the assign address ->
//   /^\/admin\/sops\/(?:builder\/([^/]+)|([^/]+)\/(?:versions|assign))$/  (flip tests/phase58/legacy-redirects.spec.ts:61 from null)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Assign by an admin screen writing `sop_assignments` + `assign` ledger row | Ask -> request (auto-accepted for a manager) -> assignment row materialised; one `request_accepted` row | Phase 60 | `assign` / `unassign` stay as historical kinds |
| `worker_notifications` + polled hook (no UI) | `notifications` + bell + overview rows, read via RLS client | Phase 60 | assessment requests stay on the old table until 61 |
| `sops.objective` free text on the SOP row | `objectives` rows on five subject types, confirm flow for agents | Phase 60 (58 D-20) | one SOP-level statement; keyed on the lineage root |
| "Machines" inbox kind (Phase 54) | agent-raised `new_sop` request in the Requests tab | Phase 60 | `machines` chip retired |
| Cron-free computed-on-read review lifecycle (Phase 28 D28-02) | daily sweep writes the owner notification | Phase 60 | the inbox row stays computed; the sweep only adds the bell item |

**Deprecated / retired this phase:** `/admin/sops/[sopId]/assign`, `AssignmentRow`, `assignSopToRole`, `assignSopToUser`, `removeAssignment`, `getAssignments`, `/api/sops/[sopId]/assignments`, `useNotifications`, `setSopObjective`, the `machines` inbox kind. Kept: `selfAddSop` / `selfRemoveSop` (no UI caller; allow-listed), `getUserSopAssignments`, `getOrgMembers`, `requestAssessorReview` family.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | PostgREST `upsert(onConflict: 'organisation_id,subject_type,subject_id')` works against a `NULLS NOT DISTINCT` unique constraint | Alternatives | Low -- the recommended core does select -> update / insert and does not rely on it |
| A2 | The existing `synthesis-sweep` Railway cron is actually scheduled | F-08 / Runtime State | Medium -- if unscheduled, the new sweep needs the same ops step and RQS-04's producer only fires by hand; the eval proves the route either way |
| A3 | A supervisor's "ask someone to do this" belongs on the worker machine panel (lazy), because D-06 names only admin surfaces (admin machine row, This SOP) and a supervisor sees neither | F-22 | Medium -- RQS-03 says a supervisor can ask; if Simon wants admin-only asking in 60, drop the supervisor path and the `listAskTargets` supervisor branch |
| A4 | Sign-off notifications go to the worker's `supervisor_assignments` supervisors AND admins / safety managers (they all see the row in their Inbox pin) | NTF-02 writer 3 | Low -- D-08 says "supervisor(s)"; admins would otherwise get a pin count with no bell item |
| A5 | The SOP objective is keyed on the lineage root (`parent_sop_id ?? id`) so it survives a new version | F-01 | Medium -- keyed on the version row it would vanish at publish; `forkDraft` would have to copy it |
| A6 | Do NOT copy the 28 stale `worker_notifications` rows | F-02 | Low-medium -- departs from D-07's data-migration sentence; needs Simon's confirmation |
| A7 | "set by" shows `fullName`, else email, to every org member (same `memberLabel`) | OBJ-02 | Low -- reveals admin emails to workers; alternative: first name / role word |
| A8 | `grant update (read_at)` column privilege + the `notifications_mark_own_read` policy behaves as expected through PostgREST | Migration | Low -- asserted by the applier and the live probe before any UI depends on it |
| A9 | Role-targeted asks: no per-person decline (F-04) | F-04 | Medium -- if Simon wants per-person decline of a role ask, the ask must fan out to one `individual` row + one request per member |
| A10 | Review-due notifies when `review_due_at <= now + 30 days` (`DUE_SOON_WINDOW_DAYS`), matching the inbox owned-review rows | NTF-02 writer 2 | Low -- the alternative (only when overdue) is a constant change |

## Open Questions

1. **Copy or skip the 28 unread `worker_notifications` rows? (A6)**
   - Known: live rows are old `completion_rejected` / `removal_request` for 2 users; no `sop_updated` exists; D-07 says copy as `sop_updated`.
   - Unclear: whether Simon wants history in the bell.
   - Recommendation: skip; start empty; keep the table.
2. **Can one worker decline a role-targeted ask? (F-04 / A9)**
   - Recommendation: no -- decline only on person-targeted asks; a role ask is withdrawn by the asker or an admin.
3. **Who raises "Ask someone to do this": admin only, or also supervisor on the worker panel? (A3)**
   - Recommendation: supervisors too, through the lazy ask module, because RQS-03 and D-02 both say supervisor.
4. **Where does the Railway cron get created and by whom?** Planner adds a `checkpoint:human-action` (or an API step with `RAILWAY_API_TOKEN`), and confirms the existing synthesis schedule at the same time (A2).
5. **`request_accepted` for an auto-accepted ask: is the manager's ask "a decision"?** D-01 says raising is not a decision, D-02 says an auto-accepted ask writes the accepted ledger row. Recommendation: one `request_accepted` row with `details.auto = true`; no row at raise.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | build, scripts | yes | present (Windows host) | -- |
| Supabase CLI via `npx supabase` | `db push` | yes `[ASSUMED: used by apply-phase59]` | -- | Management API raw SQL (applier fallback) |
| Supabase Management API (`SUPABASE_ACCESS_TOKEN`) | applier assertions, live probe | yes `[VERIFIED: queried 2026-10-06]` | PostgreSQL 17.6 | -- |
| `SUPABASE_SERVICE_ROLE_KEY`, publishable key | evals, probes | yes (env keys present) | -- | -- |
| `CRON_SECRET` (local env) | eval calls the sweep | yes `[VERIFIED: key present in .env]` | -- | unit-test the sweep core directly |
| Railway cron schedule for the new route | RQS-04 in production without a manual call | unknown -- not in repo | -- | run the route by hand / eval; checkpoint to schedule |
| `RAILWAY_API_TOKEN` | optional scripted scheduling | present, but a project query returned no projects `[VERIFIED]` (token scope unclear) | -- | Railway dashboard (human) |
| Deployed site `sopstart.com` + `/api/version` | `npm run eval -- --phase 60` | yes (59-16 ran it) | -- | -- |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** the Railway cron schedule (human step).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright 1.58.2 (source-contract + pure-module specs; deployed evals) `[VERIFIED: 59-VALIDATION.md]` |
| Config file | `playwright.config.ts` -- add project `phase60` with `testMatch: /tests\/phase60\/.*\.(spec\|test)\.ts$/` (deliberately broad; CLAUDE.md 2026-05-25: an unregistered spec never runs) |
| Quick run command | `npx playwright test --project=phase60` |
| Full suite command | `npx tsc --noEmit` then `npm run build` (bundle gate) then `npx playwright test --project=phase60 --project=phase59 --project=phase58 --project=phase57 --project=phase56 --project=phase54 --project=phase55 --project=phase46 --project=phase41 --project=phase33 --project=phase30 --project=phase28 --project=phase26 --project=phase26.5 --project=phase23-stubs --project=phase15-stubs --grep-invert "live\|probe"` |
| Registration check | `npx playwright test --list --project=phase60` |
| Live probe | `PHASE60_LIVE=1 npx playwright test --project=phase60 requests-notifications-objectives-rls-live` -- once only (shared OTP budget, CLAUDE.md 2026-09-28) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RQS-01 | request model (kinds, states, labels, `canAnswer`); `raiseRequest` strict zod, no org/user/agent field, org+actor from session; composer lazy and in the home bundle only as a tiny button | unit + source-contract | `npx playwright test --project=phase60 request-model request-actions` | Wave 0 |
| RQS-01 | worker raises, sees state on overview, withdraws | deployed eval | `npm run eval -- --phase 60` (`requests.eval.ts`) | Wave 0 |
| RQS-02 | answer claim `.eq('state','open')` before any ledger/notification; exactly one `recordDecision` after the write; decline note >= 10 server-side; receipt says "logged" only when `logged === true`; supervisor `change_sop` link is browse not edit | source-contract | `... answer-actions` | Wave 0 |
| RQS-02 | ledger kinds: 23 in `DECISION_KINDS`, each in exactly one group, words for each; 00074 text contains all 23; applier `KINDS` equal | unit | `... ledger-kinds` (+ `--project=phase59 ledger-read`) | Wave 0 + repoint |
| RQS-03 | core writes `sop_assignments` with explicit org filter, role vs individual, `23505` -> reassign `assigned_by`, supervisor allowed; decline resolves lineage; `worker-signal.ts` and the assignment half of `useWorkerSops` git-diff-empty | source-contract | `... ask-do-sop` | Wave 0 |
| RQS-03 | supervisor asks worker -> badge + Now card due -> worker declines (person ask) -> gone | eval | same eval | Wave 0 |
| RQS-04 | `raiseRequestAsAgent` lives in a plain module (not `'use server'`), names an allowlisted agent, partial-unique idempotence; route is fail-closed bearer, timing-safe, proxy-exempt; eval runs the sweep with `CRON_SECRET` and sees an agent-chip row | source-contract + eval | `... agent-requests cron-route` | Wave 0 |
| NTF-01 | `place` builders only emit safe paths; table CHECK; bell prop on `ShellFrame` with no router; count hidden at 0; overview rows open `select()` or `Link`; mark-read via client update | unit + source-contract | `... notification-places bell-structure` | Wave 0 |
| NTF-02 | each of the six writers calls `notify` after its primary write inside try/catch; dedupe keys; harness stub present; review-due selection unit (due window, owner present, published, latest version only) | source-contract + unit | `... notification-triggers review-due` and `--project=phase26 verify-gate` | Wave 0 |
| OBJ-01 | one live row; admin / safety_manager only; previous text in `details`; `objective_set` / `_cleared` after the write; migrated `sops.objective` rows | source-contract + live | `... objective-actions` | Wave 0 |
| OBJ-02 | `ObjectiveLine` mounted in the five places; tokens only; no card beside steps | source-contract | `... objective-meta` (+ `phase15-stubs design-tokens`) | Wave 0 |
| OBJ-03 | descriptors registered (`objective.*`, `objectives.all`); `FieldContext` + `acceptProposal` carry `subjectId`/`agentName`; agent write lands unconfirmed; role re-checked in the core; `packSopForPrompt` bytes unchanged | unit + source-contract | `... ai-objective-fields` and `--project=phase23-stubs`, `phase55 sop-pack` | Wave 0 |
| SHL-03 | overview = counts card -> objectives -> notifications -> my requests; sections hide when empty; lazy seam + `/page` forbidden marker | source-contract + build + eval | `... overview-structure` and `npm run build` | Wave 0 |
| Deletion | assign page dir, `AssignmentRow`, assignments API route, the four removed actions, `useNotifications`, `setSopObjective` gone; no `src/` href to the assign address; proxy / `legacyRedirectFor` 307s; `machines` kind retired | source-contract | `... retirement-sweep repoint-inventory` | Wave 0 |
| RLS | requests / notifications / objectives matrix by role x own / other x same-org / cross-org (see below) | live probe, once | `PHASE60_LIVE=1 ... rls-live` | Wave 0 |
| Capability | matrix rows added in the same commits as each gate | source-contract | `... capability-matrix` (+ `--project=phase46`) | Wave 0 |

**Live RLS probe matrix (one run, eval-site org, service-minted sessions for worker, supervisor, admin):** `requests` -- worker reads own and none of another worker's, supervisor and admin read the org's open ones but not answered ones they did not answer, nobody authenticated can INSERT / UPDATE / DELETE, a foreign-org admin reads zero; `notifications` -- own rows only, `update read_at` works, `update title` / `place` is refused (column privilege), no INSERT, no cross-user read; `objectives` -- every org member reads, nobody authenticated writes, foreign org reads zero; ledger -- worker / supervisor still read zero decisions (59 A-04), the five new kinds accepted by the check.

### Sampling Rate
- **Per task commit:** `npx playwright test --project=phase60` (+ `npx tsc --noEmit` for any `src/` change)
- **Per plan touching the shell, a lazy seam or `src/` routes:** `npm run build` (bundle gate: `/` and `/sops/[sopId]/page` deltas within +/-2; baseline never edited)
- **Per wave merge:** phase60 + phase59 + phase58 + phase57 + phase56 + phase54 + `phase15-stubs` + `phase26` (gate harness) + `phase23-stubs`
- **Phase gate:** full suite once, build, push, `node scripts/apply-phase60-migration.mjs` (and `--assert-only`), the live probe once, then `npm run eval -- --phase 60` once and read every `60-*` screenshot
- **Max feedback latency:** seconds per task; the eval is the only slow step

### Wave 0 Gaps (create before implementation)
- [ ] `playwright.config.ts` -- `phase60` project (broad regex, header comment, `PHASE60_LIVE` note)
- [ ] `tests/phase60/{request-model,request-actions,answer-actions,ask-do-sop,agent-requests,cron-route,notification-places,notification-triggers,review-due,bell-structure,objective-actions,objective-meta,ai-objective-fields,overview-structure,ledger-kinds,capability-matrix,retirement-sweep,repoint-inventory}.spec.ts` + `requests-notifications-objectives-rls-live.spec.ts` (fixme / skip stubs, one per requirement, discoverable from day one)
- [ ] `tests/phase60/repoint-inventory.spec.ts` -- RETIRED tokens with owning plans (see Deletion inventory) and `LIVE_PLANS`
- [ ] `tests/evals/requests.eval.ts` (new file; fixtures in the eval-site org only) and eval repoints in `office.eval.ts`, `one-screen.eval.ts`
- [ ] `scripts/eval-fixtures.mjs` -- nothing new expected (fixture accounts: admin, worker, supervisor, supervisor-idle, worker2 already exist `[VERIFIED: session.ts]`); add a cleanup helper for requests / notifications / objectives rows in the eval-site org
- [ ] Framework install: none

### Existing projects that must stay green (and the specs to repoint in the same commits)
`phase56` (`decision-writers-sweep` LIVE_WRITERS, `decision-kinds-live` samples table is `Record<DecisionKind, ...>`), `phase57` (`shell-structure`, `place`, `repoint-inventory`), `phase58` (`legacy-redirects:61`, `edit-rail:27-29`, `publish-gate`, `fork-draft`, `edit-actions` objective), `phase59` (`place-tab:30-35`, `inbox-model:125`, `office-pane-structure:62`, `capability-matrix`, `ledger-read`, `shell-wide`), `phase54 governance-inbox` (machines rows), `phase46` (`capability-matrix-doc` pins row labels: add rows, never rename), `phase26 verify-gate`, `phase26.5 synthesis-sweep-auth`, `phase33 delete-sop-org-scope`, `phase55 sop-pack` + `worker-path-contract`, `phase23` registry specs, `phase15-stubs` (`no-dead-internal-hrefs`, `design-tokens`, `no-undefined-css-tokens`, `rls-org-scope`, `sub-trade-assignment` repoint).

### Deployed eval (`tests/evals/requests.eval.ts`, serial, eval-site org)
1. Worker raises a `change_sop` from a SOP row on a machine panel; it appears under My requests as open (assert by note text).
2. Admin opens Office > Requests, sees it with the asker, Accept -> receipt ends "- logged in the decision ledger"; ledger row exists (service read); worker's bell shows 1; opening it lands on the place; mark-read clears the count.
3. Worker raises another; admin Declines with a 10+ char note; asker sees the answer note.
4. Supervisor opens the Office: tab bar now shows Inbox + Requests; answers a request; pin = inbox + requests.
5. Supervisor asks the eval worker to do the fixture SOP; worker sees due on the machine badge and the Now card; person decline with a note removes it and notifies the supervisor.
6. Run `POST /api/cron/daily-sweep` with `CRON_SECRET`; an agent `new_sop` request for the zero-SOP fixture machine appears in the admin Requests tab with the agent chip; decline it; a second sweep does not re-raise.
7. Admin sets an objective on the machine; quiet metadata line "set by" appears on the panel and on the overview; an agent write through `POST /api/ai-fields/write` (admin session, `agentName`) lands "unconfirmed" with the agent chip; admin Confirm clears it and writes `objective_confirmed`.
8. Overview order and empty states for worker and admin; the admin "Open requests in the Office - N" line; zoomed screenshots of the bell, the Requests row, each objective line (CLAUDE.md 2026-10-05: geometry and tokens are invisible to assertions).
9. The old `/admin/sops/<id>/assign` address 307s to the SOP (assert rendered place, not status, CLAUDE.md 2026-09-29).
Rules: assert by name never by count (shared org, 2026-09-29); explicit generous timeouts after `goto` (`SLOW`); the case that needs a second iteration (second request, second notification) has one (2026-10-03); clean up leftover requests with the service key; run once (OTP budget).

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (cron) | Bearer `CRON_SECRET`, `crypto.timingSafeEqual`, fails closed when unset (copy `synthesis-sweep`) |
| V3 Session Management | no change | existing session cookies |
| V4 Access Control | **yes -- primary** | RLS SELECT-only on three tables; service-role cores with explicit session-org filter; role guards in actions (`admin|safety_manager|supervisor` to answer / ask, `admin|safety_manager` to set objectives); capability-matrix rows |
| V5 Input Validation | yes | zod `.strict()` per action (no org / user / agent fields), note <= 500, objective <= 200, UUID gates, kind / state enums, `place` CHECK |
| V6 Cryptography | no | none hand-rolled |
| V13 API | yes | cron route + existing `/api/ai-fields/*`; no new agent endpoint |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-tenant write via a service-role core fed a client-supplied id | Elevation / Tampering | org from `getSessionContext()` only; every `.from()` filtered `organisation_id = <session org>`; verify the subject (SOP, machine, department, member) is in that org before write (CLAUDE.md 2026-06-15, 2026-07-28) |
| Trust flag on a client-reachable action (an `agent` or `serviceRole` field) | Elevation | `raiseRequestAsAgent` in a plain module; zod `.strict()` rejects extra fields (CLAUDE.md 2026-09-30) |
| Open redirect through a stored notification `place` | Tampering / Spoofing | builders + table CHECK `like '/%' and not like '//%'`; the client treats anything else as the overview |
| Notification rewrite (`title` / `place`) by its owner | Tampering | column-level `grant update (read_at)`; applier + live probe assert `has_column_privilege(... 'title' ...) = false` |
| Double-answer race on a request | Tampering | claim `.eq('state','open')` + zero-row check before ledger / notify |
| Formula injection if a ledger / request export ever lands | Tampering | no export in this phase; notes live in `details` and render as text |
| Worker spoofing "answered by" / "set by" | Spoofing | `answered_by`, `set_by_user`, `confirmed_by` are written from the session only; agent name from the `AGENT_NAMES` allowlist |
| Cron endpoint reached without a session | Spoofing | bearer auth + proxy exemption + source-contract spec (the 2026-07-05 learning: the exemption is half the feature) |
| Notification spam (`requestAssessorReview` precedent) | DoS | dedupe key unique per (user, event); role gate before any service-role work |
| RLS read of other people's requests | Info disclosure | `requests_read` arms listed above; live probe per role |

## Project Constraints (from CLAUDE.md)

- Railway-only deploy: after commit, `git push origin master` immediately; UAT is `npm run eval -- --phase 60` against sopstart.com, never hand Simon a click-path or local instructions (memory: evals not click-paths, Railway-only testing).
- Tokens only: no raw Tailwind palette classes or bare hex in components; spacing / radius / type via the token scale; new colours need a token in `blueprint-theme.css` (`tests/lint/design-tokens.spec.ts`). Grep the compiled CSS for any new utility family before pushing (2026-09-28).
- `'use server'` files export async functions only; privileged reads and writes in plain `src/lib` modules; first client-side import of a server action is a re-audit trigger for every parameter it accepts (2026-09-30).
- `recordDecision()` is the only ledger writer; register every new writer in `scripts/decision-writers.json` + the phase56 sweep; agent rows name the agent.
- Migrations numbered sequentially (`00074`), idempotent, with an applier that lists EVERY file in order and asserts every security-relevant clause (2026-07-28); check `supabase migration list` before `db push`.
- No table dropped (standing constraint); RLS: every arm conjoins the org, every `WITH CHECK` restates its `USING` (2026-08-04).
- Living maps updated in the same commit: `src/lib/journeys/journeys.ts` (`assign-sop` journey lines ~402-412, the Office queue `fix` step ~498, add Requests tab / overview / bell), `src/lib/uat/tests.ts`, `.planning/codebase/CAPABILITY-MATRIX.md` (rows: raise / withdraw / answer a request, ask someone to do a SOP, read notifications, set / confirm / clear an objective, read objectives, agent raise / set; and the `Self-add SOP` row's "return as requests in Phase 60" note).
- Plain words: "ask", "asked to do", "answered", "declined", "objective", "section" (never "block", never "assignment" in copy).
- Nothing over an open SOP: no toasts, no popovers beside the steps; the focus rule stands.
- Bundle gate: `/` and `/sops/[sopId]/page` within +/-2 KB; the baseline is a decision artefact an executor never recaptures (2026-09-13); run `npm run build` in every plan that touches the shell, a route or a lazy consumer; `tsc --noEmit` is necessary but not sufficient (2026-06-27).
- Never navigate from a mount effect while the page fires mount-time server actions (2026-09-29); redirects belong in the proxy.
- Playwright: register every spec in a project regex (2026-05-25); live probes self-skip without `PHASE60_LIVE=1` and run once; comments must not quote the literals a guard forbids (2026-09-28); an empty-locator `click()` hang is a locator bug, not a slow app.
- Log `## Learnings` entries after verification gaps, multi-round fixes and wrong-approach corrections.
- NZ metric / Celsius only in any worker-facing AI text (agent request note text if generated).

## Deletion inventory (assign screen and the retired writers)

| Item | Disposition | Owner step |
|------|-------------|-----------|
| `src/app/(protected)/admin/sops/[sopId]/assign/page.tsx` | delete | deletion plan; proxy 307 via `legacyRedirectFor` |
| `src/components/admin/AssignmentRow.tsx` | delete | same |
| `src/app/api/sops/[sopId]/assignments/route.ts` | delete (no caller; grep verified) | same |
| `assignSopToRole`, `assignSopToUser`, `removeAssignment`, `getAssignments` in `assignments.ts` | delete; keep `getOrgMembers`, `selfAddSop`, `selfRemoveSop`, `getUserSopAssignments`; re-point `requestRemoveAssignment` (no UI caller today) to the request path or delete it | cores plan; update `decision-writers.json` entries + sweep `LIVE_WRITERS` |
| `ThisSopBlock.tsx:307-310` "Assign this SOP" link | replace with "Ask someone to do this" (lazy picker) | UI plan; `tests/phase58/edit-rail.spec.ts:27-29` |
| `InboxRow.tsx:213-217` fix link | repoint to the editor, rename | UI plan; `tests/phase59/office-pane-structure.spec.ts:62` |
| `journeys.ts` ids `assign-sop` (:402-412) and the queue `fix` screen (:498); UAT list | rewrite to ask -> accept -> due; mention bell and overview | same commits |
| `src/components/admin/SubTradePicker.tsx` / `sub-trades.ts` | keep (no importer after the page goes; 0 live tag rows); record in dropped-features | `tests/e2e/sub-trade-assignment.spec.ts` "assign page integration" repointed |
| `src/hooks/useNotifications.ts` | delete (no importer) | cores plan |
| `setSopObjective` + `BrowseDocument` / `focus-read` / `forkDraft` objective reads | repoint to `objectives` | objectives plan; `tests/phase58/*` objective assertions |
| `machines` inbox kind, chip, `Write a SOP` action, `machinesWithoutSops` use in `inbox.ts` | retire (keep `machinesWithoutSops` itself if `admin-health` health badges use it -- verify before deleting) | requests-tab plan; `inbox-model:125`, `phase54/governance-inbox`, `office.eval.ts:403-451` |
| `tests/phase57/place.spec.ts:72` (`placeForPath('/admin/sops/abc/assign')`) | still valid (returns `/`); leave | -- |
| Idiom | `tests/phase60/retirement-sweep.spec.ts` asserts the ABSENCE of references (anchor regexes on `/admin/sops/` + `/assign`), `repoint-inventory.spec.ts` with RETIRED / INVENTORY / `LIVE_PLANS` (copy `tests/phase59/repoint-inventory.spec.ts`) | Wave 0 |

## Suggested plan shape (for the planner; coarse granularity)

1. **Wave 0 -- harness:** `phase60` project, stubs, repoint inventory, eval skeleton + cleanup helper.
2. **Wave 1 -- data + pure models:** `00074`, `apply-phase60-migration.mjs`, ledger kind widening (`shape.ts`, `read.ts`, `decision-kinds-live` samples, `ledger-read`, applier KINDS), `database.types.ts`, plain models (`requests/model`, `notifications/{kinds,places}`, `objectives/model`, `officePinCount`). Apply the migration here (blocking) and assert.
3. **Wave 2 -- cores + actions:** requests, ask / decline, notifications writer, objectives core + actions + AI-field descriptors (`FieldContext`, `acceptProposal`, `applyAiWrite` subject), writer registry + sweep + capability-matrix rows, `deleteSop` cleanup, `sops.objective` repoint.
4. **Wave 3 -- triggers:** `publish/route.ts` + `approveStep`, `submitCompletion`, `notifyAssignedWorkers`, answer paths, daily-sweep route + proxy exemption + harness stub; ops checkpoint for the Railway schedule.
5. **Wave 4 -- UI:** Requests tab + `RequestRow`, `getOfficeInbox` second list + pin helper, bell, lazy `SiteOverview`, `ObjectiveLine` x5 + `ObjectiveEditor`, `RequestComposer`, `AskPicker`; `npm run build` per plan.
6. **Wave 5 -- retirement + maps:** delete the assign screen and retired writers, proxy redirect, journeys / UAT / matrix, dropped-features, inventory flips live.
7. **Wave 6 -- proof:** full suite once, build, push, live probe once, `npm run eval -- --phase 60` once, read every screenshot, tick REQUIREMENTS only at plan close (CLAUDE.md 2026-10-04), Learnings entries.

## Sources

### Primary (HIGH confidence -- read from the tree / live DB on 2026-10-06)
- `.planning/phases/60-requests-notifications-objectives/60-CONTEXT.md`; `.planning/REQUIREMENTS.md` (RQS/NTF/OBJ/SHL-03); `.planning/phases/59-the-office/{59-CONTEXT,59-RESEARCH,59-REVIEW-FIX,59-09,59-12,59-13,59-16 SUMMARYs,59-VALIDATION}.md`; `58-CONTEXT.md` D-20; `58-05-SUMMARY.md`
- `src/actions/{assignments,office,shell,ai-fields,completions,versioning,observations,approvals,focus-steps}.ts`; `src/lib/{decisions/*,governance/{inbox,load-inbox,publish-core,classify,cadences}.ts,shell/{office-tabs,place,query-keys}.ts,sop/{focus-path,lineage-current,worker-signal}.ts,ai-fields/{registry,approval}.ts,agent-layer/{sop-pack,signals,synthesis}.ts,validators/ai-fields.ts,supabase/middleware.ts,members/labels.ts,office/format.ts}`; `src/components/{office/*,shell/*,sop/plant/MachinePanel.tsx,admin/governance/*,focus/*}`; `src/hooks/{useWorkerSops,useNotifications}.ts`; `src/app/api/{agent-layer/synthesis-sweep,ai-fields/*,sops/[sopId]/{assignments,publish}}/route.ts`
- `supabase/migrations/{00007,00009,00067,00070,00071,00073}*.sql`; `scripts/{apply-phase59-migration.mjs,decision-writers.json,verify-gate-check.tsx,check-bundle-size.ts,run-evals.mjs}`; `.bundle-baseline.json`; `playwright.config.ts`
- `tests/{phase56,phase57,phase58,phase59,phase26.5,evals}/*` (pins quoted above); `.planning/codebase/CAPABILITY-MATRIX.md`; `CLAUDE.md` Learnings
- Live Management API reads (read-only): PostgreSQL 17.6; counts for `sop_assignments`, `worker_notifications`, `sops.objective`, `sops_sub_trades`, ledger rows, `organisation_members` roles

### Secondary (MEDIUM)
- `.claude/skills/sketch-findings-SOPstart/references/one-screen-site.md` (overview, rooms, data model, cut list)

### Tertiary (LOW -- flagged)
- Existence of a Railway cron schedule for the current synthesis sweep (STATE.md prose only) -- A2
- PostgREST `onConflict` behaviour with `NULLS NOT DISTINCT` -- A1 (not relied on)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new packages; every module named exists and was read
- Architecture: HIGH for tables / cores / lazy seams (direct precedents 56-59); MEDIUM for the second-list pin design and supervisor ask placement (flagged)
- Pitfalls: HIGH -- each cites a pinned spec, a CLAUDE.md learning or live data

**Research date:** 2026-10-06
**Valid until:** 2026-11-05 (stable; invalidated early if Phase 59 follow-ups change `tabsForRole`, the bundle baseline moves, or Next is bumped past 16.2.1)
