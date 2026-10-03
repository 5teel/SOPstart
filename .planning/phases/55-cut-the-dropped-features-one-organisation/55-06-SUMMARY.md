---
phase: 55-cut-the-dropped-features-one-organisation
plan: 06
subsystem: phone-qr-shared-device
tags: [deletion, qr, roster, sweep]
requires:
  - phase: 55-05
    provides: voice removed, sweep harness with LIVE_FEATURES
provides:
  - no machine QR address, plate, scanner or phone home
  - no shared-device roster login; completions record only the signed-in user
  - phone-qr and shared-device sweeps live and mutation-proven
affects: [55-13, 55-14]
tech-stack:
  added: []
  patterns:
    - "Variant props (inline) die with the last caller that passed them"
key-files:
  modified:
    - src/app/(protected)/sops/page.tsx
    - src/hooks/useWorkerSops.ts
    - src/components/sop/plant/NowCard.tsx
    - src/components/sop/plant/MachinePanel.tsx
    - src/components/admin/site/SiteWorkspace.tsx
    - src/app/(protected)/admin/sops/builder/[sopId]/BuilderStageShell.tsx
    - scripts/check-bundle-size.ts
    - src/actions/completions.ts
    - src/lib/validators/completions.ts
    - src/app/(protected)/activity/[completionId]/CompletionDetailClient.tsx
    - src/lib/journeys/journeys.ts
    - src/lib/uat/tests.ts
    - .planning/codebase/CAPABILITY-MATRIX.md
    - tests/phase55/deletion-sweep.spec.ts
  deleted:
    - src/app/(protected)/m/, admin/site/plate/, admin/sops/[sopId]/qr/
    - PhoneHome, ScanSheet, MachineListSheet, MachineView, qr-decode
    - src/app/(auth)/login/roster/, src/app/api/roster/, RosterSelector
    - tests/phase53 (8 specs), tests/phase23/completion-roster.spec.ts, tests/evals/phone-home.eval.ts
key-decisions:
  - "jsqr / qrcode / @types/qrcode stay in package.json; the sweep's packages block flips in 55-13"
  - "site_machines.code and newMachineCode() kept; roster_* DB columns untouched"
requirements-completed: [CUT-01]
duration: ~45min
completed: 2026-10-03
---

# Phase 55 Plan 06: Phone/QR surface and shared-device login removed

**A phone-width worker now gets the plain worker list; there is no scan button, plate, `/m/[code]` address or name-pick login, and `submitCompletion` records only the signed-in user.**

## Accomplishments

- `/sops` lost the PhoneHome dynamic module, `wantsPhone`/`phoneSite`, and the `phone` prop; the `['site-worker']` query is `enabled: wantsPlant`.
- `NowCard` and `MachinePanel` lost the `inline` variant (PhoneHome and MachineView were the only callers) and NowCard's phone-only Read link.
- SiteWorkspace "Print plate" and the builder "Print a QR code" menu item removed.
- `submitCompletion` no longer takes `rosterWorkerId` (lookup, resolved id and insert field gone; column stays null-defaulted). `recordSignature` and its `rosterUserId` org check untouched. Supervisor counter-signature now passes `rosterUserId: currentUserId`.
- Bundle gate: `phone home (53 D-01)` and `scan sheet (53 D-09)` marker groups dropped from both routes; baseline untouched.
- journeys: `roster-login` and `machine-qr` deleted; `find-follow-sop` lost machine/phone/phone-pick/scan; `map-the-site` lost `plate`. UAT `p23-roster-login` and `phone-home-worker` archived without links; capability matrix plate row and `/m/[code]` sentence removed.

## Org-scope re-read (T-55-04)

After the edit, `submitCompletion`, `signOffCompletion`, `getPhotoUploadUrl` and `recordSignature` all still take `organisationId`/`userId` from `getSessionContext()`; every export is still async. `submitCompletion` no longer needs the session `supabase` client and drops it from the destructure. No `/api/roster` middleware exemption existed to remove.

## Verification

- `npx tsc --noEmit` clean; `npm run build` exit 0 after Task 1 and Task 2. Bundle: `/sops/[sopId]/page` 935 KB, `/sops/page` 827 KB (unchanged vs 55-05, both below the 1045 / 936 "before" numbers; baseline file not recaptured).
- `phase55` 63 passed / 52 skipped (other features still fixme). `phase52` + `phase41` + `phase53` + `phase23-stubs` + `phase30` + `phase46`: 265 passed (phase46 live probes passed this run). `design-tokens` + `no-dead-internal-hrefs`: 12 passed. `--list --project=evals` shows 0 phone-home tests.

### Mutation proof

| Sweep | Planted | Result | Reverted |
|---|---|---|---|
| phone-qr | `` href: `/m/${'x'}` `` appended to `RelBadge.tsx` | RED (`src/ has no reference`, line listed) | GREEN |
| shared-device | `rosterWorkerId` field added to `SubmitCompletionSchema` | RED (line listed) | GREEN |

## Task Commits

1. `d68392a` delete phone home, scanner, machine pages and QR plates
2. `6a08571` delete shared-device roster login and attribution
3. `80e038f` repoint specs/evals/maps; flip phone-qr and shared-device sweeps live

## Deviations from Plan

None - plan executed as written. (Task 1 commit initially had the roster deletions staged by `git rm`; they were unstaged and committed under Task 2 so each commit matches its task.)

## Known Stubs

None.

## Threat Flags

None. `/api/roster` (T-55-06-01) and `/m/[code]` (T-55-06-03) no longer exist; the 55-14 deployed eval will confirm dead addresses render not-found content.

## Hand-offs

- 55-13: `jsqr`, `qrcode`, `@types/qrcode` uninstall (package sweep) and bundle move-down.
- 55-14: deployed eval confirms `/m/<code>`, `/login/roster`, `/api/roster` are gone.
- Not pushed; orchestrator pushes at phase end.

## Self-Check: PASSED

- Commits `d68392a`, `6a08571`, `80e038f` exist; `src/app/(protected)/m`, `src/app/api/roster`, `RosterSelector.tsx`, `qr-decode.ts` absent; `newMachineCode` still in `src/lib/site/scene.ts`.
