---
phase: 35-competency-classifier-training-matrix-records
reviewed: 2026-07-24T00:49:24Z
depth: standard
files_reviewed: 29
files_reviewed_list:
  - src/actions/competency.ts
  - src/app/(protected)/profile/page.tsx
  - src/components/admin/competency/StatePill.tsx
  - src/components/admin/competency/TrainingMatrixView.tsx
  - src/components/admin/competency/TrainingRecordSection.tsx
  - src/components/admin/org-model/PersonPanel.tsx
  - src/components/admin/org-model/TeamViewShell.tsx
  - src/components/profile/CompetencySection.tsx
  - src/lib/competency/__tests__/classify.test.ts
  - src/lib/competency/__tests__/csv.test.ts
  - src/lib/competency/__tests__/matrix.test.ts
  - src/lib/competency/classify.ts
  - src/lib/competency/csv.ts
  - src/lib/competency/download-csv.ts
  - src/lib/competency/matrix.ts
  - src/lib/journeys/journeys.ts
  - src/lib/uat/tests.ts
  - src/lib/validators/competency.ts
  - src/styles/blueprint-theme.css
  - tests/phase35/competency-actions.spec.ts
  - tests/phase35/competency-rls-probe.spec.ts
  - tests/phase35/matrix-derivation.spec.ts
  - tests/phase35/matrix-filters.spec.ts
  - tests/phase35/no-competency-gate.spec.ts
  - tests/phase35/profile-competency.spec.ts
  - tests/phase35/state-pill.spec.ts
  - tests/phase35/training-matrix-view.spec.ts
  - tests/phase35/training-record.spec.ts
findings:
  critical: 1
  warning: 7
  info: 6
  total: 14
status: issues_found
---

# Phase 35: Code Review Report

**Reviewed:** 2026-07-24T00:49:24Z
**Depth:** standard
**Files Reviewed:** 29
**Status:** issues_found

## Summary

Reviewed the Phase 35 competency classifier, training matrix, per-worker training record, worker profile section, and CSV export against the project's recurring bug classes. The auth posture is largely sound and clearly better than the Phase 23/25/34 baselines it cites: every admin-client read self-enforces `organisation_id` (verified against `getTrainingMatrix`, `getTrainingRecordForPerson`, `exportTrainingCsv`); a client-supplied `departmentId`/`personId` is verified in-org before any read; `getMyCompetencyStates` correctly stays on the session client (self-read RLS branches confirmed against migrations 00010/00046/00054); the `'use server'` file exports only async functions; all referenced CSS tokens (`--accent-signoff`, `--accent-step`, `--accent-decision`, `--ink-500`, etc.) are declared in `blueprint-theme.css`, which applies globally (`app/layout.tsx` sets `data-theme="paper"` on `<body>`); both Playwright projects (`phase35`, `phase35-unit`) are registered; `journeys.ts` and `uat/tests.ts` were updated in-phase; the matrix adds no new route, so the /pathways coverage rule holds.

