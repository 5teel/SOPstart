---
phase: 53-phone-scan-or-ask
plan: 01
subsystem: auth
tags: [playwright, jsqr, qr-code, open-redirect, middleware, nextjs, supabase]

# Dependency graph
requires:
  - phase: 52-worker-home-the-plant
    provides: "['site-worker'] query, NowCard/MachinePanel components, render-seam gate pattern on /sops/page.tsx"
  - phase: 51-site-model-machine-editor
    provides: "site_machines.code column, MACHINE_CODE_PATTERN/newMachineCode in src/lib/site/scene.ts"
provides:
  - "phase53 Playwright project (broad tests/phase53/** testMatch) with 9 registered stub files"
  - "jsqr@1.4.0 exact-pinned runtime dependency, verified against npm registry before install, unused in src/ yet"
  - "src/lib/site/qr-decode.ts -- normaliseMachineCode/plateUrl/extractMachineCode/isOurPlateUrl, unit-tested against open-redirect and foreign-QR cases"
  - "src/lib/auth/next-redirect.ts -- safeNextPath, the one guard for ?next="
  - "?next= now survives middleware -> /login -> LoginForm -> loginWithEmail round trip for safe relative paths"
  - "tests/evals/phone-home.eval.ts skeleton (self-skips without EVAL_BASE_URL)"
affects: [53-02, 53-03, 53-04, 53-05, 53-06]

# Tech tracking
tech-stack:
  added: ["jsqr@1.4.0 (Apache-2.0, zero deps, no install scripts -- decoder wired in 53-05)"]
  patterns:
    - "Pure-module guard pattern: qr-decode.ts and next-redirect.ts carry no directive, take origin as a parameter (never hardcoded), so both client and server code can import them"
    - "Comment-stripped source-contract tests (stripComments, copied from tests/phase41/merged-surface.spec.ts) to assert wiring without a comment tripping its own guard"

key-files:
  created:
    - src/lib/site/qr-decode.ts
    - src/lib/auth/next-redirect.ts
    - tests/phase53/qr-decode.spec.ts
    - tests/phase53/login-next-redirect.spec.ts
    - tests/phase53/m-code-page.spec.ts
    - tests/phase53/m-code-org-scope.spec.ts
    - tests/phase53/plate-page.spec.ts
    - tests/phase53/phone-home.spec.ts
    - tests/phase53/machine-list-sheet.spec.ts
    - tests/phase53/phone-home-fallback.spec.ts
    - tests/phase53/scan-sheet.spec.ts
    - tests/evals/phone-home.eval.ts
  modified:
    - playwright.config.ts
    - package.json
    - package-lock.json
    - src/lib/supabase/middleware.ts
    - src/app/(auth)/login/page.tsx
    - src/components/auth/LoginForm.tsx
    - src/actions/auth.ts

key-decisions:
  - "Deviation from orchestrator outline (recorded in PLAN.md, not silent): the scan-sheet forbidden-marker group moves to 53-05, since check-bundle-size.ts hard-fails on a marker string that doesn't exist anywhere in the build yet, and no scan-sheet literal exists until 53-05 creates the component."
  - "safeNextPath rejects /login* and /api/* destinations (redirect-loop guard, and API callers have no use for a login-page ?next=), in addition to same-origin/no-backslash/no-control-char checks."

patterns-established:
  - "A ?next= path is re-validated at every hop that consumes it (middleware sets it, login page reads it, loginWithEmail re-validates the client-supplied value) -- defence in depth per T-53-03, not a single trust-once check."

requirements-completed: [PHN-02, PHN-03]

# Metrics
duration: ~4min (git commit span; excludes upfront PLAN/CONTEXT/RESEARCH/PATTERNS reading)
completed: 2026-09-29
---

# Phase 53 Plan 01: Phone Scan-or-Ask Foundation Summary

**`phase53` Playwright harness (9 registered specs) + `jsqr@1.4.0` pinned after a live registry re-check + two pure guard modules (`qr-decode.ts`, `next-redirect.ts`) wired so a plate scanned while logged out survives the login round trip via `?next=`**

## Performance

- **Duration:** ~4 min (commit-to-commit span)
- **Started:** 2026-09-29T02:04:07+10:00 (first task commit)
- **Completed:** 2026-09-29T02:07:38+10:00 (last task commit)
- **Tasks:** 3
- **Files modified:** 19

