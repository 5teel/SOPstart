---
phase: 58-the-sop-focus-screen-walk-edit
plan: 14
subsystem: cutover
tags: [converter-retired, proxy-redirects, admin-entry-links, journeys, capability-matrix, evals]
requires: [58-13]
provides:
  - "58-CUTOVER.md: dry run and apply output of the final production converter run"
  - "scripts/convert-sops-to-steps.ts: --apply refuses (exit 1) before any env read; --missing fills only zero-step SOPs; native SOPs never touched"
  - "ticksToCarry() in src/lib/sop/convert.ts (pure); convertSop / planFocusStepWrites survive for focus-write.ts"
  - "proxy: /admin/sops/builder/<uuid> and /admin/sops/<uuid>/versions 307 to /sops/<uuid>?mode=edit; review route in next.config retargeted"
  - "every admin way into editing opens the focus editor with ?from="
affects: [58-15, 58-16, 58-18]
key-files:
  created:
    - .planning/phases/58-the-sop-focus-screen-walk-edit/58-CUTOVER.md
  modified:
    - scripts/convert-sops-to-steps.ts
    - src/lib/sop/convert.ts
    - src/lib/supabase/middleware.ts
    - next.config.ts
    - src/components/admin/governance/AdminMachinePanel.tsx
    - src/components/shell/AdminRoomBodies.tsx
    - src/components/admin/governance/GovernanceQueueRow.tsx
    - src/lib/governance/inbox.ts
    - "src/app/(protected)/admin/sops/[sopId]/assign/page.tsx"
    - src/actions/ai-fields.ts
    - src/lib/journeys/journeys.ts
    - .planning/codebase/CAPABILITY-MATRIX.md
    - tests/phase58/cutover-converter-retired.spec.ts
    - tests/phase58/legacy-redirects.spec.ts
    - tests/phase58/retirement-sweep.spec.ts
    - tests/phase58/repoint-inventory.spec.ts
    - tests/phase56/convert-apply.spec.ts
    - tests/evals/governance.eval.ts
    - tests/evals/site-editor.eval.ts
    - tests/evals/one-screen.eval.ts
    - tests/evals/sop-ledger.eval.ts
    - tests/evals/cut-features.eval.ts
key-decisions:
  - "A SOP is 'native' (left alone) on a new:/edit: key, a tick set in the editor, or a step updated after its last ok conversion run -- the plan only named the keys, but editing a converted step in the editor keeps its converted key, so keys alone would not have protected that work"
  - "The three pathway-coverage guards exempt the two redirect-only pages instead of journeys.ts naming the retired addresses (the plan's acceptance wins); 58-16 deletes the pages and the exemptions together"
  - "next.config review redirect is no longer permanent: it is a legacy mapping, never cached by a browser"
requirements-completed: []
completed: 2026-10-05
---

# Phase 58 Plan 14: Cutover Summary

**The final converter run is done against production and recorded, the converter can no longer overwrite steps, and the old builder, versions and review addresses redirect on the server to the focus editor with every admin Edit link already pointing there.**

WRK-04 / FOC-03 / SOP-04 are not ticked: the deployed eval (58-18) proves them.

## Commits

| Task | Commit | What |
|------|--------|------|
| 1 | `e263f7cd` | native-SOP skip, draft tick carry, the real dry run and apply, `58-CUTOVER.md` |
| 2 | `96974473` | `--apply` refuses, `--missing`, `cutover-converter-retired` spec, `convert-apply` repointed |
| 3 | `247d1d65` | proxy + next.config redirects, admin Edit links, journeys, matrix, evals, guards |

## The production run (full detail in `58-CUTOVER.md`)

- Dry run 2026-10-05T07:27:14Z; apply `--apply --all` 07:27:24Z to 07:27:33Z, exit 0, run `723b5378-d712-414d-951f-966efe040e03`.
- 89 SOPs, 89 passed the hazard/PPE gate, 0 failing. Hazard 288 -> 293, PPE items 111/111.
- **Planned step writes were 0 insert / 0 update / 0 delete**: no real SOP was edited in the old builder after the Phase 56 apply, so nothing was lost by freezing. Nine empty shells got a new run row only.
- Apply line: `9 converted / 68 unchanged / 0 failed / 7 native left alone / 5 still parsing`.
- 7 native SOPs, all eval fixtures; no real-org SOP had been touched by the editor.
- **6 ticks carried**, on two draft SOPs: `1ae63606` (5 of 31 steps) and `4bde8c99` (1 of 59). Confirmed by a second read of production afterwards.
- **Zero steps after the run (named in `58-CUTOVER.md`):** real org drafts `001`, `as`, "Forming Area Mandatory Minimum Safety Requirements and Procedures" (source empty), seven untitled shells, one `uploading` and one `parsing` untitled SOP; the rest are fixtures and probe SOPs in other orgs.

## Freeze window (T-58-22, accepted)

Starts 2026-10-05T07:27:33Z (end of the apply). Ends when this plan's commits are pushed and deployed. An edit made in the OLD builder in between is not captured, and since the editor is not the entry point from the admin screens until the push, the exposure is the time between the run and the deploy. Single org. **Simon: if you edited a SOP in the old builder after 07:27 UTC on 2026-10-05, tell me which; the converter can no longer re-run it (that is the point of retiring it).**

