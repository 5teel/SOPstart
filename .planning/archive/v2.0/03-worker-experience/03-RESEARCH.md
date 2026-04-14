# Phase 3: Worker Experience - Research

**Researched:** 2026-03-25
**Domain:** Offline-first PWA data layer, mobile SOP walkthrough UI, full-text search, SOP assignment and versioning
**Confidence:** HIGH (stack verified against installed packages, official docs, and existing codebase)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Walkthrough UX**
- D-01: Scrolling list layout — all steps visible in a scrollable list, workers tap to mark each step complete. Not card-swiping.
- D-02: Safety is the primary function — mandatory safety card(s) shown before any procedure steps; worker must acknowledge hazards/PPE before starting; high-visibility hazard and PPE callouts using brand-orange and warning colours; persistent safety summary visible during walkthrough (collapsible but always accessible); warning/caution annotations on individual steps displayed prominently (not hidden)
- D-03: Images display inline below step text — tap to zoom full-screen
- D-04: Step counter at top: "Step 3 of 12" with progress bar
- D-05: Full-screen walkthrough interface optimised for one-handed use (72px+ tap targets, bottom-anchored actions)

**Search & Library**
- D-07: Search icon — tap magnifying glass to open search, keeps the list clean by default
- D-08: Category sidebar — collapsible sidebar on desktop, bottom sheet on mobile for category/department filtering
- D-09: Quick reference mode via tab bar at top of SOP: tabs for each section type (Hazards / PPE / Steps / Emergency / etc.) — always visible when viewing an SOP
- D-10: Workers see only assigned SOPs

**Assignment & Versioning**
- D-11: Admins can assign SOPs to roles AND/OR individual workers (both assignment types supported)
- D-12: Role-based assignment: assign SOP to a role — all workers with that role see it
- D-13: Individual assignment: assign SOP directly to specific workers
- D-14: Version updates are silent (auto-update) — latest version replaces old one, no notification banner
- D-15 (discretion): Mid-walkthrough version update — let worker finish on current version, show new version next time they open it

### Claude's Discretion
- SOP list layout style (cards vs compact list)
- Exact search UI behaviour (instant filter vs submit)
- Category sidebar/bottom sheet design details
- Offline caching strategy and sync patterns (follow project research: Dexie.js + @serwist/next)
- Per-SOP cache readiness indicator design
- Mid-walkthrough version update handling (safest approach)
- Safety acknowledgement interaction design (checkbox, swipe, tap)
- Quick reference tab bar styling and behaviour

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| WORK-01 | Worker can walk through an SOP step-by-step with clear progress indication | Scrolling list + step counter + progress bar, TanStack Query offline data layer |
| WORK-02 | Worker can navigate back to previous steps during a walkthrough | Step completion state stored in Zustand/Dexie, step tap-to-uncomplete pattern |
| WORK-03 | Worker can view SOP sections (Hazards, PPE, Steps, Emergency) via tabbed quick-reference mode | Tab bar component at top of SOP view, section_type field already in schema |
| WORK-04 | Worker can jump directly to any section without walking through all steps | Tab navigation bypasses walkthrough entry, routes to `/sops/[id]/section/[type]` |
| WORK-05 | Hazard and PPE information is prominently displayed before procedure steps begin | Mandatory safety acknowledgement card before steps, brand-orange callouts |
| WORK-06 | Images and figures display inline within SOP steps with zoom capability | `yet-another-react-lightbox` with Zoom plugin, presigned URL fetching |
| WORK-07 | Worker can access cached SOPs without internet connection | Dexie.js IndexedDB store + Serwist CacheFirst for images + TanStack Query persister |
| WORK-08 | Data entered offline syncs automatically when connectivity returns | Dexie sync queue + online event listener + TanStack Query refetchOnReconnect |
| WORK-09 | All primary actions use large tap targets (72px+) usable with gloves | `--min-tap-target: 72px` CSS token already defined in globals.css |
| WORK-10 | Walkthrough uses full-screen card interface optimised for one-handed use | Full-screen route with bottom-anchored controls, hide BottomTabBar during walkthrough |
| MGMT-01 | Admin can assign SOPs to specific roles or individual workers | New `sop_assignments` table with `assignment_type` enum (role/individual) |
| MGMT-02 | Worker sees assigned SOPs first when browsing the library | Query filters on assignment tables with sort order: assigned first, then published |
| MGMT-03 | Worker can search the full SOP library by title and content | Supabase `textSearch()` with GIN-indexed `fts` tsvector column on `sops` |
| MGMT-04 | Worker can browse SOPs by category or department | Filter by `sops.category` / `sops.department` columns — already in schema |
| MGMT-05 | Admin can update an SOP by uploading a new version of the document | Re-upload flow: create new SOP record with incremented version, keep old record |
| MGMT-06 | Previous SOP versions are retained and linked to historical completions | Version history table or `superseded_by` FK on sops, never hard-delete |
| MGMT-07 | Workers are notified when an assigned SOP has been updated | In-app notification: new `worker_notifications` table, polling on app foreground |
</phase_requirements>

---

## Summary

