---
phase: 58-the-sop-focus-screen-walk-edit
plan: 13
subsystem: focus-editor-wiring
tags: [editor, lazy-seam, parse-progress, ai-check, walk-edit-switch, on-ramps, bundle-gate, evals]
requires: [58-06, 58-07, 58-11, 58-12]
provides:
  - "src/hooks/useParseJob.ts: the one realtime + polling engine (useParseJob, requeueParse, ParseJobSnapshot); ParseJobStatus calls it"
  - "src/hooks/useFindings.ts, src/components/focus/admin/{AiCheckBanner,ParseProgress,FocusEditor}.tsx"
  - "src/components/focus/EditorSkeleton.tsx (worker-side skeleton rail + cards)"
  - "FocusFrame: the single next/dynamic({ ssr: false }) seam; FocusEditorBridgeContext in useFocusBack.ts"
  - "page.tsx: ?mode=edit through requireSopEditAccess, open-draft redirect, parse job, initialMode / canEdit"
  - "FocusWalker + FocusTopBar: admin-only Walk / Edit switch (ModeSwitch), flips in place"
  - "scripts/check-bundle-size.ts: focus-editor marker group on /sops/[sopId]/page and a positive 'own lazy chunk' check"
  - "tests/evals/sop-focus.eval.ts admin half (authored and listed, not run)"
affects: [58-14, 58-15, 58-16, 58-17, 58-18]
key-files:
  created:
    - src/hooks/useParseJob.ts
    - src/hooks/useFindings.ts
    - src/components/focus/EditorSkeleton.tsx
    - src/components/focus/admin/AiCheckBanner.tsx
    - src/components/focus/admin/ParseProgress.tsx
    - src/components/focus/admin/FocusEditor.tsx
    - tests/phase58/parse-progress-ui.spec.ts
  modified:
    - src/components/admin/ParseJobStatus.tsx
    - src/components/focus/{FocusFrame,FocusTopBar,FocusWalker,FocusRail}.tsx
    - src/components/focus/admin/EditRail.tsx
    - src/hooks/useFocusBack.ts
    - "src/app/(protected)/sops/[sopId]/page.tsx"
    - scripts/check-bundle-size.ts
    - src/components/admin/UploadDropzone.tsx
    - "src/app/(protected)/admin/sops/new/ai/PromptClient.tsx"
    - "src/app/(protected)/admin/sops/new/blank/WizardClient.tsx"
    - src/lib/journeys/journeys.ts
    - tests/evals/sop-focus.eval.ts
key-decisions:
  - "The frame hands the lazy editor a bridge context (rail sheet state, save-pill slot, a beforeBack registration, the Walk / Edit switch for the phone sheet, and an onFocus report-back). The editor cannot be imported by the frame, so the editor reaches back through context, never the reverse"
  - "FocusEditor reports its latest read of the SOP through the bridge and FocusWalker uses it as its data, so flipping Edit -> Walk shows the steps as edited without router.refresh (frame-structure pins that FocusWalker makes no router call)"
  - "canEdit = admin or safety_manager AND (edit access when ?mode=edit was asked for). In browse the session client already proved the row is in the caller's organisation, so the role alone decides the switch; an approver with edit access reaches the editor and never sees the switch, Publish or tick"
  - "A SOP that is uploading / parsing opens in the editor frame for an admin even without ?mode=edit, so an on-ramp address or a pasted link is never an empty browse page"
  - "A published SOP with an open draft redirects (server-side) to that draft in edit mode; a refused edit request falls back to the worker resolution, so a worker forcing ?mode=edit still gets not-found for a draft"
requirements-completed: []
completed: 2026-10-05
---

# Phase 58 Plan 13: Editor wiring Summary

**An admin lands in the editor frame from any on-ramp with a client navigation, sees the SOP being read (stage, rough time, skeleton) and then the steps swap in place with the AI check on top; the whole editor sits behind one lazy seam the worker route never downloads.**

FOC-02 / WRK-03 / WRK-04 / SOP-04 are not ticked: the deployed eval (58-18) proves them.

## Commits

| Task | Commit | What |
|------|--------|------|
| 1 | `b3afbcf6` | `useParseJob`, `ParseProgress`, `useFindings`, `AiCheckBanner`, `FocusEditor`, `EditorSkeleton`, bridge context, phase40 specs repointed, `parse-progress-ui` spec |
| 2 | `29a6708a` | lazy seam in `FocusFrame`, page `?mode=edit` + parsing, Walk / Edit switch, bundle marker group + positive check, `edit-rail` / `frame-structure` / `bundle-gate` specs |
| 3 | `41ff25a0` | three on-ramps, journeys, eval admin half, specs that named the old builder redirect |

