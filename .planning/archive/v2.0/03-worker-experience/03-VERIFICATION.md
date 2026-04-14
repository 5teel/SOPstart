---
phase: 03-worker-experience
verified: 2026-03-26T00:00:00Z
status: gaps_found
score: 4/5 success criteria verified
re_verification: false
gaps:
  - truth: "Workers are notified when an assigned SOP has been updated"
    status: failed
    reason: "notifyAssignedWorkers server action is defined in versioning.ts but is never called from any UI. The versions/page.tsx only calls uploadNewVersion — it does not follow up with notifyAssignedWorkers. Workers will never receive an in-app notification when an SOP is re-uploaded."
    artifacts:
      - path: "src/app/(protected)/admin/sops/[sopId]/versions/page.tsx"
        issue: "handleFileSelected calls uploadNewVersion but omits a subsequent call to notifyAssignedWorkers(oldSopId, result.newSopId)"
      - path: "src/actions/versioning.ts"
        issue: "notifyAssignedWorkers is exported and fully implemented but remains unwired — zero call sites in any UI or API route"
    missing:
      - "In versions/page.tsx handleFileSelected, after the successful uploadNewVersion call and file PUT, call notifyAssignedWorkers(sopId, result.newSopId) before redirecting to the review page"
human_verification:
  - test: "Worker receives notification badge when admin uploads a new SOP version"
    expected: "After admin visits /admin/sops/[sopId]/versions, uploads a new version, the affected worker's SOPs tab shows a red notification badge"
    why_human: "End-to-end flow involves presigned upload, parse trigger, and polling — cannot verify without a running app and test accounts"
  - test: "Offline SOP access — walk through a cached SOP with airplane mode on"
    expected: "Worker can open the SOPs library, open an SOP, and complete the walkthrough with no network connection; data was previously synced"
    why_human: "Requires DevTools network throttling or real device offline mode"
  - test: "Sync-on-reconnect — enter text offline, come back online, verify sync fires"
    expected: "useSopSync triggers syncAssignedSops within 30 seconds of connectivity restoration and the library reflects the latest assignment state"
    why_human: "Requires toggling network state in a browser and observing sync behaviour"
  - test: "72px tap targets usable with gloves"
    expected: "StepItem min-h-[72px], primary action button h-[72px], acknowledge button h-[80px] are all reachable without precision tapping"
    why_human: "Subjective physical usability test"
  - test: "Full-screen walkthrough — no bottom tab bar visible"
    expected: "Navigating to /sops/[id]/walkthrough shows the walkthrough layout without the bottom navigation bar"
    why_human: "Visual inspection required; the layout.tsx override is in code but needs rendering confirmation"
---

# Phase 3: Worker Experience Verification Report

**Phase Goal:** Workers can find, walk through, and browse any assigned SOP on their phone — including offline — with the SOP library, search, and assignment managed by admins
**Verified:** 2026-03-26
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Worker can walk through an SOP step-by-step in a full-screen glove-friendly interface, navigate backwards, and see progress — with hazard and PPE information shown before steps begin | VERIFIED | walkthrough/page.tsx wires SafetyAcknowledgement gate, WalkthroughList with StepItem (min-h-[72px]), StepProgress, and h-[72px] primary button. markStepIncomplete enables back-undo. Layout.tsx strips BottomTabBar. |
| 2 | Worker can view any SOP section (Hazards, PPE, Steps, Emergency) directly via tabbed quick-reference without walking through all steps | VERIFIED | sops/[sopId]/page.tsx renders SopSectionTabs + SectionContent. setActiveTab is driven directly by tab tap. "Start Walkthrough" only appears on the Steps tab. |
| 3 | Worker can search and browse the SOP library; assigned SOPs appear first; images within steps display inline with zoom | VERIFIED | sops/page.tsx calls useAssignedSops (Dexie, only published+assigned SOPs) with search/category. SopLibraryCard shows "Assigned" badge on all cards. SopImageInline uses dynamic yet-another-react-lightbox with Zoom plugin. |
| 4 | Worker can access all assigned SOPs without an internet connection; data entered offline syncs when connectivity returns | VERIFIED | Dexie IndexedDB schema (db.ts), syncAssignedSops with version-diff (sync-engine.ts), useSopSync triggers on mount/online/visibility, sw.ts adds CacheFirst for Supabase Storage images, all hooks use networkMode: 'offlineFirst'. |
| 5 | Admin can assign SOPs to roles or individual workers; uploading a new document version retains previous versions linked to historical completions; workers see an update notification when an assigned SOP changes | PARTIAL | Assignment UI (assign/page.tsx) and server actions are complete. Versioning schema (00008) and migrations are correct. uploadNewVersion marks superseded_by. However, notifyAssignedWorkers is never called from the upload flow — workers will not receive notifications. |

