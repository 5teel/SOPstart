---
phase: 58-the-sop-focus-screen-walk-edit
plan: 12
subsystem: focus-editor-core
tags: [editor, step-card, tick, autosave, publish-bar, this-sop, lazy-admin-chunk]
requires: [58-04, 58-05, 58-08, 58-10]
provides:
  - "src/components/focus/admin/{EditDocument,StepCard,EditRail,ThisSopBlock,PublishBar,PublishDialog}.tsx"
  - "src/components/focus/admin/{InlineText,MachinesButton,StandardsButton,CategoryButton}.tsx (relocated from the old builder)"
  - "src/hooks/useFocusAutosave.ts: useFocusAutosave(sopId) -> { queue, flush }, useFocusSaveStatus"
  - "src/hooks/useFocusSop.ts: useFocusSop(sopId, initial) -> { focus, invalidate }, useFocusLineage(sopId)"
  - "tests/phase58/edit-ui.spec.ts, edit-rail.spec.ts (rail half + bar/dialog)"
affects: [58-13, 58-14, 58-15, 58-16]
key-files:
  created:
    - src/components/focus/admin/EditDocument.tsx
    - src/components/focus/admin/StepCard.tsx
    - src/components/focus/admin/EditRail.tsx
    - src/components/focus/admin/ThisSopBlock.tsx
    - src/components/focus/admin/PublishBar.tsx
    - src/components/focus/admin/PublishDialog.tsx
    - src/hooks/useFocusAutosave.ts
    - src/hooks/useFocusSop.ts
    - tests/phase58/edit-ui.spec.ts
  modified:
    - src/components/focus/KindChip.tsx
    - src/components/admin/DeleteSopButton.tsx
    - src/lib/sop/focus-read.ts
    - "src/app/(protected)/admin/sops/builder/[sopId]/BuilderStageShell.tsx"
    - src/components/admin/builder-v2/BlockEditShell.tsx
    - src/lib/journeys/journeys.ts
    - tests/phase58/edit-rail.spec.ts
    - tests/phase51/builder-machines-row.spec.ts
    - tests/phase56/standards-actions.spec.ts
    - tests/phase30/list-rows.spec.ts
    - tests/phase54/library-table.spec.ts
    - tests/builder/builder-edit-stage.spec.ts
  moved:
    - "builder-v2/InlineText.tsx -> focus/admin/InlineText.tsx"
    - "builder/[sopId]/BuilderMachinesButton.tsx -> focus/admin/MachinesButton.tsx"
    - "builder/[sopId]/BuilderStandardsButton.tsx -> focus/admin/StandardsButton.tsx"
    - "builder/[sopId]/BuilderCategoryButton.tsx -> focus/admin/CategoryButton.tsx"
key-decisions:
  - "The three tool buttons take an optional `trigger(open)` render prop (default is the old menu row), so the same modal serves the rail, a section menu and a step card without a second copy"
  - "StandardsButton `target` narrows the popover to one section or step; omitted or `sop` keeps the full panel the old Tools menu used. It also takes `onChanged` so the editor re-reads its labels"
  - "Autosave state is module-level (one editor on screen); a patch that still fails after three retries stays queued, never dropped, and the 'didn't save' strip reads `gaveUp`"
  - "The editor does not decide who may tick: the page passes `canTick` / `isAdmin`; the server actions are the gate"
requirements-completed: []
completed: 2026-10-05
---

# Phase 58 Plan 12: Editor core Summary

**The editor's components exist over the guarded 58-04/05/08 actions: a worker-shaped document with a per-step tick, a rail with "This SOP", a bottom bar that agrees with the server gate, and a publish dialog that handles approval chains. Nothing mounts them yet.**

Requirement ids FOC-02 / WRK-04 / SOP-04 are not ticked: no screen mounts the editor until 58-13 and the deployed eval (58-18) is what proves them.

## Commits

| Task | Commit | What |
|------|--------|------|
| 1 | `c18e29d3` | relocations (4 files), `useFocusAutosave`, `useFocusSop`, 5 specs repointed |
| 2 | `f580c581` | `StepCard`, `EditDocument`, `EditRail`, `edit-ui` spec |
| 3 | `1a26b6b2` | `ThisSopBlock`, `PublishBar`, `PublishDialog`, `edit-rail` spec filled |

## Relocations and repointed specs

