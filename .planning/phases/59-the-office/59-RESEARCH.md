# Phase 59: The Office - Research

**Researched:** 2026-10-05
**Domain:** Re-homing governance (inbox, sign-off, approvals, people, access, ledger read) into the one screen's detail pane; Next.js 16.2.1 App Router + React 19 + TanStack Query 5 + Supabase RLS
**Confidence:** HIGH on the shell, actions, RLS and deletion inventory (all read from source in this session); MEDIUM on three items tagged `[ASSUMED]`

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01 — The Office is the detail pane of `/?place=office`, with a `&tab=` address.** `inbox` (default) · `decisions` · `people` · `access`. Tabs are a small segmented control at the top of the pane; the Phase 57 Office card (counts + bridge links) is replaced by the tabbed body. No new route. *(auto: recommended over a `/office` route — the contract says rooms are not pages.)*
- **D-02 — Wide pane for the table tabs only.** `decisions`, `people` and `access` switch the shell grid to `256px 1fr minmax(560px, 58%)` (contract § CSS); `inbox` stays at the normal 400px. The map stays live, re-centres on the Office on every pane resize (`ResizeObserver` on the stage; guard the 0×0 hidden-stage case — contract § Interaction). Esc / Close returns to the overview and refits. *(auto: the contract names exactly which tabs are wide; the inbox is kept narrow and gets a lightbox for photos instead — see D-06.)*
- **D-03 — Role views.** Admin and Safety Manager: all four tabs. Supervisor: Inbox (only rows they can act on — their sign-offs and chain steps naming them) and Decisions (read). Worker: unchanged from Phase 57 (the reduced Office card bridging to `/activity`); "My requests" is Phase 60. Capability matrix rows for each tab × role in the same commit as the gates.
- **D-04 — One row, one button, cleared on action.** Row kinds and their button: no owner → **Assign owner** (the existing `OwnerPicker` popover, `setSopOwner`); review overdue / due → **Mark reviewed** (`confirmSopCurrent`, owner or admin); completion awaiting sign-off → **Sign off** (expands, D-06); approval chain step naming the caller → **Approve** (expands, D-07); stuck parse → **Try again** (re-queue the job); machine with no SOP → **Write a SOP** (links the blank wizard with `?machine=`). The last two are the Phase 54 `stuck` / `machines` kinds kept because each still has exactly one action. A cleared row leaves the list without a reload (optimistic remove + `invalidateQueries`), and every action's confirmation line ends "· logged in the decision ledger".
- **D-05 — Empty state is the goal, said plainly:** "Nothing needs you. That's the goal." with the count of things cleared today beneath it (from the ledger). Chips (All · Owner · Overdue · Approve · Sign-off · Stuck · Machines) keep the Phase 54 `INBOX_CHIPS` idiom; the Office pin count stays `deriveInbox(...).length` (57 D-16) and now includes sign-off rows.
- **D-06 — Sign off from the row.** Tapping **Sign off** expands the row in place: worker, SOP title + version, when, the steps done with their acks, and the photos as a thumbnail strip (tap → full-screen lightbox, swipe/arrow between photos). Two buttons: **Sign off** (primary) and **Reject** (secondary; a note is required). Both call the existing `signOffCompletion` (already writes `sign_off` / `reject` to the ledger and sets `signed_off` / `rejected`). A rejected completion makes the SOP read as not done for that worker (planner confirms `worker-signal` treats `rejected` as not completed; if it does not, fix it in this phase). No separate review page survives for supervisors.
- **D-07 — Approve from the row.** **Approve** expands to: SOP title + version, who already approved (the chain so far), a one-line link to **open it in browse state** (`focusHref(id, { from: 'office' })`) so the approver can read it, then **Approve** (primary) / **Send back** (secondary; note required → the existing `requestChanges`, which regains a caller here). Final approval triggers the existing publish path unchanged (`performPublish` + `assertPublishGates()` — never weakened).
- **D-08 — A one-line meta under every admin SOP row:** "Owner · Jane Smith · review due 12 Nov" — `AdminSopRows` (Noticeboard, machine panel, Workshop drafts) and the inbox rows. No owner renders "No owner" in the warn tint; overdue renders the date in the escalate tint. Review date = the existing cadence's next-due value (Phase 36 `cadences.ts`); a SOP with no cadence shows "no review date" quietly. The editor's **This SOP** block (58-12) gains an Owner row (the same `OwnerPicker`) and, for the owner or an admin, a **Mark reviewed** button — the same `confirmSopCurrent`.
- **D-09 — A table, newest first, 50 at a time with "Show older".** Columns: when (relative, with the absolute date on hover) · who (person's name, or the agent's name with an "agent" chip) · what (plain-words kind) · about (the subject — SOP title linking to its focus address, a person's name, a completion). Filter by kind with chips grouped into plain words: **All · Approvals** (approve, reject) · **Sign-offs** (sign_off, countersign) · **Ownership** (owner_change, assign, unassign) · **Publishing** (publish) · **Reviews** (review, cadence_change) · **AI** (ai_finding_cleared, ai_field_write, verify, verify_withdrawn) · **Other** (observation, and the new kinds below). Read through a session-scoped server action over the `decisions` table (RLS is already org-scoped; the ledger is append-only, so this tab is read-only by construction).
- **D-10 — Governance changes made in this phase that are not yet ledger kinds get kinds:** `role_change`, `member_invited`, `member_removed`. One additive migration widens the `decisions.kind` check constraint; `recordDecision()` stays the only writer; `scripts/decision-writers.json` + the Phase 56 sweep list the new writers (`updateMemberRole`/`updateMemberRoleSafe`, `inviteWorker`/`addMemberByEmail`, `removeMember`).
- **D-11 — A table in the wide pane:** name · email · role (inline select → `updateMemberRoleSafe`, which already guards the last-admin case) · departments (the existing `member_departments` picker from `/admin/team`, 57 D-09, unchanged) · status (Active / Invited) · Remove (existing `removeMember`, confirm dialog). **Invite** button above the table: email + role → the existing invite action; the invited row appears with the Invited chip. Every change ends "· logged in the decision ledger" (D-10). Settings (`/admin/settings`) keeps its own route and gets a quiet link under the table; no org-chart or column views anywhere.
- **D-12 — `AdminAccessLens` mounts in the wide pane unchanged.** Same component, same server actions, no restyling beyond the container; if it needs more than 58% it may claim the pane's full width but the map never leaves. `/admin/access` 307-redirects to `/?place=office&tab=access` in the proxy; the Phase 57 bridge page is deleted.
- **D-13 — Delete in this phase:** `/governance` (page + `GovernanceInbox` wrapper; `deriveInbox`/`loadInbox`/`GovernanceQueueRow` are re-homed, not deleted), `/admin/team`, `/admin/access` (page only), the org-model views under `src/components/admin/org-model/` and `src/actions/org-model.ts` if nothing else reads them, and the **supervisor** halves of `/activity` (`SupervisorActivityView`, the supervisor branch of `/activity/[completionId]`). The worker `/activity` view stays until Phase 61. Proxy redirects: `/governance` → `/?place=office`, `/admin/team` → `/?place=office&tab=people`, `/admin/access` → `/?place=office&tab=access`, `/activity/[id]` for a supervisor → `/?place=office` (the inbox row). Follow the Phase 57/58 idiom exactly: dropped-features entries, deletion + retirement sweeps asserting the absence of references, repoint inventory, `journeys.ts`, `src/lib/uat/tests.ts`, `CAPABILITY-MATRIX.md` in the same commits.

### Claude's Discretion

- Whether the inbox's expanded row is an accordion or a sheet over the pane (accordion is the obvious reuse of the Phase 54 row); thumbnail size; lightbox implementation (no new dependency — a fixed overlay with keyboard arrows is enough).
- Decisions-tab paging mechanics (cursor on `created_at,id`), relative-time formatting (reuse whatever `RelBadge`/activity already use).
- How "cleared today" is counted (ledger rows by the caller's org today, kinds in the inbox set).
- Whether the Office pane needs a `loading` skeleton per tab (yes if the first query is slower than a frame — follow the 58-13 `EditorSkeleton` idiom).
- Phone: no design work (57 D-21) — the wide pane collapses like the rest below 1024px.

### Deferred Ideas (OUT OF SCOPE)

- **Requests tab** (My requests, worker change requests, agent-raised requests) — Phase 60.
- **Notifications / bell** on inbox changes — Phase 60.
- **Worker "My sign-offs" in the Office** and the worker `/activity` deletion — Phase 61 (my record in the Smoko room).
- **Org-wide default for the forward-jump toggle** (58 D-08 note) — backlog.
- **Approval history per version as a surface** — the ledger's Publishing/Approvals filter covers it; a per-SOP view is backlog.
- **Refresher interval UI** (`setRefresherInterval` lost its page in 58-16) — Smoko room / training, Phase 61.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| OFF-01 | Office opens on an inbox; every row one thing, one button; empty = the goal | F-01, F-02, F-09; "Inbox data flow"; `inbox.ts` / `load-inbox.ts` extension; receipts pattern |
| OFF-02 | Supervisor signs off or rejects a completion with its photos from the inbox | F-03, F-04, F-05; `signOffCompletion` gates (assessor, override, assignment); `getCompletionForReview` read; `CompletionStepRow` reuse |
| OFF-03 | Named chain approver approves or sends back from the inbox | F-06; `approveStep` / `requestChanges` guards; `getApprovalStatus` |
| OFF-04 | Every SOP has an owner and a review date wherever an admin lists it; owner can mark reviewed | F-07, F-08; `AdminSopRows` already carries a meta line; `getOrgMembers` returns no names; `confirmSopCurrent` guard |
| OFF-05 | Admin invites, sets role, sees department from the Office | F-10, F-11; `RoleAssignmentTable` lift; `inviteWorker` has no guard and no role; role-change RLS silently no-ops for safety managers |
| OFF-06 | Admin opens the access wiring unchanged | `AdminAccessLens` is already a self-fetching client component with one optional prop; mounts as-is |
| DEC-02 | Admin reads the ledger newest first, narrowed by kind | F-12; `decisions` columns and indexes; supervisor read needs an RLS change |
| SHL-06 | Detail pane widens for tables; site stays visible and re-centres | F-13; the refit already exists in `PlantStage`; only the width class and the tab address are missing |
</phase_requirements>

## Summary

Phase 59 is mostly re-homing, but reading the code against CONTEXT.md turned up **fourteen places where the locked decisions assume something the code does not do** (section "Spec-versus-code findings" below). The biggest: (1) a supervisor can never approve a chain step today because `approveStep` / `requestChanges` / `listGovernanceQueue` all sit behind `requireAdmin()` and chain steps can only name admin or safety-manager roles; (2) `signOffCompletion` has an assessor gate and an admin override path that the old review page carried in ~120 lines of UI which D-06's "two buttons" would silently drop; (3) `getOrgMembers()` returns `email: null` and `full_name: null` for everyone, so "Owner · Jane Smith" has no source data (labels today read `admin (a1b2c3d4)`); (4) `inviteWorker` has no role guard at all and always invites as `worker`; (5) the decision ledger can only be read by admin and safety manager, so D-03's "Supervisor: Decisions (read)" needs an RLS change; (6) the Office pin currently excludes sign-offs and the shell caches `getAdminShell` for 30 minutes.

The shell side is easier than CONTEXT.md implies. The camera already re-centres on any stage resize (`PlantStage` `ResizeObserver`, replaying the last fly/fit intent, hidden 0×0 stage guarded), and the admin module is already behind a `next/dynamic` seam. SHL-06 needs a width class, a `tab` on the place address, and a decision about where supervisors' Office pane code lives (supervisors use the static `WorkerShell`, so their Office pane must be a second `dynamic()` import of the same module the admin shell uses, or the `/` bundle gate (831 KB ±2) breaks).

**Primary recommendation:** Build one lazy module `src/components/office/OfficePane.tsx` (tab bar + four tab bodies, role-aware) imported only through `next/dynamic` from `AdminShell` and from `WorkerShell` (supervisor branch). Extend `Place` with an optional room `tab`, extend `loadInbox`/`deriveInbox` with a `signoff` kind, add three server-side read actions (`getOfficeInbox`, `getCompletionForReview`, `listDecisions`), one additive migration (`00073`: widen the kind check, add supervisor read policy), fix the five guard/label gaps in F-03..F-11 inside the existing actions, then delete the old pages by the Phase 57/58 sweep idiom. No new npm packages.

## Spec-versus-code findings (read these before planning)

Each finding is a place where CONTEXT.md and the shipped code disagree. Recommendation is prescriptive; items needing Simon are repeated in Open Questions.

| # | Finding | Evidence | Recommendation |
|---|---------|----------|----------------|
| F-01 | **The Office pin excludes sign-offs today; D-05 says include them.** 57 D-16 said sign-offs are a separate line. 59 D-05 supersedes. `loadInbox` documents "completions awaiting sign-off are NOT part of it". | `src/lib/governance/load-inbox.ts:5-9`; `src/actions/shell.ts:54` (`inboxCount: inbox.items.length`); `AdminShell.tsx:96,136` reads `usePendingSignOffCount` separately | Add a `signOffs` input (optional, default `[]`) to `deriveInbox` so the six Phase 54 `deriveInbox` call shapes in `tests/phase54/governance-inbox.spec.ts` stay valid. `loadInbox` loads them; `getAdminShell` count then includes them. Update 57's eval "Office count equals governance page open count" (it goes away with `/governance`). |
| F-02 | **`getAdminShell` is cached 30 minutes** (`staleTime`) because the signed scene URL rotates on refetch. An inbox action will not move the Office pin or count unless the cache is patched. | `AdminShell.tsx:91-95` | After each inbox action: `qc.setQueryData(SHELL_KEY, ...)` to decrement `inboxCount` / the chip, and `invalidateQueries(['office-inbox'])` for the pane. Do NOT `invalidateQueries(SHELL_KEY)` per action (re-signs the scene URL, swaps the image). Edit mode already does invalidate it (`SiteEditSurface.refresh`), that is the only precedent. |
| F-03 | **`signOffCompletion` has an assessor gate (Phase 37 ASR-01) the old page implemented in UI.** Approve by a supervisor who is not a signed-off assessor returns `NOT_SIGNED_OFF_ASSESSOR`; admin / safety manager approving without assessor status must send `overrideReason` (>= 10 chars) or get `ASSESSOR_OVERRIDE_REQUIRED`. Reject has no assessor gate and needs a reason >= 10 chars (not just "a note"). | `src/actions/completions.ts:182-185` (reject reason), `:226-245` (assessor / override), `:247-260` (supervisor must be assigned to the worker) ; UI in `activity/[completionId]/CompletionDetailClient.tsx:55-65,118-179,318-437` | The expanded row must reproduce: (a) blocked-supervisor teaching copy + "Request assessment" (`requestAssessorReview`, `src/actions/observations.ts`), (b) an inline override-reason field for admin / safety manager, with the disclosure copy, (c) a reject reason field with a 10 character minimum. Lift the copy constants from `CompletionDetailClient.tsx`; the server stays the authority. Compute `isAssessor` server-side in `getCompletionForReview` (same call the page makes: `isSignedOffAssessor(userId, sopId, admin, organisationId)`). |
| F-04 | **The supervisor counter-signature is written by the client after approval.** `CompletionDetailClient` calls `recordSignature({ completionId, role: 'supervisor' })` after a successful approve; that is the only writer of the `countersign` ledger kind for this flow. A new inbox row that only calls `signOffCompletion` silently drops it. | `CompletionDetailClient.tsx:136-149`; `scripts/decision-writers.json` entry `recordSignature` | Cheapest: call `recordSignature` from the row after an approve, exactly as today. Better (not skippable by a client): call it at the end of the approve branch inside `signOffCompletion` and register a `delegatedHooks` entry for it in `scripts/decision-writers.json` (the 58 `submitCompletion` precedent). Pick one; do not drop it. |
| F-05 | **The old review page has two bugs the re-home must not copy.** (a) For role `supervisor` it reads the completion with the service-role client and never checks `supervisor_assignments` (comment says "double-check", code does not), so any supervisor can open any org completion and its signed photo URLs. (b) `signOffCompletion` lets an admin / safety manager sign off their own walk. | `activity/[completionId]/page.tsx:44-85`; `completions.ts:196-260` (no `worker_id !== userId` check) | `getCompletionForReview` reads rows with the SESSION client (RLS already scopes supervisors to assigned workers and admins to the org: `00010_completion_schema.sql` policies on `sop_completions` and `completion_photos`), and only then signs storage paths from the rows it got back with the admin client. Exclude `worker_id = me` from the inbox and refuse it in `signOffCompletion` ("You cannot sign off your own walk"). Mark the second as `[ASSUMED]` desired (Open Question O3). |
| F-06 | **Supervisors cannot approve a chain step today, and the matrix says they can.** `approveStep`, `requestChanges`, `getApprovalStatus`, `listGovernanceQueue` all call `requireAdmin()` (admin / safety_manager only); `chainStepSchema` only allows `role: 'admin' \| 'safety_manager'` or a `userId`; the chain editor offers only those two roles. The matrix cell "Approval chains: supervisor ✅ (as named chain-step approver only)" is drift. `performPublish` on the final step runs with the session client under `admins_can_update_sops`. | `src/actions/approvals.ts:156,237,303`; `src/actions/governance.ts:76-84,349`; `src/lib/validators/approvals.ts:7-15`; `ApprovalChainEditor.tsx:39`; matrix row "Approval chains" | Do NOT widen these guards (CAP-02: approving a step is not a right to publish). D-03's "chain steps naming them" therefore yields zero rows for a supervisor in practice. Supervisor inbox = sign-offs only; admin / safety manager inbox = everything. Correct the matrix cell in the same commit. If Simon wants supervisor approvers, that is a new capability needing a publish-path decision, not a re-home (O2). |
| F-07 | **`getOrgMembers()` returns `email: null, full_name: null` for every member**, so every label built from it (`listGovernanceQueue.ownerLabel`, `OwnerPicker`, `getApprovalHistory`) reads `admin (a1b2c3d4)`. There is no profiles table. D-08's "Jane Smith" and D-09's "person's name" have no source. | `src/actions/assignments.ts:188-215` (the `.map` hard-codes nulls); `OwnerPicker.tsx:16-18`; CLAUDE.md 2026-09-29 learning | Fix at the one choke point: make `getOrgMembers()` fill `email` (and `full_name` from `user_metadata.full_name` if present) via `auth.admin.listUsers`, as `getTeamMembersWithEmails` already does (`auth.ts:295-306`). Every existing label expression `m.email ?? m.full_name ?? role (uuid8)` then shows an email. State plainly in the UI that people are shown by email. For one-off lookups of a user who may have left (decision "about" column) use `auth.admin.getUserById`, because `organisation_members` rows are hard-deleted on removal. |
| F-08 | **"Review date" is a stored column, not a live cadence read.** `sops.review_due_at` is written at publish (`publish-core.ts:214`) and on `confirmSopCurrent` (`governance.ts:248`); `cadences.ts` only computes the value at write time. `AdminSopRows` already renders "owner X · review due Mon YYYY" and `AdminPanelSop` already carries `ownerLabel` and `reviewDueAt`. The Workshop drafts list does not render it. | `AdminMachinePanel.tsx:77-79`; `admin-health.ts` `AdminPanelSop`; `AdminRoomBodies.tsx:64-96` | OFF-04 is mostly a format change in `AdminSopRows` (day precision, `Pacific/Auckland` fixed zone, warn / escalate tints, "No owner", "no review date"), plus rendering the same meta line on Workshop drafts (needs `ownerLabel` / `reviewDueAt` added to the `drafts` payload in `getAdminShell`) and on inbox rows. |
| F-09 | **`router.refresh()` is baked into the rows being re-homed** (`GovernanceQueueRow.tsx:69,81`, `OwnerPicker.tsx:60`). On the one screen there is no server page data to refresh; the call dispatches a REFRESH router action alongside TanStack's server-action queries, which is the exact Next 16.2.1 orphaned-action class in CLAUDE.md 2026-09-29. | files as cited | Replace with an `onDone` callback prop that invalidates queries. Keep the action-branch precedence (approve-me, unowned, stale-role, confirm-current): it is the APR-03/04 hard constraint recorded in the row's header comment. |
| F-10 | **`inviteWorker` has no authorisation and no role.** It only checks that a session exists, then calls `inviteUserByEmail` with `invited_role: 'worker'` hard-coded. Any signed-in member (a worker) can invite anyone into the org today. D-11 wants email + role. | `src/actions/auth.ts:131-165`; `acceptInvite` reads `invited_role` from user metadata at `:200` and inserts the membership at `:212` | Add the admin / safety-manager guard first, a zod `role` enum (`updateRoleSchema` already has the four roles), and (recommended) require `role === 'admin'` to grant `admin`, mirroring the `admins_can_update_member_roles` RLS (`00062`: only `current_user_role() = 'admin'`). Log `member_invited`. "Invited" rows: there is no table; read them from auth users where `user_metadata.organisation_id === org` and no `organisation_members` row exists (`invited_at` is on the GoTrue `User` type, `auth-js` 2.100.0 `types.d.ts:350`). |
| F-11 | **Role changes by a safety manager silently do nothing and report success.** The RLS `WITH CHECK` is `current_user_role() = 'admin'`; a safety manager's update matches zero rows, no error, and `updateMemberRoleSafe` returns `{ success: 'Role updated successfully' }` (the update has no `.select()`). The People tab would show the new role optimistically. `updateMemberRole` (the unsafe sibling) is the same. | `auth.ts:446-456`, `00062_org_members_update_check_org_scope.sql` | Add `.select('id')` and treat zero rows as an error ("Only an admin can change roles"); hide the inline select for safety managers or disable it with that explanation. `updateMemberRole` has no caller in `src/` after the lift: delete it (and keep `updateMemberRoleSafe`), and keep the sweep entries in step. |
| F-12 | **The ledger is admin / safety-manager read only** (`admins_can_read_decisions`, `00070`), so D-03's supervisor "Decisions (read)" returns zero rows today. | `supabase/migrations/00070_decisions_ledger.sql` policy block; CAPABILITY-MATRIX "Read decision ledger" | One additive migration `00073` does both D-10 (widen `decisions_kind_check`) and the supervisor SELECT policy (org conjunct + `current_user_role() in ('admin','safety_manager','supervisor')`). Matrix row updated in the same commit; per-role runtime probe required (CLAUDE.md 2026-07-20): worker sees 0, supervisor same-org sees rows, cross-org sees 0. If Simon prefers not to widen, drop the supervisor Decisions tab (O4). |
| F-13 | **`Place` has no `tab`, `ShellFrame` has no wide class, and a Phase 57 spec pins the exact shape.** The detail pane is `lg:w-100` in a flex row (not a grid). `tests/phase57/shell-structure.spec.ts:56-70` pins `lg:w-100`, `useState<Place>(() => parsePlace(initialPlace))`, exactly one `setPlace(` and one `replaceState`, and `select()`'s body. | `ShellFrame.tsx:92,104-107,345-349`; `place.ts:10-56` | Keep the one-writer rule. Put the tab INSIDE the room place (`{ kind: 'room', id, tab? }`) so `select(p)`, `placeKey` (the pane's React `key` and the camera effect dependency) and the URL all derive from one state. Keep the literal `lg:w-100` in the file (conditional class). Repoint the `parsePlace(initialPlace)` pin in the same commit. |
| F-14 | **Deleting `/admin/team` and the org-model views strands three live features that Phase 60/61 re-home.** `TeamViewShell` also hosts the training matrix (`TrainingMatrixView`) and `PersonPanel`; the team page also mounts `AssessmentRequestsPanel`. `src/actions/org-model.ts` cannot be deleted: `admin-access-view.ts` imports `listOrgTree` (the Access screen reads it) and `grants.ts` documents org-model callbacks. | `TeamViewShell.tsx:15-16`; `admin/team/page.tsx:7,55`; `admin-access-view.ts:28,62` | Delete `TeamViewShell`, `OrgChartCanvas`, `OrgColumnsBoard`, `ViewToggle` and the eight mutating exports in `org-model.ts` that only those two canvases call (`createRole`, `assignRoleMembers`, and the other six have no other caller: verified by grep), keep `listOrgTree`. Keep `TrainingMatrixView`, `PersonPanel`, `AssessmentRequestsPanel` and their actions in place, unmounted, and record the gap in the plan: the training matrix and assessment requests have no entry point from this phase until Phase 61 (matrix) and Phase 60 (requests). This is a product-visible loss for a few phases and Simon should know (O5). |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Office tabs, wide pane, `?place=office&tab=` | Browser / Client (shell, `history.replaceState` from `select()`) | Frontend Server (`page.tsx` reads `tab`) | Place state and camera are client-only; the server only seeds the initial value. Never a client redirect (CLAUDE.md 2026-09-29). |
| Legacy address redirects | Proxy (`src/lib/supabase/middleware.ts`) | Server component (activity detail page for non-owners) | Fixed-template 307s; role claim exists in the proxy (`user_role`) but can be stale, so the page keeps its own role check. |
| Inbox derivation | Plain module (`inbox.ts`) fed by `loadInbox()` | API / Backend (server actions) | Pure classification; each source self-guards its own role. |
| Sign-off / reject | API / Backend (`signOffCompletion`) | Database (RLS scopes the read) | Assessor, override, assignment and org checks are server-side; the UI only mirrors them. |
| Completion photos | API / Backend (signed URLs from rows RLS returned) | Storage | Admin client signs paths only for rows the session client was allowed to read. |
| Approve / send back | API / Backend (`approveStep`, `requestChanges`) | Database (`sop_approvals` unique index, `sops` RLS) | Guards stay admin / safety manager; publish path unchanged. |
| People and roles | API / Backend (`auth.ts` actions) | Database (RLS `00062`) + Auth admin API (invite, emails) | Role writes are RLS-gated to `admin`; invites and emails need the service role. |
| Ledger read | Database (RLS, org-scoped) | API / Backend (`listDecisions`, label resolution) | Append-only table; the read action uses the session client. |
| Access wiring | Browser (lens) | API / Backend (`listAdminAccessData`, unchanged) | Lens is already self-fetching. |
| Owner / review metadata | API / Backend (`listGovernanceQueue` payload) | Browser (`AdminSopRows`) | Classification and labels computed once server-side (`admin-health.ts`). |

## Standard Stack

### Core (all already installed; no new packages)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 16.2.1 `[VERIFIED: node_modules/next/package.json]` | App Router, `next/dynamic` lazy admin seam | In use. 16.2.1 has the server-action orphan bug: no navigation from mount effects. |
| @tanstack/react-query | 5.95.2 `[VERIFIED: node_modules]` | Inbox, decisions, people queries; optimistic cache patching | Every shell read already uses it. |
| @supabase/supabase-js / auth-js | auth-js 2.100.0 `[VERIFIED: node_modules]` | RLS reads, `auth.admin.listUsers` / `getUserById` / `inviteUserByEmail` | In use. |
| yet-another-react-lightbox | 3.29.2 `[VERIFIED: package.json:51, node_modules]` | Photo lightbox | Already dynamically imported by `CompletionStepRow`; CONTEXT leaves lightbox to discretion and says "no new dependency": this is not new. Reusing it is smaller than a hand-built overlay. |
| zod | existing | Action input validation | Project standard (`updateRoleSchema`, `signOffSchema`). |
| lucide-react | existing | Icons | Project standard. |
| @playwright/test | 1.58.2 `[VERIFIED: npx]` | Specs and deployed evals | Project standard. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `yet-another-react-lightbox` reuse | Fixed overlay with arrow keys | Smaller dependency surface, but re-implements focus trap, swipe and Esc. Reuse wins; its CSS import already sits in `CompletionStepRow`. |
| Tab inside `Place` | Separate `tab` state in `ShellFrame` | Separate state forces a second `replaceState` writer and breaks the Phase 57 one-writer pins; tab-in-place keeps one. |
| Patch `SHELL_KEY` cache | Invalidate `SHELL_KEY` | Invalidating refetches the signed scene URL and swaps the image; patching does not. |

**Installation:** none. **Version verification:** versions read from `node_modules/*/package.json` on 2026-10-05; no registry lookups needed because no package is added.

## Package Legitimacy Audit

No package is installed or removed by this phase. `yet-another-react-lightbox` is already a direct dependency (`package.json:51`) in use by `src/components/activity/CompletionStepRow.tsx`.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| yet-another-react-lightbox | npm | existing dependency | n/a | existing | not run (nothing new) | Approved (already installed) |

**Packages removed due to slopcheck [SLOP] verdict:** none. **Packages flagged [SUS]:** none. The planner needs no `checkpoint:human-verify` install gate.

## Architecture Patterns

### System Architecture Diagram

```
 URL  /?place=office&tab=people                    legacy: /governance  /admin/team  /admin/access  /activity/<id>
        |                                                          |
        v                                                          v
  src/app/page.tsx  (server: parse place+tab, UUID-gate ?sop)   proxy 307 (fixed templates, cookies copied)
        |  initialPlace, initialTab, initialSop                    '--> back to  /?place=office[&tab=..]
        v
  OneScreen (client)  -- role fork ---------------------------------------------------------.
   |                                                                                         |
   | admin / safety_manager                                              supervisor / worker |
   v                                                                                         v
 dynamic(AdminShell)                                                  WorkerShell (static, page bundle)
   | getAdminShell(): floor, counts (inbox INCLUDES sign-offs)           | supervisor only:
   v                                                                     v
 ShellFrame (place+tab = ONE state; select() = only writer + replaceState)   dynamic(OfficePane) <-- same module
   |  stage: PlantStage  ResizeObserver -> replay fly(office)/fit on ANY resize (exists)
   |  detail pane width: wide(tab) ? 58% / min 560 : 400   <-- new class only
   v
 OfficePane (lazy chunk, role-aware tabs)
   |-- Inbox ----- getOfficeInbox() -> loadInbox()+listPendingSignOffs() -> deriveInbox()
   |                 row actions: setSopOwner | confirmSopCurrent | approveStep / requestChanges
   |                              signOffCompletion(+recordSignature) | requeueParse | link /admin/sops/new/blank?machine=
   |                 expand(sign-off): getCompletionForReview(id)  [session read -> RLS -> sign URLs]
   |                 each success: receipt line "... · logged in the decision ledger", patch SHELL_KEY, invalidate ['office-inbox']
   |-- Decisions -- listDecisions({kinds, cursor}) [session client, RLS] -> labels via auth admin
   |-- People ---- getTeamMembersWithEmails() (+ invited) ; inviteWorker / updateMemberRoleSafe / removeMember / assignMemberDepartments
   '-- Access ---- AdminAccessLens (unchanged) -> listAdminAccessData (unchanged)
                                 |
              recordDecision() (service role, org+actor from session)  ---> decisions (append-only, RLS read)
```

### Recommended Project Structure

```
src/
├── components/office/            # NEW, lazy chunk only (imported via next/dynamic from AdminShell + WorkerShell)
│   ├── OfficePane.tsx            #   tab bar (segmented), role -> tabs, per-tab skeleton (EditorSkeleton idiom)
│   ├── InboxTab.tsx              #   chips, rows, empty state, receipts, cleared-today
│   ├── InboxRow.tsx              #   re-homed GovernanceQueueRow branches + signoff + approve expansions
│   ├── SignOffPanel.tsx          #   steps + CompletionStepRow + reason / override fields
│   ├── ApprovePanel.tsx          #   chain so far + browse link + Approve / Send back
│   ├── DecisionsTab.tsx          #   table, kind chips, Show older
│   └── PeopleTab.tsx             #   lifted from RoleAssignmentTable (invite w/ role, Invited chip, receipts)
├── lib/shell/office-tabs.ts      # NEW plain module: OFFICE_TABS, WIDE_TABS, tabsForRole(role), isWide(place)
├── lib/governance/inbox.ts       # EXTEND: 'signoff' kind + chip; signOffs optional input
├── lib/governance/load-inbox.ts  # EXTEND: loads pending sign-offs
├── lib/decisions/read.ts         # NEW plain module: KIND_GROUPS, plain-words labels, cursor helpers (pure)
├── lib/members/labels.ts         # NEW (or fold into getOrgMembers): userId -> label (email), admin-API backed
├── actions/office.ts             # NEW 'use server': getOfficeInbox, getCompletionForReview, listDecisions
└── (deleted) app/(protected)/governance, admin/team, admin/access, activity/SupervisorActivityView,
              components/admin/org-model/{TeamViewShell,OrgChartCanvas,OrgColumnsBoard,ViewToggle}, GovernanceInbox
supabase/migrations/00073_office_ledger.sql   # kind check widen + supervisor read policy
```

`src/actions/office.ts` must not import `createAdminClient` in a way that trips the Phase 46 CR-01 guard pattern: put privileged reads (signing photo URLs, `getUserById` label lookups) in plain modules under `src/lib/` (CLAUDE.md 2026-10-04 learning), called from the action after the session read.

### Pattern 1: Tab inside the room place (one state, one writer)

**What:** `Place = ... | { kind: 'room'; id: RoomId; tab?: OfficeTab }`. `parsePlace(token, tab?)` whitelists the tab (`inbox|decisions|people|access`, anything else dropped); `formatPlace` emits `/?place=office&tab=people` (inbox is the default and omits the tab); `placeToken` still returns `office` so `focusHref(..., { from: 'office' })` and `backHref` keep working (Back from the focus screen lands on the Office inbox).
**When:** always. A tab the role may not see is resolved to the default inbox in `resolvePlace` (render time, never a redirect), same idiom as "edit without rights is the overview" (`ShellFrame.tsx:60-70`).
**Example:**
```ts
// src/lib/shell/office-tabs.ts (plain module)
export const OFFICE_TABS = ['inbox', 'decisions', 'people', 'access'] as const
export type OfficeTab = (typeof OFFICE_TABS)[number]
export const WIDE_TABS: ReadonlyArray<OfficeTab> = ['decisions', 'people', 'access']
export const tabsForRole = (role: string | null): OfficeTab[] =>
  role === 'admin' || role === 'safety_manager' ? [...OFFICE_TABS] : role === 'supervisor' ? ['inbox', 'decisions'] : []
```
`ShellFrame` adds one derived value and a conditional class (keep the literal `lg:w-100` in the file for the 57 pin):
```tsx
const wide = effective.kind === 'room' && effective.id === 'office' && !!effective.tab && WIDE_TABS.includes(effective.tab)
// className: `... ${wide ? 'lg:w-[58%] lg:min-w-140' : 'lg:w-100'} ...`
```
`[58%]` is a percentage, not a pixel arbitrary value, so `tests/lint/design-tokens.spec.ts` (`PX_UTIL` bans only `[Npx]`) allows it; `min-w-140` is on the numeric scale (35rem = 560px). After the change grep `.next/static/css/*.css` for both class names (CLAUDE.md 2026-09-28: a utility that compiles to nothing is invisible to every gate).

### Pattern 2: The refit already exists; do not rebuild it

`PlantStage` observes its container and replays the last camera intent on any resize (`PlantStage.tsx:238-267`): `fit()` / `flyTo(id)` / `fitMachines(ids)` recorded in `focusRef`, and `fitView` returns `null` for a 0×0 stage so the hidden case is a no-op. `ShellFrame`'s camera effect depends on `placeKey`, which now includes the tab, so switching tab re-flies to the Office once more. SHL-06's "re-centres" is therefore: the width class, plus an assertion that `data-scale`/`data-x` on `plant-world` change when the pane widens (the eval already exposes `data-scale`, `data-x`, `data-y`).

### Pattern 3: One lazy module, two seams

Admins mount the Office pane inside the already-lazy `AdminShell`. Supervisors use the static `WorkerShell`, which is inside the `/` bundle gate (`.bundle-baseline.json` `/page` = 831 KB, +2 KB tolerance; history in the file shows the Phase 57 decision). Give `WorkerShell` a second `next/dynamic(() => import('@/components/office/OfficePane'), { ssr: false })` used only when `place.id === 'office' && isSupervisor`, and add to `scripts/check-bundle-size.ts` `/page` a forbidden-marker group with a string literal that exists only in the pane ("Nothing needs you. That's the goal." is ideal: it must also be found elsewhere in the build for the marker self-validation, and it will be, in the lazy chunk). Constraints from `tests/lint/no-static-admin-lens-import.spec.ts`: the worker shell files (`OneScreen`, `ShellFrame`, `WorkerShell`, `RoomBodies`, `SiteSummary`, `OfficeCard`, `AccountControl`) must not contain the tokens `GovernanceQueueRow`, `WiringPatchBayShell`, `AdminAccessLens`, `@/actions/governance`, `@/actions/org-model`, `@/actions/grants`, `@/actions/admin-sop-list`, `@/lib/sop/admin-health` (a comment counts: it is `src.includes`). The `GovernanceQueueRow` allow-list entry points at `GovernanceInbox.tsx`, which is deleted: repoint it to the new row file in the same commit.

### Pattern 4: Inbox data flow, counts that cannot disagree

`loadInbox()` stays the one read. Add `listPendingSignOffs()` (session client, self-guarded: role in `supervisor|safety_manager|admin`, rows `status = 'pending_sign_off'`, `worker_id <> me`, joined to `sops(title, version)`; RLS scopes supervisors to assigned workers and admins to the org) and feed `deriveInbox({ governance, library, machines, links, signOffs })`. New `InboxItem.kind = 'signoff'`, chip `signoff` (label "Sign-off"), severity `warn`, `signOff` payload `{ completionId, sopId, sopTitle, sopVersion, workerId, submittedAt, photoCount }`. `INBOX_CHIPS` order becomes All · No owner · Overdue · Approve · Sign-off · Stuck · Machines; `tests/phase54/governance-inbox.spec.ts:241` pins the six-key order and must change in the same commit. Supervisor `getOfficeInbox()` returns the sign-off items only. The supervisor Office pin keeps `usePendingSignOffCount` (same RLS-scoped count) so it equals the supervisor's inbox length by construction; add the `worker_id <> me` filter to that query too (`useCompletions.ts:228-245`) or the pin and list disagree.

"Cleared today" (D-05): `select count(*) from decisions where created_at >= start-of-day Pacific/Auckland and kind in ('sign_off','reject','approve','owner_change','review')` through the session client (RLS gives admin / safety manager / supervisor-with-F-12). `approve` / `reject` are also written by AI proposal accept / reject (`ai-fields.ts`), so add `actor_kind = 'person'` and accept the small over-count; do not build a table for it.

### Pattern 5: Row action, receipt, cache patch

Each action returns `{ success: true, logged: boolean }` (add `logged` to `setSopOwner`, `confirmSopCurrent`, `signOffCompletion`, `approveStep`, `requestChanges` and the three people writers: `recordDecision` is fail-soft and returns `{ ok }`, so the UI can only truthfully say "logged in the decision ledger" when `ok` is true). On success the row shows a one-line receipt in the pane ("Signed off · logged in the decision ledger", `role="status"`), the item is removed, `['office-inbox']` is invalidated, `SHELL_KEY` is patched. Do not remove optimistically when the row may keep another flag: an unowned + overdue SOP becomes a "Mark reviewed" row after "Assign owner". Refetch decides; the receipt confirms.

### Pattern 6: Decisions tab read

`listDecisions({ group, cursor })` is a session-client read (RLS, no service role for the read itself): `.from('decisions').select('id, kind, actor_kind, actor_id, actor_name, subject_kind, subject_id, sop_id, summary, created_at').order('created_at', { ascending: false }).order('id', { ascending: false }).limit(51)`; the 51st row only signals "Show older". Cursor = the last row's `(created_at, id)` applied as `.or('created_at.lt.<t>,and(created_at.eq.<t>,id.lt.<id>)')`. Both indexes exist (`decisions_org_created_idx`, `decisions_org_kind_created_idx`). Kind filter = `.in('kind', KIND_GROUPS[group])` with the grouping in a plain module (`lib/decisions/read.ts`) so a spec can assert every `DECISION_KINDS` value is in exactly one group. Resolve SOP titles with one `.in('id', sopIds)` read on `sops` (RLS) and person labels with the F-07 resolver; `actor_name` already holds the actor's email at write time for person rows and the agent's name for agent rows (`shape.ts`), so "who" needs no lookup. Absolute date on hover: format with `timeZone: 'Pacific/Auckland'` (the repo's fixed-zone idiom, `CompletionDetailClient.tsx:67-75`).

