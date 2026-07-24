---
phase: 35
slug: competency-classifier-training-matrix-records
status: verified
threats_open: 0
asvs_level: 1
created: 2026-07-24
---

# Phase 35 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|----------------|
| (none — pure functions) | `classify.ts` / `matrix.ts` / `csv.ts` perform zero I/O; callers own all data-fetching and scoping | none (no untrusted input crosses a boundary in these modules) |
| client → server action | Filter inputs (deptId, workerId, sopId, date range) arrive from the admin UI — untrusted, Zod-validated, never used to widen org scope | departmentId/workerId/sopId/dateFrom/dateTo |
| server action → admin client | `createAdminClient()` bypasses RLS (service role) — the action must self-enforce `organisation_id` and role-gate before any org-wide read | sop_completions, sop_observations, sop_access_people, member_departments, departments rows |
| worker → `getMyCompetencyStates` | A worker session reads its own competency — must stay self-scoped to `auth.uid()`, never reachable to peers' rows | own completions/observations/sign-offs/requirements |
| matrix cell click → server action | `onSelectCell` forwards personId/sopId; the opened record re-fetches server-side, re-applying role + org scope — client is never the trust anchor | personId, sopId |
| Export CSV button → server action | Button forwards only filter ids/dates to `exportTrainingCsv`; action re-applies the RECORDER_ROLES gate + org-self-enforce; client turns the returned string into a Blob (no new endpoint) | filtered CSV string |
| rendered competency state → worker control flow | Competency pills are rendered admin/worker-side; must never gate any worker action (CMP-04 locked north star) | CompetencyState enum (display only) |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-35-01-01 | Information Disclosure | matrix.ts / classify.ts | accept | Pure functions perform zero I/O — confirmed by direct read (no `@/lib/supabase` import, no data source reachable). Scoping lives in 35-02's server actions. | closed |
| T-35-01-02 | Tampering | MTX-02 double-derivation | mitigate | `tests/phase35/matrix-derivation.spec.ts` fails the phase if `matrix.ts` imports `access_grants` / `@/actions/grants` — ran directly, green (3/3). Direct read of `matrix.ts` confirms no such reference. | closed |
| T-35-01-03 | Elevation of Privilege | CMP-04 worker gate | mitigate | `tests/phase35/no-competency-gate.spec.ts` `GATE_PATTERN` guard — ran directly, green across all 3 targets (ReadTab.tsx, worker SOP detail route, CompetencySection.tsx). Direct grep of ReadTab.tsx and the worker route confirms zero `competency` references. | closed |
| T-35-01-SC | Tampering | package installs | accept | Zero packages installed — confirmed via `git log -- package.json` across the phase's commit range (no diff). | closed |
| T-35-02-01 | Information Disclosure | getTrainingMatrix / exportTrainingCsv admin-client reads | mitigate | `callerOrgId()` self-derive + `.eq('organisation_id', orgId)` on `sop_completions`/`sop_observations`; `departments` row verified `.eq('organisation_id', orgId)` before any department-scoped read. Confirmed by direct read of `src/actions/competency.ts` (lines 120-126, 169-190, 542-556) and green `competency-actions.spec.ts` (26/26). | closed |
| T-35-02-02 | Elevation of Privilege | role-check-missing on org-wide read | mitigate | `RECORDER_ROLES.includes(role)` gate present before every read in `getTrainingMatrix`, `getTrainingRecordForPerson`, `exportTrainingCsv` — confirmed by direct read + green source-contract. **Caveat:** the runtime-probe component of this mitigation (`tests/phase35/competency-rls-probe.spec.ts` Probe 1/2) is staged `test.fixme` with a deliberate tripwire (WR-07 fix) — honestly represents "not yet run against live Supabase," not a false pass. Pending sopstart.com UAT per Railway-only-testing convention; code-level control is verified and closes the threat. | closed |
| T-35-02-03 | Information Disclosure | getMyCompetencyStates over-share | mitigate | Confirmed self-scoped: session client (`supabase`) filtered by `userId` only; no `createAdminClient`, no `RECORDER_ROLES` check — direct read of the function body + green source-contract (`competency-actions.spec.ts` lines 116-129). | closed |
| T-35-02-04 | Spoofing / Information Disclosure | CSV export under-authenticated route | mitigate | `exportTrainingCsv` stays a role-gated `'use server'` action; confirmed no `src/app/api/competency` directory exists (source-contract + direct filesystem check). | closed |
| T-35-02-05 | Denial-of-failure (dead feature) | supervisor `sop_access_people` read via session client → empty (Phase 34-10 class) | mitigate | Confirmed `admin.from('sop_access_people')` used in both `getTrainingMatrix` and `getTrainingRecordForPerson` (never the session client). Source-contract green. Runtime probe (Probe 1) staged pending live UAT — same caveat as T-35-02-02. | closed |
| T-35-02-06 | Tampering | filter input validation | mitigate | `MatrixFiltersSchema` (departmentId required uuid) / `CsvExportFiltersSchema` (all-optional, `dateFrom`/`dateTo` strict `YYYY-MM-DD` regex post-review-fix) — confirmed by direct read of `src/lib/validators/competency.ts`. | closed |
| T-35-02-SC | Tampering | package installs | accept | Zero packages installed — confirmed, no package.json diff. | closed |
| T-35-03-01 | Information Disclosure | TrainingMatrixView / TrainingRecordSection client fetch | mitigate | Both components exclusively call the 35-02 gated actions (`getTrainingMatrix`, `getTrainingRecordForPerson`); server re-validates department-org/person-org membership on every call regardless of client-supplied ids. Confirmed by direct read. | closed |
| T-35-03-02 | Elevation of Privilege | CMP-04 — state pill becomes a worker gate | mitigate | Confirmed zero `disabled=` occurrences anywhere in `TrainingMatrixView.tsx`/`TrainingRecordSection.tsx`; matrix/record are admin-route-only (`/admin/team`); `no-competency-gate.spec.ts` covers worker surfaces. | closed |
| T-35-03-03 | Repudiation | /pathways drift (new view unmapped) | mitigate | `journeys.ts` contains the `training-matrix-records` journey referencing `/admin/team` and `/profile` — confirmed by direct grep. | closed |
| T-35-03-04 | Information Disclosure | CSV export button forwards filters | mitigate | Confirmed both Export CSV handlers directly invoke `exportTrainingCsv(...)` then `downloadCsv(...)` (not a bare token mention) — read handler bodies directly; no new route introduced. | closed |
| T-35-03-SC | Tampering | package installs | accept | Zero packages installed — confirmed. | closed |
| T-35-04-01 | Information Disclosure | CompetencySection reads peers' data | mitigate | Confirmed `CompetencySection.tsx` imports only `getMyCompetencyStates`, never `getTrainingMatrix`/`getTrainingRecordForPerson` — direct read + green `profile-competency.spec.ts` (6/6). | closed |
| T-35-04-02 | Elevation of Privilege | competency state gates a worker action | mitigate | Confirmed no lock/disabled/gating affordance in `CompetencySection.tsx`; covered by both the active `no-competency-gate.spec.ts` CompetencySection branch and `profile-competency.spec.ts`'s positive contract — both green. | closed |
| T-35-04-SC | Tampering | package installs | accept | Zero packages installed — confirmed. | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

