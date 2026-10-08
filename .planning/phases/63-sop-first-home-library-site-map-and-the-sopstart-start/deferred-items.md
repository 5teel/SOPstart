# Phase 63 deferred items

Found while running the cross-project suite in 63-11; each fails identically at the 63-10 commit (`23c4d3d1`), so none is caused by 63-11. Not fixed here.

| Spec | Red since | Cause | Owner |
|---|---|---|---|
| `tests/phase54/deletion-sweep.spec.ts` "attention comparison survives only in its one permitted home" | 63-02 | `src/lib/shell/home-state.ts` (`legacyPathRedirect`) now also holds the `view === 'attention'` comparison; the permitted-files list names only the old helper | 63-14 (address sweep) or 63-19 (retire) |
| `tests/phase43/dead-controls.spec.ts` "dead state removed from the creation surfaces" | before 63-10 | asserts the exact `<WizardClient departments={departments} machineId={machineId} />` element in `admin/sops/new/blank/page.tsx`; the page's props have changed | 63-14 / 63-18 |
| `tests/phase56/decision-writers-sweep.spec.ts` "every discovered decision write site is listed" | before 63-10 | `src/lib/requests/ask-core.ts#restoreAccepted` and `src/lib/requests/machine-requests.ts#reconcileMachineRequests` write the ledger and are not in `scripts/decision-writers.json` | 63-19 (R1 removes `reconcileMachineRequests`; list `restoreAccepted`) |

Environment, not code: `phase46` live probes (`sop-edit-owner-access`) went red in one full-suite run alongside the other live projects and passed on their own re-run (shared OTP budget, CLAUDE.md 2026-09-28).