### Pattern 7: Access mounts as-is

`AdminAccessLens` is a `'use client'` component taking only `pinnedSopId?`, fetching through `listAdminAccessData` with `useQuery` and a 4-bar skeleton; the page wrapper only supplies a title (`admin/access/page.tsx`). Mount it in the pane with `pinnedSopId` seeded from `?sop=` (UUID-gated in `page.tsx`, same regex the page uses). Its only link out is `SelectionStrip`'s `openInLibraryHref`: check that target in the plan (grep showed no `/admin/` literal; it is a prop). The allow-list in `no-static-admin-lens-import.spec.ts` for `WiringPatchBayShell` stays (`AdminAccessLens.tsx` still imports it). Do not restyle; the pane may be given `overflow-x-auto` for a screen narrower than the wiring needs.

### Anti-Patterns to Avoid

- **Widening `requireAdmin()` on approve/send-back for supervisors.** Not a re-home; see F-06.
- **A client `useEffect` + `router.replace` for any legacy address** (CLAUDE.md 2026-09-29). Proxy or server component only.
- **`router.refresh()` from the pane** (F-09).
- **Re-deriving "who may act" in the UI.** The row shows a button; the server action decides (`GovernanceQueueRow` header, APR-03/04).
- **Reading photos with the admin client by completion id from the URL** (F-05).
- **Quoting a forbidden literal in a comment** next to a source-contract guard (CLAUDE.md 2026-09-28): describe in words.
- **Re-capturing `.bundle-baseline.json`** (CLAUDE.md 2026-09-13). The baseline is a decision artefact; the pane's code is lazy so `/` should read Δ 0.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Photo thumbnails + full-screen lightbox | A fixed overlay | `CompletionStepRow` (already thumbnails + `yet-another-react-lightbox`, signed URLs in props) | Focus trap, swipe, arrows, Esc done; one consumer left after the page is deleted |
| Owner picker | A second picker | `OwnerPicker` (swap `router.refresh()` for `onDone`) | Existing `setSopOwner` org-member check (T-28-03-01) |
| Next approver / "is it my turn" | Comparison in the UI | `resolveNextStepIndex` + `stepMatchesCaller` (`lib/governance/approvals.ts`), server-side in `approveStep` | Single source of truth, Phase 29 D29-04 |
| Publish on final approval | Inline status flip | `performPublish` via `approveStep` (unchanged) | `tests/phase56/publish-gate-pin.spec.ts` pins the gate hash; do not touch `assertPublishGates` |
| Ledger writes | `insert into decisions` | `recordDecision()` | Only writer; org and actor from session; the Phase 56 sweep fails on any other writer |
| Member list, roles, departments picker | New people UI | `RoleAssignmentTable` body (`DepartmentPicker`, `DChip`, confirm bar, role select, remove) | 571 lines of working, guarded behaviour; reshape and re-token, do not rewrite |
| Parse retry | New retry endpoint | `requeueParse(sopId, isVideo)` in `src/hooks/useParseJob.ts` (calls `reparseSop` then the parse / transcribe route) | Refuses published SOPs, checks the source file exists, org-scoped. `ai_prompt` SOPs cannot be retried (`ParseProgress` `canRetry`): show "Open" for those |
| Relative / absolute dates | New formatter | Existing `formatNZDateTime` idiom (fixed `Pacific/Auckland`) | Avoids React #418 class |
| Assessor status | A second predicate | `isSignedOffAssessor` from `lib/competency/assessor` | Same call the old page and the action make |