**Verification method:** Every `mitigate` row above was checked by (1) direct read of the cited implementation file at current HEAD (post-review-fix, commits `1a6fccf..1d8eeae`), and (2) running the full automated suite live in this audit session: `npx playwright test --project=phase35 --project=phase35-unit` → **87 passed, 4 skipped, 0 failed**; `npx tsc --noEmit` → clean. The 4 skipped tests are the intentionally-staged live-Supabase RLS probes (T-35-02-02/05 caveat above), not silently-skipped coverage.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|--------------|------|
| AR-35-01 | T-35-01-01 | `classify.ts`/`matrix.ts` are pure, DB-free functions (verified: no `@/lib/supabase` import, no I/O) — they cannot leak on their own. All org/role scoping that prevents cross-worker/cross-org leakage is enforced in 35-02's server actions (see T-35-02-01/02/03), which are independently verified above. | Phase 35 plan author (gsd-security-auditor audit) | 2026-07-24 |
| AR-35-02 | T-35-01-SC, T-35-02-SC, T-35-03-SC, T-35-04-SC | Phase 35 installed zero new npm packages across all 4 plans (confirmed via `git log -- package.json` over the full phase commit range — no diff). No supply-chain legitimacy checkpoint required. | Phase 35 plan author (gsd-security-auditor audit) | 2026-07-24 |

*Accepted risks do not resurface in future audit runs.*

---

## Unregistered Attack Surface (Informational — not a blocker, both since remediated)

The original 4 plans' `<threat_model>` blocks did not anticipate two issues that the phase's own code review (`35-REVIEW.md`) subsequently found and a review-fix pass (`35-REVIEW-FIX.md`, commits `1a6fccf..1d8eeae`) subsequently closed. Neither appeared in any plan's SUMMARY.md `## Threat Flags` section (35-03/35-04 explicitly reported "None"; 35-01/35-02 carried no such section at all) — both were only surfaced by the code-review pass, not by the executor's own threat-flagging. Recorded here so a future phase touching this surface inherits the register entry instead of rediscovering it.

1. **CSV formula injection (CR-01)** — `generateTrainingCsv`'s `csvField()` originally only RFC-4180-quoted commas/quotes/newlines; it did not neutralize leading `=`/`+`/`-`/`@` (classic CSV/DDE formula injection) on an export whose own UAT copy instructs the admin to open it in Excel and hand it to an auditor. `worker_email` (attacker-influenced at signup) and `sop_title`/`sop_number` (author-controlled) both flow into this export unescaped. **Verified fixed** at current HEAD: `csvField()` now prefixes formula-trigger characters with an apostrophe and force-quotes bare `\r`; `csv.test.ts` carries a `=HYPERLINK(...)` neutralization case (confirmed passing in this session's live test run). Recommend formally adding a `T-35-01-04` (Tampering, CSV export) entry to this register for any future phase that extends `csv.ts`.
2. **Cross-org requirement bleed in `getMyCompetencyStates` (WR-06)** — for a multi-org user, `member_departments`/`sop_access_people` self-read RLS branches return rows across ALL the caller's organisations, not just the active one, so a foreign org's SOP requirements could render on `/profile` as phantom "Untitled SOP" rows. This is the worker's own data bleeding across their own org memberships (not another user's data), but it is a tenant-scoping defect adjacent to T-35-04-01's disposition. **Verified fixed** at current HEAD: `getMyCompetencyStates` now intersects `requiredSopIds` against the org-RLS-scoped `sops` read (`scopedSopIds`) before mapping.

Neither finding is an open threat as of this audit — both are confirmed remediated by direct source read and the passing test suite. Flagged as `unregistered_flag` (WARNING, informational) per the adversarial-audit mandate, not `OPEN_THREATS`.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|----------------|--------|------|--------|
| 2026-07-24 | 19 | 19 | 0 | gsd-security-auditor |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-24
