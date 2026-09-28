# Phase 53: Phone — Scan or Ask - Research

**Researched:** 2026-09-29
**Domain:** Mobile worker home (phone-width `/sops`), a new `/m/[code]` machine-scoped route, server-side QR generation for a printable plate, and client-side QR scanning (`BarcodeDetector` + JS fallback) with a code-entry fallback
**Confidence:** HIGH — every load-bearing claim below is verified against the live codebase (Phase 51/52 source, not just summaries) or a registry lookup; the one genuinely uncertain area (iOS Safari `BarcodeDetector` support) is CITED against MDN/caniuse and flagged, not assumed.

## Summary

Phase 53 slots a phone-width worker home into the exact same `/sops` render seam Phase 52 just built for desktop, using the identical `useViewport()` + `['site-worker']` query gate — the only change needed to the gate itself is widening `enabled`/the desktop-only branch to also resolve on `viewport === 'mobile'`. The two building blocks CONTEXT names for reuse, `NowCard` and `MachinePanel`, are real, already-shipped components — but both are hard-coded `absolute`-positioned overlays sized for the desktop `PlantStage` canvas (`NowCard` is `absolute bottom-4 left-4 w-82.5`; `MachinePanel` is `absolute inset-y-0 right-0 w-95`, i.e. exactly 380px). Neither drops into a phone's normal stacked-column layout unmodified, and `NowCard`'s `onShowMe` is a **required** prop with no way to suppress the "Show me" button CONTEXT's D-02 says the phone should not show. Plan for small, additive prop/className changes to both, not verbatim reuse.

The encoder half of PHN-02/D-06 needs no new dependency: `qrcode` (npm, already in `package.json` `dependencies` at `^1.5.4`) is already used exactly this way in production — `src/app/(protected)/admin/sops/[sopId]/qr/page.tsx` server-renders a QR as inline SVG via `QRCode.toString(url, { type: 'svg', ... })`, zero client JS. The new `/admin/site/plate/[machineId]` page should copy this pattern verbatim (including its `PrintButton` component), swapping the encoded URL from `/sops/<id>` to `/m/<code>` and adding an explicit `@page { size: A6 }` print rule — the existing page has no `@page` rule at all, it just hides chrome and sizes the sticker with a fixed Tailwind width, which will not force A6 in every browser's print dialog. The decoder half (client-side scan) needs one new dependency: no QR/barcode decoding library exists anywhere in the codebase or `package.json` today. `BarcodeDetector` is the free first choice (94% of global Chrome installs per Chrome Platform Status as of June 2026) but **is not implemented in Safari/WebKit on any platform**, including iOS — a hard fallback is mandatory, not an edge case, for this app's NZ industrial-worker phone audience. `jsqr` (npm `jsqr`, MIT^Apache-2.0, v1.4.0, zero dependencies, no postinstall script, slopcheck `[OK]`) is the right size/simplicity fit and should load only inside the scan sheet's own dynamic chunk, mirroring the exact `getUserMedia`/`stopAllTracks`/`NotAllowedError`-branch pattern `VideoRecorder.tsx` already ships.

The login-redirect gap CONTEXT flags is real and currently unhandled anywhere in the auth path: `middleware.ts`'s redirect to `/login` carries no `?next=`, `LoginPage`/`LoginForm` read no `next` param, and `loginWithEmail` in `src/actions/auth.ts` redirects unconditionally to `roleHome(role)` — a worker who scans a plate while logged out loses the destination entirely today. The fix is small (3 files) and does not need a client-side `useSearchParams` + Suspense boundary: `LoginPage` is already a server component destructuring `searchParams`, so `next` can be read there and threaded down as a plain prop.

