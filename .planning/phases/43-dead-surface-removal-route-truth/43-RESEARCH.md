# Phase 43: Dead-Surface Removal & Route Truth - Research

**Researched:** 2026-09-30
**Domain:** Next.js 16 App Router route-tree audit — dead links, non-functional controls, orphaned redirects, doc/route drift
**Confidence:** HIGH (every finding below is either a mechanical sweep over the live tree or a manually-traced runtime path, not training-data speculation)

## Summary

This is a much smaller phase than the ROADMAP prose implies. Phases 41 and 54 already ran exhaustive, mutation-proven reference sweeps (`tests/phase41/reference-sweep.spec.ts`, `tests/phase54/deletion-sweep.spec.ts`) when they retired the Miller frame, `AdminSopSurface`, and the `/admin/sops` list surface — so the bulk of "dead surface" work the ROADMAP anticipated (orphaned Phase 41 shims, stale lenses, scope-column dead state) is **already gone**. A repo-wide mechanical href/redirect sweep found **zero dead internal links** and a live reproduction of `/pathways`'s own "not mapped" computation found **zero gaps** (39/39 routes covered in `journeys.ts`). DED-04's pathways clause is effectively already satisfied.

What's real and still open:

1. **One genuine 404-on-click bug** (DED-01/criterion 1, named explicitly in the ROADMAP): `/admin/blocks` → "New block" links to `/admin/blocks/new`, which resolves at the Next.js routing layer (matches `[blockId]`) but calls `getBlock('new')`, which returns `null`, which calls `notFound()`. This is a runtime-only failure class — a route can "resolve" and still 404. No mechanical href sweep catches this; it was found by tracing the destination page's data path.
2. **One genuine coming-soon dead end** (DED-02, named explicitly): `UploadDropzone.tsx`'s "Scan document" button opens a "Scanner coming soon" placeholder modal, while a fully-built `PhotoScanner.tsx` component (camera capture, quality checks, page reorder, IndexedDB session persistence) sits in the same directory, never imported anywhere.
3. **Two confirmed dead-state findings** (DED-03) in the named creation/list surfaces, both independently confirmed by `npm run lint`'s `@typescript-eslint/no-unused-vars` output — not just my own heuristic.
4. **Two stale route references in `.planning/codebase/ARCHITECTURE.md`** (DED-04), one of them the exact line the ROADMAP names.
5. **A real scoping tension**: the ROADMAP names `/admin/governance` as an "orphaned redirect shim" to remove, but Phase 41/54's own summaries and `journeys.ts` show both `/admin/governance` and `/admin/sops` are *deliberately* kept, zero-reference, guard-first redirect shims for legacy-bookmark compatibility — not accidents. Deleting them is a product decision (drop bookmark compat), not a bug fix. Flagged as an open question below, not resolved here.

**Primary recommendation:** Scope this phase narrowly to the concrete findings above (fix 2 dead CTAs, delete 2 confirmed-dead state blocks, fix 2 doc lines, add one dead-href lint guard) rather than the ROADMAP's broader "clean npm run build + lint" wording taken literally — `npm run lint` currently reports 549 pre-existing problems repo-wide, almost all unrelated to this phase (375 are `test.fixme()` stub-file unused-`page`-param warnings going back many phases; 34 are a newly-firing `no setState in effect` rule spread across ~30 unrelated files). Get CONTEXT.md to confirm this scoping before planning.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DED-01 | No CTA in the admin UI points at a route that does not exist | Mechanical sweep found 0 dead hrefs by routing-table match, but found 1 runtime-404 (`/admin/blocks/new`) that a routing-table match cannot catch — see § Dead-Surface Inventory 1 |
| DED-02 | No non-functional affordance ships as an enabled control | Found the exact named case (Scan document → PhotoScanner) plus one borderline case (WiringPatchBay Matrix/Illuminate) — see § Dead-Surface Inventory 2 |
| DED-03 | Orphaned redirect shims and dead state in creation surfaces are removed | Shims are NOT orphaned (deliberately kept, zero internal refs, documented) — flagged as a decision, not auto-fixed. Dead state: 2 confirmed instances — see § Dead-Surface Inventory 3-4 |
| DED-04 | journeys.ts/ARCHITECTURE.md/pathways match the real route tree | Pathways already at 0-not-mapped (reproduced mechanically). 2 ARCHITECTURE.md stale lines + 1 journeys.ts wrong action-route found — see § Dead-Surface Inventory 5 |
</phase_requirements>

## Critical Context: Sequencing Anomaly

