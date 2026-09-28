---
phase: 53-phone-scan-or-ask
plan: 06
subsystem: testing
tags: [playwright, deployed-eval, supabase, qrcode, webpack]

# Dependency graph
requires:
  - phase: 53-phone-scan-or-ask
    plan: 01
    provides: "phase53 harness, jsqr@1.4.0, qr-decode.ts, next-redirect.ts, login ?next=, phone-home.eval.ts skeleton"
  - phase: 53-phone-scan-or-ask
    plan: 03
    provides: "/m/[code] route, MachineView.tsx, the A6 plate page, journeys.ts routes"
  - phase: 53-phone-scan-or-ask
    plan: 04
    provides: "PhoneHome.tsx, the /sops phone seam, phone home bundle marker"
  - phase: 53-phone-scan-or-ask
    plan: 05
    provides: "ScanSheet.tsx, the Scan button, the scan sheet bundle marker"
  - phase: 52-worker-home-the-plant
    plan: 05
    provides: "the plant-home.eval.ts fixture pattern (upsert-only, org-guard) this plan factors into a shared helper"
provides:
  - "tests/evals/lib/plant-fixture.ts -- shared ensurePlantFixture/realOrgHasDrawnSite/shot/watchConsole, one copy used by plant-home.eval.ts and phone-home.eval.ts"
  - "tests/evals/phone-home.eval.ts -- six live deployed eval tests proving PHN-01/02/03 on sopstart.com"
  - "53-EVAL.md -- committed deployed-eval report with every screenshot read and noted"
  - "signed-off 53-VALIDATION.md (status: complete, nyquist_compliant: true)"
  - "phone-home-worker /uat review item"
  - "two CLAUDE.md Learnings entries (bundle-gate chunk churn already logged by 53-05; this plan adds the notFound()-serves-200 eval-assertion pattern)"
affects: [54-admin-repaint]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A deployed eval's fixture upsert logic that a sibling eval also needs lives in one shared tests/evals/lib/*.ts module, not copy-pasted between *.eval.ts files -- plant-fixture.ts is the second instance of this after Phase 52's plant-home.eval.ts, and it also carries the shot()/watchConsole() helpers so both files import one copy"
    - "A deployed-eval assertion on a notFound() outcome checks rendered content (absence of protected data, presence of the not-found page's own text), never response.status() -- Next serves the app's custom not-found.tsx with HTTP 200 on fully-dynamic routes"

key-files:
  created:
    - tests/evals/lib/plant-fixture.ts
  modified:
    - tests/evals/plant-home.eval.ts
    - tests/evals/phone-home.eval.ts
    - src/lib/uat/tests.ts
    - .planning/phases/53-phone-scan-or-ask/53-EVAL.md
    - .planning/phases/53-phone-scan-or-ask/53-VALIDATION.md
    - CLAUDE.md

key-decisions:
  - "ensurePlantFixture/realOrgHasDrawnSite/shot/watchConsole were moved (not duplicated) out of plant-home.eval.ts's own body into the new lib/plant-fixture.ts module -- plant-home.eval.ts's own test bodies are otherwise byte-identical to before the move"
  - "The cross-org 404 test asserts page content (not-found text, absence of machine-view/EVAL Press), not response.status() -- confirmed via a direct authenticated fetch (bypassing the browser, Cache-Control: private/no-store ruling out any caching explanation) that the deployed page genuinely serves the app's not-found.tsx boundary at HTTP 200 for this route shape; the real access-control property was already independently proven by tests/phase53/m-code-org-scope.spec.ts's live DB probe"
  - "The machine-sheet-group -> machine-sheet-row 'contains' relationship in the eval is asserted with an XPath parent::div ancestor query rather than a nested locator, because MachineListSheet.tsx renders the group label div and the rows div as siblings under a shared (untagged) wrapper, not as parent/child"

patterns-established:
  - "Deployed-eval fixture/helper sharing: extract to tests/evals/lib/*.ts the moment a second *.eval.ts file needs the same upsert-only setup, rather than letting two files' beforeAll bodies drift"

requirements-completed: [PHN-01, PHN-02, PHN-03]

# Metrics
duration: ~19min (commit-to-commit span across all 3 tasks; excludes the ~2 eval-run wait cycles for Railway deploy + serial eval execution, each ~2-3 min)
completed: 2026-09-29
---

# Phase 53 Plan 06: Deployed Eval, Full-Suite Gate, Validation Sign-Off Summary

**Authored the live `phone-home.eval.ts` deployed eval (six tests covering PHN-01..03) sharing a new `plant-fixture.ts` helper with Phase 52's plant eval, found and fixed an eval-authoring bug (asserting `response.status() === 404` against a route that legitimately serves its friendly not-found page at HTTP 200), and closed the phase with 20/20 deployed evals green on sopstart.com plus a signed-off `53-VALIDATION.md`**

## Performance

