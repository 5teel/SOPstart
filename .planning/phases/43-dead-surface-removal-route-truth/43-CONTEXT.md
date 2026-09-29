# Phase 43: Dead-Surface Removal & Route Truth - Context

**Gathered:** 2026-09-30
**Status:** Ready for planning
**Source:** Orchestrator judgment calls on the two open questions in `43-RESEARCH.md` (no discuss-phase run — Simon chose `/gsd-plan-phase 43` directly; removal phase, not a design phase)

<domain>
## Phase Boundary

Certify the route tree **as it exists today, post-Phase-54**. Phase 42 (One Creation Flow) has NOT run and this phase does not do its work: `/admin/sops/upload`, `/admin/sops/new`, `/admin/sops/new/ai`, `/admin/sops/new/blank` stay live and linked. The phase fixes the concrete findings in `43-RESEARCH.md`, adds the mechanical guards that keep them fixed, and ships a deployed eval.

</domain>

<decisions>
## Implementation Decisions

### D-01 Page-level redirect shims are deleted; bookmark compatibility moves to `next.config.ts` `redirects()`
- Delete `src/app/(protected)/admin/governance/page.tsx` and `src/app/(protected)/admin/sops/page.tsx` (both zero-internal-reference, guard-first redirect shims).
- Add two entries to the existing `redirects()` array in `next.config.ts` (next to the `/admin/sops/:sopId/review` entry): `/admin/governance` → `/governance` and `/admin/sops` → `/sops`. Next.js redirects preserve the query string, so `?filter=`, `?view=` and the other legacy params still arrive at the target. The existing `/admin/sops/:sopId/review` entry stays.
- Remove the two shims' `journeys.ts` steps, and update `tests/phase41/reference-sweep.spec.ts` (`PERMITTED_FILES` / `EXPECTED_PERMITTED_COUNT`) and `tests/phase54/deletion-sweep.spec.ts` so they assert the new state (the shim page files are ABSENT and nothing in `src/` links to them).
- `/dashboard` (redirect-only, ~15 guard-failure call sites) is load-bearing and is NOT deleted.