ROADMAP says Phase 43 **depends on Phase 42** ("route truth can only be certified once routes have stopped changing — Phase 42 orphans `/admin/sops/upload`, `/admin/sops/new/ai`, and `/admin/sops/new/blank`"). **Phase 42 has not been planned or executed.** `.planning/MILESTONES.md`'s v10.0 entry confirms this explicitly: *"Carried forward: v8.0 Phase 43 (route truth) now runs against the post-54 route tree"* — i.e., Simon's decision to run 43 before 42 is already recorded project state, not something this research is guessing at.

**Concrete implication:** `/admin/sops/upload`, `/admin/sops/new/ai`, `/admin/sops/new/blank`, and the `/admin/sops/new` method picker are all still the ONLY way to create a SOP today. They are fully live, fully linked (from `TopHeader.tsx`, `AdminMachinePanel.tsx`, `src/lib/governance/inbox.ts`), and correctly documented in `journeys.ts`. **Do not plan to delete, orphan, or "converge" any of these routes in Phase 43** — that is Phase 42's job, once it exists. Phase 43 certifies the route tree **as it exists today, post-Phase-54**, not a hypothetical post-42 tree. Any ROADMAP success-criterion wording that reads as if Phase 42 already ran (the "Depends on: Phase 42" line, and the implicit assumption in "the surface merge and the creation-flow convergence") should be treated as superseded by the MILESTONES.md carry-forward note.

Also per MILESTONES.md v10.0: Phase 54 already deleted the Phase 41 Miller frame, `AdminSopSurface`, its three lenses (`AdminAttentionLens`, `AdminStatusLens`; `AdminAccessLens` **survives** — it's still live, dynamically imported into `AdminLibraryTable.tsx`), and the scope column, with its own mutation-proven reference sweep (`tests/phase54/deletion-sweep.spec.ts`, 5/5 green). **Verified against the current tree in this research, not assumed from ROADMAP prose** — see § Dead-Surface Inventory 6.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Dead-href detection (CTA → route resolution) | Browser/Client (the `href`/`onClick` is authored in client/server components) | Frontend Server (Next.js routing layer resolves the match) | The bug class spans both: a link can resolve at the routing layer and still fail in the server component's data-fetch (the `/admin/blocks/new` case) |
| Coming-soon control removal/wiring | Browser/Client | — | `UploadDropzone.tsx`/`PhotoScanner.tsx` are both `'use client'` components; no server/API change needed |
| Redirect-shim disposition | Frontend Server (Next.js `redirect()` + `next.config.ts` `redirects()`) | — | Pure routing-layer decision; no data layer involved |
| Dead-state removal (unused setters/memos) | Browser/Client | — | All confirmed instances are client-component `useState`/`useMemo` |
| Route documentation truth (`journeys.ts`, ARCHITECTURE.md) | Documentation (no runtime tier) | Frontend Server (route tree is the source of truth `journeys.ts` must match) | `journeys.ts` is itself a server-read config consumed by `/pathways`; ARCHITECTURE.md is static prose with no runtime binding |

## Dead-Surface Inventory (the actual audit)

### 1. DED-01 — the one real dead CTA: `/admin/blocks/new` 404s

- **CTA:** `src/app/(protected)/admin/blocks/page.tsx:79` — `<Link href="/admin/blocks/new">` ("New block" primary button, top of the Content Library page).
- **Destination:** `src/app/(protected)/admin/blocks/[blockId]/page.tsx` — Next.js resolves `/admin/blocks/new` into this dynamic route with `blockId: 'new'`.
- **Failure:** line 27 `const [result, categories] = await Promise.all([getBlock(blockId), listBlockCategories()])`; `getBlock('new')` (in `src/actions/blocks.ts:454`) finds no row with id `'new'` and returns falsy; line 28 `if (!result) notFound()` fires — every click on "New block" renders the Next.js not-found page.
- **This is exactly** the ROADMAP's named example: *"the Blocks-library primary CTA opens a working surface instead of 404ing."*
- **Why the mechanical href sweep (below) did not catch this:** `/admin/blocks/new` textually matches the `/admin/blocks/[blockId]` route shape (same segment count), so a routing-table-only check reports it as "resolvable." It is only a 404 because of what the destination *does* at runtime with the literal string `"new"`. **This is a distinct bug class from a dead href** — flag it explicitly in any lint-guard design (see § Recommended Lint Guard).
- **What NOT to build:** there is no existing UI form for "create a block from scratch." `createBlock()` (`src/actions/blocks.ts:119`) exists and is fully validated/auth-gated, but its only current caller is the parser pipeline (`src/lib/parsers/parsed-sop-to-layout-data.ts:788`), which auto-materializes blocks from parsed SOPs. `SaveToLibraryModal.tsx` — the closest existing UI pattern (name / category chips / free-text tags / org-vs-global scope radio) — calls a **different** action, `saveFromSection()`, which requires pre-existing step content; it cannot be reused unmodified for a blank block.
  - **Don't hand-roll:** reuse `SaveToLibraryModal`'s field layout + `createBlock()`'s existing validation/auth — do not invent a second create-block action or a second field-validation path. The one new piece is a **kind selector** (`SectionKindPicker.tsx` already exists and is used elsewhere in the block editor — reuse it, don't rebuild it), since `createBlock` requires a `kind_slug` up front.
  - Per the ROADMAP's own wording ("opens a working surface **instead of** 404ing" — no "or remove" escape hatch, unlike DED-02's Scan-document criterion), **removing the button is not an accepted resolution** for this one. It needs a real creation surface, however small.

