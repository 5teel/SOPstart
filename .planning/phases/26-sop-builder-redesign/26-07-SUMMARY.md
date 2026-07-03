---
phase: 26-sop-builder-redesign
plan: 07
subsystem: admin-builder
tags: [field-editors, P14, reachability, pattern-c, field-panel, array-editor, D-01, R2]
requires:
  - field-map
  - field-commit
  - block-edit-shell
  - content-ops-reducer
provides:
  - field-panel
  - array-field-editor
  - field-panel-reachability
affects:
  - src/components/admin/builder-v2/BlockEditShell.tsx
  - src/components/admin/builder-v2/fields/field-commit.ts
tech-stack:
  added: []
  patterns:
    - "Pattern C = an anchored FieldPanel (.pk chrome: 1.5px ink-900 border, 10px radius, deep shadow, 300px, mono header) opened by the block's ⚙ edit-fields tool. Esc/click-away close via document listeners inside the mount effect (SSR-safe)."
    - "ArrayFieldEditor owns LOCAL rows state (seeded once, dnd-kit sortable rows). Object rows are SPREAD-MERGED ({...row,[k]:v}) so unknown row keys (Decision option nextStepId, set by the flow-graph field) survive an in-panel label edit — R7 lossless extends to array items, not just block props."
    - "One validated commit path is unchanged: every C edit calls onCommitField → the SAME 26-06 commitFieldToContent (coerce → validate WHOLE candidate vs block *PropsSchema → lossless updateBlockProps; invalid → prior value kept). Arrays pass through coerce unchanged (numeric=false)."
    - "P14 reachability hook: every field-strip row carries data-field={field}. The parity harness renders BlockEditShell per block and asserts every FIELD_MAP field (=== live puck-config fields, proven by 26-06 field-map.spec) has a data-field row → 0 unreachable, all 17 blocks."
    - "isFieldValueValid(props,type,field,value) reuses SCHEMA_BY_TYPE to power the panel's inline validity message WITHOUT mutating content (the write still routes through commitFieldToContent — single source of validation)."
key-files:
  created:
    - src/components/admin/builder-v2/fields/FieldPanel.tsx
    - src/components/admin/builder-v2/fields/ArrayFieldEditor.tsx
    - scripts/field-panel-check.tsx
    - scripts/field-panel-reachability-check.tsx
    - tests/phase26/field-panel-reachability.spec.ts
  modified:
    - src/components/admin/builder-v2/BlockEditShell.tsx
    - src/components/admin/builder-v2/fields/field-commit.ts
decisions:
  - "The actual Pattern-C fields (per FIELD_MAP === puck-config parity) are 5: PPECard items[] (string[]), Decision options[] (obj[], min 2, preserves nextStepId), Inspect items[] (obj[], min 1), PhotoBlock alt (scalar), ModelBlock assetUrl (scalar URL). Escalate recipients + Measurement tolerance{min,max,target} are NOT Puck `fields:` (only in defaultProps / component logic) so they are outside the parity gate — the plan prose named them but the reachability ground truth is puck-config, which the 26-06 spec enforces. FieldPanel handles both array and scalar C fields (ArrayFieldEditor for arrays, a text input for scalar config)."
  - "Pattern E (media grid: PhotoBlock src, StepWithPhotos photos, PhotoGrid items) stays deferred to 26-09. It renders a declared `media — soon` row with a data-field hook, so it is ACCOUNTED-FOR (0 dropped fields) but not yet editable. `unreachable === 0` here means every Puck field renders an affordance row; A/B/C/D are editable, E is a declared stub. This is the documented phase arc (26-06 deferred C+E; 26-07 ships C; 26-09 ships E)."
  - "Plain local useState in ArrayFieldEditor rather than react-hook-form (RESEARCH suggested rhf for array fields). The commit path is already Zod-validated + lossless, rows are tiny, and controlled local state avoids the rhf dependency surface + the controlled snap-back — fewer moving parts (ponytail)."
  - "Task 2 (tdd) RED/GREEN collapsed into one feat commit: the behavioural proof is a react-dom/server render + commit-path harness (a test-first RED is an import error, not a meaningful behavioural failure). Same shape + precedent as 26-04 / 26-06 Task 2 subprocess harnesses."
