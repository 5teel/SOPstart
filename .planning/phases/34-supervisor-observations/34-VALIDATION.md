---
phase: 34
slug: supervisor-observations
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-20
updated: 2026-07-20
---

# Phase 34 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright (integration + E2E + source-contract specs) |
| **Config file** | `playwright.config.ts` (new `phase34` project) |
| **Quick run command** | `npx playwright test --project=phase34` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~120 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx playwright test --project=phase34`
- **After every plan wave:** Run `npm run test`
- **Before `/gsd-verify-work`:** Full suite green + a real `npm run build`
- **Max feedback latency:** 180 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-1 | 34-01 | 1 | OBS-01/02/03 | T-34-01-01 | phase34 project discovers all 5 specs | source-contract | `npx playwright test --list --project=phase34` | ❌ Wave 0 | ⬜ pending |
| 01-2 | 34-01 | 1 | OBS-01/02/03 + SC-4 | T-34-01-02 | 5 stubs green-when-absent, name live-flip plan | source-contract | `npx playwright test --project=phase34` | ❌ Wave 0 | ⬜ pending |
| 02-1 | 34-02 | 1 | OBS-01/02 | T-34-02-01/02/03 | append-only + org-scope + worker self-read RLS; no update/delete | source-contract (migration grep) | `grep` no `for update`/`for delete` on sop_observations | ❌ Wave 0 | ⬜ pending |
| 02-2 | 34-02 | 1 | OBS-01 | T-34-02-04 | verdict Zod enum mirrors DB check | source-contract (tsc) | `npx tsc --noEmit` | ❌ Wave 0 | ⬜ pending |
| 03-1 | 34-03 | 2 | OBS-01/02 | T-34-03-04 | migration live + PGRST cache reloaded | runtime (blocking push) | `npx supabase migration list` | ✅ (01) | ⬜ pending |
| 03-2 | 34-03 | 2 | SC-4 + OBS-01 | T-34-03-01/02/03 | cross-org write/read denied; UPDATE/DELETE denied | runtime (two ephemeral orgs) | `npx playwright test --project=phase34 tests/phase34/observation-cross-org-isolation.spec.ts tests/phase34/observation-immutability.spec.ts` | ✅ (01) | ⬜ pending |
| 04-1 | 34-04 | 3 | OBS-01 | T-34-04-01/05 | role gate + session-client insert (no admin client) | source-contract + runtime | `npx playwright test --project=phase34 tests/phase34/record-observation.spec.ts` | ✅ (01) | ⬜ pending |
| 04-2 | 34-04 | 3 | OBS-03 | T-34-04-02 | server-resolved sop_version stamp | runtime | `npx playwright test --project=phase34 tests/phase34/sop-version-stamp.spec.ts` | ✅ (01) | ⬜ pending |
| 05-1 | 34-05 | 4 | OBS-01 | T-34-05-01/02 | escaped note render; declared tokens only | source-contract (grep) | `grep -- "--brand-yellow" src/components/observations/` (0 hits) | ❌ (05) | ⬜ pending |
| 05-2 | 34-05 | 4 | OBS-01 | T-34-05-03 | modal wires recordObservation + permanent-record framing | source-contract (tsc) | `npx tsc --noEmit` | ❌ (05) | ⬜ pending |
| 06-1 | 34-06 | 5 | OBS-01 | T-34-06-01 | person panel org-scoped history + record CTA | source-contract (tsc) | `npx tsc --noEmit` | ❌ (06) | ⬜ pending |
| 06-2 | 34-06 | 5 | OBS-01 | T-34-06-03 | named-chip click only (vacancy inert) | source-contract | `npx playwright test --project=phase34` | ❌ (06) | ⬜ pending |
| 06-3 | 34-06 | 5 | OBS-01 (D-02) | T-34-06-02 | label rename self-enforces org scope | source-contract (grep) | `grep setObservationLabels ObservationLabelsCard.tsx` | ❌ (06) | ⬜ pending |
| 07-1 | 34-07 | 5 | OBS-01 | T-34-07-01 | row action stopPropagation (no nav) | source-contract (grep) | `grep stopPropagation CompletionSummaryCard.tsx` | ❌ (07) | ⬜ pending |
| 07-2 | 34-07 | 5 | OBS-01 (D-11) | T-34-07-02 | header button + modal host; completion link prefilled | source-contract (grep) | `grep RecordObservationModal SupervisorActivityView.tsx` | ❌ (07) | ⬜ pending |
| 08-1 | 34-08 | 5 | OBS-02 | T-34-08-01/03 | worker self-read section + trust banner + no edit/delete | runtime | `npx playwright test --project=phase34 tests/phase34/worker-observation-visibility.spec.ts` | ✅ (01) | ⬜ pending |
| 08-2 | 34-08 | 5 | OBS-02/03 | T-34-08-04 | journeys + uat updated on real routes | source-contract (grep) | `grep -i observation src/lib/journeys/journeys.ts src/lib/uat/tests.ts` | ✅ (existing) | ⬜ pending |
| 09-1 | 34-09 | 6 | OBS-01/02/03 | T-34-09-01 | merged tree: suite + tsc + next build | runtime (build) | `npm run build` | ✅ (existing) | ⬜ pending |
| 09-2 | 34-09 | 6 | OBS-01/02/03 + SC-4 | T-34-09-03 | per-requirement audit + pathways coverage | source-contract | `grep -E "OBS-0" 34-09-SUMMARY.md` | ❌ (09) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `playwright.config.ts` — add `phase34` project (`testDir: '.'`, `testMatch: /tests\/phase34\/.*\.(spec|test)\.ts$/`, chromium). Verify with `npx playwright test --list --project=phase34` (zero discovered = FAIL, CLAUDE.md 2026-05-25).
- [ ] `tests/phase34/record-observation.spec.ts` — OBS-01 role gate + session-client insert (live in 34-04)
- [ ] `tests/phase34/observation-immutability.spec.ts` — OBS-01 append-only, no update/delete policy (live in 34-03)
- [ ] `tests/phase34/worker-observation-visibility.spec.ts` — OBS-02 worker self-read (live in 34-08)
- [ ] `tests/phase34/sop-version-stamp.spec.ts` — OBS-03 / D-10 version auto-stamp (live in 34-04)
- [ ] `tests/phase34/observation-cross-org-isolation.spec.ts` — **success criterion 4** cross-org write/read isolation, two ephemeral orgs (live in 34-03) — MANDATORY, the recurring service-role write-hole class

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Cross-org isolation + worker self-read runtime | SC-4 / OBS-02 | Requires two live authenticated Supabase sessions; no staging project — Railway-only-testing convention. Carried as `test.fixme` with full body + source-contract backstop if unreachable in CI (Phase 27 precedent). | Two ephemeral throwaway orgs + magic-link cookie sessions (CLAUDE.md 2026-04-24); attempt cross-org insert/read → expect RLS denial/empty; worker reads own → sees own rows. |
| Desktop recording feel (person panel + modal) | OBS-01 | Visual/interaction quality on desktop-first surface | On sopstart.com: open a worker in /admin/team, Record observation, pick SOP, choose verdict, Save; confirm it appears in history and on the worker's /profile. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (5 specs + SC-4)
- [x] No watch-mode flags
- [x] Feedback latency < 180s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ready for execution
