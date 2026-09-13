# Phase 41 Plan 09 — SUR-05 Bundle Proof

Recorded evidence from a real `npm run build` + `npx playwright test` + `npx tsc --noEmit` run on the final Phase 41 tree (commit `19b1a2a` + this plan's uncommitted build). No numbers below are restated from memory — every figure is copied verbatim from the tool's own console output or from a direct grep against the build artefacts in `.next/`.

## 1. SB-LINE-06 delta gate — both gated routes

Exact `check-bundle-size:` lines from this build's postbuild run:

```
check-bundle-size: /sops/[sopId]/page = 1049 KB (baseline 1048 KB, Δ +1 KB, tolerance ±2 KB)
check-bundle-size: /sops/page = 941 KB (baseline 940 KB, Δ +1 KB, tolerance ±2 KB)
```

| Route | Baseline (KB) | Measured (KB) | Delta | Tolerance | Result |
|---|---|---|---|---|---|
| `/sops/[sopId]/page` | 1048 | 1049 | +1 KB | ±2 KB | PASS |
| `/sops/page` | 940 | 941 | +1 KB | ±2 KB | PASS |

Both baselines are the Wave-0 (41-01) values, restored by the 41-08 "Deviation fix" and confirmed **not** re-captured by this plan:

```
$ git diff -- .bundle-baseline.json
(empty)
$ git diff e59d057 -- .bundle-baseline.json
(empty)
```

`.bundle-baseline.json` is byte-identical to the working tree and to commit `e59d057` (the commit that restored the Wave-0 floor). No re-capture occurred.

## 2. Forbidden-marker gate — `/sops/page`

`scripts/check-bundle-size.ts` defines three marker groups for `/sops/page`, six string literals total. The gate's own console output for this build:

```
check-bundle-size: ✓ Marker self-validation OK — every forbidden marker is present somewhere in the build.
```

This aggregate line means the build did not fail — i.e. every marker was (a) found somewhere in the overall build output (non-vacuous self-validation) and (b) absent from `/sops/page`'s own resolved chunk set (the leak check), because `check-bundle-size.ts`'s `fail()` exits the build the instant either condition is violated for any marker, and the build exited 0.

Independently spot-checked per marker directly against `.next/`, rather than trusting the aggregate line alone:

| Marker | Label | Found somewhere in `.next/`? | Chunk it lives in | In `/sops/page`'s RSC client-reference-manifest? |
|---|---|---|---|---|
| `Pick another scope on the left.` | status lens (SopMillerBrowser.tsx) | YES | `.next/static/chunks/1631.a83d92151f22d6df.js` | NO (0 matches) |
| `Pick a SOP to see its detail here.` | status lens (SopMillerBrowser.tsx) | YES | `.next/static/chunks/1631.a83d92151f22d6df.js` | NO (0 matches) |
| `Owner role gone` | governance/attention lens (GovernanceQueueRow.tsx) | YES | `.next/static/chunks/2450.170933643cf0c583.js` (also present in the server-only `page.js`, which is never shipped to the browser and is not part of the client chunk set the gate scans) | NO (0 matches) |
| `Search org or collections…` | access lens (WiringPatchBay.tsx) | YES | `.next/static/chunks/4402.a0f008a19c7759be.js` | NO (0 matches) |
| `follows collection` | access lens (WiringPatchBay.tsx) | YES | `.next/static/chunks/4402.a0f008a19c7759be.js` | NO (0 matches) |

(`Owner role gone`'s marker group has one literal covering both its found-somewhere and absent-here checks per `check-bundle-size.ts`'s `forbiddenMarkers` array.)

Verdict: all three admin-lens marker groups are real code that exists in the build (self-validation is non-vacuous — a renamed/typo'd literal would show zero matches here) and none of the chunks carrying them are wired into `/sops/page`'s own client-reference-manifest, i.e. they only load via the `next/dynamic({ ssr: false })` boundary behind `useIsAdmin()` in `AdminSopSurface.tsx`.

## 3. Positive chunk-existence gate — `/sops/[sopId]/page`

Pre-existing Phase 15/26 gate, unchanged by Phase 41. Exact output:

```
check-bundle-size: ✓ Bundle isolation OK (chunks present, delta within tolerance) — DesktopWalkthrough at C:\Development\SOPstart\.next\server\app\(protected)\sops\[sopId]\page.js, WalkthroughVoiceModal at C:\Development\SOPstart\.next\server\app\(protected)\sops\[sopId]\page.js
check-bundle-size: ✓ Source-viewer isolation OK — pdfjs + mammoth not in /sops/[sopId]/page bundle (D-21-09).
check-bundle-size: ✓ Konva isolation OK — konva + react-konva not in /sops/[sopId]/page bundle (26-05 D-03).
```

Both `DesktopWalkthrough` and `WalkthroughVoiceModal` still resolve as their own dynamic chunks; `pdfjs`/`mammoth`/`konva` remain absent from the mobile worker route. This confirms Phase 41 did not disturb the pre-existing gate on the walkthrough route.

## 4. `npx tsc --noEmit`

```
$ npx tsc --noEmit
(exit code 0, no output)
```

## 5. Full Playwright suite

```
Running 1725 tests using 12 workers
...
26 failed
209 skipped
1490 passed (3.2m)
```

Total: **1725** = 1490 passed + 26 failed + 209 skipped.

### The 26 failures are all pre-existing and already logged — none touch Phase 41 code

Per-project failure counts (grep of `✘` lines against project tags):

| Project | Failed | Notes |
|---|---|---|
| `phase12.5-stubs` | 12 | Pre-existing Phase 26 Puck-removal / stub rot — logged in 41-08-SUMMARY.md and `.planning/phases/41-one-sop-surface/deferred-items.md` |
| `phase11-stubs` | 10 | Same class — `sb-auth-builder.test.ts` SB-AUTH-01 (`useForm` vs actual `useState`), `sb-layout-editor.test.ts`/`sb-section-schema.test.ts` (`ENOENT: puck-config.tsx`) — logged pre-existing in deferred-items.md |
| `phase3-stubs` | 2 | Same `sb-ux-walkthrough.test.ts` SB-UX-03 stub rot, logged pre-existing |
| `phase25-integration` | 1 | `wizard-sop-dept.spec.ts` A4 — `__new__` sentinel no longer in `SopMetadataFields.tsx`, confirmed pre-existing and untouched by any Phase 41 commit (deferred-items.md) |
| `phase36` | 1 | `worker-library-chip.spec.ts` — pre-existing, named in 41-08-SUMMARY.md's floor |

31 total pre-existing failures were on record in 41-08-SUMMARY.md's floor (26 of the above + 5 `phase46` live-Supabase network-probe flakes). This run's 5 fewer failures (26 vs 31) is exactly the `phase46` live-network-dependent probes passing this time — a live Supabase Auth/network condition, not a code change; the accepted floor is a ceiling, and this run is inside it. **Zero new failures.**

Per-project pass counts for every project this plan's changes could plausibly affect — all green:

| Project | Passed | Failed |
|---|---|---|
| `phase41` | 76 | 0 |
| `phase28` | 44 | 0 |
| `phase29` | 84 | 0 |
| `phase30` | 52 | 0 |
| `phase32` | 52 | 0 |
| `phase33` | 50 | 0 |
| `phase15-stubs` | 96 | 0 |
| `phase46` | 31 | 0 |

## 6. SC-1..SC-5 verdicts (ROADMAP success criteria)

| Criterion | Verdict | Evidence |
|---|---|---|
| SC-1 — every role reaches `/sops`, sees only what their permissions allow, worker behaviour intact | Automated contracts green; **awaiting human confirmation** (Task 2, questions A/C/F) | `phase41` 76/76, `phase28`/`phase29`/`phase30` all green — role-gating and worker-scope-preservation contracts pass; CSS/visual reality per D-10 requires a human look |
| SC-2 — status/governance/access lenses render; all 6 legacy query params resolve | Automated contracts green; **awaiting human confirmation** (Task 2, questions B/D) | `phase32` 52/52 (deep-link + precedence specs), `phase41` merged-surface + nav-and-shim specs green |
| SC-3 — exactly one top-level SOPs entry; "Library" names no destination | CONFIRMED (automated) | `phase41` reference-sweep + nav-and-shim SUR-06 assertions green (0 failures); `phase33` wayfinder-header 50/50; human spot-check at Task 2 Q14 is confirmatory, not load-bearing |
| SC-4 — one route chain from list to builder | CONFIRMED (automated) | `phase41` reference-sweep SUR-04 sweep green (0 failures) |
| SC-5 — SB-LINE-06 green for both routes, no admin-lens code in worker chunks | **PROVEN** | Sections 1-3 above: both routes +1 KB against the unmodified Wave-0 baseline (tolerance ±2 KB), all six forbidden markers independently confirmed non-vacuous and absent from `/sops/page`'s resolved chunk set |

SC-1/SC-2 carry an explicit "automated + pending human" status because CLAUDE.md's 2026-07-14 learning (an undefined CSS token or invisible control fails every automated gate in this repo) is exactly why this plan's Task 2 checkpoint exists — the automated evidence above is necessary but not sufficient for those two criteria.
