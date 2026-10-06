---
phase: 60-requests-notifications-objectives
plan: 12
subsystem: raise-and-ask-ui
tags: [requests, asks, lazy-modules, bundle-gate, journeys, evals]
requires: [60-06, 60-11]
provides:
  - src/components/requests/DialogShell.tsx (shared recessed-screen dialog shell)
  - src/components/requests/RequestComposer.tsx (RequestComposerTrigger, lazy)
  - src/components/requests/AskPicker.tsx (AskTrigger, lazy)
  - MachineBody rowAction / footer slots
affects: [60-13, 60-14, 60-15, 60-17]
key-files:
  created:
    - src/components/requests/DialogShell.tsx
    - src/components/requests/RequestComposer.tsx
    - src/components/requests/AskPicker.tsx
  modified:
    - src/components/office/ReasonDialog.tsx
    - src/components/sop/plant/MachinePanel.tsx
    - src/components/shell/WorkerShell.tsx
    - src/components/admin/governance/AdminMachinePanel.tsx
    - src/components/focus/admin/ThisSopBlock.tsx
    - scripts/check-bundle-size.ts
    - src/lib/journeys/journeys.ts
    - tests/phase60/request-surfaces.spec.ts
    - tests/phase60/repoint-inventory.spec.ts
    - tests/phase58/edit-rail.spec.ts
    - tests/phase59/signoff-panel.spec.ts
    - tests/phase57/shell-structure.spec.ts
    - tests/lint/no-static-admin-lens-import.spec.ts
    - tests/evals/requests.eval.ts
key-decisions:
  - "Composer `about` is `{ sops?, machines?, site? }`; a one-entry list renders as a fixed 'About ·' line, several as a native select (covers the machine panel, browse and the overview with one shape; kinds with nothing to be about are not offered)"
  - "The dialog is mounted only while open, so every open starts from an empty form without any reset code"
  - "DialogShell captures the opener in a layout effect so a child's passive focus call cannot overwrite it"
requirements-completed: []
completed: 2026-10-06
---

# Phase 60 Plan 12: Raise and ask UI Summary

Workers and supervisors raise a change / new SOP / observe-me request from a "Make a request" button under the machine panel's rows; supervisors, admins and safety managers ask a role or a person to do a published SOP from `Ask ›` on a row or "Ask someone to do this" in This SOP, which replaces "Assign this SOP". All of it is lazy.

## Commits

| Task | Commit | What |
|------|--------|------|
| 1 | 20189c2e | DialogShell (ReasonDialog now renders through it), RequestComposer, AskPicker, request-surfaces spec |
| 1 (fix) | 55837b1e | phase59 signoff-panel pin repointed at the shared shell |
| 2 | ef0c16d5 | slots and triggers, markers, lint allow-list, journeys, edit-rail repoint, eval case |

## Components and slots

- `MachineBody` / `SopRows` take `rowAction?(sop)` and `footer?`; MachinePanel imports neither module. `WorkerShell` holds two `next/dynamic({ ssr:false })` wrappers; the footer (composer, all three kinds, About = the machine's SOPs and the machine) shows for workers and supervisors, `Ask ›` rows for supervisors only.
- `AdminSopRows` renders a dynamic `AskTrigger` after Edit on published rows (no composer there). `ThisSopBlock` shows the rail `AskTrigger` for admins on published SOPs.
- Picker: A role / A person segments, select-then-confirm (the Ask button is the only sender), counts ("14 people will be told." / "They'll be told."), "Already has this", receipt line, `['user-sop-assignments']` invalidated.
- Composer: kind radiogroup (hidden for a single kind), About line or select, note with counter, Send request / Don't send, 10 s success line, `MY_REQUESTS_KEY` invalidated.

## Bundle

- Markers `['What do you need?', 'Find a person…']` added to both gated routes; "Marker self-validation OK" on both builds (the ellipsis literal survives minification).
- Build 1 and build 2 identical: `/sops/[sopId]/page` 794 KB (baseline 792, Δ +2, unchanged from 60-11) and `/page` 834 KB (baseline 834, Δ 0, was 833). `.bundle-baseline.json` untouched. The static cost of the two `dynamic()` wrappers was below the KB rounding.
- Lint allow-list gains `RequestComposer: []` and `AskPicker: []`.

## Journeys

`assign-sop` rewritten as "Ask someone to do a SOP" (machine row or This SOP, select then Ask, due at once, decline from My requests); its screen node for the assign page removed; `build` step names "Ask someone to do this"; worker journey gains a "Make a request" step. `LIVE_PLANS` += `60-12`.

## Eval

`requests.eval.ts` 60-12 case authored and `--list`ed only (not run): admin Ask › (count 1 first), role Workers with the told line (`60-ask-picker`), person mode (`60-ask-person`), Don't ask; worker has no Ask, opens composer (`60-composer-machine`), Change a SOP, sends (`60-composer-sent`), reopens and asserts the note is empty.

## Results

`npx tsc --noEmit` clean; `npm run build` x2 exit 0; phase60 140 passed (32 skipped later plans), phase52 72, phase54 59, phase57 116, phase58 219, phase59 146, phase15-stubs 46, all green. No live probes; no full suite.

## Deviations from Plan

**1. [Rule 1] Two pins repointed that the plan did not list.** `tests/phase59/signoff-panel.spec.ts` asserted `aria-modal` and the Esc handler inside ReasonDialog; they now live in DialogShell (the extraction the plan asked for). `tests/phase57/shell-structure.spec.ts` requires every page route to be on the pathways map; removing the assign screen node (as planned) flagged `/admin/sops/[sopId]/assign`, so it joins the redirect-only set until 60-17 deletes the page. `/pathways` therefore shows that screen unmapped until 60-17.
**2. Composer `about` shape** differs from the plan's union (see key-decisions); the 60-14 and 60-15 callers pass `sops: [one]` or `machines` / `site`.
**3. The phase59 pin failure was caught after the Task 1 commit** (I committed before reading the verify output) and fixed in its own commit.
**4. Row receipt** for `Ask ›` is a small floating status chip under the trigger rather than a line under the whole row, to avoid reflowing the row.

## Known Stubs

None.

## Threat Flags

None beyond the register: T-60-52 to T-60-55 mitigated (supervisor-only trigger plus server re-check; payloads carry only ids, kind and note; markers on both routes; form remounts on every open).

## Self-Check: PASSED

The three components and this summary exist; commits 20189c2e, 55837b1e and ef0c16d5 exist. Not pushed, per instruction. STATE.md and ROADMAP.md untouched.
