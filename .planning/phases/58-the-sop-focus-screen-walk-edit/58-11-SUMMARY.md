---
phase: 58-the-sop-focus-screen-walk-edit
plan: 11
subsystem: focus-walk
tags: [walk, focus-page, proxy-redirect, bundle-gate, evals, journeys]
requires: [58-02, 58-09, 58-10]
provides:
  - "src/app/(protected)/sops/[sopId]/page.tsx: server resolver (resolveFocusTarget -> redirect / notFound / open) rendering FocusWalker; no mount effect"
  - "src/hooks/useWalk.ts: walk state keyed to the SOP / server walk id over startWalk / recordWalkStep / startOverWalk"
  - "src/components/focus/{WalkStep,ReviewAndSend,SentPanel,ResumeCard,FocusWalker}.tsx"
  - "proxy: /sops/<uuid>?tab=read|walk 307 to the bare focus address; placeForPath null on /sops/*"
  - "tests/evals/sop-focus.eval.ts worker half (SC1, SC2, SC5 addresses / Back / phone)"
affects: [58-12, 58-13, 58-14, 58-15, 58-16, 58-18]
requirements-completed: []
key-files:
  created:
    - src/hooks/useWalk.ts
    - src/components/focus/WalkStep.tsx
    - src/components/focus/ReviewAndSend.tsx
    - src/components/focus/SentPanel.tsx
    - src/components/focus/ResumeCard.tsx
    - src/components/focus/FocusWalker.tsx
  modified:
    - "src/app/(protected)/sops/[sopId]/page.tsx"
    - "src/app/(protected)/sops/[sopId]/loading.tsx"
    - src/lib/shell/place.ts
    - src/lib/supabase/middleware.ts
    - src/lib/journeys/journeys.ts
    - src/lib/sop/focus-read.ts
    - src/hooks/useStepPhotos.ts
    - src/hooks/useFocusBack.ts
    - src/components/focus/{FocusFrame,FocusRail,KindChip,BrowseDocument}.tsx
    - scripts/check-bundle-size.ts
    - .bundle-baseline.json
  deleted:
    - tests/evals/sop-detail.eval.ts
decisions:
  - "FocusWalker (client) composes the frame with useWalk: a server page cannot hold browse / walk / review / sent state, and the frame stays free of SOP data props"
  - "A worker with a walk in progress on a superseded version sees it as live (resume works); Start over moves them to the latest published version"
  - "The photo button and hint read 'Add a photo' / 'Add a photo to continue.' because the Phase 55 photo-scan sweep bans the other wording in src/ and tests/ (same as 58-09's error text)"
completed: 2026-10-05
---

# Phase 58 Plan 11: Walk and the focus page Summary

**A worker opens a SOP into a screen that holds only that SOP, walks it one step at a time with the server enforcing acknowledgements and photos, reviews, sends it for sign-off and goes Back to the place they came from.**

FOC-01 / FOC-03 / FOC-04 / SOP-04 are not ticked: the proof is the deployed eval, which 58-18 runs.

## Commits

| Task | Commit | What |
|------|--------|------|
| 1 | `9dcc24c3` | useWalk, WalkStep, ReviewAndSend, SentPanel, ResumeCard, FocusWalker, rail rows and hollow dots, walk-no-leak spec |
| 2 | `22c24f3d` | server page + loading skeleton, `placeForPath` null on `/sops/*`, proxy tab redirect, journeys, page-half specs, five stale guards repointed |
| 2b | `d44c01e2` | machine department and section standards stay visible (also carries the `git rm` of `sop-detail.eval.ts`) |
| 3 | `2466021a` | sop-focus eval worker half, three evals repointed, bundle script + baseline, inventory `58-11` live |

## What was built

- **Page**: server component. Loads the requested row and its flat lineage with the session client, the worker's own `in_progress` walks and completions, then `resolveFocusTarget` decides. Draft or unknown is `notFound()`, an older version redirects to the live one (or to the in-progress walk's version, D-12), admins open the exact row. Passes `FocusWalker` a `key` of `<sop id>:<walk id>` so a different walk or SOP is a fresh instance.
- **useWalk**: `useState` only, reset in render when the SOP or server walk id changes (no store, no persisted cache, no effects). Every press writes first and the screen moves only from the walk the server returns. Step changes sync `?step=` with `history.replaceState`. `router.push` appears once, in the Start-over handler when the latest version has a different id.
- **WalkStep**: progress, group label, kind chip + standards, 28 px text (focused on change, `aria-live` announcement), hazard / PPE card, tip, images, photo button then thumbnail + Retake, one 60 px primary (labels only from `primaryLabel`; "last" means finishing this step finishes the walk), Previous, Enter / left arrow keys, sticky dock below `lg`.
- **ReviewAndSend / SentPanel / ResumeCard**: grouped review with acknowledgements and photos, missing items listed with the helper sentence and Send disabled, `submitCompletion({ walkId })`; one-line sent panel whose button is the frame's Back (via a new `FocusBackContext`); resume card with a Start over dialog registered in the overlay registry so Esc closes it first.
- **Rail**: done (ticked, clickable), current, locked (`aria-disabled`), hollow kind dots for unacknowledged hazard / PPE when jumping ahead.
- **Proxy**: `/sops/<uuid>?tab=read|walk` 307 to the bare address through `legacyRedirectFor` (UUID-gated, `from` re-encoded by the whitelist), cookies copied, after the sign-in gate.
- **journeys.ts**: the two worker flows now describe the focus screen (open from machine / Noticeboard / Now card, browse, Start walking, hazard / PPE / photo steps, review, Send for sign-off, Back to the place). All routes are real.