Phase 3 builds on Phases 1 and 2's foundation to deliver the full worker-facing experience. The primary challenge is the three-way intersection of offline-first data (Dexie.js IndexedDB + Serwist service worker), a safety-critical mobile UI (72px+ glove-operable, mandatory safety acknowledgement), and SOP management features (assignment, versioning, search) that require new database tables.

The codebase already has the key building blocks: `@serwist/next` and `serwist` installed, `useNetworkStore` (Zustand) and `useOnlineStatus` hook live, `OnlineStatusBanner` renders offline state, and `BottomTabBar` provides the SOPs entry point. Dexie.js is **not yet installed** — that's Plan 03-01's first task. The existing `sop_sections.section_type` field and structured schema (sections → steps → images) directly supports the quick-reference tab model and walkthrough UI without schema changes for the read path.

New database migrations needed: `sop_assignments` (role and individual), `sop_versions` or `superseded_by` FK (version history), and `worker_notifications` (in-app update alerts). Full-text search requires a generated `fts` tsvector column on `sops` with a GIN index.

**Primary recommendation:** Install Dexie.js first (Plan 03-01), build the data layer before any UI. All UI plans (03-02 through 03-05) read from Dexie — they cannot be built in parallel with 03-01.

---

## Standard Stack

### Core (already installed)

| Library | Installed Version | Purpose | Phase 3 Role |
|---------|------------------|---------|--------------|
| `@serwist/next` | ^9.5.7 | Service worker for Next.js | Extend `sw.ts` with SOP image CacheFirst strategy |
| `serwist` | ^9.5.7 | Service worker runtime | Add `runtimeCaching` entries for SOP images and API routes |
| `@tanstack/react-query` | ^5.95.2 | Server state caching | `networkMode: 'offlineFirst'` + `experimental_createPersister` for IndexedDB persistence |
| `zustand` | ^5.0.12 | UI/local state | Walkthrough step completion state, offline sync queue status |
| `@supabase/supabase-js` | ^2.99.3 | Backend queries | SOP assignment, full-text search, versioning |
| `tailwindcss` | ^4 | Styling | `--min-tap-target: 72px` token already defined in `globals.css` |

### Packages to Install (Phase 3)

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `dexie` | 4.3.0 | IndexedDB abstraction | Primary offline SOP store. NOT YET INSTALLED — Wave 0 task for 03-01. |
| `yet-another-react-lightbox` | ~3.25.x | Image lightbox with zoom | Pinch-to-zoom on mobile, Zoom plugin, works with Next.js dynamic import. Lightweight plugin architecture. |
| `idb-keyval` | ~6.x | Minimal IndexedDB async KV store | Used as TanStack Query persister adapter (experimental_createPersister). 573 bytes brotli'd. |

### Supporting (already installed, extend usage)

| Library | Purpose in Phase 3 |
|---------|--------------------|
| `react-hook-form` + `zod` | Assignment forms (assign SOP to role/worker), search inputs |
| `lucide-react` | Search icon, category icons, offline indicator icons |
| `@supabase/ssr` | Server-side assignment queries with RLS context |

### Installation

```bash
npm install dexie yet-another-react-lightbox idb-keyval
```

---

## Architecture Patterns

### Recommended Project Structure (Phase 3 additions)

```
src/
├── app/(protected)/
│   ├── sops/                          # Worker-facing SOP routes
│   │   ├── page.tsx                   # SOP library (assigned list + search)
│   │   ├── [sopId]/
│   │   │   ├── page.tsx               # SOP detail / quick reference entry
│   │   │   ├── walkthrough/page.tsx   # Full-screen walkthrough
│   │   │   └── section/[type]/page.tsx  # Direct section jump
│   └── admin/
│       └── sops/
│           └── [sopId]/
│               └── assign/page.tsx    # Admin assignment UI
├── components/
│   ├── sop/
│   │   ├── WalkthroughList.tsx        # Scrolling step list (D-01)
│   │   ├── SafetyAcknowledgement.tsx  # Mandatory hazard/PPE card (D-02)
│   │   ├── StepItem.tsx               # Individual step with warning/caution
│   │   ├── StepProgress.tsx           # "Step 3 of 12" counter + progress bar (D-04)
│   │   ├── SopSectionTabs.tsx         # Quick reference tab bar (D-09)
│   │   ├── SopImageInline.tsx         # Inline image with tap-to-zoom trigger (D-03)
│   │   ├── SopLibraryList.tsx         # SOP cards/list for library
│   │   ├── SopSearchInput.tsx         # Search icon → expanded search (D-07)
│   │   └── CategoryBottomSheet.tsx    # Category/dept filter bottom sheet (D-08)
├── lib/
│   └── offline/
│       ├── db.ts                      # Dexie schema (SopDB class)
│       ├── sync-engine.ts             # Version diff + fetch stale SOPs
│       └── query-persister.ts         # TanStack Query idb-keyval adapter
├── stores/
│   ├── network.ts                     # EXISTING — reuse as-is
│   └── walkthrough.ts                 # NEW — step completion state
└── hooks/
    ├── useOnlineStatus.ts             # EXISTING — reuse as-is
    ├── useAssignedSops.ts             # TanStack Query + Dexie read
    └── useSopSync.ts                  # Trigger sync on foreground/online
```

