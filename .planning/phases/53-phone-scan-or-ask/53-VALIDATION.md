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
| **Framework** | Playwright (`@playwright/test`) — source-contract + live specs under `tests/phase53/`, pure unit tests wherever the planner registers them (a `phase53-unit` project mirroring `phase27-unit` if static `@/` imports are needed), deployed evals under `tests/evals/` |
| **Config file** | `playwright.config.ts` |
| **Quick run command** | `npx playwright test --project=phase53 && npx tsc --noEmit` |
| **Full suite command** | `npm run test && npm run build` (full suite ONCE per gate — OTP budget, CLAUDE.md 2026-09-28) |
| **Estimated runtime** | ~25 s quick · ~4 min full |

---

## Sampling Rate

- **After every task commit:** `npx playwright test --project=phase53 && npx tsc --noEmit`
- **After every plan wave:** `npm run build` (bundle gate) + non-live projects; full suite once at the phase gate
- **Before `/gsd-verify-work`:** full suite once + `npm run eval -- --phase 53` at 390×844, screenshots read by the orchestrator
- **Max feedback latency:** 30 s

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 53-W0 | 01 | 0 | all | — | — | project registration | `npx playwright test --list --project=phase53` | ❌ W0 | ⬜ pending |
| 53-01-01 | 01 | 1 | PHN-03 | T-53-02 | `isOurPlateUrl` accepts only our origin + `/m/<6-char code>`; `extractMachineCode` never returns a path or query | unit | `npx playwright test --project=phase53 tests/phase53/qr-decode.test.ts` | ❌ W0 | ⬜ pending |
| 53-01-02 | 01 | 1 | PHN-02 | T-53-03 | login redirect carries `?next=` only for same-origin relative paths (open-redirect safe) and `/login` honours it | live integration | `npx playwright test --project=phase53 tests/phase53/login-next-redirect.spec.ts` | ❌ W0 | ⬜ pending |
| 53-01-03 | 01 | 1 | PHN-03 | T-53-04 | scan sheet + decoder marker group on both gated routes; `.bundle-baseline.json` unchanged | build gate | `npm run build && git diff --quiet 736f44a HEAD -- .bundle-baseline.json` | ✅ (edit) | ⬜ pending |
| 53-02-01 | 02 | 2 | PHN-02 | T-53-01 | `/m/[code]` looks up by code AND `.eq('organisation_id', session org)`; foreign or absent → `notFound()` | live probe (once) + source-contract | `npx playwright test --project=phase53 tests/phase53/m-code-org-scope.spec.ts` | ❌ W0 | ⬜ pending |
| 53-02-02 | 02 | 2 | PHN-02 | — | `/m/[code]` rows to-do first via the ONE classifier; Walk href `/sops/<id>?tab=walk` | source-contract (wiring) | `npx playwright test --project=phase53 tests/phase53/m-code-page.spec.ts` | ❌ W0 | ⬜ pending |
| 53-02-03 | 02 | 2 | PHN-02 | T-53-01 | plate page admin-gated (`requireAdminContext`), QR = absolute `/m/<code>` URL from a non-hardcoded origin, `@page { size: A6 }`, code printed large | source-contract | `npx playwright test --project=phase53 tests/phase53/plate-page.spec.ts` | ❌ W0 | ⬜ pending |
| 53-03-01 | 03 | 2 | PHN-01 | — | phone home renders ask bar · Now card (no Show me) · thumbnail · Scan, below 1024 for non-admin with a site; `NowCard.onShowMe` optional | source-contract (wiring) | `npx playwright test --project=phase53 tests/phase53/phone-home.spec.ts` | ❌ W0 | ⬜ pending |
| 53-03-02 | 03 | 2 | PHN-01 | — | thumbnail → department-grouped machine sheet; row → `/m/<code>`; org with no site keeps today's list | source-contract (wiring + negative) | `npx playwright test --project=phase53 tests/phase53/machine-list-sheet.spec.ts tests/phase53/phone-home-fallback.spec.ts` | ❌ W0 | ⬜ pending |
| 53-04-01 | 04 | 3 | PHN-03 | T-53-02/04 | scan sheet: `getUserMedia` env camera, `BarcodeDetector` → `jsqr` fallback, our-origin check, `router.push` on match, tracks stopped on close, dynamic import only | source-contract (wiring) | `npx playwright test --project=phase53 tests/phase53/scan-sheet.spec.ts` | ❌ W0 | ⬜ pending |
| 53-04-02 | 04 | 3 | PHN-03 | — | denied camera → code-entry field; "Type it instead" always present | source-contract + eval | `npx playwright test --project=phase53 tests/phase53/scan-sheet.spec.ts` + eval | ❌ W0 | ⬜ pending |
| 53-05-01 | 05 | 4 | PHN-01..03 | — | deployed eval at 390×844 (eval-site worker: home, sheet, `/m/<code>`, scan fallback → route; eval-site admin: plate page; real-org worker: today's list) | deployed eval | `npm run eval -- --phase 53` | ❌ W0 (`tests/evals/phone-home.eval.ts`) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `playwright.config.ts` — `phase53` project (`testMatch: /tests\/phase53\/.*\.(spec|test)\.ts$/`), verified with `--list`; a `phase53-unit` project only if static `@/` imports are needed
- [ ] `tests/phase53/` stubs for every spec above
- [ ] `src/lib/site/qr-decode.ts` — pure `isOurPlateUrl` / `extractMachineCode` (test-first)
- [ ] `scripts/check-bundle-size.ts` — scan-sheet/decoder marker group on both gated routes
- [ ] `tests/evals/phone-home.eval.ts` skeleton (390×844; a fresh context WITHOUT `grantPermissions(['camera'])` so `getUserMedia` rejects and the fallback path is exercised)
- [ ] `jsqr` added as a dependency (Apache-2.0, zero deps, no postinstall — slopcheck passed); loaded only inside the scan sheet's dynamic chunk

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real camera decode on a phone | PHN-03 | Headless Chromium has no camera; the eval exercises the denied-camera fallback only | On an Android phone and an iPhone: open sopstart.com → Scan a machine plate → point at a printed EVAL Press plate → lands on `/m/<code>`. Orchestrator cannot run this; note in 53-EVAL.md as "not exercised — manual". |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
