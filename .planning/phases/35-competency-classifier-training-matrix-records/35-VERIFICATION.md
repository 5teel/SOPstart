---
phase: 35-competency-classifier-training-matrix-records
verified: 2026-07-24T00:00:00Z
status: gaps_found
score: 4/4 roadmap success criteria observably true; 2 unresolved code-review defects intersect must-haves
overrides_applied: 0
gaps:
  - truth: "generateTrainingCsv() emits RFC-4180-safe, injection-safe rows (35-01 must_have)"
    status: failed
    reason: "csv.ts:csvField() only quotes on comma/quote/newline. It does not neutralize leading =/+/-/@ (CSV formula injection / DDE) and does not force-quote embedded bare CR (\\r). worker_email is attacker-influenced at signup, sop_title/sop_number are author-controlled — both flow into this export unescaped. The export's own UAT copy tells the admin to open the file in Excel/Sheets and hand it to auditors, which is exactly the CSV-injection threat model. Confirmed unresolved by direct read of src/lib/competency/csv.ts (no review-fix commit exists after 35-REVIEW.md's CR-01 finding)."
    artifacts:
      - path: "src/lib/competency/csv.ts"
        issue: "csvField() (lines 41-47) has no formula-trigger neutralization and no CR-only force-quote"
    missing:
      - "Prefix a leading apostrophe (or equivalent neutralization) when a field starts with =, +, -, @, tab, or CR, per 35-REVIEW.md CR-01's suggested fix"
      - "Force-quote fields containing a bare \\r per RFC 4180"
      - "Add a csv.test.ts case asserting a formula-triggering value (e.g. '=HYPERLINK(...)') is neutralized"
  - truth: "A pure classifyCompetency() returns the correct state for every evidence combination (35-01 must_have)"
    status: partial
    reason: "The D-02 needs_support reset unconditionally sets state='read' whenever state !== 'not_started', including when the only positive evidence is hasPerformedToSopObservation with hasCompletion=false. For that exact combination (observed-but-never-completed + later needs_support), classifyCompetency emits 'read', and StatePill renders 'Read only' for a worker who never actually completed the SOP — fabricated evidence of a completion event. Confirmed by direct read of src/lib/competency/classify.ts lines 51-58; classify.test.ts has no case combining hasPerformedToSopObservation=true, hasCompletion=false, and a newer latestNeedsSupportAt (35-REVIEW.md WR-04, unresolved)."
    artifacts:
      - path: "src/lib/competency/classify.ts"
        issue: "D-02 reset floor is hardcoded to 'read' regardless of whether hasCompletion is true"
    missing:
      - "Reset to the highest state the remaining evidence actually supports (state = ev.hasCompletion ? 'read' : 'not_started') per 35-REVIEW.md WR-04's suggested fix, or explicitly redefine the product intent and update the comment + pill label semantics"
      - "Add the missing classify.test.ts case for this combination"
deferred: []
human_verification:
  - test: "Open /admin/team, switch to the ▦ Matrix view for a department with real people/SOPs/completions/observations, and confirm the pills, rollups, and compact/legend fallback render correctly at real screen widths."
    expected: "Labelled pills at normal scale; compact colored dots + legend only when columns genuinely overflow the container (fit-driven, not a hardcoded count)."
    why_human: "CSS-token/visual rendering and ResizeObserver-driven layout behavior are invisible to source-contract specs (CLAUDE.md 2026-07-14 learning)."
  - test: "Click a matrix cell and confirm the PersonPanel opens scrolled to the right SOP block; then press Export CSV from both the matrix header and the PersonPanel, and open the downloaded file in Excel/Sheets."
    expected: "Cell click deep-links to the correct person + SOP; CSV opens with the documented columns and honours the department/worker/SOP/date-range cut."
    why_human: "Real file download + spreadsheet-open behavior, and scrollIntoView timing, cannot be exercised by a Playwright source-contract spec."
  - test: "Un-fixme and run the 4 RLS runtime probes in tests/phase35/competency-rls-probe.spec.ts against a live Supabase project (supervisor same-org matrix read allowed; worker-at-matrix denied; admin cross-org deptId denied; worker getMyCompetencyStates self-only) — per the project's Railway-only-testing convention."
    expected: "All 4 probes pass with real assertions, not just fixture setup (35-REVIEW.md WR-07: the current probe bodies build fixtures but assert only `toBeTruthy()` on ids, not the actual behavior described in each probe's name)."
    why_human: "No live Supabase session is available in this environment; explicitly staged for sopstart.com UAT per project convention, and the review flagged the probe bodies themselves as not yet asserting real behavior."
