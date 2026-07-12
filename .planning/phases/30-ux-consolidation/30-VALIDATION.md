---
phase: 30
slug: ux-consolidation
status: ready
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-12
---

# Phase 30 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright 1.x (source-contract + unit projects, phase-scoped) |
| **Config file** | `playwright.config.ts` (add `phase30` project with broad `tests/phase30/**` testMatch — single registration per CLAUDE.md 2026-05-25) |
| **Quick run command** | `npx playwright test --project=phase30` |
| **Full suite command** | `npx playwright test --project=phase30 --project=phase29 --project=phase29-unit --project=phase28 --project=phase28-unit` + `npx tsc --noEmit` + `npm run build` |
| **Estimated runtime** | quick ~30s · full ~5-8 min (build dominates) |

---

## Sampling Rate

- **After every task commit:** Run `npx playwright test --project=phase30` + `npx tsc --noEmit`
- **After every plan wave:** Run full suite command (incl. phase28/29 regression — source-contract specs read files this phase moves/deletes)
- **Before `/gsd-verify-work`:** Full suite green + `npm run build` clean + bundle gate + /pathways 0 not-mapped
- **Max feedback latency:** ~120 seconds (quick loop)

---

## Per-Task Verification Map

Filled by the planner per task. Validation families for this phase:

| Requirement | Validation approach | Automated command |
|-------------|--------------------|--------------------|
| UX-01 role homes | Source-contract: middleware/auth land each role on its home; grep sweep `redirect('/dashboard')` count == shim-only | `npx playwright test --project=phase30 -g "role home"` |
| UX-02 AdminNav | Source-contract: one AdminNav component; every admin page imports it; zero inline sub-nav blocks remain | phase30 spec |
| UX-03 governance fold | Source-contract: /admin/sops hosts flag chips + queue rows; GovernanceWidget/LibraryReviewCell deleted; approveStep wiring preserved verbatim (phase29 queue-approve-action.spec.ts repointed and green) | phase30 + repointed phase29 specs |
| UX-04 single create entry | Source-contract: one New SOP entry; grep sweep proves old buttons/tiles gone | phase30 spec |
| UX-05 3-tab worker view | Source-contract: SopTabNav has exactly 3 tabs; legacy ?tab= params mapped; isPpeSection exists once; bundle gate Δ ≤ +2 KB | phase30 spec + `npx tsx scripts/check-bundle-size.ts` |
| UX-06 one-line rows | Source-contract: row renders title/status/flag/owner only; builder shell exposes labelled action menu | phase30 spec |
| UX-07 plain language | Source-contract: stage labels Check/Edit/Send to workers; plain flag titles in ai-reviewer types; no "block N" in flag UI strings | phase30 spec |
| UX-08 dead-weight sweep | Grep sweeps: deleted files absent; zero hrefs to removed routes (dead-link rule 2026-06-08); ModelTab gone from SopTabNav | phase30 spec |
| journeys.ts coverage | `/pathways` all-screens 0 not-mapped (grep journeys.ts for every changed route) | phase30 spec |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `playwright.config.ts` — register `phase30` project (`tests/phase30/**`)
- [ ] Baseline the 2 pre-existing failures in `tests/integration/scp-source-viewer.test.ts` (stale Phase-21 assertions, already failing on master per RESEARCH) — fix or fixme BEFORE any Phase 30 change so verification doesn't misattribute
- [ ] Capture current bundle baseline reference (`.bundle-baseline.json` at 1057 KB) for post-merge comparison

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| QR deep-link lands on new Read/Walk tabs on a phone | UX-05 | Physical scan + Railway-only testing convention | Scan an existing printed QR after deploy; confirm detail page renders, old ?tab=tools URL maps to Read |
| Role-home landing feel per role | UX-01 | Requires 4 real role sessions on sopstart.com | Log in as worker/supervisor/safety_manager/admin post-deploy; confirm landing pages |
| Approve-from-queue click path | UX-03/APR-03 | Live approval data needed | Existing pending-approval SOP: Approve from the folded queue view |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (30-01: phase30 project, 8 spec stubs, scp baseline, bundle baseline)
- [x] No watch-mode flags
- [x] Feedback latency < 120s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-13 (plan-checker pass + orchestrator fix of blocker/W1/W3)
