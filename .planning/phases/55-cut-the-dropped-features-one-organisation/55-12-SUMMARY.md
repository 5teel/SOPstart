---
phase: 55-cut-the-dropped-features-one-organisation
plan: 12
subsystem: auth
tags: [deletion, org-single, invitation-only, supabase-auth, disable-signup]
requires:
  - phase: 55-11
    provides: library removed; org-signup sweep entries ready
provides:
  - static invitation-only /sign-up page
  - organisation creation and switching deleted
  - Supabase public sign-up disabled (disable_signup true)
affects: [55-13, 55-14]
key-files:
  modified:
    - src/app/(auth)/sign-up/page.tsx
    - src/actions/auth.ts
    - src/lib/validators/auth.ts
    - src/components/auth/LoginForm.tsx
    - src/app/(auth)/login/page.tsx
    - src/app/page.tsx
    - src/components/auth/JoinByCodeForm.tsx
    - src/app/(protected)/profile/page.tsx
    - src/lib/journeys/journeys.ts
    - src/lib/journeys/roles.ts
    - tests/phase55/org-single.spec.ts
    - tests/phase55/deletion-sweep.spec.ts
    - .planning/codebase/CAPABILITY-MATRIX.md
  deleted:
    - src/components/auth/OrgSignUpForm.tsx
    - src/components/profile/OrgSwitcher.tsx
decisions:
  - joinWithInviteCode left untouched (plan: unchanged); it still sets active_org_id metadata, harmless with one org
metrics:
  commits: 2
  completed: 2026-10-03
---

# Phase 55 Plan 12: Invitation-only, one organisation

**There is no way to create or switch an organisation in the app, `/sign-up` tells visitors to ask their admin, and Supabase now refuses anonymous sign-ups while admin invites and eval sessions still work.**

## Tasks

| Task | Commit | Result |
|---|---|---|
| 1 Static sign-up, delete org creation/switching, copy, maps, contracts | 33640ab | `signUpOrganisation`, `switchOrganisation`, `getUserMemberships`, `UserMembership`, `orgSignUpSchema`, `OrgSignUpForm`, `OrgSwitcher` deleted; Register links and `?registered` banner removed; journeys/roles/matrix updated; org-single (all live) and `org-signup` sweep live |
| 2 D-06 disable sign-up and probe | 9915a87 (VALIDATION rows) | see below |

## Verification

- `npx tsc --noEmit` clean; `npm run build` clean (`/sign-up` prerenders static; bundle `/sops/[sopId]` 817 KB, `/sops` 817 KB, baseline file untouched).
- phase55 114 passed; phase34 and phase46 non-live specs pass; capability-matrix-doc 9/9; dead-href and design-token lint green.
- phase46 live probes: 11 failed with `verifyOtp failed: Request rate limit reached` (the known shared OTP budget, environment limit, not a regression; phase46 was run twice in this plan).

### Mutation proof

Appended `export async function switchOrganisation() {}` to `src/actions/auth.ts`: org-single "actions, schema and components are removed" and sweep `org-signup > src/ has no reference` went RED; reverted, GREEN (114 passed).

### T-55-04 re-read of `src/actions/auth.ts`

Surviving exports all derive org from the session (`getSessionContext`): `inviteWorker`, `getTeamMembersWithEmails`, `removeMember`, `regenerateInviteCode`, `updateMemberRoleSafe`, `addMemberByEmail` check admin role and use the session `organisationId`. `joinWithInviteCode` takes the org from the invite code and only ever inserts `worker`. `acceptInvite` reads the org from the verified invite user's metadata set by `inviteWorker`. `updateMemberRole` (unchanged, RLS-gated) has no role check in the action itself, pre-existing. No client-supplied trust flag exists. All value exports are async.

## D-06: Supabase public sign-up (values redacted)

Precondition: `grep -rn "auth.signUp(" src` returned 0 and the org-single D-06 test is green. `SUPABASE_ACCESS_TOKEN` was in `.env.local`.

| Step | Result |
|---|---|
| GET config/auth before | `disable_signup = false` |
| PATCH `{ disable_signup: true }` | 200 |
| GET after | `disable_signup = true` |
| Anon `signUp` immediately after PATCH | **succeeded** (a probe user was created); setting had not propagated yet. Stray user found via `listUsers` and deleted |
| Anon `signUp` ~45 s later | refused: `422 Signups not allowed for this instance`; no user created, none in `listUsers` |
| Admin `generateLink({ type: 'invite' })` | OK, user created, then deleted |
| `node scripts/eval-fixtures.mjs` | exit 0 |
| eval-worker magic link to `verifyOtp` | access token returned (before and after propagation) |

Note for future: after the PATCH, Supabase Auth takes tens of seconds to apply the change; probe after a wait. Reversible with `{ "disable_signup": false }`. No open item.

## Deviations from Plan

**1. [Rule 1 - Bug] `tests/phase34/worker-observation-visibility.spec.ts`** mentioned `<OrgSwitcher />` in a doc comment, which the `org-signup` sweep (it scans tests/) would flag; comment reworded.

**2.** The `inviteUserByEmail` path (what `inviteWorker` calls) was probed through the equivalent admin `generateLink({type:'invite'})` to avoid sending a real email.

## Known Stubs

None.

## Threat Flags

None. T-55-03, T-55-12-01, T-55-12-02, T-55-04, T-55-12-03 mitigated.

## Self-Check: PASSED

Commits 33640ab and 9915a87 exist; `OrgSignUpForm.tsx` and `OrgSwitcher.tsx` absent; sign-up page contains "SOPstart is by invitation".
