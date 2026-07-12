---
phase: 30-ux-consolidation
plan: 07
subsystem: admin-builder
tags: [ux-06, ux-07, plain-language, action-menu, tokenisation, wcag-f09]
requires:
  - 30-05 (wave dependency)
  - 30-01 (phase30 harness + list-rows/plain-language stubs)
provides:
  - Labelled per-SOP action menu (SopActionsMenu) in the BuilderStageShell top bar — Assign to team / Version history / Generate video / Print QR code + Delete SOP for drafts, reachable from every stage (UX-06 builder half, decision #2)
  - Plain-language builder stage labels Edit / Check / Send to workers (display only; BuilderStage union + routing unchanged)
  - KIND_LABEL plain-title map for AI reviewer flags, rendered in FlagBadge (never raw kind, never a raw block number)
  - Publish reversibility copy + fully tokenised PublishStage (0 inline style blocks)
  - Plain-language offline pill
affects:
  - 30-08 (drops the icon-only row actions — their labelled home now exists in the builder)
tech-stack:
  added: []
  patterns:
    - "Labelled action menu in a dark top bar: trigger with visible text + aria-haspopup/aria-expanded, token-classed dropdown, transparent fixed backdrop button for outside-click close"
    - "Plain-language pass = display strings only; state unions/routes/stored kinds asserted unchanged by spec"
key-files:
  created: []
  modified:
    - src/app/(protected)/admin/sops/builder/[sopId]/BuilderStageShell.tsx
    - src/app/(protected)/admin/sops/builder/[sopId]/BuilderStageStepper.tsx
    - src/app/(protected)/admin/sops/builder/[sopId]/PublishStage.tsx
    - src/components/admin/DeleteSopButton.tsx
    - src/components/admin/ai-reviewer/FlagBadge.tsx
    - src/components/layout/OnlineStatusBanner.tsx
    - tests/phase30/list-rows.spec.ts
    - tests/phase30/plain-language.spec.ts
decisions:
  - "Publish button enabled state uses the established bg-[var(--ink-900)]/text-[var(--paper)] primary-CTA idiom (blocks/AI-draft precedent) — the old var(--brand-yellow) fallback #fbbf24 was an undefined token rendering a hardcoded hex"
  - "Back-to-Review link copy updated to 'Back to Check' so the publish surface tracks the renamed stage (no spec asserted the old string)"
  - "FlagBadge surfaces source_location_hint visibly (human 'page 3 step 7' style hints) alongside the plain title"
metrics:
  duration: ~25m
  completed: 2026-07-12
requirements-completed: [UX-07]
requirements-partial: [UX-06 (builder half — row simplification lands in 30-08)]
---

# Phase 30 Plan 07: Builder Action Menu + Plain-Language Pass Summary

**One-liner:** The 5 per-SOP actions got a labelled home in the builder top bar (SopActionsMenu, every stage, fixes F-09), builder stages now read Edit / Check / Send to workers, AI reviewer flags speak plain outcomes via KIND_LABEL with human location hints, publish states "You can unpublish or edit later" on a fully tokenised PublishStage, and the offline pill says "No internet — your work is saved on this device".

## What was built

### Task 1 — Labelled per-SOP action menu in the builder shell header (commit `5080cf7`)
- `SopActionsMenu` in `BuilderStageShell.tsx` header (right cluster, before the flow buttons): labelled `Link`s — Assign to team → `/admin/sops/${sopId}/assign`, Version history → `/versions`, Generate video → `/video`, Print QR code → `/qr` — plus `DeleteSopButton` gated on `initialSop.status === 'draft'`. Trigger is a visible-text "Actions" button with `aria-haspopup="menu"`/`aria-expanded`; dropdown is CSS-var token-classed (paper/ink); outside-click closes via a transparent fixed backdrop button. No icon-only `evidence-btn` idiom anywhere in the menu.
- `list-rows.spec.ts` builder-half assertions flipped live with href WIRING (interpolated `${sopId}` routes, DeleteSopButton prop wiring, draft gate) + a labelled-not-icon-only test. Row-simplification tests stay fixme for 30-08.

### Task 2 — Plain stage labels + publish reversibility + tokenised PublishStage (commit `276d67b`)
- `BuilderStageStepper.tsx`: StageChip display labels Build→**Edit**, Review & verify→**Check**, Publish→**Send to workers** in both the 3-stage and 2-stage arrays. `BuilderStage` union `'build' | 'review' | 'publish'`, stage keys, routing, and guards untouched (proven by clean `npm run build`).
- `PublishStage.tsx`: "You can unpublish or edit later." rendered directly under the publish button; all 9 inline `style={{}}` blocks replaced with CSS-var token classes (`--ink-900/500/100`, `--paper`, `--accent-signoff/decision/escalate`); `grep -c "style={{"` = 0. All phase29 structural contracts preserved (`publish-button` testid 400-char window clean of `approvalStatus`, `ApprovalChainPanel` pending-gate ordering, "Publish SOP" text) — phase29 suite 85/85 green.

### Task 3 — Plain flag titles + offline pill + spec live (commit `f75d0c0`)
- `FlagBadge.tsx`: exported `KIND_LABEL: Record<ReviewerFlagKind, string>` — hallucination→'Made-up content', omission→'Missing content', anchoring→'Picture not linked to its step', table_fidelity→'Table may be scrambled', terminology→'Wording changed'. Plain title rendered visibly in the badge AND used in the title attr (raw `flag.kind` no longer shown anywhere); human `source_location_hint` now visible. UI-side map only — reviewer job prompts and stored `kind` strings untouched (T-30-07-01). Swept `ReviewerFlagsPanel`/`AdversarialFlagBanner`: neither ever rendered raw block-number titles (AdversarialFlagBanner already uses `section_title` + `step ${step_number}`); ban asserted across all ai-reviewer `.tsx` by spec.
- `OnlineStatusBanner.tsx`: "No internet — your work is saved on this device".
- `plain-language.spec.ts` flipped live + strengthened: KIND_LABEL render wiring (not just declaration), old-label bans, block-number ban directory sweep, old+new offline copy.

## Verification results

| Gate | Result |
|------|--------|
| `npx tsc --noEmit` | clean |
| `npm run build` + postbuild bundle gate | clean — 1056 KB, Δ 0 KB; walkthrough/pdfjs/konva isolation OK |
| `npx playwright test --project=phase30 --project=phase28 --project=phase29` | 158 passed / 11 skipped (30-08 fixmes + live-DB skips), 0 failed |
| `grep -c "style={{" PublishStage.tsx` | 0 |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] DeleteSopButton post-delete `router.refresh()` breaks in builder context**
- **Found during:** Task 1
- **Issue:** The list-row DeleteSopButton refreshes after delete — in the builder that refreshes the page of a now-deleted SOP
- **Fix:** Optional `redirectTo` prop (builder passes `/admin/sops`); optional `showLabel` prop for the visible-text menu variant. Defaults preserve list behaviour; the server-action path (`deleteSop`, org-scoped) is unchanged (T-30-07-02)
- **Files modified:** src/components/admin/DeleteSopButton.tsx (not in the plan's files_modified list)
- **Commit:** `5080cf7`

**2. [Rule 1 - Bug] Own comment tripped the block-number ban spec**
- **Found during:** Task 3 spec run
- **Issue:** The KIND_LABEL docblock contained the literal banned phrase (same self-trip class as 30-06 deviation #3)
- **Fix:** Reworded to "never a raw block number"
- **Commit:** `f75d0c0`

## Requirements completion (ownership notes)

- **UX-07** — complete here: stage labels Check/Edit/Send to workers, plain reviewer flag titles with human location names, publish reversibility, plain offline pill, PublishStage tokenised, all touched controls labelled.
- **UX-06** — builder half complete here (labelled action menu, decision #2). The one-line row simplification + row-side spec flips land in 30-08; UX-06 is marked complete there.

## Known Stubs

None — the menu links point at existing, working routes; KIND_LABEL is fully wired into the rendered badge.

## Threat Flags

None new. T-30-07-01 mitigated (KIND_LABEL is render-only; stored kinds + prompts untouched, build proves no enum change). T-30-07-02 mitigated (Delete reuses the existing org-scoped `deleteSop` server action; no new deletion path).

## Commits

| Commit | Description |
|--------|-------------|
| `5080cf7` | feat(30-07): labelled per-SOP action menu in builder shell header |
| `276d67b` | feat(30-07): plain-language stage labels + publish reversibility + tokenise PublishStage |
| `f75d0c0` | feat(30-07): plain AI-reviewer flag titles + plain offline pill; plain-language spec live |

## Self-Check: PASSED

BuilderStageShell menu + SUMMARY exist; commits 5080cf7, 276d67b, f75d0c0 in git log; tsc + build (bundle gate delta 0 KB) + phase28/29/30 all green (158 passed).
