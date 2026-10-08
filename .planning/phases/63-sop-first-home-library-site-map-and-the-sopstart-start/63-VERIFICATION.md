---
phase: 63-sop-first-home-library-site-map-and-the-sopstart-start
verified: 2026-10-08T00:00:00Z
status: gaps_found
score: 15/17 requirements verified clean; 2 with minor gaps (WORD-01, HOME-02); phase goal achieved
overrides_applied: 0
gaps:
  - truth: "WORD-01: 'Walk', 'Walk it', 'walkthrough' and 'Show me' appear on no screen"
    status: partial
    reason: "'Show me' still renders in the editor's AI findings (AiCheckBanner.tsx:102), allowlisted in tests/lint/no-walk-words.spec.ts. The requirement text has no exception, so it is ticked against its own wording."
    artifacts:
      - path: "src/components/focus/admin/AiCheckBanner.tsx"
        issue: "line 102 renders 'Show me'"
    missing:
      - "Rename the button (e.g. 'Go to it') and drop the allowlist entry, OR amend WORD-01 to say 'Show me as a start/read label'"
  - truth: "Retired room-era copy 'Back to the site' is gone (63-13 RETIRED inventory token)"
    status: partial
    reason: "SentPanel still renders 'Back to the site' on the post-send screen. The home is not 'the site' any more (63-12 / 63-14 / 63-16 summaries flagged this wording; CompletionList was fixed, SentPanel was not). No guard covers it."
    artifacts:
      - path: "src/components/focus/SentPanel.tsx"
        issue: "line 20 'Back to the site'; button calls useFocusGoBack"
    missing:
      - "Change the label to 'Back' (or 'Back to My SOPs'); add 'Back to the site' to tests/lint/no-rooms.spec.ts or no-walk-words so it cannot return"
  - truth: "HOME-02: search covers titles, steps and tools"
    status: partial
    reason: "Tool search is `required_tools.cs.{term}` (src/hooks/useSopSearch.ts:35): exact, case-sensitive element match, while step text uses ilike. Typing 'torque' will not find 'Torque wrench'. Proven by source-contract only; no deployed fixture carries a tool."
    artifacts:
      - path: "src/hooks/useSopSearch.ts"
        issue: "exact-name array contains, no behavioural proof"
    missing:
      - "Either match tools case-insensitively / by substring (e.g. unnest in a small view) or state the exact-name limit in the placeholder; add one tool to an eval fixture SOP and assert a hit"
  - truth: "DOCS-01: CLAUDE.md describes the SOP-first home"
    status: partial
    reason: "CLAUDE.md Key Directories still says src/components/sop/ holds the 'plant stage' (deleted in 63-20) and does not list src/components/home/ or src/lib/library/; the route-structure block still lists /activity and admin pages that now redirect."
    artifacts:
      - path: "CLAUDE.md"
        issue: "lines ~40-46 stale"
    missing:
      - "One-line edits: src/components/home/ (shell, list, Read, sections, map), src/lib/library/ (areas, type, iso layout), src/components/brand/Wordmark; drop 'plant stage'"
deferred: []
human_verification:
  - test: "Decide the department colour swatches"
    expected: "Retire them, or feed departments.colour to the map. Today the home dot and the map use --area-N by name order, so the eight swatches under each department in Manage > Site & departments change nothing the home shows (63-EVAL Open 2)."
    why_human: "Product call, ADR-0005 rule 2 puts the map on --area-* tokens; either answer is defensible."
  - test: "Run the invite leg once in a quiet mailer hour"
    expected: "`EVAL_BASE_URL=https://sopstart.com npx playwright test --project=evals --workers=1 --retries=0 tests/evals/office.eval.ts -g 'people: full width'`"
    why_human: "Environment limit (email rate limit), unproven in 63-18 and 63-21; not a product failure."
---

# Phase 63 Verification Report

**Goal:** SOP-first Home, Library Site Map and the SOPstart Start (sketch 009 A, sketch 010, ADR-0004).
**Verified:** 2026-10-08 on master HEAD `c816079e`. Initial verification.
**Status:** gaps_found. The goal is achieved; the gaps are small copy and proof items.

## Independent runs

| Check | Command | Result |
|---|---|---|
| Guards: no-rooms, no-walk-words, design-principles, no-global-blocks-in-journeys | `npx playwright test --project=phase15-stubs <four specs>` | 9 / 9 pass |
| Phase 63 project | `npx playwright test --project=phase63` | 112 / 112 pass |
| Routes in journeys.ts | all 20 `page.tsx` routes compared with `journeys.ts` | 20 / 20 named (the two dynamic ones, `/sops/[sopId]` and `/activity/[completionId]`, at journeys.ts:132, 205) |
| Eval evidence | 63-EVAL.md: 98 / 98 deployed cases at `07a9f65c`; I read `63-home-worker-desktop`, `63-real-org-map`, `63-home-phone-map` | match the claims (see below) |