**Primary recommendation:** Reuse the render-seam pattern and the two existing QR/camera precedents (`qr/page.tsx`, `VideoRecorder.tsx`) verbatim for their mechanics; do not reuse `NowCard`/`MachinePanel` verbatim for their CSS — extract or parameterize them. Add exactly one new npm dependency (`jsqr`) behind a dynamic import. Fix the login-redirect gap as three small, additive edits.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Phone home layout (ask bar, Now card, thumbnail, Scan button) | Browser / Client | — | Pure presentational composition inside the existing client `/sops/page.tsx`, same tier as `PlantHome` |
| Machine list bottom sheet (department-grouped) | Browser / Client | — | Client-only UI state (open/closed, draft selection) — no new data source, reuses `WorkerSiteData` already fetched by `['site-worker']` |
| `/m/[code]` machine lookup + SOP list | Frontend Server (SSR) | API/Backend (RLS) | Server component does the org-scoped DB read directly (`getSessionContext()` + `.eq('organisation_id', …)`), same shape as `qr/page.tsx` — no client fetch, no API route needed |
| Printable plate (`/admin/site/plate/[machineId]`) | Frontend Server (SSR) | — | Server-rendered SVG QR + static print CSS, zero client JS, same shape as `qr/page.tsx` |
| QR encoding (URL → SVG) | Frontend Server (SSR) | — | `qrcode` npm package's `toString()` runs server-side only; never ships to the worker bundle |
| QR/barcode decoding (camera → code) | Browser / Client | — | `BarcodeDetector` (native) or `jsqr` (JS fallback) — both browser-only, no server round-trip; must be dynamically imported so neither ever reaches the base `/sops` or `/sops/[sopId]` bundle |
| Camera stream acquisition (`getUserMedia`) | Browser / Client | — | Browser API; no server involvement; teardown (`stopAllTracks`) must run on sheet close/unmount |
| Login-redirect preservation (`?next=`) | Frontend Server (SSR, middleware) | Frontend Server (login page/action) | `proxy.ts` → `middleware.ts` builds the redirect URL; `LoginPage`/`loginWithEmail` consume and validate it before honoring it — never trust `next` without a same-origin check |
| Bundle isolation of scan sheet + decoder | Browser / Client (build-time gate) | — | Enforced by `scripts/check-bundle-size.ts` forbidden-marker groups, a Node build-time script, not a runtime tier — listed here because it constrains where the client code above may be statically imported from |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `qrcode` | `^1.5.4` (installed, `package.json` line 49) [VERIFIED: npm registry via `npm view qrcode version` → 1.5.4, `time.modified` 2025-11-13] | Server-side SVG QR encoding for the printable plate | Already in production use for the exact same job (`src/app/(protected)/admin/sops/[sopId]/qr/page.tsx`) — this is rung 2 of the ladder ("already in this codebase"), not a new choice |
| `jsqr` | `1.4.0` [VERIFIED: npm registry via `npm view jsqr version license` → 1.4.0, Apache-2.0] | Client-side JS fallback QR decoder for browsers without `BarcodeDetector` (all of iOS Safari) | Zero runtime dependencies, no postinstall script [VERIFIED: `npm view jsqr scripts.postinstall` → empty], synchronous `jsQR(imageData, width, height)` API that pairs directly with a `<canvas>` frame-grab loop, smallest of the actively-considered options for a QR-only (not 1D-barcode) use case |
| `BarcodeDetector` (native browser API) | n/a — Web Platform API, no npm package | Preferred decoder where available | Zero bundle cost; native and faster than any JS decoder; available on ~94% of global Chrome installs as of June 2026 [CITED: Chrome Platform Status, via WebSearch] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@types/qrcode` | `^1.5.6` (installed) | TypeScript types for `qrcode` | Already present, no action needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `jsqr` | `@zxing/browser` | Larger bundle, matches a broader barcode-format set the phone plate doesn't need (QR-only); WebSearch summary describes both `jsqr` and `zxing-js` as no-longer-actively-maintained upstream — acceptable for `jsqr` given its small, frozen, dependency-free surface, but worth a `checkpoint:human-verify` per the Package Legitimacy Gate default for any WebSearch-sourced name [ASSUMED] |
| `jsqr` | `qr-scanner` (npm, wraps jsQR + a Web Worker) | Slightly larger, but moves decoding off the main thread and has a documented `BarcodeDetector`-first-then-fallback mode built in — a reasonable upgrade if the plain `jsqr` + `requestAnimationFrame` loop turns out to jank on low-end Android devices in practice; not chosen here to keep the new dependency surface minimal (ladder rung 6/7) |
| New QR encoder | `qrcode.react` / canvas-based client encoder | Unnecessary — the plate is print-only and server-rendering SVG is both simpler and keeps zero QR-encoding bytes in any client bundle |

**Installation:**
```bash
npm install jsqr
```
(`qrcode` and `@types/qrcode` already installed — no action.)

**Version verification:** `npm view jsqr version license scripts.postinstall repository.url time.modified` → `1.4.0`, `Apache-2.0`, no postinstall, `git+https://github.com/cozmo/jsQR.git`, published 2025-11-13. `npm view qrcode dist.unpackedSize version time.modified` → `1.5.4`, same publish date (both were bumped together, likely a routine dependency refresh, not evidence of anything).

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `jsqr` | npm | published 2025-11-13 per registry metadata (the underlying project/repo is older — `cozmo/jsQR` is a long-standing, widely-used library; the npm publish date reflects a recent routine version bump, not a new package) | not measured this session | `github.com/cozmo/jsQR` [VERIFIED: `npm view jsqr repository.url`] | `[OK]` [VERIFIED: `slopcheck install jsqr` → "1 OK", ran live this session] | Approved |
| `qrcode` | npm | already installed, in production use since before this phase | n/a (pre-existing dependency) | not re-checked — out of scope, already shipped | not run (pre-existing, not a new install) | Approved (no action — already in `dependencies`) |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

slopcheck ran successfully this session (`slopcheck install jsqr`) and returned `[OK]`. Note the package NAME `jsqr` itself was sourced via WebSearch/training knowledge (not Context7/official docs), so per the provenance rule it is tagged `[ASSUMED]` in the Standard Stack table above despite the clean slopcheck + registry verification — the planner should still gate the `npm install jsqr` step behind a `checkpoint:human-verify` per the graceful-degradation default, even though slopcheck itself did not flag it.

## Architecture Patterns

### System Architecture Diagram

