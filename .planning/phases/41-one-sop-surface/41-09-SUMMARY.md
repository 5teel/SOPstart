---
phase: 41-one-sop-surface
plan: 09
subsystem: verification
tags: [bundle-gate, deployed-site-evals, playwright, sur-05]

# Dependency graph
requires:
  - phase: 41-one-sop-surface
    plan: 07
    provides: "Zero in-app code paths route through the /admin/sops shim"
  - phase: 41-one-sop-surface
    plan: 08
    provides: "All legacy source-contract specs repointed; full suite at its accepted floor"
provides:
  - "41-BUNDLE-PROOF.md — SUR-05 evidence with measured numbers against the UNMODIFIED Wave-0 baseline (/sops/[sopId]/page 1048→1049 KB, /sops/page 940→941 KB, forbidden markers absent, baseline byte-identical to e59d057)"
  - "41-EVAL.md — the deployed-site eval report (7/7 on https://sopstart.com at c68ff77) that REPLACES the plan's human-verify task; run via `npm run eval -- --phase 41`"
  - "tests/evals/sop-surface.eval.ts + tests/evals/lib/session.ts + scripts/run-evals.mjs + scripts/eval-fixtures.mjs + /api/version — the standing eval harness (see CLAUDE.md 'Deployed-site evals')"
affects: [42, 43, 45]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Deployed-site eval: mint a real Supabase session for a fixture account (admin generateLink → verifyOtp), install it as the `sb-<ref>-auth-token` base64url cookie, drive https://sopstart.com in Playwright, assert at DOM level, screenshot for the visual items, fail on page/hydration errors"
    - "Deploy-aware runner: poll public /api/version until RAILWAY_GIT_COMMIT_SHA === local HEAD before running"

key-files:
  created:
    - .planning/phases/41-one-sop-surface/41-BUNDLE-PROOF.md
    - .planning/phases/41-one-sop-surface/41-EVAL.md
    - tests/evals/sop-surface.eval.ts
    - tests/evals/lib/session.ts
    - scripts/run-evals.mjs
    - scripts/eval-fixtures.mjs
    - src/app/api/version/route.ts
    - tests/lint/version-route-public.spec.ts
  modified:
    - src/lib/supabase/middleware.ts
    - playwright.config.ts
    - package.json
    - src/app/(protected)/sops/page.tsx
    - src/components/sop/AdminSopSurface.tsx
    - src/components/sop/SopWorkerBrowser.tsx
    - tests/phase41/merged-surface.spec.ts

metrics:
  duration: "~3h across two sessions (proof 10 min; eval harness + 4 deploy/eval cycles)"
  completed: 2026-09-15
---

# Phase 41 Plan 09: Bundle proof + deployed-site verification — Summary

**SUR-05 proven with recorded numbers, and the human-verify checkpoint replaced by a deployed-site eval that passes 7/7 on sopstart.com.**

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | `902034b` | docs(41-09): record SUR-05 bundle proof with real measured numbers |
| 2 | `c40d65a` | test(evals): deployed-site eval harness replaces human click-path checkpoints |
| 2 | `6e2f2a1` | docs: deployed-site evals replace human-verify checkpoints (process, CLAUDE.md) |
| 2 | `7aac5f6` | fix(41): one 'By department' group on /sops (found by eval run 1) |
| 2 | `bf9adce` | fix(41): skeleton fallback while a lens chunk loads (found by eval run 2 screenshot) |
| 2 | `959d1a5` | test(41): SUR-02 dynamic-binding pin tolerates the loading fallback option |
| 2 | `c68ff77` | fix(sops): viewport-neutral empty-state copy (found by eval run 3 mobile screenshot) |

## Task 2 — what replaced the checkpoint

Simon declined the 19-question click-path ("I need evals built to test to speed up the dev process instead"). The plan's must-haves "Simon has confirmed…" are satisfied by machine instead:

| Plan question (paraphrased) | Eval test | Result at c68ff77 |
|---|---|---|
| Admin sees the Admin scope group with counts; columns aligned | A | ✅ |
| Drafts lists SOPs; one Open→builder chain; attention + access take over full-width and return without reload | B | ✅ |
| Worker behaviours survive for an admin (All yours, search, department filter) | C | ✅ |
| One "SOPs" nav entry; `/admin/sops?view=access` and `?status=draft` land on `/sops`; Governance → Needs attention | D | ✅ |
| `/pathways` reports 0 not mapped | E | ✅ |
| Worker sees no Admin group; legacy admin URL bounces away | F1 | ✅ |
| Mobile worker list unchanged, no admin scopes | F2 | ✅ |

Screenshots inspected by the orchestrator (`.planning/evals/latest/*.png`): admin list with one department group; attention lens "Nothing needs attention"; access lens full wiring board; worker desktop and mobile with no admin rows.

## Defects the eval found that the green suite had not

1. **Two "By department" groups** in the admin Miller column (worker filter + admin counted group both rendered). Fixed `7aac5f6` — worker group hides under admin status scopes; admin group renders only there.
2. **Blank frame for ~400 ms** when switching to Needs attention / Access while the lens chunk loaded. Fixed `bf9adce` — `loading: LensSkeleton` on the three `next/dynamic` bindings.
3. **Mobile empty state** said "Pick another view on the left" where the scopes are chips above. Fixed `c68ff77`.

## Deviations

- Task 2 was executed as an automated eval, not a human checkpoint (user direction, 2026-09-15). Process recorded in CLAUDE.md § "Deployed-site evals" and memory `feedback_evals_not_click_paths`.
- Two eval fixture accounts were created in the SOPstart org (`eval-admin@sopstart.com` admin, `eval-worker@sopstart.com` worker) via `scripts/eval-fixtures.mjs`.
- A public cookie-less `/api/version` route was added (middleware exemption guarded by `tests/lint/version-route-public.spec.ts`) so the runner can wait for the deploy.

## Verification

- `npm run build` green; bundle gate: /sops/[sopId]/page Δ +1 KB, /sops/page Δ +1 KB against the Wave-0 baseline (never re-captured after `e59d057`).
- `npx tsc --noEmit` clean.
- `npx playwright test --project=phase41 --project=phase30 --project=phase15-stubs` → 225 passed.
- `npm run eval -- --phase 41` → 7 passed / 0 failed on https://sopstart.com at `c68ff77` (41-EVAL.md).

## Self-Check: PASSED

- 41-BUNDLE-PROOF.md exists and pins the baseline as byte-identical to `e59d057`.
- 41-EVAL.md exists with 7/7.
- All commits above are on `origin/master`.