## Accomplishments
- Registered the `phase53` Playwright project and 9 stub spec files (2 now live, 7 fixme) covering every requirement row this phase will need through 53-06
- Verified `jsqr@1.4.0`'s registry metadata live (version, Apache-2.0 license, `cozmo/jsQR` repo, no install-lifecycle scripts, zero dependencies) before installing exact-pinned; confirmed `grep -rn "jsqr" src/` is empty
- Built and unit-tested `src/lib/site/qr-decode.ts` (plate URL builder + "is this our plate" origin/path validator) against look-alike hosts, extra path segments, `javascript:` URLs, protocol-relative URLs, and a 50-code round trip
- Built and unit-tested `src/lib/auth/next-redirect.ts` (`safeNextPath`) against every open-redirect shape in the threat register: absolute URLs, `//`, backslashes, control characters, `/login*`, `/api/*`, oversized paths
- Wired `?next=` through all four hops: `middleware.ts` sets it on the unauthenticated redirect (skipping `/api/*`) and prefers it over `roleHome` on the signed-in `/login` bounce; `login/page.tsx` reads and validates it; `LoginForm` threads it to `loginWithEmail`; `loginWithEmail` re-validates it server-side before redirecting

## Task Commits

Each task was committed atomically:

1. **Task 1: phase53 harness, jsqr pinned after a registry check, eval skeleton** - `9bca141` (feat)
2. **Task 2: qr-decode.ts and next-redirect.ts — test first** - `afdb9bf` (test, RED) + `f06d8ad` (feat, GREEN)
3. **Task 3: carry ?next= through middleware, the login page, the form and loginWithEmail** - `7851e1d` (feat)

**Plan metadata:** commit pending (this SUMMARY + STATE/ROADMAP owned by orchestrator)

## Files Created/Modified
- `playwright.config.ts` - registers the `phase53` project (broad `tests/phase53/**` testMatch)
- `package.json` / `package-lock.json` - `jsqr` pinned exact at `1.4.0` in `dependencies`
- `tests/phase53/qr-decode.spec.ts` - live unit tests for `qr-decode.ts` (6 tests)
- `tests/phase53/login-next-redirect.spec.ts` - live unit tests for `safeNextPath` (5 tests) + live source-contract tests for the `?next=` wiring (6 tests)
- `tests/phase53/m-code-page.spec.ts`, `m-code-org-scope.spec.ts`, `plate-page.spec.ts` - fixme stubs, activate 53-03
- `tests/phase53/phone-home.spec.ts`, `machine-list-sheet.spec.ts`, `phone-home-fallback.spec.ts` - fixme stubs, activate 53-04
- `tests/phase53/scan-sheet.spec.ts` - fixme stub, activates 53-05
- `tests/evals/phone-home.eval.ts` - deployed-eval skeleton, 6 fixme tests, self-skips without `EVAL_BASE_URL`
- `src/lib/site/qr-decode.ts` - `normaliseMachineCode`, `plateUrl`, `extractMachineCode`, `isOurPlateUrl`
- `src/lib/auth/next-redirect.ts` - `safeNextPath`
- `src/lib/supabase/middleware.ts` - unauthenticated redirect sets `?next=`; signed-in auth-route branch prefers a validated `next` over `roleHome`
- `src/app/(auth)/login/page.tsx` - reads/validates `searchParams.next`, passes to `<LoginForm next={next} />`
- `src/components/auth/LoginForm.tsx` - accepts `next` prop, threads to `loginWithEmail(data, next)`
- `src/actions/auth.ts` - `loginWithEmail(formData, next?)` redirects to `safeNextPath(next) ?? roleHome(...)`

## `npm view jsqr@1.4.0` output (checked before install)

```json
{
  "name": "jsqr",
  "version": "1.4.0",
  "license": "Apache-2.0",
  "repository.url": "git+https://github.com/cozmo/jsQR.git",
  "scripts": { "lint": "tslint --project .", "test": "jest", "build": "webpack", "watch": "webpack --watch", "prebuild": "rimraf dist", "generate-test-data": "ts-node --project tests/ tests/generate-test-data.ts" }
}
```
No `preinstall`/`install`/`postinstall` script; `npm view jsqr@1.4.0 dependencies --json` returned empty (zero runtime dependencies). All four T-53-SC checks matched — proceeded with `npm install jsqr@1.4.0 --save-exact`.

