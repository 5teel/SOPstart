---
phase: 53-phone-scan-or-ask
verified: 2026-09-29T00:00:00Z
status: human_needed
score: 4/4 roadmap success criteria verified, 3/3 PHN requirements verified
overrides_applied: 0
human_verification:
  - test: "Real camera QR decode of a printed plate on a physical Android phone and an iPhone"
    expected: "Opening sopstart.com, tapping 'Scan a machine plate', and pointing the camera at a printed EVAL Press plate lands on /m/<code> with the machine's jobs listed, without a full page reload"
    why_human: "Headless Chromium (the deployed eval's runtime) has no camera device — getUserMedia always rejects there, so only the denied-camera code-entry fallback path is exercised automatically. BarcodeDetector/jsqr frame decoding against a real live video feed can only be exercised on real hardware. This is a known, pre-declared limitation (53-VALIDATION.md 'Manual-Only Verifications'), not a code gap — all reachable automated surfaces (getUserMedia call shape, decoder selection order, origin validation, single-navigation contract, track cleanup) are verified below."
---

# Phase 53: Phone — Scan or Ask Verification Report

**Phase Goal:** On the floor with a phone, a worker never navigates: they scan the plate on the machine or ask.
**Verified:** 2026-09-29
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### ROADMAP Success Criteria

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | `/sops` below 1024px renders ask bar, Now card, floor thumbnail (tap → dept-grouped machine list, no pan/zoom) and Scan button; no scene renderer enters the phone bundle | ✓ VERIFIED | `src/app/(protected)/sops/page.tsx:63-69` — `PhoneHome` is a 4th `next/dynamic({ ssr:false })` slot alongside `SopWorkerBrowser`/`AdminSopSurface`/`PlantHome`; `wantsPhone = viewport === 'mobile'` (L144) feeds the shared `['site-worker']` query's `enabled: wantsPlant \|\| wantsPhone` (L148) — one fetch for both viewports (D-01). No-site orgs fall through to the unchanged stacked list (`phoneSite = wantsPhone ? site : null`, null when `site` resolves null). `PhoneHome.tsx` composition: `PlantAskBar` → `NowCard(inline)` → floor `<img>` (150px/`h-37.5`, `loading="lazy"`) opening `MachineListSheet` (dept-grouped, per `tests/phase53/machine-list-sheet.spec.ts:60` "imports nothing from PlantStage") → Scan button. `tests/phase53/scan-sheet.spec.ts:242` confirms neither `ScanSheet` nor `jsqr` appear in `/sops/page.tsx`; `phone-home.spec.ts:142` confirms no scene renderer/pan/zoom in the file. No top-level `window`/`navigator` reads in `PhoneHome.tsx` (grep clean). |
| 2 | Every machine has a short code; `/m/<code>` renders that machine's SOP list for the signed-in worker with shared badges; admin machine editor offers printable A6 plate | ✓ VERIFIED | `src/app/(protected)/m/[code]/page.tsx`: `getSessionContext()` (L27), every read `.eq('organisation_id', organisationId)` — `site_machines` (L34), `departments` (L44), `sop_machines` (L69), `sops` (L76); malformed code → `notFound()` (L25), unknown/foreign → `notFound()` via `maybeSingle()` null (L37); logged-out → `redirect('/login?next=/m/<code>')` (L28). `MachineView.tsx` uses `useWorkerSops` → `machineSops`/`plantRelState` (the one classifier, `src/lib/sop/worker-signal.ts:54,105`) — no second derivation. `MachinePanel.tsx:106-108` renders `RelBadge` + `Walk it` at `/sops/${sop.id}?tab=walk`. Plate page `src/app/(protected)/admin/site/plate/[machineId]/page.tsx`: `requireAdminContext()` first (L27), org-scoped machine lookup (L38-41), QR via `qrcode.toString` encoding `plateUrl(origin, machine.code)` where `origin` is `NEXT_PUBLIC_SITE_URL` or request headers (L57-61, never hardcoded), `@page { size: A6 portrait }` (L79), code printed as large mono text (L98). `SiteWorkspace.tsx:342-348` links `Print plate` → `/admin/site/plate/${machine.id}`. |
| 3 | Scan opens in-app camera, decodes QR, client-routes to `/m/<code>`; denied permission falls back to code entry | ✓ VERIFIED | `ScanSheet.tsx`: `getUserMedia({ video: { facingMode: 'environment' }, audio: false })` (L114-117); decoder picks native `BarcodeDetector` when it supports `qr_code`, else dynamic `await import('jsqr')` (L61-90) — confirmed no static `jsqr` import anywhere in `src` (grep clean) and `tests/phase53/scan-sheet.spec.ts:86` asserts dynamic-only. Only navigation: `go(code)` → `router.push('/m/${code}')` (L49-56), fed exclusively by `extractMachineCode(text, window.location.origin)` (L138) — foreign origin returns `null` → note shown, no navigation (L139-141). `NotAllowedError`/`NotFoundError`/other → `mode: 'typing'` with the code-entry field (L150-165); "Type it instead" always rendered outside the typing branch (L207-215). `stopCamera()` (all tracks `.stop()`) called from `go`, `closeSheet`, `typeInstead`, and the effect's unmount cleanup (L40-46, 176-179). |
| 4 | Deployed eval at 390×844 covers home → thumbnail list → `/m/<code>` → Walk it | ✓ VERIFIED | `.planning/evals/latest/EVAL-REPORT.md` / `53-EVAL.md`: 20/20 passed at commit `fd1ec3a` (an ancestor of HEAD `ce109be`, confirmed via `git merge-base --is-ancestor fd1ec3a HEAD`). Test "eval-site worker at 390×844: ask bar, Now card, floor picture, Scan → machine sheet lists EVAL Press under Forming → /m/<code> → Walk it" ✅; scan fallback → typed code → `/m/<code>` ✅; logged-out `/m/<code>` → `/login?next=…` → lands on machine ✅; foreign-org worker → 404 content (not status) ✅; no-site org keeps today's list ✅. Screenshots read by prior orchestrator turn per 53-EVAL.md narrative (phone-home.png, phone-machine-sheet.png, phone-machine.png, phone-scan-fallback.png, phone-plate.png, phone-plate-print.png, phone-home-fallback.png) — no visual defects noted. |