### 2. DED-02 — the one real coming-soon dead end: Scan document → unwired `PhotoScanner`

- **Control:** `src/components/admin/UploadDropzone.tsx` — "Scan document" button (~line 549-558), `onClick={() => setScannerOpen(true)}`.
- **Dead end:** ~line 706-714, a placeholder modal: `<p>Scanner coming soon</p>` + a Close button. No camera, no upload — a literal "coming soon" string, matching the ROADMAP's own description verbatim.
- **The already-shipped component:** `src/components/admin/PhotoScanner.tsx` — 34+ lines of real capture logic (camera input, `checkImageQuality`, `detectPageNumber`, IndexedDB session persistence via `idb-keyval`, drag-reorder, discard-confirm). Its props interface is **already shape-compatible** with `UploadDropzone`'s existing state:
  ```ts
  interface PhotoScannerProps {
    open: boolean          // <- UploadDropzone already has `scannerOpen` state
    onClose: () => void    // <- UploadDropzone already has `setScannerOpen(false)`
    onSubmit: (files: File[]) => void   // <- feed into the existing upload queue
  }
  ```
  `grep -rn "PhotoScanner" src` returns exactly one file: its own definition. **It has never been imported anywhere.**
- **Fix is pure wiring, no new component work:** `import { PhotoScanner } from './PhotoScanner'`, replace the placeholder `<div>` with `<PhotoScanner open={scannerOpen} onClose={() => setScannerOpen(false)} onSubmit={...queue the returned files the same way handleFileInput does...} />`. Check `handleFileInput`'s existing file-queueing logic in the same file to match the submit shape.
- **Note:** `PhotoScanner.tsx` itself carries 2 pre-existing `no-unused-vars` warnings (`scanButtonRef` line 46, `_url` param line 81) — cosmetic, not blocking; worth a glance while wiring it in but not the point of this phase.

**Borderline second case (lower priority, flag for planner decision, don't assume it's in scope):** `src/components/admin/wiring/WiringPatchBay.tsx:882-887` — a `▦ Matrix` / `◉ Illuminate` lens toggle inside the Access map surface (reached via `/sops?view=access`, `AdminAccessLens.tsx`). Clicking either option is a **functioning** state transition (`setLens('matrix')`) that renders an honest, explicit "— coming soon, ⌇ Wiring is the shipping default" message — not a fake action, not a broken click, not a placeholder modal claiming to do something it doesn't. This differs materially from the Scan-document case. Recommend leaving as-is unless CONTEXT.md says otherwise; if DED-02 is read maximally strictly, the two options could be removed from `LENS_OPTIONS` (line 109) so only "Wiring" ever shows, but this is a judgment call, not a bug.

### 3-4. DED-03 — dead state (confirmed via `npm run lint`, not just grep)

Both of the following were independently confirmed by **actual eslint output** (`@typescript-eslint/no-unused-vars`), not just my own bare-identifier heuristic — high confidence:

- **`src/app/(protected)/admin/sops/new/blank/WizardClient.tsx:91-99`** — `sopCategoryOptions` (a `useMemo` filtering `categories` by `category_group`) is computed but never read anywhere in the component. The file's own comment at line 64-66 explains why: *"Phase 40 DUP-02: one shared metadata value (title + departments + category) state and the dead SOP-level-category state that used to sit here [was removed]."* Phase 40 removed the state this memo fed but left the memo itself behind. Delete the `useMemo` block (and check whether the `categories` prop is still needed for anything else in the file before touching its declaration).
- **`src/app/(protected)/admin/sops/[sopId]/versions/page.tsx:136-137`** — `const [selectedForCompare, setSelectedForCompare] = useState<string | null>(null)`. Neither the getter nor the setter is referenced anywhere else in the file (confirmed by both my script and eslint). The actual "Compare" link (line 584-591) uses a separately-computed `compareUrl` value instead — this state pair was superseded and never removed. Delete both the declaration and its explanatory comment ("Compare: track which version to compare against current").

