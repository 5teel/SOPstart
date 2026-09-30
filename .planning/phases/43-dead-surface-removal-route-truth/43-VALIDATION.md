---
phase: 43
slug: dead-surface-removal-route-truth
status: draft
nyquist_compliant: false
wave_0_complete: true
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
| 43-W0 | 01 | 0 | DED-01 | — | N/A | lint (source-contract, mutation-proven) | `npx playwright test --project=phase15-stubs -g "no-dead-internal-hrefs"` | ✅ `tests/lint/no-dead-internal-hrefs.spec.ts` | ✅ green (4/4) |
| 43-blocks-new | 02 | 1 | DED-01 | T-43-01 | new-block form submits only through `createBlock()` (existing auth + Zod); wire-reachable serviceRole override removed | eval + source-contract | `npm run eval -- --phase 43`; `tests/phase43/new-block.spec.ts` | ✅ live (6/6 green) | ✅ source-contract green; ⬜ eval pending (Task 2) |
| 43-scanner | 03 | 1 | DED-02 | — | N/A | eval + source-contract (`UploadDropzone.tsx` imports + renders `PhotoScanner`; no "coming soon" literal) | `npm run eval -- --phase 43`; `tests/phase43/dead-controls.spec.ts` | ✅ live (5/5 green) | ✅ source-contract green; ⬜ eval pending (Task 2) |
| 43-wiring-lens | 03 | 1 | DED-02 | — | N/A | source-contract (`LENS_OPTIONS` has no matrix/illuminate entries) | `tests/phase43/dead-controls.spec.ts` | ✅ live | ✅ source-contract green; ⬜ eval pending (Task 2) |
| 43-dead-state | 03 | 1 | DED-03 | — | N/A | source-contract (identifiers absent) + `npx eslint <files>` zero `no-unused-vars` | `tests/phase43/dead-controls.spec.ts` | ✅ live | ✅ green |
| 43-shims | 04 | 1 | DED-03 | T-43-02 | `next.config.ts` redirects only to same-origin paths | source-contract (shim page files absent; `next.config.ts` has the two entries; `reference-sweep` + `deletion-sweep` updated) + eval (legacy URLs land) | `tests/phase41/reference-sweep.spec.ts`, `tests/phase54/deletion-sweep.spec.ts`, `tests/phase43/route-truth.spec.ts`, `npm run eval -- --phase 43` | ✅ live (5/5 green) | ✅ source-contract green; ⬜ eval pending (Task 2) |
| 43-docs | 01 | 0 | DED-04 | — | N/A | source-contract (stale strings absent from ARCHITECTURE.md; `journeys.ts` publish route is `/api/sops/[sopId]/publish`) | `tests/phase43/route-truth.spec.ts` | ✅ (live pin) | ✅ green |
| 43-pathways | 05 | 2 | DED-04 | — | N/A | eval (existing) | `tests/evals/sop-surface.eval.ts` test E "pathways map reports zero unmapped screens" | ✅ | ⬜ eval pending (Task 2) |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

### Gate results (43-05 Task 1, 2026-09-30)

- `npx tsc --noEmit` — clean, exit 0.
- `npm run test` (full suite, run once): 25 failed / 250 skipped / 1884 passed. Non-live failure set = the 16 pre-existing entries in `51-BASELINE-FAILURES.md` (phase11-stubs ×10, phase12.5-stubs ×5, phase25-integration ×1), exact match. The remaining 9 failures are all `[phase46] tests\phase46\sop-edit-owner-access.spec.ts` live-Supabase probes failing with the identical `verifyOtp failed: Request rate limit reached` message (CLAUDE.md 2026-09-28 OTP-budget exception) — same failure class as the 51-baseline's 4 phase46 entries, different specific tests hit the cap this run because ordering shifted. Zero new non-live failures attributable to phase 43.
- `npm run build` — clean, exit 0. Bundle gate: `/sops/[sopId]/page` = 1045 KB (baseline 1048 KB, Δ -3 KB); `/sops/page` = 936 KB (baseline 940 KB, Δ -4 KB); both within ±2 KB tolerance, both net negative. `git diff 5020519 HEAD -- .bundle-baseline.json` — empty, baseline untouched.
- eslint over the phase's 31 changed `.ts`/`.tsx` files (`git diff --name-only 5020519 HEAD -- src tests next.config.ts playwright.config.ts`): initially found one `@typescript-eslint/no-unused-vars` warning in `tests/lint/no-dead-internal-hrefs.spec.ts` (write-only `m` in the doc-route-count loop) — fixed in `4d5f386` (`matchAll` replaces the manual while-loop), re-run clean, 0 `no-unused-vars`. Two pre-existing `react-hooks/set-state-in-effect` errors remain in `versions/page.tsx` (out of scope per D-02, confirmed pre-existing in 43-03-SUMMARY.md) and one pre-existing unused-eslint-disable-directive warning in `src/actions/blocks.ts` (confirmed pre-existing in 43-02-SUMMARY.md via `git stash`) — neither is a `no-unused-vars` finding. `grep -rEn "eslint-disable.*no-unused-vars" src` → 0 matches.
- `npx playwright test --list --project=phase15-stubs | grep -c no-dead-internal-hrefs` → 4. `npx playwright test --project=phase43` → 16 passed, 0 skipped.

---

## Wave 0 Requirements

- [x] `tests/lint/no-dead-internal-hrefs.spec.ts` — repo-wide dead-href sweep, registered in a `playwright.config.ts` project regex, verified with `--list` (4 tests, 3 passed / 1 skipped, mutation-proven)
- [x] `tests/phase43/new-block.spec.ts`, `tests/phase43/dead-controls.spec.ts`, `tests/phase43/route-truth.spec.ts` — source-contract stubs for DED-01..04 findings, registered in the `phase43` project (15 tests, 2 live passed / 13 fixme skipped)
- [x] `tests/evals/dead-surface.eval.ts` — New-block lands on form; Scan-document opens scanner; Access map shows Wiring only; legacy shim URLs redirect

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