## Bundle gate (`npm run build`, exit 0)

```
check-bundle-size: /sops/[sopId]/page = 794 KB (baseline 794 KB, delta 0 KB, tolerance +/-2 KB)
check-bundle-size: /page = 832 KB (baseline 831 KB, delta +1 KB, tolerance +/-2 KB)
check-bundle-size: Bundle isolation OK (delta within tolerance, no forbidden marker in a gated route)
```

- **Baseline decision**: `/sops/[sopId]/page` measured 794 (below 795), so it was moved DOWN by hand to 794 with a history entry, as the plan allows. `/page` untouched. No UP move.
- **Known blind spot, unchanged**: the gate sums shared chunks only. The route's own page chunk (`static/chunks/app/(protected)/sops/[sopId]/page-*.js`, 37 KB raw) is not counted because its URL-encoded path is missed, so neither the old tabs leaving nor the walk arriving moves the number. Recorded in the history note. Closing it needs a signed-off baseline change.
- **Bundle script change (Rule 3)**: the build failed after the page swap on the Route-A-only check "DesktopWalkthrough must exist as its own lazy chunk". The old walkthrough is no longer reachable, so the chunk is gone from the build; that absence from the route is exactly what the marker gate proves. The positive check is removed with a comment. The forbidden markers (pdfjs, mammoth, konva, machine body) and marker self-validation are unchanged. 58-13 adds the lazy FocusEditor seam and should add its own positive marker.

## Compiled CSS (`.next/static/css`)

`text-step`, `max-w-205`, `w-75`, `size-18`, `bg-accent-signoff`: each found (1 file each). The eval also asserts it against the deployed stylesheet.

## Guard sweep hits

| File | Hit | Now |
|------|-----|-----|
| tests/phase57/place.spec.ts | `placeForPath('/sops/abc')` expected `/` | null for `/sops/*` (new case) |
| tests/phase58/frame-structure.spec.ts | placeForPath fixme | live, plus page and walker structure cases |
| tests/phase30/tab-merge.spec.ts | page mounts `WalkthroughSwitcher` | asserts the page mounts no old walkthrough (spec is a 58-16 delete) |
| tests/phase41/nav-and-shim.spec.ts | page keeps an "Edit in builder" destination | asserts the focus page adds no second builder chain |
| tests/phase41/reference-sweep.spec.ts | page contains `/admin/sops/builder/` | line removed |
| tests/phase56/placement.spec.ts | page carries placement line + labels | repointed at `BrowseDocument.tsx` (which now carries `sop-meta` and the labels); 58-12 still owns the rest of that spec |
| tests/phase53/login-next-redirect.spec.ts | `?tab=walk` literal | `?from=office` |
| tests/evals/one-screen.eval.ts | `back-to-site` visible on a SOP page (2x) | focus frame visible, `back-to-site` count 0 |
| tests/evals/cut-features.eval.ts | old walk-with-photo case | focus walk on a phone |
| tests/evals/sop-ledger.eval.ts | B (old page half), C (Read heading / walk labels), D | B and C on browse; D unchanged and still valid (placement line carries the department) |
| tests/evals/sop-detail.eval.ts | whole file | deleted; its real-org "OTG opens" check lives in sop-focus |

## Eval cases added (`tests/evals/sop-focus.eval.ts`, listed with `--list --project=evals`, not run)

