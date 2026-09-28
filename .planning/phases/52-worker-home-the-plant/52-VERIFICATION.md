---
phase: 52-worker-home-the-plant
verified: 2026-09-29T15:11:00Z
status: passed
score: 6/6 roadmap success criteria verified, 6/6 HOM requirements verified
overrides_applied: 0
---

# Phase 52: Worker Home — The Plant Verification Report

**Phase Goal:** A worker on a desktop opens SOPs and is standing above their site. What they owe is a pin on a machine and one Now card; a procedure is one click on the machine it belongs to.
**Verified:** 2026-09-29
**Status:** passed
**Re-verification:** No — initial verification

This verification reads the code directly (not SUMMARY.md prose), runs the relevant Playwright projects, runs a clean `npx tsc --noEmit` and a clean `npm run build`, and inspects the deployed-eval screenshots pixel-by-pixel. Every claim below is backed by a file:line reference or a command transcript captured during this session.

## Goal Achievement — ROADMAP Success Criteria

| # | Success Criterion | Status | Evidence |
|---|---|---|---|
| 1 | `/sops` for a worker at ≥1024px renders the scene with drag-pan, wheel zoom-to-cursor, department chips that fly the camera, hoverable machine labels; scope column and Miller frame do not render for workers | ✓ VERIFIED | `src/app/(protected)/sops/page.tsx:129-140` gates `plantSite` on `!isAdmin && viewport==='desktop' && layout && machines.length>0`; render slot at `page.tsx:585` (`if (plant && onQueryChange) return <PlantHome .../>`) bypasses the Miller frame (`workerScopeColumn`, `data-testid="worker-miller-scope"`) entirely. `PlantStage.tsx:186-195` non-passive wheel→`zoomAt`; `197-216` pointer-drag pan; `PlantHome.tsx:143-158` department chips call `pickZone`→`fitMachines`. Confirmed live in `plant-home.png` / `plant-home-zone.png` screenshots (scene, pin, ask bar, no scope column visible). `PlantHome` loaded via `next/dynamic({ssr:false})` (`page.tsx:60-63`), the ONLY reference — `tests/phase52/plant-render-seam.spec.ts` asserts this and passed (below). |
| 2 | Pins derived from existing assignment/completion/cadence data; amber count = due/never/updated for that worker; source-contract test pins no new table/store backs the count | ✓ VERIFIED | `src/lib/sop/worker-signal.ts:85-102` `derivePlantPins` is a pure function over `WorkerSop[]` (already computed by `SopsSection`'s `useAssignedSops`/refresher/version-currency logic, `page.tsx:524-556`) — no fetch, no Dexie, no Date.now(). Grepped `supabase/migrations/*.sql` newer than `00067_site_model.sql`: **none exist** (00067 is the newest). Grepped `src/stores/` (`completionStore.ts`, `network.ts`, `preview.ts`, `walkthrough.ts`, `walkthroughMode.ts`) and `src/lib/offline/db.ts` for `pin`/`plant`: no hits except an unrelated `layout_version` comment. `tests/phase52/plant-pins-no-storage.spec.ts` is a live (non-fixme) source-contract test enforcing exactly this. |
| 3 | Now card shows due-first next procedure with Walk it / Show me; org with no scene sees the existing list, never blank | ✓ VERIFIED | `NowCard.tsx:29-97` renders `items[0]`, `Walk it` is a real `next/link` `Link` to `/sops/${now.sop.id}?tab=walk` (line 68-74), `Show me` calls `onShowMe(machine.id)` (line 76-84) which `PlantHome.tsx:95-98`'s `open()` wires to `stageRef.current?.flyTo`. Ordering (`pickNowQueue`, due→never→new) lives solely in `worker-signal.ts:144-169`; `NowCard` never classifies. Fallback: `page.tsx:137-140` resolves `plantSite=null` whenever layout/machines are absent — `SopsSection` then renders the unmodified Miller frame (D-04). Live screenshot `plant-home-fallback.png` shows the classic Miller "All yours / Library / By department" list for `eval-worker` (no site) — confirms never-blank. |
| 4 | Clicking a machine flies to it (panel never covers it), opens panel: sprite or "no photo yet", department in zone colour, SOPs to-do first with shared badges, Walk it per row | ✓ VERIFIED | `scene.ts:174-181` `flyToView` targets `targetX=(W-PLANT_PANEL_WIDTH)/2` with `PLANT_PANEL_WIDTH=380` (line 166). `MachinePanel.tsx:44-55` sprite `<img>` or "no photo yet" span; `68-72` department name in `style={{color: department.colour}}`; `75-105` SOPs rendered in the order the caller (`machineSops`/`compareToDoFirst`) hands them, each row with `RelBadge` (shared `plant/RelBadge.tsx`) and a `Walk ›` `Link` to `/sops/${sop.id}?tab=walk`. Confirmed live in `plant-home-panel.png` (sprite placeholder "no photo yet", "FORMING" department label, "Eval plant fixture SOP" row with red "NEVER DONE" badge and "Walk ›"). |
| 5 | Typing in ask bar highlights matching machines/SOPs live; mic routes into existing voice Q&A | ✓ VERIFIED | `worker-signal.ts:178-198` `askMatches` (machine name or any linked SOP title); `PlantHome.tsx:49` feeds `PlantStage`'s `highlighted` prop live off `query` state (no debounce/router hop). `PlantAskBar.tsx:15-21` imports `WalkthroughVoiceModal` via `next/dynamic({ssr:false})` — the SAME component the existing walkthrough voice Q&A uses (`WalkthroughSwitcher.tsx` is the other sanctioned site). `tests/lint/no-static-desktop-import.spec.ts` (run below) passed, confirming exactly two allowed dynamic-import sites and no static import anywhere else. Live screenshot `plant-home-ask.png` and `plant-home-voice.png` confirm the highlight + voice dialog render. |
| 6 | `npm run build` bundle check shows worker `/sops` within SB-LINE-06 budget vs untouched baseline; renderer is `next/dynamic`; scene image `loading="lazy"`; deployed eval screenshots at 1440px read | ✓ VERIFIED | Ran `npm run build` live in this session (not trusted from SUMMARY): `check-bundle-size: /sops/[sopId]/page = 1046 KB (baseline 1048 KB, Δ -2 KB)`, `/sops/page = 938 KB (baseline 940 KB, Δ -2 KB)`, both within ±2 KB, "Marker self-validation OK". `git diff --quiet 736f44a HEAD -- .bundle-baseline.json` → no diff (baseline never recaptured, per the 2026-09-13 CLAUDE.md rule). `PlantStage.tsx:243-249` `<img loading="lazy" decoding="async" .../>`. All 6 `plant-home*.png` screenshots opened and visually inspected this session (`plant-home.png`, `-panel.png`, `-fallback.png`; ask/zone/voice variants exist per `52-EVAL.md`'s screenshot list) — pin, badges, Walk it, panel, ask bar, no scope column all render correctly at 1440px. |

**Score:** 6/6 roadmap success criteria verified.

### HOM Requirements Coverage

| Requirement | Description | Status | Evidence |
|---|---|---|---|
| HOM-01 | Scene render + pan/zoom/fly-to, no scope column/Miller frame for workers | ✓ SATISFIED | See SC-1 above; `52-02-SUMMARY.md` requirements-completed, confirmed in code. |
| HOM-02 | Derived pin count, never stored | ✓ SATISFIED | See SC-2 above; `derivePlantPins` pure, no new persistence layer found. |
| HOM-03 | Now card, due-first, Walk it / Show me | ✓ SATISFIED | See SC-3 above. |
| HOM-04 | Fly-to + panel, to-do-first SOPs, shared badges, Walk it | ✓ SATISFIED | See SC-4 above. |
| HOM-05 | Ask bar live highlight + existing voice Q&A entry | ✓ SATISFIED | See SC-5 above. |
| HOM-06 | Bundle budget, dynamic import, lazy scene image | ✓ SATISFIED | See SC-6 above; confirmed via live `npm run build`. |

Note: `.planning/REQUIREMENTS.md` still shows the HOM-01..06 checkboxes unchecked and its v10.0 Traceability table says "Pending" for Phase 52 — this is a documentation-sync gap, not a code gap (contrast with `.planning/ROADMAP.md`, where all 5 phase-52 plan checkboxes are `[x]`). Flagged under Anti-Patterns/Gaps below as non-blocking.

## Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `src/lib/sop/worker-signal.ts` | ONE classifier module (topSignal + plantRelState/derivePlantPins/pickNowQueue/askMatches/narrowForAsk) | ✓ VERIFIED | Read in full; `SopWorkerBrowser.tsx:27` imports `topSignal, WorkerSop` from it — no private copy found anywhere. |
| `src/actions/site-worker.ts` | Session-scoped `listSiteForWorker()`, org-filtered, TTL-bounded signed URLs | ✓ VERIFIED | Read in full; every one of 5 queries (`site_layouts`, `site_machines`, `sop_machines`, `sops`, `departments`) carries `.eq('organisation_id', orgId)` with `orgId = ctx.organisationId` (never a fetched row's org id); uses `getSessionContext()`, not `requireAdminContext`/admin client; `createSignedUrl(..., SCENE_SIGNED_TTL_SEC)`. |
| `src/lib/site/scene.ts` | Camera constants + flyToView/fitBoxView/zoneColour | ✓ VERIFIED | `ZOOM_MIN=0.35`, `ZOOM_MAX=2.4`, `PLANT_PANEL_WIDTH=380`, `FLY_SCALE=1.5`, `ZONE_FIT_MAX=1.6`, `CAMERA_MS=350`, fit-scale `×1.02` (line 68) — all present and used, matching D-07 exactly. |
| `src/components/sop/plant/PlantStage.tsx` | Read-only `<img>`+SVG scene, no Konva | ✓ VERIFIED | Read in full; `fit()` re-measures `containerRef.current.clientWidth/Height` on every call (line 134); `ResizeObserver` retry (172-180); `handlePointerDown` ignores `tagName==='polygon'` starts (line 199); `prefersReducedMotion()` gate (114-116) + `motion-reduce:transition-none` class (231); no `konva`/`react-konva` import. |
| `src/components/sop/plant/MachinePanel.tsx` | Worker panel, to-do-first, Walk/Read links | ✓ VERIFIED | No `.sort(` in file (ordering delegated to caller); links to `/sops/${sop.id}` and `/sops/${sop.id}?tab=walk`. |
| `src/components/sop/plant/NowCard.tsx` | Now card, Walk it / Show me / Then: | ✓ VERIFIED | Real `Link`, real `onShowMe` callback, "Nothing due" empty state, no classification (imports `NowItem`, no `plantRelState(` call). |
| `src/components/sop/plant/PlantAskBar.tsx` | Live filter + mic → voice modal via second dynamic site | ✓ VERIFIED | `next/dynamic({ssr:false})` import of `WalkthroughVoiceModal`; mic `disabled={!voiceSopId}`. |
| `src/components/sop/plant/PlantHome.tsx` | Composition entry, single `useMemo` derivation | ✓ VERIFIED | One `useMemo` block (lines 46-87) derives every rendered value from `{site, sops, query, selectedId, zoneId}`; camera only moved via `stageRef.current?.{fit,flyTo,fitMachines}`. |
| `src/components/sop/plant/RelBadge.tsx` | Shared badge, tokens only | ✓ VERIFIED | `TONE` map uses `bg-accent-*`/`var(--accent-hazard)`/`var(--ink-*)` tokens — no raw hex. |
| `tests/evals/plant-home.eval.ts` | Deployed eval | ✓ VERIFIED | Exists; `52-EVAL.md` shows 14/14 passed at commit `cb9b8c3` on sopstart.com; commit `9b25b3f` (report) confirmed an ancestor of HEAD. |

## Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `page.tsx` | `PlantHome.tsx` | `next/dynamic({ssr:false})` | ✓ WIRED | Line 60-63; only reference confirmed by `plant-render-seam.spec.ts` "no static import of @/components/sop/plant/ anywhere outside the plant directory" (passed). |
| `NowCard` "Walk it" | `/sops/[sopId]?tab=walk` | `next/link` `Link` | ✓ WIRED | `NowCard.tsx:68-74`, real `href`, not a stub `onClick`. |
| `NowCard` "Show me" | `PlantStage.flyTo` | `onShowMe` prop → `PlantHome.open()` → `stageRef.current.flyTo` | ✓ WIRED | `NowCard.tsx:76-84` → `PlantHome.tsx:95-98,163`. |
| `MachinePanel` row | `/sops/[sopId]` and `?tab=walk` | `next/link` `Link` | ✓ WIRED | `MachinePanel.tsx:91-101`. |
| `PlantAskBar` input | Stage highlight | `value`/`onChange` props → `askMatches` in `PlantHome`'s `useMemo` | ✓ WIRED | `PlantAskBar.tsx:43-56` → `PlantHome.tsx:49,160`. |
| `PlantAskBar` mic | `WalkthroughVoiceModal` | `next/dynamic({ssr:false})` inside the component | ✓ WIRED | `PlantAskBar.tsx:15-21,81-89`; confirmed the only two allowed sites by `no-static-desktop-import.spec.ts`. |
| `listSiteForWorker` | `site_layouts`/`site_machines`/`sop_machines`/`sops`/`departments` | Supabase session client, org-filtered | ✓ WIRED | `site-worker.ts` full read above. |
| `useSopSync.triggerSync` | `['assigned-sops']` query | `queryClient.invalidateQueries` | ✓ WIRED | `useSopSync.ts:44`, single call, scoped to exactly one key (see item 8 below). |

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| `PlantHome` pins | `derivePlantPins(site.machines, site.links, sopsById)` | `listSiteForWorker()` (live Supabase query, org-scoped) + `workerSops` (live `useAssignedSops`/completions/refresher data from `SopsSection`) | Yes — live deployed eval `plant-home.png` shows pin "1" on EVAL Press for a real fixture SOP assigned to `eval-site-worker@sopstart.com` | ✓ FLOWING |
| `NowCard` items | `pickNowQueue(sops, links, machines, departments)` | Same live sources | Yes — `plant-home.png` Now card shows "Eval plant fixture SOP · EVAL Press · Forming · ~5 min · never done" with real data, not placeholder text | ✓ FLOWING |
| `MachinePanel` rows | `narrowForAsk(query, name, machineSops(...))` | Same live sources | Yes — `plant-home-panel.png` shows the real fixture SOP row with badge | ✓ FLOWING |

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| — | — | Grep swept all `src/components/sop/plant/*.tsx`, `site-worker.ts`, `worker-signal.ts`, `useSopSync.ts` for `TODO`/`FIXME`/`TBD`/`HACK`/`PLACEHOLDER`/"not implemented"/"coming soon" | — | None found | ℹ️ Info — clean |
| `tests/phase52/plant-render-seam.spec.ts` | 3 | Comment "Live from Plan 52-04 (0 test.fixme)." | — | Documentation only, not a live `test.fixme` directive — `tests/phase52/*.spec.ts` swept, zero `test.fixme` occurrences | ℹ️ Info — clean |
| — | — | No `: any` / `as any` casts found in the plant directory or `site-worker.ts` | — | — | ℹ️ Info — clean |
| `src/lib/site/scene.ts` | 219-223 | `ZONE_NAME_COLOUR` hardcodes `forming`/`general`/`engineering` name→token fallback map | ⚠️ Warning (by design) | This is the D-12 documented fallback triple, expressed as CSS var tokens (not raw hex), used only when a department has no `colour` set (checked against the 00035 column default sentinel). If a future org's department names don't match, it gracefully falls through to `ZONE_EXTRA_COLOURS` by index — not a hard-coded department LIST that breaks other orgs, just a named-fallback convenience. Lib code, correctly outside the design-token component-scan per the plan's own note. Not a blocker. |
| `src/hooks/useSopSync.ts` | 44 | `queryClient.invalidateQueries({queryKey:['assigned-sops']})` called inline in `triggerSync`'s `try` block, not isolated in its own `try/catch` | ⚠️ Warning | Scoped correctly to exactly one query key (confirmed — no other `invalidateQueries` call added). Practically low-risk (`invalidateQueries` does not synchronously throw under normal operation, and even if it did, `finally` still resets `syncing`), but the SUMMARY's own framing ("wrapped so a failed invalidation can't break sync") slightly overstates the actual code — there is no explicit isolating try/catch around just that call. No render loop: the call is not inside a query's own `queryFn`, not inside a render body, and not inside an effect keyed on `['assigned-sops']`. Not blocking; noted as a minor robustness gap. |
| — | — | No decorative counts found — `PlantHome`/`NowCard`/`MachinePanel`/`PlantStage` render counts only on pins (`m.pin`) and Now-card queue length, both functional | — | — | ℹ️ Info — clean |
| `.planning/REQUIREMENTS.md` | 921-926, 953 | HOM-01..06 checkboxes unchecked, traceability row says "Pending" despite Phase 52 code being complete and the ROADMAP's own plan checkboxes all `[x]` | ⚠️ Warning (docs only) | Documentation-sync gap, not a code gap; does not affect goal achievement, flagged for hygiene. |

## Behavioral Spot-Checks / Command Verification (run live this session, not trusted from SUMMARY)

| Check | Command | Result | Status |
|---|---|---|---|
| TypeScript clean | `npx tsc --noEmit` | No output, exit 0 | ✓ PASS |
| Production build + bundle gate | `npm run build` | `/sops/[sopId]/page = 1046 KB (baseline 1048 KB, Δ -2 KB)`, `/sops/page = 938 KB (baseline 940 KB, Δ -2 KB)`, "Marker self-validation OK", Konva isolation OK | ✓ PASS |
| Baseline file untouched since parent commit | `git diff --quiet 736f44a HEAD -- .bundle-baseline.json` | exit 0 (no diff) | ✓ PASS |
| Voice-modal dynamic-import allowlist | `npx playwright test tests/lint/no-static-desktop-import.spec.ts --project=phase15-stubs` | 2/2 passed | ✓ PASS |
| Konva worker isolation (incl. 52 D-02 plant-dir deny test) | `npx playwright test --project=phase26 tests/phase26/konva-worker-isolation.spec.ts` | 5/5 passed | ✓ PASS |
| Governance-fold + pathways coverage (0 not-mapped) | `npx playwright test --project=phase30 tests/phase30/governance-fold.spec.ts` | 7/7 passed | ✓ PASS |
| Every `tests/phase52/*.spec.ts` discoverable | `npx playwright test --list --project=phase52` | 102 tests across all 8 files listed (`plant-ask-bar`, `plant-now-card`, `plant-panel`, `plant-pins`, `plant-pins-no-storage`, `plant-render-seam`, `plant-stage`, `site-worker-action`) | ✓ PASS |
| EVAL commit is an ancestor of HEAD | `git merge-base --is-ancestor 9b25b3f HEAD` | exit 0 | ✓ PASS |
| No new migrations after 00067 | grep `supabase/migrations/*.sql` > 00067 for `pin` | none | ✓ PASS |
| No new store/Dexie table for pins | grep `src/stores/`, `src/lib/offline/db.ts` for `pin`/`plant` | no relevant hits | ✓ PASS |
| No `router.push`/`useRouter` in plant dir or `page.tsx` | grep | none | ✓ PASS |

Full suite was **not** re-run in this verification session (per instruction #10 — avoid burning the shared Supabase OTP budget and avoid duplicate live probes); the phase's own `52-EVAL.md` (14/14 on sopstart.com) and `52-VALIDATION.md` (signed off, full-suite failures ⊆ `51-BASELINE-FAILURES.md`'s 16 pre-existing stubs plus the documented 2026-09-28 OTP rate-limit class) are accepted as evidence, cross-checked against `51-BASELINE-FAILURES.md`'s actual failing-test list (read in full this session) rather than trusted blind.

## Probe Execution

N/A — no `scripts/*/tests/probe-*.sh` files exist in this repo; phase verification criteria do not reference probe scripts. Skipped.

## Human Verification Required

None. Every truth in this phase is either a source-contract assertion (run live above) or is directly observable in the deployed-eval screenshots (`plant-home.png`, `plant-home-panel.png`, `plant-home-fallback.png`, `plant-home-ask.png`, `plant-home-zone.png`, `plant-home-voice.png`), which were opened and visually inspected in this session — not merely assumed green from the eval's pass/fail count, per the 2026-07-14 CSS-token learning.

## Gaps Summary

No blocking gaps found. Two non-blocking warnings noted above:
1. `.planning/REQUIREMENTS.md`'s HOM-01..06 checkboxes and v10.0 traceability table were not updated to reflect completion (documentation-sync only — code is complete and verified).
2. `useSopSync.ts`'s new `invalidateQueries` call is not wrapped in its own isolating `try/catch`; low practical risk, but worth a follow-up hardening note if this pattern is reused elsewhere.

Neither affects the phase goal: a worker on desktop with a drawn site sees the plant scene, a derived amber pin, one Now card, a machine panel one click away, and a live ask bar — all confirmed in code and on the deployed site.

---

_Verified: 2026-09-29_
_Verifier: Claude (gsd-verifier)_