```
Worker's phone (logged out)
      │  scans plate / opens bookmarked /m/<code>
      ▼
proxy.ts → middleware.ts updateSession()
      │  no session claims → redirect(/login?next=/m/<code>)   [NEW — currently drops the path]
      ▼
LoginPage (server component, reads searchParams.next)
      │  passes next to <LoginForm next={next} />
      ▼
LoginForm (client) → loginWithEmail(data, next)  [next threaded through the form submit]
      │  server action: sign in, then
      │  redirect(isSafeNext(next) ? next : roleHome(role))    [NEW — currently always roleHome()]
      ▼
/m/[code]/page.tsx (server component)
      │  getSessionContext() → organisationId
      │  SELECT site_machines WHERE code = <code> AND organisation_id = orgId
      │  no row → notFound()
      ▼
Machine detail render (department colour, name, sprite/no-photo, SOP rows
  to-do first via plantRelState + RelBadge, Walk it → /sops/[id]?tab=walk)

──────────────────────────────────────────────────────────────────────

Worker's phone (logged in, <1024px, org has a drawn site)
      │
/sops/page.tsx (existing render seam)
      │  useViewport() === 'mobile'  +  ['site-worker'] query (gate WIDENED
      │  from desktop-only to include mobile — same query, same data)
      ▼
PhoneHome (new next/dynamic({ssr:false}) module, 4th slot beside
  SopWorkerBrowser / AdminSopSurface / PlantHome)
      │
      ├─ ask bar (mic → same WalkthroughVoiceModal dynamic-import pattern
      │           PlantAskBar already established)
      ├─ NowCard variant (Walk it / Read only — "Show me" suppressed)
      ├─ floor thumbnail (<img loading="lazy">, tap opens sheet)
      │        │
      │        ▼
      │   DepartmentBottomSheet-style sheet: machines grouped by
      │   department, pin counts, row tap → router.push(`/m/${code}`)
      └─ "Scan a machine plate" button
               │
               ▼
      Scan sheet (new next/dynamic({ssr:false}) module — NEVER in
        /sops or /sops/[sopId] base bundle)
               │  getUserMedia({video:{facingMode:'environment'}})
               │  (mirrors VideoRecorder.tsx's startCamera/stopAllTracks)
               │
       ┌───────┴────────┐
       │ BarcodeDetector │  available (~94% Chrome) → decode directly
       │ (native)        │
       └───────┬────────┘
               │ unavailable (all iOS Safari, older browsers)
               ▼
       jsqr fallback (canvas frame grab + jsQR(), dynamic-imported)
               │
       decoded /m/<code> from OUR origin → router.push(/m/<code>)
       decoded URL from a foreign origin → "That's not a SOPstart plate"
       camera denied/unavailable/no decode → code-entry field (always
         reachable via "Type it instead", routes to /m/<code>)
```

### Recommended Project Structure
```
src/
├── app/(protected)/
│   ├── m/[code]/page.tsx                    # PHN-02 — server component, org-scoped lookup
│   └── admin/site/plate/[machineId]/
│       ├── page.tsx                         # PHN-02/D-06 — admin-gated, server-rendered QR (mirrors qr/page.tsx)
│       └── PrintButton.tsx                  # reuse or re-export the existing PrintButton pattern
├── components/sop/plant/
│   ├── PhoneHome.tsx                        # PHN-01 — new dynamic module, 4th /sops slot
│   ├── MachineListSheet.tsx                 # PHN-01/D-03 — department-grouped machine list (reuses CategoryBottomSheet chrome)
│   └── ScanSheet.tsx                        # PHN-03 — camera + BarcodeDetector/jsqr + code-entry fallback, its OWN dynamic chunk
├── lib/
│   ├── site/qr-decode.ts                    # pure: isOurPlateUrl(url), extractMachineCode(url) — unit-testable without a browser
│   └── auth/next-redirect.ts                # pure: isSafeNextPath(next) same-origin/relative-only guard
```