**Key insight:** every one of the Office's verbs already exists as a guarded server action. The work is the read side (three new reads), the labels, the guards that were quietly UI-only, and deleting what the Office replaces. New write paths are an accident to avoid.

## Deletion Inventory (item 8)

Follow the Phase 57/58 idiom: one `tests/phase59/repoint-inventory.spec.ts` (RETIRED tokens with owning plan + INVENTORY of every test file referencing them + `LIVE_PLANS`), one `tests/phase59/retirement-sweep.spec.ts` (negative assertions that quote the retired literals; the inventory walk excludes `tests/phase59/`), `scripts/dropped-features.json` entries, `journeys.ts`, `src/lib/uat/tests.ts`, matrix, all in the same commits.

**Dropped-features guard shape:** entries are `file` / `dir` / `route-page` kinds only (58-16 deliberately avoided `symbol` patterns because the phase58 specs quote retired tokens and would trip the Phase 55 scan). Add `office-pages` (phase 59): `route-page` for `/governance`, `/admin/team`, `/admin/access` (`dir` + `ref`), `file` for `GovernanceInbox.tsx`, `SupervisorActivityView.tsx`, `TeamViewShell.tsx`, `OrgChartCanvas.tsx`, `OrgColumnsBoard.tsx`, `ViewToggle.tsx`, `ActivityFilter.tsx`, `CompletionSummaryCard.tsx`, `RejectReasonSheet.tsx` (after the lift; check each for a remaining importer first).