### Pattern 1: Dexie.js v4 Database Class

**What:** TypeScript-typed IndexedDB store using Dexie v4's `EntityTable` type. Store full SOP content (sections + steps + images) locally for offline reads.

**When to use:** All SOP reads from worker UI. Workers never read directly from Supabase — they read from Dexie, which syncs from Supabase when online.

```typescript
// src/lib/offline/db.ts
import { Dexie, type EntityTable } from 'dexie'
import type { Sop, SopSection, SopStep, SopImage } from '@/types/sop'

interface CachedSop extends Sop {
  _cachedAt: number   // timestamp for freshness checks
}

const db = new Dexie('SopAssistantDB') as Dexie & {
  sops: EntityTable<CachedSop, 'id'>
  sections: EntityTable<SopSection, 'id'>
  steps: EntityTable<SopStep, 'id'>
  images: EntityTable<SopImage, 'id'>
  syncMeta: EntityTable<{ key: string; value: string }, 'key'>
}

db.version(1).stores({
  sops:     'id, organisation_id, status, version, category, department, _cachedAt',
  sections: 'id, sop_id, section_type, sort_order',
  steps:    'id, section_id, step_number',
  images:   'id, sop_id, section_id, step_id',
  syncMeta: 'key',
})

export { db }
```

**Key v4 pattern:** Use `EntityTable<T, PrimaryKeyField>` (not `Table<T, KeyType>`) — this is the v4 idiomatic approach. The schema string lists only indexed fields; all other fields are stored but not indexed.

**CRITICAL:** Never index binary `storage_path` blob values. The `images` table stores the Supabase Storage URL as a string, not the blob itself — blobs corrupt IndexedDB on iOS.

### Pattern 2: TanStack Query + IndexedDB Persister

**What:** `experimental_createPersister` from `@tanstack/query-persist-client-core` with an `idb-keyval`-backed storage adapter. This makes TanStack Query restore cached SOP data from IndexedDB on app startup without a network round-trip.

**When to use:** All `useQuery` calls for SOP data. Set `networkMode: 'offlineFirst'` so queries resolve from cache even with no network.

```typescript
// src/lib/offline/query-persister.ts
import { experimental_createPersister } from '@tanstack/query-persist-client-core'
import { createStore, get, set, del } from 'idb-keyval'

const idbStore = createStore('tanstack-query', 'query-cache')

export const queryPersister = experimental_createPersister({
  storage: {
    getItem: (key: string) => get(key, idbStore),
    setItem: (key: string, value: unknown) => set(key, value, idbStore),
    removeItem: (key: string) => del(key, idbStore),
  },
  maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
})

// Usage in query hooks:
// useQuery({ queryKey: ['sop', id], queryFn: fetchSop, persister: queryPersister, networkMode: 'offlineFirst' })
```

**Note:** `experimental_createPersister` defaults to `networkMode: 'offlineFirst'` when a persister is provided. It persists per-query (not the full cache), which is more memory-efficient than `persistQueryClient`.

### Pattern 3: SOP Sync Engine (Version-Diff Pull)

**What:** On app foreground and on online event, fetch a manifest (SOP IDs + version numbers) from the server. Diff against Dexie. Fetch full content only for stale/missing SOPs.

**When to use:** Called from `useSopSync` hook, triggered by: (1) app mounts, (2) `navigator.onLine` transitions true, (3) user pulls to refresh.

```typescript
// src/lib/offline/sync-engine.ts
export async function syncAssignedSops(userId: string, supabase: SupabaseClient) {
  // 1. Fetch manifest: SOP IDs + current version numbers (lightweight)
  const { data: manifest } = await supabase
    .from('sop_assignments_view')   // view joining assignments + sops
    .select('sop_id, version, updated_at')
    .eq('user_id', userId)

  // 2. Compare with Dexie
  const cached = await db.sops.toCollection().keys()
  const cachedVersions = await db.sops.bulkGet(cached as string[])
  const cachedMap = new Map(cachedVersions.map(s => [s?.id, s?.version]))

  // 3. Fetch only stale SOPs
  const staleIds = manifest
    ?.filter(m => !cachedMap.has(m.sop_id) || cachedMap.get(m.sop_id) !== m.version)
    .map(m => m.sop_id) ?? []

  if (staleIds.length === 0) return

  // 4. Fetch full SOP content for stale SOPs
  const { data: sops } = await supabase
    .from('sops')
    .select('*, sop_sections(*, sop_steps(*), sop_images(*))')
    .in('id', staleIds)

  // 5. Write to Dexie (bulk put for atomicity)
  await db.transaction('rw', [db.sops, db.sections, db.steps, db.images], async () => {
    for (const sop of sops ?? []) {
      await db.sops.put({ ...sop, _cachedAt: Date.now() })
      // ... put sections, steps, images
    }
  })
}
```

### Pattern 4: Mandatory Safety Acknowledgement

