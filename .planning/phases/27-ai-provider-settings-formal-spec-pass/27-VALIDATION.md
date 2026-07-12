---
phase: 27
slug: ai-provider-settings-formal-spec-pass
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-12
---

# Phase 27 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright Test (`@playwright/test`) — used for both true e2e AND pure-function unit tests via `testDir`-scoped projects |
| **Config file** | `playwright.config.ts` |
| **Quick run command** | `npx playwright test --project=phase27-unit --project=phase27-stubs` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~15 seconds (unit) |

---

## Sampling Rate

- **After every task commit:** Run `npx playwright test --project=phase27-unit --project=phase27-stubs`
- **After every plan wave:** Run `npm run test` (full suite) + `npx tsc --noEmit` + `npm run build` (per the 2026-06-02/2026-06-27 CLAUDE.md learnings — `next build` typecheck scope differs from bare `tsc`)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 27-01-01 | 01 | 1 | AIPS-REG-01/AIPS-GAP-03 | — | `aiModel()` default + env override resolution | unit | `npx playwright test src/lib/ai/__tests__/registry.test.ts --project=phase27-unit` | ❌ W0 | ⬜ pending |
| 27-01-02 | 01 | 1 | AIPS-REG-02/AIPS-GAP-03 | — | `providerForModel()` shape rules + `extractJson()` fallback chain | unit | `npx playwright test src/lib/ai/__tests__/llm-routing.test.ts --project=phase27-unit` | ❌ W0 | ⬜ pending |
| 27-01-03 | 01 | 1 | AIPS-TITLE-01/AIPS-GAP-03 | — | title-guard fallback chain | unit | `npx playwright test src/lib/parsers/__tests__/sop-title.test.ts --project=phase20-parsers` | ❌ W0 | ⬜ pending |
| 27-01-04 | 01 | 1 | AIPS-SET-02/AIPS-GAP-02 | T-27-01 | `setAiModelSetting` cannot write across org boundary | integration (live Supabase) | `npx playwright test tests/phase27/ai-settings-org-scope.spec.ts --project=phase27-stubs` | ❌ W0 | ⬜ pending |
| 27-01-05 | 01 | 1 | AIPS-GAP-01 | — | `.env.local.example` documents `OPENROUTER_API_KEY` | source-contract | `grep OPENROUTER_API_KEY .env.local.example` | N/A — trivial edit | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/ai/__tests__/registry.test.ts` — stubs for AIPS-REG-01, AIPS-GAP-03
- [ ] `src/lib/ai/__tests__/llm-routing.test.ts` — stubs for AIPS-REG-02, AIPS-GAP-03
- [ ] `src/lib/parsers/__tests__/sop-title.test.ts` — stubs for AIPS-TITLE-01, AIPS-GAP-03
- [ ] `tests/phase27/ai-settings-org-scope.spec.ts` — stubs for AIPS-SET-02, AIPS-GAP-02
- [ ] `playwright.config.ts` — add `phase27-unit` (testDir `./src/lib/ai/__tests__`) and `phase27-stubs` (testDir `.`, testMatch `tests/phase27/**`) project entries

---

## Manual-Only Verifications

*None — all phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
