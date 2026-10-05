---
phase: 59-the-office
plan: 08
subsystem: office expansions
tags: [office, sign-off, approvals, lightbox, reason-dialog, esc-layering]
requires: [59-06, 59-07]
provides:
  - "src/components/office/ReasonDialog.tsx: one focused reason dialog (Reject / Send back / Remove), 10-character gate, own Esc, optional cancelLabel"
  - "src/components/office/SignOffPanel.tsx: expanded sign-off row, every gate of the old review page"
  - "src/components/office/ApprovePanel.tsx: expanded approve row, requestChanges has a caller again"
affects: [59-09 inbox mounts both panels, 59-11 People Remove reuses ReasonDialog, 59-15 retires the old review page]
key-files:
  created:
    - src/components/office/ReasonDialog.tsx
    - src/components/office/SignOffPanel.tsx
    - src/components/office/ApprovePanel.tsx
  modified:
    - tests/phase59/signoff-panel.spec.ts
    - tests/phase59/approve-actions.spec.ts
decisions:
  - "Both panels split into a loader and a body keyed by the record id, so no state (override text, open dialog, error) can outlive its row"
  - "The lightbox caption plugin carries the counter as the slide title ('3 of 6') because the library's own counter hard-codes a slash"
  - "On the last step any approveStep error is shown as the publish-gate sentence; elsewhere the server's message is shown as is"
requirements-completed: []
completed: 2026-10-06
---

# Phase 59 Plan 08: Sign-off and Approve panels Summary

Both expanded inbox rows exist as finished, self-contained components with the old page's gates intact, ready for 59-09 to mount.

## Commits

| Task | Commit | What |
|------|--------|------|
| 1 | 40bfc523 | `ReasonDialog`, `SignOffPanel`, 11 source-contract cases (flipped from fixme) |
| 2 | 7386838f | `ApprovePanel`, 6 approve-panel cases in `approve-actions.spec.ts` |

## What shipped

- **Sign off:** worker (email), SOP link with `v{n}`, NZ date-time plus relative time, "n steps done · n photos", photo strip (`size-18`, `aria-label="Photo 2 of 6, step 9"`) opening the lazy lightbox with step captions, steps grouped by section with "Acknowledged" / "n photos", assessor teaching callout with Request assessment (Sending, Requested), admin override field `signoff-override-reason` gating Sign off at 10 non-space characters, Reject through `ReasonDialog`. `ASSESSOR_OVERRIDE_REQUIRED` opens and focuses the override field even when the panel believed the caller was an assessor; "Sign-off recorded but status update failed." is final and keeps both buttons disabled. A walk that is no longer pending shows "This walk has already been signed off / rejected." with no footer.
- **Esc layering (A-12):** while the lightbox is open `SignOffPanel` holds a capture-phase window `keydown` listener that closes it with `preventDefault()` and `stopPropagation()` and returns focus to the opening thumbnail; `ReasonDialog` stops its own Escape. ShellFrame's existing `defaultPrevented` / `aria-modal` guard is the second line.
- **Approve:** title and `v{n}`, "Open it to read it" (`focusHref(sopId, { from: 'office' })`), chain list (done with approver email and NZ day, "Your turn", waiting hollow), last-approver line, **Approve v4** / **Approve and publish v4**, **Send back** with a 10+ character note, publish refusal as a `role="alert"` sentence with the row kept. Approve and Send back are disabled when it is not the caller's turn or nothing is pending.
- Publishing is untouched: the panel imports neither the publish core nor the gate (spec-pinned); `phase56 publish-gate-pin` passes.

## Verification

- `npx tsc --noEmit` clean; `npm run build` exit 0, bundle gate `/page` 832 KB (baseline 831, Δ +1 KB), `/sops/[sopId]/page` 793 KB (Δ +1 KB), both unchanged from 59-07 (nothing mounts the panels yet), baselines untouched.
- phase59: 85 passed, 39 later-plan stubs skipped; phase56 `publish-gate` 2; phase37 `assessor-ui-signoff` 11; phase15-stubs `design-tokens` + `no-undefined-css-tokens` 9. No live probes, no full suite.
- The deployed eval cases for these panels land with 59-09.

## Deviations from Plan

- **[Rule 2] Not-your-turn and no-longer-pending states on `ApprovePanel`.** The server refuses both ("Not your turn to approve", "No pending approval for this SOP"); the panel now disables both buttons and says so in plain words instead of offering a button that can only fail.
- **[Rule 2] Already-decided state on `SignOffPanel`**, mirroring 59-06's server refusal of a decided walk.
- **Minor:** `ReasonDialog` takes an optional `cancelLabel` (default "Keep reviewing") so 59-11's Remove can say "Keep them". The lightbox counter is the caption title rather than the plugin's own counter (see decisions).
- Tests were written alongside the components (source-contract specs), not seen failing first.

## Known Stubs

None.

## Threat Flags

None beyond the register. T-59-31: the panel only mirrors `isAssessor` / `canOverride`, the server recomputes. T-59-32: 10-character gate in the dialog plus the server's own check. T-59-33: queries and bodies keyed by record id. T-59-34: only `approveStep` is called.

## Self-Check: PASSED

- Files exist: `src/components/office/{ReasonDialog,SignOffPanel,ApprovePanel}.tsx`, this SUMMARY.
- Commits 40bfc523 and 7386838f present in `git log`.
- STATE.md and ROADMAP.md untouched.
