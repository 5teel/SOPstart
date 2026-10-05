# Phase 60: Requests, Notifications & Objectives - Context

**Gathered:** 2026-10-06 (Simon chose all four gray areas and the recommended option in each; the rest is Claude's discretion)
**Status:** Ready for planning

<domain>
## Phase Boundary

Three more of the eight data types — **requests**, **notifications**, **objectives** — and the **site overview** they feed (the detail pane with nothing selected). Anyone raises a request (change a SOP · write a new SOP · observe me); a supervisor or admin answers it in the Office's **Requests tab**, the answer is a ledger row and the asker is told. A supervisor or admin asks a role or a person to **do a SOP**; once accepted it is due for them (machine badges + Now card). An AI agent can raise requests and read/set objectives through the existing AI field interface, marked as from an agent. Notifications are in-app only: a bell with an unread count in the list, each item opening the place it is about. Objectives are short free-text statements on the site, a department, a machine, a SOP or a person, shown as quiet metadata saying who set them. Deletes the old assign-a-SOP screen (`/admin/sops/[sopId]/assign`) as assignments become requests.

Requirements: RQS-01..04, NTF-01, NTF-02, OBJ-01..03, SHL-03. Out of scope: the Workshop's "Ask for a change" surface itself (Phase 61 — but the request kind it raises exists here), observations UI (61), email/push delivery (never — in-app only), the training matrix (61).

</domain>

<decisions>
## Implementation Decisions

### Requests (RQS-01..04)
- **D-01 — One `requests` table, four kinds, three states.** Kinds: `change_sop` (about a SOP), `new_sop` (about a machine or the site), `observe_me` (about a SOP the asker does), `do_sop` (about a SOP, aimed at a role or a person). States: `open → accepted | declined` (append the answer, never edit the ask); plus `withdrawn` by the asker while open. Every row carries `organisation_id`, `raised_by` (user id or agent name — one of the two, enforced), `about` (`subject_type` + `subject_id`), `note`, and on answer: `answered_by`, `answer_note`, `decided_at`. Accept and decline each write exactly ONE ledger row via `recordDecision()` (new kinds `request_accepted` / `request_declined`; raising is not a decision). RLS: org-scoped; a person reads their own requests plus, for admin / safety_manager / supervisor, the org's open ones; writes go through server actions only.
- **D-02 — A do-SOP ask from a supervisor or admin is auto-accepted on their authority.** *(Simon's pick.)* Raising it writes the request as `accepted`, writes the existing `sop_assignments` row(s) (role → every member of that role; person → that person) through the existing `assignSopToRole` / `assignSopToUser` core so `worker-signal`'s due logic, machine badges and the Now card change nothing, and notifies each person ("You've been asked to do <SOP>"). The person can **decline with a note**, which flips the request to `declined`, removes the assignment, writes the ledger row and notifies the asker — that decline is the one worker-side answer in the system. Worker-raised kinds (`change_sop`, `new_sop`, `observe_me`) open in the Office Requests tab for accept/decline by an admin or supervisor.
- **D-03 — Requests tab in the Office** (the fifth tab the Phase 59 contract listed): open requests newest first, one row = who asked · what · about · when, with **Accept** / **Decline** (decline requires a note ≥ 10 characters, the Phase 59 `ReasonDialog`); answered rows drop out with the "· logged in the decision ledger" receipt. The tab shares the Office pane, `select()`, chips and receipt slot (59 D-01/D-04). Supervisors see it (they answer requests); workers do not (their requests live on the overview, D-10). The Office pin count includes open requests the viewer can answer (59 D-05 `deriveInbox` optional input idiom).
- **D-04 — Accepting a request does the obvious thing, nothing more.** `change_sop` accepted → the SOP's editor opens for the answerer with a link in the receipt (no auto-fork, no auto-edit). `new_sop` accepted → the receipt links the blank wizard pre-filled with the machine. `observe_me` accepted → an observation record is NOT created here (Phase 61 observations); the request stays `accepted` and the asker is told who will observe. Declines just answer.
- **D-05 — Agent-raised requests.** An agent raises through a server-side helper (`raiseRequestAsAgent(agentName, …)`, service client, org from the caller), never through the client-reachable action; `raised_by_agent` is set and the row renders with the Phase 59 **agent** chip. First concrete producer this phase: the existing "machine with no SOP" inbox row becomes an agent-raised `new_sop` request (the Phase 54 `machines` kind retires into it). RQS-04 is proven by that producer.
- **D-06 — Assignments become requests; the assign screen is deleted.** `/admin/sops/[sopId]/assign` is removed (proxy 307 → the SOP's focus address). The ask lives in two places: the machine panel's admin SOP row ("Ask someone to do this") and the editor's This SOP block (same picker: role or person). `sop_assignments` survives as the materialised "due" table written only by accepted do-SOP requests and the existing self-add; `requestRemoveAssignment` / `removeAssignment` are re-pointed to withdraw/decline the request so the ledger sees every change. The Phase 54 "fix assignment" inbox row keeps working on the same table.

### Notifications (NTF-01, NTF-02)
- **D-07 — A new `notifications` table, read on open.** *(Simon's pick.)* Columns: `organisation_id`, `user_id`, `kind`, `title`, `place` (the `?place=` / focus address it opens — stored as a path, never a full URL), `subject_type` + `subject_id`, `read_at`, `created_at`, optional `decision_id`. Written server-side by the same paths that write the ledger (and by the two non-ledger triggers below); never by the client. Opening a notification marks it read and navigates to `place`; the bell count = unread. Phase 9's `worker_notifications` + `useNotifications` are retired into it (data migration copies unread rows as `kind = 'sop_updated'`; table kept, not dropped, per the standing "no table dropped" constraint — writes stop).
- **D-08 — The five NTF-02 triggers, and where they fire:** (1) next to approve → `approveStep` / `setApprovalChain` when the caller's step becomes current; (2) a SOP you own is due for review → a daily sweep (the existing cron idiom from `synthesis-sweep`, header-authenticated, exempted in the proxy) that writes one notification per owner per SOP when `review_due_at` crosses into due; (3) completion waiting for your sign-off → `submitCompletion` (walk branch) to the worker's supervisor(s); (4) request answered → D-01's accept/decline; (5) new version of a SOP you do → `performPublish`'s existing `notifyAssignedWorkers` (58 D-18) writes `notifications` rows instead of `worker_notifications`. Plus from D-02: "asked to do a SOP". Each trigger is idempotent per (user, kind, subject, day).
- **D-09 — The bell sits in the list pane header beside search**, count badge = unread (hidden at 0), click = scroll the overview to its notifications section (the overview IS the notification list — no popover, no toast, nothing over an open SOP per the focus rule). Esc/Close rules unchanged.

### Objectives (OBJ-01..03)
- **D-10 — Free text, one live objective per thing, optional "by" date.** *(Simon's pick.)* Table `objectives`: `organisation_id`, `subject_type` (`site | department | machine | sop | person`), `subject_id` (null for site), `text` (≤ 200 chars), `due_on` (date, optional), `set_by` (user id or agent name — one of the two), `confirmed_by` / `confirmed_at` (null until a person confirms an agent-set one), `set_at`. One live row per (org, subject_type, subject_id) — setting again replaces (upsert) and the previous text goes to the ledger (new kind `objective_set`; removing writes `objective_cleared`). Admin and safety_manager set/change/remove; everyone in the org reads.
- **D-11 — Shown as quiet metadata, never content:** one line on the detail panel of the thing — site (overview header), department (its list group / panel), machine (panel header), SOP (browse state header + This SOP block), person (People tab row) — "Objective · <text> · by 12 Nov · set by Jane" in the Phase 57 meta style; agent-set reads "set by <agent> · unconfirmed" with a one-tap **Confirm** for admins (confirm = `confirmed_by` set + ledger row `objective_confirmed`; editing it also confirms). Never a card, never beside an open SOP's steps.
- **D-12 — Agents read and set through the existing AI field interface.** `objective` becomes an AI-writable field in `ai-fields.ts` for each subject type (the Phase 23 `applyAiWrite` → proposal → `acceptProposal` path): an agent write lands as the live objective with `set_by = agent` and unconfirmed; a person's Confirm is the acceptance. Agents read every objective of the org through the agent layer (`sop-pack` / `signals` gain the objective line). No new agent endpoint.

### Site overview (SHL-03)
- **D-13 — Nothing selected = the site overview, counts card on top.** *(Simon's pick.)* Order for every role: the Phase 57 site counts card (unchanged) → **Objectives** (the site objective, then department objectives as a short list) → **Notifications** (my unread, newest first, each a row that opens its place; "Show read" link) → **My requests** (open ones I raised with state, then the last few answered with the answer note). Sections hide when empty; the pane's empty-empty state keeps the Phase 57 summary alone. Workers see exactly this; admins additionally see an "Open requests in the Office · N" link line. Phone: CSS collapse only (57 D-21).

### Claude's Discretion
- Where "Ask someone to do this" and the raise-a-request affordances sit precisely (the machine panel row menu vs. a button under the SOP meta line) — follow the Phase 59 one-button idiom.
- The request picker UI (role vs person) — reuse `OwnerPicker`'s popover shape.
- Notification copy per kind (plain words, no ids), relative time formatting (reuse `src/lib/office/format.ts`).
- Daily review-due sweep schedule and the exact cron route shape (copy `synthesis-sweep`).
- Whether `requests` and `notifications` get their own React Query keys or ride `SHELL_KEY` patches (59 A-11 — patch, never invalidate the shell).
- Data migration of existing `sop_assignments` into `accepted` do-SOP requests: only if cheap and idempotent; otherwise leave history as-is and start from now.
- Deletion mechanics for the assign screen: dropped-features entry, sweeps asserting absence of references, repoint inventory, journeys / UAT / matrix in the same commits (Phases 57–59 idiom).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The one-screen contract
- `.claude/skills/sketch-findings-SOPstart/references/one-screen-site.md` — § Layout (overview = objectives · notifications · open requests), § rooms table (Office: Requests tab; Workshop: "Ask for a change" raises a request), § Data model (requests / notifications / objectives rows), § CSS (`objectives read as metadata, not as content`), § What to avoid (no toasts over a SOP), § Open questions 6 (objectives — answered by D-10).

### Prior phase decisions that bind this one
- `.planning/phases/59-the-office/59-CONTEXT.md` — D-01..D-05 (pane, tabs, one action per row, chips, receipt, pin count idiom), A-11 (lazy pane from both shells, patch `SHELL_KEY`), the `ReasonDialog`, the agent chip (D-09), People row (D-11).
- `.planning/phases/58-the-sop-focus-screen-walk-edit/58-CONTEXT.md` — D-18 `notifyAssignedWorkers` on publish (becomes a `notifications` writer), the This SOP block, `focusHref` / `?from=`.
- `.planning/phases/57-the-one-screen-its-places/57-CONTEXT.md` — D-04 (empty pane = site summary — kept as the overview header), D-10/D-11 (`?place=` addresses, proxy redirects), D-21 (phone).
- `.planning/phases/56-a-simpler-sop-the-decision-ledger/56-CONTEXT.md` — ledger design; agent rows name the agent; `recordDecision()` the only writer.
- `.planning/phases/23-*/23-CONTEXT.md` and `src/actions/ai-fields.ts` — the AI field interface (proposal → accept) that D-12 extends.

### Requirements and capability
- `.planning/REQUIREMENTS.md` — RQS-01..04, NTF-01/02, OBJ-01..03, SHL-03 (lines ~984, 1040-1054).
- `.planning/codebase/CAPABILITY-MATRIX.md` — rows for raise / answer / withdraw a request, ask-to-do, set / confirm / clear an objective, read notifications, per role; in the same commit as each gate.

### Field research
- `.planning/research/customer-interviews/` (2026-05-05 Visy) — SOP-ownership governance gap; "observe me" and change requests as the worker's voice.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/actions/assignments.ts` (`assignSopToRole`, `assignSopToUser`, `removeAssignment`, `requestRemoveAssignment`, `getUserSopAssignments`) — the materialised "due" writes D-02/D-06 keep; `src/lib/sop/worker-signal.ts` + `useWorkerSops` — the due/Now-card logic that must not change.
- `src/components/office/*` (`OfficePane`, `InboxTab`, `InboxRow`, `ReasonDialog`, the agent chip in `DecisionsTab`) and `src/lib/shell/office-tabs.ts` — the Requests tab slots in here; `src/lib/governance/inbox.ts` `deriveInbox` optional-input idiom for the pin count.
- `src/lib/decisions/record.ts`, `shape.ts`, `read.ts`; `supabase/migrations/00073_office_ledger.sql` + `scripts/apply-phase59-migration.mjs` — the kind list to widen (`request_accepted`, `request_declined`, `objective_set`, `objective_cleared`, `objective_confirmed`) and the applier shape.
- `src/actions/ai-fields.ts`, `src/lib/validators/ai-fields.ts`, `src/lib/ai-fields/approval.ts` — the AI field write/proposal path D-12 extends; `src/lib/agent-layer/{sop-pack,signals}.ts` — where agents read.
- `src/app/api/agent/synthesis-sweep/route.ts` (or wherever the header-authenticated cron lives) + its proxy exemption — the daily review-due sweep idiom.
- `supabase/migrations/00009_worker_notifications.sql`, `src/hooks/useNotifications.ts` and its five writers (`assignments.ts`, `completions.ts`, `observations.ts`, `sops.ts`, `versioning.ts`) — what D-07 retires into `notifications`.
- `src/components/shell/{ShellFrame,SiteSummary,OneScreen}.tsx` — the list header (bell) and the empty-pane summary (overview header); `src/lib/shell/place.ts` for addresses.
- `src/components/admin/governance/OwnerPicker.tsx` — popover shape for the role/person picker.
- `src/app/(protected)/admin/sops/[sopId]/assign/page.tsx` + `AssignmentRow.tsx` — what D-06 deletes; `tests/phase59/repoint-inventory.spec.ts` / `retirement-sweep.spec.ts` — the deletion-guard idiom.

### Established Patterns
- Server actions derive org/actor from the session; privileged reads/writes in plain `src/lib/` modules; `'use server'` exports only async functions.
- One ledger row per decision via `recordDecision()`; new writers registered in `scripts/decision-writers.json` + the phase56 sweep.
- Admin-only UI behind the lazy seams; `/` bundle ±2 KB, baseline never recaptured by an executor.
- Deployed eval per screen-touching phase, screenshots read; live probes once (OTP budget); shared eval-site org — assert by name.

### Integration Points
- `OfficePane` tab list (`tabsForRole`) + `ShellFrame` list header (bell) + the empty-pane body (overview).
- `performPublish` (58 D-18) and `submitCompletion` (walk branch) as notification writers.
- `src/lib/supabase/middleware.ts` — the assign-route redirect + the cron exemption.
- `journeys.ts`, `src/lib/uat/tests.ts`, `CAPABILITY-MATRIX.md`.

</code_context>

<specifics>
## Specific Ideas

- Plain words: "ask", "asked to do", "answered", "declined", "objective"; never "assignment" in copy (the data table keeps its name).
- Every answer ends "· logged in the decision ledger" (Phase 59 receipt idiom).
- Agent-raised / agent-set things carry the Phase 59 **agent** chip; an agent's objective says "unconfirmed" until a person confirms.
- The overview never shows a count-only placeholder for notifications — either rows or nothing.

</specifics>

<deferred>
## Deferred Ideas

- **Workshop "Ask for a change" surface** and worker change-request UI polish — Phase 61 (the request kind exists from this phase).
- **Observations** created from an accepted "observe me" — Phase 61.
- **Several objectives per thing with measurable targets** an agent can score — backlog.
- **Email / push delivery** of notifications — out of scope for the MVP (in-app only).
- **Supervisor "Record observation" entry point** (lost in 59) — Phase 61.
- **Org-wide forward-jump default** (58) — backlog.

</deferred>

---

*Phase: 60-requests-notifications-objectives*
*Context gathered: 2026-10-06*

<amendments>
## Amendments after research (2026-10-06, Claude's calls — redirect before planning if wrong)

Binding on the planner; see `60-RESEARCH.md` F-01..F-23 for the evidence.

- **A-01 — `sops.objective` migrates into `objectives`.** The two live rows are copied to `objectives` keyed on the SOP's lineage root (`subject_type='sop'`), the column is no longer read (`BrowseDocument`, This SOP) or written (`focus-steps.ts`, `forkDraft` copies nothing), and it stays undropped. D-10's 200-char limit stands; the live rows are ≤ 31 chars.
- **A-02 (Q1) — The new `notifications` table starts empty.** The 28 unread `worker_notifications` rows are `completion_rejected` / `removal_request`, not `sop_updated`; copying them would light stale bells on first deploy. D-07's data copy is dropped. `worker_notifications` keeps serving the Phase 37 assessment-request panel (its only surviving reader/writer); the five NTF-02 writers move to `notifications`.
- **A-03 (Q2) — Decline is person-targeted only.** A role ask is one dynamic role row; a single worker cannot decline it. The worker-side Decline (D-02) appears only on asks aimed at a named person. Role asks are withdrawn by the asker.
- **A-04 (Q3) — Supervisors can ask from the worker machine panel.** D-06 names the admin surfaces; add the same "Ask someone to do this" to the supervisor's machine-panel SOP row, in a lazy module, since supervisors use the worker shell.
- **A-05 (Q5) — An auto-accepted ask writes ONE ledger row, `request_accepted`, at raise time** (no row for the raise itself). A new service-role core (`src/lib/requests/ask-core.ts`) writes the request + the `sop_assignments` row(s); the admin-only `assignSopToRole/User` actions are retired into it so no path writes two rows.
- **A-06 (F-04) — Notification reads, the unread count and mark-read use the browser Supabase client under RLS**, never a server action (the Next 16.2.1 action-queue orphan). The bell is a prop slot on `ShellFrame` (it is source-pinned: no router, one `setPlace`); tapping a notification calls `select()`/`placeToken` navigation exactly like a list click.
- **A-07 (F-05) — Every new surface is a lazy module with a forbidden marker:** the overview body, the request composer, the ask picker, the objective editor, the Requests tab — `/` is at 834/834 and `/sops/[sopId]` reads 794 against 792. No CSS imports in any of them (the 59-12 mini-css lesson). The baseline is not touched by an executor.
- **A-08 (F-06, Q4) — The daily sweeps are two header-authenticated routes** (`review-due` and `machines-without-sops`), each exempted by exact path in the proxy, callable with `CRON_SECRET`; the deployed eval calls them directly. **Scheduling them on Railway is a human action** (checkpoint in the sign-off plan): Simon confirms whether the existing synthesis sweep is scheduled and adds these two, or the plan documents the two `curl` lines to schedule.
- **A-09 (F-07) — D-12 via the AI field interface is scoped to what the interface can carry:** `FieldContext` gains `subjectType` + `subjectId` + `agent`; the `objective` field is registered per subject type; a published-SOP objective write is NOT diverted to a proposal (objectives are metadata, not SOP content) — it lands live as `set_by = agent, unconfirmed`, which is the proposal state. `packSopForPrompt` is byte-pinned and feeds the embedding — the objective line goes in `signals`, not the pack.
- **A-10 — New tables carry no foreign key to `sops`** (the fork-draft census would fail), only `subject_id uuid`; `deleteSop` clears `requests`, `notifications`, `objectives` rows about that SOP.
- **A-11 — `scripts/verify-gate-check.tsx` gets a stub** for the new server-only notification module the publish route will import.
- **A-12 — The "fix assignment" inbox row (stale department reference) re-points its link** from the deleted assign page to the SOP's focus address with the This SOP block open; SOP sub-trade tagging (only on the assign page, 0 live rows, already cut by D-A10) is deleted with it.

</amendments>