**What:** Before the walkthrough step list renders, show a full-screen safety card containing all Hazards and PPE sections. Worker must explicitly acknowledge before proceeding. State persisted in Zustand (survives navigation within session, not across app restart for safety-critical SOPs).

**When to use:** Any time a worker opens a walkthrough they haven't acknowledged in the current session.

**Implementation approach:** Zustand `walkthrough.ts` store tracks `{ sopId, acknowledgedAt }`. SafetyAcknowledgement component blocks scroll-to-steps until `acknowledgedAt` is set. Acknowledgement uses a prominent tap button (72px+, brand-orange), NOT a checkbox — checkboxes are glove-hostile.

### Pattern 5: Serwist SOP Image Caching

**What:** Extend the existing `sw.ts` to add `CacheFirst` strategy for SOP images from Supabase Storage. Images are large and change rarely — they should survive offline.

**When to use:** Any `supabase.co/storage` image URL fetched for SOP sections/steps.

```typescript
// Extend src/app/sw.ts runtimeCaching array:
{
  matcher({ url }) {
    return url.hostname.includes('supabase.co') && url.pathname.includes('/storage/')
  },
  handler: new CacheFirst({
    cacheName: 'sop-images',
    plugins: [
      new ExpirationPlugin({ maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 30 }),
    ],
  }),
},
```

**Note:** Import `CacheFirst` and `ExpirationPlugin` from `serwist` (not `workbox-*`). Serwist re-exports Workbox plugins under its own namespace.

### Pattern 6: Full-Text Search via Supabase textSearch()

**What:** Postgres GIN-indexed `fts` tsvector generated column on `sops`. Client uses `textSearch()` with `type: 'websearch'` for natural-language queries.

**Migration needed:**
```sql
-- New migration: 00006_sop_fts.sql
ALTER TABLE public.sops
ADD COLUMN fts tsvector GENERATED ALWAYS AS (
  to_tsvector('english',
    coalesce(title, '') || ' ' ||
    coalesce(sop_number, '') || ' ' ||
    coalesce(category, '') || ' ' ||
    coalesce(department, '')
  )
) STORED;

CREATE INDEX idx_sops_fts ON public.sops USING gin (fts);
```

**Client query:**
```typescript
const { data } = await supabase
  .from('sops')
  .select('id, title, category, department, version, status')
  .textSearch('fts', searchTerm, { type: 'websearch' })
  .eq('status', 'published')
  .order('title')
```

Note: Full SOP section/step content is NOT included in the FTS index for v1 — title + category + department is sufficient for 50-500 SOPs. Including all step text would make the index very large and slow.

### Pattern 7: SOP Assignment Schema

**What:** New `sop_assignments` table supporting both role-based and individual assignments. A view (`sop_assignments_view`) joins assignments to the requesting user to make RLS-filtered queries efficient.

**Migration needed: `00007_sop_assignments.sql`**
```sql
CREATE TYPE public.assignment_type AS ENUM ('role', 'individual');

CREATE TABLE public.sop_assignments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id  uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  sop_id           uuid NOT NULL REFERENCES public.sops(id) ON DELETE CASCADE,
  assignment_type  public.assignment_type NOT NULL,
  role             public.app_role,          -- set when type = 'role'
  user_id          uuid REFERENCES auth.users(id) ON DELETE CASCADE, -- set when type = 'individual'
  assigned_by      uuid NOT NULL REFERENCES auth.users(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sop_id, assignment_type, role),
  UNIQUE (sop_id, assignment_type, user_id)
);

CREATE INDEX idx_sop_assignments_org ON public.sop_assignments (organisation_id);
CREATE INDEX idx_sop_assignments_sop ON public.sop_assignments (sop_id);
CREATE INDEX idx_sop_assignments_user ON public.sop_assignments (user_id);
CREATE INDEX idx_sop_assignments_role ON public.sop_assignments (role);

ALTER TABLE public.sop_assignments ENABLE ROW LEVEL SECURITY;

-- Workers can see their own assignments (role-match or individual)
CREATE POLICY "workers_can_view_own_assignments"
  ON public.sop_assignments FOR SELECT TO authenticated
  USING (
    organisation_id = public.current_organisation_id()
    AND (
      (assignment_type = 'individual' AND user_id = auth.uid())
      OR (assignment_type = 'role' AND role = public.current_user_role())
    )
  );

-- Admins can manage all assignments
CREATE POLICY "admins_can_manage_assignments"
  ON public.sop_assignments FOR ALL TO authenticated
  USING (
    organisation_id = public.current_organisation_id()
    AND public.current_user_role() IN ('admin', 'safety_manager')
  );
```

### Pattern 8: SOP Versioning (Version Retention)

**What:** When an admin uploads a new version, the existing published SOP record is NOT deleted. A `superseded_by` FK links it to the new version. New SOP record gets `version = old_version + 1`. Phase 4 completion records will reference the specific `sop_id` (which is version-specific).

