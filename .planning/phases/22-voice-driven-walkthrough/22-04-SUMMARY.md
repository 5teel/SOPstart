---
phase: 22-voice-driven-walkthrough
plan: 04
subsystem: walkthrough-ui
tags: [visual-layer, immersive, icon-fallback, sop-images, tdd, vdw-lit]
dependency_graph:
  requires:
    - "22-01: phase22-stubs test harness (visual-layer.spec.ts)"
  provides:
    - "ImmersiveStepCard always-on visual layer (photo-or-icon per step)"
  affects:
    - "22-03: live voice wiring (same card; visual layer now present)"
tech_stack:
  added: []
  patterns:
    - "SECTION_TYPE_ICONS map (section_type → LucideIcon, Record<string, LucideIcon>)"
    - "sop_images filter by step_id (identical to SectionContent.tsx pattern)"
    - "SopImageInline reuse for signed-URL photo renders"
    - "LucideIcon type for typed icon map"
key_files:
  created: []
  modified:
    - src/components/sop/walkthrough/ImmersiveStepCard.tsx
decisions:
  - "Icon fallback derived via SECTION_TYPE_ICONS[sectionType.toLowerCase()] ?? ListChecks — case-insensitive, defaults to ListChecks for any unmapped type (D-06)"
  - "stepImages computed from ownerSection.sop_images.filter(img => img.step_id === current.id) with ?? [] guard — reuses sop_images already present in SopWithSections, no query change needed (RESEARCH Assumption A3 resolved)"
  - "No new Props added to ImmersiveStepCard — ownerSection computed from existing sop.sop_sections lookup, no prop threading required"
  - "Sort stepImages by sort_order before render — consistent with SectionContent.tsx ordering convention"
  - "No publish gate introduced — render-only change; authoring remains ungated (D-06)"
metrics:
  duration: "~5 minutes"
  completed: "2026-06-24"
  tasks_completed: 1
  files_changed: 1
---

# Phase 22 Plan 04: Always-on Visual Layer (ImmersiveStepCard) Summary

**One-liner:** Extends ImmersiveStepCard with a photo-or-icon visual block using `SECTION_TYPE_ICONS` fallback map and per-step `sop_images` filter, so low-literacy workers always see a visual cue without requiring admins to author photos.

## What Was Built

### Task 1: Photo-or-icon visual layer in ImmersiveStepCard (commit `b1b8c49`)

Extended `src/components/sop/walkthrough/ImmersiveStepCard.tsx` with the always-on visual layer (VDW-LIT-01, VDW-LIT-02):

**Added imports:**
- `AlertTriangle, Shield, Siren, ListChecks, ClipboardCheck` from `lucide-react`
- `LucideIcon` type from `lucide-react`
- `SopImageInline` from `@/components/sop/SopImageInline`

**Added module-level constant:**
```typescript
const SECTION_TYPE_ICONS: Record<string, LucideIcon> = {
  hazard: AlertTriangle,
  hazards: AlertTriangle,
  ppe: Shield,
  emergency: Siren,
  steps: ListChecks,
  signoff: ClipboardCheck,
}
```

**Updated ownerSection lookup** (unified existing title-only lookup to also extract `section_type` and `sop_images`):
```typescript
const ownerSection = sop.sop_sections.find((s) => (s.sop_steps ?? []).some((st) => st.id === current.id))
const sectionTitle = ownerSection?.title ?? 'Section'
const sectionType = ownerSection?.section_type ?? 'steps'
const stepImages = (ownerSection?.sop_images ?? []).filter((img) => img.step_id === current.id)
const Icon: LucideIcon = SECTION_TYPE_ICONS[sectionType.toLowerCase()] ?? ListChecks
```

**Inserted visual block** (after time_estimate render, before evidence capture grid):
```tsx
<div className="mt-4">
  {stepImages.length > 0 ? (
    stepImages.slice().sort(…).map((img) => (
      <SopImageInline key={img.id} src={img.storage_path} alt={img.alt_text ?? current.text} />
    ))
  ) : (
    <div className="flex items-center gap-2 text-[var(--ink-400)]">
      <Icon className="h-8 w-8" aria-hidden="true" />
      <span className="mono text-[11px] uppercase tracking-wider">{sectionType}</span>
    </div>
  )}
</div>
```

**Verification:**
- `npx playwright test --project=phase22-stubs tests/phase22/visual-layer.spec.ts`: 4/4 GREEN
- `npx tsc --noEmit`: clean (no errors)
- No new Props added to the interface
- No publish gate introduced

## TDD Gate Compliance

- RED gate: Spec ran at Wave-0 head (3 fail, 1 pass). Confirmed before implementation.
- GREEN gate: All 4 tests pass after implementation (commit `b1b8c49`).
- No REFACTOR phase required.

## Deviations from Plan

None — plan executed exactly as written. RESEARCH Assumption A3 confirmed: `sop_images` is already present in `SopWithSections` (each `sop_sections` entry carries `sop_images: SopImage[]`), no query change required.

## Known Stubs

None. The visual layer is fully wired: `sop_images` flows from `useSopDetail` → `SopWithSections` → `ImmersiveStepCard.sop.sop_sections[n].sop_images` → filtered by `step_id === current.id`. Photo renders via `SopImageInline` (signed-URL resolution unchanged). Icon fallback renders via `SECTION_TYPE_ICONS` map.

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes introduced. Image data flows from the same `sop` prop already rendered for text — no new data path. `SopImageInline` handles signed-URL resolution (RLS-scoped, unchanged). T-22-04-01 disposition confirmed: accept (same data path).

## Self-Check: PASSED

Files verified:
- `src/components/sop/walkthrough/ImmersiveStepCard.tsx` — contains `SECTION_TYPE_ICONS`, `sop_images`, `SopImageInline`, `ListChecks` ✓

Commits verified:
- `b1b8c49` — feat(22-04): add always-on visual layer to ImmersiveStepCard ✓

`npx playwright test --project=phase22-stubs tests/phase22/visual-layer.spec.ts`: 4/4 green ✓
`npx tsc --noEmit`: clean ✓
No new Props added to ImmersiveStepCard interface ✓
No publish gate introduced ✓
journeys.ts: no change needed (no new route; immersive walkthrough screen already mapped) ✓