**Source to delete (verified importers by grep):**

| Path | Notes |
|------|-------|
| `src/app/(protected)/governance/page.tsx` | page; `loadInbox`, `deriveInbox` re-homed |
| `src/components/admin/governance/GovernanceInbox.tsx` | wrapper; chips + empty state logic moves into `InboxTab` |
| `src/app/(protected)/admin/team/page.tsx` | |
| `src/app/(protected)/admin/access/page.tsx` | page only; lens stays |
| `src/components/admin/org-model/{TeamViewShell,OrgChartCanvas,OrgColumnsBoard,ViewToggle}.tsx` | `PersonPanel.tsx` stays (used by `TrainingMatrixView` consumers, F-14) |
| `src/actions/org-model.ts` mutating exports | keep `listOrgTree` (`admin-access-view.ts:62`); other exports have only the two canvases as callers |
| `src/app/(protected)/activity/SupervisorActivityView.tsx` | `activity/page.tsx` then renders `WorkerActivityView` for EVERY role (their own record) |
| `src/app/(protected)/activity/[completionId]/CompletionDetailClient.tsx` supervisor half | keep the page as the completion's OWNER view; non-owners go to `/?place=office` (server `redirect`, not a client effect). `ActivityFilter`, `CompletionSummaryCard` only serve the supervisor view |
| `src/components/shell/AdminRoomBodies.tsx` `AdminOfficeBody` | replaced by the pane; `RoomBodies.tsx` `OfficeWorkerBody` keeps the worker card but its supervisor branch and "Open sign-offs → /activity" link go (supervisors get the pane) |