**Migration needed: `00008_sop_versioning.sql`**
```sql
ALTER TABLE public.sops
ADD COLUMN superseded_by uuid REFERENCES public.sops(id) ON DELETE SET NULL,
ADD COLUMN parent_sop_id uuid REFERENCES public.sops(id) ON DELETE SET NULL;

-- parent_sop_id: all versions of the "same SOP" share the same parent_sop_id
-- superseded_by: old version points to new version

CREATE INDEX idx_sops_parent ON public.sops (parent_sop_id);
CREATE INDEX idx_sops_superseded ON public.sops (superseded_by);
```

**Re-upload flow:** Admin uploads new document → creates new `sops` record with `parent_sop_id = old_sop.parent_sop_id ?? old_sop.id` and `version = old_sop.version + 1` → old record gets `superseded_by = new_sop.id` + status stays `published` (for history) → new SOP goes through parse/review/publish flow.

### Pattern 9: Worker Notifications

**What:** Simple in-app notification table. When a new SOP version is published that a worker is assigned to, a notification record is created. Worker sees it on next app open (polling on foreground, not push).

**Migration needed: `00009_worker_notifications.sql`**
```sql
CREATE TABLE public.worker_notifications (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id  uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sop_id           uuid NOT NULL REFERENCES public.sops(id) ON DELETE CASCADE,
  type             text NOT NULL DEFAULT 'sop_updated',
  read             boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user ON public.worker_notifications (user_id, read);
ALTER TABLE public.worker_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_see_own_notifications"
  ON public.worker_notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND organisation_id = public.current_organisation_id());

CREATE POLICY "system_can_insert_notifications"
  ON public.worker_notifications FOR INSERT TO authenticated
  WITH CHECK (organisation_id = public.current_organisation_id()
    AND public.current_user_role() IN ('admin', 'safety_manager'));
```

### Anti-Patterns to Avoid

- **Storing Blobs in indexed Dexie fields:** Store only `storage_path` (URL string) in IndexedDB, never binary image data. Binary blobs in indexed fields crash iOS IndexedDB. (Source: PITFALLS.md, Dexie maintainer article)
- **Reading SOPs from Supabase on every navigation:** Always read from Dexie. Supabase is the sync source, not the read path. One missed offline state = blank screen on the factory floor.
- **Fetching full SOP content on the manifest check:** Two-step sync: manifest first (IDs + versions, fast), then full content only for stale entries. Fetching everything on every sync wastes mobile data.
- **Caching SOP image URLs via HTTP headers:** Image URLs from Supabase Storage presigned URLs expire in 15 minutes. Cache the images themselves in the Serwist CacheFirst cache, not the presigned URLs.
- **Showing a walkthrough without safety acknowledgement:** D-02 is locked. The SafetyAcknowledgement component MUST gate the walkthrough list. There is no bypass path.
- **Using navigator.storage.persist() as the iOS eviction solution:** On iOS Safari (not installed PWA), `navigator.storage.persist()` does NOT prevent eviction. The only reliable mitigation is prompting users to add the PWA to the home screen, then showing a "last synced" timestamp and a "re-sync" CTA.
- **Hiding BottomTabBar during walkthrough:** Walkthrough should be full-screen. The `BottomTabBar` uses `fixed bottom-0` positioning — the walkthrough route should set a layout that does not render BottomTabBar (use a separate layout.tsx without the tab bar).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| IndexedDB schema + transactions | Custom IDB wrapper | `dexie` v4 | Migrations, TypeScript types, bulk operations, iOS compatibility workarounds |
| Image zoom/lightbox | Custom CSS transform component | `yet-another-react-lightbox` + Zoom plugin | Pinch-to-zoom, keyboard, mouse wheel, accessible, Next.js dynamic import |
| TanStack Query → IndexedDB bridge | Custom serialisation | `idb-keyval` + `experimental_createPersister` | 573 bytes, battle-tested, correct async interface |
| Full-text search | Client-side filtering | Supabase `textSearch()` + GIN index | Server-side ranking, handles 500+ SOPs, no bundle cost |
| Service worker caching | Custom fetch handlers | Serwist `runtimeCaching` with `CacheFirst` | Handles cache expiry, storage limits, stale responses |

**Key insight:** The hardest offline problems (IndexedDB schema migrations, cache eviction, iOS storage limits) are already solved by Dexie, Serwist, and idb-keyval. The custom code is the sync logic and UI — not the storage plumbing.

---

## Common Pitfalls

### Pitfall 1: Presigned URL Expiry Breaks Offline Images

**What goes wrong:** SOP images are served from Supabase Storage via short-lived presigned URLs (15 min TTL). The Serwist CacheFirst strategy caches the response at the presigned URL. When offline the next day, the worker opens the SOP — the cached presigned URL is in Cache Storage but the signed URL has expired. If the service worker cached the URL before the image bytes were fetched, the worker sees broken images offline.

**How to avoid:** Fetch and cache the actual image bytes (not just the URL) when syncing. The sync engine should trigger image fetches immediately after storing SOP data in Dexie. The Serwist CacheFirst cache stores the response body (the image bytes), so as long as the image was fetched once while online, offline access works regardless of URL expiry.

**Warning signs:** Testing offline image access only immediately after caching (the URL is still valid). Must test offline access 24+ hours after initial sync.

### Pitfall 2: iOS Storage Eviction After 7 Days of Inactivity