**Method used (reproducible):** a bare-identifier reference count across `src/app/(protected)/admin/sops/**`, `src/app/(protected)/sops/**`, `src/components/admin/**`, `src/components/sop/**` (220 files) — any `useState`/`useMemo` binding whose name appears exactly once in its own file (the declaration itself) is dead. A looser heuristic (counting only `setterName(` call-syntax) produced 140 false-positive-heavy hits because many setters are legitimately passed by bare reference (`onClose={setDrawerOpen}`) rather than called inline — **do not use call-syntax counting alone**; require a bare word-boundary identifier count, which dropped the list to 3 true positives (the third, `sopCategoryOptions`, is the same finding counted from both angles).

**Scope note:** `npm run lint` also flags unused symbols in **27 `src/` files total**, most outside the ROADMAP's named "creation and list surfaces" (e.g., `sync-engine.ts`, `walkthrough.ts` store, several builder-v2 files). These are pre-existing and not named by DED-03's wording — flag for the planner to explicitly decide whether they're in scope, but the two above are the only ones inside the phase's own named directories.

### 5. DED-04 — route documentation truth

**`/pathways` "All screens" gap count — already zero.** I reproduced `listAppRoutes()`'s exact walk (`src/lib/journeys/routes.ts`) and `PathwaysClient.tsx`'s exact `gaps = routes.length - mapped` computation against the live tree: **39 routes, 39 mapped, 0 gaps.** This means DED-04 criterion 4's pathways clause is **already satisfied** by Phase 54's own closeout sweep — no `journeys.ts` route additions are needed for the current tree. (Confirm this is still true after whatever this phase deletes — deleting a route without deleting its `journeys.ts` step would newly break this, deleting a `journeys.ts` step for a route that still exists would also break it. Re-run the check as a verification gate, not just a one-time finding.)

One **stale value inside `journeys.ts` itself** (does not affect the gap count, since it's `type: 'action'` not `type: 'screen'`, but it's factually wrong): line 451 — `{ id: 'publish', type: 'action', label: 'Publish', route: '/admin/sops/[sopId]/publish', ... }`. The real publish endpoint is `src/app/api/sops/[sopId]/publish/route.ts` → `/api/sops/[sopId]/publish`. Fix the route string.

**`.planning/codebase/ARCHITECTURE.md` is dated 2026-06-01** (`<!-- refreshed: 2026-06-01 -->` at the top of the file) — roughly four months stale, predating Phases 30 through 54 entirely (no mention of `/governance`, `/admin/site`, `/m/[code]`, `/pathways`, plant-floor navigation, the Phase 41 surface merge, etc.). **DED-04's stated success criterion is narrow** ("no longer references routes deleted in earlier phases") — treat this as 2 targeted line edits, not a full rewrite, unless CONTEXT.md explicitly wants ARCHITECTURE.md brought current on everything (a much bigger, separate task):

- **Line 152** — *"Review → Admin views at `/admin/sops/[sopId]/review`, edits sections/steps via builder"* — this is the exact route the ROADMAP names as its DED-04 example ("removed in Phase 21.5"). **Nuance:** the URL itself still technically "works" — `next.config.ts:45-52` has a permanent `redirects()` entry (`/admin/sops/:sopId/review` → `/admin/sops/builder/:sopId`, added Phase 21 D-21-12, explicitly to preserve old bookmarks and `?from=pipeline&pipelineId=` query strings). Nothing in `src/` links to it anymore (confirmed via grep — only a historical comment in `src/lib/offline/draftLayouts-purge.ts:12` mentions the old file path). So the *route* isn't dead (it redirects successfully), but the *surface it describes* is gone — the sentence should describe the current review surface: `/admin/sops/builder/[sopId]` (the builder).
- **Line 215** — *"Protected Entry... Responsibilities: Role-based navigation (workers → `/sops`, supervisors → `/activity`, admins → `/dashboard`)"* — **wrong**. `src/lib/auth/role-home.ts`'s own header comment says explicitly: *"admin retargeted to /sops in Phase 41 SUR-01 — the SOP list is one shared route now."* `roleHome('admin')` returns `/sops`, not `/dashboard`. `/dashboard` is itself a pure redirect-only page (see § 6 below) — it is never where an admin actually lands. Fix the sentence to say `/sops`.

### 6. Existing shims verified against the live tree (not assumed from ROADMAP prose)

