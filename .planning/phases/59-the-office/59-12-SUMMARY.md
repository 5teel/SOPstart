---
phase: 59-the-office
plan: 12
subsystem: shell / office mount
tags: [office, next-dynamic, bundle-gate, supervisor-pin, eval]
requires: [59-09, 59-10, 59-11]
provides:
  - "OfficePane reached only through next/dynamic from AdminShell and WorkerShell (supervisor only); no static importer anywhere"
  - "Supervisor Office pin, card and overview line read the pane's own getOfficeInbox query (OFFICE_INBOX_KEY)"
  - "/page forbidden marker for the pane literals; OfficePane: [] in the admin-lens allow-list"
  - "SmokoBody children slot (59-13 passes the Training matrix link)"
affects: [59-13, 59-14, 59-16]
key-files:
  modified:
    - src/components/shell/AdminShell.tsx
    - src/components/shell/WorkerShell.tsx
    - src/components/shell/AdminRoomBodies.tsx
    - src/components/shell/RoomBodies.tsx
    - src/hooks/useCompletions.ts
    - scripts/check-bundle-size.ts
    - tests/lint/no-static-admin-lens-import.spec.ts
    - tests/phase59/office-pane-structure.spec.ts
    - tests/phase57/machine-body.spec.ts
    - tests/phase57/retirement-sweep.spec.ts
    - tests/phase57/one-query.spec.ts
    - tests/evals/one-screen.eval.ts
requirements-completed: []
completed: 2026-10-06
---

# Phase 59 Plan 12: Mount the Office Summary

**The tabbed Office pane is now the Office for admins, safety managers and supervisors, mounted lazily from both shells; the supervisor pin counts the list it shows. One gate is RED: `/` reads 834 KB against 831 (+3, tolerance ±2) and needs a decision (see below).**

## Commits

| Task | Commit | What |
|------|--------|------|
| 1 | cbf556cb | lazy `OfficePane` in both shells, pin on `OFFICE_INBOX_KEY`, `AdminOfficeBody` / `CHIP_WORDS` / `usePendingSignOffCount` deleted, `OfficeWorkerBody` workers-only, `SmokoBody` children slot, phase57 guards repointed |
| 2 | 6529ddfb | `/page` forbidden marker, `OfficePane: []` allow-list, seam specs live, one-screen eval repointed, worker loading fallback trimmed |

## UNRESOLVED: `/` bundle gate is +3 KB (blocks `npm run build` postbuild)

`npm run build` compiles, then `check-bundle-size` exits 1: `/page = 834 KB (baseline 831 KB, Δ +3 KB, tolerance ±2 KB)`; `/sops/[sopId]/page = 794 KB (Δ +2, passes)`. Baseline untouched. Marker self-validation is never reached because the delta check fails first (both pane literals do exist only in the lazy chunk `1362.*.js`, zero hits in `app/page-*.js`).

Diagnosis (summed file list dumped and diffed against a build of the parent commit, per the 2026-10-05 learning):

| Piece | Parent build | This build | Δ |
|---|---|---|---|
| `webpack-*.js` runtime | 3961 B | 5364 B | +1403 |
| shared chunks (react-query split) 4109 + 4473 | 21418 B | 6672 + 6708 = 21745 B | +327 |
| `app/page-*.js` | 44827 B | 45109 B (45076 after trimming the loading fallback) | +282 |
| total | 831.87 KB | 833.84 KB (833.81 after trim) | +1.97 |

The gate needs <= 833.49 KB to round to Δ +2, so it is ~320 B over.

Root cause of the biggest piece: `SignOffPanel` (59-08) imports the lightbox stylesheets (`yet-another-react-lightbox/styles.css`, `plugins/captions.css`). Now that the pane is in the module graph, those become two ASYNC CSS chunks (1188, 6488), and webpack adds its mini-css loading machinery (`d.miniCssF`, `d.f.miniCss`, ~1.3 KB raw, ~0.6 KB gz) to the shared runtime every route downloads. Nothing in the page graph changed shape; the cost is the runtime. It was invisible in 59-08..59-11 because nothing imported the pane (webpack never compiled it).

Options (none taken: each is a decision, and the rule is that an executor never raises or recaptures the baseline):

