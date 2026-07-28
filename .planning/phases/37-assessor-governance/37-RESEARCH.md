# Phase 37: Assessor Governance - Research

**Researched:** 2026-07-28
**Domain:** Server-side authorization gate over existing write paths (derived-state predicate, no new entity), append-only audit columns, notification-based request flow
**Confidence:** HIGH

## Summary

Phase 37 adds no new subsystem — it inserts one predicate check in front of two existing,
already-hardened write paths (`recordObservation` in `src/actions/observations.ts` and
`signOffCompletion` in `src/actions/completions.ts`) and stamps two new columns on their
target tables for override audit. The predicate itself ("is this caller `competent_signed_off`
on this exact SOP") is a direct reuse of `classifyCompetency` (Phase 35) fed by
`resolveLineage` (Phase 36) — the same evidence-fetch-then-classify shape already implemented
three times in `src/actions/competency.ts` (matrix, per-person record, self). This phase's
only new code is a fourth, single-SOP variant of that shape, plus the two gate call-sites, plus
override/request UI.

The one genuinely new finding from this research: `worker_notifications` (Phase 3) has **no
inbox/list UI today** — `NotificationBadge` renders only an unread *count* on the bottom tab
bar, with no click-through list anywhere in the codebase. D-08's "request assessment" flow
needs the recipient (admin/safety_manager) to see **which worker, which SOP** — a bare count
bump is not actionable. The lightest fix that satisfies D-08's "no new notification
infrastructure" instruction is a small inline list on the existing `/activity` admin/
safety_manager view, not a new inbox page.

The second finding worth flight-planning: `signOffCompletion`'s role gate currently hard-excludes
`admin` (`['supervisor', 'safety_manager']`) — D-06 requires admin to have override capability
on sign-offs, so this array must widen to include `'admin'` as part of this phase, not as an
unrelated side effect.

**Primary recommendation:** Add a single pure predicate module
`src/lib/competency/assessor.ts` (`isSignedOffAssessor`), call it from both gated actions only
for the competence-advancing branch (`verdict === 'performed_to_sop'` / `decision === 'approved'`),
stamp `is_assessor_override` + `override_reason` columns directly onto `sop_observations` and
`completion_sign_offs` (no new audit table needed — both are already append-only, org-scoped,
role-checked, matching D-07's "sop_review_events pattern" by construction), and surface the
blocked/override/request states inline in the two existing recording UIs
(`RecordObservationModal`, `CompletionDetailClient`).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Assessor predicate (is caller signed off on SOP X) | API / Backend (server action, pure lib fn) | Database (RLS backstop, discretionary) | Derived from existing evidence tables; must run server-side before every advancing write — client cannot be trusted to self-report |
| Gate enforcement on `recordObservation` | API / Backend | Database (existing role/org RLS) | `src/actions/observations.ts` is a `'use server'` action; RLS already blocks cross-org/cross-role, but not assessor status |
| Gate enforcement on `signOffCompletion` | API / Backend | Database | Same shape as above, `src/actions/completions.ts` |
| Override audit trail | Database (stamped columns) | API / Backend (writes reason) | Columns ride the existing append-only tables' RLS — no new table, no new policy |
| Blocked-recorder UI (disabled control + copy) | Browser / Client | — | Presentational only; the real gate is server-side |
| Request-assessment notification | API / Backend (write) + Browser (surface) | Database (`worker_notifications`, existing table) | Write via existing admin-client server-action pattern; surfacing needs a small UI addition since no inbox exists today (see Pitfall 1) |

## Standard Stack

No new libraries. This phase is Zod schema extensions + one new pure TS module + one migration
+ existing-component edits, all using the stack already locked in `CLAUDE.md` (Next.js 16,
Supabase/Postgres RLS, Zod, Playwright).

### Package Legitimacy Audit

Not applicable — this phase introduces zero new npm packages. `package.json` is untouched.

## Architecture Patterns

### System Architecture Diagram

```
Recorder (supervisor/admin/safety_manager)
        │
        ▼
RecordObservationModal / CompletionDetailClient (Browser)
        │  verdict='performed_to_sop' OR decision='approved'?
        ▼
recordObservation() / signOffCompletion()   (API — src/actions/*.ts)
        │
        ├─ 1. existing role/org checks (unchanged)
        │
        ├─ 2. NEW: is this a competence-advancing write?
        │        (verdict === 'performed_to_sop' | decision === 'approved')
        │        needs_support / rejected → skip gate entirely (D-04, D-03 sibling)
        │
        ├─ 3. NEW: isSignedOffAssessor(callerId, sopId)  ──▶  resolveLineage() + classifyCompetency()
        │        (src/lib/competency/assessor.ts — reuses Phase 35/36 evidence pipeline)
        │
        ├─ 4a. assessor === true            → insert normally (is_assessor_override = false)
        ├─ 4b. assessor === false, role∈{admin,safety_manager}, override+reason supplied
        │                                    → insert with is_assessor_override = true, override_reason stamped
        ├─ 4c. assessor === false, role='supervisor'
        │                                    → REJECT insert; client shows disabled control + "Request assessment" CTA
        │
        ▼
sop_observations / completion_sign_offs (Database — existing append-only tables, +2 columns)
        │
        └─ (4c only) requestAssessorReview() → worker_notifications insert (existing table, admin client)
                       │
                       ▼
           /activity admin/safety_manager view — NEW small "Assessment requests" list
           (no inbox exists today — see Pitfall 1)
```

### Recommended Project Structure

```
src/lib/competency/
├── assessor.ts              # NEW — isSignedOffAssessor(personId, sopId, client, orgId)
└── __tests__/
    └── assessor.test.ts      # NEW — unit tests, phase35-unit project (testDir already covers this dir)

src/actions/
├── observations.ts           # EDIT — gate recordObservation (performed_to_sop only), override params
└── completions.ts            # EDIT — gate signOffCompletion (approved only), widen role array, override params

src/lib/validators/
├── observations.ts           # EDIT — add isOverride/overrideReason to RecordObservationSchema
└── completions.ts            # EDIT — add isOverride/overrideReason to SignOffSchema

src/components/observations/
└── RecordObservationModal.tsx  # EDIT — blocked state, override affordance, request CTA

src/app/(protected)/activity/[completionId]/
├── page.tsx                    # EDIT — compute isAssessor server-side, pass to client
└── CompletionDetailClient.tsx  # EDIT — disable Approve when blocked, override affordance

src/app/(protected)/activity/
└── SupervisorActivityView.tsx  # EDIT (admin/safety_manager only) — "Assessment requests" list

supabase/migrations/
└── 00056_assessor_governance.sql   # NEW — 4 columns (2 tables) + optional RLS hardening
```

### Pattern 1: Single-SOP assessor predicate (new)

**What:** A narrower sibling of `getMyCompetencyStates`/`getTrainingRecordForPerson` that
resolves competency for exactly one `(personId, sopId)` pair instead of every required SOP.
**When to use:** Any gate check that needs "is X signed off on Y" without paying for a full
matrix/record fetch.
**Example (shape to follow, adapted from `src/actions/competency.ts` `getTrainingRecordForPerson`):**
```typescript
// src/lib/competency/assessor.ts — plain module, NOT 'use server' (mirrors lineage.ts
// rationale: every async export of a 'use server' file is a POST-invokable endpoint;
// this takes a caller-supplied client/orgId, so exposing it directly would be a
// parameter-trusting service-role hole, same class as the 2026-07-05 CLAUDE.md learning).
import { classifyCompetency } from './classify'
import { resolveLineage } from './lineage'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function isSignedOffAssessor(
  personId: string,
  sopId: string,
  client: any,
  orgId: string | null
): Promise<boolean> {
  const { data: sopRow } = await client
    .from('sops')
    .select('id, version, parent_sop_id, refresher_interval_months')
    .eq('id', sopId)
    .maybeSingle()
  if (!sopRow) return false

  const lineage = await resolveLineage([sopRow], client, orgId)

  const { data: completionRows } = await client
    .from('sop_completions')
    .select('id, sop_id, submitted_at')
    .eq('worker_id', personId)
    .in('sop_id', lineage.allSopIds)
  const completions = completionRows ?? []
  const completionIds = completions.map((c: { id: string }) => c.id)

  const { data: signOffRows } = completionIds.length
    ? await client.from('completion_sign_offs').select('completion_id, decision, created_at').in('completion_id', completionIds)
    : { data: [] }

  const { data: observationRows } = await (client as any)
    .from('sop_observations')
    .select('sop_id, verdict, created_at')
    .eq('observed_worker_id', personId)
    .in('sop_id', lineage.allSopIds)

  // ... same hasCompletion/hasSignOff/hasPerformedToSopObservation/
  // latestNeedsSupportAt/latestPositiveEvidenceAt reduction as
  // getTrainingRecordForPerson (src/actions/competency.ts:437-460) ...

  const result = classifyCompetency({ /* evidence */ })
  return result.state === 'competent_signed_off'
}
```
Callers (`observations.ts`, `completions.ts`) already hold a `supabase`/`admin` client and
`organisationId` from `getSessionContext()` — pass those straight through, exactly as
`resolveLineage` is already called from three sites.

### Pattern 2: Stamped-column override audit (not a new table)

**What:** `is_assessor_override boolean not null default false` + `override_reason text` added
directly to `sop_observations` and `completion_sign_offs`.
**When to use:** D-07 requires "who, when, which worker, which SOP, which record, reason" to be
reconstructible. Both target tables already carry `observed_by`/`supervisor_id` (who),
`created_at` (when), `observed_worker_id`/`worker_id` (which worker, via join), `sop_id` (which
SOP), and the row itself is "which record" — only `reason` is missing. A dedicated
`sop_review_events`-style table would duplicate all of that FK/timestamp plumbing to store one
extra string. D-07 says "copy the proven pattern" — the proven pattern (org-scoped read,
role-checked insert, no update/delete) is a property these two tables **already have**;
stamping columns inherits it for free, no new RLS policies needed.
**Example:**
```sql
alter table public.sop_observations
  add column if not exists is_assessor_override boolean not null default false,
  add column if not exists override_reason text;

alter table public.sop_observations
  add constraint sop_observations_override_reason_required
  check (not is_assessor_override or override_reason is not null);

-- identical pair on completion_sign_offs
```

### Anti-Patterns to Avoid

- **Re-deriving the ladder in a second place:** Do not write a bespoke "is this person good
  enough" check inline in `observations.ts`/`completions.ts`. Every prior phase (34, 35, 36)
  established the rule that `classifyCompetency` is the single source of truth for the ladder;
  duplicating its logic risks silent drift (e.g. forgetting the `needs_support` reset — CONTEXT
  explicitly calls this out as a correctness requirement, not just style).
- **A new `assessors` table or `is_assessor` column:** Explicitly rejected by D-01/D-02 and the
  Deferred Ideas list. Do not introduce one even as an optimization — assessorship must stay
  100% derived so it never drifts from the sign-off data.
- **Gating `needs_support` or `rejected`:** D-04 and D-03's sibling logic both require these two
  verdicts to remain open to all current recorder roles. The gate predicate must branch on
  `verdict`/`decision` BEFORE calling `isSignedOffAssessor` at all — do not call the predicate
  unconditionally and then ignore its result for these branches (wasted queries, and an easy
  place to accidentally wire the gate wrong later).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| "Is person X competent on SOP Y" | A new SQL view/RPC that re-implements the ladder | `classifyCompetency` (Phase 35) + `resolveLineage` (Phase 36), called for a single SOP | Already battle-tested against the `needs_support` reset and version-supersede edge cases (Phase 36 CMP-03 fix); a second implementation is a second place to get it wrong |
| Notification transport for "request assessment" | A new `assessment_requests` table + polling hook | `worker_notifications` (migration 00009), a new `type` value, existing admin-client insert pattern from `signOffCompletion`'s rejection-notify | D-08 explicitly mandates reuse; the table has no CHECK constraint on `type`, so a new string value is a zero-migration addition |
| Override audit trail | A new `assessor_overrides` event table mirroring `sop_review_events` | Two columns on the two existing gated tables | Both tables already satisfy every structural property D-07 asks for (append-only, org-scoped, role-checked insert) — adding a table duplicates FK plumbing to store one string |

**Key insight:** Every piece this phase needs already exists in the codebase in near-final
form — this is a wiring phase, not a build phase. The main engineering risk is *forgetting to
wire the gate into all the right branches* (verdict/decision-conditional), not designing new
mechanisms.

## Common Pitfalls

### Pitfall 1: `worker_notifications` has no inbox — a bare count is not "notified"

**What goes wrong:** D-08 says "notifies an existing assessor/admin" — if the plan literally
just inserts a `worker_notifications` row and calls it done, the only observable effect is the
unread-count badge on `BottomTabBar` incrementing by one, with zero indication of *which*
worker or *which* SOP needs assessing. Verified by grep: `NotificationBadge` (the only consumer
of `useNotifications`) renders `unreadCount` only; there is no dropdown, no inbox route, no
per-notification row component anywhere in `src/app` or `src/components`.
**Why it happens:** The table/hook were built in Phase 3 for a different, simpler need (SOP
version-update pings) and a dedicated inbox was descoped later (CLAUDE.md 2026-07-13 UX-08:
"fake notifications bell" removed as dead weight) — so the count-only pattern looks like
existing precedent, but it was never a *complete* pattern to begin with.
**How to avoid:** Plan a minimal, targeted surface: a small "Assessment requests" section at
the top of `SupervisorActivityView.tsx`, gated to admin/safety_manager, querying
`worker_notifications` directly for `type = 'assessment_requested' AND read = false`, each row
showing worker + SOP + a "Go assess" button that opens `RecordObservationModal` preset to that
worker/SOP (mirrors the existing `onObserve` wiring already in that file). This is a few dozen
lines, not a new inbox page, and satisfies D-08's "no new notification infrastructure"
constraint (the infrastructure — the table, the write pattern — is unchanged; only a
consumption view is added).
**Warning signs:** If the plan's UI tasks for D-08 only touch `useNotifications.ts` or
`NotificationBadge.tsx`, the request is being written but never surfaced actionably.

### Pitfall 2: `signOffCompletion`'s role array silently excludes admin today

**What goes wrong:** `src/actions/completions.ts` line ~138 checks
`['supervisor', 'safety_manager'].includes(role)` — an admin calling `signOffCompletion` today
gets `'Only supervisors and safety managers can sign off completions.'`. D-06 requires admin to
have override capability on sign-offs (peer of safety_manager on every governance surface). If
the plan only adds the assessor gate without also widening this array, admin's override path on
sign-offs is unreachable regardless of how well the gate itself is built.
**Why it happens:** The array predates this phase (Phase 4) and had no reason to include admin
before now — sign-off was a supervisor/safety_manager-only action.
**How to avoid:** Explicit task: change `['supervisor', 'safety_manager']` to
`['supervisor', 'safety_manager', 'admin']` in `signOffCompletion`, and confirm the
`supervisor_assignments` check (which only runs `if (role === 'supervisor')`) still correctly
skips for the newly-added admin branch (it will, by the existing `if` guard — no change needed
there, just verify with a test).
**Warning signs:** A live/runtime test that has an admin attempt sign-off and expects success
will fail with the current array; if that test is skipped or absent, this ships broken.

### Pitfall 3: Gate must branch on verdict/decision, not run unconditionally

**What goes wrong:** If `isSignedOffAssessor` is called for every `recordObservation`/
`signOffCompletion` invocation regardless of verdict/decision, a supervisor recording a
`needs_support` coaching note (D-04, must stay open) or rejecting a completion (not
competence-advancing) gets incorrectly blocked, or — if the predicate is only checked but its
failure ignored for these cases — wasted queries on every single coaching-note write (a much
higher-frequency action than advancing observations, per Phase 34's framing that
`needs_support` is the coaching-not-discipline default).
**Why it happens:** It is tempting to gate "the whole action" rather than "the specific write
that advances competency," especially since both actions currently have a single insert
call-site.
**How to avoid:** Structure the gate as an early branch: `if (verdict !== 'performed_to_sop') { insert normally; return }` / `if (decision !== 'approved') { insert normally; return }`, and only reach the assessor-predicate call on the advancing branch. This mirrors the existing rejection-reason-length check in `signOffCompletion`, which already only runs `if (decision === 'rejected')`.
**Warning signs:** A test recording a `needs_support` observation as a non-signed-off supervisor
that unexpectedly fails.

### Pitfall 4: RLS does not currently enforce assessor status — a raw REST call could bypass the app-layer gate

**What goes wrong:** `sop_observations`'s INSERT policy (migrations 00052/00053) checks
org-scope, role (`admin`/`safety_manager`/`supervisor`), `observed_by = auth.uid()`, and FK
ownership — it does **not** check assessor status, and cannot cheaply, since the full predicate
requires lineage-widening + the `needs_support` reset (multi-table, stateful). A supervisor who
is not signed off on a SOP could still successfully `POST` a `performed_to_sop` observation
directly to PostgREST (bypassing `recordObservation`'s app-layer gate) about a worker in their
own org, since the row-level policy alone would accept it. `completion_sign_offs` has no
authenticated INSERT policy at all (server-action/admin-client only), so this specific bypass
does not apply to sign-offs — only to observations.
**Why it happens:** RLS policies are evaluated per-row against SQL-expressible conditions;
`classifyCompetency`'s ladder (including the `needs_support` reset and version-lineage
widening) is not cheaply expressible as a `with check` clause without either a SQL
reimplementation (drift risk — the exact bug class CLAUDE.md's 2026-06-05 learning warns
about) or a much coarser approximation.
**How to avoid — recommendation:** Ship the gate at the action layer only for v1 (source of
truth = `classifyCompetency`, one place). Accept the residual risk explicitly rather than
building a parallel, coarser SQL implementation that itself becomes a second thing to keep in
sync — this is the same trade-off CONTEXT's discretion note flags ("planner/researcher decide
cost/benefit"). The blast radius of the residual gap is bounded: a supervisor exploiting it
would need to hand-craft an authenticated REST call (not available through any UI), and can
only self-authorize observations about workers **already in their own org** that they were
**already permitted to observe** (just skipping the newly-added assessor check) — not a
cross-tenant or cross-role escalation, unlike the historical RLS holes in this codebase's
Learnings log (2026-06-15, 2026-06-26, 2026-07-05, 2026-07-20), which were all cross-tenant or
cross-role disclosure/write holes. If the planner wants defense-in-depth anyway, the cheapest
non-drifting option is a SECURITY DEFINER helper checking only the coarse, non-lineage-widened
case (`exists an approved completion_sign_off directly on this exact sop_id for observed_by`) —
strictly weaker than the app-layer check in the lineage-widening edge case, but closes the raw
REST bypass for the common (non-superseded) case. Document this as an explicit, intentional
scope decision either way — don't leave it unaddressed silently.
**Warning signs:** A verification pass that only tests the app-layer/UI path and never attempts
a raw authenticated `POST` to `/rest/v1/sop_observations` will not catch this gap either way.

### Pitfall 5: `RECORDER_ROLES` is duplicated, not shared

**What goes wrong:** `['supervisor', 'admin', 'safety_manager']` is independently defined as a
local `const RECORDER_ROLES` in both `src/actions/observations.ts` and
`src/actions/competency.ts`. Not a bug today, but a plan that adds a THIRD copy (e.g. inside the
new assessor gate or the request-path action) compounds the drift risk for a future role change.
**How to avoid:** Not blocking for this phase, but if convenient, extract `RECORDER_ROLES` to a
shared constant (e.g. `src/lib/auth/roles.ts`) while touching these files anyway. Optional,
flag as a nice-to-have, not a requirement.

## Code Examples

### Existing gate call-site shape to extend (recordObservation)

```typescript
// Source: src/actions/observations.ts (current, lines 31-68)
export async function recordObservation(rawInput: unknown) {
  const parsed = RecordObservationSchema.safeParse(rawInput)
  // ... existing role/org checks ...
  const { workerId, sopId, verdict, note, completionId } = parsed.data
  const { data: sop } = await supabase.from('sops').select('version').eq('id', sopId).single()

  // NEW: gate only the advancing verdict.
  let isOverride = false
  if (verdict === 'performed_to_sop') {
    const assessor = await isSignedOffAssessor(userId, sopId, supabase, organisationId)
    if (!assessor) {
      if (role === 'admin' || role === 'safety_manager') {
        if (!parsed.data.overrideReason) {
          return { success: false, error: 'ASSESSOR_OVERRIDE_REQUIRED' } // client shows reason field
        }
        isOverride = true
      } else {
        return { success: false, error: 'NOT_SIGNED_OFF_ASSESSOR' } // client shows request-assessment CTA
      }
    }
  }

  const { error } = await (supabase as any).from('sop_observations').insert({
    // ...existing fields...
    is_assessor_override: isOverride,
    override_reason: isOverride ? parsed.data.overrideReason : null,
  })
}
```

### Existing rejection-reason-length pattern to mirror for override reason

```typescript
// Source: src/actions/completions.ts (current, lines 127-132) — mirror this shape
// for override reason validation (mandatory, minimum length) rather than inventing new copy.
if (decision === 'rejected') {
  if (!reason || reason.trim().length < 10) {
    return { success: false, error: 'Rejection reason must be at least 10 characters.' }
  }
}
```

## State of the Art

Not applicable — no external library/API surface changed since prior phases. All prior-phase
patterns (RLS append-only shape, `getSessionContext`/`requireAdminContext`, `resolveLineage`,
`classifyCompetency`) are current as of Phase 36 (2026-07-27) and unchanged.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Request-assessment notification recipients = org's admins + safety_managers only (not a fan-out to every currently-signed-off peer assessor) | Pattern/Pitfall 1, Don't Hand-Roll | If Simon wants peer-assessor fan-out too, the recipient query needs a "who is currently an assessor for this SOP" scan (expensive — evaluates the predicate per org member) rather than a flat admin/safety_manager role filter. Low product risk (admins/safety_managers already have override capability and are the bootstrap-deadlock's designated escape hatch per D-05), but confirm before locking the plan. |
| A2 | Defense-in-depth RLS hardening (Pitfall 4) is descoped for v1; action-layer gate is authoritative | Pitfall 4 | If Simon's risk tolerance is lower than assumed (e.g. wants zero raw-REST bypass surface even for same-org/same-role actions), the plan needs an explicit SQL SECURITY DEFINER task, adding scope. |
| A3 | `worker_notifications.type` has no CHECK constraint restricting allowed values (confirmed via migration 00009 read — no such constraint exists), so `'assessment_requested'` is a zero-migration addition | Don't Hand-Roll | If a later migration silently added a CHECK constraint (not found in this research pass), the insert would fail at runtime — verify against live schema before executing, not just the migration file. |

**If this table is empty:** N/A — see above.

## Open Questions

1. **Exact override UI placement (inline vs separate confirm step)**
   - What we know: CONTEXT leaves this to Claude's discretion; must show the reason field and
     make the audit consequence visible on-face, per Phase 34's "🔒 Permanent record" pattern
     already used verbatim in `RecordObservationModal.tsx` (line 240).
   - What's unclear: Whether the override reason field should always be visible-but-disabled
     until needed, or only appear once the blocked state is hit.
   - Recommendation: Progressive disclosure — show the blocked state + "Use assessor override"
     button first; clicking it reveals the reason field + the "This will be recorded as an
     assessor override... visible in the audit trail" copy, inline, in the same modal/sheet
     (no separate route/step) — mirrors the existing `RejectReasonSheet` pattern already used
     for `signOffCompletion` rejections in `CompletionDetailClient.tsx`.

2. **Whether `getVersionCompletionBreakdown`-style admin surfaces need an "override" badge on evidence trails**
   - What we know: CONTEXT's Integration Points section calls this optional discretion
     ("override-stamped records could carry a small badge in evidence trails").
   - What's unclear: Whether TRN-01/PersonPanel evidence trail (`ObservationEvidence`/
     `CompletionEvidence` in `src/actions/competency.ts`) should surface `is_assessor_override`
     in v1 or be deferred.
   - Recommendation: Add the field to the read types now (cheap — the column already exists on
     the row being mapped) but treat the actual badge UI as optional/lowest-priority task; the
     write-path gate is the phase's actual success criterion, not the read-side display.

## Environment Availability

Skipped — this phase has no new external dependencies (no new npm packages, no new external
services). All infrastructure (Supabase/Postgres, existing tables) is already live and verified
in prior phases (34/35/36).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright (`@playwright/test`) |
| Config file | `playwright.config.ts` |
| Quick run command | `npx playwright test --project=phase37` |
| Full suite command | `npm run test` |

### Phase Requirement → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ASR-01 | Non-signed-off supervisor cannot record `performed_to_sop` observation | unit (pure predicate) + source-contract | `npx playwright test --project=phase35-unit -g assessor` | ❌ Wave 0 |
| ASR-01 | Non-signed-off supervisor cannot approve a completion sign-off | source-contract (role array + gate call) | `npx playwright test --project=phase37` | ❌ Wave 0 |
| ASR-01 | `needs_support` observation stays ungated for non-assessor supervisor (D-04 regression) | source-contract | `npx playwright test --project=phase37` | ❌ Wave 0 |
| ASR-01 | Rejected sign-off stays ungated for non-assessor supervisor (D-03 sibling regression) | source-contract | `npx playwright test --project=phase37` | ❌ Wave 0 |
| ASR-01 | Admin/safety_manager override path inserts with `is_assessor_override=true` + stamped reason when caller not signed off | runtime (or source-contract if DB unavailable, per Rule-3 precedent) | `npx playwright test --project=phase37` | ❌ Wave 0 |
| ASR-01 | Override without a reason is rejected | unit / source-contract | `npx playwright test --project=phase35-unit` or `--project=phase37` | ❌ Wave 0 |
| ASR-01 | A brand-new org (zero signed-off assessors) does not deadlock — admin override succeeds | runtime (bootstrap scenario, mirrors Phase 34's SC-4 cross-org runtime probe style) | `npx playwright test --project=phase37` | ❌ Wave 0 |
| ASR-01 | `signOffCompletion` role array includes `admin` (Pitfall 2 regression) | source-contract | `npx playwright test --project=phase37` | ❌ Wave 0 |
| CMP-04 sibling | Worker read/walkthrough access remains ungated (locked north star) | source-contract (existing `no-refresher-gate`-style guard, extend or add sibling) | `npx playwright test --project=phase37` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx playwright test --project=phase37 --project=phase35-unit`
- **Per wave merge:** `npm run test` (full suite)
- **Phase gate:** Full suite green + `npx tsc --noEmit` + `npm run build` before `/gsd-verify-work`
  (CLAUDE.md 2026-06-02/2026-06-27 learnings: `tsc` scope ≠ `next build` scope for `'use server'`
  files — both gates are mandatory, not just one)

### Wave 0 Gaps
- [ ] Register a `phase37` Playwright project in `playwright.config.ts`, mirroring the
      `phase34`/`phase35`/`phase36` broad-`testMatch` pattern
      (`testMatch: /tests\/phase37\/.*\.(spec|test)\.ts$/`) — verify with
      `npx playwright test --list --project=phase37`
- [ ] `src/lib/competency/assessor.ts` + `src/lib/competency/__tests__/assessor.test.ts` — the
      `phase35-unit` project's `testDir` (`./src/lib/competency/__tests__`) already covers this
      new file with zero config changes
- [ ] `tests/phase37/no-competency-gate-worker.spec.ts` (or extend the existing
      `no-refresher-gate.spec.ts` pattern from Phase 36) — the CMP-04 "worker read/walkthrough
      never gated" regression guard, applied to this phase's new gate specifically
- [ ] Migration `00056_assessor_governance.sql` applied + verified live before any runtime test
      that inserts with `is_assessor_override=true`

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No | Unchanged — uses existing `getSessionContext()`/JWT verification |
| V3 Session Management | No | Unchanged |
| V4 Access Control | Yes | Server-side predicate (`isSignedOffAssessor`) gating a specific write, not a route — same shape as existing `RECORDER_ROLES`/`requireAdminContext()` checks; never trust client-supplied "I am signed off" claims |
| V5 Input Validation | Yes | Zod schema extension (`overrideReason`, `isOverride`) on `RecordObservationSchema`/`SignOffSchema`, mirroring the existing `reason.trim().length < 10` pattern already in `signOffCompletion` |
| V6 Cryptography | No | N/A |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Client-supplied "I am an assessor" flag trusted at insert time | Elevation of Privilege | Never accept an `isAssessor`/`bypassGate` boolean from the client — always recompute via `isSignedOffAssessor` server-side, exactly as `sop.version` is server-resolved (D-10 precedent) rather than trusted from the client |
| Raw authenticated REST bypass of the app-layer gate (Pitfall 4) | Elevation of Privilege | Documented residual risk; app-layer gate is authoritative for v1, optional coarse SECURITY DEFINER backstop available if risk tolerance requires it |
| Override reason omitted or empty, silently recorded as override anyway | Repudiation (audit trail integrity) | DB-level CHECK constraint (`not is_assessor_override or override_reason is not null`) as defense-in-depth alongside the Zod/action-layer validation — belt-and-braces against a future code path that forgets the app-layer check |
| Cross-org reference in override write (observed worker/SOP from another org) | Tampering / Information Disclosure | Already closed at the table level by migration 00053's `sop_observation_refs_in_org` SECURITY DEFINER helper (applies regardless of override flag) and `completions.ts`'s existing `completion.organisation_id !== organisationId` self-enforcement — no new work needed, just confirm these existing guards still run before the new gate, not after |

## Sources

### Primary (HIGH confidence — direct codebase read, this session)
- `src/actions/observations.ts` — `recordObservation`, `RECORDER_ROLES`, `listWorkerSopsForPicker`
- `src/actions/completions.ts` — `submitCompletion`, `signOffCompletion`, `recordSignature`
- `src/actions/competency.ts` — `getTrainingMatrix`, `getTrainingRecordForPerson`, `getMyCompetencyStates`, `getVersionCompletionBreakdown`, `exportTrainingCsv`
- `src/lib/competency/classify.ts` — `classifyCompetency` ladder semantics
- `src/lib/competency/lineage.ts` — `resolveLineage`
- `src/lib/auth/session-context.ts`, `src/lib/auth/guards.ts`
- `src/lib/validators/observations.ts`, `src/lib/validators/completions.ts`
- `src/components/observations/RecordObservationModal.tsx`
- `src/app/(protected)/activity/SupervisorActivityView.tsx`
- `src/app/(protected)/activity/[completionId]/page.tsx`, `CompletionDetailClient.tsx`
- `src/hooks/useNotifications.ts`, `src/components/layout/NotificationBadge.tsx`, `src/components/layout/BottomTabBar.tsx`
- `supabase/migrations/00009_worker_notifications.sql`
- `supabase/migrations/00010_completion_schema.sql`
- `supabase/migrations/00043_ownership_review_governance.sql`
- `supabase/migrations/00052_supervisor_observations.sql`, `00053_sop_observations_cross_org_guard.sql`, `00054_observation_read_role_scope.sql`
- `playwright.config.ts` (phase34/35/35-unit/36 project definitions)
- `.planning/phases/37-assessor-governance/37-CONTEXT.md`
- `.planning/REQUIREMENTS.md` (§v7.0), `.planning/STATE.md`

### Secondary (MEDIUM confidence)
None — this phase required zero external library/API research; all findings are direct
codebase reads verified in this session (grep + Read), which is the highest-confidence source
available for an internal-wiring phase.

### Tertiary (LOW confidence)
None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies, all patterns are direct reuse of Phase 34/35/36 code read in full this session
- Architecture: HIGH — every referenced file/line was read directly, not inferred
- Pitfalls: HIGH for Pitfalls 1/2/3/5 (directly verified via grep — e.g. `NotificationBadge` confirmed as sole consumer, `signOffCompletion`'s role array read verbatim); MEDIUM for Pitfall 4's residual-risk framing (a security judgment call, not a factual claim — flagged as Assumption A2 for confirmation)

**Research date:** 2026-07-28
**Valid until:** 30 days (stable internal codebase, no external API drift risk)