## Decisions Made
- Kept the scan-sheet bundle-marker group deferred to 53-05 (per the plan's own recorded deviation from the orchestrator outline) — adding it now would hard-fail `npm run build` since no scan-sheet literal exists yet.
- `safeNextPath` rejects `/login*` and `/api/*` in addition to the open-redirect shapes, matching the Security Domain's threat register exactly.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `test.fixme(true, reason)` does not register a test — fixed to `test.fixme(title, async () => {})`**
- **Found during:** Task 1
- **Issue:** The plan's stub-file instructions described "one `test.fixme` placeholder" per assertion. My first pass used the two-argument conditional form (`test.fixme(condition, reason)`), which is Playwright's API for conditionally marking an *existing* test fixme, not for registering a new one — `npx playwright test --list --project=phase53` returned "Total: 0 tests in 0 files" even though all 9 files existed.
- **Fix:** Rewrote all 9 stub files (and the eval skeleton) to use `test.fixme('title', async () => {})`, the form that registers a real (skipped) test entry.
- **Files modified:** all `tests/phase53/*.spec.ts` stubs, `tests/evals/phone-home.eval.ts`
- **Verification:** `npx playwright test --list --project=phase53` now lists 34 tests across 9 files (later 48 after Task 2/3 added the live cases); `--list --project=evals` lists 6.
- **Committed in:** `9bca141` (Task 1 commit — caught and fixed before the commit)

**2. [Rule 1 - Bug] A doc comment quoted its own forbidden-literal guard, tripping the acceptance check it was documenting**
- **Found during:** Task 2 (self-check before commit)
- **Issue:** `next-redirect.ts`'s header comment explained why the module has no directive by literally writing `'use server'` and `'use client'` in prose — this is exactly the Pitfall 5 class from RESEARCH.md ("a comment describing what's NOT there is textually indistinguishable from code that IS" to a raw grep). `grep -c "use server\|use client" src/lib/auth/next-redirect.ts` returned 2 instead of the required 0.
- **Fix:** Paraphrased the comment ("a server action" instead of quoting `'use server'`) so it explains the same constraint without containing the literal string.
- **Files modified:** `src/lib/auth/next-redirect.ts`
- **Verification:** `grep -c "use server\|use client" src/lib/auth/next-redirect.ts` now returns 0.
- **Committed in:** `f06d8ad` (Task 2 GREEN commit — caught and fixed before the commit)

**3. [Rule 1 - Bug] Unused `eslint-disable-next-line no-control-regex` directive**
- **Found during:** Task 3 (lint check before commit)
- **Issue:** `next-redirect.ts`'s control-character regex didn't actually trigger the `no-control-regex` rule (the project's eslint config apparently doesn't flag it, or the flat-config rule set differs from assumption), leaving an unused-directive warning.
- **Fix:** Removed the unnecessary disable comment.
- **Files modified:** `src/lib/auth/next-redirect.ts`
- **Verification:** `npx eslint src/lib/auth/next-redirect.ts` returns clean.
- **Committed in:** `7851e1d` (Task 3 commit — caught and fixed before the commit)

---

**Total deviations:** 3 auto-fixed (all Rule 1 — bugs caught and fixed during self-review before each commit, never shipped)
**Impact on plan:** All three were caught before their respective commits landed; no broken state was ever committed. No scope creep.

## Issues Encountered
- `npm run lint` run repo-wide reports 65 pre-existing errors in unrelated files (`transcripts/format-transcript.cjs`, various `tests/*.test.ts` video-gen files) that predate this plan and are out of scope per the CLAUDE.md scope-boundary rule. Verified in isolation that every file this plan touched (`middleware.ts`, `login/page.tsx`, `LoginForm.tsx`, `auth.ts`, `qr-decode.ts`, `next-redirect.ts`, both new spec files) is eslint-clean via `npx eslint <file>`, except one pre-existing `prefer-const` error on `middleware.ts` line 7 (`let response = NextResponse.next(...)`) that predates this plan (confirmed via `git show HEAD~3:src/lib/supabase/middleware.ts | npx eslint --stdin`) and is on a line this plan never touched — left as-is per scope boundary, not auto-fixed.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `qr-decode.ts` and `next-redirect.ts` are ready for 53-03 (`/m/[code]` route, plate page) and 53-05 (scan sheet) to import
- `jsqr` is pinned and verified but unused — 53-05 wires the dynamic `import('jsqr')` fallback
- `?next=` round trip is proven by source-contract tests here; the live end-to-end proof (scan while logged out → sign in → land on the machine) is 53-06's deployed eval
- 7 fixme stub tests remain per later plan (53-03: 9, 53-04: 10, 53-05: 7) — each plan flips its own describe block live, per the established phase51/52 convention

---
*Phase: 53-phone-scan-or-ask*
*Completed: 2026-09-29*

## Self-Check: PASSED

All 13 created/modified artifact files and 4 task commit hashes (`9bca141`, `afdb9bf`, `f06d8ad`, `7851e1d`) verified present.