**What goes wrong:** iOS Safari evicts IndexedDB and Cache Storage if the PWA is not used for ~7 days. Worker returns from leave, opens the app, all cached SOPs gone, blank screen offline.

**How to avoid:**
- Show a "last synced" timestamp in the SOP library header (e.g., "Synced 3 days ago")
- Show per-SOP offline readiness indicator (green dot = cached, grey = not cached)
- On app open, attempt background sync if online — re-cache stale entries
- Prompt users to add PWA to home screen (installed PWAs get persistent storage on iOS)
- A manual "Download for offline" button per SOP is acceptable fallback

**Warning signs:** Only testing offline on Chrome/Android. Never testing on a real iOS device.

### Pitfall 3: Mid-Walkthrough SOP Version Change

**What goes wrong:** Worker starts a walkthrough of SOP v1. Admin publishes v2 with a critical safety change. Worker finishes on v1 instructions, signs off — the record references the old version which now has a safety correction.

**How to avoid (locked: D-15):** The chosen approach is "let worker finish on current version, show new version next time they open it." Implementation: the walkthrough locks to the SOP `id` it started with (which is version-specific). When the worker closes and reopens, the sync engine detects the version change and loads the new version. Do NOT hot-swap the SOP mid-walkthrough.

**Warning signs:** Fetching SOP content fresh from Supabase on each step navigation instead of reading from the locally-cached version that was loaded at walkthrough start.

### Pitfall 4: Walkthrough Layout Chrome Interferes with Glove Use

**What goes wrong:** BottomTabBar stays visible during walkthrough, covering the bottom action area. Worker can't reach primary CTA (mark step complete) because it's behind the tab bar's 72px height.

**How to avoid:** Create `src/app/(protected)/sops/[sopId]/walkthrough/layout.tsx` that renders WITHOUT BottomTabBar. The walkthrough is a separate full-screen context. Navigation back to the library uses a top-left back chevron (also 72px+ tap target).

### Pitfall 5: Assignment Query Performance Without Correct Indexes

**What goes wrong:** Worker opens SOP library. Query joins `sop_assignments` on both `user_id` and `role`, scans the table, and times out on organisations with 500+ SOPs and 100+ workers.

**How to avoid:** The `sop_assignments` migration (above) includes composite indexes on `(organisation_id)`, `(sop_id)`, `(user_id)`, and `(role)`. The RLS policy itself covers the filter. Benchmark with `EXPLAIN ANALYZE` if org size grows.

### Pitfall 6: Dexie Not Available During SSR

**What goes wrong:** Dexie reads `indexedDB` from `globalThis`. Next.js App Router may render components server-side where `indexedDB` is undefined. If `db.ts` is imported in a Server Component, it throws.

**How to avoid:** Mark all components that use Dexie with `'use client'`. Never import `db.ts` in a Server Component or server action. The sync engine runs client-side only. Server components fetch directly from Supabase; client components read from Dexie.

---

## Code Examples

### Dexie v4 Bulk Read for SOP Library

```typescript
// Source: Dexie.js v4 docs (dexie.org/docs/Typescript)
// Read all assigned SOP IDs from Dexie
const assignedSops = await db.sops
  .where('status')
  .equals('published')
  .sortBy('title')
```

### TanStack Query + Dexie Offline Hook

```typescript
// src/hooks/useAssignedSops.ts
'use client'
import { useQuery } from '@tanstack/react-query'
import { db } from '@/lib/offline/db'
import { queryPersister } from '@/lib/offline/query-persister'

export function useAssignedSops() {
  return useQuery({
    queryKey: ['assigned-sops'],
    queryFn: () => db.sops.where('status').equals('published').toArray(),
    networkMode: 'offlineFirst',
    persister: queryPersister,
    staleTime: 1000 * 60 * 5, // 5 min
  })
}
```

### Serwist CacheFirst for SOP Images

```typescript
// Extend src/app/sw.ts
import { CacheFirst, NetworkFirst, Serwist } from 'serwist'
import { ExpirationPlugin } from 'serwist'

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Supabase Storage images (SOP diagrams/photos) — cache aggressively
    {
      matcher({ url }) {
        return url.hostname.includes('supabase.co') && url.pathname.includes('/storage/')
      },
      handler: new CacheFirst({
        cacheName: 'sop-images-v1',
        plugins: [
          new ExpirationPlugin({ maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 30 }),
        ],
      }),
    },
    ...defaultCache,
  ],
})
```

### Yet Another React Lightbox (Image Zoom)

```typescript
// src/components/sop/SopImageInline.tsx
// Source: yet-another-react-lightbox.com/examples/nextjs
'use client'
import dynamic from 'next/dynamic'
import { useState } from 'react'

const Lightbox = dynamic(() => import('yet-another-react-lightbox'), { ssr: false })
const Zoom = dynamic(
  () => import('yet-another-react-lightbox/plugins/zoom').then(m => m.Zoom),
  { ssr: false }
)

export function SopImageInline({ src, alt }: { src: string; alt: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="min-h-[var(--min-tap-target)] w-full"
        aria-label={`Tap to zoom: ${alt}`}
      >
        <img src={src} alt={alt} className="w-full rounded-lg" />
      </button>
      <Lightbox
        open={open}
        close={() => setOpen(false)}
        slides={[{ src, alt }]}
        plugins={[Zoom]}
      />
    </>
  )
}
```