metrics:
  duration: ~55m
  completed: 2026-07-03
  tasks: 2
  files_changed: 7
---

# Phase 26 Plan 26-07: Pattern C Field Panel + P14 Reachability Summary

Completes the P14 RE-IMPLEMENT (D-01): the anchored **FieldPanel** + **ArrayFieldEditor** now edit the array/config fields the inline A/B/D patterns can't — PPE `items[]`, Decision `options[]` (min 2), Inspect `items[]`, and the panel-only scalars PhotoBlock `alt` / ModelBlock `assetUrl` — all through the SAME 26-06 Zod-validated, lossless commit path. The phase-level acceptance gate now holds: **0 Puck-editable fields are unreachable across all 17 registered block types**, proven behaviourally per block.

## What was built

### Task 1 — FieldPanel (Pattern C) + ArrayFieldEditor (`968c940`)
- `fields/FieldPanel.tsx`: anchored `.pk`-chrome popover (1.5px ink-900 border, 10px radius, `0 18px 50px` shadow, 300px, mono header) — one popover visual language shared with the inserter. Renders, per block C-field, either an `ArrayFieldEditor` (arrays) or a scalar text input (alt/assetUrl). Esc + click-away close via document listeners in the mount effect (SSR-safe). Each change autosaves through `onCommitField`; `isFieldValueValid` drives an inline "keeping the last valid value" message on Zod-invalid states. `C_FIELD_SHAPES` (keyed `${BlockType}.${field}`) carries the exact row shapes from `blocks.ts`.
- `fields/ArrayFieldEditor.tsx`: dnd-kit sortable rows with add / remove / reorder. Two variants — `string` (PPE) and `object` (Decision label+escalation toggle, Inspect label+require-photo toggle). Object rows spread-merge so unknown keys (Decision `nextStepId`) survive a label edit. Remove is disabled at/below the Zod min (Decision 2, Inspect 1). Owns local rows state so a keystroke never snaps back when an intermediate state is Zod-invalid.
- `fields/field-commit.ts`: added `isFieldValueValid()` (reuses `SCHEMA_BY_TYPE` + `stripMeta`) — reports panel validity without mutating content.
- `BlockEditShell.tsx`: new `⚙ edit-fields` tool (SlidersHorizontal) shown for any block with a C field; toggles the anchored `FieldPanel`. C-field strip rows now render an `edit` button that opens the same panel (was `panel — soon`). E-field rows keep `media — soon` (26-09).
- `scripts/field-panel-check.tsx` + spec: behavioural proof that C fields edit+persist through `commitFieldToContent` — PPE add row, Decision label edit + reorder + `nextStepId` preservation + <2 blocked by Zod min, Inspect toggle, Model URL valid/invalid, `junctionId`/`block_provenance` survive; and `renderToStaticMarkup` asserts the panel + array editor + ⚙ trigger actually mount (dead-feature guard).

