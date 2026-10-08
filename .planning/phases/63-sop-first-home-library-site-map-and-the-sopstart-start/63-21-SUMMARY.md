---
phase: 63-sop-first-home-library-site-map-and-the-sopstart-start
plan: 21
subsystem: sign-off
tags: [deployed-eval, eval-01, gate-01, docs-01, sign-off, learnings]
requires: [63-20]
provides:
  - "63-EVAL.md: the full deployed run, every screenshot read, defects and fixes"
  - "fix round: seven queued items fixed (one with a caveat), one eval defect found and fixed"
  - "VALIDATION signed off, 17 / 17 Phase 63 requirements ticked with evidence, Learnings added"
affects: []
key-files:
  modified:
    - src/components/focus/BrowseDocument.tsx
    - src/components/admin/competency/TrainingBridge.tsx
    - src/components/admin/site/DepartmentsStrip.tsx
    - src/components/admin/site/SiteWorkspace.tsx
    - src/components/home/sections/ManageSection.tsx
    - src/lib/library/areas.ts
    - tests/lint/no-walk-words.spec.ts
    - tests/lint/no-global-blocks-in-journeys.spec.ts
    - tests/phase58/frame-structure.spec.ts
    - tests/evals/home.eval.ts
    - tests/evals/requests.eval.ts
    - tests/evals/cut-features.eval.ts
    - tests/evals/lib/walk.ts
    - CLAUDE.md
    - .planning/phases/63-sop-first-home-library-site-map-and-the-sopstart-start/63-EVAL.md
    - .planning/phases/63-sop-first-home-library-site-map-and-the-sopstart-start/63-VALIDATION.md
    - .planning/phases/63-sop-first-home-library-site-map-and-the-sopstart-start/deferred-items.md
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md
    - .planning/STATE.md
key-decisions:
  - "Fixed the known queue first, pushed, and only then ran the one full eval, so the full run proved the final product instead of needing a second full run."
  - "Training default is 'the department with the most people' (the matrix needs a department, so 'all departments' is not available without a server change)."
  - "Department dots use areaColourVar (the map's --area-N in name order); the colour swatches were left alone and are now inert on the home (recorded for Simon, 63-EVAL Open 2)."
  - "The 'Show me' on the editor's AI findings stays: it is a reasoned allowlist entry of the 63-16 guard, a different control from the old start label."
requirements-completed: [EVAL-01, GATE-01, DOCS-01, HOME-02, HOME-04, HOME-05, MAP-01, MAP-02, MAP-03, BRAND-01, WORD-01]
completed: 2026-10-08
---

# Phase 63 Plan 21: sign-off Summary

**Phase 63 is proven on https://sopstart.com: 98 of 98 deployed eval cases pass at `07a9f65c` (one full run, 97 cases, then only the failing file and one new case), all 205 screenshots were read, both bundle gates hold with the baseline untouched (802 / 832), and the one full suite run is red only on seven live probes that hit the OTP rate limit.**

## Deployed sha and runs

- Product under test: `07a9f65c` (the fix commit of this plan); `/api/version` served it before the run. `4ec54a1d` (eval-only) and `17f86a83` (a lint spec) were pushed afterwards; no product file changed after `07a9f65c`.
- `npm run eval -- --phase 63`: 97 cases, 89 pass, 1 fail, 7 skipped (serial describe after the failure).
- Re-runs (nothing else): `requests.eval.ts` whole file 11 / 11; the new `home.eval` case 1 / 1.

## Eval results (per file; the case-by-case table with screenshots read is in 63-EVAL.md)