| Route | What it does | Anything still links to it internally? | Verdict |
|---|---|---|---|
| `src/app/(protected)/dashboard/page.tsx` | `redirect(roleHome(role))` | **Yes** — ~15+ call sites across nearly every admin/worker guard failure (`redirect('/dashboard')` on unauthorized role) | **NOT orphaned.** Load-bearing generic "no permission, bounce somewhere safe" target. `journeys.ts:62` documents it as intentional ("Redirect-only shim (UX-01 decision #5)... No UI renders here"). Do not delete. |
| `src/app/(protected)/admin/governance/page.tsx` | Guard-first `redirect('/governance')` | **No** — grep across `src/` finds zero internal references outside the file itself and its `journeys.ts:599` documentation entry | Named in ROADMAP as an example orphaned shim. **But** it was built this way *on purpose* in Phase 54 (D-01), explicitly to preserve `/admin/governance?filter=X` bookmarks. Phase 41/54's own summaries describe this pattern ("modelled byte-for-byte on the existing admin/governance shim") as the deliberate legacy-bookmark idiom, reused twice. See § Open Question 1. |
| `src/app/(protected)/admin/sops/page.tsx` | Guard-first `redirect()` preserving 7 legacy query params onto `/sops` | **No** — `tests/phase41/reference-sweep.spec.ts` (mutation-proven, pinned `EXPECTED_PERMITTED_COUNT = 2`) already asserts zero in-app code paths route through this shim; my own grep confirms the same against the current tree | Same pattern as above — explicitly built and tested to survive as bookmark-only. See § Open Question 1. |
| `next.config.ts:45-52` `redirects()` — `/admin/sops/:sopId/review` → `/admin/sops/builder/:sopId` | Config-level 308 redirect | **No** internal references (see § 5) | Same bookmark-preservation pattern, config-level rather than page-level. Not "orphaned" — intentionally kept, zero-cost (no page file, just a config array entry). |

**Verdict:** none of these three routing-layer shims are accidentally orphaned in the sense of "forgotten and broken." They are deliberately-built, documented, tested, zero-internal-reference legacy-bookmark redirects — the exact pattern Phase 41/54 used repeatedly on purpose. Whether Simon wants to keep paying that (tiny) maintenance cost for external-bookmark compatibility on an internal tool, or drop it per the "removal beats addition" house style, is a product call this research cannot make. See Open Questions.

**Phase 54's own deletion sweep** (`tests/phase54/deletion-sweep.spec.ts`, 5/5 green, mutation-proven with `stripComments`) already confirmed: `AdminSopSurface.tsx`, `sops-nav-types.ts`, `MillerPrimitives.tsx`, `AdminAttentionLens.tsx`, `AdminStatusLens.tsx`, `SopMillerBrowser.tsx`, `SopWorkerBrowser.tsx` are all deleted from the repo; `AdminAccessLens.tsx` survives and is still live (dynamically imported by `AdminLibraryTable.tsx:45-46`, reached via `/sops?view=access`). I re-verified this against the current tree — all seven files are absent, `AdminAccessLens` is present and imported. **Nothing left over from Phase 41/54 needs cleanup.**

## `npm run lint` — current baseline (run live, not assumed)

549 problems (65 errors, 484 warnings) repo-wide. Breakdown:

| Category | Count | In scope for this phase? |
|---|---|---|
| `no-unused-vars` in `tests/*.test.ts` stub files (unused `page` fixture param in `test.fixme()` scaffolds) | 375 | **No** — pre-existing pattern across many phases, deliberate stub convention, unrelated to dead CTAs |
| `no-unused-vars` in `src/` files | 27 files, ~30 warnings | **Partially** — 2 of the 27 (`WizardClient.tsx`, `versions/page.tsx`) are the confirmed DED-03 findings above; the other 25 are outside the ROADMAP's named creation/list surfaces |
| "Calling setState synchronously within an effect" (a `react-hooks` rule) | 34, across ~30 files | **No** — a systemic pre-existing pattern (mount-effect data loading) unrelated to dead surfaces; fixing it is a different, much larger phase |
| Misc (`require()` import ban in an untracked `transcripts/format-transcript.cjs`, etc.) | remainder | **No** — not tracked source under `src/` |

**Recommendation:** DED-03's "clean `npm run build` plus lint... no unused-symbol carve-outs" should be read as *"this phase's own changes don't introduce new unused-symbol warnings or eslint-disable carve-outs, and the two confirmed dead-state findings above are removed"* — not *"npm run lint reports zero problems repo-wide,"* which would silently balloon this phase into fixing ~500 unrelated pre-existing warnings across dozens of files this phase never otherwise touches. **Flag this explicitly in CONTEXT.md/discuss-phase before planning** — it's the single biggest scope-inflation risk in this phase.