- **Duration:** ~19 min (commit-to-commit span, first commit 03:24:28 → last commit 03:43:36, 2026-09-29 AEST/UTC+10; excludes upfront PLAN/context reading and the ~5 min spent waiting on Railway deploys + two serial `npm run eval` runs)
- **Tasks:** 3
- **Files modified:** 6 (1 created, 5 modified) across 4 commits

## Accomplishments

- Extracted the Phase 52 plant eval's `beforeAll` fixture logic (org lookup, hard org-guard against the real SOPstart org, scene/EVAL Press/SOP-link upserts) plus its `shot()`/`watchConsole()` helpers into `tests/evals/lib/plant-fixture.ts` as `ensurePlantFixture()`/`realOrgHasDrawnSite()` — `plant-home.eval.ts` now imports these instead of carrying its own copy; its own test bodies are otherwise unchanged.
- Wrote `tests/evals/phone-home.eval.ts`: six live tests at 390×844 (and 397×559 for the A6 plate, 1440×900 for the site editor cross-check) covering every Phase 53 ROADMAP success criterion — phone home → machine sheet → `/m/<code>` → Walk it; the scan sheet's denied-camera code-entry fallback; the `/login?next=` round trip; a foreign-org worker's 404; the admin plate page + print view + the site editor's Print plate link + a worker being bounced off the plate; and the no-site fallback for the real org's `eval-worker`.
- Added `phone-home-worker` to `/uat`'s review catalogue in plain language (no internal ids), matching the existing `plant-home-worker` entry's shape.
- Ran every gate once in order: `tsc --noEmit` clean, `npm run lint` at the pre-existing 65-error baseline (all in `transcripts/format-transcript.cjs` and unrelated video test files, none in this plan's files), `phase53` project 84/84 passed, full suite once (25 failed = the 16 `51-BASELINE-FAILURES.md` stubs + 9 `phase46 sop-edit-owner-access.spec.ts` probes all failing with the identical `verifyOtp failed: Request rate limit reached` OTP-budget class — no regressions), `npm run build` green with both gated routes at Δ 0 KB and `.bundle-baseline.json` unchanged since `736f44a`.
- Pushed twice, provisioned fixtures (`node scripts/eval-fixtures.mjs`), and ran `npm run eval -- --phase 53` twice: first run 19/20 (the cross-org 404 test failed on a wrong assumption about HTTP status — see Deviations), second run **20/20 passed**, including every regression eval (plant-home, site-editor, sop-detail, sop-surface).
- Opened and read all seven new phone-* screenshots plus `plant-home.png`/`worker-sops.png` for regression — every one matches spec (dark legible Now-card buttons, amber to-do counts and department dots, tinted rel badges, full-width dark Scan button, dark readable scan-sheet code field, sharp square plate QR with a large mono code, print view with chrome/controls hidden) with no visual defects.
- Signed off `53-VALIDATION.md` (every task row green, Wave 0 and sign-off checklists ticked, frontmatter `status: complete` / `nyquist_compliant: true` / `wave_0_complete: true`) and logged the notFound()-serves-200 discovery as a dated `CLAUDE.md` Learnings entry (the bundle-gate chunk-churn finding was already logged by Plan 53-05).

## Task Commits

Each task was committed atomically:

1. **Task 1: shared eval fixture, the live phone-home eval, the /uat item** - `b8e3fdf` (test)
2. **Task 2 fix: eval asserts 404 content, not HTTP status** - `fd1ec3a` (fix)
2. **Task 2: commit the deployed eval report (20/20 passed)** - `ea502be` (docs)
3. **Task 3: validation sign-off and learnings** - `d13ffa3` (docs)

**Plan metadata:** commit pending (this SUMMARY — STATE/ROADMAP owned by orchestrator)

## Files Created/Modified

- `tests/evals/lib/plant-fixture.ts` - shared `ensurePlantFixture`/`realOrgHasDrawnSite`/`shot`/`watchConsole` (new)
- `tests/evals/plant-home.eval.ts` - repointed at the shared helper, test bodies unchanged
- `tests/evals/phone-home.eval.ts` - six live tests replacing the six `test.fixme` stubs
- `src/lib/uat/tests.ts` - `phone-home-worker` review item added
- `.planning/phases/53-phone-scan-or-ask/53-EVAL.md` - committed 20/20-passed report with every screenshot's content noted, plus the Manual-only section
- `.planning/phases/53-phone-scan-or-ask/53-VALIDATION.md` - signed off, all rows green
- `CLAUDE.md` - new dated Learnings entry for the notFound()-200 eval-assertion pattern

## Verification output

```
npx playwright test --list --project=evals tests/evals/phone-home.eval.ts tests/evals/plant-home.eval.ts
  -> 8 tests listed (6 phone-home + 2 plant-home)
npx playwright test --project=evals tests/evals/phone-home.eval.ts tests/evals/plant-home.eval.ts
  -> 8 skipped (self-skip, no EVAL_BASE_URL locally)
npx tsc --noEmit -> clean, run after every task
grep -c "test.fixme" tests/evals/phone-home.eval.ts -> 0
grep -c "ensurePlantFixture(" tests/evals/plant-home.eval.ts tests/evals/phone-home.eval.ts -> 1, 1
grep -c "\.insert(\|\.upsert(\|from('site_layouts')" tests/evals/plant-home.eval.ts -> 0
grep -c "id: 'phone-home-worker'" src/lib/uat/tests.ts -> 1
npx playwright test --project=phase53 --grep-invert "m-code-org-scope" -> 84 passed
npm run lint -> 543 problems (65 errors, matching the pre-existing baseline; 0 in this plan's files)
npm run test (full suite, once) -> 25 failed (16 baseline stubs + 9 phase46 OTP rate-limit probes), 239 skipped, 1770 passed
npm run build -> both gated routes Δ 0 KB, marker self-validation OK, Konva/pdfjs/mammoth isolation OK
git diff --quiet 736f44a HEAD -- .bundle-baseline.json -> unchanged
git push origin master -> f4cb408..b8e3fdf, then b8e3fdf..fd1ec3a, then fd1ec3a..ea502be
node scripts/eval-fixtures.mjs -> idempotent, all 4 fixture accounts confirmed
npm run eval -- --phase 53 (run 1) -> 19 passed / 1 failed (cross-org 404 assertion bug, see Deviations)
npm run eval -- --phase 53 (run 2) -> 20 passed / 0 failed
node -e "...nyquist_compliant: true count === 1 && status: complete..." -> OK
```

## Decisions Made

See `key-decisions` in frontmatter. Additionally: the plant/phone eval fixture extraction was a straight move (not a rewrite) so plant-home.eval.ts's own passing behaviour couldn't regress from the refactor — verified by the unchanged test bodies and the fact its two tests passed unmodified in both deployed eval runs.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The deployed eval's cross-org test asserted the wrong HTTP status for a `notFound()` outcome**
- **Found during:** Task 2, first `npm run eval -- --phase 53` run against production
- **Issue:** `expect(res?.status()).toBe(404)` failed with `Received: 200` for a real-org worker requesting the eval-site's `/m/<code>`. Investigated with a direct authenticated `fetch()` (service-role-minted session cookie, bypassing the browser and any client-side cache) which confirmed `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate` (no caching layer involved) and that the response body was genuinely the app's `src/app/not-found.tsx` boundary ("This page has moved or no longer exists.") with zero machine data present — the org-scope access control was correct throughout. Next.js serves this custom not-found boundary with HTTP 200, not 404, on `/m/[code]` (a fully-dynamic route with no static/`generateStaticParams` prerendering) — a Next.js App Router characteristic, not a Phase 53 defect. `tests/phase53/m-code-org-scope.spec.ts`'s live DB probe (part of the full-suite run, passed) had already independently proven the real security property.
- **Fix:** Replaced the status-code assertion with content assertions: the not-found page's own "PAGE NOT FOUND" text is visible, `machine-view` has count 0, and "EVAL Press" text has count 0 — for both the foreign-org code and a syntactically invalid code.
- **Files modified:** `tests/evals/phone-home.eval.ts`
- **Verification:** Re-ran the deployed eval end-to-end; the test now passes on genuine content assertions, and the underlying security property remains independently proven by the phase53 live probe.
- **Committed in:** `fd1ec3a`

---

**Total deviations:** 1 auto-fixed (1 Rule 1 test-authoring bug in the eval itself, not the product)
**Impact on plan:** No product change was needed — the access control was correct from Plan 53-03 onward. The fix corrects the eval's own assertion to test the actual security property (no data exposure) instead of an HTTP status code the project's friendly not-found page doesn't produce.

## Issues Encountered

Diagnosing the "404 became 200" failure required one direct `fetch()` probe with a minted session cookie (temporary Node script, removed before the final commit) to rule out browser caching and confirm the response body's actual content before concluding it was a status-code assumption bug rather than a real cross-org leak.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 53 (PHN-01, PHN-02, PHN-03) is fully proven on https://sopstart.com with `53-EVAL.md` as the committed UAT artefact and `53-VALIDATION.md` signed off complete.
- `tests/evals/lib/plant-fixture.ts` is now the shared eval-site fixture module for both Phase 52 and Phase 53's evals; any future eval needing the same eval-site org/EVAL Press/fixture-SOP setup should import it rather than re-implementing the upsert logic.
- The `not-found()`-serves-200 pattern is documented in CLAUDE.md Learnings for any future deployed eval that checks a `notFound()` outcome.
- No blockers for Phase 54 (admin repaint / inbox / table / lens deletion).

---
*Phase: 53-phone-scan-or-ask*
*Completed: 2026-09-29*
