---
phase: 64
slug: leavers-and-suspended-members
status: signed-off
nyquist_compliant: true
wave_0_complete: true
created: 2026-10-21
---

# Phase 64 — Validation Strategy

> Per-phase validation contract. Source: 64-RESEARCH.md "Validation Architecture" (full Req → test map and deployed eval cases live there).

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright (source-contract specs, live-DB probes, deployed evals) |
| **Config file** | `playwright.config.ts` (add project `phase64`; evals under `evals`) |
| **Quick run command** | `npx playwright test --project=phase64 --project=phase59 --project=phase56` |
| **Full suite command** | `npm run build` → `npx tsc --noEmit` → `npm run test` (once); after push `npm run eval -- --phase 64` (once) |
| **Estimated runtime** | quick ~60 s; full ~15 min; eval ~10 min |

## Sampling Rate

- **After every task commit:** `npx playwright test --project=phase64` plus touched phase projects
- **After every plan wave:** `npx tsc --noEmit` + quick command
- **Before verify-work:** build (exit code), full suite once, push, deployed eval once; read every screenshot
- **Max feedback latency:** 60 s

## Per-Task Verification Map

| Requirement | Secure Behavior | Test Type | Automated Command | File Exists |
|-------------|-----------------|-----------|-------------------|-------------|
| MEMB-01 | status column + CHECK + backfill; `status*` not updatable by `authenticated` | source-contract | `npx playwright test tests/phase64/member-status-migration.spec.ts` | ✅ green |
| MEMB-02 | helpers + hook require `status = 'active'`; no raw-claim policy survives; observations own-arm org-scoped; same token reads nothing after suspend | source-contract + lint + eval | `npx playwright test tests/phase64 tests/lint/rls-org-scope.spec.ts`; eval | ✅ green |
| MEMB-03 | `revoke_user_sessions` service_role only; old refresh token rejected | source-contract + eval | as above | ✅ green |
| MEMB-04 | self refused, admin-only-for-admin, last active admin refused, empty update = failure | source-contract | `npx playwright test tests/phase64/member-actions.spec.ts` | ✅ green |
| MEMB-05 | People UI testids, tags, Former staff group | source-contract + eval screenshots | `npx playwright test tests/phase59/people-tab.spec.ts tests/phase64` | ✅ green |
| MEMB-06 | no `.delete(` on `organisation_members` in `src/`; removed symbols absent | lint | `npx playwright test tests/lint/member-status.spec.ts` | ✅ green |
| MEMB-07 | paused page for non-active member | source-contract + eval | as above | ✅ green |
| MEMB-08 | re-invite reactivates `left` row; suspended refused | source-contract + eval | as above | ✅ green |
| MEMB-09 | leaver's SOP flagged; reassign logs `owner_change`; pickers active-only | unit + eval | `npx playwright test tests/phase64/handover.spec.ts` | ✅ green |
| MEMB-10 | three ledger kinds registered and live | edit ledger specs | `npx playwright test tests/phase56 tests/phase59` | ✅ green |
| MEMB-11 | every `organisation_members` read allowlisted or status-filtered | lint | `npx playwright test tests/lint/member-status.spec.ts` | ✅ green |
| MEMB-12 | ADR-0024, matrix, journeys 0 not-mapped, uat entry | edit specs | `npx playwright test tests/phase59/capability-matrix.spec.ts` | ✅ green |
| MEMB-13 | deployed eval cases 1-7 (RESEARCH.md) | deployed eval | `npm run eval -- --phase 64` | ✅ green |

## Wave 0 Requirements

- [x] `tests/phase64/` specs and `phase64` project in `playwright.config.ts`
- [x] `tests/lint/member-status.spec.ts` in a project regex (check `--list`)
- [x] `tests/evals/people.eval.ts`
- [x] Live `pg_policies` re-dump before writing migration 00082
- [x] `EXPLAIN ANALYZE` before/after for the helper change

## Manual-Only Verifications

All phase behaviors have automated verification (deployed eval screenshots are read by Claude, not Simon).

## Validation Sign-Off

- [x] All tasks have automated verify or Wave 0 dependencies
- [x] No 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60 s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** signed off 2026-10-24 (64-06). Evidence: `64-EVAL.md` (full deployed run 122/122 after the sop-ledger eval repoint; people.eval 6/6 on the final deploy), `--assert-only` PASS, build gates held, full suite 2181 passed with only the OTP rate-limit probes red.
