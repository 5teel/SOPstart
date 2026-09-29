---
phase: 43
slug: dead-surface-removal-route-truth
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-30
---

# Phase 43 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright 1.x (`@playwright/test`), per-phase `project` blocks in `playwright.config.ts` |
| **Config file** | `playwright.config.ts` |
| **Quick run command** | `npx playwright test --project=phase15-stubs -g "no-dead-internal-hrefs"` / `npx playwright test --project=phase43` once registered |
| **Full suite command** | `npm run test` (run ONCE per gate — live probes share one Supabase OTP budget) |
| **Estimated runtime** | ~60 s for a phase project; full suite several minutes |

Deployed eval: `npm run eval -- --phase 43` after push (waits for Railway to serve HEAD). Read the screenshots.

---

## Sampling Rate

- **After every task commit:** Run the lint/source-contract spec for the file just touched
- **After every plan wave:** Run `npx playwright test --project=phase43` plus the lint project; `npm run build` after any wave that adds a client import or a route (bundle gate ripple)
- **Before `/gsd-verify-work`:** Full suite green once, then `npm run eval -- --phase 43`
- **Max feedback latency:** ~60 s

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 43-W0 | 01 | 0 | DED-01 | — | N/A | lint (source-contract, mutation-proven) | `npx playwright test --project=phase15-stubs -g "no-dead-internal-hrefs"` | ❌ W0 `tests/lint/no-dead-internal-hrefs.spec.ts` | ⬜ pending |
| 43-blocks-new | TBD | 1 | DED-01 | T-43-01 | new-block form submits only through `createBlock()` (existing auth + Zod) | eval + source-contract | `npm run eval -- --phase 43`; `tests/phase43/*.spec.ts` | ❌ W0 | ⬜ pending |
| 43-scanner | TBD | 1 | DED-02 | — | N/A | eval + source-contract (`UploadDropzone.tsx` imports + renders `PhotoScanner`; no "coming soon" literal) | `npm run eval -- --phase 43`; `tests/phase43/*.spec.ts` | ❌ W0 | ⬜ pending |
| 43-wiring-lens | TBD | 1 | DED-02 | — | N/A | source-contract (`LENS_OPTIONS` has no matrix/illuminate entries) | `tests/phase43/*.spec.ts` | ❌ W0 | ⬜ pending |
| 43-dead-state | TBD | 1 | DED-03 | — | N/A | source-contract (identifiers absent) + `npx eslint <files>` zero `no-unused-vars` | `tests/phase43/*.spec.ts` | ❌ W0 | ⬜ pending |
| 43-shims | TBD | 1 | DED-03 | T-43-02 | `next.config.ts` redirects only to same-origin paths | source-contract (shim page files absent; `next.config.ts` has the two entries; `reference-sweep` + `deletion-sweep` updated) + eval (legacy URLs land) | `tests/phase41/reference-sweep.spec.ts`, `tests/phase54/deletion-sweep.spec.ts`, `npm run eval -- --phase 43` | partial | ⬜ pending |
| 43-docs | TBD | 1 | DED-04 | — | N/A | source-contract (stale strings absent from ARCHITECTURE.md; `journeys.ts` publish route is `/api/sops/[sopId]/publish`) | `tests/phase43/*.spec.ts` | ❌ W0 | ⬜ pending |
| 43-pathways | TBD | 2 | DED-04 | — | N/A | eval (existing) | `tests/evals/sop-surface.eval.ts` test E "pathways map reports zero unmapped screens" | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/lint/no-dead-internal-hrefs.spec.ts` — repo-wide dead-href sweep, registered in a `playwright.config.ts` project regex, verified with `--list`
- [ ] `tests/phase43/dead-surface.spec.ts` — source-contract stubs for DED-01..04 findings (the identifiers/strings named in 43-CONTEXT.md)
- [ ] `tests/evals/*.eval.ts` extension — New-block lands on form; Scan-document opens scanner; legacy shim URLs redirect

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Scanner captures from a real camera | DED-02 | Headless Chromium has no camera | Already an outstanding human item from Phase 53; eval only asserts the scanner UI opens |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
