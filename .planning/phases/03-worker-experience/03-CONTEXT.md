# Phase 3: Worker Experience - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Workers can find, walk through, and browse assigned SOPs on their phone — including offline. Admins can assign SOPs to roles and individual workers, upload new versions, and workers see the latest version automatically. This phase delivers the core worker-facing experience: SOP library with search, step-by-step walkthrough with safety-first design, quick reference mode, offline caching, SOP assignment, and versioning. No completion tracking or sign-off — that's Phase 4.

</domain>

<decisions>
## Implementation Decisions

### Walkthrough UX
- **D-01:** Scrolling list layout — all steps visible in a scrollable list, workers tap to mark each step complete. Not card-swiping.
- **D-02:** Safety is the primary function — best-in-class safety presentation. This means:
  - Mandatory safety card(s) shown before any procedure steps — worker must acknowledge hazards/PPE before starting
  - High-visibility hazard and PPE callouts using brand-orange and warning colours
  - Persistent safety summary visible during walkthrough (collapsible but always accessible)
  - Warning/caution annotations on individual steps displayed prominently (not hidden)
- **D-03:** Images display inline below step text — tap to zoom full-screen
- **D-04:** Step counter at top: "Step 3 of 12" with progress bar
- **D-05:** Full-screen walkthrough interface optimised for one-handed use (from Phase 1 D-19: 72px+ tap targets, bottom-anchored actions)

### Search & Library
- **D-06:** Claude's discretion on SOP list layout (cards vs list — pick what works best for 50-500 SOPs on mobile)
- **D-07:** Search icon — tap magnifying glass to open search, keeps the list clean by default
- **D-08:** Category sidebar — collapsible sidebar on desktop, bottom sheet on mobile for category/department filtering
- **D-09:** Quick reference mode via tab bar at top of SOP: tabs for each section type (Hazards / PPE / Steps / Emergency / etc.) — always visible when viewing an SOP
- **D-10:** Workers see only assigned SOPs (from Phase 1 D-11) — assigned SOPs are the full library for workers

### Assignment & Versioning
- **D-11:** Admins can assign SOPs to roles AND/OR individual workers (both assignment types supported)
- **D-12:** Role-based assignment: assign SOP to a role (e.g., "Machine Operator") — all workers with that role see it
- **D-13:** Individual assignment: assign SOP directly to specific workers
- **D-14:** Version updates are silent (auto-update) — latest version replaces the old one, no notification banner
- **D-15:** Mid-walkthrough version update: Claude's discretion on safest approach for safety-critical SOPs (recommendation: let worker finish on current version, show new version next time they open it)

### Offline Behaviour (not discussed — Claude's discretion)
- **D-16:** Offline caching approach: Claude's discretion, following research patterns (Dexie.js + service worker caching from project research)
- **D-17:** Sync behaviour when coming back online: Claude's discretion
- **D-18:** Offline status indicator already exists from Phase 1 (OnlineStatusBanner component)

### Claude's Discretion
- SOP list layout style (cards vs compact list)
- Exact search UI behaviour (instant filter vs submit)
- Category sidebar/bottom sheet design details
- Offline caching strategy and sync patterns (follow project research: Dexie.js + @serwist/next)
- Per-SOP cache readiness indicator design
- Mid-walkthrough version update handling (safest approach)
- Safety acknowledgement interaction design (checkbox, swipe, tap)
- Quick reference tab bar styling and behaviour

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Context
- `.planning/PROJECT.md` — Vision, core value, NZ market context
- `.planning/REQUIREMENTS.md` — WORK-01 through WORK-10, MGMT-01 through MGMT-07
- `.planning/ROADMAP.md` — Phase 3 details, success criteria, plan breakdown

### Research
- `.planning/research/STACK.md` — Dexie.js, @serwist/next, TanStack Query offlineFirst mode
- `.planning/research/ARCHITECTURE.md` — Offline-first data layer, SOP sync engine
- `.planning/research/PITFALLS.md` — iOS Safari storage eviction, glove-hostile UI, stale SOP versions
- `.planning/research/FEATURES.md` — Quick reference mode as differentiator, offline-first patterns

### Phase 1 Output (foundation)
- `src/stores/network.ts` — Zustand network store (online/offline state)
- `src/hooks/useOnlineStatus.ts` — Online status hook
- `src/components/layout/OnlineStatusBanner.tsx` — Offline banner
- `src/components/layout/BottomTabBar.tsx` — Bottom tab navigation
- `src/app/sw.ts` — Serwist service worker
- `src/app/globals.css` — Design tokens, industrial palette

### Phase 2 Output (SOP data)
- `src/types/sop.ts` — SOP type definitions (sections, steps, images)
- `src/lib/validators/sop.ts` — SOP schemas
- `supabase/migrations/00003_sop_schema.sql` — SOP tables with RLS
- `src/components/admin/StatusBadge.tsx` — Reusable status badge

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/stores/network.ts` — Zustand store for online/offline state (use for offline indicators)
- `src/hooks/useOnlineStatus.ts` — Hook that updates network store (already in Phase 1)
- `src/components/layout/BottomTabBar.tsx` — Bottom tab navigation (SOPs tab is the worker's entry point)
- `src/components/layout/OnlineStatusBanner.tsx` — Offline banner (already shows when offline)
- `src/components/admin/StatusBadge.tsx` — Reusable badge component
- `src/app/sw.ts` — Serwist service worker (extend for SOP caching)
- `src/types/sop.ts` — Full SOP type system (SopWithSections, SopSection, SopStep, SopImage)

### Established Patterns
- Server actions with Zod validation in `src/actions/`
- Supabase RLS with `current_organisation_id()` scoping
- React Hook Form + Zod for forms
- Tailwind v4 dark mode with industrial palette
- Presigned URL pattern for file access (from Phase 2)

### Integration Points
- Worker SOP pages live under `src/app/(protected)/sops/` route group
- Admin assignment UI lives under `src/app/(protected)/admin/`
- Dexie.js IndexedDB schema extends the existing client-side data layer
- Service worker `src/app/sw.ts` needs additional caching strategies for SOP data
- Bottom tab "SOPs" tab links to the worker's SOP library

</code_context>

<specifics>
## Specific Ideas

- **Safety-first is the brand differentiator** — The user explicitly said safety is the primary function. The walkthrough UX must make safety information impossible to miss — not just present, but unavoidable. This is not a "nice to have" design choice, it's the product's core value.
- **NZ trades context** — Workers may be in PPE, gloves, hard hats. The UI must be operable with thick gloves and in bright outdoor light or dim factory environments.
- **Quick reference tabs** — Workers doing chemical handling need to look up PPE or emergency procedure in seconds. The tab bar at top of SOP is the key differentiator vs competitors who are step-forward only.
- **Offline is essential** — Mixed connectivity NZ sites (rural factories, construction sites). SOPs must work fully offline once cached.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-worker-experience*
*Context gathered: 2026-03-25*