### Supabase Full-Text Search with Assignment Filter

```typescript
// Combines FTS + assignment filter in one query
const { data } = await supabase
  .from('sops')
  .select(`
    id, title, category, department, version, status,
    sop_assignments!inner(assignment_type, role, user_id)
  `)
  .textSearch('fts', searchTerm, { type: 'websearch' })
  .eq('status', 'published')
  .or(
    `role.eq.${userRole},user_id.eq.${userId}`,
    { foreignTable: 'sop_assignments' }
  )
  .order('title')
```

### Sync on Online Event

```typescript
// src/hooks/useSopSync.ts
'use client'
import { useEffect } from 'react'
import { useNetworkStore } from '@/stores/network'
import { syncAssignedSops } from '@/lib/offline/sync-engine'

export function useSopSync() {
  const isOnline = useNetworkStore(s => s.isOnline)

  useEffect(() => {
    if (isOnline) {
      syncAssignedSops().catch(console.error)
    }
  }, [isOnline]) // Re-runs whenever we come back online
}
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `next-pwa` (shadowwalker) | `@serwist/next` (already installed) | Already using correct library |
| `persistQueryClient` (whole-cache sync storage) | `experimental_createPersister` (per-query, async) | More memory-efficient, lazy loading, IndexedDB-compatible |
| `createSyncStoragePersister` (deprecated) | `experimental_createPersister` + `idb-keyval` | Works with async storage (IndexedDB), not just localStorage |
| Custom lightbox component | `yet-another-react-lightbox` + Zoom plugin | Mobile pinch-to-zoom, accessible, React 19 compatible |
| Background Sync API for offline writes | Online event + TanStack Query `refetchOnReconnect` | iOS Safari has no Background Sync — already confirmed in STACK.md |

**Deprecated/outdated:**
- `createSyncStoragePersister`: TanStack Query docs mark it deprecated, use `experimental_createPersister` instead
- `next-pwa (shadowwalker)`: Abandoned 2022, already replaced by `@serwist/next` in this project

---

## Open Questions

1. **FTS content scope**
   - What we know: `sops` table has `title`, `category`, `department`. Section/step text is in `sop_sections.content` and `sop_steps.text`.
   - What's unclear: Should the FTS index include section content and step text? This would make search much more powerful but increases index size significantly for large SOPs.
   - Recommendation: Start with title + category + department only (fast, sufficient for 50-500 SOPs). Add step text to FTS in a follow-up migration if users report finding the search inadequate. Avoid premature optimisation of the index.

2. **Offline image sync trigger timing**
   - What we know: SOP images must be fetched while online and cached by Serwist for offline use.
   - What's unclear: Should image pre-caching happen eagerly (sync all assigned SOP images on app open) or lazily (cache image when first rendered)?
   - Recommendation: Lazy caching is simpler and avoids downloading images the worker never opens. Eager is better for reliability on intermittent connections. Given the NZ factory context, lean toward eager pre-caching of assigned SOP images, triggered during the sync engine run.

3. **`sop_assignments_view` implementation**
   - What we know: The sync engine needs to fetch the manifest of assigned SOPs for the current user efficiently.
   - What's unclear: Whether a Postgres view or an RPC function is cleaner given the dual assignment model (role + individual).
   - Recommendation: Use a Postgres view `worker_assigned_sops` that unions role assignments and individual assignments: `SELECT sop_id FROM sop_assignments WHERE assignment_type = 'role' AND role = current_user_role() UNION SELECT sop_id FROM sop_assignments WHERE assignment_type = 'individual' AND user_id = auth.uid()`. RLS on the view enforces org scope.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Playwright 1.58.2 |
| Config file | `playwright.config.ts` (root) |
| Quick run command | `npx playwright test --project=phase3-stubs` |
| Full suite command | `npx playwright test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WORK-01 | Step-by-step walkthrough with progress indicator renders for assigned SOP | e2e | `npx playwright test sop-walkthrough --project=phase3-stubs` | Wave 0 |
| WORK-02 | Worker can navigate back to a previous step | e2e | `npx playwright test sop-walkthrough --project=phase3-stubs` | Wave 0 |
| WORK-03 | Quick reference tab bar renders and switches sections | e2e | `npx playwright test sop-quick-reference --project=phase3-stubs` | Wave 0 |
| WORK-04 | Clicking a section tab jumps directly to that section | e2e | `npx playwright test sop-quick-reference --project=phase3-stubs` | Wave 0 |
| WORK-05 | Safety acknowledgement card blocks walkthrough until acknowledged | e2e | `npx playwright test sop-walkthrough --project=phase3-stubs` | Wave 0 |
| WORK-06 | Inline image renders; clicking opens lightbox | e2e | `npx playwright test sop-walkthrough --project=phase3-stubs` | Wave 0 |
| WORK-07 | SOP list loads offline (airplane mode) after prior sync | e2e | `npx playwright test offline-sop --project=phase3-stubs` | Wave 0 |
| WORK-08 | Step completion queued offline syncs on reconnect | e2e | `npx playwright test offline-sop --project=phase3-stubs` | Wave 0 |
| WORK-09 | Primary action buttons are ≥72px height | e2e visual | `npx playwright test sop-walkthrough --project=phase3-stubs` | Wave 0 |
| WORK-10 | Walkthrough route does not render BottomTabBar | e2e | `npx playwright test sop-walkthrough --project=phase3-stubs` | Wave 0 |
| MGMT-01 | Admin can assign SOP to a role and to an individual worker | e2e | `npx playwright test sop-assignment --project=phase3-stubs` | Wave 0 |
| MGMT-02 | Assigned SOPs appear before unassigned in worker library | e2e | `npx playwright test sop-library --project=phase3-stubs` | Wave 0 |
| MGMT-03 | Search returns results matching title/category | e2e | `npx playwright test sop-search --project=phase3-stubs` | Wave 0 |
| MGMT-04 | Category filter limits visible SOPs | e2e | `npx playwright test sop-library --project=phase3-stubs` | Wave 0 |
| MGMT-05 | Admin re-upload creates version N+1 | e2e | `npx playwright test sop-versioning --project=phase3-stubs` | Wave 0 |
| MGMT-06 | Previous version SOP record is retained after re-upload | integration | `npx playwright test sop-versioning --project=phase3-stubs` | Wave 0 |
| MGMT-07 | Worker sees in-app notification after assigned SOP is updated | e2e | `npx playwright test sop-versioning --project=phase3-stubs` | Wave 0 |