**Redirects (proxy, `middleware.ts:63-84` extended):** `/governance` → `/?place=office`; `/admin/team` → `/?place=office&tab=people`; `/admin/access[?sop=<uuid>]` → `/?place=office&tab=access[&sop=<uuid>]`; the existing `/sops?view=attention` destination changes from `/governance` to `/?place=office`; `/sops?view=access[&sop=]` destination from `/admin/access` to the new address; `/governance?view=library` already goes to `/`. Keep the UUID gate and the cookie copy (`response.cookies.getAll().forEach(...)`). The `/activity/<id>` supervisor case is a server `redirect()` in the page (role from `getSessionContext`, authoritative) rather than a proxy rule; the proxy only has the JWT `user_role` claim, which is stale after a role change until refresh. Unauthenticated hits to a deleted address already go to login with `?next=` first, then redirect: acceptable.

**`src/` references to repoint:** `place.ts:65` (`placeForPath` list: drop `/governance`, `/admin/team`, `/admin/access` from the Office group; keep `/admin/settings`; `tests/phase57/place.spec.ts:56` pins this), `AdminRoomBodies.tsx` links, `GovernanceQueueRow.tsx:127` (`/admin/sops/${id}/assign` survives until Phase 60), `inbox.ts:132` machine row action (`/admin/sops/new` → `/admin/sops/new/blank?machine=<id>`), comments in `AdminAccessLens.tsx`, `WiringPatchBay.tsx:46`, `sub-trades.ts:6`, `SubTradePicker.tsx:8` that name `/admin/team` (comments only, but `no-dead-internal-hrefs` and the sweep read comment-stripped code; still tidy).

**Tests referencing the deleted surfaces** (grep of `tests/`, ~55 files). Owning-plan buckets for the inventory:
- Rewrite or delete (subject is gone): `tests/phase54/governance-inbox.spec.ts` (GOV_PAGE, GOV_INBOX_COMPONENT paths; keep the `deriveInbox` unit cases, they are valid), `tests/phase54/inbox-reuses-governance-gating.spec.ts`, `tests/phase54/deletion-sweep.spec.ts` (asserts `/sops?view=attention` → `/governance`), `tests/phase57/retirement-sweep.spec.ts` (lines 54-86 assert `/governance` survives and the Access bridge page exists), `tests/phase57/machine-body.spec.ts:77-79` (Office links), `tests/phase57/one-query.spec.ts:15,31` (governance page + `getAdminShell` import the same `loadInbox`), `tests/phase57/place.spec.ts:56`, `tests/phase57/departments.spec.ts:198`, `tests/phase32/org-chart-build.spec.ts`, `tests/e2e/sub-trade-assignment.spec.ts`, `tests/phase43/dead-controls.spec.ts` (ViewToggle), `tests/phase30/governance-fold.spec.ts`, `tests/phase30/admin-nav.spec.ts`, `tests/phase28/{governance-queue,library-and-worker,governance-modules}.spec.ts`, `tests/phase29/{phase-gate,approval-chain-editor,queue-approve-action}.spec.ts`.
- Repoint a path or literal (subject lives on): `tests/phase37/assessor-ui-signoff.spec.ts` (reads `CompletionDetailClient.tsx`; the gate copy moves to `SignOffPanel`), `tests/phase37/assessor-ui-observation.spec.ts`, `tests/phase34/*`, `tests/phase35/training-record.spec.ts`, `tests/lint/no-static-admin-lens-import.spec.ts`, `tests/lint/design-tokens.spec.ts` (names `components/admin/org-model`), `tests/phase56/decision-writers-sweep.spec.ts`, `tests/phase46/capability-matrix-doc.spec.ts` (pins the labels "Governance queue", "Approval chains", "Manage team", "Sign off completion": do not rename those rows, edit their cells), `tests/phase58/*` references.
- Evals: `tests/evals/governance.eval.ts` (cases A, C, D, E use `/governance`), `one-screen.eval.ts` (lines ~264 bridge, 310 supervisor Office, 343-355 Office count vs governance page, 442-465 retired URL list), `sop-ledger.eval.ts` case E (`/governance`, `/activity/<id>`), `cut-features.eval.ts` (the admin sign-off test visits `/activity` and `/activity/<id>`), `dead-surface.eval.ts` (legacy governance links).

## Common Pitfalls

### Pitfall 1: The expanded Sign off row loses the assessor and override flows (F-03)
**What goes wrong:** Row ships with "Sign off / Reject"; a supervisor who is not an assessor gets a raw `NOT_SIGNED_OFF_ASSESSOR` string; an admin cannot approve at all (`ASSESSOR_OVERRIDE_REQUIRED`) because no field sends `overrideReason`.
**Why it happens:** D-06 describes the happy path; the gate lives in 120 lines of the page being deleted.
**How to avoid:** Lift the copy and logic (F-03 list). Eval: admin approves via override with a reason and sees the receipt; non-assessor supervisor sees the teaching copy and can still reject.
**Warning signs:** `signOffCompletion` called with no `overrideReason` anywhere in the pane; the string `ASSESSOR_OVERRIDE_REQUIRED` absent from `src/components/office`.

### Pitfall 2: Counts that disagree (F-01, F-02)
**What goes wrong:** Pin says 3, tab says 4; or a cleared row leaves the tab but the pin stays for 30 minutes.
**How to avoid:** One `deriveInbox`; patch `SHELL_KEY`; spec asserts the Office pin and the inbox open count are equal after an action (eval). The supervisor pin equals its list because both are RLS-scoped with `worker_id <> me`.