**Score:** 4/5 success criteria verified (criterion 5 partially fails on the notification wiring)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `tests/offline-sync.test.ts` | Stubs for WORK-07, WORK-08 | VERIFIED | 2 test.fixme stubs |
| `tests/walkthrough.test.ts` | Stubs for WORK-01,02,05,06,09,10 | VERIFIED | 6 test.fixme stubs |
| `tests/quick-ref.test.ts` | Stubs for WORK-03, WORK-04 | VERIFIED | 2 test.fixme stubs |
| `tests/sop-library.test.ts` | Stubs for MGMT-02,03,04 | VERIFIED | 3 test.fixme stubs |
| `tests/sop-assignment.test.ts` | Stub for MGMT-01 | VERIFIED | 1 test.fixme stub |
| `tests/sop-versioning.test.ts` | Stubs for MGMT-05,06,07 | VERIFIED | 3 test.fixme stubs |
| `src/lib/offline/db.ts` | Dexie SopAssistantDB with 5 tables | VERIFIED | 5 stores: sops, sections, steps, images, syncMeta |
| `src/lib/offline/query-persister.ts` | TanStack Query IndexedDB persister | VERIFIED | experimental_createQueryPersister with idb-keyval, 7-day maxAge |
| `src/lib/offline/sync-engine.ts` | Version-diff sync from Supabase to Dexie | VERIFIED | Full implementation: manifest fetch, diff, bulk put, orphan cleanup |
| `src/hooks/useAssignedSops.ts` | Hook reading from Dexie with search/category | VERIFIED | networkMode: 'offlineFirst', persister: queryPersister wired |
| `src/hooks/useSopSync.ts` | Sync on mount/online/visibility | VERIFIED | Three useEffect triggers + 30s debounce |
| `src/hooks/useSopDetail.ts` | Full SOP with sections/steps/images from Dexie | VERIFIED | Fetches sop + sections sorted by sort_order + steps/images nested |
| `src/stores/walkthrough.ts` | Zustand store for step completion and safety acknowledgement | VERIFIED | markStepComplete, markStepIncomplete, acknowledgeSafety, isAcknowledged, getCompletedSteps, resetWalkthrough all implemented |
| `src/app/sw.ts` | CacheFirst for Supabase Storage images | VERIFIED | sop-images-v1 CacheFirst with ExpirationPlugin (500 entries, 30 days) |
| `supabase/migrations/00006_sop_fts.sql` | FTS tsvector column + GIN index on sops | VERIFIED | GENERATED ALWAYS AS tsvector column + CREATE INDEX USING gin |
| `supabase/migrations/00007_sop_assignments.sql` | sop_assignments table with RLS | VERIFIED | assignment_type enum, role + individual assignment, 2 RLS policies |
| `src/app/(protected)/sops/[sopId]/walkthrough/layout.tsx` | Full-screen layout without BottomTabBar | VERIFIED | h-screen bg-steel-900, no BottomTabBar import |
| `src/app/(protected)/sops/[sopId]/walkthrough/page.tsx` | Walkthrough page | VERIFIED | SafetyAcknowledgement gate, StepProgress, WalkthroughList, h-[72px] primary button |
| `src/components/sop/SafetyAcknowledgement.tsx` | Safety gate with h-[80px] acknowledge button | VERIFIED | Hazards (red), PPE (blue), Emergency (collapsible), h-[80px] bg-brand-orange button |
| `src/components/sop/WalkthroughList.tsx` | Scrollable step list with safety summary strip | VERIFIED | useWalkthroughStore wired, markStepComplete/markStepIncomplete, collapsible safety summary |
| `src/components/sop/StepItem.tsx` | Step row with min-h-[72px], tap-to-complete | VERIFIED | min-h-[72px], 3 states (upcoming/active/completed), haptic feedback |
| `src/components/sop/StepProgress.tsx` | Progress bar + Step N of M counter | VERIFIED | 33 lines, bg-brand-yellow fill, percentage display |
| `src/components/sop/SopImageInline.tsx` | Inline image with lightbox zoom | VERIFIED | Dynamic import of yet-another-react-lightbox (ssr:false), Zoom plugin |
| `src/app/(protected)/sops/page.tsx` | Worker SOP library with search and category | VERIFIED | useAssignedSops + useSopSync wired, SopLibraryCard, SopSearchInput, CategoryBottomSheet |
| `src/app/(protected)/sops/[sopId]/page.tsx` | SOP detail with quick-reference tabs | VERIFIED | SopSectionTabs + SectionContent, h-[72px] Start Walkthrough button on Steps tab |
| `src/components/sop/SopLibraryCard.tsx` | SOP card with cache status and badges | VERIFIED | min-h-[88px], "Assigned" badge always shown, cache dot |
| `src/components/sop/SopSectionTabs.tsx` | Horizontal scrollable tab bar | VERIFIED | overflow-x-auto, h-[52px], section-type colour semantics |
| `src/components/sop/SectionContent.tsx` | Section content with type-specific styling | VERIFIED | Hazards (red), PPE (blue chips), Steps (numbered), emergency/info variants |
| `src/components/sop/SopSearchInput.tsx` | Full-screen search overlay | VERIFIED | fixed inset-0 overlay, auto-focus, onSearch on input |
| `src/components/sop/CategoryBottomSheet.tsx` | Bottom sheet / desktop sidebar for categories | VERIFIED | Mobile bottom sheet (z-40) + lg: sidebar (w-[240px]) |
| `src/app/(protected)/admin/sops/[sopId]/assign/page.tsx` | Admin assignment UI | VERIFIED | 4 role rows + individual worker section with search, optimistic updates |
| `src/components/admin/AssignmentRow.tsx` | Assignment row with 3 states | VERIFIED | not-assigned/assigned/loading states, inline removal confirmation |
| `src/actions/assignments.ts` | Server actions for assignment CRUD | VERIFIED | assignSopToRole, assignSopToUser, removeAssignment, getAssignments, getOrgMembers with admin guard |
| `src/app/api/sops/[sopId]/assignments/route.ts` | API route for assignment CRUD | VERIFIED | GET/POST/DELETE handlers |
| `supabase/migrations/00008_sop_versioning.sql` | superseded_by + parent_sop_id columns | VERIFIED | Both FK columns, idx_sops_parent + idx_sops_superseded indexes, current_sop_version() function |
| `supabase/migrations/00009_worker_notifications.sql` | worker_notifications table with RLS | VERIFIED | Table, 3 RLS policies (SELECT/UPDATE for workers, INSERT for admins) |
| `src/app/(protected)/admin/sops/[sopId]/versions/page.tsx` | Version history page | VERIFIED | Table with Current/Superseded badges, inline upload confirmation with brand-orange, calls uploadNewVersion |
| `src/actions/versioning.ts` | Versioning server actions | VERIFIED | uploadNewVersion, notifyAssignedWorkers, getVersionHistory, markNotificationRead — all implemented |
| `src/hooks/useNotifications.ts` | Hook polling for unread notifications | VERIFIED | refetchInterval: 60_000, refetchOnWindowFocus, markRead invalidates query |
| `src/components/layout/NotificationBadge.tsx` | Badge showing unread count | VERIFIED | Returns null when unreadCount === 0, caps at "9+", absolute positioned red circle |
| `src/components/layout/BottomTabBar.tsx` | Tab bar with SOPs tab href=/sops + NotificationBadge | VERIFIED | href: '/sops', NotificationBadge imported and rendered inside relative span over SOPs icon |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/hooks/useAssignedSops.ts` | `src/lib/offline/db.ts` | `db.sops.where('status')` | WIRED | Line 28 queries Dexie sops table |
| `src/hooks/useAssignedSops.ts` | `src/lib/offline/query-persister.ts` | `persister: queryPersister` | WIRED | Line 51 |
| `src/lib/offline/sync-engine.ts` | `src/lib/offline/db.ts` | `db.transaction('rw', ...)` | WIRED | Lines 81, 109, 133 |
| `src/app/sw.ts` | serwist | CacheFirst for Supabase Storage | WIRED | `sop-images-v1` cacheName, supabase.co + /storage/ matcher |
| `src/app/(protected)/sops/[sopId]/walkthrough/page.tsx` | `src/stores/walkthrough.ts` | `useWalkthroughStore` | WIRED | Lines 19, 80, 81, 88, 91, 100 |
| `src/app/(protected)/sops/[sopId]/walkthrough/page.tsx` | `src/hooks/useSopDetail.ts` | `useSopDetail(sopId)` | WIRED | Line 18 |
| `src/components/sop/SafetyAcknowledgement.tsx` | `src/stores/walkthrough.ts` | `onAcknowledge` callback | WIRED | Invoked by walkthrough/page.tsx `handleAcknowledge → store.acknowledgeSafety` |
| `src/components/sop/SopImageInline.tsx` | `yet-another-react-lightbox` | Dynamic import + Zoom plugin | WIRED | Dynamic import on lines 9-11, Zoom plugin lazy-loaded line 20 |
| `src/app/(protected)/sops/page.tsx` | `src/hooks/useAssignedSops.ts` | `useAssignedSops(...)` | WIRED | Lines 33, 36, 39 |
| `src/app/(protected)/sops/page.tsx` | `src/hooks/useSopSync.ts` | `useSopSync()` | WIRED | Line 30 |
| `src/app/(protected)/sops/[sopId]/page.tsx` | `src/hooks/useSopDetail.ts` | `useSopDetail(sopId)` | WIRED | Line 14 |
| `src/components/sop/SopSectionTabs.tsx` | `src/components/sop/SectionContent.tsx` | Active tab renders SectionContent | WIRED | sops/[sopId]/page.tsx passes activeSection to SectionContent |
| `src/app/(protected)/admin/sops/[sopId]/assign/page.tsx` | `src/actions/assignments.ts` | `assignSopToRole`, `assignSopToUser`, `removeAssignment` | WIRED | Lines 101-167 |
| `src/actions/assignments.ts` | `supabase/migrations/00007_sop_assignments.sql` | Insert/delete against sop_assignments | WIRED | from('sop_assignments').insert/delete |
| `src/actions/versioning.ts` | `supabase/migrations/00008_sop_versioning.sql` | Updates superseded_by FK | WIRED | Line 107: .update({ superseded_by: newSop.id }) |
| `src/actions/versioning.ts` | `supabase/migrations/00009_worker_notifications.sql` | Inserts into worker_notifications | WIRED | Lines 190-201 inside notifyAssignedWorkers |
| `src/hooks/useNotifications.ts` | `supabase/migrations/00009_worker_notifications.sql` | Polls worker_notifications | WIRED | from('worker_notifications').eq('read', false) |
| `src/components/layout/BottomTabBar.tsx` | `src/components/layout/NotificationBadge.tsx` | NotificationBadge over SOPs icon | WIRED | Line 4 import, line 100 render inside `<span className="relative">` |
| `src/app/(protected)/admin/sops/[sopId]/versions/page.tsx` | `src/actions/versioning.ts` | `notifyAssignedWorkers` after version upload | NOT WIRED | handleFileSelected calls uploadNewVersion but NEVER calls notifyAssignedWorkers — the function is defined and exported but has zero call sites in the UI |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| WORK-01 | 03-02 | Worker can walk through SOP step-by-step with clear progress indication | SATISFIED | WalkthroughList + StepProgress + primary button in walkthrough/page.tsx |
| WORK-02 | 03-02 | Worker can navigate back to previous steps during walkthrough | SATISFIED | markStepIncomplete in WalkthroughList handleToggle; Previous button scrolls to prior step |
| WORK-03 | 03-03 | Worker can view SOP sections via tabbed quick-reference mode | SATISFIED | SopSectionTabs in sops/[sopId]/page.tsx with setActiveTab on tap |
| WORK-04 | 03-03 | Worker can jump directly to any section without walking through steps | SATISFIED | Any tab is directly tappable in the detail page; no prerequisite navigation required |
| WORK-05 | 03-02 | Hazard and PPE information prominently displayed before procedure steps begin | SATISFIED | SafetyAcknowledgement gate is a mandatory full-screen overlay rendered when !isAcknowledged(sopId) |
| WORK-06 | 03-02 | Images display inline within SOP steps with zoom capability | SATISFIED | SopImageInline with yet-another-react-lightbox dynamic import and Zoom plugin |
| WORK-07 | 03-01 | Worker can access cached SOPs without internet connection | SATISFIED | Dexie IndexedDB schema + networkMode: 'offlineFirst' on all queries + CacheFirst SW for images |
| WORK-08 | 03-01 | Data entered offline syncs automatically when connectivity returns | SATISFIED | useSopSync triggers syncAssignedSops on isOnline transition and visibility change |
| WORK-09 | 03-02 | All primary actions use 72px+ tap targets | SATISFIED | StepItem min-h-[72px], walkthrough primary button h-[72px], acknowledge button h-[80px] |
| WORK-10 | 03-02 | Walkthrough uses full-screen interface optimised for one-handed use | SATISFIED | walkthrough/layout.tsx overrides parent layout, no BottomTabBar, h-screen bg-steel-900 |
| MGMT-01 | 03-04 | Admin can assign SOPs to specific roles or individual workers | SATISFIED | assign/page.tsx with AssignmentRow, server actions assignSopToRole + assignSopToUser with admin guard |
| MGMT-02 | 03-03 | Worker sees assigned SOPs first when browsing library | SATISFIED | sops/page.tsx uses useAssignedSops which reads only from Dexie (contains only assigned SOPs via sync). Every SOP shown carries "Assigned" badge. The library is entirely assigned SOPs by construction. |
| MGMT-03 | 03-03 | Worker can search the full SOP library by title and content | SATISFIED | SopSearchInput + useAssignedSops({ search }) with matchesSearch covering title, sop_number, category, department |
| MGMT-04 | 03-03 | Worker can browse SOPs by category or department | SATISFIED | CategoryBottomSheet (mobile) + CategorySidebar (desktop) filter via useAssignedSops({ category }) |
| MGMT-05 | 03-05 | Admin can update an SOP by uploading a new version | SATISFIED | versions/page.tsx upload flow with inline confirmation, uploadNewVersion server action creates new record + presigned URL |
| MGMT-06 | 03-05 | Previous SOP versions retained and linked to historical completions | SATISFIED | 00008_sop_versioning.sql adds superseded_by + parent_sop_id; uploadNewVersion sets superseded_by on old record |
| MGMT-07 | 03-05 | Workers are notified when an assigned SOP has been updated | BLOCKED | notifyAssignedWorkers is fully implemented in versioning.ts but is never called from versions/page.tsx or any other UI. Workers will not receive notifications after a version upload. |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/app/(protected)/admin/sops/[sopId]/versions/page.tsx` | ~111-148 | `notifyAssignedWorkers` never called after successful upload | Blocker | MGMT-07 and Success Criterion 5 are unmet — workers receive no notification when their SOP changes |