### D-02 Lint scope is "this phase's files are clean and it makes nothing worse", not "repo-wide zero"
- The two confirmed dead-state findings are removed: `sopCategoryOptions` memo in `src/app/(protected)/admin/sops/new/blank/WizardClient.tsx` and the `selectedForCompare` state pair in `src/app/(protected)/admin/sops/[sopId]/versions/page.tsx`.
- Every file this phase touches ends with zero `@typescript-eslint/no-unused-vars` warnings (including `PhotoScanner.tsx`'s two pre-existing ones once it is wired in).
- No `eslint-disable` carve-out for `no-unused-vars` anywhere in `src/` (currently zero; must stay zero — pin it in a spec).
- The 549 pre-existing repo-wide lint problems (test-stub `page` params, the `setState in effect` rule) are OUT of scope.
- `npm run build` must run clean as the phase gate; the bundle baseline is never recaptured.

### D-03 `/admin/blocks/new` gets a real, minimal create form
- Removing the "New block" button is not an accepted resolution (ROADMAP wording: "opens a working surface instead of 404ing").
- Add `src/app/(protected)/admin/blocks/new/page.tsx` (a static segment wins over `[blockId]`) that renders a small form: name, kind (reuse `SectionKindPicker`), category chips + tags + org/global scope laid out like `SaveToLibraryModal`, submitting through the existing `createBlock()` action in `src/actions/blocks.ts`. No new server action, no second validation path. On success, navigate client-side to `/admin/blocks/[id]`.
- Add the new route to `journeys.ts` in the same change (Pathways rule).

### D-04 Scan-document button drives the shipped `PhotoScanner`
- In `src/components/admin/UploadDropzone.tsx`, replace the "Scanner coming soon" placeholder modal with `<PhotoScanner open onClose onSubmit>` and feed `onSubmit`'s files through the same queueing path `handleFileInput` uses.

### D-05 WiringPatchBay's unimplemented Matrix / Illuminate lens options are removed
- DED-02 read literally: a feature is implemented or its control is removed. Remove the two entries from `LENS_OPTIONS` in `src/components/admin/wiring/WiringPatchBay.tsx` and the "coming soon" branch they rendered, leaving Wiring as the only (and therefore untoggled) lens. If the toggle becomes a single option, remove the toggle UI too.

### D-06 Route documentation: targeted edits, not a rewrite
- `.planning/codebase/ARCHITECTURE.md`: fix the two stale lines (the `/admin/sops/[sopId]/review` review-surface sentence → the builder at `/admin/sops/builder/[sopId]`; "admins → `/dashboard`" → `/sops`). Do not bring the whole document current in this phase.
- `src/lib/journeys/journeys.ts`: fix the `publish` action route to `/api/sops/[sopId]/publish`.
- `/pathways` "All screens" must still report 0 not-mapped after every route add/delete in this phase.

### D-07 One repo-wide dead-href guard, mutation-proven
- New `tests/lint/no-dead-internal-hrefs.spec.ts` derives the route set from `src/app/**/page.tsx` (+ `route.ts`), strips comments (`stripComments` idiom), and fails on any internal `href` / `router.push` / `router.replace` / `redirect(` target whose static path does not resolve. Register it in the `playwright.config.ts` project regex and prove discoverability with `--list`. Mutation-prove it once (plant a dead href → red → remove → green) in the plan's verification.
- The guard cannot catch runtime 404s like `/admin/blocks/new`; that case is covered by the deployed eval.

### D-08 Deployed eval, per CLAUDE.md
- Extend an existing `tests/evals/*.eval.ts` (or add `tests/evals/dead-surface.eval.ts`) asserting: `/admin/blocks` → "New block" lands on the create form (not the not-found page text); `/admin/sops/upload` → "Scan document" opens the scanner UI, not "coming soon"; `/admin/governance` and `/admin/sops` still land on `/governance` and `/sops`. Reuse `tests/evals/sop-surface.eval.ts` test E for the 0-not-mapped check. Use `tests/evals/lib/session.ts` and the `SLOW` timeout idiom. Run with `npm run eval -- --phase 43` after push and READ the screenshots.

### Claude's Discretion
- Exact form layout and copy on the new-block page (keep it on the paper theme tokens; no raw palette classes).
- Whether the Phase 43 source-contract specs live in one `tests/phase43/*.spec.ts` file or two.
- Whether the eval assertions extend `sop-surface.eval.ts` or a new file.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Findings and guard idioms
- `.planning/phases/43-dead-surface-removal-route-truth/43-RESEARCH.md` — the file:line audit every task targets
- `tests/phase30/dead-weight.spec.ts`, `tests/phase54/deletion-sweep.spec.ts`, `tests/phase41/reference-sweep.spec.ts` — reference-sweep + `stripComments` idiom to copy and to update
- `src/lib/journeys/routes.ts`, `src/app/(protected)/pathways/PathwaysClient.tsx` — how "not-mapped" is computed

### Project rules
- `CLAUDE.md` — Pathways Map Maintenance, deployed-site evals, design-token lint, Learnings 2026-08-04 / 2026-06-08 / 2026-09-28 / 2026-09-13 / 2026-09-29
- `.claude/skills/sketch-findings-SOPstart/references/plant-floor-navigation.md` — which surfaces exist post-54

</canonical_refs>

<specifics>
## Specific Ideas

- `createBlock()` is already the single writer of block rows (the parser calls it); the new page is a thin client form over it.
- `PhotoScanner`'s props (`open`, `onClose`, `onSubmit(files)`) already match `UploadDropzone`'s `scannerOpen` state.

</specifics>

<deferred>
## Deferred Ideas

- Phase 42 One Creation Flow (creation-route convergence) — separate phase, unchanged.
- Bringing `.planning/codebase/ARCHITECTURE.md` fully current (it is dated 2026-06-01) — separate docs task.
- The ~500 pre-existing lint warnings (test-stub params, `setState in effect`) — separate cleanup.
- `scripts/check-bundle-size.ts` `[sopId]` blind spot — needs a signed-off baseline change, see `.planning/phases/53-phone-scan-or-ask/deferred-items.md`.

</deferred>

---

*Phase: 43-dead-surface-removal-route-truth*
*Context gathered: 2026-09-30 by orchestrator judgment from 43-RESEARCH.md*