1. Record the measured value by hand in `.bundle-baseline.json` as a decision artefact (the script's own message allows a hand edit, never a recapture). Cheapest; real cost is ~0.6 KB gz in the runtime.
2. Move the two lightbox CSS imports into a route-level stylesheet (e.g. imported from `src/app/page.tsx`). Gate goes green with room to spare, but every worker then downloads ~1.9 KB gz of CSS they never use: worse for real users than option 1.
3. Offset ~350 B by moving the rarely-opened worker room bodies (`OfficeWorkerBody`, `WorkshopWorkerBody`) behind their own `next/dynamic` seam. Real saving for workers but margin would be ~0.1 KB, and several worker-shell guard specs list `RoomBodies.tsx` by name.

Recommendation: option 1, recorded by Simon (or the orchestrator on his behalf), before the next push, because Railway runs `npm run build` and the postbuild gate will fail the deploy until it is resolved.

## Seam and pin changes

- `AdminShell`: office branch renders `<OfficePane place select initialSop />` from a `next/dynamic` (ssr off) import inside the already-lazy admin module; the overview role line reads `inboxChips.signoff`; the separate pending-count read is gone.
- `WorkerShell`: same dynamic import; a supervisor's Office is the pane, a worker's is `OfficeWorkerBody` (counts only; "Open sign-offs" stays until Phase 61). The pin (`roomPins.office`), card count and overview line all read `useQuery({ queryKey: OFFICE_INBOX_KEY, queryFn: () => getOfficeInbox(), enabled: isSupervisor })`, the same cache entry as the pane's Inbox tab. Pin = all inbox items; overview counts the `signoff` items. The supervisor card label changed to "waiting for you in the Office" because the number now includes owned-review rows, not only sign-offs.
- `usePendingSignOffCount`, `AdminOfficeBody`, `CHIP_WORDS` deleted (grep over `src` is empty). No static import of `OfficePane` exists anywhere.

## Guards repointed in the same commits

- `tests/phase57/machine-body.spec.ts`: admin room bodies are now two (Workshop, Noticeboard), no `data-room-id="office"`.
- `tests/phase57/retirement-sweep.spec.ts`: the access-bridge case asserts the Office card no longer links `/admin/access` (its proxy and place cases are 59-13's).
- `tests/phase57/one-query.spec.ts` (not in the plan's file list; deviation below): supervisor parity now pins `OFFICE_INBOX_KEY`; admin parity pins `inboxChips.signoff`.
- `tests/evals/one-screen.eval.ts`: supervisor card pin equals the pane's `office-row` count; admin pin equals the Inbox tab count; retired-URL list expects the Office places 59-13 adds (not run until 59-16).
- `LIVE_PLANS` not appended (`governance.eval.ts` still holds 59-12 tokens until 59-14, as the plan says).

## Deviations from Plan

**1. [Rule 3 - Blocking] `tests/phase57/one-query.spec.ts` repointed here.** It asserted the deleted hook and props, so the phase57 project went red the moment Task 1 landed. Repointed in the same commit (inventory row stays 59-14; the retired token is already gone from the file).

**2. [Rule 1 - Correctness] Supervisor card label.** "waiting for your sign-off" no longer describes the count (it includes owned reviews), so it now reads "waiting for you in the Office". Eval text assertions on the old label: none found.

**3. [Gate] `/` Δ +3 KB.** See the unresolved section above.

## Verification

- `npx tsc --noEmit` clean.
- phase59, phase57, phase54, phase52, phase41, phase37, phase36, phase30, phase15-stubs: 762 passed, 26 skipped (later-plan stubs), 0 failed. `npx playwright test --list --project=evals`: 77 tests in 8 files. Evals not run (59-16).
- `npm run build`: compiles; postbuild gate RED as described. Two builds were run on this tree (plus one of the parent commit for the diff); the figures were stable.
- `.bundle-baseline.json` untouched.

## Known Stubs

None.

## Threat Flags

None. T-59-49: `tabsForRole` still decides what mounts and each tab's server read keeps its guard. T-59-50: dynamic-only import, forbidden marker, `OfficePane: []` allow-list, baseline not edited. T-59-50b: pin and list share one query key.

## Self-Check: PASSED

- Commits cbf556cb and 6529ddfb in `git log`; this SUMMARY exists; STATE.md and ROADMAP.md untouched; nothing pushed.
- Self-check does not cover the red bundle gate, which is reported above and still open.
