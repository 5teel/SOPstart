# Phase 29: Approval Chains - Research

**Researched:** 2026-07-12
**Domain:** Brownfield Postgres/Supabase schema extension + Next.js Server Actions + existing admin RSC/client surfaces, on the same mature SafeStart codebase Phase 28 just extended
**Confidence:** HIGH (every finding is a direct codebase read of the exact files this phase touches — publish route, governance actions, builder shell, versions page — not framework research)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D29-01 — Chain definition: org-scoped `approval_chains` table keyed by category.** Columns: organisation_id, category (text, matches `sops.category`; `'default'` NOT supported — chains are deliberately per-category only), steps jsonb (ordered array of 1–4 `{ role?: AppRole, userId?: string, label: string }`), created_by, timestamps. Follows the `sop_review_cadences`/`ai_model_settings` shape (00042/00043 precedent): SELECT via `current_organisation_id()` (the 00044-fixed predicate — NOT the app_metadata path), writes via service-role action with org self-enforcement.
- **D29-02 — Per-version snapshot: `approval_snapshot` jsonb on the SOP.** When a publish is REQUESTED for an SOP whose category has a chain, the chain's steps are copied into a snapshot at that moment. The live chain can change freely; in-flight and historical approvals keep the snapshot they started with. Store approvals in an append-only `sop_approvals` table: sop_id, org_id, version, step_index, approver_user_id, action ('approved' | 'changes_requested'), comment (optional), created_at — completions/review_events mirror, INSERT-only RLS with `approver_user_id = auth.uid()`.
- **D29-03 — Publish flow integration: "request publish" state, NOT a parallel pipeline.** Reuse the existing publish route as the single entry. LOCKED: new nullable `sops.approval_state` column, values NULL | 'pending' | 'approved' — all existing status-based code paths untouched. When a chain applies: first POST puts the SOP into `pending_approval` (via the column, not the status enum). Each one-click approve records a `sop_approvals` row; when the final step approves, the SAME publish logic completes automatically — server-side, no extra admin click. "Request changes" clears the pending state back to draft with the comment surfaced. NO chain configured → route behaves byte-identically to today (source-contract test must prove the no-chain path is untouched). The `unverified_blocks` 400 gate must still run BEFORE pending_approval is entered.
- **D29-04 — Approver resolution: role-based or named-member steps.** A step matches if (userId set and caller is that user) OR (role set and caller has that role in the org). Steps approve strictly in order — the "who's next" pointer is the first step index with no **approved** row (see Pitfall 4 below — this must specifically mean approved, not any row).
- **D29-05 — Approval surfaces: exactly two, both existing.** (1) SOP detail/builder publish stage shows the pending chain (step list, who's next, one-click Approve / Request changes for the matching approver). (2) Governance queue gains an `awaiting_approval` flag/chip — rows where the caller is the next approver get the one-click Approve action inline. NO new routes, NO approval console. Chain CONFIG lives as a small section on the existing `/admin/governance` page (an "Approval chains" panel — category picker + 1–4 step editor), not a new route.
- **D29-06 — Approval history in version history.** The existing `/admin/sops/[sopId]/versions` surface renders `sop_approvals` rows (who, when, action, step label) grouped by version. Read-only addition.
- **D29-07 — No notifications this phase.** Same as Phase 28: the queue + pending state IS the surfacing.
- **D29-08 — Worker surfaces: ZERO change.** Workers never see approval state. `pending_approval` SOPs remain drafts from the worker's perspective.

**NORTH STAR:** ease of use first. The chain is opt-in per category; the default experience is unchanged. Approving must be ONE click from where the approver already is.

### Claude's Discretion

Exact component naming, step-editor UX details, jsonb schema details, and whether approval_state lives on sops vs a side table — planner decides within the locked column-not-enum constraint.

### Deferred Ideas (OUT OF SCOPE)

- Email/notification on pending approval
- Cross-site Discipline Leader approver role
- Delegated/vacation approver fallback
- Org-wide default chain
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| APR-01 | Optional 1–4 step approval chain per category; no-chain categories publish exactly as today | Pattern 1 (`approval_chains` table, `sop_review_cadences` shape); Pattern 4 (route byte-identical no-chain branch); Package Legitimacy N/A (zero deps) |
| APR-02 | Chain snapshotted per SOP version; historical versions keep the chain they were approved under | Pattern 2 (`sops.approval_snapshot`, overwrite-not-null semantics); Pitfall 5 (resubmit-after-changes-requested edge case) |
| APR-03 | One-click approve/request-changes from the SOP itself and the governance queue | Pattern 5 (ApprovalChainPanel in PublishStage); Pattern 6 (GovernanceQueueRow `awaiting_approval` branch); Pitfall 3 (route-gating constraint resolved) |
| APR-04 | Final approval auto-completes publish; pending state visible on SOP + queue | Pattern 4 (`performPublish` shared extraction); Code Example "approveStep final-step branch" |
| APR-05 | Approval history visible in version history | Pattern 7 (versions page addition, `getOrgMembers` label reuse) |
</phase_requirements>

## Summary

This phase is additive integration work on the exact same schema/action/UI layer Phase 28 just built — there is no new library or framework to evaluate. The `approval_chains` settings table is a byte-for-byte copy of `sop_review_cadences`' shape (org-scoped, `current_organisation_id()` SELECT policy — written correctly from day one, closing the HR-01-class bug 00044 had to fix retroactively for cadences), and `sop_approvals` is a byte-for-byte copy of `sop_review_events`' append-only shape. `sops.approval_state`/`approval_snapshot` are two more additive nullable columns that ride the existing `admins_can_update_sops`/`org_members_can_view_sops` policies from migration 00003 — **zero new RLS on `sops` itself**, exactly like Phase 28's four columns.

The one genuinely new architectural finding this research surfaced (not present in Phase 28, because Phase 28's writers were always admins) is a **route-gating constraint that CONTEXT.md did not anticipate**: both of the two approval surfaces D29-05 locks in — `/admin/sops/builder/[sopId]` and `/admin/governance` — already hard-redirect any caller whose `organisation_members.role` is not `admin`/`safety_manager` to `/dashboard` (verified by direct read of both `page.tsx` files). D29-04's literal wording allows a step to target *any* `AppRole` (including `worker`/`supervisor`) or *any* named member — but a worker/supervisor approver could never physically reach either surface to click Approve, because the page itself would bounce them before rendering. **Recommendation (see Pitfall 3): scope both role-based steps and the named-member picker in the chain step editor to `admin`/`safety_manager` org members only.** This is a real, if narrow, reduction from D29-04's literal text, but it is a zero-cost simplification (no route-guard changes needed anywhere) that matches Visy's actual ask ("3–4 managers before approval") and the CONTEXT's own Deferred Ideas list (which already excludes broader cross-role approver concepts). Flagged in Assumptions Log for a one-line confirm from Simon; the alternative (loosening two page guards to admit named non-admin approvers) is documented as the fallback if he wants it.

Because this scoping means **every possible approver is already an org admin/safety_manager**, every write this phase makes to `sops` (entering pending, final-approval completing the publish, request-changes resetting the state) can use the **plain session client** riding the existing `admins_can_update_sops` policy — exactly Phase 28's Pattern 1, with zero new service-role code for the `sops` table. Only the new `approval_chains` settings table needs the service-role write pattern (mirrors `ai_model_settings`/`sop_review_cadences` — no authenticated write policy by design). The `sop_approvals` INSERT rides its own new RLS (`approver_user_id = auth.uid()`), also plain session client, mirroring `sop_review_events`.

**Primary recommendation:** One migration (00045) adds `approval_state`/`approval_snapshot` to `sops` + two new tables (`approval_chains` mirroring `ai_model_settings`'s exact RLS shape *with the correct `current_organisation_id()` predicate from the start*, `sop_approvals` mirroring `sop_review_events`'s append-only shape but with a **partial unique index** `WHERE action='approved'` — not a blanket unique constraint — see Pitfall 4). Refactor the publish route's steps 2–5 into a single exported `performPublish()` function in a new plain module so both the direct-publish path (no chain) and the approve-action's final-step completion call the identical code — this is what makes APR-01's "byte-identical" claim and APR-04's "same publish logic" claim both literally true, not just similar-looking.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Chain definition/config (APR-01) | API / Backend (`approval_chains` + service-role action) | Browser (step editor panel on `/admin/governance`) | Copies `sop_review_cadences` shape exactly — settings table, no authenticated write policy |
| Per-version snapshot (APR-02) | API / Backend (publish route, at request-publish moment) | Database (`sops.approval_snapshot` jsonb) | Snapshot must be taken server-side at the exact moment publish is requested, not client-computed |
| Pending-state gate + auto-complete (APR-03/APR-04) | API / Backend (`performPublish()` shared function + `approveStep`/`requestChanges` actions) | — | Single source of publish truth — the whole point of D29-03's "not a parallel pipeline" |
| One-click approve UI (APR-03) | Frontend Server (RSC data) + Browser (button/popover interaction) | — | Mirrors `OwnerPicker`/`GovernanceQueueRow` — server-computed classification, client-side one-click action |
| Approval history (APR-05) | Frontend Server (`/admin/sops/[sopId]/versions` RSC read) | API / Backend (`sop_approvals` query) | Read-only addition to an existing RSC page, same shape as the rest of that page |
| Worker-facing surfaces (D29-08) | — (deliberately no tier) | — | Zero change is itself the architectural requirement |

## Standard Stack

No new packages. This phase uses only what's already installed: Next.js Server Actions, `@supabase/supabase-js` admin/session clients, Zod, `@dnd-kit/core`/`@dnd-kit/sortable`/`@dnd-kit/modifiers` (already in `dependencies` since Phase 26 — reuse for the 1–4 step drag-order editor rather than hand-rolling drag logic), Tailwind (paper/ink tokens), Playwright.

### Package Legitimacy Audit

Not applicable — zero new dependencies. Skip the legitimacy gate (same disposition as Phase 28's RESEARCH.md).

## Architecture Patterns

### System Architecture Diagram

```
                         ┌─ Admin clicks "Publish" (builder PublishStage) ──────────┐
                         │                                                          │
                         ▼                                                          │
         POST /api/sops/[sopId]/publish/route.ts                                    │
                         │  1. auth + org resolution                                │
                         │  2. load sopRow (category, approval_state, ...)          │
                         ▼                                                          │
              approval_chains row for sopRow.category?                              │
                 │                              │                                   │
                NO                             YES                                  │
                 │                              │                                   │
                 ▼                              ▼                                   │
      performPublish(supabase, ...)   already approval_state='pending'?             │
        (unapproved-sections gate,        │                       │                 │
         unverified_blocks gate,         YES                     NO                 │
         status→published,                │                       │                 │
         review-clock reset,              ▼                       ▼                 │
         video auto-queue,         return no-op          UPDATE sops SET            │
         agent synthesis)          {pendingApproval:      approval_state='pending',  │
                 │                  true, alreadyPending}  approval_snapshot=steps   │
                 │                                                 │                 │
                 │                                                 ▼                 │
                 │                                    return {pendingApproval:true} │
                 │                                                                    │
                 └──────────────────────────◄───────────────────────────────────────┘
                                             (byte-identical response shape)

         Admin/safety_manager approver (builder ApprovalChainPanel OR governance queue row)
                         │  clicks "Approve" / "Request changes"
                         ▼
         src/actions/approvals.ts (approveStep / requestChanges)
                         │  requireAdmin() — plain session client (approver is
                         │  guaranteed admin/safety_manager, Pitfall 3)
                         │  resolveNextStepIndex() / stepMatchesCaller() — PURE,
                         │  src/lib/governance/approvals.ts
                         ▼
         INSERT sop_approvals (rides approver_user_id=auth.uid() RLS)
                         │
                         ▼
              is this the FINAL step? ──NO──► return success, still pending
                         │
                        YES
                         ▼
         performPublish(supabase, ..., approvalState:'approved')
              — THE SAME FUNCTION the no-chain route path calls —
              flips status→published, review-clock reset, auto-queue, synthesis
```

### Recommended Project Structure

```
supabase/migrations/
└── 00045_approval_chains.sql          # sops.approval_state/approval_snapshot +
                                        #   approval_chains + sop_approvals tables
src/actions/
└── approvals.ts                        # setApprovalChain, getApprovalChains,
                                        # approveStep, requestChanges, getApprovalStatus
src/lib/governance/
├── approvals.ts                        # PURE: resolveNextStepIndex, stepMatchesCaller,
│                                        #   isChainComplete — unit-testable, no I/O
└── publish-core.ts                     # performPublish() — extracted from the route,
                                        #   shared by route + approveStep final-step branch
src/app/api/sops/[sopId]/publish/route.ts   # MODIFIED: chain-gate check before calling
                                        #   performPublish(); no-chain body unchanged
src/components/admin/governance/
├── ApprovalChainEditor.tsx             # category picker + 1-4 step rows (dnd-kit reorder)
├── ApprovalChainPanel.tsx              # pending-chain display, mounted in builder
│                                        #   PublishStage AND reusable for queue detail
└── GovernanceQueueRow.tsx              # MODIFIED: awaiting_approval branch (new top
                                        #   priority when isCallerNextApprover)
src/app/(protected)/admin/sops/builder/[sopId]/
├── page.tsx                            # MODIFIED: select already covers new columns
│                                        #   (select('*')) — add getApprovalStatus() call
└── PublishStage.tsx                    # MODIFIED: mount ApprovalChainPanel when
                                        #   approvalState === 'pending'
src/app/(protected)/admin/sops/[sopId]/versions/
└── page.tsx                            # MODIFIED: render sop_approvals rows per version
src/lib/validators/
└── approvals.ts                        # Zod: chainStepSchema, approvalChainSchema
tests/phase29/
└── *.spec.ts                           # new `phase29` playwright project (broad testMatch)
src/lib/governance/__tests__/
└── approvals.test.ts                   # `phase29-unit` project, static @/ imports
```

### Pattern 1: `approval_chains` — settings table, correct RLS predicate from day one
**What:** `approval_chains(organisation_id, category, steps jsonb, created_by, created_at, updated_at)`, PK `(organisation_id, category)` — same shape as `sop_review_cadences`, but written with `current_organisation_id()` immediately (Phase 28 had to ship a follow-up migration, 00044, to fix `sop_review_cadences`/`ai_model_settings` because they were written with `auth.jwt()->'app_metadata'->>'organisation_id'`, which does not match this project's JWT shape — the custom access-token hook injects `organisation_id` at the top level, not under `app_metadata`).
**When to use:** Always for this phase's chain-definition storage.
**Example:**
```sql
-- Source: supabase/migrations/00044_fix_cadence_rls_org_claim.sql (the CORRECT predicate,
-- copied verbatim instead of repeating 00042/00043's original mistake)
create table public.approval_chains (
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  category        text not null,
  steps           jsonb not null,        -- ordered array of { role?, userId?, label }
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  primary key (organisation_id, category)
);
alter table public.approval_chains enable row level security;
create policy approval_chains_read_org on public.approval_chains
  for select to authenticated
  using (organisation_id = public.current_organisation_id());
-- NO authenticated INSERT/UPDATE/DELETE policy — writes via service-role
-- server action self-enforcing org scope (setApprovalChain, mirrors setReviewCadence).
```

### Pattern 2: `sops.approval_state` + `sops.approval_snapshot` — additive columns, zero new RLS
**What:** Two nullable columns on `sops`: `approval_state text check (approval_state in ('pending','approved'))` and `approval_snapshot jsonb`.
**When to use:** Always — do NOT touch the `SopStatus` enum (`'uploading'|'parsing'|'draft'|'published'`, `src/types/sop.ts:13`). Verified via grep that 17 files across the codebase filter on `status = 'published'`/`status !== 'draft'` (worker library, walkthrough, video pipeline, AI-fields write route, sync engine, etc.) — none of them touch `approval_state`, so this column is provably invisible to every existing consumer.
**Example:**
```sql
alter table public.sops
  add column if not exists approval_state    text check (approval_state in ('pending', 'approved')),
  add column if not exists approval_snapshot  jsonb;
-- No new policy: admins_can_update_sops / org_members_can_view_sops (00003)
-- already gate these columns exactly like Phase 28's four columns did.
```
**Snapshot overwrite semantics (APR-02):** On EVERY fresh "request publish" (approval_state transitioning from NULL to 'pending'), overwrite `approval_snapshot` with the CURRENT `approval_chains.steps` for that category. Do NOT null `approval_snapshot` when "request changes" resets `approval_state` back to NULL — leave the last snapshot in place so version-history rendering (APR-05) can still resolve step labels for prior approval rows even after a reject-then-resubmit cycle. See Pitfall 5 for the narrow edge case this leaves open (accepted).

### Pattern 3: `sop_approvals` — append-only mirror with a PARTIAL unique index (not blanket)
**What:** `sop_approvals(id, sop_id, organisation_id, version, step_index, approver_user_id, action, comment, created_at)` — mirrors `sop_review_events`' RLS shape (INSERT: `approver_user_id = auth.uid()` + org scope; no admin-role restriction, since ANY matching approver may write, unlike `sop_review_events` which requires admin/safety_manager). **Critically: the "idempotent double-click" unique constraint must be a PARTIAL index scoped to `action = 'approved'`, not a blanket `unique(sop_id, version, step_index)`** — see Pitfall 4 for why a blanket constraint silently breaks the "request changes → resubmit → re-approve the same step" cycle.
**Example:**
```sql
create table public.sop_approvals (
  id              uuid primary key default gen_random_uuid(),
  sop_id          uuid not null references public.sops(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  version         int not null,
  step_index      int not null,
  approver_user_id uuid references auth.users(id) on delete set null,
  action          text not null check (action in ('approved', 'changes_requested')),
  comment         text,
  created_at      timestamptz not null default now()
);
create index if not exists sop_approvals_sop_id_idx on public.sop_approvals(sop_id);
-- Idempotent-approve guard: only ONE 'approved' row per (sop, version, step) —
-- a partial index, NOT a blanket unique(sop_id, version, step_index), which
-- would also block a second changes_requested row at the same step across
-- multiple reject/resubmit cycles (Pitfall 4).
create unique index if not exists sop_approvals_one_approval_per_step
  on public.sop_approvals(sop_id, version, step_index)
  where action = 'approved';

alter table public.sop_approvals enable row level security;
create policy sop_approvals_read_org on public.sop_approvals
  for select to authenticated
  using (organisation_id = public.current_organisation_id());
create policy sop_approvals_insert_self on public.sop_approvals
  for insert to authenticated
  with check (
    organisation_id = public.current_organisation_id()
    and approver_user_id = auth.uid()
  );
-- NO UPDATE/DELETE — append-only (COMP-07/D-15 precedent).
```

### Pattern 4: Extract `performPublish()` — the ONE function both paths call
**What:** The current `src/app/api/sops/[sopId]/publish/route.ts` steps 2 through 5 (unapproved-sections gate → verify-checklist gate → status flip → review-clock reset → video auto-queue → agent synthesis) move, essentially verbatim, into an exported `performPublish(supabase, { sopId, organisationId, userId })` in a new plain module `src/lib/governance/publish-core.ts`. This is what makes APR-01's "byte-identical no-chain path" and APR-04's "same publish logic completes automatically" BOTH literally true — not two similar-looking implementations that drift.
**Where the route changes:** After step 1 (auth+org) and a lightweight `select('category, approval_state')` for the chain-gate check, the route either (a) short-circuits into the pending-approval branch (Pattern 2) when a chain applies and isn't already pending, or (b) calls `performPublish()` and maps its result to the existing `NextResponse` shapes — for the no-chain case this is the SAME code that ran before, just relocated.
**Where `approveStep` calls it:** When `approveStep` detects the just-inserted row was the FINAL step, it calls the identical `performPublish(supabase, { ..., approvalState: 'approved' })` — passing an extra param so the status-flip UPDATE also stamps `approval_state = 'approved'` in the same statement. Because `performPublish` re-runs the unapproved-sections/verify-checklist gates internally, this also closes a real correctness gap for free: if an admin edits SOP content while a chain is pending, the final auto-publish still re-validates before going live (see Pitfall 6).
**Anti-pattern:** Do NOT duplicate the gate-check logic into `approveStep` "for speed" — that reintroduces exactly the two-parallel-implementations risk D29-03 explicitly warns against.

### Pattern 5: `ApprovalChainPanel` — mounted in `PublishStage`, controlled/presentational
**What:** `PublishStage.tsx` (`src/app/(protected)/admin/sops/builder/[sopId]/PublishStage.tsx`) is a pure presentational component today (props in, `onPublish` callback out — no fetch/Supabase calls, per its own file header). Extend its props with an optional `approvalStatus` object (`{ state: 'pending'|'approved'|null; steps: ChainStep[]; approvals: ApprovalRow[]; nextStepIndex: number; isCallerNextApprover: boolean }`) computed server-side by `page.tsx` (which already does a role-guarded fetch and passes `initialSop` down) and threaded through `BuilderStageShell` exactly like `verifiedCount`/`isReady` are today. When `approvalStatus.state === 'pending'`, render the step list + who's-next + Approve/Request-changes buttons (buttons only rendered when `isCallerNextApprover`); otherwise render nothing new — the existing "Publish SOP" button behavior is completely unaffected for no-chain SOPs.
**Why server-computed, not client-fetched:** Matches the RSC-first pattern the Phase 28 Governance queue page and 26.5 AgentPanel both already use (classification/computation happens where the data is fetched, not via a second client round-trip) — avoids a hydration/loading-flash pattern for something this small.

### Pattern 6: Governance queue `awaiting_approval` — extend `classifyGovernanceRow`, don't fork it
**What:** Add two new fields to `GovernanceInput` (`src/lib/governance/classify.ts`): `hasPendingApproval: boolean` and `isCallerNextApprover: boolean`. Push a new `'awaiting_approval'` flag when `hasPendingApproval` (visible to every admin, informational), independent of whether the CURRENT viewer is the next approver — this keeps the "single glanceable surface" (GQ-01) intact: every admin sees which rows are pending, even if only the specific next approver can act on it.
**Row action priority (in `GovernanceQueueRow.tsx`):** `awaiting_approval && isCallerNextApprover` (new, TOP priority — approve action) → `unowned` (existing `OwnerPicker`) → `stale_role` (existing "Fix assignment" link) → default `Confirm current`. This is additive to the existing if/else-if chain, not a rewrite.
**Example:**
```typescript
// src/lib/governance/classify.ts — additive fields only
export type GovernanceFlag = 'overdue' | 'due_soon' | 'unowned' | 'stale_role' | 'awaiting_approval'

export interface GovernanceInput {
  // ...existing fields unchanged...
  hasPendingApproval: boolean       // sops.approval_state === 'pending'
  isCallerNextApprover: boolean     // stepMatchesCaller() result for the caller
}

export function classifyGovernanceRow(input: GovernanceInput): GovernanceFlag[] {
  // ...existing logic unchanged...
  if (input.hasPendingApproval) flags.push('awaiting_approval')
  return flags
}
```

### Pattern 7: Version history addition — reuse `getOrgMembers()` for approver labels
**What:** `src/app/(protected)/admin/sops/[sopId]/versions/page.tsx` already fetches `VersionRecord[]` via `getVersionHistory(sopId)` (`src/actions/versioning.ts`). Add a parallel fetch (`getApprovalHistory(sopId)` in `src/actions/approvals.ts`, or extend `getVersionHistory` itself) pulling `sop_approvals` rows for every version id in the lineage (`.in('sop_id', versionIds)`), and render them grouped under each version row — read-only, matching D29-06 exactly. Resolve approver display names the SAME way `listGovernanceQueue`'s `ownerLabelById` does: `getOrgMembers()` (`src/actions/assignments.ts`), never a second hand-rolled member query.
**Step label resolution:** Each `sop_approvals` row only stores `step_index` (not a label — matches the locked schema). Resolve the human-readable label by looking up `steps[step_index].label` from that SOP row's `approval_snapshot` (or, for the CURRENT/most-recent version, the live `approval_snapshot` on that sop row) — do not add a redundant `label` column to `sop_approvals` (Don't Hand-Roll below).

### Anti-Patterns to Avoid
- **Parallel publish pipeline:** D29-03 is explicit. `performPublish()` must be the ONLY place `status` flips to `'published'`.
- **Blanket `unique(sop_id, version, step_index)` on `sop_approvals`:** Blocks legitimate multi-cycle `changes_requested` rows and a same-step re-approval after a reject/resubmit cycle. Use the partial index (Pattern 3).
- **Adding a `label` column to `sop_approvals`:** The label is already fully recoverable from `approval_snapshot` by index — a duplicate column is unrequested schema growth (ladder rung 2/6).
- **Touching the `SopStatus` enum or any of the 17 files that filter on `status`:** Verified unnecessary — `approval_state` is a fully separate, additive column (Pattern 2).
- **Loosening `/admin/sops/builder/[sopId]` or `/admin/governance` role guards to admit non-admin approvers:** Out of scope given the Pitfall 3 scoping decision (role-based/named steps limited to admin/safety_manager) — do not add cross-role route-guard logic unless Simon explicitly asks for it after reviewing the Assumptions Log entry below.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 1–4 step drag-reorder editor | Custom pointer-event drag logic | `@dnd-kit/core` + `@dnd-kit/sortable` (already `dependencies`, installed Phase 26 for the block canvas) | Zero new install; same library already proven in this exact codebase for reorderable lists |
| "Is caller the next approver" check across 3 surfaces (builder, queue, versions) | Three separate ad-hoc comparisons | One pure `stepMatchesCaller()` + `resolveNextStepIndex()` in `src/lib/governance/approvals.ts`, imported everywhere | Single source of truth for chain-progression logic — also the Nyquist-favored unit-test surface |
| Approver display name resolution | New member/email query in `approvals.ts` | Reuse `getOrgMembers()` (`src/actions/assignments.ts`) exactly like `listGovernanceQueue`'s `ownerLabelById` does | Third call site for the same "list org members" need — avoids a third hand-rolled query path |
| Step label in version history | New `label` column on `sop_approvals` | Resolve from `sops.approval_snapshot[step_index].label` at render time | The label already lives in the snapshot; a second copy is redundant, unrequested schema |
| Idempotent double-click approve | New "already approved?" pre-check query before insert | Attempt the INSERT, catch `error.code === '23505'` on the partial unique index, return `{ success: true }` | Exact existing codebase idiom (`assignments.ts`, `completions.ts` — see Code Examples) |

**Key insight:** Every write pattern this phase needs already has a shipped precedent from Phase 4 (append-only + 23505 idempotency), Phase 27/28 (settings table + service-role self-enforcement), or Phase 26 (dnd-kit). The only genuinely new reasoning required is the chain-progression math (who's next, is chain complete) — which is why it gets its own pure, unit-tested module rather than being inlined anywhere.

## Common Pitfalls

### Pitfall 1: Assuming approver writes to `sops` need a service-role client
**What goes wrong:** Copying Phase 28's Pattern-1 instinct too literally and reaching for `createAdminClient()` for `approveStep`'s final-publish write, "just in case the approver isn't an admin."
**Why it happens:** D29-04's literal text allows any `AppRole` or named member as a step — reads like the caller might not be admin/safety_manager.
**How to avoid:** Given the Pitfall 3 scoping decision (steps restricted to admin/safety_manager members), EVERY caller reaching `approveStep`/`requestChanges` is already gated to admin/safety_manager by the surface they're standing on (`/admin/governance` or the builder). So `admins_can_update_sops` already covers every write this phase makes to `sops` — use the plain session client throughout, exactly like Phase 28.
**Warning signs:** A new `createAdminClient()` import in `src/actions/approvals.ts` touching `sops` (not `approval_chains`) is a red flag — check Pitfall 3's scoping decision first.

### Pitfall 2: Forgetting the `current_organisation_id()` predicate on `approval_chains`'s RLS (repeating the HR-01 mistake)
**What goes wrong:** Copy-pasting `sop_review_cadences`'s ORIGINAL (buggy) 00042/00043-era policy text — `auth.jwt()->'app_metadata'->>'organisation_id'` — instead of the 00044-fixed version, silently returning zero rows for every authenticated read and making every org fall back to "no chain configured."
**Why it happens:** The most recent nearby precedent file on disk (00043) still contains the ORIGINAL wrong predicate in its own text (00044 is a separate follow-up migration, not a rewrite of 00043) — a naive "copy the nearest similar table" grep would copy the bug.
**How to avoid:** Use `public.current_organisation_id()` directly (Pattern 1's example) — verified correct via `00044_fix_cadence_rls_org_claim.sql`'s own comment: "the custom access-token hook (00001_foundation_schema.sql) injects organisation_id at the TOP LEVEL of the claims."
**Warning signs:** Any new policy text containing `app_metadata` is the bug signature.

### Pitfall 3: Route-gating makes non-admin approvers unreachable (RESOLVED — see recommendation)
**What goes wrong:** Building the full D29-04 "any role, any named member" approver matching, only to discover a named supervisor/worker approver can never open either approval surface, because `/admin/sops/builder/[sopId]/page.tsx` (line 33) and `/admin/governance/page.tsx` (line 39) BOTH hard-redirect any caller whose org role isn't `admin`/`safety_manager` to `/dashboard` before rendering anything.
**Why it happens:** CONTEXT.md's D29-04 was written without cross-checking the existing route guards on the two D29-05-locked surfaces — a genuine gap between the requirement and the codebase's current shape.
**How to avoid — RECOMMENDED default:** Scope the chain step editor so role-based steps only offer `admin`/`safety_manager` in the role dropdown, and the named-member picker (reusing `getOrgMembers()`) is filtered to members whose `role` is `admin` or `safety_manager`. This requires ZERO changes to either page's existing role guard and matches Visy's real-world ask ("3-4 managers"). Document as an Assumption for Simon to confirm (see Assumptions Log A1) rather than silently narrowing the requirement.
**Fallback if broader roles are wanted later:** Loosen both page guards with an additional allow-condition — "OR caller is the next approver for a specific pending-approval SOP" (computed via a small server-side check) — but this is real new scope, not a default for this phase.

### Pitfall 4: Blanket unique constraint on `sop_approvals` breaks multi-cycle reject/resubmit
**What goes wrong:** A literal `unique(sop_id, version, step_index)` constraint (as a naive reading of "idempotent approve, unique constraint on sop_id+version+step_index" might suggest) blocks a SECOND `changes_requested` row at the same step across multiple reject cycles, AND blocks a legitimate re-approval of the same step after a reject-then-resubmit (same `sop_id`+`version`, since versioning creates a NEW row/id for genuinely new versions — a request-changes cycle reuses the SAME draft row).
**Why it happens:** The word "unique" in the schema spec is intended for the idempotent-DOUBLE-CLICK case specifically (item #8 in this research's brief), not as a blanket per-step cap across the whole chain lifecycle.
**How to avoid:** Use a PARTIAL unique index scoped to `WHERE action = 'approved'` (Pattern 3) — this still catches genuine double-clicks (23505 on the second `approved` insert for the same step) while leaving `changes_requested` rows and legitimate re-approvals-after-reset unconstrained. `resolveNextStepIndex()` must also only count rows where `action = 'approved'` as "done" — a `changes_requested` row must NEVER be treated as satisfying that step.
**Warning signs:** A migration with `unique(sop_id, version, step_index)` and no `where` clause.

### Pitfall 5: Chain-shape drift between reject and resubmit (accepted edge case)
**What goes wrong:** If an org edits their `approval_chains` row (adds/reorders/removes a step) WHILE an SOP is sitting in `changes_requested` (same draft row, same version, waiting to be resubmitted), the resubmit re-copies the CURRENT chain into `approval_snapshot` — meaning a step_index that was previously approved under the OLD snapshot might now refer to a different approver/label under the NEW snapshot. `resolveNextStepIndex()` only tracks index position, not step identity.
**Why it happens:** D29-02 explicitly says the live chain "can change freely" while approvals are in flight — this is the one narrow case where "in flight" spans a reject/resubmit cycle for the SAME row.
**How to avoid:** Accept this as a known, narrow edge case (matches the north-star "ease of use over process rigor" — chain edits mid-flight are rare and low-stakes). Do NOT build chain-diff/step-identity-reconciliation logic — that is speculative complexity for a scenario with no reported customer need. Documented here so it's a conscious tradeoff, not a silent gap.

### Pitfall 6: Content edited after chain requested, before final approval — closed for free by Pattern 4
**What goes wrong:** If gate-checks (`unverified_blocks`, unapproved sections) only ran at the "request publish" moment and NOT again at final-approval time, an admin could edit SOP content into an invalid state WHILE a chain is pending, and the final approval would auto-publish it without re-validating.
**How to avoid:** Because `performPublish()` (Pattern 4) is the SAME function called at both moments, the gates re-run automatically at final-approval time too — no extra code needed, just correct extraction (don't duplicate the gate logic into `approveStep` directly).

### Pitfall 7: New Playwright specs silently never run (recurring class)
**What goes wrong:** `tests/phase29/*.spec.ts` created without a matching `playwright.config.ts` project regex (2026-05-25 learning class, recurred and was avoided in Phase 28 via the `phase28`/`phase28-unit` projects).
**How to avoid:** Register `phase29` (`testDir: '.'`, `testMatch: /tests\/phase29\/.*\.(spec|test)\.ts$/`) and `phase29-unit` (`testDir: './src/lib/governance/__tests__'`) in Wave 0, verify immediately with `npx playwright test --list --project=phase29`.

## Code Examples

### Idempotent approve — exact existing codebase idiom
```typescript
// Source: src/actions/completions.ts:88-90 / src/actions/assignments.ts:230 (existing pattern)
const { error } = await supabase.from('sop_approvals').insert({
  sop_id: sopId,
  organisation_id: ctx.organisationId,
  version: sop.version,
  step_index: nextIndex,
  approver_user_id: ctx.userId,
  action: 'approved',
})
if (error) {
  if (error.code === '23505') return { success: true } // already approved — idempotent
  return { error: error.message }
}
```

### Chain-progression pure logic (unit-testable, no I/O)
```typescript
// src/lib/governance/approvals.ts — mirrors classify.ts/cadences.ts extraction discipline
import type { AppRole } from '@/types/auth'

export interface ChainStep {
  role?: AppRole
  userId?: string
  label: string
}

export function resolveNextStepIndex(stepCount: number, approvedStepIndexes: Set<number>): number {
  for (let i = 0; i < stepCount; i++) {
    if (!approvedStepIndexes.has(i)) return i
  }
  return -1 // chain fully approved
}

export function stepMatchesCaller(step: ChainStep, caller: { userId: string; role: AppRole }): boolean {
  if (step.userId && step.userId === caller.userId) return true
  if (step.role && step.role === caller.role) return true
  return false
}

export function isChainComplete(stepCount: number, approvedStepIndexes: Set<number>): boolean {
  return resolveNextStepIndex(stepCount, approvedStepIndexes) === -1
}
```

### Publish route — chain gate inserted before the existing (unmoved) logic
```typescript
// src/app/api/sops/[sopId]/publish/route.ts — after step 1 (auth+org resolution)
const { data: chainRow } = await (supabase as any)
  .from('approval_chains')
  .select('steps')
  .eq('organisation_id', organisationId)
  .eq('category', sopCategoryRow?.category ?? '')
  .maybeSingle()

if (chainRow?.steps?.length > 0) {
  if (sopCategoryRow?.approval_state === 'pending') {
    return NextResponse.json({ success: true, pendingApproval: true, alreadyPending: true })
  }
  const { data: updated } = await supabase
    .from('sops')
    .update({ approval_state: 'pending', approval_snapshot: chainRow.steps })
    .eq('id', sopId)
    .eq('status', 'draft')
    .is('approval_state', null)
    .select('id')
  if (!updated || updated.length === 0) {
    return NextResponse.json({ success: true, pendingApproval: true, alreadyPending: true })
  }
  return NextResponse.json({ success: true, pendingApproval: true })
}

// No chain — falls through to performPublish(), BYTE IDENTICAL to today's response shape.
const result = await performPublish(supabase, { sopId, organisationId, userId: user.id })
```

## Runtime State Inventory

> This is NOT a rename/refactor phase — it is additive schema + new UI, same disposition as Phase 28's RESEARCH.md. Included per Nyquist rigor since no backfill runs against production data this time (all new columns are NULL by default, no existing rows need computed values).

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — `approval_state`/`approval_snapshot` are NULL for every existing SOP by default; no backfill needed (unlike Phase 28's owner/review-date backfill) | None |
| Live service config | None | None |
| OS-registered state | None | None |
| Secrets/env vars | None — no new env vars | None |
| Build artifacts | `database.types.ts` needs manual extension for `sops.approval_state`/`approval_snapshot` (same Pitfall-4-class as Phase 28); `approval_chains`/`sop_approvals` accessed via `(supabase as any)` until a full type regen | Code edit, not data migration |

**Nothing found in any category requiring a data migration** — verified this phase adds zero populated-by-default columns (contrast with Phase 28's `owner_user_id`/`review_due_at` which needed backfill for existing rows).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Role-based chain steps and the named-member picker should be scoped to `admin`/`safety_manager` org members only, because both D29-05-locked approval surfaces (`/admin/sops/builder/[sopId]`, `/admin/governance`) already hard-redirect any other role away | Pitfall 3 / Summary | Medium — if Simon wants a supervisor/worker to be a named approver, the planner must instead loosen both page guards with a per-SOP allow-condition (documented as the fallback) — real additional scope, not a config toggle |
| A2 | `sop_approvals`'s "idempotent unique constraint" should be a PARTIAL index (`where action='approved'`), not a blanket `unique(sop_id,version,step_index)` | Pattern 3 / Pitfall 4 | Medium — a blanket constraint would silently break multi-cycle reject/resubmit flows in a way that only surfaces during a real second rejection round, easy to miss in initial testing |
| A3 | `approval_snapshot` is NOT nulled on "request changes" (only `approval_state` resets to NULL) — so version-history step labels remain resolvable after a reject cycle | Pattern 2 | Low — if wrong, version history would show "unknown step" for any approval predating a reject; easy to detect visually, not a data-integrity risk |
| A4 | Chain-shape drift between a reject and its resubmit (org edits the chain mid-flight) is an accepted, unhandled edge case | Pitfall 5 | Low — narrow scenario requiring both an in-flight rejection AND a chain edit in the same window; no reported customer need for stricter handling |

**None of these are HIGH risk** — A1 is the only one that changes phase scope if resolved differently; the other three are implementation-detail correctness calls with narrow, easily-detectable blast radius if wrong.

## Open Questions

None outstanding — all four items that needed resolution during this research pass are captured in the Assumptions Log above with a recommended default, per the "resolve as much as possible, flag the rest" research discipline. A1 is the one item worth a quick explicit nod from Simon before planning locks it in, since it's the only one that changes literal requirement scope (D29-04's "any AppRole" wording) rather than being a pure implementation-correctness call.

## Environment Availability

Skipped — this phase has no new external tool/service dependency, identical disposition to Phase 28. All work is within the existing Supabase Postgres + Next.js/Railway stack.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright (unit-style + integration specs, per project convention) |
| Config file | `playwright.config.ts` |
| Quick run command | `npx playwright test --project=phase29-unit` |
| Full suite command | `npx playwright test --project=phase29-unit --project=phase29` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| APR-01 | No-chain SOP publish response is byte-identical to pre-Phase-29 shape | source-contract (diff-style assertion on route body around the chain-gate insertion point) | `npx playwright test --project=phase29 -g "no-chain publish unchanged"` | ❌ Wave 0 |
| APR-01 | `approval_chains` RLS uses `current_organisation_id()`, never `app_metadata` | source-contract (grep migration text) | `npx playwright test --project=phase29 -g "approval_chains RLS"` | ❌ Wave 0 |
| APR-02 | `approval_snapshot` overwritten (not appended) on each fresh request-publish; NOT nulled on request-changes | unit (`resolveNextStepIndex`/snapshot helpers) + source-contract on the UPDATE statements | `npx playwright test --project=phase29-unit -g "snapshot"` | ❌ Wave 0 |
| APR-03 | `GovernanceQueueRow` renders Approve action only when `isCallerNextApprover` true, prioritized above unowned/stale_role | source-contract (wired handler assertion, 2026-06-05 class — not bare prop presence) | `npx playwright test --project=phase29 -g "awaiting_approval priority"` | ❌ Wave 0 |
| APR-03 | `ApprovalChainPanel` mounted in `PublishStage` only when `approvalStatus.state === 'pending'` | source-contract | `npx playwright test --project=phase29 -g "ApprovalChainPanel mount"` | ❌ Wave 0 |
| APR-04 | `approveStep` on final step index calls the SAME `performPublish` the route calls (not a duplicated inline flip) | source-contract (import + call-site assertion) | `npx playwright test --project=phase29 -g "performPublish shared"` | ❌ Wave 0 |
| APR-04 | `resolveNextStepIndex` only counts `action='approved'` rows as done | unit | `npx playwright test --project=phase29-unit -g "resolveNextStepIndex"` | ❌ Wave 0 |
| APR-04 | `stepMatchesCaller` matches on userId OR role correctly, rejects non-matches | unit | `npx playwright test --project=phase29-unit -g "stepMatchesCaller"` | ❌ Wave 0 |
| APR-04 | Double-click approve is idempotent (23505 → success, not error) | unit + test.fixme runtime (live-DB partial-index behavior) | `npx playwright test --project=phase29-unit -g "idempotent approve"` | ❌ Wave 0 |
| APR-05 | Versions page renders `sop_approvals` rows grouped by version with resolved step label + approver name | source-contract | `npx playwright test --project=phase29 -g "version history approvals"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx playwright test --project=phase29-unit`
- **Per wave merge:** `npx playwright test --project=phase29-unit --project=phase29` + `npx tsc --noEmit` + `npm run build` (touches `src/actions/*` and the publish route ⇒ 2026-06-27 async-only-export learning applies — full `next build`, not just `tsc`)
- **Phase gate:** Full suite green before `/gsd-verify-work`; live-DB `test.fixme` runtime assertions (cross-org write isolation for `setApprovalChain`, partial-unique-index double-click behavior, cross-org `approveStep` isolation) carried as documented UAT items exactly like `tests/phase27/ai-settings-org-scope.spec.ts` and `tests/phase28/governance-actions.spec.ts`.

### Wave 0 Gaps
- [ ] `playwright.config.ts` — register `phase29` project (`testDir: '.'`, `testMatch: /tests\/phase29\/.*\.(spec|test)\.ts$/`)
- [ ] `playwright.config.ts` — register `phase29-unit` project (`testDir: './src/lib/governance/__tests__'`)
- [ ] `src/lib/governance/__tests__/approvals.test.ts` — Wave 0 stub for `resolveNextStepIndex`/`stepMatchesCaller`
- [ ] `supabase/migrations/00045_approval_chains.sql` — does not exist yet
- [ ] `database.types.ts` manual extension for `sops.approval_state`/`approval_snapshot` — not present

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Unaffected — existing Supabase session auth |
| V3 Session Management | No | Unaffected |
| V4 Access Control | Yes | `admins_can_update_sops` gates all `sops` writes this phase (Pitfall 1/3 scoping decision); new `approval_chains` RLS (read: org-scoped `current_organisation_id()`; write: service-role self-enforced); new `sop_approvals` RLS (insert: `approver_user_id = auth.uid()` + org scope, no admin-role restriction since any matching approver may write) |
| V5 Input Validation | Yes | Zod schema for `setApprovalChain(category, steps)` — `steps` array length 1–4, each step has exactly one of `role`/`userId` set (never both, never neither) plus a non-empty `label`; `requestChanges(sopId, comment)` requires non-empty `comment` (locked in CONTEXT specifics) |
| V6 Cryptography | No | Unaffected |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-tenant `approval_chains` write (org A setting org B's chain) | Tampering | `organisation_id` sourced ONLY from `parseJwtPayload`, never a function parameter — mirrors `setAiModelSetting`/`setReviewCadence` |
| Caller approves a step that isn't theirs (bypassing `stepMatchesCaller`) | Elevation of Privilege | `approveStep` MUST call `stepMatchesCaller()` server-side before the INSERT — never trust a client-supplied "I am the next approver" flag |
| Caller inserts a `sop_approvals` row for an SOP outside their org | Tampering / Information Disclosure | `sop_approvals_insert_self` RLS enforces `organisation_id = current_organisation_id()` AND `approver_user_id = auth.uid()` — defense in depth even though the action layer also checks org membership before insert |
| Raw `atob` JWT decode reintroduced in new `approvals.ts` code | Tampering (malformed token crash) | Use `parseJwtPayload` from `@/lib/supabase/jwt` exclusively (already the established pattern in `governance.ts`) |

## Sources

### Primary (HIGH confidence — direct codebase reads, this session)
- `C:\Development\SOPstart\src\app\api\sops\[sopId]\publish\route.ts` — full current publish flow (steps 1–5), the exact extraction target for `performPublish()`
- `C:\Development\SOPstart\src\actions\governance.ts` — `requireAdmin`, service-role vs plain-session write pattern, `listGovernanceQueue` composition shape
- `C:\Development\SOPstart\src\lib\governance\classify.ts` / `cadences.ts` — pure-module extraction discipline to mirror for `approvals.ts`
- `C:\Development\SOPstart\supabase\migrations\00043_ownership_review_governance.sql` / `00044_fix_cadence_rls_org_claim.sql` — settings-table + append-only shapes, and the exact RLS-predicate bug to avoid repeating
- `C:\Development\SOPstart\src\app\(protected)\admin\sops\builder\[sopId]\page.tsx` (line 33), `src\app\(protected)\admin\governance\page.tsx` (line 39) — confirms BOTH approval surfaces are admin/safety_manager-only gated (Pitfall 3 discovery)
- `C:\Development\SOPstart\src\app\(protected)\admin\sops\builder\[sopId]\PublishStage.tsx` + `BuilderStageShell.tsx` — presentational/controlled component shape, `handlePublish`/`publishError` state ownership
- `C:\Development\SOPstart\src\components\admin\governance\GovernanceQueueRow.tsx` / `OwnerPicker.tsx` / `GovernanceFilterChips.tsx` / `GovernanceWidget.tsx` — exact UI patterns extended by Patterns 5/6
- `C:\Development\SOPstart\src\app\(protected)\admin\sops\[sopId]\versions\page.tsx` + `src\actions\versioning.ts` (`getVersionHistory`, `VersionRecord`) — version history surface Pattern 7 extends
- `C:\Development\SOPstart\src\actions\assignments.ts` (`getOrgMembers`, 23505 handling), `src\actions\completions.ts` (23505 idempotency) — exact reused idioms
- `C:\Development\SOPstart\src\types\auth.ts` (`AppRole`), `src\types\sop.ts` (`SopStatus`, `Sop` optional-field extension pattern)
- `C:\Development\SOPstart\src\lib\supabase\jwt.ts` — `parseJwtPayload`
- `C:\Development\SOPstart\playwright.config.ts` + `tests\phase28\governance-actions.spec.ts` — spec-registration convention
- `C:\Development\SOPstart\package.json` — confirms `@dnd-kit/*` already installed (Phase 26)
- Grep across `src/` for `status.*'published'`/`status !== 'draft'` — confirms 17 files, none touching `approval_state`
- `C:\Development\SOPstart\.planning\phases\28-ownership-review-lifecycle-governance-queue\28-RESEARCH.md`, `28-03-SUMMARY.md`, `28-04-SUMMARY.md` — direct precedent this phase extends
- `C:\Development\SOPstart\.planning\phases\29-approval-chains\29-CONTEXT.md` — locked decisions D29-01..D29-08
- `C:\Development\SOPstart\.planning\REQUIREMENTS.md` (v6.0 section) — APR-01..05 requirement text
- `C:\Development\SOPstart\CLAUDE.md` — Learnings log (2026-06-05 wired-handler class, 2026-06-15/07-05 service-role self-enforcement class, 2026-06-26 JWT-decode class, 2026-06-27 async-only-export class, 2026-05-25 spec-registration class)

### Secondary (MEDIUM confidence)
- None — no WebSearch/external sources were needed; fully brownfield-internal research pass, same disposition as Phase 28.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new packages; `@dnd-kit` already installed and proven in this repo
- Architecture: HIGH — every read/write path traced to an existing RLS policy, an existing precedent action, or a directly-read existing component; the one new architectural finding (Pitfall 3 route-gating) was verified by reading both gate implementations directly, not inferred
- Pitfalls: HIGH — six of seven pitfalls are directly observed in the codebase (route guards, existing 00044 bug, existing idempotency idioms); Pitfall 5 (chain-shape drift) is a reasoned edge case, explicitly flagged as accepted rather than asserted as fact

**Research date:** 2026-07-12
**Valid until:** 30 days (stable brownfield codebase); re-verify migration slot number (00045) if another phase's migration lands first