## Bundle gate (`npm run build`, exit 0, run twice: after Task 2 and after Task 3)

```
check-bundle-size: /sops/[sopId]/page = 793 KB (baseline 794 KB, Δ -1 KB, tolerance ±2 KB)
check-bundle-size: /page = 832 KB (baseline 831 KB, Δ +1 KB, tolerance ±2 KB)
check-bundle-size: ✓ Focus editor is its own lazy chunk, not charged to /sops/[sopId]/page: static/chunks/7046.657682dd5c4726c8.js
check-bundle-size: ✓ Bundle isolation OK (delta within tolerance, no forbidden marker in a gated route)
check-bundle-size: ✓ Marker self-validation OK — every forbidden marker is present somewhere in the build.
```

`git diff -- .bundle-baseline.json` is empty. The worker route got 1 KB smaller (the tab switcher's leftovers no longer share a chunk with it); the editor adds nothing. The positive marker replaces the retired `DesktopWalkthrough` check: it finds the static chunk carrying `I have checked this` (only the step card has it), fails if there is none, and fails if the worker route's chunk set holds it. The route's own page chunk is still the known uncounted blind spot (not touched).

Compiled CSS after build: `max-sm:hidden`, `sm:hidden`, `motion-reduce:animate-none`, `animate-pulse`, `text-ai`, `w-75`, `bg-ink-100`, `lg:flex`, `max-lg:fixed` each found.

## Seam grep

`grep -rln "focus/admin" src | grep -v src/components/focus/admin/` prints `FocusFrame.tsx` plus the two old-builder files 58-12 repointed (`BuilderStageShell.tsx`, `BlockEditShell.tsx`, both deleted in 58-16). The plan's "only FocusFrame" acceptance cannot hold until then; `edit-rail` pins the exception list (a third file fails) and asserts FocusFrame reaches the editor only through `dynamic(() => import(...))` with `ssr: false`, and that no worker file in `src/components/focus` statically imports the editor, autosave, `focus-steps`, `findings`, `versions`, `useFindings` or `useFocusSop`.

## What was built

- **useParseJob**: the realtime + grace + stale-watchdog + 5 s poll engine moved out of `ParseJobStatus` unchanged (same timers, `shouldStartPolling`, the effect-scoped `cancelled` flag checked after every await and in the realtime handler). It reports completion through callbacks and never navigates. Adds `pollError`, `patch`, and a plain `requeueParse` for the editor's Try again. `ParseJobStatus` keeps its `handleReparse` / `handleRestructure` text (the reparse-precondition spec pins it) and calls the hook.
- **ParseProgress**: five-stage `PLAIN_STAGES` stepper, `parseProgress(...)` wording (no page count), rough time, indeterminate bar (static under reduced motion), "You can go Back…", queued / poll-error / failed (the job's own error, Try again, Back; no Try again for a prompt draft), `onDone()` on completion, no route change.
- **AiCheckBanner + useFindings**: not run / running / findings / all clear / failed, "Show me" (scroll + focus), "Clear finding" through `clearFinding` (ledger), cleared rows kept as "Cleared · logged in the decision ledger", the no-source line, 429 caps and 422 mapped to plain lines, publish gate re-read after run or clear.
- **FocusEditor**: while reading, `EditorSkeleton` + `ParseProgress`; on done it re-reads the SOP and renders `EditRail` (+ `ThisSopBlock`), `EditDocument` (banner slot: "Done reading. N steps found — check each one." then the AI check, draft only), `PublishBar`; portals the save pill into the top bar, registers the autosave flush for Back, reports its latest SOP read.
- **Frame / page / switch**: see key-decisions. The switch moves into the rail sheet below 640 px; hidden on superseded versions, while parsing and for non-admins.
- **On-ramps**: one uploaded file opens the editor at once (`router.push(focusHref(id, { mode: 'edit', from: 'workshop' }))` from the end of the Upload press, a client navigation so the parse request keeps going); several files keep the banner; the banner button and the video recorder use the same push. AI prompt pushes as soon as `sopId` exists; the wizard pushes after `createSopFromWizard` (and the machine link). No `window.location` in any of the three files.
- **Journeys**: the four creation journeys end in the editor at `/sops/[sopId]`; new "Publish a new version" journey.

## Eval cases added (listed with `--list --project=evals sop-focus`, not run against production)

`58-edit-admin` (also the Walk / Edit flip with `window.__nav`), `58-edit-ai-findings` (also Clear), `58-edit-publish-dialog` ("Not yet"), `58-edit-blank`, `58-this-sop`, `58-superseded` (admin opens the exact v2), `58-parsing` (+ the video fixture moved to `transcribing` then restored: `58-parsing-video`), `58-parse-failed`, and SOP-04 (`EVAL focus publish`: Start editing v2 with no reload, tick each step one at a time, Publish, worker on the v1 address lands on v2, v1 stays on record, "1 earlier version"). Fixture reset is in `beforeAll` / `afterAll` (findings reopened, published children removed).

## Verification

- `npx tsc --noEmit` clean; `npm run build` exit 0.
- Green: `phase58` (parse-progress-ui, parse-progress, edit-rail, edit-ui, frame-structure, the rest), `phase40`, `phase41`, `phase55`, `phase57`, `phase30`, `phase28`, `phase32`, `phase43`, `phase52`, `phase53`, `phase54`, `phase56`, `phase26.5`, `phase21-stubs`, `phase21-unit`, `phase15-stubs` (design-tokens, no-undefined-css-tokens, no-dead-internal-hrefs, no-bulk-verify-ui).
- Red, not from this plan (logged in `deferred-items.md`): `phase25-integration` A4 `__new__`; `phase11-stubs` x8 (old builder / Puck specs; SB-AUTH-01 fails on its `useForm` line before the redirect line I repointed).

## Deviations from Plan

**1. [Rule 3] FocusWalker, `FocusEditorBridgeContext`, `EditorSkeleton`, `FocusRail`, `EditRail` are touched although not in the plan's file list.** The plan says the switch and editor mount in the frame; the walker owns the mode, the rail is rendered by the frame, and the lazy chunk cannot be imported by the frame, so a context bridge was the only way to carry the rail sheet, save pill and Back flush. `EditorSkeleton` lives worker-side because the frame needs it before the chunk loads.

**2. [Rule 3] Specs that named the old builder redirect were repointed** (`phase57/machine-body`, `phase41/reference-sweep`, `sb-auth-builder`, `phase40/dup03-job-progress`, `phase58/edit-ui` seam test): all assert the same contract at its new address.

**3. [Design] `router.refresh()` replaced by a report-back.** Flipping Edit -> Walk after an edit would show stale steps; refreshing needs a router call in `FocusWalker`, which `frame-structure` forbids, so the editor reports its read through the bridge instead.

**4. [Scope] Wizard / upload on-ramp eval not authored as a UI flow.** The wizard's title step is a metadata dialog stepper and an upload costs an AI parse; authoring either blind against production is brittle. The no-reload property is proved by the `window.__nav` check on Start editing v2 and by source-contract specs on all three files (no `window.location`, `focusHref(` present). 58-18 can add the upload case if wanted.

**5. Plan's `AiCheckBanner` label.** Findings read "Isolation · 4" (`railNumber`), as the plan says, not the UI-SPEC's "Step 4 · Isolation".

## Known Stubs

None.

## Threat Flags

None beyond the register. T-58-draft: edit mode requires `requireSopEditAccess` on the server and a refusal falls back to the worker resolution; T-58-bundle: one `dynamic` seam, marker group + positive check in the build, spec forbids static imports; T-58-finding: Clear is `clearFinding` only; T-58-21: no router call in any effect (page, walker, frame, editor, hook all asserted), the switch uses `history.replaceState`, on-ramp pushes run from a user action completing.

## Self-Check: PASSED

- Created files exist: `useParseJob.ts`, `useFindings.ts`, `EditorSkeleton.tsx`, `AiCheckBanner.tsx`, `ParseProgress.tsx`, `FocusEditor.tsx`, `parse-progress-ui.spec.ts`.
- Commits `b3afbcf6`, `29a6708a`, `41ff25a0` exist.
- Acceptance greps: `useParseJob(` appears once in `ParseJobStatus.tsx` and once in `ParseProgress.tsx`; `bg-\[--` under `src/components/focus` returns nothing; `window.location` absent from the three on-ramp files; `focusHref(` in `UploadDropzone.tsx`; `route: '/sops/[sopId]'` on the creation journeys.
