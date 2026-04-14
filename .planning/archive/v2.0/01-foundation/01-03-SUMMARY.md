---
phase: 01-foundation
plan: 03
subsystem: ui
tags: [pwa, serwist, service-worker, manifest, zustand, offline, bottom-nav, ios]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: Next.js 16 app with Tailwind v4 industrial palette, Supabase auth, protected layout
provides:
  - PWA web app manifest with standalone display and amber theme
  - Serwist service worker with precaching and offline fallback
  - Placeholder PWA icons (192x192 maskable, 512x512 maskable, 192x192 any)
  - Offline fallback page at /~offline
  - Zustand network store for online/offline state
  - useOnlineStatus hook with window event listeners
  - OnlineStatusBanner component with aria-live announcement
  - BottomTabBar with SOPs/Activity/Profile tabs and 72px touch targets
  - InstallPrompt for iOS instructions and Android beforeinstallprompt
  - Protected layout updated with full shell (banner + install prompt + tab bar)
affects: [02-sop-library, 03-sop-viewer, 04-offline-sync]

# Tech tracking
tech-stack:
  added:
    - "@serwist/next ^9.5.7 — service worker compilation for Next.js"
    - "serwist ^9.5.7 — Workbox-based SW runtime (peer dep)"
  patterns:
    - "Serwist precaching: sw.ts compiled to public/sw.js via withSerwist in next.config.ts"
    - "Zustand for global network state: useNetworkStore with isOnline and setOnline"
    - "Client hook pattern: useOnlineStatus() registers window events, updates store"
    - "PWA icons: amber PNG placeholders — replace with branded icons before launch"
    - "next build --webpack required: Serwist incompatible with Next.js 16 Turbopack default"

key-files:
  created:
    - src/app/manifest.ts
    - src/app/sw.ts
    - src/app/~offline/page.tsx
    - src/stores/network.ts
    - src/hooks/useOnlineStatus.ts
    - src/components/layout/OnlineStatusBanner.tsx
    - src/components/layout/BottomTabBar.tsx
    - src/components/layout/InstallPrompt.tsx
    - public/icons/icon-192.png
    - public/icons/icon-512.png
    - public/icons/icon-192-any.png
  modified:
    - next.config.ts
    - tsconfig.json
    - package.json
    - src/app/(protected)/layout.tsx
    - src/app/layout.tsx
    - .gitignore

key-decisions:
  - "next build --webpack required: Next.js 16 defaults to Turbopack but Serwist requires webpack; fixed via build script flag"
  - "PNG icons generated via pure Node.js (canvas/sharp unavailable on Windows without native binaries)"
  - "SW disabled in development (disable: process.env.NODE_ENV === 'development') per research Pitfall 5"
  - "viewport-fit=cover added to root layout via Next.js Viewport export for iOS safe area insets"

patterns-established:
  - "PWA shell pattern: manifest.ts + sw.ts + withSerwist in next.config.ts"
  - "Network state pattern: Zustand store + useOnlineStatus hook + OnlineStatusBanner consumer"
  - "Tab bar pattern: fixed bottom nav with usePathname active detection and safe-area-inset-bottom"
  - "Install prompt pattern: iOS userAgent detection + Android beforeinstallprompt + 7-day localStorage dismissal"

requirements-completed: [PLAT-01, PLAT-02, PLAT-03]

# Metrics
duration: 5min
completed: 2026-03-23
---

# Phase 01 Plan 03: PWA Shell Summary

**Installable PWA shell with Serwist service worker precaching, offline fallback, amber-themed manifest, online/offline status banner, 72px bottom tab bar, and iOS/Android install prompt**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-23T13:24:47Z
- **Completed:** 2026-03-23T13:29:20Z
- **Tasks:** 2 of 3 (Task 3 is a human-verify checkpoint)
- **Files modified:** 16

## Accomplishments

