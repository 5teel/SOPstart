---
phase: 58-the-sop-focus-screen-walk-edit
plan: 16
subsystem: retirement
tags: [deletion, consumer-graph, retirement-sweep, dropped-features, bundle-gate]
requires: [58-15]
provides:
  - "tabbed SOP page parts, old walkthroughs, their stores, the builder, the versions page and the block machinery deleted"
  - "submitCompletion({ walkId }) is the only submit path; requireSopEditAccess has no junction arm"
  - "dropped-features.json: tabbed-sop-page, old-walkthrough, block-builder, versions-page (all live in the deletion sweep)"
  - "retirement-sweep 58-16 block live; repoint inventory has 58-16 in LIVE_PLANS"
affects: [58-17, 58-18]
tech-stack:
  added: []
  patterns: ["reachability walk from app entry points (before vs after) to find newly dead modules", "survivor list with consumer per D-29"]
key-files:
  created: []
  modified:
    - src/actions/completions.ts
    - src/lib/auth/guards.ts
    - src/actions/sections.ts
    - src/actions/versioning.ts
    - src/hooks/useFocusAutosave.ts
    - scripts/dropped-features.json
    - scripts/decision-writers.json
    - scripts/check-bundle-size.ts
    - .bundle-baseline.json
    - src/lib/uat/tests.ts
    - .planning/codebase/CAPABILITY-MATRIX.md
    - tests/phase58/retirement-sweep.spec.ts
    - tests/phase58/repoint-inventory.spec.ts
key-decisions:
  - "submitWalkCompletion was folded into submitCompletion: one function, `.strict()` on `{ walkId }`, the completion insert, retry-safe photo rows and the walk update all in one body; the ack trace local is named ackTrace"
  - "The block-model pre-existing orphans that only the retired surfaces used (SectionContent, resolveRenderFamily, SectionKindPicker, AddSectionButton, AdversarialFlagBanner, MissingSectionWarningBanner, OriginalDocViewer, VideoReviewPanel, walkthrough-progress) were deleted with the rest; unrelated orphans (ui/*, PageShell, useViewport, useNotifications, platform-admin-guard, similarity) were left"
  - "scripts/contract-check.ts (the prebuild three-place block gate) was deleted with its prebuild and contract:check entries: place (1) and (3) read files that no longer exist or no longer matter"
  - "Dropped-feature entries are file/dir/route kinds only (no symbol patterns), so the phase58 specs that quote retired tokens do not trip the Phase 55 scan"
requirements-completed: []
completed: 2026-10-05
---

# Phase 58 Plan 16: Retirement Summary

The old SOP page, walkthroughs, builder, versions page and block model are deleted by consumer graph in two commits, each with `tsc` and `npm run build` green, and the sweeps keep them gone.

## Commits

| Task | Commit | What |
|---|---|---|
| 1 | `97e0e185` | worker side: tabs, SopTabNav, WorkerPreviewToggle, SopSectionTabs, walkthrough folder, SafetyAcknowledgement, StepProgress, four stores, useSopDetail, legacy submit input, CSS; `tabbed-sop-page` + `old-walkthrough`; `useFocusSaveStatus` reset |
| 2 | `398296bf` | admin side: builder route, versions page, builder-v2, builder rail, verify-checklist, ai-reviewer UI, source-viewer panes, SectionEditor, section PATCH route, block machinery, harness scripts, matrix, UAT, bundle; `block-builder` + `versions-page` |

## Deleted modules (task 2, by reachability from app entry points)

