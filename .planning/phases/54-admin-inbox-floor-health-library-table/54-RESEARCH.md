# Phase 54: Admin — Inbox, Floor Health, Library Table - Research

**Researched:** 2026-09-29
**Domain:** Next.js 16 App Router admin surface consolidation (route add + large deletion), Supabase RLS-backed governance/site data, no new external dependencies
**Confidence:** HIGH — every claim below is grounded in the actual current source tree (read in full for every file named), not training knowledge. This is a refactor/consolidation phase against code that shipped in the last 24-48h (Phase 51/52), so training-data knowledge of these files does not exist and was not relied on.

## Summary

Phase 54 replaces three things that currently live as code-split lenses on `/sops` (`AdminSopSurface` + `AdminAttentionLens` + `AdminStatusLens` + `MillerPrimitives` + `SopWorkerBrowser` + `SopMillerBrowser`) with two new surfaces: a real `/governance` route (inbox + admin-repainted floor) and a plain-table admin `/sops`. Almost none of the DATA layer needs to be built — `listGovernanceQueue()`, `listAdminSopRows()`, `GovernanceQueueRow`, `OwnerPicker`, `approveStep`, `setSopOwner`, `confirmSopCurrent`, and the whole Phase 51/52 site/plant stack (`site.ts`, `scene.ts`, `PlantStage`, `MachinePanel`, `worker-signal.ts`) already exist and already return or compute almost every field the sketch's inbox rows, floor pins, and checks columns need. The work is almost entirely UI composition + two small new pure-function/data additions (an admin-health classifier sibling to `worker-signal.ts`, and 3 new fields on `listSiteForOrg`'s `sops` select) + a large, precise deletion with a full reference-sweep repoint across ~15 test files.

**The single highest-risk item in this phase is NOT the new UI — it is `scripts/check-bundle-size.ts`'s marker self-validation gate.** It hard-fails `next build` if a forbidden-marker string literal (e.g. `'Owner role gone'`, `'Pick another scope on the left.'`) is declared in `GATED_ROUTES` but is no longer found ANYWHERE in the scanned build output once the components that used to carry those strings are deleted. This is not a hypothetical — deleting `SopMillerBrowser.tsx` and `AdminAttentionLens.tsx` verbatim will make at least two of the six declared marker literals vanish from the entire build, and the gate's own design makes that a hard failure, not a false pass. See Common Pitfalls #1.

The second highest-risk item is sequencing: **Phase 53 (Phone) has not been built yet** (context-only, zero code) even though the roadmap marks 53 ∥ 54 as parallel. Phase 54's CONTEXT.md D-10 assumes 53's phone-home already replaced the mobile Miller frame ("is now 53's phone home"). The plan must not hard-depend on that; D-10 already provides the correct fallback wording ("the existing stacked list markup may be kept as `WorkerSimpleList`") — the plan should treat that fallback as the DEFAULT, not a contingency, unless the orchestrator confirms 53 has already merged to `master` before 54 executes.