## What changed

- **Converter.** Task 1 added the native check, the editor-touch check, the parsing skip, the delete guard and the tick carry (`ticksToCarry` pure, unit-tested); `fromLayout` now takes its key from a shared `layoutItemKey` so the tick lookup and the converter cannot disagree. Task 2 made `--apply` print "converter retired in Phase 58" and exit 1 before reading env or creating a client (spec-pinned, including with an empty environment), and added `--missing`. A `--missing --all` against production afterwards wrote nothing: 53 zero-step SOPs have no source to convert.
- **Redirects.** `middleware.ts` runs `legacyRedirectFor` for `/admin/sops/` paths as well as `/sops/` (307, cookies copied, after the sign-in gate). `legacyRedirectFor` already mapped builder and versions to the edit address (58-02); `/admin/sops/<id>/assign` and `/versions/diff` are deliberately not mapped.
- **Entry links.** Machine panel Edit -> `focusHref(id, { mode: 'edit', from })`; Workshop drafts `from: 'workshop'`; Office queue row and inbox Retry `from: 'office'`; the assign page's back link opens the editor and its versions link is gone; `ai-fields.ts` revalidates `/sops/<id>`.
- **Journeys / matrix.** No step routes at the builder or versions page any more (the builder-review-publish, standards, version-supersede, machine-link, Workshop and governance-queue journeys were rewritten; a "Retry in the editor" step was added; the agent-layer journey lost its per-SOP builder panel steps). The matrix names the editor in the two rows that said builder and gains a row for the redirects (they grant nothing; the focus page's `requireSopEditAccess()` decides).
- **Evals (authored, not run).** governance and one-screen assert the new Edit href; site-editor step 6 links the machine through This SOP -> Machine; sop-ledger B opens the converted fixture in the editor and C adds the standard from This SOP; cut-features probes the two old addresses as redirects.

## Verification

- `npx tsc --noEmit` clean. `npm run build` exit 0, bundle gate: `/sops/[sopId]/page` 793 KB (baseline 794), `/page` 832 KB (baseline 831), editor still its own lazy chunk.
- Green: phase58 (196), phase56 (104; plus `PHASE56_LIVE=1 convert-apply`, 4/4 against a throwaway org), phase43, phase54, phase51, phase57, phase30, phase41, phase40, phase29, phase52, phase53, phase55, phase46, phase15-stubs (incl. `no-dead-internal-hrefs`), phase28, phase32, phase33, phase34, phase35, phase36, phase37, phase21-*, phase21.5-stubs, phase21.6-stubs, phase22/23-stubs, phase26.5. `--list --project=evals` lists 59 tests.
- Red, not from this plan, all in `deferred-items.md`: phase26 `ai-overlay` and `visual-block`, phase11-stubs x8, phase25-integration `wizard-sop-dept` A4, phase12.5-stubs x5 (`sb-ux-blocks`, `sb-ux-blueprint`; new entry).
- Acceptance greps: no templated builder href in `src/` outside the two to-be-deleted directories; the proxy has the `/admin/sops/` block; no `route: '/admin/sops/builder` in `journeys.ts`; `'58-14'` in `LIVE_PLANS`.
- No push (the orchestrator pushes). STATE.md and ROADMAP.md untouched.

## Deviations from Plan

**1. [Rule 2 - correctness] Native detection widened.** The plan names `new:` / `edit:` keys only. An admin who edits a converted step in the editor keeps its converted key, so a re-run would have overwritten it. The runner also treats a ticked step, or a step updated after the last ok conversion run, as native. The run found none of these in the real org.

**2. [Rule 3 - blocking] Three pathway-coverage guards exempt the two redirect-only pages** (`phase30/governance-fold`, `phase40/dup04-page-shell`, `phase57/shell-structure`). They require a `route:` in `journeys.ts` for every page while the plan requires no step to name the retired address. 58-16 must delete the exemptions with the directories.

**3. [Rule 3 - blocking] Guards and a spec outside the plan's file list repointed** because the source they grep changed: `scp-parse-pipeline` (review redirect destination), `phase54` admin-machine-panel / governance-inbox (ids are now UUIDs because `focusHref` throws on a non-UUID) / inbox-reuses-governance-gating, `phase57/machine-body`, `phase41` nav-and-shim and reference-sweep, `phase30/governance-fold`.

**4. [Scope] Task 1 and Task 2 are separate commits** (the plan says to commit them together). Nothing is pushed until the orchestrator pushes, so production never sees a state with the converter's apply open and the builder reachable together.

**5. [Design] `permanent: false` on the review redirect** (was a 308).

## Known Stubs

None.

## Threat Flags

None beyond the register. T-58-converter: run before the builder retired, native SOPs skipped, dry run read first with the stop rule (not triggered), `--apply` refused and spec-pinned, `--missing` touches zero-step SOPs only; T-58-redirect: `legacyRedirectFor` is UUID-gated with fixed templates and the cookies ride along; T-58-from: every entry link goes through `focusHref`, which re-encodes the place token.

## Self-Check: PASSED

- `58-CUTOVER.md` present and contains `--apply --all`; `scripts/convert-sops-to-steps.ts` contains "converter retired in Phase 58"
- Commits `e263f7cd`, `96974473`, `247d1d65` exist