Not re-run by me: `npm run build` / the bundle gate and the deployed eval (the summary's numbers: 802 / 832; baseline file diff shows only the two recorded orchestrator moves).

## CONTEXT decisions and R1-R9

| Decision | Evidence | Status |
|---|---|---|
| No Next-for-you, due queue or numbered bell on home | grep of `src/components/home`, `src/lib/library`, `src/lib/shell` for next-for-you / due / overdue: no UI hits. Bell is a dot only (`NotificationBell.tsx:64`, `shell-bell-dot`; aria "Notifications, unread") | VERIFIED |
| No room words, no "walk" on screen | `no-rooms` and `no-walk-words` registered at playwright.config.ts:40, both green, both self-prove on fixtures. My own grep found only "Show me" (gap 1) and "Back to the site" (gap 2) | VERIFIED with 2 gaps |
| Map: one object per SOP; areas per R8 | `src/lib/library/areas.ts` `areaOf` / `buildAreas`: machine department, then first department tag, then Site-wide; areas exist only when they hold a visible SOP. Real-org shot: Engineering 1, Forming 2, General 1 matches the plate counts and objects | VERIFIED |
| R2 gates unchanged | `home-state.ts` `sectionsForRole`: worker [sops, record]; supervisor +signoffs; admin / safety_manager all. `git diff` of `guards.ts` and `supabase/migrations` across the phase is empty. Matrix row 54 says Training mounts for admin and safety manager only | VERIFIED |
| R1 machine-coverage producer gone | `no-rooms` bans `reconcileMachineRequests` and `machine-requests.ts` in src; the module file is asserted absent | VERIFIED |
| R3 types / R4 owner hidden for workers | `getSopOwner` returns `Not allowed` before any read unless role is supervisor / admin / safety_manager (`sop-owner.ts:15-22`); ReadView enables the query only for those roles (`ReadView.tsx:62-73`); matrix row 66 added | VERIFIED |
| R5 bell dot, no number | as above | VERIFIED |
| R6 begin-from-step-1 confirms | `63-fuse-begin-again` dialog read by executor; unchanged component | VERIFIED (eval) |
| R7 site editor in Manage | `63-home-site-fold` / `-manage` shots; `ManageSection.tsx` | VERIFIED (eval) |
| R9 merge crosses navigation, no server action in click | `<div id="fuse-layer">` in root `src/app/layout.tsx:35`; `ReadView.onStart` runs `playFuse(...).then(go)`; `go` is `router.push` (waits for in-flight queries); no action imported in the click path; `focusHref(..., { go: true })` autostart | VERIFIED |
| Reduced motion cuts | Map: `SiteMap.tsx:130` sets the viewBox directly when `prefers-reduced-motion`; Start: `motionMode() === 'off'` skips `playFuse`, and `63-fuse-reduced` shows nothing left in the layer | VERIFIED (map by code read only) |
| Wordmark | `<Wordmark>` in auth layout, SectionMenu, FocusTopBar, ReadView, PromoReel; `brand-yellow` appears only in the annotation tools and in a comment | VERIFIED |

## ADR rules

| Rule | Evidence | Status |
|---|---|---|
| ADR-0005 `Supersedes: ADR-0003` | `docs/adr/0005-library-map-replaces-rooms.md` | VERIFIED |
| ADR-0003 decision text untouched | `git show 7c40f131 -- docs/adr/0003-site-templates.md`: one line changed, `Status: Accepted` to `Superseded by ADR-0005` | VERIFIED |
| README index | rows 0003 (Superseded) and 0005 (Enforced by `no-rooms.spec.ts`); `no-rooms` asserts both | VERIFIED |
| Guard registered and mutation-proven | registered (playwright.config.ts:40), runs green; the third test is an inline-fixture self-proof; mutation proof is claimed in the 63-20 commit message and ran green here | VERIFIED |

## Requirements

All 17 IDs ticked, with real evidence for 15. The two the executor flagged:

- **HOME-02**: tool search is weaker than the requirement reads (gap 3). Title and step search are proven by deployed eval.
- **MAP-03**: reduced-motion cut is correct in code (line 130) and I confirmed it by reading; no deployed proof, acceptable.

Also **WORD-01** (gaps 1 and 2) and **DOCS-01** (gap 4, stale CLAUDE.md prose; journeys, UAT, matrix, ADR line and sketch-skill banner are all current).

## Gate numbers

`.bundle-baseline.json` changed only in `ea06e878` (63-04, 834 to 837) and `678b9589` (63-11, 795 to 802 and 837 to 831), both labelled orchestrator decisions and recorded in the ROADMAP "Bundle decisions" line. Final reading 802 / 832 sits within tolerance (+0, +1); no executor re-capture.

## Anti-patterns

Debt-marker scan (TBD, FIXME, XXX, TODO, HACK, PLACEHOLDER) over all 131 `src` files changed in the phase: none. Retired code is gone (`src/components/sop/plant/`, `rooms.ts`, shells). Leftovers: the two copy items above; `tests/phase26/konva-worker-isolation.spec.ts` has a dead self-skipping case (cosmetic, already recorded); department swatches inert (human item).

## Gaps summary

Nothing blocks the goal: the home, map, wordmark, Start merge and retirement of rooms are all in the code and proven on the deploy. Fix round, all small:

1. SentPanel "Back to the site", and add a guard token. (Low)
2. "Show me" in AiCheckBanner, or amend WORD-01. (Low)
3. Tool search exact-match, add a fixture tool and assertion. (Low-medium, the only functional weakness)
4. CLAUDE.md Key Directories prose. (Low)

_Verifier: Claude (gsd-verifier)_

## Gap closure (orchestrator, 2026-10-08)
- Gap 1 fixed: SentPanel reads "Back".
- Gap 2 fixed: AiCheckBanner reads "Go to it"; the no-walk-words allowlist entry is removed; tests/phase58/parse-progress-ui.spec.ts repointed.
- Gap 4 fixed: CLAUDE.md Key Directories names src/components/home, src/lib/library and the Wordmark; "plant stage" removed.
- Gap 3 open (accepted limit, reported to Simon): tool search matches an exact tool name (array containment); step text matches by substring.
- Open for Simon: department colour swatches vs the map's --area-N colours; one quiet-hour run of the office invite leg.