| Old | New |
|---|---|
| `src/components/admin/builder-v2/InlineText.tsx` | `src/components/focus/admin/InlineText.tsx` |
| `builder/[sopId]/BuilderMachinesButton.tsx` | `src/components/focus/admin/MachinesButton.tsx` (`MachinesButton`) |
| `builder/[sopId]/BuilderStandardsButton.tsx` | `src/components/focus/admin/StandardsButton.tsx` (`StandardsButton`, `target`, `trigger`, `onChanged`) |
| `builder/[sopId]/BuilderCategoryButton.tsx` | `src/components/focus/admin/CategoryButton.tsx` (`CategoryButton`, `trigger`) |

The old builder (`BuilderStageShell`, `BlockEditShell`) imports the new paths and still compiles until 58-16. Specs repointed in the same commit: `phase51/builder-machines-row`, `phase56/standards-actions` (file path, JSX tags, the "no worker file imports the panel" sweep), `phase30/list-rows`, `phase54/library-table`, `builder/builder-edit-stage` (E4). `phase56/placement` pinned none of the moved files (58-11 already repointed it), so it is unchanged. `grep -rn "builder-v2/InlineText\|Builder(Machines|Standards|Category)Button" src tests` returns nothing (one `journeys.ts` description naming `BuilderCategoryButton` was reworded).

## What was built

- **StepCard**: kind select (chip-coloured), text through `InlineText` (commit on blur, never HTML), "Add a tip" to a labelled textarea, "Needs a photo" switch, 72 px photo thumbs with Remove and "Add a photo" (compress, `getStepImageUploadUrl`, PUT, `attachStepImage`), step standards, `...` menu (Move up / Move down / Standards / Delete step with the UI-SPEC confirm), violet left marker plus inline text for a finding, and the foot tick "I have checked this" for `canTick` (ticked reads "Checked"). An edit that matters shows "Edited — check it again" immediately; the server trigger clears the tick and the re-read confirms. Non-ticking editors see the state read-only.
- **EditDocument**: version slot (`versionLine`: "Editing v4 — v3 is live", "Draft — not published yet", "v3 is live", "v2 — superseded", "Published v4 · logged in the decision ledger"), "Start editing v{n}" that calls `forkDraft` in its click handler and `router.push(focusHref(draftId, { mode: 'edit', from }))`, `bannerSlot`, sections in source order with `01` numbers, click-to-edit titles, `...` menu (Rename, Move up/down, Standards, Delete section dialog "Its {n} steps go too."), hairline "＋" between steps (always visible below lg), dashed "Add a step" per section and "Add a section", blank state, the "didn't save" strip, and published/superseded versions read-only. Exports `addDefaultSection` (shared with the rail).
- **EditRail**: same container as `FocusRail`; sections and steps in source order, kind dot, tick state at the right (hollow circle / `Check` / violet dot), "＋ Add section", sticky `footer` slot.
- **ThisSopBlock**: collapsible; version row and "n earlier versions" (links to `focusHref(id, { from })`, browse only), machine ("Whole site" when none), objective (dashed box, `setSopObjective`), standards, "Let workers jump ahead" (`setAllowForwardJump`, admins only, drafts only, hint copy verbatim), Assign this SOP, Category, Open original document (tab opened inside the click, then pointed at the signed URL), Delete draft (`DeleteSopButton`, drafts only, `/?place=workshop`).
- **PublishBar**: "Checked n of N steps" + `h-1` bar and the gate `reasons` from `getPublishGateStatus`; "Publish v4" / "Publish SOP" enabled only on `ready` (`aria-disabled` otherwise); pending approval shows "Sent to {approver} for approval — it publishes when they approve." and no Publish; admins only get the button; only a draft shows the bar.
- **PublishDialog**: "Publish v4?" / "Workers get v4 the next time they open this SOP. v3 stays on record." / "Not yet"; POSTs the publish route; maps `unverified_steps` / `no_steps` / `open_findings`; `pendingApproval` closes and tells the bar; success closes and tells the document; no redirect; registered in the overlay registry.
- **useFocusAutosave**: `queue(stepId, patch)` merges per step, 750 ms gap, `updateFocusStep`, 5 s retry x3, `pagehide` / `visibilitychange` flush, `flush()` for Back's `beforeBack`, `useFocusSaveStatus` (`saving` / `saved` / `error`, `gaveUp`). After each settled save the SOP read and the gate are invalidated. No last-write-wins branch.
- **useFocusSop / useFocusLineage**: React Query over `getFocusSop` with `initialData`, `invalidate()` re-reads SOP, gate and approval; lineage via `listLineageVersions`.

## Verification

- `npx tsc --noEmit` clean.
- `npm run build` exit 0. Bundle gate, worker routes unchanged by this plan:

