---
phase: 15
slug: manufacturing-line-mode
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-12
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Source: `15-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright 1.58 (existing project devDep) |
| **Config file** | `playwright.config.ts` |
| **Quick run command** | `npm run lint && npx playwright test tests/integration/desktop-walkthrough-layout.spec.ts -x` |
| **Full suite command** | `npm run test:integration` |
| **Estimated runtime** | ~90 seconds (quick), ~6 minutes (full integration) |
| **Local UAT requirement** | `next build && next start` (NOT `next dev` — Windows file-lock race per CLAUDE.md learning 2026-05-08) |

---

## Sampling Rate

- **After every task commit:** Run `npm run lint && npx playwright test {plan-relevant.spec.ts} -x`
- **After every plan wave merge to master:** Run `npm run test:integration`
- **Before `/gsd-verify-work`:** Full suite green + bundle-size CI green + manual Visy SOP UAT complete
- **Max feedback latency:** 90 seconds (quick), 6 minutes (full integration)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 15-Wave0-01 | 00 | 0 | SB-LINE-06 baseline | — | First-Load-JS baseline captured before any Phase 15 work | CI script | `node scripts/capture-bundle-baseline.ts` | ❌ Wave 0 | ⬜ pending |
| 15-Wave0-02 | 00 | 0 | All | — | Test fixture stubs exist | scaffold | `find tests/integration -name '*.spec.ts' -newer ./HEAD~1` | ❌ Wave 0 | ⬜ pending |
| 15-01-01 | 01 | 1 | SB-LINE-05 | T-15-03 sub-trade-bypass | Sub-trade junction tables + RLS | unit/integration | `npx playwright test tests/integration/sub-trade-rls-backward-compat.spec.ts -x` | ❌ Wave 0 | ⬜ pending |
| 15-01-02 | 01 | 1 | SB-LINE-01, SB-LINE-02 | — | `useViewport` hook returns mobile on SSR, swaps to desktop ≥1024px on mount | unit | `npx vitest run src/hooks/__tests__/useViewport.test.ts` (Wave 0 adds vitest) OR Playwright `tests/integration/desktop-walkthrough-layout.spec.ts` | ❌ Wave 0 | ⬜ pending |
| 15-02-01 | 02 | 2 | SB-LINE-01 | — | DesktopWalkthrough renders body text ≥24px at 1920×1080 | integration | `npx playwright test tests/integration/desktop-walkthrough-layout.spec.ts -x` | ❌ Wave 0 | ⬜ pending |
| 15-02-02 | 02 | 2 | SB-LINE-01 | — | MobileWalkthrough byte-identical to Phase 12.5 at 390×844 | visual regression | same file, separate test | ❌ Wave 0 | ⬜ pending |
| 15-02-03 | 02 | 2 | SB-LINE-02 | T-15-07 forged-ack | Sequential "I've done this — Next" gate; forward-jump deep-link redirects to highest acked | integration | `npx playwright test tests/integration/sequential-ack.spec.ts -x` | ❌ Wave 0 | ⬜ pending |
| 15-03-01 | 03 | 3 | SB-LINE-03 | T-15-04 cost-runaway | `/api/voice/query` route validates input (Zod), enforces concurrency cap, calls answer + verifier | integration | `npx playwright test tests/integration/voice-qa-happy-path.spec.ts -x` (mocks Anthropic) | ❌ Wave 0 | ⬜ pending |
| 15-03-02 | 03 | 3 | SB-LINE-04 | T-15-01 prompt-injection, T-15-02 cross-SOP leak | `verify-sop.ts` extended with `mode: 'voice_qa'`; ungrounded claims flagged | integration | `tests/integration/voice-grounding-scope.spec.ts` (2-SOP fixture) | ❌ Wave 0 | ⬜ pending |
| 15-03-03 | 03 | 3 | SB-LINE-03 | — | Prompt caching active: 2nd call shows `cache_read_input_tokens > 0` | unit | `npx vitest run src/lib/voice/__tests__/voice-qa-cache.test.ts` (mocked SDK) | ❌ Wave 0 | ⬜ pending |
| 15-04-01 | 04 | 4 | SB-LINE-05 | T-15-03 sub-trade-bypass | Admin assigns tags via UI; persisted to `users_sub_trades`; worker visibility gated by RLS | e2e | `npx playwright test tests/e2e/sub-trade-assignment.spec.ts -x` | ❌ Wave 0 | ⬜ pending |
| 15-04-02 | 04 | 4 | SB-LINE-06 | — | `next build` First Load JS for `/sops/[sopId]` within +2 KB of baseline | CI script | `node scripts/check-bundle-size.ts` | ❌ Wave 0 | ⬜ pending |
| 15-04-03 | 04 | 4 | SB-LINE-06 | — | `DesktopWalkthrough` and `WalkthroughVoiceModal` appear as separate dynamic chunks in `.next/build-manifest.json` | CI script | same script, separate assertion | ❌ Wave 0 | ⬜ pending |
| 15-04-04 | 04 | 4 | Visy demo | — | ENF4-03-031 loaded in staging; voice "what PPE do I need" returns answer citing Hazards section | manual UAT | Playwright-scripted human walkthrough (cookie-auth pattern from CLAUDE.md 2026-04-24) | ❌ Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/integration/desktop-walkthrough-layout.spec.ts` — SB-LINE-01 (desktop variant rendering + mobile non-regression)
- [ ] `tests/integration/sequential-ack.spec.ts` — SB-LINE-02 (gate + forward-jump redirect)
- [ ] `tests/integration/voice-qa-happy-path.spec.ts` — SB-LINE-03 + voice modal a11y
- [ ] `tests/integration/voice-grounding-scope.spec.ts` — SB-LINE-04 (2-SOP fixture required)
- [ ] `tests/integration/sub-trade-rls-backward-compat.spec.ts` — SB-LINE-05 (empty `sops_sub_trades` = visible to all)
- [ ] `tests/e2e/sub-trade-assignment.spec.ts` — SB-LINE-05 admin flow + worker visibility
- [ ] `scripts/check-bundle-size.ts` — SB-LINE-06 (parses `.next/build-manifest.json`)
- [ ] `scripts/capture-bundle-baseline.ts` — captures pre-Phase-15 First Load JS for `/sops/[sopId]` to `.bundle-baseline.json`
- [ ] `tests/fixtures/anthropic-voice-mock.ts` — canned answer + verifier responses (parallel to Phase 14 `anthropic-mock.ts`)
- [ ] `tests/fixtures/visy-enf4-03-031.sql` — seed fixture for the Visy demo SOP (or load via real Supabase admin path during pre-UAT prep)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real Visy SOP demo to Bryce | All (SB-LINE-01..06 + Visy demo readiness) | Empirical proof of voice grounding on a real safety-critical SOP — automated tests use canned Anthropic responses, real Anthropic must be exercised once before phase passes | (1) Import `ENF4-03-031 Blank Side Hanger` into staging via existing upload flow; (2) Open on Windows desktop at 1920×1080 (or browser at that viewport size); (3) Verify DesktopWalkthrough renders with ≥24px body text; (4) Tap mic, ask "What PPE do I need for this procedure"; (5) Verify answer mentions heat-resistant gloves AND cites a Hazards section; (6) Tap mic, ask adversarial "Can I use leather gloves instead?"; (7) Verify answer responds "I'm not certain" or similar grounded uncertainty (NOT a confident yes/no); (8) Document outcomes in `15-VERIFICATION.md` UAT section |
| Voice modal a11y validation | SB-LINE-03 | Screen reader behaviour requires real AT testing | (1) Enable Windows Narrator or NVDA; (2) Tab to mic button; (3) Verify announce "Microphone, button"; (4) Activate; (5) Verify focus moves to modal + announce "Voice question, dialog"; (6) Verify live transcription is announced as it appears; (7) Press ESC; (8) Verify modal closes, focus returns to mic button |

---

## Validation Sign-Off

- [ ] All tasks have `<verify>` `<automated>` blocks OR Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (10 files listed above)
- [ ] No watch-mode flags in test commands (`-x` exit-after-test is required)
- [ ] Feedback latency < 90s for per-task, < 6min for per-wave
- [ ] `nyquist_compliant: true` set in frontmatter once Wave 0 is green

**Approval:** pending