### Pitfall 3: A rejected completion still counts as done (D-06 "planner confirms")
**Confirmed broken.** `useWorkerSops.ts:72-93` selects `sop_id, submitted_at` for every completion of the worker with no status filter and feeds `lastCompletedAt` (`worker-signal.ts:40,64` returns `'never'` only when it is null), the "Updated" badge and the refresher clock. Fix in this phase: `.neq('status', 'rejected')` on that query (keep pending: the worker did the work, it awaits a decision). Also check `src/actions/competency.ts` for a completion read that should skip rejected rows (grep found no status handling; competency may count them: Open Question O6, LOW). Add a spec asserting the filter and an eval second-iteration (a rejected walk re-shows "never done" for the worker).

### Pitfall 4: Esc leaves the Office while a lightbox or dialog is open
**What goes wrong:** `ShellFrame` listens for Escape on `window` (`ShellFrame.tsx:114-122`) and ignores only typing targets. The lightbox is a portal with `role="dialog" aria-modal="true"` (`yet-another-react-lightbox/dist/index.js:1517`); whether its Esc also reaches `window` was not proven here. `[ASSUMED]` it does.
**How to avoid:** In the shell handler also return early when `e.defaultPrevented` or when an `[aria-modal="true"]` element exists; give the pane's own confirm dialogs `role="dialog" aria-modal="true"`. Eval step: open a photo, press Esc, assert the lightbox closes and `shell-detail` still has `data-place="office"`.

### Pitfall 5: Admin chunk leaks into `/` (bundle gate)
**What goes wrong:** The pane or `yet-another-react-lightbox` CSS gets a static import path from `WorkerShell`, `/` moves past 831 +2 KB.
**How to avoid:** Only `dynamic()` imports; add the forbidden marker; run `npm run build` in every plan that touches the shell (CLAUDE.md 2026-09-29). If the gate moves, print the summed file list and diff it before touching code or baseline (CLAUDE.md 2026-10-05).

### Pitfall 6: Client-trusted parameters in new reads/actions
**What goes wrong:** `getCompletionForReview(completionId)` or `listDecisions` accept an org id, a worker id or a role from the client.
**How to avoid:** Org, role and actor come from `getSessionContext()` only; the completion id is the only client input and is validated as a UUID; the visibility decision is RLS on the session client. Same for `inviteWorker`'s role (zod enum, server-checked against the caller's role).

### Pitfall 7: Evals that assume a fixture count
**What goes wrong:** Office eval asserts "exactly N rows" while `governance.eval.ts` (EVAL Oven, an unowned plant SOP) and the 56/58 evals write to the same eval-site org (CLAUDE.md 2026-09-29).
**How to avoid:** Assert the specific row by title / completion id; use the `SLOW` timeout after any `goto` into a lazy pane; match owner picker items by the real label now that F-07 gives emails (the old `role (uuid8)` text changes: `governance.eval.ts` cases that click a picker item by that text must be rewritten, not patched).

### Pitfall 8: Source-contract guards that fail on the comment quoting the literal
Any new spec that forbids a literal (`router.refresh`, `/governance`, `createAdminClient`) will trip on a comment that names it. Describe in words; use the `stripComments` helper idiom from `tests/phase56/decision-writers-sweep.spec.ts`.

### Pitfall 9: Decision writer sweep discovers writers you did not register
Adding `organisation_members` to `scripts/decision-writers.json` `tables` makes the sweep discover EVERY write on it, not only the three the CONTEXT names: `auth.ts` has inserts in `joinWithInviteCode` (`:106`) and `acceptInvite` (`:212`) as well as `updateMemberRole`, `updateMemberRoleSafe`, `removeMember`, `addMemberByEmail`. Register `updateMemberRoleSafe` (`role_change`), `removeMember` (`member_removed`), `addMemberByEmail` (`member_invited`); `inviteWorker` writes no table (it calls the auth admin API), so register it under `extraHooks` with anchor `inviteUserByEmail(`; add `allow` entries with reasons for `joinWithInviteCode` (self-join by code, the code is the authorisation) and `acceptInvite` (completes an invite already logged). Delete `updateMemberRole` (no caller). Append every new key to `LIVE_WRITERS` in `tests/phase56/decision-writers-sweep.spec.ts`, and extend the `samples()` record in `tests/phase56/decision-kinds-live.spec.ts` (it is `Record<DecisionKind, DecisionInput>`, so `tsc` fails until the three new kinds have a longest-realistic-summary sample). Capture the target's user id BEFORE `removeMember` deletes the row.

### Pitfall 10: Ledger summaries carry free text or emails
`shape.ts` says summaries are plain words from literals and enums only; free text goes in `details`. Role and member rows: summary "Changed a person's role", details `{ from, to }`, subject `{ kind: 'member', id: user_id }`. Do not put an email in a summary or details: the ledger cannot be edited or erased, and the email is already recoverable from the id.

### Pitfall 11: `sop_completions` is append-only and `signOffCompletion` is not retry-safe
The ledger row is written before the status update (`completions.ts:280-304`); a failed update leaves a pending completion with a sign-off row and a ledger row, and a retry inserts a second `completion_sign_offs` row. Out of scope to redesign, but the pane must disable the buttons while pending and treat the "Sign-off recorded but status update failed" error as non-retryable text.

## Code Examples

### Role-aware tab resolution in render (never a redirect)
```ts
// ShellFrame resolvePlace(): an Office tab the role may not see is the inbox.
if (place.kind === 'room' && place.id === 'office' && place.tab && !ctx.officeTabs.includes(place.tab)) {
  return { kind: 'room', id: 'office' }
}
```

### Session-read-then-sign (completion review, F-05)
```ts
// src/actions/office.ts ('use server'); URL signing lives in a plain src/lib module
const { supabase, userId, role, organisationId } = await getSessionContext()
// RLS (00010) decides visibility: supervisors see assigned workers' rows, admins the org.
const { data: row } = await supabase
  .from('sop_completions')
  .select('id, sop_id, worker_id, sop_version, status, submitted_at, step_data, sops(title), completion_photos(id, step_id, storage_path, content_type), completion_sign_offs(id)')
  .eq('id', completionId) // UUID-validated
  .maybeSingle()
if (!row) return { error: 'Completion not found' }
const photos = await signCompletionPhotos(row.completion_photos) // plain module, admin client, paths from the RLS-visible row only
```

### Additive migration (00073)
```sql
-- Phase 59: three governance kinds, and supervisors may read the ledger (D-03).
alter table public.decisions drop constraint if exists decisions_kind_check;
alter table public.decisions add constraint decisions_kind_check check (kind in (
  'approve','reject','sign_off','countersign','assign','unassign','publish',
  'owner_change','review','observation','verify','verify_withdrawn',
  'ai_finding_cleared','cadence_change','ai_field_write',
  'role_change','member_invited','member_removed'));
drop policy if exists "admins_can_read_decisions" on public.decisions;
create policy "staff_can_read_decisions" on public.decisions for select to authenticated
  using (organisation_id = public.current_organisation_id()
         and public.current_user_role() in ('admin','safety_manager','supervisor'));
```
`decisions_kind_check` is Postgres' default name for the inline column check in `00070` (`<table>_<column>_check`) `[ASSUMED]`; confirm with `select conname from pg_constraint where conrelid = 'public.decisions'::regclass` via the Management API before writing the drop. The append-only triggers fire on UPDATE / DELETE / TRUNCATE rows, not on `ALTER TABLE`, so DDL is unaffected. `tests/lint/rls-org-scope.spec.ts` parses every migration in order: the new policy keeps the org conjunct. Apply order and the stale-history trap: run `supabase migration list` before `db push` (CLAUDE.md 2026-10-04 `00068` refusal); last applied is `00072`.

### Mirror `DECISION_KINDS`
`src/lib/decisions/shape.ts` carries the list "mirrors the kind CHECK"; add the three kinds there and a spec asserting the migration text and the array agree.

## Runtime State Inventory

Not a rename/migration phase, but it deletes addresses and widens a constraint. Explicit answers:

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | `decisions` rows (append-only): existing kinds unaffected; new kinds appear only from this phase on. `worker_notifications` rows of type `completion_rejected` exist (created by reject); no change. No data holds the deleted route strings except `uat_feedback` rows keyed by test id (CLAUDE.md 58-16: untouched). | Code edit only (migration widens a check). No data migration. |
| Live service config | Supabase Auth invite emails already sent carry `redirectTo = /invite/accept` (unchanged). Railway has no route config for these paths. | None. |
| OS-registered state | None. | None, verified: no scheduler or PM2 entry names these routes (Railway-only project). |
| Secrets / env vars | None renamed. Reads need `SUPABASE_SERVICE_ROLE_KEY` (already used). | None. |
| Build artifacts | `.next` carries compiled routes for the deleted pages until rebuilt; `.bundle-baseline.json` untouched by design. | Rebuild; do not recapture the baseline. |
| Bookmarks / external links | Users may have `/governance`, `/admin/team`, `/admin/access?sop=` and `/activity/<id>` bookmarked or in notifications. | Proxy redirects (above) and an eval asserting each lands on the Office. |

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | build, specs | yes | v22.16.0 | none needed |
| Playwright | specs, evals | yes | 1.58.2 | none needed |
| Supabase CLI (`node_modules/.bin/supabase`) | `00073` push | yes | optionalDependency | Management API `POST /v1/projects/{ref}/database/query` with `SUPABASE_ACCESS_TOKEN` (CLAUDE.md 2026-06-15) |
| `.env.local` (service key, URL, anon) | evals, live probes | yes (file present; values not read) | n/a | none |
| Railway deploy of `master` | deployed eval `npm run eval -- --phase 59` | yes (project convention; push after commit) | n/a | none |
| Eval fixtures (`eval-site-admin`, `eval-site-supervisor`, `eval-site-worker`) | office eval | provisioned by `node scripts/eval-fixtures.mjs` | n/a | the script is idempotent |
| `supervisor_assignments` row (supervisor -> worker) in the eval-site org | supervisor sign-off cases | NOT provisioned (no match in `eval-fixtures.mjs`) | n/a | seed with the service key in the eval's `beforeAll`, delete in `afterAll` |

