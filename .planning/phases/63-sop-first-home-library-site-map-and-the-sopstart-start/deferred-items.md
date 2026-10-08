# Phase 63 deferred items

Found while running the cross-project suite in 63-11; each fails identically at the 63-10 commit (`23c4d3d1`), so none is caused by 63-11. Not fixed here.

| Spec | Red since | Cause | Owner |
|---|---|---|---|
| `tests/phase54/deletion-sweep.spec.ts` "attention comparison survives only in its one permitted home" | 63-02 | `src/lib/shell/home-state.ts` (`legacyPathRedirect`) now also holds the `view === 'attention'` comparison; the permitted-files list names only the old helper | RESOLVED in 63-14 (permitted home is now home-state.ts) |
| `tests/phase43/dead-controls.spec.ts` "dead state removed from the creation surfaces" | before 63-10 | asserts the exact `<WizardClient departments={departments} machineId={machineId} />` element in `admin/sops/new/blank/page.tsx`; the page's props have changed | RESOLVED in 63-14 (assertion now names `initialTitle`) |
| `tests/phase56/decision-writers-sweep.spec.ts` "every discovered decision write site is listed" | before 63-10 | `src/lib/requests/ask-core.ts#restoreAccepted` and `src/lib/requests/machine-requests.ts#reconcileMachineRequests` write the ledger and are not in `scripts/decision-writers.json` | RESOLVED in 63-20 (R1 removed `reconcileMachineRequests` in 63-19; `restoreAccepted` listed as an allow entry, it makes no decision) |

Environment, not code: `phase46` live probes (`sop-edit-owner-access`) went red in one full-suite run alongside the other live projects and passed on their own re-run (shared OTP budget, CLAUDE.md 2026-09-28).

## 63-21 (sign-off)

| Item | Status |
|---|---|
| `tests/lint/no-global-blocks-in-journeys.spec.ts` "names the site edit mode" pinned `?place=edit` (journeys.ts moved to `view=site` in 63-17; the phase25-integration project was not in any earlier gate) | RESOLVED in 63-21 (pins `view=site`) |
| `tests/phase46/sop-edit-owner-access.spec.ts` (7 live probes) red with `verifyOtp failed: Request rate limit reached` in the one full-suite run that follows the full eval | ENVIRONMENT (shared OTP budget, CLAUDE.md 2026-09-28); not a regression, identical to the note above |
| Department colour swatches no longer drive the home (dot and map use `--area-N`) | OPEN, for Simon: retire the swatches or feed them to the map (63-EVAL Open 2) |
| Office invite receipt unproven (mailer "email rate limit exceeded", 63-18 and 63-21) | OPEN, environment: one run in a quiet hour (63-EVAL Open 1) |
| `tests/phase26/konva-worker-isolation.spec.ts` keeps a case that self-skips because `src/components/sop/plant/` is gone | OPEN, cosmetic: delete the case |