### Pattern 1: Widen the existing `wantsPlant` gate rather than adding a third viewport branch
**What:** `src/app/(protected)/sops/page.tsx` currently computes `wantsPlant = !isAdmin && viewport === 'desktop'` and gates the `['site-worker']` query's `enabled` on it (lines 129-136). Phase 53 needs the identical `WorkerSiteData` on mobile too.
**When to use:** Widen to `wantsSite = !isAdmin && (viewport === 'desktop' || viewport === 'mobile')` (i.e., drop the `viewport` check from `enabled` for non-admins, or split into `wantsPlant`/`wantsPhone` if the two need different staleTime/enabled semantics), then branch the render: `if (plant && viewport === 'desktop') return <PlantHome .../>` and `if (plant && viewport === 'mobile') return <PhoneHome .../>` — same `plant` data, different component, same fallback (today's stacked list) when `plant` is null.
**Example:**
```typescript
// Source: src/app/(protected)/sops/page.tsx:129-140 (current, desktop-only)
const viewport = useViewport()
const wantsPlant = !isAdmin && viewport === 'desktop'
const { data: siteResult } = useQuery({
  queryKey: ['site-worker'],
  queryFn: () => listSiteForWorker(),
  enabled: wantsPlant,
  staleTime: 30 * 60 * 1000,
})
```

### Pattern 2: Server-rendered SVG QR (no client JS) — copy `qr/page.tsx` verbatim, swap the URL and add `@page`
**What:** The existing `/admin/sops/[sopId]/qr/page.tsx` is a complete, working reference for D-06.
**When to use:** `/admin/site/plate/[machineId]/page.tsx`.
**Example:**
```typescript
// Source: src/app/(protected)/admin/sops/[sopId]/qr/page.tsx:35-44 (existing, working)
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://sopstart.com').replace(/\/$/, '')
const workerUrl = `${siteUrl}/sops/${sop.id}`   // -> Phase 53: `${siteUrl}/m/${machine.code}`

const qrSvg = await QRCode.toString(workerUrl, {
  type: 'svg',
  errorCorrectionLevel: 'M',
  margin: 1,
  color: { dark: '#09090b', light: '#ffffff' },
})
// ... dangerouslySetInnerHTML={{ __html: qrSvg }} — safe: our own generated data, not user input
```
The existing page's print CSS (`@media print { header, nav, footer, .no-print { display: none !important } }`) hides chrome but has **no `@page` rule** — it relies on the sticker's own fixed Tailwind width (`w-85`) plus the browser's default page size/margins. For an A6 plate, add:
```css
@media print {
  @page { size: A6; margin: 8mm; }
  header, nav, footer, .no-print { display: none !important }
  body { background: white }
}
```
and use `requireAdminContext()` (the current shared gate, used by `/admin/site/page.tsx`) rather than the older manual `if (!role || !['admin','safety_manager'].includes(role)) redirect('/dashboard')` inline check the `qr/page.tsx` still carries pre-dating that shared guard (see Common Pitfalls).

### Pattern 3: Camera acquisition/teardown — mirror `VideoRecorder.tsx`, not a fresh implementation
**What:** `src/components/admin/VideoRecorder.tsx` already has the exact `getUserMedia`/`stopAllTracks`/permission-error-branch shape the scan sheet needs (video-only, no audio, for the scan sheet).
**Example:**
```typescript
// Source: src/components/admin/VideoRecorder.tsx:104-123 (existing, working — video+audio;
// the scan sheet needs video only, drop `audio: true`)
const startCamera = useCallback(async (facing: 'environment' | 'user') => {
  stopAllTracks()
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: facing },
    })
    streamRef.current = stream
    if (videoRef.current) videoRef.current.srcObject = stream
    setRecorderState('ready')
  } catch (err) {
    const name = err instanceof Error ? err.name : ''
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      setRecorderState('permission-denied')   // -> Phase 53: show the code-entry fallback (D-08)
    } else {
      setErrorMessage('Could not access camera. Please check your device settings.')
      setRecorderState('error')
    }
  }
}, [stopAllTracks])
```
`stopAllTracks` (referenced above, defined nearby in the same file) iterates `streamRef.current.getTracks().forEach(t => t.stop())` — call this on sheet close/unmount per D-09.

### Anti-Patterns to Avoid
- **Reusing `NowCard`/`MachinePanel` with their existing className unmodified on the phone home.** Both are `absolute`-positioned overlays sized for the desktop `PlantStage`'s `relative` container (`NowCard`: `absolute bottom-4 left-4 w-82.5`; `MachinePanel`: `absolute inset-y-0 right-0 w-95`, i.e. a fixed 380px panel). Dropped into a phone's normal stacked column, `absolute` positioning will overlap or vanish depending on the nearest `relative` ancestor. Extract a shared "content" sub-component (badge + title + meta + links) and let each parent (`PlantHome`'s overlay vs `PhoneHome`'s stacked column) own its own outer wrapper/positioning — or add a `variant` prop. Do not copy-paste the whole file.
- **Client-routing camera decode results with a bare `router.push`.** CONTEXT D-07 explicitly sanctions `router.push` here as a one-off navigation (not a hot loop), which is consistent with the codebase's 2026-05-13 learning (`router.push` on search-param changes triggers an RSC fetch under Serwist and feels slow on *hot* click paths) — that learning is about repeated/hot navigation, not a single post-scan redirect, so `router.push(\`/m/${code}\`)` here is fine and is NOT the anti-pattern the 2026-05-13 note warns about. Do not over-apply that learning and build a bespoke `history.replaceState` scheme for a one-shot scan result — that would be solving a problem this call site doesn't have.
- **Trusting `next` from the query string without a same-origin check.** Any server action or middleware step that reads `?next=` and redirects to it unchecked is an open-redirect vector. `isSafeNextPath` must require a string starting with `/` (not `//`, not `/\`) and must not itself be `/login`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| QR encoding | A canvas-based/client QR generator | `qrcode`'s server-side `toString({ type: 'svg' })` | Already installed, already proven in production (`qr/page.tsx`), crisp at any print size, zero client bytes |
| QR/barcode decoding | A bespoke pixel-scanning decoder | `BarcodeDetector` (native) with `jsqr` fallback | QR decoding (finder patterns, Reed-Solomon error correction, format/version detection) is a genuinely complex, well-solved problem — this is the canonical "don't hand-roll" case, not a borderline one |
| Bottom-sheet chrome for the machine list | A new sheet component from scratch | `DepartmentBottomSheet`/`DepartmentSidebar` from `src/components/sop/CategoryBottomSheet.tsx` (D-03 explicitly names this idiom) | Slide-up panel, backdrop, handle, Done-button-commits-draft pattern already exists and is already responsive (`lg:hidden` mobile sheet / desktop sidebar split) |
| Camera stream lifecycle | New `getUserMedia` wrapper | Mirror `VideoRecorder.tsx`'s `startCamera`/`stopAllTracks`/error-branch shape | Same browser API, same failure modes (`NotAllowedError`), already handles the permission-denied branch this phase needs for D-08 |
| Login redirect destination logic | A new "return to" mechanism | Extend the existing `roleHome()`/`loginWithEmail` redirect call site with one `next` parameter | `roleHome` is already the single place role→destination is decided (per its own header comment); adding a `next` override in front of it is additive, not a parallel system |

**Key insight:** Every piece of new infrastructure this phase needs already has a working sibling in the codebase (QR generation, camera capture, bottom sheets, the render-seam gate). The actual net-new code is: (1) the phone layout composition, (2) `/m/[code]`'s lookup query, (3) the decoder's origin-check + code-extraction logic, and (4) the `next`-param plumbing through 3 files. Everything else is reuse with parameter changes.

## Common Pitfalls

### Pitfall 1: `NowCard`'s `onShowMe` prop is required — there is no way to suppress "Show me" today
**What goes wrong:** CONTEXT D-02 says the phone Now card shows "Walk it / Read, no Show me." `NowCard`'s signature is `{ items, onShowMe }: { items: NowItem[]; onShowMe(machineId: string): void }` (`src/components/sop/plant/NowCard.tsx:29`) and it renders the "Show me" button whenever `now.machine` is truthy (line ~79), calling `onShowMe` unconditionally — there's no prop to hide it.
**Why it happens:** `NowCard` was built in 52-03 purely for the desktop `PlantStage` use case, where "Show me" flies the camera; the phone has no camera/scene to fly.
**How to avoid:** Add an optional prop (e.g. `showMeAction?: (machineId: string) => void` — omit the button when absent) rather than forking the component, so both callers stay on one source of truth for the card's copy/badge/meta logic.
**Warning signs:** If the plan instructs "pass `onShowMe` as a no-op" instead of adding the prop, the button will still render and do nothing when tapped — a dead affordance, the exact class of bug the 2026-06-05 CLAUDE.md learning (dead `onClick`) warns about.

### Pitfall 2: `MachinePanel` is a 380px absolute overlay, not a page layout — don't import it into `/m/[code]` unmodified
**What goes wrong:** CONTEXT D-04 says `/m/[code]`'s client rendering should show "department in zone colour, machine name, sprite... SOP rows... `RelBadge`... Walk it/Read" — which is exactly what `MachinePanel` already renders. But `MachinePanel`'s root element is `<aside className="absolute inset-y-0 right-0 z-20 flex w-95 ...">` (`src/components/sop/plant/MachinePanel.tsx:40`) — a slide-in overlay assuming a `relative`-positioned ancestor the size of the whole plant stage. Rendered as a normal page, it either has no positioning context (renders at the viewport's edge, fixed 380px wide, useless on a 390px phone) or needs its wrapper stripped.
**Why it happens:** Same root cause as Pitfall 1 — built for one call site (`PlantHome`), not designed as a shared content component yet.
**How to avoid:** Extract the inner content (sprite/department/name/SOP-rows block, roughly lines 44+ inside the `{machine && (<>...</>)}` block) into a plain non-positioned component both `MachinePanel` (desktop overlay, wraps the extracted content in its `absolute` shell) and `/m/[code]`'s page (wraps it in normal page-flow markup) can render.
**Warning signs:** If `/m/[code]` visually looks like a 380px column pinned to one edge of a much wider or narrower viewport, or content is clipped, the unmodified `MachinePanel` wrapper was imported.

### Pitfall 3: Login redirect drops the destination today — a scanned plate is lost for a logged-out worker unless three files change
**What goes wrong:** `src/lib/supabase/middleware.ts:47` does `NextResponse.redirect(new URL('/login', request.url))` with no query string at all. `src/app/(auth)/login/page.tsx` destructures only `registered` from `searchParams`. `src/actions/auth.ts`'s `loginWithEmail` (~line 116) does `redirect(roleHome(claims['user_role'] as string | undefined))` unconditionally — no `next` is read or honored anywhere in the chain.
**Why it happens:** This path was never exercised before Phase 53 — every existing entry point into the app assumes login lands on the role home.
**How to avoid:** Three additive edits: (1) middleware appends `?next=${encodeURIComponent(path + search)}` when redirecting an unauthenticated request (guard: only for non-public routes, and validate the resulting path is same-origin/relative before ever redirecting to it downstream); (2) `LoginPage` (already a server component) reads `next` from its `searchParams` prop and passes it to `<LoginForm next={next} />` — no client `useSearchParams`/Suspense boundary needed, sidestepping the exact gotcha the 2026-04-04 `InviteAcceptForm` CLAUDE.md learning describes; (3) `loginWithEmail` accepts an optional `next` argument and redirects to it (after `isSafeNextPath` validation) instead of `roleHome(role)` when present.
**Warning signs:** A source-contract test asserting `loginWithEmail` calls `redirect(` with something other than a bare `roleHome(...)` call, and an integration test that logs in from `/login?next=/m/ABC123` and asserts the final URL is `/m/ABC123`, not the role home.

### Pitfall 4: `BarcodeDetector` has zero WebKit support — this is not a rare-device edge case for this app's audience
**What goes wrong:** Treating the `jsqr`/code-entry fallback as a "just in case" safety net rather than the primary path for a meaningful fraction of real users. Safari and WebKit (all iOS browsers, since Apple mandates WebKit for all iOS browser engines) do not implement `BarcodeDetector` at all — WebKit bug tracking shows it "Under Consideration" since 2024 with no shipped date [CITED: MDN Barcode Detection API page + WebSearch summary of caniuse/Chrome Platform Status, 2026-09-29].
**Why it happens:** Feature-detection code that silently degrades to "camera works but nothing ever decodes" if the `jsqr` path isn't wired with equal care to the `BarcodeDetector` path.
**How to avoid:** Test the scan sheet explicitly on the `jsqr` path (not just the `BarcodeDetector` path) before considering PHN-03 done — in dev, force this by feature-detecting `'BarcodeDetector' in window` and adding a temporary override, or simply test in a browser context that lacks it. The deployed eval (D-12) should exercise the *camera-unavailable* fallback (code entry), but that alone does not prove the `jsqr` decode path itself works — consider a unit test for `jsqr`'s output shape against a known QR image if `jsqr` is wired to run in both browsers and Node-side tests.
**Warning signs:** A phone that opens the camera, shows a preview, but never navigates on a valid scan — decode silently failing is indistinguishable from "hasn't found the code yet" without an explicit fallback/error state.

### Pitfall 5: A header/doc comment that names the thing it's proving absent trips the guard it's describing (recurring class, hit 3+ times in Phases 51/52)
**What goes wrong:** Comments in `PlantStage.tsx`, `MachinePanel.tsx`, and a 51-02 migration all self-tripped their own deny-list/grep guards by quoting the banned literal while explaining its absence (e.g. naming `konva-worker-isolation.spec.ts`'s path, or writing "no owner/version lines").
**Why it happens:** `tests/lint/*.spec.ts` guards grep the whole file's raw text, not just executable code — a comment describing what's NOT there is textually indistinguishable from code that IS.
**How to avoid:** When writing the scan sheet / phone home / plate page, if any bundle-marker or lint-guard literal needs to be referenced in a comment (e.g. explaining why Konva/the admin canvas is absent from a worker-tier file), paraphrase instead of quoting.
**Warning signs:** A newly-written file fails its own just-added source-contract spec on the first run with no functional code change — check the file's own comments first.

## Code Examples

### Widening the render-seam gate (Pattern 1, full context)
```typescript
// Source: src/app/(protected)/sops/page.tsx:119-140 (current state, to be extended)
export default function SopsPage() {
  const isAdmin = useIsAdmin()
  const viewport = useViewport()
  const wantsPlant = !isAdmin && viewport === 'desktop'
  // Phase 53: also fetch for mobile. Simplest: drop the viewport check,
  // since 'mobile' is the useViewport() default during SSR/first paint
  // anyway (D-04 in useViewport.ts docs) — a query enabled for isAdmin===false
  // regardless of viewport, branching only at render time on which
  // component (PlantHome vs PhoneHome) consumes plantSite.
  const { data: siteResult } = useQuery({
    queryKey: ['site-worker'],
    queryFn: () => listSiteForWorker(),
    enabled: !isAdmin,          // was: wantsPlant
    staleTime: 30 * 60 * 1000,
  })
```

### `/m/[code]/page.tsx` server-side lookup shape (new, following `getSessionContext()` precedent)
```typescript
// Pattern source: src/app/(protected)/admin/sops/[sopId]/qr/page.tsx:19-33
//                 (session read + redirect-if-unauthenticated shape)
// + supabase/migrations/00067_site_model.sql:59
//                 (site_machines.code text not null unique check (code ~ '^[0-9A-HJKMNP-TV-Z]{6}$'))
export default async function MachinePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const { supabase, userId, organisationId } = await getSessionContext()
  if (!userId) redirect(`/login?next=${encodeURIComponent(`/m/${code}`)}`)
  if (!organisationId) notFound()

  const { data: machine } = await supabase
    .from('site_machines')
    .select('id, name, department_id, sprite_asset_path')
    .eq('code', code.toUpperCase())      // MACHINE_CODE_PATTERN is uppercase; be permissive on input case
    .eq('organisation_id', organisationId)   // belt-and-braces on top of RLS
    .maybeSingle()
  if (!machine) notFound()
  // ... then the SOP list via sop_machines, worker-signal.ts's plantRelState, etc.
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `ZXing`-family JS decoders as the only option | Native `BarcodeDetector` Web API for supporting browsers, JS fallback only for the rest | Chrome 134 (early 2026) shipped `BarcodeDetector` without a flag/origin trial [CITED: WebSearch summary of Chrome Platform Status] | A JS decoder is no longer the primary code path on most Android/Chrome devices — it becomes a fallback layer, changing both the bundle-cost calculus (fallback can be a smaller/simpler library since it's the less-hit path) and the UX (native decode is typically faster/more reliable on multi-angle real-world lighting) |

**Deprecated/outdated:** Neither `jsqr` nor `@zxing/library`/`zxing-js` has had recent active upstream development per this session's WebSearch summary ("jsQR is dead, zxing-js is dead") — both are usable as frozen, working, small dependencies for a narrow QR-only use case, but neither should be treated as a long-term-maintained foundation; re-evaluate if a future phase needs 1D barcode support or Web Worker offloading (`qr-scanner` is the actively-suggested upgrade path per the Alternatives Considered table).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `jsqr` (the npm package name) is the correct choice among QR decoder libraries — sourced via WebSearch/training knowledge, then confirmed to exist on the npm registry and pass `slopcheck` | Standard Stack, Package Legitimacy Audit | Low — slopcheck `[OK]` + registry verification substantially de-risks a wrong/hallucinated name; residual risk is "a better-maintained alternative exists that this research didn't surface," not "this package doesn't exist or is malicious" |
| A2 | `BarcodeDetector` Chrome/Android support figure ("~94% of global Chrome installs as of June 2026") | Standard Stack, State of the Art, Pitfall 4 | Low-medium — sourced from a WebSearch summary of Chrome Platform Status rather than a direct fetch of that page; the qualitative conclusion (strong Chrome/Android support, zero WebKit support) is corroborated by multiple independent sources in the same search and is the load-bearing fact (mandates the fallback), not the exact percentage |
| A3 | `router.push` for the one-shot post-scan navigation is acceptable and does not trigger the 2026-05-13 "hot click path" RSC-fetch-under-Serwist slowness CLAUDE.md warns about | Anti-Patterns | Low — that learning's own text scopes it to "hot click paths" / "frequently-changing UI state"; a single scan-to-navigate event is neither. If the planner is unsure, a deployed-eval timing check on the scan → navigate step would resolve it directly |

## Open Questions (RESOLVED 2026-09-29 — Q1: simplify the ['site-worker'] gate to `enabled: !isAdmin`, both viewports; Q2: NowCard `onShowMe` becomes optional and the button renders only when provided)

1. **Should the `['site-worker']` query's `enabled` condition be simplified to `!isAdmin` (fetch for all non-admin viewports) or split into two distinctly-gated queries for desktop vs. mobile?**
   - What we know: The data (`WorkerSiteData`) is identical for both; Phase 52 gated it to desktop only because phone had no consumer yet.
   - What's unclear: Whether there's a reason (e.g., avoiding an unnecessary fetch for orgs where the admin already knows mobile workers won't have a site drawn) to keep them separate.
   - Recommendation: Simplify to one `enabled: !isAdmin` condition — CONTEXT D-01 explicitly says "gated by `useViewport()` + the `['site-worker']` query already on the page," implying reuse of the same query, and the data cost is identical either way (one row set, 30-min staleTime).

2. **Where does `NowCard`'s "Show me" suppression prop belong — a new optional callback, or a boolean flag?**
   - What we know: `onShowMe` is currently required; the phone needs it absent.
   - What's unclear: Whether a future admin-repaint phase (54) also needs a variant without "Show me" — if so, a `variant: 'plant' | 'phone'` prop might read better than an optional-callback pattern.
   - Recommendation: Start with the optional-callback shape (`showMeAction?: (id: string) => void`, button renders `showMeAction && machine`) — it's the smaller diff and composes fine if Phase 54 needs something similar later.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `getUserMedia` (browser API) | Scan sheet camera access | ✓ (all modern mobile browsers) | n/a | Code-entry field (D-08) when denied/unavailable — this fallback is mandatory design, not optional |
| `BarcodeDetector` (browser API) | Fast native QR decode | ✗ on iOS Safari/WebKit; ✓ on ~94% of Chrome | n/a | `jsqr` JS decoder (this phase's new dependency) |
| `next.config.ts` Permissions-Policy header | Camera access is not blocked by any CSP/Permissions-Policy | ✓ — no `headers()` function exists in `next.config.ts` at all today, so no restrictive Permissions-Policy is set; default browser permission-prompt flow applies | n/a | — |
| Serwist service worker (`src/app/sw.ts`) | Confirm it doesn't intercept `getUserMedia` | ✓ — service workers cannot intercept `getUserMedia` (it is not a `fetch`), no risk here | n/a | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** `BarcodeDetector` on iOS Safari — fallback is `jsqr` (both routes must be implemented; neither is optional for this app's audience per Pitfall 4).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright (`@playwright/test`), project-per-phase convention |
| Config file | `playwright.config.ts` — Phase 53 needs a new `phase53` project registered with a broad `tests/phase53/**` testMatch (mirrors the 52-02 `phase26` note: "single registration point for the whole phase") |
| Quick run command | `npx playwright test --project=phase53` |
| Full suite command | `npx playwright test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PHN-01 | Phone home renders ask bar, Now card (no Show me), thumbnail, Scan button below 1024px for a worker with a drawn site | source-contract + deployed eval | `npx playwright test --project=phase53 tests/phase53/phone-home.spec.ts` + `npm run eval -- --phase 53` | ❌ Wave 0 |
| PHN-01 | Org with no site keeps today's stacked list unchanged on phone | source-contract (negative case) | `npx playwright test --project=phase53 tests/phase53/phone-home-fallback.spec.ts` | ❌ Wave 0 |
| PHN-01 | Thumbnail tap opens department-grouped machine list sheet; row tap navigates to `/m/<code>` | source-contract (handler wiring) | `npx playwright test --project=phase53 tests/phase53/machine-list-sheet.spec.ts` | ❌ Wave 0 |
| PHN-02 | `/m/[code]` looks up the machine org-scoped, 404s on absent/foreign code | live runtime probe (mirrors `tests/phase51/site-model-rls-runtime.spec.ts`'s cross-org denial pattern) | `npx playwright test --project=phase53 tests/phase53/m-code-org-scope.spec.ts` | ❌ Wave 0 |
| PHN-02 | Plate page renders QR + code fallback, admin-gated, A6 print size | source-contract + deployed eval (print-size screenshot) | `npx playwright test --project=phase53 tests/phase53/plate-page.spec.ts` + `npm run eval -- --phase 53` | ❌ Wave 0 |
| PHN-02 | Login redirect preserves `?next=/m/<code>` through sign-in | live integration test | `npx playwright test --project=phase53 tests/phase53/login-next-redirect.spec.ts` | ❌ Wave 0 |
| PHN-03 | Scan sheet opens camera, decodes via `BarcodeDetector` or `jsqr`, routes on our-origin `/m/<code>`, rejects foreign origins | unit test (pure `isOurPlateUrl`/`extractMachineCode`) + source-contract (handler wiring) | `npx playwright test --project=phase53-unit tests/phase53/qr-decode.test.ts` (if a `phase53-unit` project is added, mirroring `phase27-unit`/`phase35-unit`) | ❌ Wave 0 |
| PHN-03 | Camera denied/unavailable shows code-entry fallback, always reachable via "Type it instead" | deployed eval (headless Chromium without camera permission granted) | `npm run eval -- --phase 53` | ❌ Wave 0 |
| PHN-03 | Scan sheet, decoder, camera stream never enter `/sops/page` or `/sops/[sopId]/page` base bundle | build-time bundle gate | `npm run build` (via `scripts/check-bundle-size.ts`'s new forbidden-marker group) | ❌ Wave 0 (add the marker group) |

### Sampling Rate
- **Per task commit:** `npx playwright test --project=phase53`
- **Per wave merge:** full suite (`npx playwright test`) + `npx tsc --noEmit` + `npm run build`
- **Phase gate:** Full suite green + `npm run eval -- --phase 53` (screenshots inspected, not just asserted) before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/phase53/*.spec.ts` — stub files for every row above, registered under a new `phase53` Playwright project (broad `tests/phase53/**` testMatch)
- [ ] `src/lib/site/qr-decode.ts` — pure `isOurPlateUrl`/`extractMachineCode` logic, needed before any unit test can exist; consider a `phase53-unit` project mirroring `phase27-unit` if these need static `@/` import resolution outside the stub-project's TS-compile scope
- [ ] `tests/evals/phone-home.eval.ts` — the deployed eval named in CONTEXT D-12, at 390×844
- [ ] Camera-unavailable simulation for the eval: use Playwright's default (a fresh `BrowserContext` created WITHOUT `grantPermissions(['camera'])` — `getUserMedia` will reject with `NotAllowedError` exactly as a real user denying the prompt would) rather than `--use-fake-device-for-media-stream`, which supplies a *working* fake camera and would exercise the happy path, not the fallback. No existing eval in this codebase currently grants or denies camera permission — this is new territory for `tests/evals/lib/session.ts`.
- [ ] `scripts/check-bundle-size.ts` — new forbidden-marker group (e.g. label `'scan sheet (53 D-09)'`) on both `/sops/page` and `/sops/[sopId]/page` `GATED_ROUTES` entries, using a literal string unique to the scan sheet (verify uniqueness via grep before choosing, per the established pattern at lines 74-101)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `getSessionContext()` (existing shared helper) gates `/m/[code]`; unauthenticated → `/login?next=` |
| V3 Session Management | no | No new session mechanism introduced |
| V4 Access Control | yes | Org-scoped `.eq('organisation_id', organisationId)` on the `site_machines` lookup in `/m/[code]`, belt-and-braces on top of RLS (mirrors the codebase's established "self-enforce org-scope even under RLS" convention, e.g. `tests/phase51/site-model-rls-runtime.spec.ts`'s cross-org denial probes) |
| V5 Input Validation | yes | `MACHINE_CODE_PATTERN` (`/^[0-9A-HJKMNP-TV-Z]{6}$/`, already defined in `src/lib/site/scene.ts:25`) should validate the `code` route param before it reaches the DB query; the decoder's `isOurPlateUrl` must validate origin AND path shape before ever calling `router.push` on a scanned value |
| V6 Cryptography | no | Machine codes are non-secret identifiers gated by session auth + org RLS, not secrets — no crypto requirement beyond the existing `crypto.getRandomValues` used in `newMachineCode()` for unbiased generation (already shipped, Phase 51) |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Open redirect via unchecked `?next=` param | Tampering / Spoofing | `isSafeNextPath()` must require the value to start with `/` (not `//` or `/\`, which browsers can interpret as protocol-relative), reject any value containing `://`, and never redirect to `/login` itself (redirect loop) |
| Machine-code enumeration (guessing valid 6-char codes to probe other orgs' machines) | Information Disclosure | Already mitigated structurally: `site_machines` RLS + the explicit `.eq('organisation_id', …)` self-enforcement mean a guessed code from another org still returns `notFound()` — no distinguishing error message between "code doesn't exist" and "code exists in another org" (both must 404 identically; verify this in the runtime probe test) |
| Malicious/foreign QR code scanned in the app's camera sheet, crafted to look like a `/m/<code>` URL but pointing at an attacker-controlled origin | Spoofing | D-07's origin check (`isOurPlateUrl`) must compare against the actual deployed origin (`NEXT_PUBLIC_APP_URL` or `window.location.origin`), never a hardcoded string, and must reject on any mismatch with the stated user-facing message rather than silently attempting navigation |
| `dangerouslySetInnerHTML` for the QR SVG | Tampering (XSS) | Already a safe pattern in the existing `qr/page.tsx` — the SVG string comes from `qrcode`'s own encoder fed our own server-constructed URL (never raw user input); the same constraint applies to the new plate page — never interpolate anything user-supplied into the encoded URL beyond the already-validated `machine.code`/`sop.id` |

## Sources

### Primary (HIGH confidence)
- `src/app/(protected)/admin/sops/[sopId]/qr/page.tsx` — existing, shipped, working QR-generation pattern
- `src/components/admin/VideoRecorder.tsx` — existing, shipped `getUserMedia`/teardown pattern
- `src/lib/supabase/middleware.ts`, `src/app/(auth)/login/page.tsx`, `src/components/auth/LoginForm.tsx`, `src/actions/auth.ts` — read directly to confirm the `next`-param gap
- `src/app/(protected)/sops/page.tsx`, `src/components/sop/plant/{NowCard,MachinePanel,PlantHome}.tsx` — read directly for exact prop signatures and CSS positioning
- `supabase/migrations/00067_site_model.sql` — `site_machines.code` column definition
- `src/lib/site/scene.ts` — `MACHINE_CODE_PATTERN`, `newMachineCode`, `SCENE_BUCKET`
- `scripts/check-bundle-size.ts` — `GATED_ROUTES` structure, existing forbidden-marker groups
- npm registry (`npm view jsqr ...`, `npm view qrcode ...`) — version/license/postinstall/repo verification
- `slopcheck install jsqr` — ran live this session, `[OK]`
- Phase 51/52 SUMMARY.md files (`.planning/phases/51-site-model-machine-editor/`, `.planning/phases/52-worker-home-the-plant/`) — verified decisions and exact file/line provenance

### Secondary (MEDIUM confidence)
- WebSearch: "BarcodeDetector API browser support Chrome Android iOS Safari 2026 caniuse" — Chrome 134/94%-of-Chrome-installs figure and WebKit non-support, cross-referenced against MDN's Barcode Detection API page in the same result set
- WebSearch: "jsqr vs zxing-js browser bundle size npm QR code decoder comparison" — maintenance-status and relative-size characterization of `jsqr`/`zxing-js`/`qr-scanner`

### Tertiary (LOW confidence)
- none — every claim above was either verified against the live codebase/registry or cited to a specific search result; no bare training-knowledge assertions were left unflagged

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — `qrcode` already shipped and in use; `jsqr` version/license/postinstall verified via npm registry and slopcheck `[OK]`
- Architecture: HIGH — the render seam, gate pattern, and all reused components were read directly from source, not inferred from summaries
- Pitfalls: HIGH — every pitfall traces to a specific file/line read this session, not speculation
- Security: MEDIUM-HIGH — the org-scope/RLS pattern is directly verified from Phase 51's live runtime probes; the open-redirect mitigation is a standard control, not verified against a Phase-53-specific implementation (none exists yet)

**Research date:** 2026-09-29
**Valid until:** 30 days (stable domain — no fast-moving dependency; re-check `BarcodeDetector` WebKit status if this phase slips past ~Q1 2027, as that is the one externally-moving fact)