**Missing with no fallback:** none. **Missing with fallback:** the supervisor assignment fixture (add to `scripts/eval-fixtures.mjs` idempotently, or seed in the eval).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Playwright 1.58.2 (source-contract + pure-module specs; deployed evals) |
| Config file | `playwright.config.ts` (projects `phase54`..`phase58`, `evals`, `phase15-stubs` for `tests/lint/*`) |
| New project | `phase59`: `testDir: '.'`, `testMatch: /tests\/phase59\/.*\.(spec|test)\.ts$/` (deliberately broad, CLAUDE.md 2026-05-25; verify with `npx playwright test --list --project=phase59`) |
| Quick run command | `npx playwright test --project=phase59` |
| Full phase gate | `npx tsc --noEmit` then `npm run build` (bundle gate) then `npx playwright test --project=phase54 --project=phase56 --project=phase57 --project=phase58 --project=phase59 --project=phase15-stubs --project=phase41 --project=phase30 --project=phase28 --project=phase29 --project=phase32 --project=phase37` once, then `npm run eval -- --phase 59` once after push |

Live-DB probes (phase33/34/35/37/46/51, `PHASE56_LIVE=1`) share one OTP budget: do not loop them (CLAUDE.md 2026-09-28). The researcher ran none.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SHL-06 | Tab in `Place` parses/formats, unknown tab dropped, role gate, `isWide` only for decisions/people/access | unit (pure) | `npx playwright test --project=phase59 -g "place tab"` | Wave 0 `tests/phase59/place-tab.spec.ts` |
| SHL-06 | `ShellFrame` keeps `lg:w-100`, adds `lg:w-[58%] lg:min-w-140`, one `setPlace(`, one `replaceState`, `PlantStage` still has the `ResizeObserver` replay | source-contract | `... -g "shell wide"` | Wave 0 `shell-wide.spec.ts`; repoint `tests/phase57/shell-structure.spec.ts` pin |
| SHL-06 | Deployed: pane width at 1440 for each tab, `plant-world` `data-x/data-scale` change on widen, Esc returns and refits | eval | `npm run eval -- --phase 59` | Wave 0 `tests/evals/office.eval.ts` |
| OFF-01 | `deriveInbox` adds `signoff` rows, chips, counts, empty = 0; legacy call shapes still valid | unit | `... -g "inbox model"` | Wave 0 `inbox-model.spec.ts`; edit `tests/phase54/governance-inbox.spec.ts:241` |
| OFF-01 | One lazy module; worker/supervisor shell files carry no static admin import; forbidden marker present and self-validating | source-contract + build | `... -g "pane structure"` and `npm run build` | Wave 0 `office-pane-structure.spec.ts`; edit `tests/lint/no-static-admin-lens-import.spec.ts` |
| OFF-01 | Deployed: opens on inbox, one button per row, receipt line, row leaves, pin patched, empty state text | eval | eval | Wave 0 |
| OFF-02 | `getCompletionForReview` reads via session client then signs; refuses non-visible; excludes own walk; `signOffCompletion` refuses self sign-off; countersign still written | source-contract + unit | `... -g "signoff actions"` | Wave 0 `signoff-actions.spec.ts` |
| OFF-02 | Row reproduces assessor teaching copy, override field (admin), reject reason >= 10 | source-contract | same | Wave 0 |
| OFF-02 | Rejected completion not counted as done (`lastCompletionMap` filter) | source-contract | `... -g "rejected not done"` | Wave 0 `signoff-actions.spec.ts` |
| OFF-02 | Deployed: admin override sign-off with photo lightbox; supervisor non-assessor reject; second iteration (two completions, no stale panel) | eval | eval | Wave 0 |
| OFF-03 | `requestChanges` has a caller in `src/components/office`; `approveStep`/`requestChanges`/`getApprovalStatus` guards unchanged (`requireAdmin`); `assertPublishGates` untouched (`publish-gate-pin` hash) | source-contract | `... -g "approve actions"` and `--project=phase56 -g "publish gate"` | Wave 0 `approve-actions.spec.ts` |
| OFF-04 | `AdminSopRows` meta line format; Workshop drafts carry owner + review; inbox rows carry it; `getOrgMembers` returns labels not `role (uuid)`; `confirmSopCurrent` owner path (if O1 = yes) | unit + source-contract | `... -g "owner review meta"` | Wave 0 `owner-review-meta.spec.ts` |
| OFF-05 | `inviteWorker` admin guard + role enum + admin-only `admin` grant; `updateMemberRoleSafe` zero-row error; invited list from auth users; three writers registered | source-contract | `... -g "people actions"` and `--project=phase56 -g "decision writers"` | Wave 0 `people-actions.spec.ts`; edit `scripts/decision-writers.json`, sweep `LIVE_WRITERS` |
| OFF-06 | `AdminAccessLens.tsx` and `WiringPatchBayShell` import allow-list unchanged (git-diff-empty proof recorded in the plan summary); pane mounts it with UUID-gated `pinnedSopId` | source-contract | `... -g "access mount"` | Wave 0 `access-mount.spec.ts` |
| DEC-02 | `KIND_GROUPS` partition `DECISION_KINDS` exactly; `listDecisions` orders `created_at desc, id desc`, 51-row page, cursor; `DECISION_KINDS` equals migration list | unit + source-contract | `... -g "ledger read"` | Wave 0 `ledger-read.spec.ts` |
| DEC-02 | Per-role RLS runtime probe (worker 0, supervisor same-org rows, cross-org 0): behind `PHASE59_LIVE=1`, service key + minted sessions, run once | live probe (gated) | `PHASE59_LIVE=1 npx playwright test --project=phase59 -g "ledger rls"` | Wave 0 `ledger-rls-live.spec.ts` (self-skips) |
| D-13 | Deleted files absent; no `src/` or `tests/` reference to the retired addresses (anchored regex so `@/` imports are not false positives); proxy redirect literals; `placeForPath`; `dropped-features.json` entries | source-contract | `... -g "retire"` | Wave 0 `retirement-sweep.spec.ts`, `repoint-inventory.spec.ts` |
| Matrix | New rows for each Office tab × role; drift cells fixed (F-06) | source-contract | `... -g "capability matrix"` | Wave 0 `capability-matrix.spec.ts` |

### Deployed eval `tests/evals/office.eval.ts` (replaces `governance.eval.ts`)

Case list (each `watchConsole`, `SLOW` timeouts after every `goto`, screenshots read before pass, per CLAUDE.md):
1. Admin lands on Office inbox: tabs, count equals pin, unowned fixture row has **Assign owner**; assign clears it (by title, not by count), receipt text ends "logged in the decision ledger".
2. Empty-state: after clearing the fixture rows the pane reads "Nothing needs you. That's the goal." with a cleared-today number (assert on the sentence, not on zero rows: shared org).
3. Sign-off: seed a pending completion + 1 photo (service key, tiny PNG upload) for the eval-site worker; admin expands, sees the thumbnail load (`naturalWidth > 0`), opens the lightbox, Esc closes the lightbox only, override reason enables Sign off, row leaves, pin patched.
4. Reject with reason; worker session then sees the SOP as not done (second iteration, CLAUDE.md 2026-10-03).
5. Supervisor (needs `supervisor_assignments` seed): sees only sign-off rows, no People / Access tabs, `?tab=people` falls back to inbox; non-assessor sees teaching copy, reject works.
6. Approve / send back on a pending-approval SOP (needs a chain fixture; seed `approval_chains` + a pending SOP via service key, remove after).
7. Decisions tab: wide pane, newest first, a kind chip narrows, "Show older" appears only when > 50.
8. People tab: wide pane, invite with role (use an address that cannot receive mail, then verify the Invited chip; clean up the auth user), role select, department picker unchanged.
9. Access tab: the wiring screen renders in the wide pane with the map still visible (`plant-world` `data-scale` changed between narrow and wide).
10. Legacy addresses: `/governance`, `/admin/team`, `/admin/access?sop=<uuid>`, `/activity/<other's id>` all land on the right Office place (assert rendered `shell-detail[data-place]`, never the raw HTTP status: custom `not-found` serves 200, CLAUDE.md 2026-09-29).
11. Real-org read-only screenshot (`57-` style) of the Office inbox for the real org; no writes.
12. Owner / review meta line visible on a machine panel row, a Noticeboard row and a Workshop draft.

Fixture gotchas: `governance.eval.ts` mutates the plant SOP owner and adds EVAL Oven; keep that setup in the new eval or the unowned row does not exist. Completions are append-only: use `tests/evals/lib/completion-cleanup.ts` (`deleteEvalCompletions`) in `afterAll`; ledger rows from evals are permanent by design, write them only to the eval-site org (`REAL_SOPSTART_ORG_ID` guard as in `governance.eval.ts`).

### Sampling Rate

- **Per task commit:** `npx playwright test --project=phase59` (+ `npx tsc --noEmit` for any `src/` change)
- **Per wave merge:** phase59 + phase57 + phase58 + phase54 + phase56 (sweep and shape, live specs self-skip) + `phase15-stubs` (lint guards: dead hrefs, design tokens, undefined CSS tokens, admin-lens leak)
- **Per plan touching the shell or a lazy seam:** `npm run build` (bundle gate: expect `/` Δ 0 KB)
- **Phase gate:** full suite once, build, push, `npm run eval -- --phase 59` once, read every screenshot

### Wave 0 Gaps

- [ ] `tests/phase59/` stubs for every row above, registered via the new `phase59` project (`playwright.config.ts`)
- [ ] `tests/phase59/repoint-inventory.spec.ts` with the full INVENTORY above (grep `tests/` at plan time, the list here is a snapshot)
- [ ] `scripts/eval-fixtures.mjs`: idempotent `supervisor_assignments` (eval-site supervisor -> eval-site worker)
- [ ] `tests/evals/office.eval.ts` skeleton with `test.fixme` per case (58-01 idiom), flipped as plans land
- [ ] No framework install needed

## Security Domain