| File | Cases | Pass | Fail | Notes |
|---|---|---|---|---|
| home | 16 | 16 | 0 | 15 in the full run + the new Manage / Site fold / department colours case |
| home-addresses | 5 | 5 | 0 | |
| start | 5 | 5 | 0 | six slow-motion frames, phone frames, resume, second start all read |
| office | 19 | 19 | 0 | invite leg annotated "not proven this run" (mailer limit) |
| requests | 11 | 11 | 0 | full run 3 pass, 60-14 failed (eval defect), 7 skipped; re-run 11 / 11 |
| sop-focus | 18 | 18 | 0 | |
| cut-features | 6 | 6 | 0 | |
| sop-ledger | 6 | 6 | 0 | |
| dead-surface | 3 | 3 | 0 | |
| site-templates | 4 | 4 | 0 | |
| site-editor | 2 | 2 | 0 | |
| welcome | 3 | 3 | 0 | |
| **Total** | **98** | **98** | **0** | |

Every `63-fuse-*` frame, every `63-real-org-*` shot, the section, address and phone shots and the sibling evals' shots were read (63-EVAL.md lists what each shows). The contact sheets I first made overlapped headings with their own labels; the ones that mattered were re-read full size.

## Fix round (the queue handed to this plan)

| # | Item | Result | Commit |
|---|---|---|---|
| 1 | Two identical start buttons on a stopped SOP's screen | **Fixed**: the sticky start is hidden while the resume card shows; `63-fuse-kept-going` shows one start and the "Picks up at step N · or begin from step 1" note; R6 confirm unchanged | `07a9f65c` |
| 2 | Site & departments canvas half off-screen at 900 px | **Fixed**: departments in a 3-up grid, canvas 60vh; new eval assertion + `63-home-site-fold` (whole canvas on screen at 1440 x 900) | `07a9f65c`, `4ec54a1d` |
| 3 | Training opens on the first department and reads empty | **Changed, not provable**: opens on the department with the most people; the eval org has no department with a person, so it still reads "No people with required SOPs in this cut." there (63-EVAL Open 3) | `07a9f65c` |
| 4 | Department dots all default blue vs the map's area colours | **Fixed**: `areaColourVar` in `areas.ts` is the one assignment (map, key, list and the strip); eval compares computed dot colours to `--area-N`. Side effect: swatches now inert on the home (Open) | `07a9f65c`, `4ec54a1d` |
| 5 | Manage "Carry on" tap target, check at 390 px | **Fixed**: `min-h-tap`, eval asserts >= 44 px and no sideways scroll; `63-home-phone-manage` read | `07a9f65c`, `4ec54a1d` |
| 6 | Office invite receipt | **Environment limit**: the full run answered "email rate limit exceeded" again (`59-people-invite-limited`); not proven in this phase (second run in a row), recorded per CLAUDE.md 2026-10-06 | n/a |
| 7 | `no-walk-words` CRLF `//` weakness | **Fixed**: normalise `\r\n` first; mutation-proved (green; with the line removed the CRLF self-test goes red) | `07a9f65c` |

