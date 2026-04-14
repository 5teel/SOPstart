---
phase: 03-worker-experience
plan: "03"
subsystem: worker-sop-ui
tags: [sop-library, search, category-filter, sop-detail, quick-reference, section-tabs]
dependency_graph:
  requires:
    - 03-01 (useAssignedSops, useSopDetail, useSopSync hooks)
    - 03-02 (walkthrough route exists at /sops/[sopId]/walkthrough)
  provides:
    - /sops route with SOP library, search, category filtering
    - /sops/[sopId] route with tabbed section quick-reference
    - SopLibraryCard, SopSearchInput, CategoryBottomSheet, SopSectionTabs, SectionContent components
  affects:
    - BottomTabBar (SOPs tab now links to /sops)
    - 03-04 (admin assignment pages will list SOPs workers see here)
tech_stack:
  added: []
  patterns:
    - useAssignedSops with category/search options for instant Dexie filtering
    - useSopSync triggered on mount for background data freshness
    - SopWithSections sections mapped to tabs by section_type
    - Section-type colour semantics (red=hazards/emergency, blue=PPE, yellow=steps)
key_files:
  created:
    - src/app/(protected)/sops/page.tsx
    - src/app/(protected)/sops/[sopId]/page.tsx
    - src/components/sop/SopLibraryCard.tsx
    - src/components/sop/SopSectionTabs.tsx
    - src/components/sop/SectionContent.tsx
    - src/components/sop/SopSearchInput.tsx
    - src/components/sop/CategoryBottomSheet.tsx
  modified:
    - src/components/layout/BottomTabBar.tsx
decisions:
  - "CategoryBottomSheet exports two components: CategoryBottomSheet (mobile sheet) and CategorySidebar (desktop), used conditionally in the page via responsive CSS rather than JS breakpoint detection"
  - "SopSearchInput accepts pre-computed results prop instead of running its own query — avoids duplicate TanStack Query subscriptions and simplifies state ownership"
  - "SopSectionTabs uses scrollbar-hide (Tailwind utility) for horizontal scroll without visible scrollbar"
metrics:
  duration: "5 minutes"
  completed_date: "2026-03-25"
  tasks_completed: 2
  files_created: 7
  files_modified: 1
---

# Phase 03 Plan 03: SOP Library and Quick-Reference UI Summary

**One-liner:** Tabbed SOP quick-reference with full-screen search overlay and mobile category bottom sheet, backed by Dexie in-memory filtering.

## What Was Built

### Task 1 — SOP Library Page, Cards, Search Overlay, Category Filter

**BottomTabBar update:** SOPs tab href changed from `/dashboard` to `/sops` with corrected `isActive` check using `pathname.startsWith(href + '/')`.

**SopLibraryCard (`src/components/sop/SopLibraryCard.tsx`):** min-h-[88px] card with FileText icon, green/grey offline dot, title (line-clamp-2), category+department metadata, "Assigned" yellow badge, and chevron. Wraps in `<Link href="/sops/{id}">`.

**SopSearchInput (`src/components/sop/SopSearchInput.tsx`):** Fixed full-screen overlay (z-40) with auto-focused input, instant results via `results` prop, Cancel button, and empty state with SearchX icon. Closes on Escape key.

**CategoryBottomSheet/CategorySidebar (`src/components/sop/CategoryBottomSheet.tsx`):** Mobile: fixed bottom sheet with handle, header with optional Clear button, and per-category rows (h-[56px]) with active yellow highlight and Check icon. Desktop: sticky sidebar (w-[240px]) with same row logic at h-[44px].

**SOP Library Page (`src/app/(protected)/sops/page.tsx`):** Sticky header with app name + search icon, page heading "Your SOPs", metadata line with count and last sync time, mobile category pill, scrollable SopLibraryCard list. Full empty state (ClipboardList icon) when no SOPs assigned. Loading skeleton with 4 pulse placeholders.

### Task 2 — SOP Detail Page, Section Tabs, Section Content

**SopSectionTabs (`src/components/sop/SopSectionTabs.tsx`):** Horizontal scrollable tab bar (h-[52px], overflow-x-auto, scrollbar-hide). Tabs sorted by section.sort_order. Colour semantics: hazards/emergency → red-400, PPE → blue-400, steps → brand-yellow, other → steel-100. Icon prefix for hazards (AlertTriangle), PPE (ShieldCheck), steps (ListChecks), emergency (Siren).

**SectionContent (`src/components/sop/SectionContent.tsx`):** Four rendering modes:
- Hazards/Emergency: red-tinted card (bg-red-500/10) with bullet list parsed from content newlines
- PPE: blue-tinted card (bg-blue-500/10) with individual item chips
- Steps: flat numbered list with inline SopImageInline per step
- Default: neutral steel-800 card

**SOP Detail Page (`src/app/(protected)/sops/[sopId]/page.tsx`):** h-screen flex-col layout with sticky header (back link, title, cache indicator), sticky tab bar (top-[56px]), scrollable section content. "Start Walkthrough" bottom bar (h-[72px] bg-brand-yellow) shown only on Steps tab, linking to `/sops/{sopId}/walkthrough`. Loading skeleton and not-found error state.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

All 7 created files verified on disk. Both commits present:
- `952d78b` feat(03-03): SOP library page with search, category filter, and cards
- `40f7232` feat(03-03): SOP detail page with section tabs and quick-reference content

`npx tsc --noEmit` passes with zero project-source errors.
`npm run build` completed successfully with `/sops` and `/sops/[sopId]` routes rendered.