### Sampling Rate

- **Per task commit:** `npx playwright test --project=phase3-stubs --grep "smoke"`
- **Per wave merge:** `npx playwright test --project=phase3-stubs`
- **Phase gate:** Full suite (`npx playwright test`) green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/sop-walkthrough.test.ts` — covers WORK-01, WORK-02, WORK-05, WORK-06, WORK-09, WORK-10
- [ ] `tests/sop-quick-reference.test.ts` — covers WORK-03, WORK-04
- [ ] `tests/offline-sop.test.ts` — covers WORK-07, WORK-08
- [ ] `tests/sop-library.test.ts` — covers MGMT-02, MGMT-04
- [ ] `tests/sop-search.test.ts` — covers MGMT-03
- [ ] `tests/sop-assignment.test.ts` — covers MGMT-01
- [ ] `tests/sop-versioning.test.ts` — covers MGMT-05, MGMT-06, MGMT-07
- [ ] `playwright.config.ts` — add `phase3-stubs` project with `testMatch: /sop-walkthrough|sop-quick-reference|offline-sop|sop-library|sop-search|sop-assignment|sop-versioning/`
- [ ] Framework install: `npm install dexie yet-another-react-lightbox idb-keyval` — required before any Phase 3 implementation

---

## Sources

### Primary (HIGH confidence)
- `dexie.org/docs/Typescript` — Dexie v4 EntityTable pattern, schema string syntax
- `github.com/dexie/Dexie.js` README — v4 TypeScript class pattern (EntityTable vs Table)
- `github.com/TanStack/query/discussions/6213` — `experimental_createPersister` + idb-keyval integration pattern
- `supabase.com/docs/guides/database/full-text-search` — `textSearch()` API, GIN index setup, `websearch` type
- `serwist.pages.dev/docs/serwist/runtime-caching` — `runtimeCaching` array config, `CacheFirst` strategy
- `npmjs.com/package/yet-another-react-lightbox` — bundle size, Zoom plugin, React 19 support
- `npmjs.com/package/idb-keyval` — 573 bytes brotli, async API, createStore
- Project files: `src/app/sw.ts`, `src/types/sop.ts`, `src/stores/network.ts`, `src/app/globals.css`, `supabase/migrations/00001_foundation_schema.sql`, `supabase/migrations/00003_sop_schema.sql`

### Secondary (MEDIUM confidence)
- `webkit.org/blog/14403/updates-to-storage-policy/` — iOS 17+ Storage API persistent mode
- `magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide` — iOS storage eviction confirmed for 2026
- `serwist.pages.dev/docs/serwist/runtime-caching/caching-strategies` — ExpirationPlugin usage

### Tertiary (LOW confidence)
- WebSearch results on `react-zoom-pan-pinch` alternatives — not verified with official docs; `yet-another-react-lightbox` is the confirmed choice

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified against `package.json`; Dexie v4 API verified against official docs
- Architecture: HIGH — patterns verified against Serwist, Dexie, TanStack Query, Supabase official docs
- DB migrations: HIGH — based directly on existing migration patterns and Supabase RLS conventions in codebase
- Pitfalls: HIGH — iOS storage eviction confirmed, presigned URL expiry is a known pattern, glove UI requirements are locked
- FTS search: HIGH — Supabase textSearch() and GIN index pattern verified against official docs

**Research date:** 2026-03-25
**Valid until:** 2026-04-25 (stable libraries; Serwist and Dexie v4 are not in rapid flux)
