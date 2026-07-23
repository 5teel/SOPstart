# Phase 35: Competency Classifier + Training Matrix + Records - Research

**Researched:** 2026-07-23
**Domain:** Pure-function data derivation over existing Supabase tables (Next.js server components/actions) + tabular UI (training matrix) + CSV export
**Confidence:** HIGH (schema/actions read directly from live migrations and source; SF CSV shape is LOW — flagged)

## Summary

This phase adds zero new evidence tables — it reads `sop_observations` (Phase 34), `sop_completions` + `completion_sign_offs` (Phase 4/23), and `sop_departments` + `sop_access_people` + `member_departments` (Phase 32/25) and derives everything else in a pure TypeScript function. The codebase already has the exact precedent to copy twice over: `resolveEffectiveAccess`/`resolveSopAccess` (pure, DB-free, unit-tested resolvers in `src/lib/org-model/`) for "compute a derived thing from access rows," and `classifyGovernanceRow` (`src/lib/governance/classify.ts`) for "compute a status enum from evidence flags, sync export, no `'use server'`." The classifier for Phase 35 is the same shape as `classifyGovernanceRow`: take pre-fetched evidence rows for one person×SOP pair, return a state. The CMP-04 "never gates" guard has an exact, already-shipped template to fork: `tests/phase28/library-and-worker.spec.ts`'s `GATE_PATTERN` regex source-contract test asserting no `review_due_at`/`owner_user_id` conditional exists in worker-facing files — Phase 35 forks this file, swaps the regex to match `competency_state`/`competencyState`, and points it at `ReadTab.tsx`, the walkthrough route, and the new worker `/profile` competency section.

The one genuine gap: SuccessFactors' Learning History import column spec is not publicly documented in a scrapable form (SAP gates the exact connector template behind a live tenant's Admin Console — "System Administration > Connectors > Download Connector Template"). Treat the CSV column set in this research as a defensible generic shape (learner identifier, item identifier, item title, completion date, status, approver) — flagged LOW/ASSUMED — not a verified SF schema. A second finding worth flagging to the planner: CONTEXT.md's D-15 says "email + full name," but this codebase has **no full-name field anywhere** — every existing "name" display (`OrgTree`, department owner, observation observer) resolves to the user's **email** via `admin.auth.admin.listUsers()`. There is no `user_metadata.full_name`, no profiles table. The CSV's "full name" column will need to fall back to email (matching every other name-display precedent in this app) unless the planner adds a real name-capture flow, which is out of this phase's stated scope.

**Primary recommendation:** One pure `classifyCompetency()` function (evidence rows in → state out, mirrors `classifyGovernanceRow`), one `getTrainingMatrix()` server-action-adjacent data-fetch that batches queries per department (not per cell), a third `TeamViewShell` view value (`'matrix'`), and one CSV generator function called from two thin action wrappers (matrix export + PersonPanel export). Fork the Phase 28 D28-07 guard test verbatim for CMP-04.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Competency classification (state derivation) | API/Backend (pure lib module) | — | Must be callable from matrix fetch, PersonPanel fetch, profile fetch, and CSV export without duplication — a pure function, not a DB view/RPC (keeps it unit-testable without DB per CONTEXT discretion note) |
| Required-SOPs-per-person resolution | API/Backend (existing `sop_departments`/`sop_access_people`/`member_departments` tables) | — | Already materialized by Phase 32; Phase 35 only reads, never re-derives grant inheritance |
| Training matrix rendering | Frontend Server (RSC) + Browser (client toggle) | — | Follows `TeamViewShell`/`OrgColumnsBoard` split: server fetches, client renders/filters |
| Per-worker training record | Browser (PersonPanel client component) | API/Backend (server action reads) | Existing pattern — PersonPanel already fetches client-side via `useEffect` |
| CSV export | API/Backend (route handler or server action returning a Blob/string) | — | Needs to stream a file response with `Content-Disposition`; a server action can return a string body for client-side `Blob` download, or a dedicated `/api/...` route — either is fine, no existing CSV precedent to match |
| Worker own-state view (`/profile`) | Frontend Server (RSC) + Browser | — | Mirrors `ObservationsSection` — server fetch, thin client render, read-only |
| CMP-04 regression guard | API/Backend (source-contract test) | — | Static grep-based test, no runtime tier — mirrors Phase 28 D28-07 |

## Standard Stack

### Core