`security_enforcement` is absent from `.planning/config.json`, so it is treated as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (invite) | Supabase Auth admin `inviteUserByEmail`; fix F-10 (guard missing) |
| V3 Session Management | yes | `getSessionContext()` local JWT verify; role is never client input |
| V4 Access Control | yes (core of the phase) | RLS (`sop_completions`, `completion_photos`, `decisions`, `organisation_members`) + server guards (`requireAdmin`, role checks in `signOffCompletion`); matrix updated with each gate |
| V5 Input Validation | yes | zod: UUID ids, role enum, reason lengths, `?tab=` and `?sop=` whitelists (UUID regex as in `admin/access/page.tsx`) |
| V6 Cryptography | no | signed URLs only (Supabase Storage); nothing hand-rolled |
| V8 Data Protection | yes | append-only ledger: no emails or free text in summaries (Pitfall 10); signed photo URLs 1 hour, only for rows RLS returned |
| V13 API / server actions | yes | every exported action in a `'use server'` file is a POST endpoint: new actions take only ids and enums, never org / actor / role |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-tenant read of completion photos by id | Information disclosure | Session-client read first (RLS), sign only what came back; org compare against the SESSION org (CLAUDE.md 2026-07-28), F-05 |
| Supervisor reads an unassigned worker's completion | Information disclosure | RLS `supervisors_see_supervised_completions`; no admin-client read by id |
| Role escalation through invite or role change | Elevation of privilege | Admin guard on `inviteWorker`; only `admin` grants `admin`; zero-row detection on role updates (F-10, F-11) |
| Self sign-off (admin signs own walk) | Repudiation / tampering | Refuse `worker_id === userId` (F-05), `[ASSUMED]` desired |
| Forged "I am the next approver" | Spoofing | Server `stepMatchesCaller` in `approveStep` (unchanged); UI only mirrors |
| Decision row for something the system did not do | Repudiation | `recordDecision()` only; no authenticated INSERT; sweep spec fails on unregistered writers |
| Open redirect via `?tab=` / `?sop=` / `from` | Tampering | Whitelist parse; UUID-gated destinations; fixed templates in the proxy; cookies copied |
| Service-role key reaches the client | Information disclosure | New actions return plain data; photo signing and `getUserById` live in `src/lib/` plain modules, not client-importable action files |
| Formula injection if the ledger is ever exported | Tampering | Not in scope (no export); if added later, neutralise leading `= + - @` (CLAUDE.md 2026-07-24) |
| Ledger-write failure shown as success | Repudiation | `logged` flag (Pattern 5); receipt text only when `recordDecision` returned ok |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Governance as a page (`/governance`) beside the one screen | Governance is a room (detail pane) | Phase 57 contract, built 59 | Delete the page, keep the data layer |
| Supervisor review as a page of its own | Sign-off row expanded in the inbox | 59 | `/activity/<id>` stays only as the worker's own detail |
| Review lifecycle UI on the library table | `AdminSopRows` meta line everywhere | 54 -> 59 | Format + coverage change, not new data |

**Deprecated / outdated:** `updateMemberRole` (unsafe sibling with no caller after the lift); `OfficeWorkerBody`'s supervisor branch; `GovernanceQueueRow`'s `router.refresh()`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `decisions_kind_check` is the constraint name created by the inline column check in `00070` | Code Examples (migration) | Drop fails or leaves the old check in place; verify with `pg_constraint` first |
| A2 | The lightbox's Esc keydown also reaches the `window` listener in `ShellFrame` | Pitfall 4 | If it does not, the guard is harmless; if it does and is not guarded, Esc in a lightbox exits the Office |
| A3 | Blocking self sign-off (`worker_id === userId`) is desired | F-05 | Admin who walks a SOP could not sign it off themselves; ask Simon (O3) |
| A4 | People are shown by email because no name data exists (`full_name` absent in auth metadata) | F-07 | If names exist in `user_metadata`, show them first; the resolver already prefers `full_name` |
| A5 | Widening the ledger read to supervisors is acceptable (all org decisions, including role changes and owner changes, are visible to them) | F-12 | Information exposure of governance actions to supervisors; alternative is to drop the supervisor Decisions tab (O4) |
| A6 | `invited_at` plus `user_metadata.organisation_id` is a sound way to list pending invites | F-10 | An invite for a user who already existed in another org would show wrongly; `invited_at` is on the type, behaviour for re-invites unverified |

## Open Questions

1. **O1: Can a non-admin owner mark a SOP reviewed (OFF-04 says "the owner")?**
   - Known: `confirmSopCurrent` is `requireAdmin()` and the `sops` / `sop_review_events` writes ride admin-only RLS; the owner can be any org member (`setSopOwner` accepts any member); the This SOP block lives in the admin lazy chunk and is admin-only.
   - Unclear: whether a supervisor-owner needs a path.
   - Recommendation: implement the owner-or-admin guard in `confirmSopCurrent` (owner path writes with the admin client, `.eq('organisation_id', session org)` and `owner_user_id = userId` re-checked server-side, matrix row added) and show **Mark reviewed** to admins everywhere plus to the owner on the inbox row only when they have an Office (admin / safety manager / supervisor). Skip a supervisor "SOPs I own" inbox section this phase. If Simon says admins only, state that in the matrix and cut the owner path.
2. **O2: Should supervisors be able to approve chain steps?** F-06 says they cannot today and `chainStepSchema` cannot name them. Recommendation: no change; supervisor inbox is sign-offs only; fix the matrix cell. A real supervisor approver is a new capability with a publish-path question.
3. **O3: Block self sign-off?** Recommendation yes (small, safe); needs Simon's nod because admins who also walk SOPs lose a shortcut.
4. **O4: Supervisor Decisions tab needs an RLS widening (F-12).** Recommendation: do it as stated in D-03 (one policy, org conjunct, per-role probe). Fallback: admin / safety manager only and say so in the matrix.
5. **O5: The training matrix and assessment requests lose their only entry point (F-14) until Phases 60/61.** Recommendation: accept, leave components and actions unmounted, list the gap in the plan summary and `REQUIREMENTS` notes so Phase 60/61 planners pick it up. Alternative (more work): temporary links from the People tab.
6. **O6 (LOW): Does `competency.ts` count rejected completions toward competence?** No status handling found by grep. Check during the Pitfall 3 fix; if yes, it is a separate bug to log, not a Phase 59 requirement.
7. **O7: "Jane Smith" names.** No name data exists (F-07, A4). Recommendation: show email, and let `getOrgMembers` prefer `user_metadata.full_name` if a future invite flow sets it. No profiles table in this phase.

## Suggested slicing (planner's call; dependencies only)

1. **Foundations (parallel):** migration `00073` + `shape.ts` kinds + sweep registrations; `Place` tab + `office-tabs.ts` + `ShellFrame` wide class + `page.tsx` tab/sop; member-label fix in `getOrgMembers`; `useWorkerSops` rejected filter; guard fixes in `auth.ts` (F-10, F-11) and `completions.ts` (F-04, F-05).
2. **Reads:** `listPendingSignOffs` + `deriveInbox` signoff + `getOfficeInbox`; `getCompletionForReview`; `listDecisions` + `read.ts`.
3. **Pane:** `OfficePane` seam in `AdminShell` and `WorkerShell`; Inbox rows and panels; Decisions; People; Access mount; owner / review meta (`AdminSopRows`, Workshop, This SOP).
4. **Retirement:** proxy redirects, deletions, repoint inventory, dropped-features, journeys, uat tests, matrix.
5. **Eval:** author `office.eval.ts` as each pane plan lands (CLAUDE.md 2026-10-04 lesson: run a plan's eval case as soon as it deploys; the OTP budget is shared).

Every plan that edits `src/` runs `npx tsc --noEmit`; every plan that touches the shell, a lazy seam or a `'use server'` file runs `npm run build` (CLAUDE.md 2026-06-27, 2026-09-29). Server action files may export only async functions: put `KIND_GROUPS`, label maps and cursor helpers in `src/lib/`.

## Sources

### Primary (HIGH confidence): read in this session
- Source: `src/components/shell/{OneScreen,ShellFrame,AdminShell,WorkerShell,AdminRoomBodies,RoomBodies}.tsx`; `src/components/sop/plant/PlantStage.tsx:150-330`; `src/lib/shell/place.ts`; `src/app/page.tsx`; `src/lib/supabase/middleware.ts:30-112`; `src/lib/governance/{inbox,load-inbox,approvals,classify,cadences}.ts`; `src/actions/{governance,approvals,completions,auth,shell,assignments}.ts`; `src/components/admin/governance/*`; `src/components/admin/RoleAssignmentTable.tsx`; `src/components/admin/org-model/TeamViewShell.tsx`; `src/app/(protected)/{governance,admin/team,admin/access,activity}/*`; `src/hooks/{useCompletions,useWorkerSops,useParseJob,useFocusBack}.ts`; `src/lib/decisions/{record,shape}.ts`; `src/lib/sop/{admin-health,focus-path}.ts`; `src/components/sop/lenses/AdminAccessLens.tsx`; `src/components/activity/{CompletionStepRow,RejectReasonSheet}.tsx`.
- Database: `supabase/migrations/00002_rls_policies.sql`, `00010_completion_schema.sql`, `00062_org_members_update_check_org_scope.sql`, `00070_decisions_ledger.sql`; last migration `00072`.
- Tests and scripts: `tests/phase56/decision-writers-sweep.spec.ts`, `tests/phase57/shell-structure.spec.ts`, `tests/phase58/{repoint-inventory,retirement-sweep}.spec.ts`, `tests/lint/no-static-admin-lens-import.spec.ts`, `tests/lint/design-tokens.spec.ts`, `tests/evals/{governance,one-screen,cut-features,sop-ledger}.eval.ts`, `tests/evals/lib/*`, `scripts/{decision-writers.json,dropped-features.json,check-bundle-size.ts,eval-fixtures.mjs}`, `.bundle-baseline.json`, `playwright.config.ts`.
- Planning: `59-CONTEXT.md`, `REQUIREMENTS.md`, `STATE.md`, `57-CONTEXT.md`, `58-16-SUMMARY.md`, `58-18-SUMMARY.md`, `58/deferred-items.md`, `.claude/skills/sketch-findings-SOPstart/references/one-screen-site.md`, `CAPABILITY-MATRIX.md`, project and global `CLAUDE.md` (`## Learnings`).
- Installed packages: `node_modules/{next,@tanstack/react-query,@supabase/auth-js,yet-another-react-lightbox}/package.json`; `auth-js/dist/main/lib/types.d.ts:350` (`invited_at`); `yet-another-react-lightbox/dist/index.js:117-120,1517` (portal, `role="dialog"`).

### Secondary (MEDIUM): none used. No web search or Context7 lookups were needed; every claim is about this repository, and no external library behaviour is relied on beyond what the installed type files and sources show.

### Tertiary (LOW): see Assumptions Log A1, A2, A6.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH, nothing new installed; versions read from `node_modules`.
- Architecture: HIGH for shell, actions, RLS, deletion inventory (read end to end); MEDIUM for the supervisor lazy seam (pattern is established, exact bundle delta unmeasured).
- Pitfalls: HIGH for F-01..F-14 (each cites file and line); MEDIUM for Esc propagation (A2) and the constraint name (A1).

**Not done by design:** no full suite, no live-probe project, no source file modified, no deployed eval run, no live DB query (constraint name and `invited_at` re-invite behaviour stay assumptions until the plan's first task checks them).

**Research date:** 2026-10-05
**Valid until:** 2026-11-04 (stable code; re-grep the test inventory at plan time because Phase 58 follow-ups may still land)