---

# Phase 35: Competency Classifier + Training Matrix + Records Verification Report

**Phase Goal:** Admins get one derived-live training matrix (people × required SOPs × competency state), a per-worker training record view, and CSV export — all reading from one pure classifier function over existing evidence (grants, completions, sign-offs, observations), never a second stored/stale layer.
**Verified:** 2026-07-24T00:00:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Admin/supervisor sees a derived competency state for every person × required-SOP pair, computed live, no manual editing, no redundant stored table | ✓ VERIFIED (with a correctness caveat) | `classifyCompetency()` (src/lib/competency/classify.ts) is a pure D-01/D-02 ladder; `buildMatrix()` maps it over every (person, requiredSop) pair with zero DB access; `getTrainingMatrix` fetches only existing evidence tables (`sop_completions`, `completion_sign_offs`, `sop_observations`) plus already-materialized requirement junctions (`sop_departments`, `sop_access_people`) — no new migration adds a competency-state table (checked `supabase/migrations/`, latest is `00054`). **Caveat:** WR-04 (see gaps) — one evidence combination produces a state that overstates the worker's actual history. |
| 2 | Admin can view a training matrix as a third view mode on /admin/team, cut by department/worker/SOP | ✓ VERIFIED | `TeamViewShell.tsx` view union is `'chart' \| 'columns' \| 'matrix'`, `VIEW_OPTIONS` includes `▦ Matrix`, and the matrix branch renders `TrainingMatrixView` with `departments` + `onSelectCell`. `TrainingMatrixView` holds `departmentId`/`workerId`/`sopId` state and re-fetches `getTrainingMatrix` on every change (`matrix-filters.spec.ts`, 3/3 green; confirmed by direct read of the component's two `useEffect`s). |
| 3 | Worker read/walkthrough access is never gated by competency state — locked regression guard | ✓ VERIFIED | `tests/phase35/no-competency-gate.spec.ts` asserts `GATE_PATTERN` absence in `ReadTab.tsx`, the worker SOP detail route, and `CompetencySection.tsx` (its `fs.existsSync` branch is now live, not skipped, since 35-04 created the file). All 4 tests in this spec pass (self-check + 3 targets). Ran directly: green. |
| 4 | Per-worker training record shows every completion as evidence (SOP, version, date, sign-off chain) and exports as CSV filterable by worker/SOP/department/date, SF-shaped | ✓ VERIFIED (with an unresolved security defect) | `TrainingRecordSection.tsx` groups by required SOP with a `StatePill` header + completion/observation evidence lines, plus a distinct "Other completed SOPs" section (D-13). Both `TrainingMatrixView` (filtered-cut) and `TrainingRecordSection` (single-worker) headers have an "Export CSV" button whose `onClick` handler directly invokes `exportTrainingCsv(...)` then `downloadCsv(...)` (confirmed by reading the handler bodies, not just grepping the file — matches the 2026-06-05 no-dead-feature discipline). `exportTrainingCsv` supports `departmentId`/`workerId`/`sopId`/`dateFrom`/`dateTo`. **Caveat:** CR-01 (see gaps) — the CSV generator does not neutralize formula-injection payloads, an unresolved Critical finding from the phase's own code review, on an export whose stated purpose is opening in Excel and handing to auditors. |

**Score:** 4/4 roadmap success criteria are structurally true and directly observed in running code + passing tests. Two unresolved defects from the phase's own code review (one Critical, one correctness Warning) intersect the must-haves behind SC-1 and SC-4 and were confirmed still present by direct source read — no review-fix commit exists on `src/lib/competency/csv.ts` or `classify.ts` after `35-REVIEW.md` was produced.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/competency/classify.ts` | `classifyCompetency()` pure D-01/D-02 function | ✓ VERIFIED (correctness caveat WR-04) | Exports exactly the 4-member `CompetencyState` union; no `'use server'`, no supabase import; behavioral tests green (7/7) but the WR-04 combination is untested and produces an incorrect result. |
| `src/lib/competency/matrix.ts` | `buildMatrix()` pure assembler | ✓ VERIFIED | No `access_grants`/`@/actions/grants` reference (MTX-02 mechanically enforced by `matrix-derivation.spec.ts`, green); cells expose `latestCompletionAt`/`latestCompletionVersion` (Phase 36 forward-compat). |
| `src/lib/competency/csv.ts` | `generateTrainingCsv()` RFC-4180-safe generator | ⚠️ STUB-ADJACENT (CR-01) | Function exists, is pure, and handles comma/quote/newline quoting correctly (unit-tested), but is missing formula-injection neutralization and CR-only force-quoting — an unresolved Critical finding. |
| `src/actions/competency.ts` | 4 server actions (matrix/record/self/CSV) | ✓ VERIFIED | All 4 exported; `RECORDER_ROLES` gate before every org-wide read (source-contract green, 26/26 in `competency-actions.spec.ts`); `getMyCompetencyStates` is self-scoped (no admin client, no role gate — verified both by source-contract and direct read); `sop_access_people` read via admin client (confirmed against the supervisor-RLS-exclusion note in migration 00046). |
| `src/lib/validators/competency.ts` | Zod filter schemas | ✓ VERIFIED | `MatrixFiltersSchema` requires `departmentId`; `CsvExportFiltersSchema` all-optional incl. `dateFrom`/`dateTo`. |
| `src/components/admin/competency/StatePill.tsx` | sketch-05 pill vocabulary | ✓ VERIFIED | All 5 labels present, tokens declared in `blueprint-theme.css`, no click handler/disabled affordance. |
| `src/components/admin/competency/TrainingMatrixView.tsx` | matrix table + filters + export | ✓ VERIFIED, WIRED | Imports `getTrainingMatrix`/`exportTrainingCsv`/`downloadCsv`/`StatePill`; cell click invokes `onSelectCell` with real ids; Export button handler invokes `exportTrainingCsv` then `downloadCsv` (not a bare mention); compaction driven by measured `containerWidth`, not a hardcoded integer. |
| `src/components/admin/competency/TrainingRecordSection.tsx` | per-worker record + export | ✓ VERIFIED, WIRED | Groups by required SOP + "Other completed" bucket; scrolls to `focusSopId`; Export handler invokes `exportTrainingCsv({ workerId: personId })` then `downloadCsv`. |
| `src/components/admin/org-model/TeamViewShell.tsx` | third 'matrix' view + focusSopId wiring | ✓ VERIFIED, WIRED | `view` union includes `'matrix'`; `handleSelectCell` sets both `selectedPerson` and `focusSopId`, passed into `PersonPanel`. |
| `src/components/admin/org-model/PersonPanel.tsx` | renders TrainingRecordSection | ✓ VERIFIED, WIRED | Renders `<TrainingRecordSection personId={person.id} focusSopId={focusSopId} />` as a third section. |
| `src/lib/competency/download-csv.ts` | client Blob-download helper | ✓ VERIFIED | Forks the FlowGraphCanvas Blob/anchor idiom verbatim; used by both export callers. |
| `src/components/profile/CompetencySection.tsx` | worker's own states, informational | ✓ VERIFIED, WIRED | Awaits `getMyCompetencyStates()` (self-scoped); renders `StatePill` per required SOP; trust-framing caption present; no gating affordance; mounted in `profile/page.tsx` below `ObservationsSection`. |
| `src/lib/journeys/journeys.ts` | training-matrix journey | ✓ VERIFIED | `training-matrix-records` journey references `/admin/team` (matrix toggle, cell click, export) and `/profile` (worker's own state). |
| `src/lib/uat/tests.ts` | 3 layman UAT items | ✓ VERIFIED | Matrix view, cell-click, Export CSV items present in plain language. |
| `playwright.config.ts` | `phase35`/`phase35-unit` projects | ✓ VERIFIED | Both registered and discoverable; confirmed by running both projects directly (83 passed, 4 skipped). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `matrix.ts` | `classify.ts` | `classifyCompetency` import, mapped per pair | ✓ WIRED | Confirmed by direct read; matrix-derivation.spec.ts green. |
| `matrix.ts` | grants/access_grants | MUST NOT import | ✓ VERIFIED ABSENT | matrix-derivation.spec.ts green; direct read confirms no reference. |
| `TeamViewShell.tsx` | `TrainingMatrixView` + `PersonPanel` | matrix view branch; `onSelectCell` sets `selectedPerson` + `focusSopId` | ✓ WIRED | Direct read of `handleSelectCell` confirms both are set. |
| `TrainingMatrixView.tsx` | `getTrainingMatrix` | client fetch on dept/filter change | ✓ WIRED | Two `useEffect`s both call it; `matrix-filters.spec.ts` green. |
| `PersonPanel.tsx` | `TrainingRecordSection` (→ `getTrainingRecordForPerson`) | rendered as 3rd section | ✓ WIRED | Direct read confirms render + prop pass-through. |
| `TrainingMatrixView.tsx` + `TrainingRecordSection.tsx` | `exportTrainingCsv` + `downloadCsv` | Export CSV button `onClick` | ✓ WIRED | Both handler bodies directly invoke the action then the download helper — verified by reading the function bodies, not just grepping tokens. |
| `CompetencySection.tsx` | `getMyCompetencyStates` | self-scoped async render | ✓ WIRED | Direct read confirms the await + map to `StatePill`. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `TrainingMatrixView` | `matrix`/`people`/`sops` state | `getTrainingMatrix()` → real Supabase reads (`sop_completions`, `sop_observations`, `completion_sign_offs`, `sop_departments`, `sop_access_people`) → `buildMatrix()` | Yes (real queries, org-scoped) | ✓ FLOWING |
| `TrainingRecordSection` | `record` state | `getTrainingRecordForPerson()` → real Supabase reads → per-SOP grouping | Yes | ✓ FLOWING |
| `CompetencySection` | `states` (server-side await) | `getMyCompetencyStates()` → real Supabase reads, self-scoped | Yes | ✓ FLOWING |
| CSV export | `csv` string | `exportTrainingCsv()` → real `sop_completions` query with filter chain, joined to sign-offs/sops/names | Yes | ✓ FLOWING (content correctness caveat: CR-01/WR-04 above) |

### Behavioral Spot-Checks

Not run as a live-server check (no dev server started, per project convention of Railway-only live testing) — covered instead by direct read of the actual handler bodies (see Key Link Verification) and by executing the full phase35/phase35-unit Playwright suite directly in this session (see below), rather than trusting SUMMARY.md's reported numbers.

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full phase35 + phase35-unit suite | `npx playwright test --project=phase35 --project=phase35-unit --reporter=line` | 83 passed, 4 skipped (0 failed) — run directly in this session, not taken from SUMMARY.md | ✓ PASS |
| Full TypeScript project check | `npx tsc --noEmit` | Clean, no errors — run directly in this session | ✓ PASS |
| No new competency-state migration | `ls supabase/migrations` + grep for `competency_state` | No matching migration; latest is `00054_observation_read_role_scope.sql` | ✓ PASS (confirms "no redundant stored table") |

### Probe Execution

No `scripts/*/tests/probe-*.sh` probes exist for this phase (Playwright specs are the phase's verification mechanism, not shell probes). N/A — skipped per Step 7c (no conventional probe scripts declared or discovered).

The phase's own runtime RLS probes (`tests/phase35/competency-rls-probe.spec.ts`) are staged `test.fixme` per the project's Railway-only-testing convention and are covered under Human Verification below, per the known context provided for this verification.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|--------------|-------------|-------------|--------|----------|
| CMP-01 | 35-01, 35-02, 35-04 | Derived competency state per person×required-SOP, computed live, no redundant table | ✓ SATISFIED (correctness caveat) | classify.ts/matrix.ts/actions + UI render live states; WR-04 is a real but narrow correctness gap in one evidence combination. |
| CMP-02 | 35-01 | Evidence events advance derived state, no manual editing | ✓ SATISFIED | classify.ts is a pure function of evidence only; no manual-state-edit UI exists anywhere in the phase's files. |
| CMP-04 | 35-01, 35-02, 35-03, 35-04 | Competency state never gates worker access — locked regression guard | ✓ SATISFIED | no-competency-gate.spec.ts green across all 3 targets (ReadTab, worker SOP route, CompetencySection); no `disabled=`/lock affordance keyed on state anywhere in the matrix/record/export UI (source-negative specs green). |
| MTX-01 | 35-03 | Training matrix as third /admin/team view mode | ✓ SATISFIED | TeamViewShell + TrainingMatrixView, verified above. |
| MTX-02 | 35-01 | Zero double-derivation — requirements from materialized junctions only | ✓ SATISFIED | matrix-derivation.spec.ts green; direct read confirms no access_grants reference anywhere in matrix.ts. |
| MTX-03 | 35-02, 35-03 | Cut by department/worker/SOP | ✓ SATISFIED | MatrixFiltersSchema + TrainingMatrixView filter state + matrix-filters.spec.ts green. |
| TRN-01 | 35-02, 35-03 | Per-worker training record — completions as evidence | ✓ SATISFIED | getTrainingRecordForPerson + TrainingRecordSection, verified above. |
| TRN-02 | 35-01, 35-02, 35-03 | CSV export, filterable, SF-shaped | ✓ SATISFIED with an unresolved Critical security defect (CR-01) | exportTrainingCsv + generateTrainingCsv wired and reachable from both UI entry points; the generator itself has an unpatched CSV-formula-injection hole. |

No orphaned requirements found — all 8 IDs declared across the 4 plans' frontmatter match the ROADMAP.md Phase 35 requirement list exactly.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/lib/competency/csv.ts` | 41-47 | Unescaped CSV formula-injection vector (`=`, `+`, `-`, `@` leading chars; bare `\r` not force-quoted) | 🛑 Blocker (unresolved Critical from 35-REVIEW.md CR-01) | An export explicitly intended to be opened in Excel/Sheets and handed to auditors can execute attacker/author-controlled formulas from `worker_email`/`sop_title`/`sop_number` fields. |
| `src/lib/competency/classify.ts` | 51-58 | D-02 reset floor hardcodes `'read'` regardless of `hasCompletion` | ⚠️ Warning (unresolved from 35-REVIEW.md WR-04) | For an observed-but-never-completed worker with a later needs_support flag, the matrix/record/profile all render "Read only" — asserting a completion event that never happened. |
| `src/actions/competency.ts` | 60-71 | `resolveDisplayNames` caps at 1,000 `listUsers` with no pagination | ⚠️ Warning (unresolved from 35-REVIEW.md WR-05) | Beyond 1,000 total platform users (all tenants pooled), matrix/CSV identity columns silently degrade to "Unknown"/"unknown" with no error — systemic with the same pattern in observations.ts. Not yet triggered at current scale. |
| `src/actions/competency.ts` | 411-431 | `getMyCompetencyStates` unions requirements across all the caller's orgs, not just the active one | ⚠️ Warning (unresolved from 35-REVIEW.md WR-06) | A multi-org worker's /profile shows phantom "Untitled SOP" rows stuck at not_started from a foreign org. Only manifests for multi-org users. |
| `src/actions/competency.ts` | 530 | `dateTo` compared with `.lte` against a bare date string — effectively excludes the "To" day's later-UTC completions | ⚠️ Warning (unresolved from 35-REVIEW.md WR-01) | CSV export can silently drop the last day of a requested range — audit-completeness concern. |
| `TrainingMatrixView.tsx` | 74-99 | No cancellation flag on the department/filter fetch effects (unlike `TrainingRecordSection`, which has one) | ⚠️ Warning (unresolved from 35-REVIEW.md WR-02) | Rapid filter switching can render a stale department's data under the new selector. |
| `TrainingMatrixView.tsx` / `TrainingRecordSection.tsx` | 77, 89-94 / 55 | Action `{ error }` responses collapse into misleading empty states ("No people…", blank record) instead of a distinguishable error message | ⚠️ Warning (unresolved from 35-REVIEW.md WR-03) | An authorization/org regression would look identical to "this department has no data." |

None of these are debt markers (TBD/FIXME/XXX) — all are unresolved, previously-documented code-review findings confirmed still present by direct re-read in this verification pass.

### Human Verification Required

See `human_verification` in the frontmatter — 3 items (visual/layout rendering of the matrix compaction, real file-download + spreadsheet-open behavior of the CSV export, and running the 4 staged RLS probes against a live Supabase project).

### Gaps Summary

The four ROADMAP.md success criteria for Phase 35 are all structurally implemented and directly observed working: the classifier/matrix/CSV pipeline is a real pure-function pipeline with no redundant stored state, the matrix is a genuine third `/admin/team` view with working department/worker/SOP filters and cell-click deep-linking, the CMP-04 worker-non-gating guard is green across all three target files (including the newly-activated `CompetencySection` branch), and both CSV export entry points are demonstrably wired end-to-end (not dead `onClick`s). The full phase35 + phase35-unit Playwright suite (83 tests) and `npx tsc --noEmit` both pass when run directly in this verification session.

However, this phase's own code review (`35-REVIEW.md`, produced the same day) found one unresolved Critical defect and six unresolved Warnings, and no review-fix commit exists on any of the affected files. Two of these — CR-01 (CSV formula injection, unresolved on an export whose stated purpose is opening in Excel and handing to an auditor) and WR-04 (the classifier can fabricate a "Read only" state for a worker who never completed the SOP) — directly intersect this phase's own must-haves ("RFC-4180-safe quoting" and "returns the correct state for every evidence combination"). Per the adversarial verification mandate, these are carried forward as blocking/warning gaps rather than treated as already-resolved because SUMMARY.md reports the phase as complete. The remaining four Warnings (1,000-user display-name ceiling, multi-org profile leak, date-range exclusivity, missing fetch-cancellation/error-surfacing) are lower-severity, narrower-scope defects also confirmed still present, listed as anti-patterns rather than blocking gaps.

---

_Verified: 2026-07-24T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