One more defect, found by the full run: `requests.eval` 60-14 timed out twice (4.0 min each) because it clicked `focus-start-walking`, which is gone when a walk is open (fix 1 made the resume card's start the only one, and the previous run had left a walk). The serial describe then skipped seven cases. `test-failed-1.png` showed it in seconds. Fixed in `4ec54a1d` (`startWalking`, cut-features and 60-14 accept either start); not a product defect.

## Build, bundle numbers, full suite

- `npx tsc --noEmit` clean. `npm run build` exit 0, markers self-validate.
- Bundle gate: `/sops/[sopId]/page` **802 KB** (baseline 802, +0); `/page` **832 KB** (baseline 831, +1; tolerance +-2). `git diff -- .bundle-baseline.json` empty. **No baseline move is proposed** (nothing sits well below its baseline; both are at or just above).
- `npm run test` once: **2136 passed, 255 skipped (self-skipping live probes), 8 failed**.
  - 7 failed: `tests/phase46/sop-edit-owner-access.spec.ts` live probes, each `verifyOtp failed: Request rate limit reached` (the shared OTP budget after the full eval, CLAUDE.md 2026-09-28; the same file went green on its own re-run in the earlier deferred-items note). **Environment, not re-run** (a re-run would burn the same budget).
  - 1 failed: `tests/lint/no-global-blocks-in-journeys.spec.ts` "journeys.ts names the site edit mode" pinned `?place=edit`; 63-17 moved journeys.ts to `view=site` and the project (phase25-integration) was in no earlier gate. Real stale assertion: repointed in `17f86a83`, spec 6 / 6 green.
- Against 63-BASELINE.md (0 failing in phase52/57/58/59/60): phases 52, 57, 58, 59, 60, 63 and phase15-stubs all passed in the full run; the only non-environment failure was the one above, now fixed. deferred-items.md updated.

## Requirements (17 / 17 ticked)

Evidence per id is in REQUIREMENTS.md under "Phase 63 evidence". Honest caveats: HOME-02's **tool-name search** and MAP-03's **reduced-motion cut** are proven by source-contract specs only (no deployed fixture carries a tool; the eval does not set reduced motion on the map); both are ticked on that basis and noted.

## Learnings added to CLAUDE.md (2026-10-08)

1. `document.fonts.check` over a whole next/font family list is false for ever in production (63-15).
2. How the Start merge crosses a navigation: server-markup layer + lazy WAAPI engine, push at the end of stage 1, push deferred while queries settle, `data-fuse-hold`, `?go=1` autostart (63-15).
3. A new import in a layout moves the bundle gate on a route that never imports it: diff the counted chunk list, move the helper to an import-free module (63-13, one entry covering the "gate charges shared chunks" accounting).
4. Removing a duplicate control breaks every eval click helper that targets it once an earlier run leaves state (this plan, 60-14).
5. A line-based `//` comment stripper misses CRLF comments; the self-test fixture must contain something the scanner would flag (63-20 / 63-21).
6. The office invite stays unproven while the mailer limit outlasts the phase.

**Candidates for the global Cross-Project Learnings (not edited):** (a) `document.fonts.check` with next/font fallback faces (any Next project that gates behaviour on font readiness); (b) a deduplicated control must be searched for in e2e helpers, with an `.or()` for the survivor.

## Deviations from Plan

**1. [Order] Fix queue before the full eval.** The plan runs the eval first, then fixes. The queue items were known, so I fixed and pushed them first; the one full run then proved the final product. The cost was the 60-14 defect (below), which a pre-fix run would not have hit.

**2. [Rule 1 - eval defect, caused by fix 1] 60-14 clicked the removed sticky start.** See above; fixed in `4ec54a1d`, whole file re-run.

**3. [Rule 3 - blocking] `no-global-blocks-in-journeys` pinned the old `?place=edit`.** Repointed in `17f86a83` (a project no earlier gate ran).

**4. [Scope] A new home.eval case** (Manage tap target at 390 px, Site fold at 900 px, dots equal `--area-N`) was added so items 2, 4 and 5 are asserted, not only seen. It passed on its first deployed run.

## Open (details in 63-EVAL.md and deferred-items.md)

1. Office invite receipt unproven (mailer limit); one quiet-hour run.
2. Department colour swatches no longer change anything the home shows; decide to retire or to feed the map.
3. Training still reads empty on the eval org (no department members); unproven against populated data.
4. `tests/phase26/konva-worker-isolation.spec.ts` has a dead self-skipping case; delete when convenient.

## Known Stubs

None.

## Self-Check: PASSED

- 63-EVAL.md, 63-VALIDATION.md (`nyquist_compliant: true`, `wave_0_complete: true`), this SUMMARY present; `grep -c "\[x\] \*\*(HOME|MAP|BRAND|FUSE|WORD|RET|GATE|DOCS|EVAL)-" .planning/REQUIREMENTS.md` = 17.
- Commits `07a9f65c`, `4ec54a1d`, `17f86a83` exist on origin/master (docs commit follows); `.bundle-baseline.json` untouched; `npx tsc --noEmit` clean.
