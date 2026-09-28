---
phase: 53
slug: phone-scan-or-ask
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-29
---

# Phase 53 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright (`@playwright/test`) — source-contract, unit (static `@/` imports) and one live-Supabase probe under `tests/phase53/` (one `phase53` project; no separate unit project needed — static imports resolve there, as in `phase52`), deployed evals under `tests/evals/` |
| **Config file** | `playwright.config.ts` |
| **Quick run command** | `npx playwright test --project=phase53 && npx tsc --noEmit` |
| **Full suite command** | `npm run test && npm run build` (full suite ONCE per gate — OTP budget, CLAUDE.md 2026-09-28) |
| **Estimated runtime** | ~25 s quick · ~4 min full |

---

## Sampling Rate

- **After every task commit:** the task's own `<verify>` command (phase53 spec(s) + `npx tsc --noEmit`)
- **After every plan wave:** `npm run build` (bundle gate) + the non-live projects the wave touched; full suite once at the phase gate (53-06)
- **Before `/gsd-verify-work`:** full suite once + `npm run eval -- --phase 53` at 390×844, screenshots read by the orchestrator
- **Max feedback latency:** 30 s

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 53-01-01 | 01 | 1 | all | T-53-SC | `phase53` project registered; `jsqr@1.4.0` exact-pinned after a registry check; eval skeleton self-skips | project registration | `npx playwright test --list --project=phase53` | ❌ W0 | ⬜ pending |
| 53-01-02 | 01 | 1 | PHN-02, PHN-03 | T-53-02, T-53-03 | `extractMachineCode` accepts only our origin + `/m/<6-char code>` and never returns a path/query; `safeNextPath` accepts only same-origin relative paths (no `//`, backslash, control chars, `/login*`, `/api/*`) | unit (TDD) | `npx playwright test --project=phase53 tests/phase53/qr-decode.spec.ts tests/phase53/login-next-redirect.spec.ts` | ❌ W0 | ⬜ pending |
| 53-01-03 | 01 | 1 | PHN-02 | T-53-03 | middleware sets `?next=`, `/login` passes it through, `loginWithEmail` re-validates before redirecting; signed-in `/login?next=` bounces to the path | source-contract (+ live round trip in 53-06 eval) | `npx playwright test --project=phase53 tests/phase53/login-next-redirect.spec.ts && npx playwright test tests/phase30/role-homes.spec.ts` | ❌ W0 | ⬜ pending |
| 53-02-01 | 02 | 1 | PHN-01, PHN-02 | T-53-06 | worker list derivation lives only in `useWorkerSops`; `worker_id` self-scope kept | source-contract | `npx tsc --noEmit` (then 53-02-02) | ✅ (refactor) | ⬜ pending |
| 53-02-02 | 02 | 1 | PHN-01, PHN-02 | T-53-07, T-53-08 | page-reading guards repointed; one completion-clock query in `src/`; build gate green, baseline unchanged | source-contract + build gate | `npx playwright test tests/phase41/ tests/phase52/ tests/phase36/worker-library-chip.spec.ts tests/phase36/no-refresher-gate.spec.ts tests/phase37/no-competency-gate-worker.spec.ts && npm run build && git diff --quiet 736f44a HEAD -- .bundle-baseline.json` | ✅ (edit) | ⬜ pending |
| 53-03-01 | 03 | 2 | PHN-02 | T-53-01 | `/m/[code]` validates the code, filters every read by the session org, `notFound()` for malformed/unknown/foreign; badges via `useWorkerSops` → `plantRelState`; Walk href `/sops/<id>?tab=walk` | source-contract (wiring) | `npx playwright test --project=phase53 tests/phase53/m-code-page.spec.ts` | ❌ W0 | ⬜ pending |
| 53-03-02 | 03 | 2 | PHN-02 | T-53-01 | a foreign-org worker's lookup by code returns nothing, with and without the org filter | live probe (run once) | `npx playwright test --project=phase53 tests/phase53/m-code-org-scope.spec.ts` | ❌ W0 | ⬜ pending |
| 53-03-03 | 03 | 2 | PHN-02 | T-53-05 | plate page: `requireAdminContext()` first, session-org lookup, QR = absolute `/m/<code>` from env/request origin (no hardcoded host), `@page { size: A6 }`, code printed large; Print plate in `SiteWorkspace` | source-contract | `npx playwright test --project=phase53 tests/phase53/plate-page.spec.ts` | ❌ W0 | ⬜ pending |
| 53-04-01 | 04 | 2 | PHN-01 | T-53-12 | `NowCard.onShowMe` optional (Read link when absent), `inline` placement; `code` on `WorkerSiteMachine` | source-contract | `npx playwright test --project=phase53 tests/phase53/phone-home.spec.ts -g "NowCard\|code"` | ❌ W0 | ⬜ pending |
| 53-04-02 | 04 | 2 | PHN-01 | — | phone home: ask bar · Now card (no Show me) · 150 px floor picture → department-grouped machine sheet → `/m/<code>`; no scene renderer | source-contract (wiring) | `npx playwright test --project=phase53 tests/phase53/machine-list-sheet.spec.ts tests/phase53/phone-home.spec.ts` | ❌ W0 | ⬜ pending |
| 53-04-03 | 04 | 2 | PHN-01 | T-53-13, T-53-14 | `/sops` seam: shared site query, `phoneSite` below 1024 (admins included), PhoneHome only via `next/dynamic`, today's list kept under it; no-site org unchanged; phone-home marker group; build gate | source-contract (wiring + negative) + build gate | `npx playwright test --project=phase53 tests/phase53/phone-home-fallback.spec.ts && npm run build` | ❌ W0 | ⬜ pending |
| 53-05-01 | 05 | 3 | PHN-03 | T-53-02, T-53-04 | scan sheet: back camera, `BarcodeDetector` → dynamic `jsqr`, `extractMachineCode(…, window.location.origin)` before the single `router.push`, tracks stopped on every exit, typed-code fallback, no frame leaves the device | source-contract (wiring) | `npx playwright test --project=phase53 tests/phase53/scan-sheet.spec.ts -g "ScanSheet"` | ❌ W0 | ⬜ pending |
| 53-05-02 | 05 | 3 | PHN-01, PHN-03 | T-53-17 | Scan button opens the lazily loaded sheet; "Type it instead" always present; scan marker group on both gated routes; journeys phone flow; build gate | source-contract + build gate | `npx playwright test --project=phase53 --grep-invert "m-code-org-scope" && npm run build` | ❌ W0 | ⬜ pending |
| 53-06-01 | 06 | 4 | PHN-01..03 | T-53-18 | deployed eval authored (shared upsert-only fixture helper) | eval listing | `npx playwright test --list --project=evals tests/evals/phone-home.eval.ts` | ❌ W0 (skeleton from 53-01) | ⬜ pending |
| 53-06-02 | 06 | 4 | PHN-01..03 | T-53-01, T-53-03 | deployed eval at 390×844: eval-site worker home → machine sheet → `/m/<code>` → Walk it; scan fallback → typed code → `/m/<code>` without reload; logged-out → `/login?next=` → machine; real-org worker 404; eval-site admin plate at A6 + print; real-org worker keeps today's list | deployed eval | `npm run eval -- --phase 53` | ❌ W0 | ⬜ pending |
| 53-06-03 | 06 | 4 | all | — | validation signed off | doc check | see 53-06 Task 3 verify | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `playwright.config.ts` — `phase53` project (`testMatch: /tests\/phase53\/.*\.(spec|test)\.ts$/`), verified with `--list` (53-01)
- [ ] `tests/phase53/` stubs for every spec above (53-01)
- [ ] `src/lib/site/qr-decode.ts` + `src/lib/auth/next-redirect.ts` — test-first (53-01)
- [ ] `tests/evals/phone-home.eval.ts` skeleton (390×844; a fresh context never granted camera permission, so `getUserMedia` rejects and the fallback path is exercised) (53-01)
- [ ] `jsqr` added as an exact-pinned dependency (Apache-2.0, zero deps, no install scripts — registry re-checked before install); loaded only inside the scan sheet's dynamic chunk (53-01, used in 53-05)
- [ ] Bundle marker groups land with the modules they guard — phone home in 53-04, scan sheet in 53-05 (the gate's self-validation fails on a marker absent from the whole build, so they cannot be added before the components exist)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real camera decode on a phone | PHN-03 | Headless Chromium has no camera; the eval exercises the denied-camera fallback only | On an Android phone and an iPhone: open sopstart.com → Scan a machine plate → point at a printed EVAL Press plate → lands on `/m/<code>`. Orchestrator cannot run this; noted in 53-EVAL.md as "not exercised — manual". |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] Nyquist frontmatter flag set to true at sign-off (53-06)

**Approval:** pending