- **Routes:** `admin/sops/builder/[sopId]/*` (9 files), `admin/sops/[sopId]/versions/page.tsx`, `api/sops/[sopId]/sections/[sectionId]/route.ts`.
- **Admin UI:** `components/admin/builder-v2/**` (agent, fields, ghosts, inserter, visual, BlockEditShell, EditableDocument, selection-bridge), `components/admin/builder/**`, `verify-checklist/**` (with its two in-src tests), `ai-reviewer/**`, `source-viewer/{BboxOverlay,DocxPreview,PdfCanvasPage,SourceViewerPane,VideoSourcePreview,index,useSelectionSync}`, `SectionEditor`, `SectionKindPicker`, `AddSectionButton`, `AdversarialFlagBanner`, `MissingSectionWarningBanner`, `OriginalDocViewer`, `VideoReviewPanel`, `governance/ApprovalChainPanel`.
- **Block machinery:** `components/sop/blocks/**` (18 blocks + index), `LayoutRenderer`, `SectionContent`, `SopBlockContext`, `SopImageInline`, `SopTable`, `EscalationFormModal`; `lib/builder/{block-findings,block-registry,block-type-labels,content-ops,layout-schema,puck-to-block-content,sanitize-layout,sign-layout-data-images,supported-versions,section-blocks-core}`, `lib/blocks/create-block-core`, `lib/sections/resolveRenderFamily`, `lib/parsers/parsed-sop-to-layout-data`.
- **Actions / hooks:** `actions/{sop-section-blocks,escalation,walkthrough-progress}`, `hooks/useBuilderAutosave`; from kept files: `updateSectionLayout`, `getVersionHistory`, `VersionRecord`, `cloneSopAsDraft`, `getBlockAgentMetadata` + view type, the `{ junctionId }` arm of `requireSopEditAccess`, and the old `flags` envelope on the AI-check route GET.
- **Scripts:** the eight builder harnesses (`selection-sync-check`, `field-panel-check`, `field-panel-reachability-check`, `field-patterns-check`, `render-parity-check`, `autosave-rewire-check`, `ai-overlay-check`, `agent-panel-check`), `backfill-section-layouts`, `capture-convert-golden`, `contract-check` (and its `prebuild` / `contract:check` entries in package.json).
- **Types:** `Block`, `BlockVersion`, `PinMode`, `SopSectionBlock` removed from `types/sop.ts`.
- **CSS:** `.immersive-step-card`, `.walkthrough-list`, the `hide-below-430` family, `.walkthrough-step-grid`, `.block-*` accent wrappers, `.block-focus-flash`, the builder `.agent-layer-root` / `.ameta` / `.agentbanner` rules (the `.agentpanel` look stays: the org agent dashboard uses it).
- **Tests:** about 50 whole-subject specs (builder, phase26 block specs, verify-checklist, source viewer, version breakdown, wayfinder header, tab merge, plain language, sb-layout-editor, sb-section-schema, sb-ux-blocks / -escalate / -contract, resolve-render-family, golden fixtures) and the three empty Playwright projects (`phase21.5-stubs`, `phase21.6-stubs`, `phase22-stubs`).

## Survivors of the block machinery (D-29: module, consumer)

| Module | Kept by |
|---|---|
| `lib/validators/blocks.ts` | `types/sop.ts` (`BlockContent`), which `lib/builder/diff-block-content.ts` uses |
| `lib/builder/diff-block-content.ts` (+ its test beside source) | `components/ai-fields/InlineProposalDiff.tsx`, which has no importer now (a Phase 60 AI-proposal UI residue; it was an orphan before this plan) |
| `lib/builder/version-lineage.ts` | `actions/versions.ts` (`forkDraft`) |
| `lib/sop/sections.ts` (hazard / PPE / emergency classifiers, `Section`) | `lib/sop/convert.ts` (the `--missing` converter), `focus-write.ts` (type) |
| `lib/parsers/source-viewer/*` | the parse route and `types/sop.ts` (provenance regions) |
| `components/admin/source-viewer/types.ts` | `api/sops/[sopId]/source-url/route.ts`, an endpoint with no UI caller now (left; deleting an API route was not in the plan) |
| `lib/parsers/ai-reviewer/**` | the AI-check route, `parse-pipeline`, `agent-layer/signals` |
| `components/sop/StandardLabels.tsx` | the focus browse, walk and editor |

`uploadNewVersion` (and its `parse_jobs` plumbing) stays unreferenced in `versioning.ts` as recorded Phase 61 residue (D-24); the Phase 55 survivors list now names it instead of `cloneSopAsDraft`.

## Parameters retired with their callers

- `submitCompletion` takes only `{ walkId }` (`.strict()`); `SubmitCompletionSchema`, the client step data, ack trace, content hash and photo-list inputs are gone. `step_data` and the ack trace are built from the server's walk row.
- `requireSopEditAccess` has no `{ junctionId }` locator.
- AI-check GET no longer returns the old envelope `flags`.

## Verification

- Task 1: `npx tsc --noEmit`, `npm run build` (792/794 KB), phase55, phase56, phase58, phase30, phase15-stubs, phase28, phase33, phase41, phase57 green.
- Task 2: `npx tsc --noEmit`, `npm run build` exit 0, then phase58 (retirement sweep + inventory with 58-16 live), phase55 deletion sweep (4 new features live), phase56, phase15-stubs (`no-dead-internal-hrefs`, `design-tokens`, `no-undefined-css-tokens`, `no-bulk-verify-ui`), phase41, 43, 26, 29, 30, 40, 46, 57, 54, 52, 28, 36, 21.5-unit, 21-ai-reviewer, 26.5, 32, 23-stubs: 1226 passed, 42 skipped, 0 failed. `playwright --list` loads 2142 tests with no missing import. `npm run lint`: no new problem in files touched (the 40 pre-existing errors are in `scripts/copy-ffmpeg.js`, `transcripts/`, and test files outside this plan).
- Compiled CSS carries the focus utilities (`min-h-tap` found) and `.agentpanel`.

## Bundle gate