No other anti-patterns found: no TODO/FIXME/placeholder comments in production code, no stub return values, no empty handlers, no console.log-only implementations in Phase 3 feature files.

---

### Human Verification Required

#### 1. Notification badge appears after SOP re-upload

**Test:** As an admin, navigate to /admin/sops, click Versions on a published SOP that has at least one worker assigned, upload a new file, confirm the upload. Then log in as an assigned worker and inspect the SOPs tab in the bottom bar.
**Expected:** A red notification badge (showing "1") appears over the SOPs tab icon.
**Why human:** Requires two authenticated sessions, a real file upload, parse trigger, and visual badge inspection — not automatable with grep.

#### 2. Offline SOP walkthrough with airplane mode

**Test:** While online, navigate to /sops and wait for "Synced just now". Enable airplane mode. Open an SOP and complete the walkthrough.
**Expected:** All steps are visible and tappable, step completion state persists, no network errors appear.
**Why human:** Requires DevTools network throttling or a real device in offline mode.

#### 3. Sync fires on reconnection

**Test:** Go offline, wait 30+ seconds, go back online. Observe the sync indicator.
**Expected:** Sync triggers automatically (spinning icon in header or lastSyncResult updates) within 30 seconds of coming back online.
**Why human:** Requires live browser observation of network state and React state.