- Fully installable PWA: `manifest.ts` with standalone display, amber theme color (#f59e0b), and three icon entries (192 maskable, 512 maskable, 192 any)
- Serwist service worker (`sw.ts`) with precaching, skipWaiting, clientsClaim, and `/~offline` fallback for uncached document requests
- Online/offline indicator: Zustand store + window event listeners + persistent `role="status"` banner with amber pulse animation
- Glove-friendly bottom tab bar: three tabs at 72px minimum height, active highlighting, iOS safe-area-inset-bottom support, fixed to viewport bottom
- iOS install instructions + Android `beforeinstallprompt` handler with 7-day localStorage dismissal

## Task Commits

Each task was committed atomically:

1. **Task 1: Configure PWA manifest, Serwist service worker, and offline fallback** - `7cb8d21` (feat)
2. **Task 2: Create online/offline status indicator, bottom tab bar, and iOS install prompt** - `0a21341` (feat)

## Files Created/Modified

- `src/app/manifest.ts` — Next.js built-in PWA manifest with PRODUCT_NAME, amber theme, 3 icons
- `src/app/sw.ts` — Serwist service worker with precaching and /~offline fallback
- `src/app/~offline/page.tsx` — Offline fallback page shown by SW when network unavailable
- `src/stores/network.ts` — Zustand store: isOnline, lastOnlineAt, setOnline
- `src/hooks/useOnlineStatus.ts` — Client hook registering window online/offline event listeners
- `src/components/layout/OnlineStatusBanner.tsx` — Fixed top banner with aria-live="polite"
- `src/components/layout/BottomTabBar.tsx` — SOPs/Activity/Profile tabs, 72px height, iOS safe area
- `src/components/layout/InstallPrompt.tsx` — iOS Safari instructions + Android native install prompt
- `src/app/(protected)/layout.tsx` — Updated to include OnlineStatusBanner, InstallPrompt, BottomTabBar
- `src/app/layout.tsx` — Added viewport-fit=cover via Viewport export
- `next.config.ts` — Wrapped with withSerwist (swSrc: src/app/sw.ts, disabled in dev)
- `tsconfig.json` — Added WebWorker to lib for service worker types
- `package.json` — Added --webpack to build script; @serwist/next and serwist installed
- `public/icons/icon-192.png` — Amber 192x192 placeholder (maskable)
- `public/icons/icon-512.png` — Amber 512x512 placeholder (maskable)
- `public/icons/icon-192-any.png` — Amber 192x192 placeholder (any)

## Decisions Made

- **next build --webpack**: Next.js 16 defaults to Turbopack which conflicts with Serwist's webpack plugin. Fixed by setting build script to `next build --webpack`. Serwist GitHub issue #54 tracks Turbopack support.
- **PNG icon generation**: Neither canvas nor sharp available on Windows without native binaries. Generated minimal valid PNG files (solid amber squares) using pure Node.js with zlib.deflateSync. Suitable as placeholders for human replacement.
- **SW disabled in dev**: `disable: process.env.NODE_ENV === 'development'` prevents aggressive caching during development (Research Pitfall 5).
- **viewport-fit=cover via Viewport export**: Next.js 15+ separates viewport from metadata exports to avoid hydration mismatches. Used `export const viewport: Viewport` in root layout.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed Turbopack/webpack conflict in Next.js 16**
- **Found during:** Task 1 (build verification)
- **Issue:** `npm run build` failed with "This build is using Turbopack, with a webpack config" — Next.js 16 enables Turbopack by default, but @serwist/next adds a webpack plugin incompatible with Turbopack
- **Fix:** Updated `package.json` build script to `next build --webpack` to force webpack mode
- **Files modified:** package.json
- **Verification:** `npm run build` exits 0
- **Committed in:** 7cb8d21 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 — blocking build issue)
**Impact on plan:** Required to enable production builds with Serwist. No scope creep.

## Issues Encountered

- Next.js 16 Turbopack default conflicts with Serwist webpack plugin — resolved by using `--webpack` flag in build script. This is a known limitation tracked in serwist/serwist#54.

## User Setup Required

None — no external service configuration required. Note: replace placeholder amber PNG icons in `public/icons/` with branded icons before public launch.

## Next Phase Readiness

- PWA shell complete and functional — installable, offline-capable, with mobile navigation
- All shell components integrated into protected layout without breaking auth guard
- Task 3 (human-verify checkpoint) pending: requires user to verify PWA installability and offline behavior in Chrome DevTools

---
*Phase: 01-foundation*
*Completed: 2026-03-23*
