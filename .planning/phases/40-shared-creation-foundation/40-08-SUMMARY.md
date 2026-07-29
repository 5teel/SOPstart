---
phase: 40-shared-creation-foundation
plan: 08
subsystem: ui
tags: [react, nextjs, forms, department-picker, sop-categories, consolidation]

# Dependency graph
requires:
  - phase: 40-shared-creation-foundation
    provides: "src/lib/sop-categories.ts (SOP_CATEGORIES, categoryLabel, isValidCategorySlug, normaliseToCategorySlug) and the categorySlug/title rename across aiPromptSchema and the wizard schema, from plan 40-04"
provides:
  - "SopMetadataFields.tsx — one composite title + department + category field group"
  - "PromptClient, VoiceDraftClient, WizardClient rewired onto the shared component"
  - "AI-describe and AI-voice creation paths can now collect a title and a category (previously could not)"
  - "the live DISTINCT sops.category query in new/ai/page.tsx deleted (DAT-01 anti-pattern)"
affects: [42-authoring-convergence]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One composite field-group component (SopMetadataFields) replacing three drifted per-surface copies, with escape-hatch show*/hide props for surfaces that genuinely lack a field"
    - "localOnly DepartmentPicker composition — parent owns pre-submission state, writes commit through assignSopDepartments on final submit, never a direct sop_departments write"

key-files:
  created:
    - src/components/admin/SopMetadataFields.tsx
  modified:
    - src/app/(protected)/admin/sops/new/ai/PromptClient.tsx
    - src/app/(protected)/admin/sops/new/ai/VoiceDraftClient.tsx
    - src/app/(protected)/admin/sops/new/ai/AiDraftTabs.tsx
    - src/app/(protected)/admin/sops/new/ai/page.tsx
    - src/app/(protected)/admin/sops/new/blank/WizardClient.tsx
    - tests/phase40/dup02-metadata-picker.spec.ts

key-decisions:
  - "Title field in SopMetadataFields is controlled (value/onChange), not RHF register() — two of the three call sites (PromptClient, VoiceDraftClient) don't use react-hook-form for this field at all"
  - "WizardClient's title-step form dropped react-hook-form entirely (was only used for the title/sopNumber pair) in favour of plain state + a manual TitleStepSchema.safeParse on submit, since title now lives in the shared meta value"
  - "WizardClient's dead categoryTag state (set once at declaration, never mutated) is gone; the BlockPicker's sopCategory prop now receives an explicit null with a comment explaining the prior dead-state behaviour is preserved, not reintroduced"

patterns-established:
  - "D-10 escape-hatch props (showTitle/showCategory/showDepartments) on a composite field-group component — document any use as a deviation at the call site, not a per-surface theming API"

requirements-completed: [DUP-02]

# Metrics
duration: 13min
completed: 2026-07-29
---

# Phase 40 Plan 08: Shared SOP Metadata Picker Summary

**One `SopMetadataFields` component (title + localOnly department picker + fixed-vocab category select) now backs all three SOP creation surfaces, replacing three drifted copies and deleting the live `DISTINCT sops.category` anti-pattern query.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-07-29T07:30:06Z (worktree base commit)
- **Completed:** 2026-07-29T07:43:24Z
- **Tasks:** 2
- **Files modified:** 7 (1 created, 6 modified)

## Accomplishments
- Built `src/components/admin/SopMetadataFields.tsx` — the one composite title/department/category field group, `localOnly` DepartmentPicker composition (D-11), category options from the fixed `SOP_CATEGORIES` vocab (DAT-01)
- Swapped it into `PromptClient`, `VoiceDraftClient`, and `WizardClient`, deleting three near-identical per-surface field blocks
- Deleted the live `.from('sops').select('category')` distinct-query anti-pattern in `new/ai/page.tsx` (DAT-01) and the `categories` prop chain that fed it through `AiDraftTabs` → `PromptClient`
- AI-describe and AI-voice paths can now collect a title and a category — previously only the blank wizard had a title field and only the typed-prompt path had (a broken) category select
- Removed WizardClient's dead `categoryTag` state (set once, never mutated) and its separate `departmentIds`/`allDepartments` state
- Un-fixme'd `tests/phase40/dup02-metadata-picker.spec.ts` (4/4 passing) and strengthened the D-11 behavioural assertion to pin the exact `assignSopDepartments(sop.id, departmentIds, allDepartments)` call in the ai-prompt route, not just presence of the function name