### Task 2 — Per-block reachability parity, 0 unreachable (`c000bef`)
- `BlockEditShell.tsx`: every field-strip row now carries `data-field={field}` — the P14 reachability hook (works across all 5 patterns).
- `scripts/field-panel-reachability-check.tsx` + spec: renders `BlockEditShell` for each of the 17 registered blocks and asserts every FIELD_MAP field (=== live puck-config `fields:`, proven by 26-06's `field-map.spec`) has a `data-field` affordance row → **0 unreachable, 42 fields across 17 blocks**. Drives a representative field per pattern (A Callout title, B Hazard severity, C PPE items, D VoiceNote maxDurationSec) through the real commit path to valid `layout_data`; asserts the E (Photo src) stub row is present + declared.

## Deviations from Plan

### Auto-fixed / reconciliations (Rules 1–3)

**1. [Rule 1 — Reconciliation] Escalate `recipients` + Measurement `tolerance` are NOT Pattern-C fields here**
- The plan objective/UI-SPEC prose named Escalate `recipients[]` and Measurement `tolerance{min,max,target}` as Pattern-C. But neither is a Puck `fields:` entry in `puck-config.tsx` (recipients lives only in the Zod schema + component; tolerance only in defaultProps) — so the P14 parity gate (FIELD_MAP === puck-config fields, enforced by 26-06) does not include them. The reachability ground truth is puck-config; the real C fields are the 5 listed above. No code needed for recipients/tolerance to hit `unreachable === 0`.

**2. [Rule 3 — Blocking] Added two harness scripts not in `files_modified`**
- `scripts/field-panel-check.tsx` (Task 1's `-g "field-panel"` verify) and `scripts/field-panel-reachability-check.tsx` (Task 2's `-g "reachability"` verify). Both are the tsx subprocess harnesses the phase26 specs shell out to (the project has no `@/` alias + can't load React in-process — 26-06 precedent). Required for the plan's own `<verify>` commands.

**3. [Rule 1 — Test data] Reachability harness UUID must be Zod-v4-valid**
- The `nextStepId` fixture initially used `1111…-1111-…` which Zod v4's `.uuid()` rejects (variant/version enforced); corrected to a v4 UUID (`…-4111-8111-…`). A test-data fix, not a code bug — surfaced by the harness before commit.

### Scope decisions (deferred per plan)
- **Pattern E (media grid) stays deferred to 26-09.** Its fields render a declared `media — soon` row with a `data-field` hook, so they are accounted-for (0 dropped) but not yet editable. `unreachable === 0` here = every Puck field renders an affordance; A/B/C/D are editable, E is a declared stub. This is the documented phase arc, consistent with 26-06.

## Known Stubs
| Stub | File | Reason |
|------|------|--------|
| `media — soon` row (Pattern E fields: Photo `src`, StepWithPhotos `photos`, PhotoGrid `items`) | BlockEditShell.tsx | Media grid + medium picker is Plan 26-09. Field has a `data-field` reachability row (accounted-for, not dropped); editing wired there. |

Intentional, plan-scoped deferral. The E stub does not block P14 reachability (0 unreachable = 0 dropped fields); it blocks only in-canvas media editing, which is 26-09's goal.

## Frozen-contract / journeys note
No `layout_data`, junction, or `block_provenance` shape changed; array-item edits spread-merge (Decision `nextStepId` proven preserved). No route or user-facing flow added/removed/rerouted — this is an internal admin edit-engine change on the existing `/admin/sops/builder/[sopId]` Build stage — so `src/lib/journeys/journeys.ts` needs no update (same as 26-04 / 26-06). Worker read path untouched: build bundle Δ 0 KB, Konva/pdfjs/mammoth isolation intact.

## Threat Flags
None new. Register mitigations landed: T-26-07-01 (invalid array rows — e.g. <2 Decision options — blocked by the block `*PropsSchema` before commit; the panel keeps the last valid value + shows an inline message, proven by the <2/empty-item harness assertions), T-26-07-02 (row label text committed as input `value`/`textContent`, never innerHTML — no XSS surface).

## Verification
- `npx tsx scripts/field-panel-check.tsx` → FIELD-PANEL OK.
- `npx tsx scripts/field-panel-reachability-check.tsx` → FIELD-PANEL-REACHABILITY OK — 0 unreachable across all 17 blocks (42 fields).
- `npx playwright test --project=phase26 -g "field-panel"` → 1 passed.
- `npx playwright test --project=phase26 -g "reachability"` → 1 passed.
- `npx playwright test --project=phase26` → **44 passed** (was 42; +2, no regression).
- `npx tsc --noEmit` → clean.
- `npm run build` → green; postbuild bundle gate **/sops/[sopId] = 1054 KB, Δ 0 KB**, Konva/source-viewer isolation OK.

## Self-Check: PASSED
- FOUND: src/components/admin/builder-v2/fields/FieldPanel.tsx
- FOUND: src/components/admin/builder-v2/fields/ArrayFieldEditor.tsx
- FOUND: scripts/field-panel-check.tsx
- FOUND: scripts/field-panel-reachability-check.tsx
- FOUND: tests/phase26/field-panel-reachability.spec.ts
- FOUND commit: 968c940 (Task 1)
- FOUND commit: c000bef (Task 2)
