# Phase 59: The Office - Context

**Gathered:** 2026-10-05 (auto mode — Claude picked the recommended option for every gray area per Simon's standing "make judgment calls" rule; every pick is marked so Simon can redirect before planning)
**Status:** Ready for planning

<domain>
## Phase Boundary

The Office room becomes the one home of governance, rendered **inside the one screen's detail pane** (never a separate page). Four admin tabs — **Inbox · Decisions · People & roles · Access** — and the wide-pane rule (SHL-06). The inbox lists every thing to do as one row with one button (assign owner · mark reviewed · sign off / reject a completion with its photos · approve / send back a SOP in a chain) and empty is the goal. Every SOP an admin sees listed carries its owner and review date. Re-homes the Phase 54 inbox, Phase 28/29 owner/review/approval machinery, the team page, supervisor completion review and the Phase 32/33 access wiring. Deletes `/governance`, `/admin/team`, the org-chart views and the **supervisor** completion-review pages in this phase. Out of scope: Requests (Phase 60), notifications (60), the worker's own record and the Smoko room (61), the worker `/activity` view (stays until 61), site overview content (60).

Requirements: OFF-01..06, DEC-02, SHL-06.

</domain>

<decisions>
## Implementation Decisions

### Where the Office lives (SHL-06)
- **D-01 — The Office is the detail pane of `/?place=office`, with a `&tab=` address.** `inbox` (default) · `decisions` · `people` · `access`. Tabs are a small segmented control at the top of the pane; the Phase 57 Office card (counts + bridge links) is replaced by the tabbed body. No new route. *(auto: recommended over a `/office` route — the contract says rooms are not pages.)*
- **D-02 — Wide pane for the table tabs only.** `decisions`, `people` and `access` switch the shell grid to `256px 1fr minmax(560px, 58%)` (contract § CSS); `inbox` stays at the normal 400px. The map stays live, re-centres on the Office on every pane resize (`ResizeObserver` on the stage; guard the 0×0 hidden-stage case — contract § Interaction). Esc / Close returns to the overview and refits. *(auto: the contract names exactly which tabs are wide; the inbox is kept narrow and gets a lightbox for photos instead — see D-06.)*
- **D-03 — Role views.** Admin and Safety Manager: all four tabs. Supervisor: Inbox (only rows they can act on — their sign-offs and chain steps naming them) and Decisions (read). Worker: unchanged from Phase 57 (the reduced Office card bridging to `/activity`); "My requests" is Phase 60. Capability matrix rows for each tab × role in the same commit as the gates.

### The inbox (OFF-01, OFF-02, OFF-03)
- **D-04 — One row, one button, cleared on action.** Row kinds and their button: no owner → **Assign owner** (the existing `OwnerPicker` popover, `setSopOwner`); review overdue / due → **Mark reviewed** (`confirmSopCurrent`, owner or admin); completion awaiting sign-off → **Sign off** (expands, D-06); approval chain step naming the caller → **Approve** (expands, D-07); stuck parse → **Try again** (re-queue the job); machine with no SOP → **Write a SOP** (links the blank wizard with `?machine=`). The last two are the Phase 54 `stuck` / `machines` kinds kept because each still has exactly one action. A cleared row leaves the list without a reload (optimistic remove + `invalidateQueries`), and every action's confirmation line ends "· logged in the decision ledger".
- **D-05 — Empty state is the goal, said plainly:** "Nothing needs you. That's the goal." with the count of things cleared today beneath it (from the ledger). Chips (All · Owner · Overdue · Approve · Sign-off · Stuck · Machines) keep the Phase 54 `INBOX_CHIPS` idiom; the Office pin count stays `deriveInbox(...).length` (57 D-16) and now includes sign-off rows.
- **D-06 — Sign off from the row.** Tapping **Sign off** expands the row in place: worker, SOP title + version, when, the steps done with their acks, and the photos as a thumbnail strip (tap → full-screen lightbox, swipe/arrow between photos). Two buttons: **Sign off** (primary) and **Reject** (secondary; a note is required). Both call the existing `signOffCompletion` (already writes `sign_off` / `reject` to the ledger and sets `signed_off` / `rejected`). A rejected completion makes the SOP read as not done for that worker (planner confirms `worker-signal` treats `rejected` as not completed; if it does not, fix it in this phase). No separate review page survives for supervisors.
- **D-07 — Approve from the row.** **Approve** expands to: SOP title + version, who already approved (the chain so far), a one-line link to **open it in browse state** (`focusHref(id, { from: 'office' })`) so the approver can read it, then **Approve** (primary) / **Send back** (secondary; note required → the existing `requestChanges`, which regains a caller here). Final approval triggers the existing publish path unchanged (`performPublish` + `assertPublishGates()` — never weakened).

### Owner and review date everywhere (OFF-04)
- **D-08 — A one-line meta under every admin SOP row:** "Owner · Jane Smith · review due 12 Nov" — `AdminSopRows` (Noticeboard, machine panel, Workshop drafts) and the inbox rows. No owner renders "No owner" in the warn tint; overdue renders the date in the escalate tint. Review date = the existing cadence's next-due value (Phase 36 `cadences.ts`); a SOP with no cadence shows "no review date" quietly. The editor's **This SOP** block (58-12) gains an Owner row (the same `OwnerPicker`) and, for the owner or an admin, a **Mark reviewed** button — the same `confirmSopCurrent`.

### Decisions tab (DEC-02)
- **D-09 — A table, newest first, 50 at a time with "Show older".** Columns: when (relative, with the absolute date on hover) · who (person's name, or the agent's name with an "agent" chip) · what (plain-words kind) · about (the subject — SOP title linking to its focus address, a person's name, a completion). Filter by kind with chips grouped into plain words: **All · Approvals** (approve, reject) · **Sign-offs** (sign_off, countersign) · **Ownership** (owner_change, assign, unassign) · **Publishing** (publish) · **Reviews** (review, cadence_change) · **AI** (ai_finding_cleared, ai_field_write, verify, verify_withdrawn) · **Other** (observation, and the new kinds below). Read through a session-scoped server action over the `decisions` table (RLS is already org-scoped; the ledger is append-only, so this tab is read-only by construction).
- **D-10 — Governance changes made in this phase that are not yet ledger kinds get kinds:** `role_change`, `member_invited`, `member_removed`. One additive migration widens the `decisions.kind` check constraint; `recordDecision()` stays the only writer; `scripts/decision-writers.json` + the Phase 56 sweep list the new writers (`updateMemberRole`/`updateMemberRoleSafe`, `inviteWorker`/`addMemberByEmail`, `removeMember`).

### People & roles (OFF-05)
- **D-11 — A table in the wide pane:** name · email · role (inline select → `updateMemberRoleSafe`, which already guards the last-admin case) · departments (the existing `member_departments` picker from `/admin/team`, 57 D-09, unchanged) · status (Active / Invited) · Remove (existing `removeMember`, confirm dialog). **Invite** button above the table: email + role → the existing invite action; the invited row appears with the Invited chip. Every change ends "· logged in the decision ledger" (D-10). Settings (`/admin/settings`) keeps its own route and gets a quiet link under the table; no org-chart or column views anywhere.

### Access (OFF-06)
- **D-12 — `AdminAccessLens` mounts in the wide pane unchanged.** Same component, same server actions, no restyling beyond the container; if it needs more than 58% it may claim the pane's full width but the map never leaves. `/admin/access` 307-redirects to `/?place=office&tab=access` in the proxy; the Phase 57 bridge page is deleted.

### Deletions and addresses
- **D-13 — Delete in this phase:** `/governance` (page + `GovernanceInbox` wrapper; `deriveInbox`/`loadInbox`/`GovernanceQueueRow` are re-homed, not deleted), `/admin/team`, `/admin/access` (page only), the org-model views under `src/components/admin/org-model/` and `src/actions/org-model.ts` if nothing else reads them, and the **supervisor** halves of `/activity` (`SupervisorActivityView`, the supervisor branch of `/activity/[completionId]`). The worker `/activity` view stays until Phase 61. Proxy redirects: `/governance` → `/?place=office`, `/admin/team` → `/?place=office&tab=people`, `/admin/access` → `/?place=office&tab=access`, `/activity/[id]` for a supervisor → `/?place=office` (the inbox row). Follow the Phase 57/58 idiom exactly: dropped-features entries, deletion + retirement sweeps asserting the absence of references, repoint inventory, `journeys.ts`, `src/lib/uat/tests.ts`, `CAPABILITY-MATRIX.md` in the same commits.

### Claude's Discretion
- Whether the inbox's expanded row is an accordion or a sheet over the pane (accordion is the obvious reuse of the Phase 54 row); thumbnail size; lightbox implementation (no new dependency — a fixed overlay with keyboard arrows is enough).
- Decisions-tab paging mechanics (cursor on `created_at,id`), relative-time formatting (reuse whatever `RelBadge`/activity already use).
- How "cleared today" is counted (ledger rows by the caller's org today, kinds in the inbox set).
- Whether the Office pane needs a `loading` skeleton per tab (yes if the first query is slower than a frame — follow the 58-13 `EditorSkeleton` idiom).
- Phone: no design work (57 D-21) — the wide pane collapses like the rest below 1024px.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The one-screen contract
- `.claude/skills/sketch-findings-SOPstart/references/one-screen-site.md` — § Layout (wide detail 256/1fr/minmax(560px,58%)), § Office row of the rooms table (tabs, "one action per row", "Access keeps the current wiring screen"), § CSS patterns (`.app.wide`), § Interaction (map re-centres on resize; "… · logged in the decision ledger"), § What to avoid.
- `.claude/skills/sketch-findings-SOPstart/references/permission-wiring-views.md` — still the contract for Access (unchanged).
- `.claude/skills/sketch-findings-SOPstart/references/plant-floor-navigation.md` — inbox row/severity conventions carried from Phase 54 (the separate inbox page part is superseded).

### Prior phase decisions that bind this one
- `.planning/phases/57-the-one-screen-its-places/57-CONTEXT.md` — D-04..D-06 (Office card, inbox count = `deriveInbox().length`, supervisor Office), D-09 (member departments picker unchanged), D-10/D-11 (`/?place=` addresses, proxy redirects), D-12/D-14/D-17 (the bridges this phase replaces), D-16, D-21.
- `.planning/phases/58-the-sop-focus-screen-walk-edit/58-CONTEXT.md` — D-10 (Send for sign-off writes the completion + ledger row that becomes the inbox row), D-11..D-14 (versions; Approve must name the version), `focusHref` / `?from=` tokens.
- `.planning/phases/56-a-simpler-sop-the-decision-ledger/56-CONTEXT.md` — the ledger design (one physical `decisions` table, `recordDecision()` the only writer, agent rows name the agent).

### Requirements and capability
- `.planning/REQUIREMENTS.md` — OFF-01..06, DEC-02, SHL-06 (lines ~987, 1024-1034).
- `.planning/codebase/CAPABILITY-MATRIX.md` — must gain rows for every Office tab × role and the inbox actions; update in the same commit as each gate.

### Field research
- `.planning/research/customer-interviews/` (2026-05-05 Visy) — SOP-ownership governance gap; desktop-first reading for admins (the Office is a desktop surface).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/governance/inbox.ts` (`deriveInbox`, `INBOX_CHIPS`, `inboxCounts`, `chipMatches`) + `src/lib/governance/load-inbox.ts` (`loadInbox`) — the row model and loader; add the completion-awaiting-sign-off kind here so the Office pin, card and tab all count the same rows.
- `src/components/admin/governance/GovernanceQueueRow.tsx`, `OwnerPicker.tsx`, `ApprovalChainEditor.tsx` — the row + owner popover to re-home into the pane.
- `src/actions/governance.ts` (`setSopOwner`, `confirmSopCurrent`, `setReviewCadence`, `listGovernanceQueue`), `src/actions/approvals.ts` (`approveStep`, `requestChanges`, `getApprovalStatus`, `getApprovalHistory`), `src/actions/completions.ts` (`signOffCompletion` — already ledger-writing, sets `signed_off` / `rejected`), `src/actions/auth.ts` (`inviteWorker`, `addMemberByEmail`, `updateMemberRoleSafe`, `removeMember`, `getTeamMembersWithEmails`).
- `src/components/sop/lenses/AdminAccessLens.tsx` — mounts unchanged in the wide pane.
- `src/components/shell/AdminRoomBodies.tsx` (`AdminOfficeBody`), `ShellFrame.tsx`, `OneScreen.tsx` — the pane that becomes the Office; `RoomBodies.tsx` keeps the worker's reduced card.
- `src/lib/decisions/record.ts` — the only ledger writer; `supabase/migrations/00070_decisions_ledger.sql` — the kind list to widen.
- `src/lib/sop/focus-path.ts` (`focusHref`, `?from=` tokens) and `src/lib/shell/place.ts` (`placeToken`) — every link out of the Office uses them.
- `src/app/(protected)/activity/[completionId]/page.tsx` — the supervisor review's photo/step rendering to lift into the expanded row (58-08 already reads focus steps there).

### Established Patterns
- Rooms are detail-pane bodies keyed by `?place=` (57 D-11); tabs extend the same address with `&tab=`.
- Server actions derive org/actor from `getSessionContext()` / `requireAdminContext()`; privileged reads live in plain `src/lib/...` modules (Phase 46 CR-01 guard).
- Every governance write goes through `recordDecision()`; new writers are registered in `scripts/decision-writers.json` and the phase56 sweep.
- Deletion = dropped-features entry + sweep asserting absence of REFERENCES + repoint inventory + journeys/uat/matrix in the same commit (Phases 55/57/58).
- Deployed eval per screen-touching phase (`tests/evals/office.eval.ts`), screenshots read before pass.

### Integration Points
- `src/components/shell/OneScreen.tsx` / `ShellFrame.tsx`: the `wide` grid class and the stage `ResizeObserver` refit.
- `src/lib/supabase/middleware.ts`: the four legacy redirects.
- `src/lib/journeys/journeys.ts`, `src/lib/uat/tests.ts`, `.planning/codebase/CAPABILITY-MATRIX.md`.
- `scripts/check-bundle-size.ts`: the Office tabs are admin-only UI — they belong behind the existing admin lazy seam (`AdminShell` / `next/dynamic`) so `/` stays within ±2 KB.

</code_context>

<specifics>
## Specific Ideas

- Contract wording to keep verbatim: inbox "one action per row", empty state "is the goal", every governance action "… · logged in the decision ledger".
- Plain words throughout: "sign off", "send back", "mark reviewed", "owner", never internal ids or "block".
- Supervisors act from the inbox, never from a page of their own.

</specifics>

<deferred>
## Deferred Ideas

- **Requests tab** (My requests, worker change requests, agent-raised requests) — Phase 60.
- **Notifications / bell** on inbox changes — Phase 60.
- **Worker "My sign-offs" in the Office** and the worker `/activity` deletion — Phase 61 (my record in the Smoko room).
- **Org-wide default for the forward-jump toggle** (58 D-08 note) — backlog.
- **Approval history per version as a surface** — the ledger's Publishing/Approvals filter covers it; a per-SOP view is backlog.
- **Refresher interval UI** (`setRefresherInterval` lost its page in 58-16) — Smoko room / training, Phase 61.

</deferred>

---

*Phase: 59-the-office*
*Context gathered: 2026-10-05*

<amendments>
## Amendments after research (2026-10-05, Claude's calls — redirect before planning if wrong)

Research (`59-RESEARCH.md` § Spec-versus-code findings, § Open Questions) found the code disagrees with D-03/D-06/D-11 in places. Resolutions, binding on the planner:

- **A-01 (O1) — Owner-or-admin can mark reviewed.** `confirmSopCurrent` gains an owner path (service client, `.eq('organisation_id', session org)`, `owner_user_id = userId` re-checked server-side); **Mark reviewed** shows to admins everywhere and to the owner on the inbox row. Matrix row added. No "SOPs I own" supervisor section this phase.
- **A-02 (O2) — Supervisors do NOT approve chain steps.** Guards stay admin / safety-manager; the drifted matrix cell is corrected. Supervisor inbox = completions awaiting their sign-off only. D-03 is narrowed accordingly.
- **A-03 (O3) — Self sign-off is refused** ("You cannot sign off your own walk"): excluded from the inbox and refused in `signOffCompletion`.
- **A-04 (O4) — No RLS widening for the ledger.** The Decisions tab is admin / safety-manager only; supervisors get the Inbox tab alone. D-03 is narrowed; migration 00073 widens only the `decisions.kind` check (D-10), no new SELECT policy.
- **A-05 (O5) — Training matrix + assessment requests get a thin bridge, not a gap.** Keep `TrainingMatrixView`, `PersonPanel`, `AssessmentRequestsPanel` mounted on a minimal `/admin/training` page (admin guard, `BackToSite` bar — the 57 D-14 bridge idiom), linked from the **Smoko room** admin card ("Training matrix") until Phase 61 re-homes it. Everything else under `/admin/team` and the org-model canvases are deleted per D-13; `listOrgTree` stays (Access reads it).
- **A-06 (O6) — Rejected completions do not count as done** anywhere: `useWorkerSops` adds `.neq('status','rejected')`; if `competency.ts` also counts them, fix it in the same plan and say so.
- **A-07 (O7) — People show by email.** `getOrgMembers()` returns email (and `user_metadata.full_name` when present) so owner labels and the People table never read `role (uuid)`.
- **A-08 (F-03) — The sign-off row keeps every gate the old page had:** assessor gate with admin override reason, reject reason ≥ 10 characters, the counter-signature written after approval. "Two buttons" means two primary affordances, not fewer rules.
- **A-09 (F-05) — Completion review reads through the session client first** (RLS scopes supervisors to assigned workers), then signs storage paths for the rows it got back.
- **A-10 (F-10/F-11) — People actions get the guards they lack:** `inviteWorker` requires admin and takes a role; a role change that matches zero rows reports failure, not success. "Invited" status reads from auth users (`invited_at` + org metadata) — `[ASSUMED]` A6 verified in Wave 0.
- **A-11 (F-01/F-02) — Supervisor Office is a second lazy import** (`OfficePane` via `next/dynamic` from both shells) with a forbidden marker in `check-bundle-size.ts`; sign-offs join `deriveInbox` as an optional input so the Office pin, card and tab count the same rows; shell cache is patched per action (`SHELL_KEY`), never invalidated.
- **A-12 (Pitfall 4) — Esc inside a lightbox or dialog closes that layer only**, never the Office (stop propagation at the overlay).

</amendments>