**Primary recommendation:** Do the deletion as its own last wave (already Claude's Discretion in CONTEXT), reuse every data/action function named above verbatim, add exactly two new pure-function/data surfaces (admin-health classifier + 3-field extension to `listSiteForOrg`), and budget one full wave for the bundle-gate marker rewrite + the ~15-file test repoint sweep — that sweep is bigger than the new UI code.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `/governance` route (inbox rows, filter chips) | Frontend Server (SSR shell) + Client (interactive list) | API/Backend (`listGovernanceQueue`, `listAdminSopRows` slice, new "machines with no procedures" query) | Existing pattern: server-gated page, client `useQuery` fetchers — mirrors `admin/sops/page.tsx`'s historical shape and the current lens pattern |
| Inbox row actions (Assign owner / Review / Approve / Retry / Finish / Add) | Client (buttons dispatch to existing server actions) | API/Backend (`setSopOwner`, `approveStep`, `confirmSopCurrent`, ParseJobStatus retry, builder links) | No new mutations — every action already exists; the inbox is a new read+compose, not a new write surface |
| Floor health repaint (admin pins) | Client (`PlantStage` + a new pure classifier) | API/Backend (admin-gated site+SOP-health query) | Mirrors Phase 52's worker plant exactly — `PlantStage`/`scene.ts` are role-agnostic; only the pin-colour classifier and the data feeding it are admin-specific |
| Admin machine panel (owner/rev per SOP) | Client (new sibling to `MachinePanel`) | — | `MachinePanel.tsx`'s own doc comment states the admin variant is a Phase 54 addition, not a prop toggle — governance fields (owner/rev) must never enter the worker component's bundle |
| Admin `/sops` library table | Client (data table + chips) | API/Backend (`listAdminSopRows`, extended) | `listAdminSopRows` already returns ~80% of every column the table needs; this is composition, not a new data layer |
| Deletion + reference sweep | Client/Server (source deletion) | — | No runtime tier — this is a source-tree operation, verified by Playwright source-contract specs, not by any running server |

## User Constraints (from CONTEXT.md)

### Locked Decisions

**`/governance` (ADM-01)**
- D-01: Route `src/app/(protected)/governance/page.tsx`, admin/safety_manager gated via `requireAdminContext()`; header "Governance" points here (no more `?view=attention`). The old `/sops?view=attention` deep link redirects to `/governance` (one line in the resolver, then deleted with the lens).
- D-02: Inbox rows are derived from EXISTING data, no new tables: `listGovernanceQueue` (Phase 28/29 flags: no owner, review overdue, awaiting approval), `parse_jobs` failed/stuck (existing "Still working" scope), and "machines with no procedures" (Phase 51 `site_machines` left-joined to `sop_machines`). Each row: severity dot (red no-owner/stuck · amber overdue · blue approve-me · grey housekeeping), title, machine · state · reason, age, and ONE action button: Assign owner (opens the existing owner picker), Review (→ builder), Approve (existing `approveStep`), Retry (existing parse retry), Finish (→ builder), Add (→ `/admin/sops/new` with the machine preselected if the creation flow supports it, else plain). Counted filter chips: All · No owner · Overdue · Approve · Stuck · Machines. Empty inbox = "All clear" state (this is the goal state, so it gets real weight, not an apology).
- D-03: The GovernanceQueueRow component and `approveStep` gating are preserved (APR-03/04 hard constraint from Phase 29/41): reuse `GovernanceQueueRow` or its logic for rows that come from the governance queue; do not re-implement approver gating.

**Floor health (ADM-02)**
- D-04: Beside the inbox (right column, ~420 px on desktop; stacked below on phone) the org's scene renders through 52's `PlantStage` in a new **admin repaint** mode: pin = worst of `no owner` (red `!`) › `review overdue` (amber `↻`) › ok (small green dot) across the machine's SOPs; red/amber machines get the dashed tint; the health derivation is a pure function next to `derivePlantPins` in `src/lib/sop/worker-signal.ts` (or a sibling `src/lib/sop/admin-health.ts` — one module, unit-tested). Data comes from a new admin-gated action in `src/actions/site.ts` (or a sibling) that returns machines + per-SOP `{owner_user_id, review_due_at, status}` for the org.
- D-05: Clicking a pin opens the **admin machine panel** (52's `MachinePanel` gains an `admin` variant or a sibling component): sprite, department, name, SOP rows with `NO OWNER` / `REVIEW DUE` / `DRAFT` / `OK` badges, `owner · rev` line per SOP, `Open` (SOP page) and `Edit` (builder) per row, "Add one" when empty. No worker to-do badges here.
- D-06: Orgs with no site: the floor column shows a compact "Draw your site" card linking `/admin/site` — never blank.

**Admin `/sops` table (ADM-03)**
- D-07: For admins (any width ≥1024; phone admins fall through to the worker phone home from 53), `/sops` renders a plain table: SOP · Machine (mono, from `sop_machines`) · Status (`LIVE` / `DRAFT` / `STUCK`) · Owner · **Checks** · Review. Checks = five 18 px circles, left→right: owner · reviewed within 12 months · approved (published, or no chain required) · assigned to someone (department or person grant) · converted cleanly (no failed parse); green ✓ / amber ! / red ×. Five greens = nothing to do. Row click → the SOP page; an `Edit` link → builder (one chain, as Phase 41 SUR-04 required).
- D-08: Chips above the table: Where (department, from the org's rows) · Status · Owner (me / none / person) · Checks (has a red / has an amber). Search = the existing toolbar input. Deep links `?departments=`, `?collection=`, `?status=`, `?owner=me` keep resolving onto the table (Phase 33/41 contracts). `?view=access` keeps opening the Access lens (out of scope to move).
- D-09: **Deletions**: `src/components/sop/AdminSopSurface.tsx`, `src/components/sop/lenses/AdminAttentionLens.tsx`, `AdminStatusLens.tsx` (the Access lens survives — see scope), `src/components/sop/MillerPrimitives.tsx`, `src/components/sop/SopWorkerBrowser.tsx` (its `topSignal` already moved to `worker-signal.ts` in 52; move any remaining shared helper out first), `src/components/admin/SopMillerBrowser.tsx` if nothing else imports it. A repo sweep spec fails on any import of, or href/query targeting, a deleted module or the `view=attention` parameter (a deletion guard asserts absence of REFERENCES, 2026-08-04). Every spec that pinned those files is repointed or deleted in the same commit (2026-07-13 stale-guard rule), including the phase28/30/33/41 source-contract specs that grep them — list them in the plan by grepping `tests/` for each filename first.
- D-10: The worker phone list (`<1024`) is now 53's phone home; the worker desktop is 52's plant. After this phase, `sops/page.tsx` must contain no Miller frame at all. If an org has no site, workers get a simple list (the existing stacked list markup may be kept as `WorkerSimpleList`, extracted from `SopsSection`, or the 52 fallback path — whichever leaves the smallest page); admins always get the table.

**Nav, map, matrix, evals (ADM-04)**
- D-11: `TopHeader.tsx`: Governance → `/governance`; SOPs stays `/sops`. `journeys.ts`: governance journey, admin `/sops` table journey; `/pathways` shows 0 not-mapped. `.planning/codebase/CAPABILITY-MATRIX.md`: inbox actions per role. `src/lib/uat/tests.ts` updated.
- D-12: `tests/evals/sop-surface.eval.ts` is REWRITTEN for the new surfaces (admin table with checks; deep links; worker desktop = plant or fallback; Governance inbox + floor + panel; access lens still reachable) and passes on the deployed site; `tests/evals/governance.eval.ts` covers the inbox in the eval-site org (seed: the fixture SOP with no owner → red pin on EVAL Press → Assign owner clears it; "EVAL Oven" with no procedures → Machines row). Screenshots read by the orchestrator.
- D-13: Bundle: admin surfaces stay out of worker routes (dynamic module gated on `useIsAdmin()` exactly as Phase 41 did); `/sops/page` and `/sops/[sopId]/page` within ±2 KB of the untouched baseline; deleting the Miller code should REDUCE the page chunk — record the numbers, never recapture.

### Claude's Discretion
- Whether the table is a plain `<table>` or a `role="grid"` div — plain `<table>` preferred (native semantics, tokens only).
- Whether the inbox and table share one query or two; keep it to what the admin needs per screen.
- Plan the deletions as the LAST wave so every earlier wave's specs keep running against real code.

### Deferred Ideas (OUT OF SCOPE)
- Moving Access wiring under Team; review-due calendar ("Coming up"); "SOPs you look after" side card (cheap, add if the inbox column has room); CSV export of the checks table.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ADM-01 | `/governance` is its own route: inbox of one-action rows, counted filter chips, empty state | `listGovernanceQueue()` (src/actions/governance.ts) already returns owner/review/approval flags; `GovernanceQueueRow` + `approveStep`/`OwnerPicker` already implement the exact gating and actions D-03 requires reuse of. New: a "stuck converting" slice (reuse `listAdminSopRows({status:'failed'})`'s `stuck` boolean) and a "machines with no procedures" query (left-join `site_machines`↔`sop_machines`, trivial — `listSiteForOrg` already returns both) |
| ADM-02 | Floor repainted by health; pin opens admin machine panel | `PlantStage`/`scene.ts`/`zoneColour` (Phase 52) are role-agnostic and reusable as-is; new: an `admin-health.ts` pure classifier (sibling to `worker-signal.ts`, same module pattern) + 3-field extension to `listSiteForOrg`'s `sops` select; new: an admin variant of `MachinePanel` (worker `MachinePanel.tsx`'s own comment says this governance view is "the admin variant Phase 54 adds") |
| ADM-03 | Admin `/sops` = table with checks row; Miller/lens code deleted | `listAdminSopRows()` (src/lib/sop-list/admin-rows.ts, src/actions/admin-sop-list.ts) already returns `ownerLabel`, `status`, `flagLabel`/`flagStyle` (from governance), `departments`, `age`; missing only the machine column (join `sop_machines`) and the 5-circle checks derivation (composable from existing fields, see Code Examples) |
| ADM-04 | Header/journeys/matrix/evals reflect new surfaces; repo sweep proves no dead reference | `TopHeader.tsx:146` is a 1-line change; `journeys.ts` has ~8 entries referencing `/sops?view=attention`/`/sops?view=access`/"Admin scope group" that all need updating; `CAPABILITY-MATRIX.md` lines 46-47, 64 name the deleted lenses explicitly; `tests/phase30/dead-weight.spec.ts` and `tests/phase41/reference-sweep.spec.ts` are the two existing reference-sweep patterns to extend, not reinvent |

## Deletion Inventory

Grepped exhaustively (`grep -rln <symbol> src/ tests/`) on 2026-09-29 against the current tree. This is the authoritative list for the plan's last wave.

| File | src/ importers | Test files referencing it | Action |
|------|-----------------|---------------------------|--------|
| `src/components/sop/AdminSopSurface.tsx` | `sops/page.tsx` (dynamic import), `sops-nav-types.ts` (imports `AdminScope` type) | `tests/lint/no-static-admin-lens-import.spec.ts`, `tests/phase28/governance-queue.spec.ts`, `tests/phase28/library-and-worker.spec.ts`, `tests/phase30/admin-nav.spec.ts`, `tests/phase30/governance-fold.spec.ts`, `tests/phase30/list-rows.spec.ts`, `tests/phase32/library-filter-deeplink.spec.ts`, `tests/phase33/sop-drilldown.spec.ts`, `tests/phase41/merged-surface.spec.ts`, `tests/phase52/plant-render-seam.spec.ts` | DELETE. `sops-nav-types.ts` becomes dead once this and the admin render branch are gone (see below) |
| `src/components/sop/lenses/AdminAttentionLens.tsx` | `AdminSopSurface.tsx` (dynamic import) | `tests/lint/no-static-admin-lens-import.spec.ts` (ALLOWED_FILES entry), `tests/phase28/governance-queue.spec.ts`, `tests/phase28/library-and-worker.spec.ts`, `tests/phase29/queue-approve-action.spec.ts`, `tests/phase30/governance-fold.spec.ts`, `tests/phase41/merged-surface.spec.ts`, `tests/phase41/status-attention-lenses.spec.ts` | DELETE. Logic (grouped-by-flag queue) moves into the new `/governance` inbox; `GovernanceQueueRow` is reused (see below) |
| `src/components/sop/lenses/AdminStatusLens.tsx` | `AdminSopSurface.tsx` | `tests/lint/no-static-admin-lens-import.spec.ts`, `tests/phase30/list-rows.spec.ts`, `tests/phase32/library-filter-deeplink.spec.ts`, `tests/phase41/merged-surface.spec.ts`, `tests/phase41/status-attention-lenses.spec.ts` | DELETE. Its data source `listAdminSopRows` is reused verbatim by the new table |
| `src/components/sop/MillerPrimitives.tsx` | `sops/page.tsx` (worker's own scope+department column), `AdminSopSurface.tsx` | none found | DELETE once both importers are gone. **Not just an admin dependency** — `sops/page.tsx` imports `MillerColumnHeader`/`MillerGroupLabel`/`MillerItem` for the WORKER's own scope column and department rows too; D-10 ("no Miller frame at all") means this whole worker rendering path is also removed, not only the admin one |
| `src/components/sop/SopWorkerBrowser.tsx` | `sops/page.tsx` | `tests/phase30/dead-weight.spec.ts`, `tests/phase36/worker-library-chip.spec.ts`, `tests/phase41/nav-and-shim.spec.ts`, `tests/phase41/status-attention-lenses.spec.ts`, `tests/phase52/plant-pins-no-storage.spec.ts` | DELETE. `tests/phase52/plant-pins-no-storage.spec.ts:75-80` asserts this file imports (not redefines) `topSignal`/`plantRelState` from `worker-signal.ts` — repoint that assertion to whatever component replaces it (`WorkerSimpleList` or equivalent) |
| `src/components/admin/SopMillerBrowser.tsx` | `AdminStatusLens.tsx` only (the two other grep hits — `SopWorkerBrowser.tsx`, `src/lib/sop-list/admin-rows.ts` — are doc-comment mentions, not imports; verified by reading both files in full) | `tests/lint/no-static-admin-lens-import.spec.ts` (LENS_SYMBOLS entry), `tests/phase30/list-rows.spec.ts`, `tests/phase32/library-filter-deeplink.spec.ts`, `tests/phase41/bundle-gate.spec.ts` (forbidden-marker literals — see Pitfall #1), `tests/phase41/nav-and-shim.spec.ts`, `tests/phase41/reference-sweep.spec.ts` (line 129-130 asserts this file contains `/admin/sops/builder/` — the Edit-link source-of-truth moves to the new table), `tests/phase41/status-attention-lenses.spec.ts` | DELETE |
| `src/components/sop/sops-nav-types.ts` (**not named in CONTEXT — found by this research**) | `sops/page.tsx`, `AdminSopSurface.tsx` — confirmed via `grep -rln "sops-nav-types\|SopNav\b\|AdminRenderProps"`, **zero other consumers** | none found | DELETE (or shrink to just `WorkerScope`, inlined into `sops/page.tsx`). Once the admin branch stops sharing a `nav`/`onNavChange` prop contract with a worker `SopsSection`, `SopNav`, `SopScope`, `AdminRenderProps`, and `EMPTY_ADMIN` (currently defined at `sops/page.tsx:65-72`) are all dead. Recommend the admin and worker render paths become two independent components (`isAdmin ? <AdminLibraryTable/> : <WorkerHome/>`) with NO shared nav-state contract — this is a bigger simplification than D-09 literally asked for but is a direct consequence of deleting `AdminSopSurface` and follows "deletion over addition" |

**Not deleted (confirmed no code dependency on the deleted files):**
- `src/components/sop/lenses/AdminAccessLens.tsx` — imports only `@tanstack/react-query`, `listAdminAccessData`, `WiringPatchBayShell`. Zero imports from `MillerPrimitives.tsx` or `AdminSopSurface.tsx`. Its `onBack` callback and "← Back to your SOPs" affordance need a new home once `AdminSopSurface`'s `backToWorkerAll()` is gone — the new admin `/sops` page must own this small resolve/back logic itself (a handful of lines, not a new module).
- `src/components/admin/governance/GovernanceQueueRow.tsx` — currently imported ONLY by `AdminAttentionLens.tsx` (its sole consumer). Safe to keep and restyle for the new inbox row shape, or safe to delete and re-derive — D-03 sanctions either. **Recommend keeping and restyling** since it already contains the exact `approveStep`/`isCallerNextApprover`/`OwnerPicker` gating D-03 requires be preserved verbatim, and it has zero other callers so there is no compatibility risk in changing its markup.
- `src/lib/governance/flag-display.ts` (`FLAG_PRIORITY`/`FLAG_STYLE`/`FLAG_LABEL`/`FLAG_DESC`) — plain module, still needed by the new inbox and by `listAdminSopRows`. Keep as-is.

## Architecture Patterns

### System Architecture Diagram

```
Admin visits /governance ──▶ page.tsx (server, requireAdminContext)
                                  │
                                  ├─▶ client: useQuery(['governance-queue']) ──▶ listGovernanceQueue()
                                  │        (owner/review/approval flags, unchanged from Phase 28/29)
                                  │
                                  ├─▶ client: useQuery(['admin-sop-rows','failed']) ──▶ listAdminSopRows({status:'failed'})
                                  │        (stuck-converting rows, unchanged from Phase 41)
                                  │
                                  ├─▶ client: useQuery(['machines-no-procedures']) ──▶ listSiteForOrg()
                                  │        (machines with zero sop_machines links, filtered client-side)
                                  │
                                  ├─▶ InboxRow[] composed from the three queries above, severity-sorted
                                  │        action button dispatches to: setSopOwner / approveStep /
                                  │        confirmSopCurrent / builder link / /admin/sops/new
                                  │
                                  └─▶ right column: useQuery(['site-admin-health']) ──▶ listSiteForOrg()
                                           (extended: owner_user_id/review_due_at/status per SOP)
                                                │
                                                ├─▶ admin-health.ts: machineHealth(sopIds, sopsById) → 'bad'|'due'|'ok'|null
                                                ├─▶ PlantStage (Phase 52, reused verbatim) — pins painted from machineHealth
                                                └─▶ click pin → AdminMachinePanel (new sibling to worker MachinePanel)
                                                         owner · rev per SOP, Open (SOP page) / Edit (builder)

Admin visits /sops (isAdmin) ──▶ page.tsx (client, useIsAdmin())
                                  │
                                  └─▶ AdminLibraryTable = dynamic(ssr:false) ── replaces AdminSopSurface
                                           │
                                           └─▶ useQuery(['admin-sop-rows', filters]) ──▶ listAdminSopRows()
                                                    (extended: + machine name via sop_machines join,
                                                     + checks derivation, see Code Examples)
                                           │
                                           └─▶ ?view=access still dynamic-imports AdminAccessLens
                                                    (unchanged, full-width takeover, same as today)

Worker visits /sops (!isAdmin) ──▶ page.tsx
                                  │
                                  ├─▶ ≥1024, org has site  → PlantHome (Phase 52, unchanged)
                                  ├─▶ <1024, org has site  → Phase 53's phone home IF IT EXISTS,
                                  │        else the existing stacked list (WorkerSimpleList fallback)
                                  └─▶ no site at all       → WorkerSimpleList (extracted from today's
                                           SopsSection, no Miller frame, no MillerPrimitives import)
```

### Recommended Project Structure
```
src/app/(protected)/governance/page.tsx        # NEW — real route, requireAdminContext()
src/components/admin/governance/
  InboxRow.tsx                                  # NEW — or restyle GovernanceQueueRow.tsx in place
  AdminFloorHealth.tsx                          # NEW — composes PlantStage + AdminMachinePanel + admin-health.ts
  AdminMachinePanel.tsx                          # NEW — sibling to src/components/sop/plant/MachinePanel.tsx
src/lib/sop/admin-health.ts                      # NEW — pure classifier, sibling module to worker-signal.ts
src/components/admin/AdminLibraryTable.tsx       # NEW — replaces AdminSopSurface.tsx on /sops
src/app/(protected)/sops/page.tsx                # REWRITTEN — isAdmin ? <AdminLibraryTable/> : <WorkerHome/>
                                                  # no shared SopNav contract, no MillerPrimitives import
src/components/sop/WorkerSimpleList.tsx          # NEW (extracted) — the no-site / phone-not-built fallback
```

### Pattern 1: Reuse the lens-composition idiom, but flatten it
**What:** Every prior admin lens (`AdminAttentionLens`, `AdminStatusLens`, `AdminAccessLens`) follows the same shape: `'use client'`, `useQuery` against an existing server action, loading skeleton, error state, then render. The new `AdminLibraryTable` and the `/governance` inbox components should follow the identical shape — this is not a new pattern to invent.
**When to use:** Any new admin-only data view on `/sops` or `/governance`.
**Example:**
```typescript
// Source: src/components/sop/lenses/AdminStatusLens.tsx (existing, verbatim pattern to follow)
const { data, isLoading } = useQuery({
  queryKey: ['admin-sop-rows', status, ownerOnly, departments ?? null, collection ?? null],
  queryFn: () => listAdminSopRows({ status, owner: ownerOnly ? 'me' : undefined, departments, collection }),
  staleTime: 1000 * 60,
})
```

### Pattern 2: The admin-health classifier mirrors worker-signal.ts exactly
**What:** `src/lib/sop/worker-signal.ts` is explicitly "the ONE place a worker's SOP state is classified" (per its own header comment, CLAUDE.md 2026-09-27 rule). The admin equivalent must follow the identical discipline: one pure module, no I/O, no `Date.now()` hoisted to module scope, importable from client and server.
**When to use:** Any admin pin/badge/check derivation (floor health, machine panel badges, table checks column).
**Example:**
```typescript
// Source: pattern lifted directly from src/lib/sop/worker-signal.ts's derivePlantPins/plantRelState shape
// NEW FILE: src/lib/sop/admin-health.ts
export type AdminSopHealth = {
  id: string
  ownerUserId: string | null
  reviewDueAt: string | null
  status: string
}

export type MachineHealth = 'bad' | 'due' | 'ok' | null

/** Worst of no-owner (bad) > review-overdue (due) > ok, across a machine's linked SOPs. */
export function machineHealth(
  sopIds: ReadonlyArray<string>,
  sopsById: ReadonlyMap<string, AdminSopHealth>,
  now = new Date()
): MachineHealth {
  const sops = sopIds.map((id) => sopsById.get(id)).filter((s): s is AdminSopHealth => Boolean(s))
  if (sops.length === 0) return null
  if (sops.some((s) => !s.ownerUserId)) return 'bad'
  if (sops.some((s) => s.reviewDueAt && new Date(s.reviewDueAt) < now)) return 'due'
  return 'ok'
}
```

### Anti-Patterns to Avoid
- **Reintroducing a shared `SopNav`/`AdminRenderProps` contract between the admin table and a worker component.** The old design existed only because both surfaces shared ONE Miller frame. They no longer share layout at all (table vs. plant/list) — a shared nav-state type is now pure coupling with no payoff. Two independent components, gated by `isAdmin`, is simpler and matches D-07/D-10's "admins always get the table" framing.
- **Rebuilding `approveStep`/`isCallerNextApprover` gating inline in the new inbox row.** D-03 is explicit and APR-03/04 is a hard constraint from Phase 29/41 — import and call the existing functions, never re-derive "is this caller the next approver" logic.
- **Re-deriving "stuck converting" from `parse_jobs` directly.** `listAdminSopRows({status:'failed'})` already computes this exact boolean (`stuck: inFlight && Date.now() - created_at > STUCK_AFTER_MS`, `STUCK_AFTER_MS` = 1 hour) — reuse it, don't add a second classifier for the same signal (2026-09-27 "same classifier written twice will drift" applies here too, even though the literal instruction only names worker-facing classifiers).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Governance flag classification (no owner / overdue / due soon / awaiting approval / stale role) | A new inbox-specific flag deriver | `classifyGovernanceRow()` in `src/lib/governance/classify.ts` via `listGovernanceQueue()` | Already pure, already unit-tested (`src/lib/governance/__tests__/classify.test.ts`), already the sole source of governance flags project-wide |
| Approver gating ("is the current viewer allowed to click Approve on this row") | Inline `role === approval_snapshot[nextIndex].role` checks | `resolveNextStepIndex`/`stepMatchesCaller` (already called inside `listGovernanceQueue`, exposed as `row.isCallerNextApprover`) + `approveStep()` in `src/actions/approvals.ts` | This is the APR-03/04 hard constraint — a second implementation is a second place for the two to drift, and drift here is a security-relevant governance bug, not cosmetic |
| Owner reassignment UI | A new owner dropdown/modal | `OwnerPicker` (`src/components/admin/governance/OwnerPicker.tsx`) — already does the exact "≤2-click inline reassignment via `getOrgMembers()` + `setSopOwner()`" D-02 describes | Zero other callers besides `GovernanceQueueRow` today — free to reuse without touching any existing consumer |
| Parse-stuck "Retry" action | A new retry button/mutation | Link the inbox row to `/admin/sops/builder/[sopId]` where `ParseJobStatus.tsx`'s existing retry affordance (`canRetry`, `onRetry`) already renders | `ParseJobStatus` already gates retry correctly per `inputType` (`ai_prompt` rows cannot retry) — an inbox-inline retry would need to reimplement that gate |
| Camera/pan/zoom floor rendering | A second scene renderer for admin | `PlantStage` (`src/components/sop/plant/PlantStage.tsx`) unchanged — it takes `machines: PlantStageMachine[]` with caller-supplied `pin`/`highlighted`/`zoneColour`, so admin health just supplies different `pin` values | `PlantStage`'s own doc comment states camera maths "all come from `src/lib/site/scene.ts` — no hand-rolled copies here (D-07)"; the component has zero worker-specific logic baked in |
| Admin site/SOP read | A brand-new admin site query module | Extend `listSiteForOrg()` in `src/actions/site.ts` (already admin-gated via `requireAdminContext()`, already returns `machines`, `links`, `sops: SiteSopOption[]`) — add `owner_user_id`/`review_due_at`/`status` to its `sops` select | Adding 3 columns to an existing `.select()` on an already-admin-gated, already-org-scoped action is strictly additive and lower-risk than a parallel query path |
| Machine ↔ SOP join for the table's Machine column | A new query per row | `listSiteForOrg()`'s `links: SopMachineLink[]` (already fetched org-wide, `{sop_id, machine_id}` pairs) — build a `Map<sopId, machineName>` once, client-side, for the table render | Same data `listSiteForOrg` already fetches for the floor panel — one query, two consumers, per CONTEXT's own "whether the inbox and table share one query" discretion note |

**Key insight:** This phase's entire data layer is a solved problem from Phase 28/29/41/51/52. The only genuinely new code is (a) one ~15-line pure classifier, (b) a 3-field `.select()` extension, and (c) a "machines with zero `sop_machines` links" filter over data already fetched. Everything else is composition and deletion.

## Common Pitfalls

### Pitfall 1: The bundle-gate marker self-validation will hard-fail `next build` unless the plan rewrites `GATED_ROUTES`
**What goes wrong:** `scripts/check-bundle-size.ts`'s `collectSelfValidationCorpus()` (lines 312-349) requires every string literal declared in any route's `forbiddenMarkers` array to be found SOMEWHERE in the scanned build output (static chunks + both gated routes' page bundles + the `/admin/sops` server dir). Today `/sops/page`'s forbidden markers include `'Pick another scope on the left.'` / `'Pick a SOP to see its detail here.'` (from `SopMillerBrowser.tsx`) and `'Owner role gone'` (from `GovernanceQueueRow.tsx`, also `flag-display.ts`'s `FLAG_LABEL.stale_role`). Once `SopMillerBrowser.tsx` is deleted outright, its two literal strings cease to exist ANYWHERE in the codebase — `npm run build`'s postbuild `check-bundle-size` step will fail with `"forbidden marker ... not present anywhere in the build"`, unrelated to whether the actual isolation property still holds.
**Why it happens:** The self-validation check exists to prevent a *different* failure mode (a marker that silently stops being a valid proof because the guarded code was refactored elsewhere) — it was not designed for "the guarded component was deleted entirely."
**How to avoid:** In the same wave as the deletion, rewrite `GATED_ROUTES['/sops/page'].forbiddenMarkers`: (1) remove the `SopMillerBrowser.tsx` marker group entirely (nothing to guard — the component is gone), (2) for the `GovernanceQueueRow`/`'Owner role gone'` group, either keep it (if `GovernanceQueueRow`/`flag-display.ts`'s `FLAG_LABEL` still renders somewhere reachable from `/governance`, which is a NEW route not currently scanned by `collectSelfValidationCorpus()` — extend the corpus-collection function's directory walk to also include `.next/server/app/(protected)/governance`) or drop it too. The `WiringPatchBayShell` marker group (`'Search org or collections…'`, `'follows collection'`) stays unchanged — `AdminAccessLens` survives.
**Warning signs:** `npm run build` (or its postbuild step) fails with `check-bundle-size: ❌ forbidden marker "..." not present anywhere in the build` — this is not a bundle-size regression, it is a stale-marker error, and the fix is to edit the script, not to add code back.

### Pitfall 2: Phase 53 has not been built — `/sops/page.tsx` must not assume its phone-home component exists
**What goes wrong:** CONTEXT.md D-10 says the worker phone list "is now 53's phone home." As of this research (2026-09-29), `.planning/phases/53-phone-scan-or-ask/` contains only a `53-CONTEXT.md` — zero code, zero commits beyond the context doc. The roadmap marks Phase 53 and 54 as parallel (`53 ∥ 54`), so there is no ordering guarantee that 53 merges before 54 executes.
**Why it happens:** The orchestrator compiled both phase contexts on the same day (2026-09-29) from the same design contract, describing the END STATE of the milestone, not the state of the tree at Phase 54's execution time.
**How to avoid:** Before wiring the `<1024px` branch of the new `sops/page.tsx`, check whether `src/components/sop/phone/` (or wherever 53 lands its phone home) actually exists in the tree. If it does not, D-10's own fallback wording is the correct default: extract today's stacked list into `WorkerSimpleList` and use it unconditionally below 1024px. Do not add a conditional `next/dynamic` import pointing at a component Phase 53 hasn't created yet — that would break the build for Phase 54 if executed first.
**Warning signs:** A `next/dynamic(() => import('.../PhoneHome'))` call with no corresponding file on disk — this fails at build time, not silently.

### Pitfall 3: `MillerPrimitives.tsx` is not admin-only — deleting it also removes the WORKER's own scope/department column
**What goes wrong:** A plan that reads D-09 as "delete the admin lens files" might leave `sops/page.tsx`'s worker-side `workerScopeColumn` (the `MillerGroupLabel`/`MillerItem`-based "Your SOPs"/"Library" scope rows and the "By department" rows, lines ~594-704 of the current file) in place, assuming it's unrelated to the admin deletion. It is not — D-10 explicitly requires "no Miller frame at all" after this phase, for EVERY role.
**Why it happens:** `MillerPrimitives.tsx`'s own header comment frames it as existing "so the admin-only lazy chunk ... can render its Miller rows with the SAME primitives the worker column uses" — reading only that comment suggests the primitives are worker-owned infrastructure that admin borrows, when actually the entire worker Miller frame is *also* being retired this phase (replaced by `PlantHome` on desktop, `WorkerSimpleList`/phone-home below 1024px).
**How to avoid:** Grep `sops/page.tsx` for `MillerColumnHeader`/`MillerGroupLabel`/`MillerItem` before finishing the deletion wave — all three must be gone from that file, not just from the admin components.
**Warning signs:** `MillerPrimitives.tsx` still has an importer after the "deletion" wave (the deletion guard spec should assert zero importers, not just that the three named admin files are gone).

### Pitfall 4: The `/admin/governance` redirect shim also needs updating, not just `/admin/sops` and `TopHeader`
**What goes wrong:** `src/app/(protected)/admin/governance/page.tsx` already exists (shipped Phase 30) and currently redirects to `/sops?view=attention`, preserving a legacy `?filter=` param. If the plan only updates `TopHeader.tsx` and the `/admin/sops` shim, this second shim keeps sending legacy bookmarks to a dead `?view=attention` query on the new table page instead of to `/governance`.
**Why it happens:** CONTEXT.md's own text only explicitly names "the old `/sops?view=attention` deep link" — it does not call out that TWO existing files encode that redirect (`admin/sops/page.tsx`'s `view` passthrough, and `admin/governance/page.tsx`'s hardcoded `qp = new URLSearchParams({ view: 'attention' })`).
**How to avoid:** Update `src/app/(protected)/admin/governance/page.tsx` to `redirect('/governance' + (params.filter ? '?filter=...' : ''))` (confirm whether the new inbox even accepts a `?filter=` param — if not, drop it and just redirect to `/governance`). Update `admin/sops/page.tsx`'s `view === 'attention'` branch to target `/governance` instead of `/sops?view=attention`.
**Warning signs:** `tests/phase41/merged-surface.spec.ts` test D and `tests/evals/sop-surface.eval.ts` test D both assert `/admin/sops?view=access` and `/admin/sops?view=attention` redirect behaviour — both need repointing, and both would be an easy place to notice this gap if run early.

### Pitfall 5: `journeys.ts` has ~8 separate entries referencing the deleted surfaces — this is bigger than a single edit
**What goes wrong:** Grepping `journeys.ts` for `attention`/`admin/sops`/`view=access`/`governance` returns hits across at least 4 distinct journeys (`admin-onboarding` around line 298-311, the dedicated `governance-queue` journey starting line 576, the worker `plant` entry at line 145 which explicitly says "Admins still see today's SOP list here (Phase 54 repaints their view)" — itself now stale prose to update, and the access-map entries at 448/452/464). A plan that treats this as "update the Governance link" under-scopes it.
**Why it happens:** `journeys.ts` was written incrementally across Phase 30/33/41 and accumulated multiple descriptions of the same now-dead lens/route shape.
**How to avoid:** Grep `src/lib/journeys/journeys.ts` for the literal strings `view=attention`, `view=access`, `Admin scope group`, `AdminAttentionLens`, `SopMillerBrowser` (if named anywhere) BEFORE editing, and touch every hit, not just the ones the plan happens to notice while adding the new `/governance` journey. Verify `/pathways` reports 0 not-mapped afterward (ADM-04's own acceptance bar).
**Warning signs:** `/pathways` "All screens" panel flags `/governance` as not-mapped, or still shows a mapped-but-stale description for the deleted `/sops?view=attention` screen.

## Code Examples

### Extending `listSiteForOrg` for admin health (D-04)
```typescript
// Source: src/actions/site.ts, existing listSiteForOrg (lines 49-142) — additive change only
// CURRENT (line 122-127):
const { data: sopRows, error: sopErr } = await db
  .from('sops')
  .select('id, title')
  .eq('organisation_id', orgId)
  .not('title', 'is', null)
  .order('title', { ascending: true })

// EXTENDED (adds the 3 fields D-04 asks for; SiteSopOption type in
// src/lib/validators/site.ts grows the same 3 optional fields):
const { data: sopRows, error: sopErr } = await db
  .from('sops')
  .select('id, title, owner_user_id, review_due_at, status')
  .eq('organisation_id', orgId)
  .not('title', 'is', null)
  .order('title', { ascending: true })
```

### Checks-column derivation for the library table (D-07) — composed from existing `listAdminSopRows` output, no new query
```typescript
// Source: pattern derived from src/lib/sop-list/admin-rows.ts's MillerSop shape
// (this can live in a small pure helper next to admin-rows.ts, or inline in the table component)
type Check = 'ok' | 'warn' | 'bad'

function computeChecks(sop: MillerSop, machineIds: string[]): Record<'owner' | 'review' | 'approved' | 'assigned' | 'converted', Check> {
  return {
    owner: sop.ownerLabel ? 'ok' : 'bad',
    // sop.updatedAt / flagLabel already encode overdue/due_soon from governance;
    // reuse flagLabel rather than re-deriving from review_due_at a second time.
    review: sop.flagLabel === 'Overdue' ? 'bad' : sop.flagLabel === 'Due soon' ? 'warn' : 'ok',
    approved: sop.status === 'published' ? 'ok' : sop.flagLabel === 'Awaiting approval' ? 'warn' : 'bad',
    assigned: sop.allDepartments || sop.departments.length > 0 ? 'ok' : 'bad',
    converted: sop.stuck ? 'bad' : 'ok',
  }
}
```
Note: this reuses `flagLabel` (already computed server-side by `listAdminSopRows` from `listGovernanceQueue`'s classification) rather than re-deriving overdue/due-soon thresholds a second time — consistent with the "one classifier" rule and avoiding a second place these two views could disagree.

### Reusing `GovernanceQueueRow`'s exact gating (D-03) inside a restyled inbox row
```typescript
// Source: src/components/admin/governance/GovernanceQueueRow.tsx lines 89-113 — the
// EXACT conditional to preserve verbatim if GovernanceQueueRow is restyled in place
// rather than rewritten as a new component:
row.flags.includes('awaiting_approval') && row.isCallerNextApprover
  ? /* Approve button → approveStep(row.id) */
  : row.flags.includes('unowned')
    ? /* <OwnerPicker sopId={row.id} ownerUserId={row.ownerUserId} ownerLabel={row.ownerLabel} /> */
    : row.flags.includes('stale_role')
      ? /* Link to /admin/sops/{row.id}/assign */
      : /* Confirm current → confirmSopCurrent(row.id) */
```

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Phase 53 will NOT have landed by the time Phase 54 executes (verified only that it hasn't landed as of 2026-09-29 research time; the two phases are scheduled in parallel per ROADMAP.md) | Pitfall 2, Architecture Diagram | If 53 lands first, the plan should prefer its phone-home component over building/using `WorkerSimpleList` for the `<1024px` no-desktop-plant case — low risk either way since D-10 sanctions both, but the plan should check before assuming |
| A2 | "Machines with no procedures" (D-02's inbox category) should be computed client-side by filtering `listSiteForOrg()`'s `machines`/`links` (a machine with zero rows in `links`), not a new server query | ADM-01 requirements row, Don't Hand-Roll | If the admin's org has a very large machine count this client-side filter is trivially cheap (same data already fetched for the floor panel) — risk is low, but a reviewer should confirm `listSiteForOrg` is not already called twice unnecessarily if the inbox and floor panel end up as separate components with separate `useQuery` keys |
| A3 | `GovernanceQueueRow.tsx` is best RESTYLED in place (not deleted+rebuilt) since it has zero other callers today and already contains the exact gating logic D-03 requires | Deletion Inventory, Code Examples | If the plan instead deletes it and hand-derives the same gating in a new component, the risk is a subtle drift from `isCallerNextApprover`'s exact precedence order (approve-me checked BEFORE unowned BEFORE stale-role) — low risk if the plan copies the conditional verbatim as shown in Code Examples, higher risk if reimplemented from the sketch's prose alone |

**If this table is empty:** N/A — see above.

## Open Questions (RESOLVED 2026-09-29 — Q1: Retry links to the builder's parse state, no inline extraction; Q2: /governance is NOT bundle-gated; Q3: the governance eval resets the fixture SOP's owner to null in beforeAll and asserts it, never assumes)

1. **Does the new inbox's "Retry" action link to the builder, or trigger retry inline?**
   - What we know: `ParseJobStatus.tsx` (rendered inside the builder page) already has working retry logic gated on `inputType !== 'ai_prompt'`.
   - What's unclear: The sketch's inbox action verb is a single button per row with no page navigation implied by the visual design (other inbox actions like "Assign owner" are inline popovers). Retry inline would require extracting `ParseJobStatus`'s retry call into a reusable action.
   - Recommendation: Link to the builder (same as "Review"/"Finish") for the first cut — cheapest, reuses existing UI, avoids a new server-callable extraction. Note in the plan as a discretion point, not a blocker.

2. **Should `/governance` be added to `scripts/check-bundle-size.ts`'s `GATED_ROUTES`?**
   - What we know: SB-LINE-06 exists to protect the WORKER mobile bundle. `/governance` is an admin-only route with no worker equivalent.
   - What's unclear: Whether the orchestrator wants bundle discipline on every admin route going forward, or only on routes that share a chunk graph with a worker route (as `/sops/page` does).
   - Recommendation: Do not gate `/governance` — no worker route depends on it, so there is no isolation property to protect. Do fix the self-validation corpus scan for `/sops/page`'s remaining markers per Pitfall 1.

3. **Does the eval-site fixture SOP (`EVAL_SITE_SOP_TITLE`, created in `scripts/eval-fixtures.mjs`) actually have `owner_user_id = null`, matching D-12's "the fixture SOP with no owner → red pin on EVAL Press" requirement?**
   - What we know: The insert at `scripts/eval-fixtures.mjs` lines ~85-95 sets `uploaded_by` but the grep did not confirm `owner_user_id` is explicitly null vs. simply omitted (which defaults to null per schema).
   - What's unclear: Whether a later eval run (site-editor.eval.ts, plant-home.eval.ts) has since assigned an owner as a side effect.
   - Recommendation: The governance eval's Wave-0 setup should explicitly assert/reset `owner_user_id IS NULL` on the fixture SOP before each eval run, mirroring `plant-home.eval.ts`'s "Ensure the EVAL Press machine exists" idempotent-setup pattern (lines 154-181) rather than assuming the fixture state.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright (`@playwright/test`), source-contract style (fs.readFileSync + toContain/regex), not browser automation for unit-level specs |
| Config file | `playwright.config.ts` — project-per-phase convention, broad `testMatch: /tests\/phaseNN\/.*\.(spec\|test)\.ts$/` |
| Quick run command | `npx playwright test --project=phase54` |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ADM-01 | `/governance` renders inbox rows from `listGovernanceQueue`/`listAdminSopRows`/`listSiteForOrg`, counted chips, empty state | source-contract + unit | `npx playwright test --project=phase54 tests/phase54/governance-inbox.spec.ts` | ❌ Wave 0 |
| ADM-01 | `approveStep`/`OwnerPicker` gating preserved verbatim (no reimplementation) | source-contract | `npx playwright test --project=phase54 tests/phase54/inbox-reuses-governance-gating.spec.ts` | ❌ Wave 0 |
| ADM-02 | `machineHealth()` pure classifier: no-owner > overdue > ok precedence | unit (phase54-unit or reuse phase52-style unit project) | `npx playwright test --project=phase54 tests/phase54/admin-health.spec.ts` | ❌ Wave 0 |
| ADM-02 | Admin machine panel shows owner/rev, no worker to-do badges | source-contract | `npx playwright test --project=phase54 tests/phase54/admin-machine-panel.spec.ts` | ❌ Wave 0 |
| ADM-03 | Table checks column: 5 circles derived correctly from `MillerSop` fields | unit | `npx playwright test --project=phase54 tests/phase54/library-table-checks.spec.ts` | ❌ Wave 0 |
| ADM-03 | Deletion + reference sweep: zero importers of the 6 deleted files, zero `view=attention` references outside permitted redirect shims | source-contract (extend `tests/phase41/reference-sweep.spec.ts` pattern) | `npx playwright test --project=phase54 tests/phase54/deletion-sweep.spec.ts` | ❌ Wave 0 (LAST wave per Claude's Discretion) |
| ADM-04 | `journeys.ts` / `/pathways` 0 not-mapped | manual + existing `/pathways` page | N/A (visual + existing route-tree diff) | — |
| ADM-04 | Bundle gate: `/sops/page` and `/sops/[sopId]/page` within ±2 KB, markers rewritten (Pitfall 1) | source-contract + real `next build` | `npm run build` (postbuild `check-bundle-size`) | ✓ exists, needs GATED_ROUTES edit |
| ADM-01..04 | Deployed eval: inbox actions clear rows, floor pin colours, table checks, deep links | eval | `npm run eval -- --phase 54` against `tests/evals/governance.eval.ts` (new) + rewritten `tests/evals/sop-surface.eval.ts` | ❌ Wave 0 (governance.eval.ts), ✓ exists (sop-surface.eval.ts, needs rewrite) |

### Sampling Rate
- **Per task commit:** `npx playwright test --project=phase54`
- **Per wave merge:** `npm run test` (full suite) + `npm run build` (bundle gate)
- **Phase gate:** Full suite green + `npm run eval -- --phase 54` before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/phase54/` project registered in `playwright.config.ts` (broad `testMatch: /tests\/phase54\/.*\.(spec|test)\.ts$/`, mirroring the phase51/phase52 registration at lines 606/632 — verify via `npx playwright test --list --project=phase54` per the 2026-05-25 registration-verification rule)
- [ ] `src/lib/sop/admin-health.ts` stub + unit test scaffold (TDD: write `machineHealth()` test first)
- [ ] `tests/evals/governance.eval.ts` skeleton (self-skips without `EVAL_BASE_URL`, per project convention)
- [ ] Deletion-sweep spec scaffolded early (even as `test.fixme`) so its final wave has a clear target shape, following `tests/phase41/reference-sweep.spec.ts`'s exact pattern (exact-route regex, `PERMITTED_FILES` allowlist, comment-stripping before assertions)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V4 Access Control | yes | `requireAdminContext()` on the new `/governance` route and any new server action, identical to every existing admin surface — no new pattern needed |
| V5 Input Validation | yes | No new user-input-bearing mutations in this phase — every write (`setSopOwner`, `approveStep`, `confirmSopCurrent`) is an existing, already-validated action being reused, not rebuilt |
| V6 Cryptography | no | No new secrets/crypto surfaces |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-tenant read via a new admin query (`listSiteForOrg` extension) | Information Disclosure | Already mitigated — `listSiteForOrg()` uses the session client + explicit `.eq('organisation_id', orgId)` using the SESSION `organisationId` (never a fetched row's org), per the existing 2026-07-28 invariant this file already follows. The 3-field extension adds no new query, only 3 more selected columns on an already-scoped query — no new risk surface. |
| Privilege escalation via inbox action buttons | Elevation of Privilege | Not a new risk — every action button dispatches to an EXISTING server action (`setSopOwner`, `approveStep`, `confirmSopCurrent`) that already opens with `requireAdmin()`/`requireAdminContext()`. The inbox adds no new mutation, so no new escalation surface is introduced. |
| Deleted-route dead links becoming an open redirect or auth-bypass surface | Tampering | Not applicable here — the redirect shims (`/admin/sops`, `/admin/governance`) redirect to FIXED internal paths (`/governance`, `/sops?...`) built from a `URLSearchParams`, never from unvalidated user input reflected into a `Location` header beyond query-string passthrough already audited in Phase 41 (WR-01, 2026-07-13 note in `governance/page.tsx`'s own comment: "encoded, never interpolated raw"). |

## Environment Availability

Skipped — this phase has no new external dependencies (no new npm packages, no new third-party services, no new environment variables). Every data source (Supabase, existing RLS policies, existing storage buckets) is already live and exercised by Phase 28/29/41/51/52.

## Package Legitimacy Audit

Not applicable. This phase installs zero external packages — it is a pure composition + deletion phase against existing first-party code and already-approved dependencies (`@tanstack/react-query`, `zod`, `sharp` — all pre-existing, none newly introduced).

## Sources

### Primary (HIGH confidence — read in full from the live repository, 2026-09-29)
- `.planning/phases/54-admin-inbox-floor-health-library-table/54-CONTEXT.md` — locked decisions
- `.planning/ROADMAP.md` (Phase 51-54 sections, v10.0 milestone header) — sequencing, requirements, hard constraints
- `.planning/REQUIREMENTS.md` (ADM-01..04) — requirement text
- `.planning/STATE.md` — current milestone/phase position
- `.claude/skills/sketch-findings-SOPstart/references/plant-floor-navigation.md` — design contract
- `.planning/sketches/007-plant-floor-navigation/index.html` — interactive sketch (admin tab, `health()`/`paint()` logic, inbox/table markup)
- `.planning/phases/41-one-sop-surface/41-CONTEXT.md` — prior-phase decisions this phase supersedes
- `.planning/phases/51-site-model-machine-editor/51-03-SUMMARY.md`, `src/actions/site.ts` — site data layer
- `.planning/phases/52-worker-home-the-plant/52-02-SUMMARY.md`, `src/components/sop/plant/{PlantStage,MachinePanel}.tsx`, `src/lib/sop/worker-signal.ts` — plant/pin infrastructure
- `.planning/phases/53-phone-scan-or-ask/53-CONTEXT.md` — confirmed unbuilt (context only)
- `src/app/(protected)/sops/page.tsx`, `src/components/sop/AdminSopSurface.tsx`, `src/components/sop/lenses/{AdminAttentionLens,AdminStatusLens,AdminAccessLens}.tsx`, `src/components/sop/MillerPrimitives.tsx`, `src/components/sop/sops-nav-types.ts` — full reads
- `src/lib/sop-list/admin-rows.ts`, `src/actions/admin-sop-list.ts`, `src/actions/governance.ts`, `src/lib/governance/classify.ts`, `src/lib/governance/flag-display.ts`, `src/components/admin/governance/GovernanceQueueRow.tsx` — full reads
- `src/lib/validators/site.ts`, `src/actions/site-worker.ts` — full reads
- `src/components/layout/TopHeader.tsx` (lines 120-200) — nav entries
- `src/lib/journeys/journeys.ts` (grep across full file) — journey entries needing update
- `scripts/check-bundle-size.ts` (full read) — the marker self-validation gate (Pitfall 1)
- `tests/lint/no-static-admin-lens-import.spec.ts`, `tests/phase41/{bundle-gate,reference-sweep}.spec.ts`, `tests/phase30/dead-weight.spec.ts` — full reads, existing reference-sweep pattern
- `.planning/codebase/CAPABILITY-MATRIX.md` (grep) — capability rows naming the deleted lenses
- `scripts/eval-fixtures.mjs`, `tests/evals/{plant-home,site-editor}.eval.ts`, `tests/evals/lib/session.ts` — eval fixture data (EVAL Press/Oven)
- `src/hooks/useViewport.ts`, `.bundle-baseline.json` — breakpoint/baseline confirmation
- `./CLAUDE.md` — Learnings 2026-08-04, 2026-07-13, 2026-09-13, 2026-09-27, 2026-09-28 ×3, 2026-06-05, 2026-05-25

### Secondary / Tertiary
None used — every claim in this document traces to a primary source read in this session. No WebSearch/Context7 lookups were needed (this is a pure internal-codebase refactor phase with zero new external libraries).

## Metadata

**Confidence breakdown:**
- Standard stack: N/A (no new packages) — confidence HIGH that none are needed
- Architecture / deletion inventory: HIGH — every file, importer, and test reference was grepped and cross-checked against actual file contents, not inferred from filenames
- Bundle-gate pitfall: HIGH — the exact failure mechanism was traced through `check-bundle-size.ts`'s source, not assumed
- Phase 53 sequencing risk: HIGH — confirmed via `git log` and directory listing that Phase 53 has zero implementation code as of research time
- Eval fixture state (Open Question 3): MEDIUM — the fixture-creation script was read but not executed/queried live against the database

**Research date:** 2026-09-29
**Valid until:** Short — this research is tightly coupled to the exact state of `master` as of commit `e885cfd`. Any further Phase 51/52/53 commits before Phase 54 executes should be re-diffed against this document's file/line references before planning proceeds.