## Task Commits

Each task was committed atomically:

1. **Task 1: Build the composite SopMetadataFields component** - `dd1fd15` (feat)
2. **Task 2: Swap the component into all three creation surfaces** - `4feff6f` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified
- `src/components/admin/SopMetadataFields.tsx` - new composite title/department/category field group
- `src/app/(protected)/admin/sops/new/ai/PromptClient.tsx` - swapped in SopMetadataFields, POST body now includes title/categorySlug/departmentIds/allDepartments from `meta`
- `src/app/(protected)/admin/sops/new/ai/VoiceDraftClient.tsx` - swapped in SopMetadataFields (shown once a brief exists), `detailLevel: 3` left hardcoded per D-09
- `src/app/(protected)/admin/sops/new/ai/AiDraftTabs.tsx` - dropped the `categories` prop
- `src/app/(protected)/admin/sops/new/ai/page.tsx` - deleted the live `DISTINCT sops.category` query and the now-unused `supabase` destructure
- `src/app/(protected)/admin/sops/new/blank/WizardClient.tsx` - swapped in SopMetadataFields, dropped react-hook-form for the title step, removed dead `categoryTag` state
- `tests/phase40/dup02-metadata-picker.spec.ts` - un-fixme'd all 4 assertions, strengthened the D-11 assertion

## Decisions Made
- Title field uses controlled `value`/`onChange` rather than RHF `register()` since PromptClient and VoiceDraftClient don't use react-hook-form for this field — see key-decisions above.
- WizardClient's title-step form no longer uses react-hook-form at all; `TitleStepSchema.safeParse` is called manually on submit against `{ title: meta.title, sopNumber }`, preserving the exact same validation messages.
- `BlockPicker`'s `sopCategory` prop now receives an explicit `null` (was fed by dead `categoryTag` state before) — behaviour is unchanged, the dead state itself is gone.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Split combined type-only import to satisfy the spec's exact import-string assertion**
- **Found during:** Task 2 verification (first `dup02-metadata-picker.spec.ts` run)
- **Issue:** `import { SopMetadataFields, type SopMetadataValue } from '@/components/admin/SopMetadataFields'` didn't literally contain the spec's expected substring `import { SopMetadataFields } from '@/components/admin/SopMetadataFields'`
- **Fix:** Split into two import statements (value import + `import type`) in all three client files
- **Files modified:** PromptClient.tsx, VoiceDraftClient.tsx, WizardClient.tsx
- **Verification:** `npx playwright test --project=phase40 --grep metadata-picker` — 4/4 passing
- **Committed in:** `4feff6f` (Task 2 commit)

**2. [Rule 1 - Bug] Removed now-unused `supabase` destructure in new/ai/page.tsx**
- **Found during:** Task 2 (deleting the live category query)
- **Issue:** After deleting the `.from('sops').select('category')` query, `supabase` from `getSessionContext()` was unused
- **Fix:** Dropped `supabase` from the destructure, keeping `userId`/`role`
- **Files modified:** src/app/(protected)/admin/sops/new/ai/page.tsx
- **Verification:** `npx tsc --noEmit` clean
- **Committed in:** `4feff6f` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — bugs surfaced by the consolidation itself, not scope additions)
**Impact on plan:** No scope creep — both fixes were required for the plan's own acceptance criteria (exact import string) and for a clean build (unused variable).

## Issues Encountered
None beyond the deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- DUP-02 is closed: changing a label or option in `SopMetadataFields` (or `SOP_CATEGORIES`) now changes it on all three creation surfaces at once, verified by source sweep in `dup02-metadata-picker.spec.ts`.
- Department writes stay on the grant-backed `assignSopDepartments` path everywhere (D-11); `admin/sops/upload/page.tsx` does not import `SopMetadataFields` (D-12, upload metadata stays Phase 42/CRE-02 scope); voice detail-level stays hardcoded (D-09).
- `npx tsc --noEmit` and `npm run build` both clean at the end of this plan.

---
*Phase: 40-shared-creation-foundation*
*Completed: 2026-07-29*
