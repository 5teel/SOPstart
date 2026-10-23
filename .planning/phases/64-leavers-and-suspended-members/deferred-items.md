# Phase 64 deferred items

Out-of-scope failures found while running the phase56 / phase59 projects during 64-01. None touch a file this phase changed.

| Spec | Failure | Cause (not 64) |
|---|---|---|
| `tests/phase59/repoint-inventory.spec.ts` (two tests) | `tests/phase63/job-roles.spec.ts` and `tests/phase63/org-chart.spec.ts` reference the retired token `createRole` | Phase 63 added specs that name a token the Phase 59 inventory treats as retired |
| `tests/phase59/retirement-sweep.spec.ts:115` | `updateRole` in `src/actions/org-model.ts` does not contain `await requireAdmin()` within 400 characters | Phase 63 (ADR-0021) job-role writers use a different guard shape |

## Found in 64-03

| Where | What | Cause (not 64-03) |
|---|---|---|
| People, Who can do what grid at 390 px, after scrolling down | The sticky first column (`sticky left-0 z-10`) paints its first rows over the tab group at the top of the page (seen in `64-member-former-phone.png`) | The grid's sticky column predates Phase 64 and sits above the tab group's stacking level; only visible once the page is scrolled on a phone. Needs a stacking fix in `AuthorityGrid` or the tab group. |
