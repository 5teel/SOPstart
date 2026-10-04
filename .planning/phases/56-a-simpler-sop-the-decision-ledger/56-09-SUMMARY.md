---
phase: 56-a-simpler-sop-the-decision-ledger
plan: 09
subsystem: sop-surfaces
tags: [placement, standards, labels, worker-page, machines-picker, journeys]
requires: [56-04, 56-06]
provides:
  - src/lib/sop/placement.ts (placementSummary, placementLabel, standardNames)
  - src/components/sop/StandardLabels.tsx (StandardLabels, data-testid standard-label)
  - useSopDetail embeds machines + department and standards in the one sops select
  - "Lives on" line and Whole site button in the admin machines picker
affects: [56-10, 58]
key-files:
  created:
    - src/lib/sop/placement.ts
    - src/components/sop/StandardLabels.tsx
    - tests/phase56/placement.spec.ts
  modified:
    - src/types/sop.ts
    - src/hooks/useSopDetail.ts
    - src/app/(protected)/sops/[sopId]/page.tsx
    - src/components/sop/tabs/ReadTab.tsx
    - src/components/sop/walkthrough/DesktopWalkthrough.tsx
    - src/components/sop/walkthrough/ImmersiveStepCard.tsx
    - src/app/(protected)/admin/sops/builder/[sopId]/BuilderMachinesButton.tsx
    - src/lib/journeys/journeys.ts
key-decisions:
  - "standardNames lives in placement.ts (plain module) and StandardLabels.tsx re-exports it, so the spec imports no React component and the plan's artifact export list still holds"
  - "Read tab labels go on the safety card title, the chosen job heading and the reference section titles (the three heading sites); the Whole-site button only appears when at least one machine is linked"
requirements-completed: [SOP-02, SOP-03]
duration: ~30 min
completed: 2026-10-04
---

# Phase 56 Plan 09: Placement and standards labels Summary

Every worker SOP surface now says where the SOP lives (machines and their department, or Whole site) and shows SOP- and section-level standards as quiet labels; an admin can put a SOP back on the whole site from the machines picker.

## What was built

- **Helper:** `placementSummary` (no machines means whole site; departments unique, null-skipped, sorted; machines sorted) and `placementLabel` (`Whole site`, `EVAL Press · Forming`, `EVAL Press, Oven · Forming`). The worker page and the admin picker both use it.
- **Query:** one extra embed pair on the existing `sops` select, no extra round trip.
- **Worker page:** `data-testid="sop-meta"` line under the title plus SOP-level labels. Section labels on Read (safety card, job heading, reference titles), `DesktopWalkthrough` meta row and `ImmersiveStepCard` header. Step-level labels are not shown on the old walk (A-05).
- **Picker:** `placement-line` (`Lives on: ...`) and `placement-whole-site` button calling `makeWholeSite()` -> `setSopMachines({ sopId, machineIds: [] })` with optimistic update + rollback + save state. The UI never writes `sops.placement`; the trigger does.
- **Journey:** `map-the-site` builder step describes the placement line, Whole site and the display-only department (D-10).

## Embed proof (service key, exact select incl. section_kind, sop_steps, sop_images)

- Convert fixture SOP `92f826fe`: OK. `placement: "site"`, `standard_attachments: []`, `sop_machines: []`, 3 sections, each section carries a `standard_attachments` key.
- SOP with a machine link `aee074df`: OK. `placement: "machine"`, `sop_machines: [{ site_machines: { name: "EVAL Press", departments: { name: "Forming" } } }]`, `standard_attachments: []`.

PostgREST resolved every embed (sop-level and section-level `standard_attachments -> standards`, `sop_machines -> site_machines -> departments`).

## Verification

- `npx playwright test --project=phase56`: 97 passed, 15 skipped (live-gated). `placement.spec.ts` has 14 tests: 6 helper behaviours plus a source contract (page calls `placementLabel(` and renders `StandardLabels`, the three other files render it, none of the four imports `/admin/` code or `@/actions/standards` or mentions `focus_step`).
- design-tokens, no-undefined-css-tokens, no-dead-internal-hrefs: pass. `npx tsc --noEmit` clean.
- Compiled CSS contains `text-accent-inspect` and `bg-accent-inspect\/10`.
- `npm run build` clean. Bundle lines:
  - `check-bundle-size: /sops/[sopId]/page = 818 KB (baseline 817 KB, Δ +1 KB, tolerance ±2 KB)`
  - `check-bundle-size: /sops/page = 818 KB (baseline 817 KB, Δ +1 KB, tolerance ±2 KB)`
- `.bundle-baseline.json` untouched.

## Deviations from Plan

None. Not exercised in a browser here; the deployed eval for placement and labels is part of 56-10.

## Known Stubs

None.

## Threat Flags

None. T-56-25, T-56-26, T-56-22, T-56-11 mitigated as planned: embeds are session-client reads under existing RLS, display-only department, worker files import no admin code, the UI never writes placement.

## Task commits

1. Task 1 (helper, types, embed, label component, spec): `9651704`
2. Task 2 (page, Read, both walks, source contract): `98166ca`
3. Task 3 (picker placement line + Whole site, journey): `283662e`

## Self-Check: PASSED

- placement.ts, StandardLabels.tsx, placement.spec.ts present; all three commits on master; no deletions.