**Score:** 4/4 roadmap success criteria verified

### Requirements Coverage (PHN-01..03)

| Requirement | Description | Status | Evidence |
|---|---|---|---|
| PHN-01 | Phone home = ask bar, Now card, floor thumbnail, Scan button — scene never the phone nav | ✓ SATISFIED | SC1 evidence above. |
| PHN-02 | Printable QR plate resolves `/m/<code>` to the signed-in worker's SOP list | ✓ SATISFIED | SC2 evidence above. |
| PHN-03 | In-app camera scan (getUserMedia + QR decode) lands on `/m/<code>` without a full reload | ✓ SATISFIED | SC3 evidence above (`router.push`, not a reload/`window.location`). |

**Note:** `.planning/REQUIREMENTS.md` lines 930-932/954 still show PHN-01..03 as `[ ]` unchecked / "Pending" despite the code satisfying them and 53-06-SUMMARY.md claiming completion — a documentation-sync gap, not a functional gap (see Anti-Patterns/Info below).

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `src/app/(protected)/sops/page.tsx` | phone seam, `PhoneHome` dynamic slot | ✓ VERIFIED | Wired, gated correctly, additive (not replacing) per `phone-home-fallback.spec.ts`. |
| `src/components/sop/plant/PhoneHome.tsx` | phone home composition | ✓ VERIFIED | Exists, substantive, wired via dynamic import, data flows from `site`/`sops` props derived from real queries. |
| `src/components/sop/plant/ScanSheet.tsx` | camera scan sheet | ✓ VERIFIED | Exists, substantive, wired via dynamic import from `PhoneHome`. |
| `src/app/(protected)/m/[code]/page.tsx` | machine SOP list route | ✓ VERIFIED | Exists, org-scoped on every read, wired to `MachineView`. |
| `src/components/sop/plant/MachineView.tsx` | client half of `/m/[code]` | ✓ VERIFIED | Uses shared hooks, no private derivation. |
| `src/app/(protected)/admin/site/plate/[machineId]/page.tsx` | printable A6 plate | ✓ VERIFIED | Admin-gated, org-scoped, real QR SVG, print CSS present. |
| `src/lib/site/qr-decode.ts` | code/URL builder + validator | ✓ VERIFIED | `normaliseMachineCode`, `plateUrl`, `extractMachineCode`, `isOurPlateUrl` all present and unit-tested (round-trip test for 50 generated codes). |
| `src/lib/auth/next-redirect.ts` | `safeNextPath` guard | ✓ VERIFIED | Rejects absolute URLs (no leading `/`), `//`, backslash, control chars, `/login*`, `/api/*`. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `/sops` page | `PhoneHome` | `next/dynamic({ssr:false})` | ✓ WIRED | `sops/page.tsx:67-69`, rendered at L477 gated on `phone && onQueryChange`. |
| `PhoneHome` | `ScanSheet` | `next/dynamic({ssr:false})` | ✓ WIRED | `PhoneHome.tsx:24-26`, mounted only while `scanOpen`. |
| `ScanSheet` | `jsqr` | dynamic `import()` | ✓ WIRED | `ScanSheet.tsx:81`, no static import anywhere in `src`. |
| `ScanSheet` decoded text | `/m/<code>` | `extractMachineCode` → `router.push` | ✓ WIRED | Single navigation call site, validated first. |
| `middleware.ts` (supabase) | `/login?next=` | `safeNextPath` | ✓ WIRED | `src/lib/supabase/middleware.ts:54-55`. |
| `/login` page | `LoginForm` | `next` prop | ✓ WIRED | `login/page.tsx:17` → `LoginForm({next})`. |
| `LoginForm` | `loginWithEmail` | `next` argument | ✓ WIRED | `LoginForm.tsx:26`. |
| `src/actions/auth.ts` | `safeNextPath(next) ?? roleHome(...)` | redirect | ✓ WIRED | `auth.ts:123`. |
| `SiteWorkspace.tsx` | plate page | `href=/admin/site/plate/<id>` | ✓ WIRED | `SiteWorkspace.tsx:342-348`. |
| `/m/[code]` page | `MachineView` → `useWorkerSops`/`machineSops` | shared classifier | ✓ WIRED | No private classification logic found in either file. |