No new dependencies. This phase is 100% derivation logic over existing Supabase tables plus UI composition in the existing stack (Next.js 16, React 19, Tailwind, TanStack/plain fetch). CSV generation is a same-file string-join (see Don't Hand-Roll below — a CSV library is not warranted for this row shape).

### Supporting

None required.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-written CSV string join | `papaparse` or `csv-stringify` (not currently installed) | Only worth adding if a training-record row ever needs to hold a comma/quote/newline inside a field (SOP titles could — e.g. `"Lockout, Tagout Procedure"`). RFC 4180 quoting is ~6 lines; not worth a dependency. See Don't Hand-Roll. |
| Pure classifier as a Postgres view/RPC | SQL view (`competency_state` computed server-side in Postgres) | CONTEXT.md explicitly locks "one pure classifier function," not a DB view — keeps state derivation unit-testable without a live DB connection (mirrors `resolveEffectiveAccess`/`classifyGovernanceRow` precedent) and avoids a second SQL dialect for the same logic that will be extended again in Phase 36 (version-currency) and Phase 37 (assessor gating). |

**Installation:** None — no `npm install` needed this phase.

**Version verification:** N/A — no new packages.

## Package Legitimacy Audit

**Not applicable.** This phase installs zero external packages. No `pip`/`npm`/`cargo` verification required; skipping the slopcheck gate is correct here (nothing to audit).

## Architecture Patterns

### System Architecture Diagram

```
Evidence sources (existing tables, read-only this phase)
  sop_completions ──┐
  completion_sign_offs ──┤
  sop_observations ──┤──▶ classifyCompetency(evidenceForPair) ──▶ CompetencyState
  sop_departments/  ──┘        (pure fn, src/lib/competency/classify.ts)
  sop_access_people/
  member_departments  (required-SOPs-per-person — NOT classifier input,
                        used upstream to build the person×SOP pair list)

Required-pairs resolution (per department, batched)
  member_departments(dept) ──▶ people in dept
  sop_departments(dept) + sop_access_people(person) ──▶ required SOPs per person
        │
        ▼
  getTrainingMatrix(deptId) — ONE batched fetch:
    all completions for these people/SOPs
    all sign-offs for those completions
    all observations for these people/SOPs
        │
        ▼
  matrix rows/cols built by mapping classifyCompetency() over every
  (person, requiredSop) pair — computed in Node, not per-cell round-trips
        │
        ├──▶ /admin/team "matrix" view mode (TeamViewShell third toggle value)
        │        │
        │        └─ cell click ──▶ PersonPanel (extended: focusSopId prop)
        │
        ├──▶ Worker /profile "My competency" section (own states only, read-only)
        │
        └──▶ CSV export (two entry points, one generator)
                 Matrix header (current filtered cut) ──┐
                 PersonPanel (one worker)          ──────┴──▶ generateTrainingCsv(rows)

CMP-04 guard (static, no runtime path):
  tests/phase35/no-competency-gate.spec.ts greps ReadTab.tsx, walkthrough
  route, and worker /profile for a competency_state conditional — fails
  the phase if the classifier's OUTPUT is ever used as a branch condition
  in a worker-facing file.
```

### Recommended Project Structure

```
src/
├── lib/
│   └── competency/
│       ├── classify.ts          # pure classifyCompetency() — evidence rows in, state out
│       ├── matrix.ts            # pure buildMatrix() — assembles rows/cols from already-fetched data
│       └── csv.ts                # pure generateTrainingCsv() — rows in, CSV string out
├── actions/
│   └── competency.ts             # thin 'use server' wrappers: getTrainingMatrix(deptId), getTrainingRecordForPerson(personId), exportTrainingCsv(filters)
├── components/
│   └── admin/
│       └── competency/
│           ├── TrainingMatrixView.tsx    # third TeamViewShell view — table + rollups + filters
│           ├── StatePill.tsx             # sketch-05 pill vocabulary
│           └── TrainingRecordSection.tsx  # PersonPanel growth-point section (per-SOP evidence trail)
└── components/
    └── profile/
        └── CompetencySection.tsx  # worker's own states, mirrors ObservationsSection
```

### Pattern 1: Pure classifier over pre-fetched evidence (mirror `classifyGovernanceRow`)

**What:** A sync, DB-free function that takes already-queried evidence for one person×SOP pair and returns a state. No Supabase import, no `'use server'` directive — lives in `src/lib/competency/classify.ts`, imported by both server actions and unit tests.
**When to use:** Every place the derived state is needed (matrix cell, PersonPanel section, worker profile, CSV row) — call this one function, never recompute the ladder inline.
**Example:**
```typescript
// Source: mirrors src/lib/governance/classify.ts (existing, unit-tested pattern in this repo)
export type CompetencyState = 'not_started' | 'read' | 'supervised' | 'competent_signed_off'

export interface CompetencyEvidence {
  hasCompletion: boolean
  hasPerformedToSopObservation: boolean
  hasSignOff: boolean
  /** Timestamp of the latest needs_support observation, if any and if newer than the latest positive evidence (D-02). */
  latestNeedsSupportAt: string | null
  /** Timestamp of the latest positive evidence (sign-off OR performed_to_sop observation) — used to compare against latestNeedsSupportAt. */
  latestPositiveEvidenceAt: string | null
}

export interface CompetencyResult {
  state: CompetencyState
  needsSupportFlag: boolean
}

export function classifyCompetency(ev: CompetencyEvidence): CompetencyResult {
  // D-01: highest-evidence-wins ladder, no prerequisite ordering.
  let state: CompetencyState = 'not_started'
  if (ev.hasCompletion) state = 'read'
  if (ev.hasPerformedToSopObservation) state = 'supervised'
  if (ev.hasSignOff) state = 'competent_signed_off'

  // D-02: a needs_support observation newer than the latest positive evidence
  // resets state to 'read' (never below — the completion happened) and flags it.
  // Never demotes not_started (D-02: "never demotes below read").
  let needsSupportFlag = false
  if (
    ev.latestNeedsSupportAt &&
    state !== 'not_started' &&
    (!ev.latestPositiveEvidenceAt || ev.latestNeedsSupportAt > ev.latestPositiveEvidenceAt)
  ) {
    state = 'read'
    needsSupportFlag = true
  }

  return { state, needsSupportFlag }
}
```

### Pattern 2: Batched per-department fetch, not per-cell (perf)

**What:** One data-fetch pass per department load (or per CSV export cut), never N+1 per (person, SOP) pair.
**When to use:** `getTrainingMatrix(deptId)` and any CSV export.
**Example:**
```typescript
// Source: mirrors materializeSopAccessForOrg's Promise.all batching pattern (src/actions/grants.ts)
export async function getTrainingMatrix(deptId: string) {
  const ctx = await requireAdminContext()
  if ('error' in ctx) return { error: ctx.error }
  const admin = createAdminClient()

  const { data: people } = await admin.from('member_departments').select('member_id').eq('department_id', deptId)
  const personIds = (people ?? []).map(p => p.member_id)

  const { data: deptSops } = await admin.from('sop_departments').select('sop_id').eq('department_id', deptId)
  const { data: personSops } = await admin.from('sop_access_people').select('sop_id, member_id').in('member_id', personIds)
  // Union: dept-required SOPs (everyone in dept) + person-specific direct grants (MTX-02 requirement set)

  const sopIds = [...new Set([...(deptSops ?? []).map(s => s.sop_id), ...(personSops ?? []).map(s => s.sop_id)])]

  const [{ data: completions }, { data: signOffs }, { data: observations }] = await Promise.all([
    admin.from('sop_completions').select('id, worker_id, sop_id, sop_version, submitted_at').in('worker_id', personIds).in('sop_id', sopIds),
    admin.from('completion_sign_offs').select('completion_id, decision, created_at').in('completion_id', /* completion ids from above */ []),
    admin.from('sop_observations').select('observed_worker_id, sop_id, verdict, created_at').in('observed_worker_id', personIds).in('sop_id', sopIds),
  ])
  // Then map in Node: for each (personId, sopId) pair, assemble CompetencyEvidence
  // from the three arrays and call classifyCompetency() — zero further round-trips.
}
```

### Anti-Patterns to Avoid

- **Per-cell query loop:** Do not call `classifyCompetency`'s data-fetch once per (person, SOP) pair — at even a modest 30 people × 15 SOPs that's 450 round-trips. Batch per department (Pattern 2).
- **Storing the derived state:** No `competency_states` table, no cache column on `organisation_members` or `sops`. CONTEXT.md D-01/CMP-01 explicitly locks "computed live... never stored redundantly." Any persistence temptation (for "performance") should be resisted — the batched-fetch pattern above is cheap enough at this scale (50-500 SOPs, tens to low-hundreds of people per org, per the target market in CLAUDE.md).
- **Reusing `resolveEffectiveAccess`'s department/role/area inheritance chain for the matrix's "who needs what":** Don't. That resolver computes *materialization inputs* (which the Phase 32 write path already consumed to populate `sop_departments`/`sop_access_people`). The matrix should read the **materialized output** (`sop_departments`, `sop_access_people`) directly — re-deriving from `access_grants` a second time would be a second derivation layer, which MTX-02 explicitly forbids ("zero double-entry, no third derivation layer").
- **Gating anything on the derived state:** CMP-04 is a locked north star. The classifier's output must never appear in an `if`/ternary that changes worker-facing control flow (route access, button disabled state, redirect). It may only ever be rendered as a passive pill/label. Fork the D28-07 guard test to enforce this mechanically (see Common Pitfalls).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSV field escaping | A bespoke `.join(',')` with no quote handling | A ~6-line RFC-4180 quote helper (`if (val.includes(',')||val.includes('"')||val.includes('\n')) return '"'+val.replace(/"/g,'""')+'"'`) inlined in `src/lib/competency/csv.ts` | SOP titles and note fields can contain commas/quotes/newlines (e.g. `"Lockout, Tagout"`). A naive join corrupts the file silently — this is the one place in this feature worth ~6 lines of care, not a library (no `papaparse`/`csv-stringify` currently installed; adding a dependency for this is overkill per the ladder). |
| Required-SOPs-per-person derivation | A new resolver reproducing `access_grants` inheritance | `sop_departments` + `sop_access_people` (already-materialized junctions from Phase 32) | These tables are already the union-resolved output; re-deriving from `access_grants` would violate MTX-02's "zero double-entry" requirement and duplicate `resolveSopAccess` logic that already lives in `src/lib/org-model/`. |
| Display names for CSV/matrix | A new "get full name" helper hitting a nonexistent profiles table | `admin.auth.admin.listUsers()` → `.email`, exactly as `org-model.ts`/`departments.ts`/`observations.ts` already do | No full-name field exists anywhere in this codebase (see Assumptions Log A1). Building a new name-resolution path would diverge from every existing display-name callsite. |

**Key insight:** Everything this phase needs to derive "who must know what" and "what's been evidenced" already exists as materialized tables from Phases 4/23/32/34. The only new code is the classification ladder itself (a small pure function) and its three rendering surfaces — resist the urge to add a caching layer, a new resolver, or a CSV library for what is fundamentally a same-process in-memory map/reduce over a few hundred rows per org.

## Runtime State Inventory

Not applicable — this is a greenfield feature phase (new derivation + UI over existing tables), not a rename/refactor/migration. No runtime state (stored data, live service config, OS-registered state, secrets, build artifacts) is being renamed or moved.

## Common Pitfalls

### Pitfall 1: CMP-04 guard must fork the D28-07 pattern exactly, targeting the right files
**What goes wrong:** A competency-state conditional slips into `ReadTab.tsx`, the walkthrough route, or worker `/profile` (e.g. "hide the Next button until supervised") — the exact regression class the north star forbids.
**Why it happens:** It's tempting to add a soft nudge ("you haven't been signed off yet") directly where the state is already being fetched for display.
**How to avoid:** Fork `tests/phase28/library-and-worker.spec.ts`'s `GATE_PATTERN` regex approach into a new `tests/phase35/no-competency-gate.spec.ts`. Pattern should match any `if`/ternary inspecting `competencyState`/`competency_state` in `ReadTab.tsx`, the walkthrough page/route files, and the new worker profile competency component. Register it under a new `phase35` Playwright project with `testMatch: /tests\/phase35\/.*\.(spec|test)\.ts$/` (broad regex, per the 2026-05-25/2026-06-02 registration-discipline learnings — verify with `npx playwright test --list --project=phase35`).
**Warning signs:** Any PR touching worker-facing files that also imports `classifyCompetency` or reads `sop_observations`/competency state.

### Pitfall 2: "Full name" doesn't exist — CSV/matrix name column will silently be an email
**What goes wrong:** A plan assumes a `full_name` field can be read from `organisation_members` or `auth.users.user_metadata` and ships broken code (`undefined` in the CSV) or discovers mid-implementation that the field doesn't exist, causing rework.
**Why it happens:** CONTEXT.md D-15 says "Email + full name," which reads as if both exist today.
**How to avoid:** Grep confirms zero `full_name`/`user_metadata`/`display_name` reads anywhere in `src/`. Every existing "name" in this app (OrgTree people, department owners, observation observer names) is literally the user's email via `admin.auth.admin.listUsers()`. Plan the CSV/matrix name column as email-only (or "email, rendered where the UI needs a person label" exactly like today), and treat "full name" as a future field, not an in-scope build item — flagged as Assumption A1 below.

### Pitfall 3: Cross-org / cross-role RLS leakage on evidence reads (recurring class in this codebase)
**What goes wrong:** A matrix/CSV read action queries `sop_observations`, `sop_completions`, or `sop_access_people` with the session client on behalf of *other* workers, and RLS either (a) silently returns zero rows for supervisor/admin callers (feature looks broken, masked because admin-run UAT works), or (b) over-shares — a worker viewing their own `/profile` competency section must never see peers' data.
**Why it happens:** This exact bug class recurred four times in this codebase per CLAUDE.md Learnings (2026-06-15, 2026-06-26 ×2, 2026-07-20). `sop_observations` reads specifically: the org-wide RLS branch is role-scoped to `admin`/`safety_manager`/`supervisor` (migration 00054) — a plain worker calling the matrix/CSV path (which they shouldn't be able to reach at all) would get zero org-wide rows, which is correct, but the *action itself* must still gate on role before even attempting the org-wide read, exactly like `listObservationsForPerson`/`listWorkerSopsForPicker` already do.
**How to avoid:** New `src/actions/competency.ts` functions must call `getSessionContext()`/`requireAdminContext()` and check role membership in `['admin', 'safety_manager', 'supervisor']` for any matrix/CSV/other-worker read — mirroring `listObservationsForPerson`'s `RECORDER_ROLES` guard verbatim. For the worker's *own* `/profile` competency section, use the self-scoped pattern (`listObservationsForWorker` — filters by `observed_worker_id = auth.uid()`/`worker_id = auth.uid()`, no admin client, no role gate needed beyond authentication). Per the 2026-07-20 learning, write a **runtime probe per role × own-row/other-row × same-org/cross-org** combination, not just one cross-org test — a single-probe test previously missed an org-wide same-org leak.
**Warning signs:** A green cross-org isolation test that never exercises a plain-worker session reading peer data within the same org.

### Pitfall 4: `sop_assignments`/`sop_access_people` read via session client returns empty for supervisor/admin callers
**What goes wrong:** Reading "required SOPs" for a worker other than the caller returns zero rows even though the data exists, because the relevant RLS SELECT policy only exposes the *caller's own* rows (documented precedent: `sop_assignments` 00007 policy, hit in the Phase 34-10 gap-closure).
**Why it happens:** `sop_access_people` has a `sop_access_people_self_read` policy (00046) described as "Workers see their own rows; admins/safety_managers in same org see all" — verify this policy's exact `using()` clause covers the admin/safety_manager branch with a role check (not just an org check) before relying on the session client for matrix reads; `sop_departments` is `using(true)` for all authenticated (no row-level restriction — safe to read directly). If `sop_access_people`'s admin-branch role check is present, the session client is fine for matrix reads of `sop_access_people`; if a similar pattern to the observations org-wide-branch-missing-role-check bug is found, add the admin client + self-enforced org-scope instead.
**How to avoid:** Before writing `getTrainingMatrix`, read the live `sop_access_people` RLS policy (migration 00046, around line 336) in full and confirm the admin/safety_manager branch has a `current_user_role() in (...)` guard. If verifying an admin-branch reads correctly for a *supervisor* caller (not just admin/safety_manager), test with a supervisor session specifically — supervisors are the primary matrix persona per D-06/MTX-01's "Admin/supervisor sees...".
**Warning signs:** Matrix renders correctly for admin test accounts but shows empty/zero-required-SOPs for a supervisor account.

### Pitfall 5: Compact-cell threshold and department scale assumptions
**What goes wrong:** A department with 40+ required SOPs (D-07's "compact past threshold") renders an unreadable wall of pills with no fallback, or the compact-threshold logic is hardcoded to a column count that doesn't match real org data shapes.
**Why it happens:** CONTEXT.md leaves the exact threshold to Claude's discretion — an arbitrary guess (e.g. "8 columns") may not match how NZ industrial orgs actually spread SOPs across departments (target market: 50-500 SOPs, tens of departments per CLAUDE.md market description).
**How to avoid:** Base the threshold on a horizontal-scroll fallback that engages progressively rather than a hard cutoff — e.g. pills render at normal size for the visible viewport, and once the table would need horizontal scroll anyway, switch to compact cells + legend (matches CONTEXT.md's own describe: "compact colored cells + legend when columns exceed what fits, horizontal scroll as backup"). Don't hardcode a specific integer without checking a representative department's row count in Wave 0/UAT.

## Code Examples

### Fork of the D28-07 CMP-04 guard (source-contract test)

```typescript
// Source: mirrors tests/phase28/library-and-worker.spec.ts GATE_PATTERN
// (exact pattern already proven in this repo for the analogous REV-02/D28-07 rule)
const GATE_PATTERN = /competency_state\s*[<>=!]|competencyState\s*[<>=!]|if\s*\([^)]*(competency_state|competencyState)/

test.describe('CMP-04 — competency state never gates worker access', () => {
  test('ReadTab.tsx contains no competency_state conditional', () => {
    const src = read(READ_TAB)
    expect(src).not.toMatch(GATE_PATTERN)
  })
  test('worker SOP detail / walkthrough route contains no competency_state gate', () => {
    const src = read(WORKER_SOP_DETAIL)
    expect(src).not.toMatch(GATE_PATTERN)
  })
  test('worker /profile competency section contains no gate — informational only', () => {
    const src = read(PROFILE_COMPETENCY_SECTION)
    expect(src).not.toMatch(GATE_PATTERN)
  })
})
```

### PersonPanel extension for cell-click deep-link (D-09)

```typescript
// PersonPanel currently accepts { id, name, roleLabel } — extend with an
// optional focusSopId so the matrix cell click can scroll to a specific
// SOP's evidence trail within the (new) training-record section, without
// a second evidence renderer (D-09 requirement).
interface PersonPanelProps {
  person: { id: string; name: string; roleLabel?: string } | null
  focusSopId?: string | null   // NEW — Phase 35: scroll+highlight this SOP's evidence block on open
  onClose: () => void
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| N/A — this is a new feature, not a migration from an old approach | Pure-function derivation over materialized junction tables | This phase | Matches the Phase 28 governance-classifier and Phase 32 access-resolver precedents already established in this codebase; no new architectural pattern is being introduced. |

**Deprecated/outdated:** None.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | CSV "full name" column (D-15) will render as email, because no full-name field exists anywhere in this codebase (`grep -r "full_name\|user_metadata\|display_name" src/` = zero hits outside unrelated component names) | Common Pitfalls #2, Don't Hand-Roll | Low — if a customer later demands real names, a `user_metadata.full_name` capture at signup + backfill is additive; doesn't block this phase's CSV shape, but the planner should not silently assume "full name" is already available data. |
| A2 | SuccessFactors Learning History import column names/order (row shape: learner email/ID, item identifier, item title, completion date, status, sign-off approver/date) | Standard Stack / Code Examples (not shown as a fixed table — deliberately left generic) | Medium — SAP does not publish the exact Learning History Connector CSV template publicly; it's downloaded from a live tenant's Admin Console. If Simon has SF admin access at a target customer, get the real template before building the exact column order; otherwise ship a clearly-labelled generic "training events" CSV and treat exact SF compatibility as a customer-validated follow-up, not a locked contract this phase. |
| A3 | `sop_access_people`'s RLS SELECT policy (migration 00046, `sop_access_people_self_read`) has a role check on its admin/safety_manager/supervisor branch analogous to the sop_observations org-wide-branch bug fixed in 00054 | Common Pitfalls #4 | Medium — if the branch is missing a role check, it's a disclosure hole (any worker could read all `sop_access_people` rows in the org via PostgREST) independent of this phase, but the matrix build must not assume the read "just works" for a supervisor session without verifying. |

**If this table is empty:** N/A — see above; none of these block planning, all are flagged appropriately.

## Open Questions

1. **Exact "awaiting sign-off" pill treatment (sketch nuance, Claude's discretion per CONTEXT.md)**
   - What we know: sketch 05 shows 5 pill labels but the classifier only has 4 canonical states; "Awaiting sign-off" is `read` + "a completion exists with no sign-off yet."
   - What's unclear: whether this needs a 5th *presentation* state (derived: `read` AND `hasCompletion` AND not yet observed/signed) or folds into the plain `read` pill.
   - Recommendation: Add a presentation-only derived boolean (`awaitingSignOff = state === 'read' && hasCompletion`) computed from the SAME evidence the classifier already produces — do not add a 5th canonical `CompetencyState` value, keep the state enum at 4 members (matches CMP-01's exact wording: "not started / read / supervised / competent-signed-off").

2. **Which existing `sop_access_people` RLS branch shape actually exists today**
   - What we know: 00046 defines `sop_access_people_self_read`, described in-migration as mirroring `member_departments_self_read`.
   - What's unclear: I did not read the full policy body (truncated in this research pass) — whether the admin/safety_manager/supervisor branch checks role or just org.
   - Recommendation: Planner/Wave-0 should `grep -A15 "sop_access_people_self_read" supabase/migrations/00046_org_model_schema.sql` and confirm before writing `getTrainingMatrix` reads against the session client vs. admin client.

## Environment Availability

Not applicable — this phase adds no new external tool/service/runtime dependency. All work is against the existing Supabase/Next.js/Playwright stack already running in this repo.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright (source-contract + unit-style specs, per repo convention) |
| Config file | `playwright.config.ts` |
| Quick run command | `npx playwright test --project=phase35` |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CMP-01 | Classifier derives correct state from evidence combinations | unit | `npx playwright test tests/phase35/classify-competency.spec.ts` | ❌ Wave 0 |
| CMP-02 | Evidence events (completion/sign-off/observation) advance state, no manual edit path exists | source-contract | `npx playwright test tests/phase35/classify-competency.spec.ts` | ❌ Wave 0 |
| CMP-04 | Competency state never gates worker access | source-contract (forked D28-07) | `npx playwright test tests/phase35/no-competency-gate.spec.ts` | ❌ Wave 0 |
| MTX-01 | Matrix renders as third /admin/team view mode | source-contract + component render | `npx playwright test tests/phase35/training-matrix-view.spec.ts` | ❌ Wave 0 |
| MTX-02 | Matrix requirements derive from sop_departments/sop_access_people only | source-contract (no access_grants import in matrix.ts) | `npx playwright test tests/phase35/matrix-derivation.spec.ts` | ❌ Wave 0 |
| MTX-03 | Filter by department/worker/SOP | component/unit | `npx playwright test tests/phase35/matrix-filters.spec.ts` | ❌ Wave 0 |
| TRN-01 | PersonPanel renders training record grouped by SOP | source-contract | `npx playwright test tests/phase35/training-record.spec.ts` | ❌ Wave 0 |
| TRN-02 | CSV export — one row per completion, correct columns, filterable | unit (generateTrainingCsv) | `npx playwright test tests/phase35/csv-export.spec.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx playwright test --project=phase35`
- **Per wave merge:** `npm run test` (full suite) + `npx tsc --noEmit` + `npm run build` (per the 2026-06-02/2026-06-27 learnings: `next build` typecheck scope catches things `tsc` and per-project test runs miss)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/phase35/classify-competency.spec.ts` — covers CMP-01/CMP-02 (pure function unit tests, no DB — can run as static import since `classify.ts` has no `'use server'` directive, following the phase15-unit precedent for static `@/` imports)
- [ ] `tests/phase35/no-competency-gate.spec.ts` — covers CMP-04, forked from `tests/phase28/library-and-worker.spec.ts`
- [ ] `tests/phase35/matrix-derivation.spec.ts`, `training-matrix-view.spec.ts`, `matrix-filters.spec.ts` — cover MTX-01/02/03
- [ ] `tests/phase35/training-record.spec.ts`, `csv-export.spec.ts` — cover TRN-01/02
- [ ] Playwright project registration: add a `phase35` project block with `testDir: '.'`, `testMatch: /tests\/phase35\/.*\.(spec|test)\.ts$/` (broad regex per the phase26/28/29/30/32/33/34 convention) — verify with `npx playwright test --list --project=phase35` before considering any spec "registered."
- [ ] Runtime RLS probes (not source-contract): a supervisor-session read of `getTrainingMatrix` for another supervisor's-not-their-own department (should be allowed, same org) and a worker-session read attempt at the matrix/CSV action (should be denied) — per the 2026-07-20 per-role×own-row/other-row×same-org/cross-org learning, these need real Supabase sessions, not just grep.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (indirect) | `getSessionContext()` / `requireAdminContext()` — existing shared auth idiom, no new auth logic |
| V3 Session Management | no | No new session handling |
| V4 Access Control | yes | Role-gate every matrix/CSV/other-worker-record read to `admin`/`safety_manager`/`supervisor` (mirrors `RECORDER_ROLES` in `observations.ts`); self-scope worker's own `/profile` read to `auth.uid()` |
| V5 Input Validation | yes | Zod schemas for CSV filter inputs (department/worker/SOP/date-range) — follow the `RecordObservationSchema`/`ObservationLabelsSchema` precedent in `src/lib/validators/` |
| V6 Cryptography | no | Not applicable — no new crypto/secrets |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-org read via admin-client matrix/CSV export (service-role bypasses RLS) | Information Disclosure | Self-enforce `organisation_id` filter on every admin-client query in `src/actions/competency.ts`, exactly as `grants.ts`/`observations.ts` already do — read `callerOrgId()` pattern from `grants.ts` and reuse it |
| Role-check-missing on an "org-wide" RLS branch (the exact 00054 bug class, recurred 2x already in Phase 34 alone) | Information Disclosure / Elevation of Privilege | Before trusting any existing table's RLS for a NEW read path (`sop_access_people`, `sop_departments`), re-verify the live policy body — do not assume "it has RLS enabled" means "it's role-scoped correctly" (see Open Question 2 / Assumption A3) |
| CSV export as an unauthenticated or under-authenticated route | Spoofing / Information Disclosure | If implemented as an `/api/...` route (not a server action), it MUST go through `getSessionContext()`/`requireAdminContext()` exactly like a page would — do not build a bearer-token/cron-style route for this (that pattern is for machine-to-machine, not admin-UI CSV downloads) |

## Sources

### Primary (HIGH confidence — read directly from this repo)
- `supabase/migrations/00052_supervisor_observations.sql`, `00053_sop_observations_cross_org_guard.sql`, `00054_observation_read_role_scope.sql` — sop_observations schema + RLS evolution
- `supabase/migrations/00010_completion_schema.sql` — sop_completions, completion_photos, completion_sign_offs schema + RLS
- `supabase/migrations/00038_phase23_schema.sql` — sop_completions.roster_worker_id, sop_completion_signatures
- `supabase/migrations/00035_departments_schema.sql`, `00046_org_model_schema.sql` — sop_departments, member_departments, sop_access_people schema + RLS
- `src/actions/grants.ts`, `src/actions/observations.ts`, `src/actions/completions.ts`, `src/actions/departments.ts` — existing action patterns, org-scoping precedent, name-resolution precedent
- `src/lib/governance/classify.ts`, `src/lib/org-model/resolve-sop-access.ts` — pure-classifier and pure-resolver precedents to mirror
- `src/components/admin/org-model/TeamViewShell.tsx`, `ViewToggle.tsx`, `PersonPanel.tsx` — matrix integration point + PersonPanel growth-point (explicit comment: "Growth point (Phase 35): this section list is where the per-worker training record will be appended")
- `tests/phase28/library-and-worker.spec.ts` — D28-07 guard pattern to fork for CMP-04
- `src/app/(protected)/profile/page.tsx`, `src/components/profile/ObservationsSection.tsx` (referenced) — worker-facing informational-section precedent
- `playwright.config.ts` — phase-project registration convention (broad testMatch per phase)
- `.planning/phases/34-supervisor-observations/34-CONTEXT.md`, `.planning/phases/35-competency-classifier-training-matrix-records/35-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md` — locked decisions, requirement wording, prior-phase learnings

### Secondary (MEDIUM confidence)
- None used beyond repo sources for the core architecture; the CSV shape is the only externally-sourced claim and it's LOW (below).

### Tertiary (LOW confidence)
- SAP Community "Learning History Import - Tips" and SAP Help Portal connector-template pages (WebSearch only, primary page fetch blocked by 403) — confirms SF Learning History import exists as a "connector template downloaded from a live tenant," but does NOT give an exact, verifiable column list. Flagged as Assumption A2 — do not treat any specific column name/order as locked without a real SF tenant's downloaded template.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies, verified via package.json grep
- Architecture: HIGH — every pattern mirrors an existing, already-shipped precedent in this exact codebase (classify.ts, resolve-sop-access.ts, TeamViewShell, D28-07 guard)
- Pitfalls: HIGH for the RLS/org-scoping class (four prior documented incidents in CLAUDE.md to cross-reference); LOW for the exact SF CSV column shape (Assumption A2)

**Research date:** 2026-07-23
**Valid until:** 30 days (stable internal codebase pattern; re-verify SF CSV shape claim if/when a customer requests real SF import validation)