SC1 frame (opened from a machine; rail 300, column 820, no shell / inbox / notification testids; shot `58-browse-worker`), SC1 compiled CSS, SC1 real-org OTG browse (read-only); SC2 walk twice in one session with the photo, locked rail, review, Send, sent, Back to the machine (`58-walk-hazard`, `58-walk-ppe`, `58-walk-photo-required`, `58-walk-locked-rail`, `58-review`, `58-sent`, `58-back-place`) and a two-completion / one-photo-each DB check; SC2 resume + Esc on the Start over dialog + Start over (`58-resume`); SC2 jump-ahead (`58-walk-jump-on`); SC5 tab redirect, superseded v2 to v3, draft v4 never opens, draft-only not found by rendered content; SC5 phone walk and rail sheet (`58-phone-walk`, `58-phone-rail`). SC3, SC4 and the admin superseded case stay `test.fixme` for 58-13 / 58-14 / 58-17.

## Verification

- `npx tsc --noEmit` clean. `npm run build` exit 0.
- Green: phase58 (121), phase57 (118), phase55 (134 + sweep), phase53, phase52, phase54, phase41, phase30, phase56, phase28, phase29, phase26.5, phase32, phase35, phase36, phase37, phase40, phase43, phase15-stubs (80, includes design-tokens, no-undefined-css-tokens, no-dead-internal-hrefs).
- Still red, not mine, from `deferred-items.md`: `phase26` `ai-overlay` and `visual-block` (both 58-16 deletes). The `phase55` photo-scan item in that file is cleared (the `sop-focus.eval.ts` title was reworded earlier); my first `walk-no-leak` draft quoted the banned literal and was fixed in the same task.
- Deployed evals were authored and listed only; 58-18 runs them after deploy.

## Deviations from Plan

**1. [Rule 3 - blocking] New `FocusWalker.tsx`.** The plan has the server page render `<FocusFrame mode 'browse'>` and the frame own browse / walk / review / sent. A server component cannot hold that state and the frame stays data-free (58-10), so a client composition component holds `useWalk` and picks the body. `FocusFrame` gained the `sent` mode, `hollowDot`, and a `FocusBackContext` for the sent panel's button.

**2. [Rule 3 - blocking] Photo wording.** "Take a photo" and "Take a photo to continue." (UI-SPEC) are banned by the Phase 55 photo-scan sweep. The button is "Add a photo", the hint "Add a photo to continue." (matches 58-09's server error).

**3. [Rule 3 - blocking] `scripts/check-bundle-size.ts`.** See Bundle gate. Not in the plan's file list; the build exited 1 without it.

**4. [Rule 1/3] `useStepPhotos.addPhoto` now returns `{ localId, path } | null`** so the walk can record the photo it just uploaded. The old walkthrough ignores the value.

**5. [Rule 2] Standards and placement survive the swap.** The old page header showed the placement line and standard labels (Phase 56 specs and the ledger eval cover them). `loadFocusSop` machines now carry the department; browse shows the placement line, SOP labels and section labels; the walk shows section labels beside the group label. The SOP-level label on the walk itself is not shown (step-level and section-level are), so sop-ledger C no longer asserts it there.

**6. Fixture note.** The walk fixture is on no machine (CLAUDE.md shared-fixture rule), so the machine-origin walk is a direct address with `?from=<EVAL Press id>`; the machine-row click is proved with the plant fixture SOP.

**7. Admin entry.** The old page's "Edit in builder" link and the admin preview toggle are gone with the tabs. An admin opening a SOP gets browse state; the Walk / Edit switch (58-13) and admin Edit links (58-14) are the replacements. SUR-04 was repointed to say the focus page adds no second builder chain.

**8. Eval hygiene.** `deleteEvalCompletions` also removes `sop_walks` for the SOP so an in-progress walk from one run cannot show a resume card in the next. The `sop-detail.eval.ts` deletion landed in `d44c01e2` (it was already staged when that commit ran).

## Known Stubs

None.

## Threat Flags

None new. T-58-draft: resolver on the server (non-admin never opens a draft; spec asserts the role check); T-58-redirect: UUID-gated fixed templates, cookies copied; T-58-from: Back and the superseded link go through the place whitelist; T-58-walk: UI blocks, server refuses (58-09); T-58-21: no router call in any effect (specs assert for the page, hook and components); T-58-bundle: focus files import no shell, plant or admin module and the forbidden markers still pass.

## Self-Check: PASSED

- Created files exist: `src/hooks/useWalk.ts`, `WalkStep.tsx`, `ReviewAndSend.tsx`, `SentPanel.tsx`, `ResumeCard.tsx`, `FocusWalker.tsx`; `tests/evals/sop-detail.eval.ts` is gone.
- Commits `9dcc24c3`, `22c24f3d`, `d44c01e2`, `2466021a` exist.
- Acceptance greps: page has no `use client` and no `useEffect`; `resolveFocusTarget(` in the page; `legacyRedirectFor(` in the proxy; `'/sops/'` in `place.ts`; `submitCompletion({ walkId` in ReviewAndSend; no `completionStore` in `src/components/focus` or `useWalk.ts`.