```
check-bundle-size: /sops/[sopId]/page = 792 KB (baseline 792 KB, Δ 0 KB)   (was 794 -> measured 792, moved DOWN by hand, history note added)
check-bundle-size: /page = 831 KB (baseline 831 KB, Δ 0 KB)
```

The client source viewer was the only place the pdfjs package name and the mammoth literals lived in the client build, so the marker self-validation went red once it was deleted. The groups are unchanged; the scan now also reads `.next/server/chunks` and the parse route bundle (where unpdf's pdfjs and the mammoth call survive), and the pdfjs package-name marker became `pdf.worker` (a literal pdfjs itself carries). Recorded in the baseline history; `tests/phase41/bundle-gate.spec.ts` repointed.

## Moved assertions

- `tab-merge` bundle-baseline case into `retirement-sweep` (58-11 describe).
- `walk-actions` submit cases rewritten for the merged `submitCompletion`; `decision-writers.json` delegated hook now `submitCompletion` after the `sop_completions` write.
- `decision-writers-sweep`: `verifyBlock` / `unverifyBlock` rows and the `sop_section_blocks` column key removed; `clearFinding takes only a finding id` added beside the tick tests.
- `spine-regression` keeps its publish-gate, no-bulk-verify and append-only cases; the block-meta and golden-converter cases went.
- `phase56/convert` registry parity pins the 18 stored block types as a literal list; `list-rows`, `plain-language-access`, `builder-machines-row`, `standards-actions`, `placement` repointed to the focus files; `scp-parse-pipeline` cut to the parts the focus screen relies on.
- `phase40/dat01` census 42 -> 40 (cloneSopAsDraft's insert and status flip); `phase36` refresher copy-forward now reads `forkDraft`.

## Deviations from Plan

**1. [Rule 3 - Blocking] EscalateBlock imported the walkthrough store (task 1).** Dropped the lock-in-store line (the block was deleted in task 2) so commit 1 builds on its own.

**2. [Rule 3 - Blocking] `contract-check` and the prebuild.** Both places it read (the block registry, `BLOCK_REGISTRY` in introspection) were gone or going; deleted the script, its two package.json entries and the two specs that ran it.

**3. [Rule 3 - Blocking] Marker self-validation red after the source viewer left** (see Bundle gate); fixed by re-deriving, not by dropping a group.

**4. [Rule 3 - Blocking] Pre-existing orphans removed with the block model** (SectionContent, resolveRenderFamily, the section-editing banners and picker, walkthrough-progress): task 2 read their only importers as deleted files.

**5. UAT list:** sixteen builder / versions entries removed, the agent-layer and refresher entries rewritten (refresher archived), one `p58-focus-screen` entry added. Test ids in `uat_feedback` rows are untouched in the database.

**6. The 58-15 `useFocusSaveStatus` flag is fixed** in task 1 (reset on mount of the per-SOP effect) with a source-contract test in `edit-ui.spec.ts`.

## Flags for the orchestrator (behaviour with no focus-screen successor, now unreachable)

- `requestChanges` (approval chain "request changes") has no UI caller: its only host was the deleted `ApprovalChainPanel`. Approve still works from the governance queue; the focus publish bar only shows who holds the approval.
- `getApprovalHistory` has no caller (58-15 flag, now final).
- `setRefresherInterval` (governance.ts) has no UI caller: it was set from the versions page. The refresher UAT entry is archived until a surface returns.
- Escalation actions (`dispatchEscalationAlert`, `lockStep`, `submitEscalationReport`) were deleted with the Escalate block; the `escalation_reports` table remains, unused.
- `api/sops/[sopId]/source-url` is an endpoint with no caller.
- `parse_jobs.ai_review_results` envelope is still written by the reviewer (agent-layer signals read it).
- Live-probe projects (phase33/34/35/37/46/51) were run once by mistake in a wide sweep and hit `verifyOtp: Request rate limit reached`; they are environment failures, unrelated to this plan. `tests/integration/wizard-sop-dept.spec.ts` A4 (`__new__`) is still red from before Phase 58 (deferred-items).

## Known Stubs

None.

## Threat Flags

None. T-58-walk (client step data and ack trace gone), T-58-24 (junction arm gone), T-58-25 (section PATCH route deleted, matrix gap closed) and T-58-01 (four features in the dropped list, mutation-proof via the Phase 55 sweep) are mitigated.

## Self-Check: PASSED

- Commits `97e0e185` and `398296bf` present in `git log`.
- `src/app/(protected)/admin/sops/builder`, `.../[sopId]/versions`, `src/components/sop/{walkthrough,tabs,blocks}`, `src/actions/sop-section-blocks.ts` absent; `grep -n junctionId src/lib/auth/guards.ts` empty; STATE.md and ROADMAP.md untouched.