#### 4. 72px tap targets are glove-usable

**Test:** On a physical Android or iOS device, attempt to use the walkthrough with thick work gloves.
**Expected:** Mark Complete button, step rows, and safety acknowledgement button all activate reliably without precision.
**Why human:** Physical usability test.

#### 5. Full-screen walkthrough — no tab bar visible

**Test:** Navigate to /sops, open any SOP, tap "Start Walkthrough".
**Expected:** The bottom navigation bar is not visible at any point during the walkthrough.
**Why human:** Visual confirmation of the layout override in a rendered browser.

---

### Gaps Summary

**One gap blocks full goal achievement.**

The MGMT-07 requirement ("workers are notified when an assigned SOP has been updated") has a complete implementation in `notifyAssignedWorkers` within `src/actions/versioning.ts`, but this function is never invoked. The versions page (`versions/page.tsx`) completes the upload flow successfully — creating the new SOP record, uploading the file, triggering a parse job, setting `superseded_by` on the old record, and redirecting to review — but the notification step was omitted.

The fix is a single call addition in `versions/page.tsx handleFileSelected`, after the file PUT succeeds and before the router.push redirect:

```typescript
// After: await fetch('/api/sops/parse', ...)
await notifyAssignedWorkers(sopId, result.newSopId)
```

This is a wiring gap, not a missing implementation. The notification infrastructure (schema, RLS policies, server action, polling hook, badge component, BottomTabBar integration) is all correct. Only the trigger call is absent.

All other 16 requirements are implemented and wired. The offline-first data layer, walkthrough, library, search, category filtering, assignment management, versioning, and notification display are all substantive and correctly connected.

---

_Verified: 2026-03-26_
_Verifier: Claude (gsd-verifier)_