No `eslint-disable` comments suppressing `no-unused-vars` exist anywhere in `src/` today (`grep -rn "eslint-disable.*no-unused-vars" src` → 0 hits) — so the "no unused-symbol carve-outs" clause is already true in the narrow sense (nobody is currently suppressing the rule to hide a violation); it just needs to stay true.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| "New block" creation form | A new create-block server action, new validation | `createBlock()` (`src/actions/blocks.ts:119`) — already exists, already Zod-validated (`CreateBlockInput`), already auth-gated, already handles both org-scoped and service-role (parser) callers | It's fully built and already the single writer of new block rows (parser uses it today); a second path would fork validation logic |
| Block kind selection in the new form | A new kind dropdown/picker | `SectionKindPicker.tsx` (`src/components/admin/SectionKindPicker.tsx`) — already exists, already used elsewhere in the block/section editing flow | Reuse over rebuild |
| Scan-document capture UI | A new camera/scan component | `PhotoScanner.tsx` — already built (camera input, quality checks, page reordering, IndexedDB session persistence), just never wired in | This is the textbook case the ROADMAP names — wiring, not building |
| Dead-href detection | A hand-written list of "known good" routes to check hrefs against | Derive the route set live from `src/app/**/page.tsx` (same walk `src/lib/journeys/routes.ts`'s `listAppRoutes()` already performs) | A hardcoded route list goes stale the moment a route is added/removed; the live walk is what `/pathways` itself already trusts |

## Recommended Lint Guard: `tests/lint/no-dead-internal-hrefs.spec.ts`

Model directly on the two idioms already in this repo (`tests/phase41/reference-sweep.spec.ts`, `tests/phase54/deletion-sweep.spec.ts`): `stripComments()` + `walkTsFiles()` + a pinned allowlist for anything intentionally exempt.

**Design:**

```ts
// 1. Build the live route set the same way src/lib/journeys/routes.ts does
//    (walk src/app/**/page.tsx, strip route groups, keep [param] segments
//    literal — do NOT normalize to '*': journeys.ts route values are also
//    literal '[sopId]' strings, so matching should be literal-vs-literal
//    with a separate dynamic-segment equivalence check).
// 2. ALSO fold in next.config.ts's redirects() sources as valid targets —
//    /admin/sops/[sopId]/review resolves via config redirect, not a page.
// 3. Walk every .tsx/.ts file under src/ (stripComments first — a comment
//    describing an old route must not trip this guard, per CLAUDE.md
//    2026-09-28 "comment quoting the forbidden literal" class).
// 4. Extract every literal-string target of: href=, router.push(,
//    router.replace(, redirect(, window.location(.href)? =.
//    Template-literal targets (`/admin/sops/${sopId}/versions`) resolve by
//    matching segment-for-segment against [param] positions.
// 5. A target is DEAD if it matches no page route AND no redirect source.
// 6. SEPARATELY (the /admin/blocks/new bug class): for every href whose
//    static segments match a [param] route with a literal non-ID-shaped
//    final segment (new/create/add/edit — reserved-word collision), flag
//    it for manual confirmation that the destination page handles that
//    literal explicitly (doesn't blindly notFound() on a failed lookup).
//    This can't be fully automated (it requires reading the destination's
//    data-fetch), but the guard can at least flag the *pattern* so a human
//    checks it — don't let this class silently regress again.
```

**Mutation-proof:** plant a `href="/admin/sops/totally-not-a-route"` somewhere in `src/`, confirm the spec goes red with the exact file:line, revert, confirm green.

**Registration:** add the filename to the `phase15-stubs` project's `testMatch` regex in `playwright.config.ts` (the established home for `tests/lint/*.spec.ts` guards, per `no-static-admin-lens-import`/`no-undefined-css-tokens`/etc. already there) — a new lint spec file that isn't added to a project regex **never runs** (CLAUDE.md 2026-05-25 learning, this repo's own prior incident). Validate with:
```
npx playwright test --list --project=phase15-stubs | grep no-dead-internal-hrefs
```

## Validation Architecture

### Test Framework
| Property | Value |
|---|---|
| Framework | Playwright 1.x (`@playwright/test`), config `playwright.config.ts` |
| Config file | `playwright.config.ts` (root `testDir: './tests'`, per-phase `project` blocks with `testMatch` regexes) |
| Quick run command | `npx playwright test --project=phase15-stubs -g "<test name>"` (lint guards) or `npx playwright test --project=phase43` once registered |
| Full suite command | `npm run test` (all projects) |
| Deployed eval command | `npm run eval -- --phase 43` (per CLAUDE.md's "Deployed-site evals" convention — this project replaces manual UAT checkpoints with this) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|---|---|---|---|---|
| DED-01 | `/admin/blocks/new` opens a working create form, not a 404 | eval (screenshot/DOM) + unit | `npm run eval -- --phase 43` (new assertion) | ❌ Wave 0 — extend or create `tests/evals/*.eval.ts` |
| DED-01 | Repo-wide dead-href sweep fails on any unresolvable internal link | lint (source-contract) | `npx playwright test --project=phase15-stubs -g "no-dead-internal-hrefs"` | ❌ Wave 0 — new `tests/lint/no-dead-internal-hrefs.spec.ts` |
| DED-02 | Scan-document button opens real `PhotoScanner`, not "coming soon" | eval + source-contract | `npm run eval -- --phase 43`; source-contract asserting `UploadDropzone.tsx` imports and renders `PhotoScanner` | ❌ Wave 0 |
| DED-03 | `sopCategoryOptions`/`selectedForCompare` dead state removed | source-contract | grep-based spec asserting the identifiers are absent from the two files | ❌ Wave 0 |
| DED-04 | `/pathways` shows 0 not-mapped | eval (already exists!) | `tests/evals/sop-surface.eval.ts` test `'E — pathways map reports zero unmapped screens'` — **reuse this, don't duplicate** | ✅ already live |
| DED-04 | ARCHITECTURE.md / journeys.ts stale-route lines fixed | source-contract | grep asserting the two stale strings (`admins → \`/dashboard\``, the old review-route sentence, the wrong publish action route) are absent | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** the relevant lint/source-contract spec for the file just touched
- **Per wave merge:** `npx playwright test --project=phase15-stubs` (or the new `phase43` project if one is registered) + re-run `tests/evals/sop-surface.eval.ts` test E to reconfirm 0-not-mapped after any route/journeys.ts edit
- **Phase gate:** full `npm run test` green, then `npm run eval -- --phase 43` against the deployed build; inspect screenshots per CLAUDE.md's "Claude READS the screenshots" rule (CSS/sizing bugs are invisible to assertions)

### Wave 0 Gaps
- [ ] `tests/lint/no-dead-internal-hrefs.spec.ts` — new repo-wide dead-href sweep (see design above)
- [ ] `tests/evals/*.eval.ts` extension — Blocks-library "New block" no-404 assertion + Scan-document → PhotoScanner assertion (extend an existing eval file rather than create a new one; no existing eval currently touches `/admin/blocks` or the upload scanner)
- [ ] Source-contract spec(s) for the two confirmed dead-state deletions and the two ARCHITECTURE.md/journeys.ts line fixes — small, can likely live in one new `tests/phase43/*.spec.ts` file per the repo's per-phase convention (`tests/phase41/`, `tests/phase54/`, etc.)

*(No gap for DED-04's pathways clause — `tests/evals/sop-surface.eval.ts` already covers it live.)*

## Bundle Gate

`scripts/check-bundle-size.ts` (wired via `postbuild`) currently gates exactly two routes: `/sops/[sopId]/page` (baseline 1048 KB) and `/sops/page` (baseline 940 KB), per `.bundle-baseline.json` (captured 2026-09-12). **None of this phase's likely touches share those routes' bundles** — `/admin/blocks`, `/admin/blocks/new`, `UploadDropzone.tsx` (reached from `/admin/sops/upload`, not `/sops`), `WizardClient.tsx`, and `versions/page.tsx` are all outside the gated routes. Per the 2026-09-29 CLAUDE.md learning ("a new route can move the bundle gate by +8 KB without adding a byte to the gated route" — shared-chunk scattering), still run a full `npm run build` after any wave that adds new client-component imports (importing `PhotoScanner` into `UploadDropzone` is exactly this kind of change) and check the postbuild output for a delta, even though the touched routes aren't nominally gated — a shared vendor chunk change can ripple. **Do not recapture `.bundle-baseline.json`** if it moves; diff the webpack chunk graph first (2026-09-13 learning: the baseline file is a decision artefact, not a tuning knob).

## Security Domain

This phase touches no auth, no RLS, no new data writes beyond the (already-validated, already-auth-gated) `createBlock()` reuse for the new-block form. `security_enforcement` is not set to `false` in `.planning/config.json`, so noting explicitly:

| ASVS Category | Applies | Standard Control |
|---|---|---|
| V2 Authentication | No | No auth surface touched |
| V4 Access Control | Marginal | The new `/admin/blocks/new` create-form must reuse the SAME `['admin','safety_manager']` guard pattern already present at the top of every sibling page in this directory (`getSessionContext()` → `redirect('/login')` → role check → `redirect('/dashboard')`) — don't invent a new guard shape |
| V5 Input Validation | Yes (inherited) | `createBlock()`'s existing `CreateBlockInput` Zod schema + `BlockContentSchema.parse()` already validate; the new form just needs to submit a shape that schema accepts |

No new threat surface — this is UI wiring over existing validated/gated server actions.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | `/admin/governance` and `/admin/sops` should be KEPT (not deleted) as intentional bookmark shims, contrary to the ROADMAP's literal "orphaned shim" wording | § Dead-Surface Inventory 6, Open Questions | If Simon actually wants bookmark compat dropped, the planner should delete both page files + their `journeys.ts`/`next.config.ts` entries instead — small either way, but the two paths produce different diffs |
| A2 | DED-03's "clean lint" clause should be scoped to this phase's own changes, not the pre-existing 549 repo-wide problems | § npm run lint baseline | If Simon wants literal zero-warnings, this phase balloons into an unrelated ~30-file cleanup unrelated to dead CTAs — should be confirmed, not assumed, before planning |
| A3 | The WiringPatchBay Matrix/Illuminate "coming soon" toggle does NOT need fixing under DED-02 (it's an honest state, not a placebo action) | § Dead-Surface Inventory 2 | Low risk either way — removing the two options from `LENS_OPTIONS` is a 2-line change if the planner disagrees |

## Open Questions

1. **Should `/admin/governance`, `/admin/sops`, and the `next.config.ts` `/admin/sops/:sopId/review` redirect be deleted, or kept as intentional bookmark compatibility?**
   - What we know: all three are zero-internal-reference, guard-first (or config-level), and were built *on purpose* by Phase 41/54 specifically to preserve old bookmarks — not accidental leftovers. `journeys.ts` marks the first two "(optional)" screens.
   - What's unclear: whether "orphaned" in the ROADMAP's DED-03 wording means "nothing references it" (true, but intentional) or "forgotten/accidental" (false — these are deliberate and tested).
   - Recommendation: surface this explicitly in `/gsd-discuss-phase` before planning. If Simon says "delete them" (matches "removal beats addition" house style, internal tool with a small known user base), it's a small, low-risk diff (delete 2 page files + the `next.config.ts` redirect entry + their `journeys.ts` steps + update `tests/phase41/reference-sweep.spec.ts`'s `PERMITTED_FILES` set, `tests/phase54/deletion-sweep.spec.ts`'s equivalent). If he says "keep them," DED-03's shim clause for this phase is simply satisfied as "verified intentional, no action" and the phase's DED-03 work reduces to the 2 confirmed dead-state deletions.

2. **How literally should "clean `npm run build` plus lint" be read?**
   - What we know: 549 pre-existing lint problems repo-wide, 27 files in `src/` (2 inside this phase's named scope), a systemic `no setState in effect` rule firing on ~30 unrelated files.
   - What's unclear: whether this is a pass/fail gate on the CURRENT lint count, or a "don't make it worse" gate.
   - Recommendation: scope to "no NEW warnings from this phase's changes, plus the 2 confirmed dead-state deletions" — confirm in CONTEXT.md.

## Sources

### Primary (HIGH confidence — read directly from the live repo in this session)
- `src/app/**/page.tsx`, `src/app/**/route.ts` — live route tree walk (39 page routes enumerated)
- `next.config.ts` — `redirects()` config, webpack chunk-pinning comments
- `src/lib/journeys/journeys.ts`, `src/lib/journeys/routes.ts`, `src/app/(protected)/pathways/PathwaysClient.tsx` — reproduced the exact "not mapped" computation
- `.planning/codebase/ARCHITECTURE.md` — read in full for stale route references
- `.planning/phases/41-one-sop-surface/*-SUMMARY.md`, `.planning/phases/54-*/​*-SUMMARY.md` — deletion/shim provenance
- `.planning/MILESTONES.md` v10.0 section — the Phase 42/43 sequencing carve-out
- `tests/phase30/dead-weight.spec.ts`, `tests/phase41/reference-sweep.spec.ts`, `tests/phase54/deletion-sweep.spec.ts` — existing sweep idioms
- `npm run lint` — run live in this session, full output captured and categorized
- `.tsc-out.txt` (repo root, untracked) — **found to be STALE** (predates Phase 51/53/54 routes — missing `/governance`, `/admin/site`, `/m/[code]` from its build output). Do not treat as current; the planner should get a fresh build log if one is needed.

### Secondary (MEDIUM confidence)
- None — every claim above was verified directly against the live tree or existing test output rather than inferred.

## Metadata

**Confidence breakdown:**
- Dead-href inventory: HIGH — mechanical sweep of every href/router.push/redirect literal in `src/`, cross-checked against a live route-tree walk
- Coming-soon/dead-CTA findings: HIGH — traced to exact file:line, runtime behavior confirmed by reading the destination's data-fetch code
- Dead-state findings: HIGH — cross-confirmed by both a custom script and live `npm run lint` output
- Shim disposition (Open Question 1): MEDIUM — technical facts are HIGH confidence, but the recommended disposition is a product judgment call, correctly flagged as such
- Pathways/ARCHITECTURE.md staleness: HIGH — reproduced the exact live computation, not estimated

**Research date:** 2026-09-30
**Valid until:** Until the next phase that touches routes (Phase 42, whenever it runs) — the route tree and pathways gap count should be re-verified at that point, not assumed stable. Everything else (dead-state findings, lint baseline) is stable until someone else edits the same files.