Defects found: one security vulnerability (CSV formula injection in an export the UAT script explicitly tells users to open in Excel), a set of correctness/robustness warnings (end-date exclusivity silently truncating audit exports, an uncancelled fetch race, errors swallowed into misleading empty states, a classifier state that claims a completion which never happened, a 1000-user display-name ceiling that corrupts exports, multi-org requirement bleed on the profile), and a test-reliability warning (the RLS probe file's "un-fixme to activate" instruction activates tests that assert nothing).

## Critical Issues

### CR-01: CSV formula injection — exported fields are not sanitized against Excel formula execution

**File:** `src/lib/competency/csv.ts:41-47`
**Issue:** `csvField()` handles RFC-4180 quoting only. Fields beginning with `=`, `+`, `-`, `@` (or containing a leading tab/CR) are emitted verbatim, and spreadsheet apps execute them as formulas (classic CSV injection / DDE). The exported columns include `worker_email` (attacker-controlled at account registration — an email local part may legally contain `=` and `+`), and `sop_title`/`sop_number` (authored by any org member with SOP-edit rights). The UAT script (`src/lib/uat/tests.ts` p35 export test) explicitly instructs: "open the downloaded file in Excel/Sheets", and the stated purpose is handing the file to auditors — this export's threat model is exactly the one CSV injection targets. `csvField` also doesn't force-quote on `\r` (RFC 4180 requires quoting CR).
**Fix:**
```ts
export function csvField(val: string | number | null): string {
  let str = val === null || val === undefined ? '' : String(val)
  // Neutralize formula triggers for Excel/Sheets consumers (CSV injection).
  if (/^[=+\-@\t\r]/.test(str)) str = "'" + str
  if (/[",\n\r]/.test(str)) {
    return '"' + str.replace(/"/g, '""') + '"'
  }
  return str
}
```
Update `tests/phase35/__tests__/csv.test.ts` with a case asserting `=HYPERLINK(...)` is prefixed.

## Warnings

### WR-01: `dateTo` end-date is effectively exclusive — completions on the "To" day are silently dropped from the audit export

**File:** `src/actions/competency.ts:530` (with `src/components/admin/competency/TrainingMatrixView.tsx:199-207`)
**Issue:** The UI feeds `<input type="date">` values (`YYYY-MM-DD`). `query.lte('submitted_at', dateTo)` compares a `timestamptz` against midnight of that date, so every completion submitted after 00:00 UTC on the To-day is excluded. A user exporting "From 1 Jul To 24 Jul" loses all of 24 Jul's records — silently incomplete audit evidence. NZ-timezone skew makes it worse (UTC midnight is midday NZ). Sibling issue: `dateFrom`/`dateTo` are `z.string().optional()` with no format constraint, so any junk string reaches PostgREST and surfaces only as the generic "Failed to fetch completions."
**Fix:** Make the end bound inclusive of the whole day and validate the format:
```ts
// validators/competency.ts
dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),

// competency.ts
if (dateTo) query = query.lt('submitted_at', nextDayIso(dateTo)) // dateTo + 1 day, exclusive
```

### WR-02: Matrix fetch has no cancellation — rapid filter/department changes can render a stale cut

**File:** `src/components/admin/competency/TrainingMatrixView.tsx:84-99` (also 74-81)
**Issue:** Neither `getTrainingMatrix` effect guards against out-of-order resolution. Switching Department A → B fires two requests; if A's (larger dept, slower query) resolves after B's, the view shows Department A's people/rollups under Department B's selector — wrong data presented as current. `TrainingRecordSection.tsx:50-60` implements the `cancelled` flag correctly; this component omitted it in both effects.
**Fix:** Apply the same idiom:
```ts
useEffect(() => {
  if (!departmentId) return
  let cancelled = false
  setLoading(true)
  getTrainingMatrix({ departmentId, workerId: workerId || undefined, sopId: sopId || undefined }).then((result) => {
    if (cancelled) return
    ...
  })
  return () => { cancelled = true }
}, [departmentId, workerId, sopId])
```

### WR-03: Action errors are swallowed into misleading empty states in both consumers

**File:** `src/components/admin/competency/TrainingMatrixView.tsx:77,89-94`; `src/components/admin/competency/TrainingRecordSection.tsx:55`
**Issue:** When `getTrainingMatrix` returns `{ error }` (not-authorized, department deleted after a `router.refresh`, org mismatch), the matrix view clears state and renders "No people with required SOPs in this cut." — a data statement that is false; the first effect (`if ('error' in result) return`) additionally leaves the previous department's worker/SOP filter options in place. `TrainingRecordSection` is worse: on `{ error }` it sets `loading=false` with `record=null`, and every branch is gated on `record &&`, so the panel renders nothing at all — a supervisor sees a blank section with an Export button and no explanation. This is the "feature silently dead for a persona" presentation class from the 2026-07-20 learning; a real authorization regression would be indistinguishable from an empty department.
**Fix:** Add an `error` state in both components and render the returned message (the export path already does exactly this with `exportError`).

### WR-04: Classifier can emit `read` / "Read only" for a worker who never completed the SOP

**File:** `src/lib/competency/classify.ts:51-58` (surfaced via `StatePill.tsx:37-39`)
**Issue:** The D-02 reset sets `state = 'read'` whenever any positive state exists and a newer `needs_support` observation arrives. But `supervised` is reachable without a completion (`hasPerformedToSopObservation` alone). For an observed-but-never-completed worker who later gets `needs_support`, the result is `state='read'` — rendered as the "Read only" pill — asserting the worker read/completed an SOP they never opened. The code comment "never demotes below 'read' (the completion happened)" is false on this path, and the training record/matrix now display fabricated evidence of reading. No unit test covers this combination (`classify.test.ts` never sets `hasPerformedToSopObservation` together with `latestNeedsSupportAt` and `hasCompletion: false`).
**Fix:** Reset to the highest state the remaining evidence supports:
```ts
if (ev.latestNeedsSupportAt && state !== 'not_started' && (!ev.latestPositiveEvidenceAt || ev.latestNeedsSupportAt > ev.latestPositiveEvidenceAt)) {
  state = ev.hasCompletion ? 'read' : 'not_started' // or introduce no demotion below the true floor
  needsSupportFlag = true
}
```
(If product intent is "flag but keep floor at read", at minimum fix the comment and the pill label semantics; add the missing unit case either way.)

### WR-05: `resolveDisplayNames` caps at 1,000 auth users with no pagination — silently corrupts matrix names and CSV identity columns

**File:** `src/actions/competency.ts:60-71`
**Issue:** `admin.auth.admin.listUsers({ perPage: 1000 })` fetches only page 1 of the entire Supabase project's users (all tenants pooled). Once the project passes 1,000 users, workers beyond the first page render as "Unknown" in the matrix/record and — worse — get `worker_email: 'unknown'` rows in the SuccessFactors-shaped CSV (`competency.ts:557`), destroying the export's identity column with no error. Target market is 50–500 SOPs orgs across multiple tenants; 1,000 users is a reachable ceiling. The comment says it "mirrors observations.ts" — the same ceiling exists there, making this systemic (CLAUDE.md rule 5: fix the pattern, not the instance).
**Fix:** Loop `listUsers({ page, perPage: 1000 })` until `ids` are all resolved or pages are exhausted; or resolve emails from a first-class org-scoped source instead of the global auth admin API. Apply the same fix to `observations.ts`'s `resolveDisplayNames`.

### WR-06: `getMyCompetencyStates` leaks cross-org requirements into the profile for multi-org users as phantom "Untitled SOP" rows

**File:** `src/actions/competency.ts:411-431`
**Issue:** `member_departments` (SELECT `using(true)`) and `sop_access_people` (self-read branch `member_id = auth.uid()` with no org constraint) return the caller's rows across ALL their organisations, and neither query is org-filtered. For a multi-org user (the app has an OrgSwitcher), `requiredSopIds` unions requirements from every org. The subsequent `sops` title fetch IS org-RLS-scoped to the current org, so the foreign org's requirements render on /profile as "Untitled SOP" rows permanently stuck at `not_started` (their completions/observations are also RLS-filtered to the current org). The worker sees wrong counts ("N SOPs") and dead rows they can never clear.
**Fix:** Scope the requirement derivation to the active org — e.g. filter `deptIds` through an org-scoped `departments` lookup (`.in('id', deptIds).eq('organisation_id', organisationId)` needs the admin client or a departments read policy) or intersect `requiredSopIds` with the org-visible `sopRows` ids before mapping:
```ts
const visibleIds = new Set(sopRows?.map(s => s.id))
const scopedRequired = requiredSopIds.filter(id => visibleIds.has(id))
```
(The intersection variant also removes every "Untitled SOP" fallback on this path.)

### WR-07: The RLS probe suite asserts nothing even when un-fixme'd — its own activation instruction produces green tests that probe no branch

**File:** `tests/phase35/competency-rls-probe.spec.ts:122-213`
**Issue:** The file header says "Un-fixme by removing `test.fixme(...)` guards once run against a real Supabase project." But every probe body builds fixtures, then ends with `expect(deptId).toBeTruthy()` / `expect(orgId).toBeTruthy()` — the actual probe ("call getTrainingMatrix as the supervisor session and confirm people includes workerId") exists only as a comment. Removing the fixme guards yields 4 green "probes" that never call a single competency action. This is precisely the guard-that-guards-nothing class the file itself cites (2026-07-20: every RLS branch needs its own positive AND negative runtime probe) and the 2026-06-05 presence-vs-wiring learning. Someone following the stated instruction during sopstart.com UAT will read green as "RLS posture verified."
**Fix:** Either implement the real assertions now (the server actions can't be imported into Playwright's Node runner directly, but each probe's semantics can be exercised via PostgREST with the minted user client — e.g. Probe 1: supervisor session reads `sop_access_people` and asserts rows; Probe 4: worker A client reads worker B's `sop_observations` and asserts zero rows), or change the header instruction to say the bodies must be WRITTEN, not merely un-fixme'd, and add a `test.fail`-style tripwire so an un-fixme'd placeholder cannot pass.

## Info

### IN-01: `callerOrgId` is redundant — it provably always returns `getSessionContext().organisationId`

**File:** `src/actions/competency.ts:48-57`
**Issue:** `getSessionContext()` already derives `organisationId` from an `organisation_members` DB lookup (claim-scoped, `session-context.ts:36-42`) — it is never "the JWT claim alone." `callerOrgId`'s unscoped `.maybeSingle()` errors for any multi-org user (2+ rows) and silently falls back to `sessionOrgId`; for single-org users it returns the same row the session context found. Net: one extra round-trip per action call, a swallowed error on the multi-org path, and a comment asserting a distinction that doesn't exist.
**Fix:** Delete `callerOrgId` and use `organisationId` directly (repoint the `competency-actions.spec.ts` assertions that pin `callerOrgId(` in the same commit — the 2026-07-13 stale-guard learning).

### IN-02: Matrix cell click shows "Unknown" in the panel header for people not placed in an org-chart role

**File:** `src/components/admin/org-model/TeamViewShell.tsx:63-67`
**Issue:** `personLabelFromTree` only finds people attached to a role in the org tree. A department member with no role assignment appears in the matrix with their email (from `MatrixPerson.displayName`) but opens a PersonPanel headed "Unknown."
**Fix:** Thread the clicked row's `displayName` through `onSelectCell(personId, sopId, displayName)` and prefer it over the tree lookup.

### IN-03: Department change triggers two identical `getTrainingMatrix` calls

**File:** `src/components/admin/competency/TrainingMatrixView.tsx:74-99`
**Issue:** When `departmentId` changes (with filters empty), the options effect and the matrix effect both call `getTrainingMatrix({ departmentId })` — a duplicated round-trip of the heaviest query on every department switch.
**Fix:** When `workerId`/`sopId` are both empty, reuse the unfiltered result for both option lists and matrix (one effect, one call).

### IN-04: Blanket `not.toMatch(/disabled=/)` in view specs over-reads CMP-04 and blocks in-flight export protection

**File:** `tests/phase35/training-matrix-view.spec.ts:52-54,73-75`; `tests/phase35/training-record.spec.ts:45-47,70-73`
**Issue:** CMP-04 forbids gating on *competency state*; the specs forbid `disabled=` anywhere in the files. Consequence: the Export CSV button cannot be disabled while `exporting` is true, so double-clicks fire concurrent exports/downloads. The `exporting` state exists but only changes the label.
**Fix:** Narrow the assertion to disabled-keyed-on-competency (mirror `no-competency-gate.spec.ts`'s `GATE_PATTERN`), then add `disabled={exporting}` to both export buttons.

### IN-05: Compact matrix dot tooltip exposes the raw enum value

**File:** `src/components/admin/competency/TrainingMatrixView.tsx:281`
**Issue:** `title={cell.state}` shows `competent_signed_off` / `not_started` to supervisors — internal identifiers in a user-facing tooltip (the UAT layman-language convention).
**Fix:** Map through the StatePill label vocabulary (extract the label mapping from `StatePill.tsx` into a shared `stateLabel()` helper).

### IN-06: `getMyCompetencyStates` awaits independent queries serially on the profile server render

**File:** `src/actions/competency.ts:431-453`
**Issue:** The `sops`, `sop_completions`, and `sop_observations` reads are mutually independent but awaited in sequence (sign-offs legitimately depend on completions). Project convention (CLAUDE.md 2026-07-13): independent server fetches belong in `Promise.all`. Adds avoidable latency to every /profile render since `CompetencySection` is an RSC on the page's critical path.
**Fix:** `const [sopsRes, completionsRes, observationsRes] = await Promise.all([...])`, then fetch sign-offs.

---

_Reviewed: 2026-07-24T00:49:24Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