### Behavioral / Test Execution

| Check | Command | Result | Status |
|---|---|---|---|
| phase53 project full run | `npx playwright test --project=phase53` | 87 passed, 0 failed | ✓ PASS |
| phase53 listing (all files present) | `npx playwright test --list --project=phase53` | 87 tests across 9 files | ✓ PASS |
| Typecheck | `npx tsc --noEmit` | clean, no output | ✓ PASS |
| phase30 governance-fold + pathways coverage | `npx playwright test --project=phase30 tests/phase30/governance-fold.spec.ts` | 7 passed, incl. "0 not-mapped" | ✓ PASS |
| Bundle baseline unchanged | `git diff --quiet 736f44a HEAD -- .bundle-baseline.json` | exit 0 (unchanged) | ✓ PASS |
| Build gate (Δ0 KB both routes) | 53-06-SUMMARY.md gate lines (not re-run per instruction) | "both gated routes Δ 0 KB, marker self-validation OK" | ✓ PASS (documented, consistent with `next.config.ts` `nextDynamic` cacheGroup at L27-28 and `deferred-items.md`'s RESOLVED entry) |
| Deployed eval | `.planning/evals/latest/EVAL-REPORT.md` | 20/20 passed @ fd1ec3a (ancestor of HEAD) | ✓ PASS |
| `test.fixme` in `tests/phase53/` | grep | none found | ✓ PASS |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| `.planning/REQUIREMENTS.md` | 930-932, 954 | PHN-01..03 checkboxes unchecked, status "Pending" despite phase code being complete and SUMMARY claiming done | ℹ️ Info | Documentation-sync gap only — every underlying truth is independently verified against the code above. Recommend ticking `[x]` and setting "Complete (2026-09-29)" in the same commit that closes this phase, matching the Phase 51/52 pattern. |
| — | — | No TBD/FIXME/XXX/HACK markers, no empty handlers, no static `jsqr` import, no hardcoded origins, no stub returns found in any phase-53-touched file | — | Clean |

No TODO/placeholder/console.log-only/hardcoded-empty-data patterns found in the reviewed phase-53 files (`sops/page.tsx`, `PhoneHome.tsx`, `m/[code]/page.tsx`, `MachineView.tsx`, plate `page.tsx`, `ScanSheet.tsx`, `qr-decode.ts`, `next-redirect.ts`, `SiteWorkspace.tsx`, `useWorkerSops.ts`) beyond ordinary `placeholder="..."` input-attribute usage (not a stub indicator).

### Human Verification Required

#### 1. Real camera QR decode on a physical phone

**Test:** On an Android phone and an iPhone, open sopstart.com, sign in as a worker, tap "Scan a machine plate", point the camera at a printed EVAL Press plate.
**Expected:** The sheet opens the back camera, decodes the QR, and navigates to `/m/<code>` showing the machine's job list — without a full page reload.
**Why human:** Headless Chromium (the deployed-eval runtime) has no camera device, so `getUserMedia` always rejects there and only the denied-camera code-entry fallback is exercised automatically. This is a pre-declared, expected limitation (53-VALIDATION.md "Manual-Only Verifications"), not a code defect — every reachable automated surface of the scan path (call shape, decoder selection, origin validation, single-navigation contract, track cleanup, and an actual `jsqr` decode of a real generated QR image in `scan-sheet.spec.ts:155`) is independently verified above.

### Gaps Summary

No functional gaps found. All 4 ROADMAP success criteria and all 3 PHN requirements are independently verified against the running code (not SUMMARY claims): the phone-home render seam, `/m/<code>`'s org-scoping on every table read, the printable A6 plate, the in-app scanner's single validated navigation with camera-denied fallback, and the deployed eval's 20/20 pass are all confirmed with file:line evidence and green automated runs (87/87 phase53 tests, clean `tsc`, unchanged bundle baseline, 7/7 phase30 governance/pathways). Status is `human_needed` — not `passed` — solely because one item (real-device camera QR decode) cannot be exercised in a headless CI/eval environment and is explicitly scoped to manual verification by the phase's own validation strategy. The one documentation gap found (REQUIREMENTS.md checkboxes not ticked) is informational only.

---

*Verified: 2026-09-29*
*Verifier: Claude (gsd-verifier)*