```
check-bundle-size: /sops/[sopId]/page = 794 KB (baseline 794 KB, Δ 0 KB, tolerance ±2 KB)
check-bundle-size: /page = 832 KB (baseline 831 KB, Δ +1 KB, tolerance ±2 KB)
check-bundle-size: ✓ Bundle isolation OK (delta within tolerance, no forbidden marker in a gated route)
```

  (`/page` +1 is the 58-10/58-11 figure, unchanged; nothing imports the admin components yet.)
- Green: `phase58` (edit-ui 17, edit-rail 15, plus the rest; two switch cases stay fixme for 58-13), `phase51`, `phase56`, `phase30`, `phase54`, `phase55`, `phase57`, `phase40`, `phase41`, `phase15-stubs` (`no-bulk-verify-ui`, `design-tokens`, `no-undefined-css-tokens`, `no-dead-internal-hrefs`); 606 + 367 passed.
- Red, not from this plan, already in `deferred-items.md`: `phase26 ai-overlay`, `phase26 visual-block` (both 58-16 deletes).
- Compiled-CSS spot check was not run (no new utility family; every class used already shipped in 58-10/58-11).

## Deviations from Plan

**1. [Design] Kind control is a native `<select>`, not a chip button plus custom menu.** It is chip-coloured, keyboard-operable and accessible for free, and saves a menu implementation. Same four options, same autosave call.

**2. [Rule 3] Shared `OverflowMenu` and `menuItemClass` live in `StepCard.tsx`** (no separate file; the plan's component list is unchanged). Menu items stay mounted while the menu is shut, so a modal an item opens (the standards popover) is not unmounted when the menu closes.

**3. [Scope] Three small additions outside the plan's file list.** `DeleteSopButton` gained an optional `label` (the plan asks for "Delete draft"; the existing button only said "Delete SOP"); `loadFocusSop` / `FocusSopMeta` carry `category_slug` (the Category row needs the current value); `KindChip.tsx` exports `KIND_CHIP`. All additive.

**4. `EditableDocument.tsx` was not touched.** The plan lists it, but it never imported `InlineText`; only `BlockEditShell` and `BuilderStageShell` needed repointing.

**5. Empty step text is never saved.** `updateFocusStep` refuses an empty text, so the card skips an empty commit (the placeholder "Write the step" stays) instead of queueing a write that would fail three times.

## Handoff to 58-13

- Mount `EditDocument` and `EditRail` (rail `open` / `onClose` come from the frame's sheet state; the frame currently renders `FocusRail` itself, so 58-13 needs a rail slot or an edit variant), `ThisSopBlock` as the rail `footer`, `PublishBar` below the column, `useFocusSaveStatus` for the top-bar pill, and `flush` from `useFocusAutosave` as the frame's `beforeBack`.
- Pass `canTick` / `isAdmin` from the role (admin or safety manager), `findings` and `flaggedStepIds` from the AI check data, `publishedNote` from the `PublishBar` `onPublished` callback.
- All of it must come in through `next/dynamic({ ssr: false })` gated on `useIsAdmin()`; `tests/phase58/edit-ui.spec.ts` already fails if any worker file imports `components/focus/admin`.
- Annotate (D-03) is not in the step card; 58-17 adds it behind the same seam.

## Known Stubs

None. Every control calls a real action. The `bannerSlot`, `findings`, `flaggedStepIds` and `footer` props are optional seams filled by 58-13.

## Threat Flags

None beyond the plan's register: T-58-gate (one tick per step through `tickFocusStep`; no batching, no tick-all wording, both asserted in `edit-ui`; Publish follows `getPublishGateStatus` and the server gate still decides), T-58-20 (`InlineText` writes `textContent`; no HTML-injection API under `focus/admin`, asserted), T-58-fork (`forkDraft` called once, from a click handler, no effect in the file, asserted), T-58-bundle (build shows the worker routes unchanged; no worker file imports the admin folder, asserted).

## Self-Check: PASSED

- Created files exist: the six components, both hooks, `edit-ui.spec.ts`; the four relocated files are at their new paths and gone from the old ones.
- Commits `c18e29d3`, `f580c581`, `1a26b6b2` exist.
- Acceptance greps: `I have checked this` in `StepCard.tsx`; `it publishes when they approve` in `PublishBar.tsx`; `Let workers jump ahead` in `ThisSopBlock.tsx`; `useEffect` in `EditDocument.tsx` appears nowhere; old-name grep over `src tests` returns nothing.
