---
phase: 64-leavers-and-suspended-members
verified: 2026-10-24T02:30:00Z
status: passed
score: 13/13 must-haves verified
overrides_applied: 0
re_verification: false
---

# Phase 64: Leavers and Suspended Members Verification Report

**Phase Goal:** Removing someone stops their access at once and keeps their record. A membership has a state (active, suspended, left) instead of being hard-deleted; "Suspend" and "Has left" in People sign the person out everywhere and RLS stops their data access on the next request; their completions, sign-offs and ledger rows stay under their name; SOPs and pending sign-offs they owned land in a "needs a new owner" list for the safety manager; a suspended member can be reinstated; every action writes a ledger row (ADR-0008).
**Verified:** 2026-10-24
**Status:** passed
**Re-verification:** No, initial verification

SUMMARY claims were not taken as evidence. Evidence below comes from the code at HEAD `4a8dfa8d` (equal to `origin/master`), the live database (re-asserted in this run), a re-run of the phase source-contract and lint specs, and the deployed eval record in `64-EVAL.md`.

## Goal Achievement

### Observable Truths

| # | Truth (ROADMAP goal clause) | Status | Evidence |
|---|---|---|---|
| 1 | A membership has a state (active, suspended, left) instead of being hard-deleted | VERIFIED | `supabase/migrations/00082_member_status.sql` adds `status` (NOT NULL, default `active`, CHECK in the three states), `status_changed_at`, `status_changed_by`. Live `--assert-only` run today: 56 of 56 rows valid, CHECK present. No `.delete(` on the members table in `src/`; `tests/lint/member-status.spec.ts` fails the build if one returns, and `removeMember`, `deleteOrgMember` and `src/lib/members/remove.ts` are gone. |
| 2 | Suspend and Has left sign the person out everywhere | VERIFIED | `changeMemberState()` in `src/lib/members/state.ts` calls `revoke_user_sessions` (deletes `auth.sessions` rows, `service_role` only; live assert: anon and authenticated EXECUTE false) for any non-active target state. The account is not banned. `people.eval` case 2 (deployed, passed): old refresh token refused. |
| 3 | RLS stops their data access on the next request | VERIFIED | `current_organisation_id()` and `current_user_role()` re-read the membership row and require `status = 'active'`; the access-token hook filters both selects to active rows; the ten raw-claim policies were moved onto the helpers (live assert: no policy reads `auth.jwt()` directly); the observations own-row arm is ANDed with the org predicate. Live probe today: suspended member on the same claims gets NULL helpers, 0 SOPs, 0 members; hook stops issuing the site. `people.eval` case 2: same token reads nothing, browser shows the paused page. |
| 4 | Their completions, sign-offs and ledger rows stay under their name | VERIFIED | Rows are never deleted (guard above). Name labels keep every state and add "(left)" or "(suspended)" (`statusSuffix` in `load-inbox.ts`, labels in `src/lib/members/labels.ts`). Eval screenshots `64-decisions-people` and `64-member-handover` show the departed person's address with "(left)". ALLOW list in the lint guard documents the label and record readers that deliberately keep all states. |
| 5 | SOPs and pending sign-offs they owned land in a "Needs a new owner" list | VERIFIED | `listHandover()` (`src/lib/governance/load-inbox.ts`) covers departments, approval chains, in-flight approval steps, open asks and workers with no active supervisor; owned SOPs surface via `deriveInbox` (`inbox.ts:106`, a named-but-not-active owner gets the `handover` chip). Gated to admin and safety manager; nothing is reassigned automatically. Chip "Needs a new owner" in `InboxRow.tsx` and `inbox.ts`. `people.eval` case 4 passed (chip count 3: SOP, department, approval; each handed on). |
| 6 | A suspended member can be reinstated | VERIFIED | `reinstateMember` allows `suspended` and `left` to `active` on the same row; re-inviting a departed email reactivates the same row (`inviteWorker`, `auth.ts`), a suspended email is refused with a pointer to Reinstate. `people.eval` cases 3 and 5 passed (fresh sign-in reads the site again; same row returns). |
| 7 | Every action writes a ledger row (ADR-0008) | VERIFIED | `applyMemberState` calls `recordDecision` with `member_suspended`, `member_left`, `member_reinstated`; the invite reactivation logs `member_reinstated`; `reassignApprovalStep` logs `owner_change`. `decisions_kind_check` widened (live assert: new kinds accepted, `member_removed` kept). Eval screenshots `64-member-ledger` and `64-member-handover-ledger` show the rows. |

**Score:** 7/7 goal truths verified; 13/13 requirements satisfied (below).

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `supabase/migrations/00082_member_status.sql` | Columns, UPDATE lock, helpers, hook, policies, `revoke_user_sessions`, ledger kinds | VERIFIED | 290 lines, all ten sections present; applied live (assertions pass today). |
| `src/lib/members/state.ts` | One state-change path, service role, conditional on seen state, revokes sessions | VERIFIED | Filters by id, session org and expected `from` status; empty result is a refusal. |
| `src/actions/members.ts` | Three public actions with authority rules | VERIFIED | Admin or safety manager; self refused; only admin changes admin; last active admin refused; stale state refused; state change before ledger row. |
| `src/lib/auth/paused.ts`, `src/app/(protected)/pending/page.tsx` | Paused page copy | VERIFIED | "Your access to {site} has been paused. Talk to your supervisor." Shown only for an approved account with no active site. |
| `src/lib/auth/session-context.ts`, `src/lib/auth/sites.ts` | Active-only identity and picker | VERIFIED | Both filter `.eq('status', 'active')`. |
| `src/components/office/PeopleTab.tsx` | Suspend, Has left, Reinstate, tag, Former staff | VERIFIED | Confirmation copy present; Remove path gone; eval screenshots read. |
| `src/lib/governance/load-inbox.ts`, `src/actions/approvals.ts` | `listHandover`, `reassignApprovalStep` | VERIFIED | Active-only target, only a pending approval's next step held by a non-active person, logs `owner_change`. |
| `tests/lint/member-status.spec.ts` | Guard on deletes and status-blind reads | VERIFIED | Not vacuous, stale-entry test, picker active-only assertions. |
| `tests/evals/people.eval.ts` | Deployed eval, 6 cases | VERIFIED | 6 of 6 on the final deploy (`64-EVAL.md`). |
| `docs/adr/0024-membership-states-replace-removal.md` | ADR | VERIFIED | Accepted; decision, consequences, how-to-comply all present. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| People sheet buttons | `suspendMember` / `markMemberLeft` / `reinstateMember` | PeopleTab imports | WIRED | Confirmed by `tests/phase64/people-states.spec.ts`. |
| Server action | `changeMemberState` then `revoke_user_sessions` rpc | `state.ts` | WIRED | Live function exists and is service_role only. |
| `changeMemberState` | `recordDecision` | `members.ts` | WIRED | Ledger row after the state change; `details` hold no email (spec). |
| RLS helpers | every dependent policy (about 125) | same function names | WIRED | Sibling evals green across roles with data present (64-EVAL). |
| `listHandover` | Sign-offs inbox chip | `loadInbox` Promise.all, `deriveInbox` | WIRED | Eval case 4. |
| Handover rows | owner picker (active people only) | `OwnerPicker` and seat/supervises pickers filter `status === 'active'` | WIRED | Lint spec asserts the filters. |
| Invite / join code / accept invite / site switcher | member state | `auth.ts`, `sites.ts` | WIRED | Join refuses a non-active row without inserting; accept sends a non-active duplicate to `/pending`. |

### Data-Flow Trace (Level 4)

| Artifact | Data variable | Source | Real data | Status |
|---|---|---|---|---|
| Needs a new owner rows | `HandoverItem[]` | Session-client queries on `organisation_members`, `departments`, `approval_chains`, `sops`, `sop_approvals`, `requests`, `supervisor_assignments` | Yes | FLOWING (eval screenshot `64-member-handover` shows three real rows) |
| People list state and Former staff | `TeamMember.status` | `getTeamMembersWithEmails` selects `status`, `status_changed_at` | Yes | FLOWING (`64-member-former`: "Left 24 Oct 2026") |
| Paused page site name | `pausedMemberships(userId)` | Service-role read of non-active rows joined to `organisations` | Yes | FLOWING (`64-member-paused`) |

### Behavioral Spot-Checks and Probe Execution

| Behavior | Command | Result | Status |
|---|---|---|---|
| Live database state matches the migration | `node scripts/apply-phase64-migration.mjs --assert-only` | "ALL POST-APPLY ASSERTIONS PASSED" (15 checks: columns, CHECK, 56 rows active, UPDATE lock, `revoke_user_sessions` grants, helpers, hook, no raw-claim policy, suspended probe NULL helpers and 0 rows, active probe 18 SOPs, uat_feedback probe). Probes run in rolled-back batches. | PASS |
| Phase source-contract, lint and capability-matrix specs | `npx playwright test tests/phase64 tests/lint/member-status.spec.ts tests/phase59/capability-matrix.spec.ts` | 55 passed | PASS |
| Deployed eval | `64-EVAL.md`: people.eval 6 of 6 on the final deploy; full run 122 passed, 1 red (sop-ledger B, an eval defect from ADR-0023 ordering, not Phase 64) fixed in `a22f36f4`, then 6 of 6 | | PASS |
| Debt markers (`TBD`, `FIXME`, `XXX`, `TODO`, `HACK`) in files changed by the phase | grep over the 63 changed source, migration, test and doc files | none found | PASS |

No probe scripts of the `probe-*.sh` kind are declared by the plans; the migration applier's `--assert-only` is the declared probe and was run above.

### Requirements Coverage

All 13 IDs appear in plan frontmatter, in `.planning/REQUIREMENTS.md` (checked `[x]`, status Complete) and in the ROADMAP phase entry. No orphaned requirement.

| Requirement | Plans | Status | Evidence |
|---|---|---|---|
| MEMB-01 state columns, server-only change | 64-01, 64-06 | SATISFIED | Migration sections 1 and 2; live assert: only `role` updatable by authenticated, 56 of 56 rows valid. |
| MEMB-02 next-request cut-off across app, API, storage | 64-01, 64-02, 64-03, 64-06 | SATISFIED | Helpers, hook, ten policies, observations arm, storage policies; live suspended probe; eval case 2. |
| MEMB-03 sign out everywhere, no ban | 64-01, 64-02, 64-03, 64-06 | SATISFIED | `revoke_user_sessions` via `changeMemberState`; no ban call; eval case 2. |
| MEMB-04 authority rules and clean refusal | 64-02, 64-06 | SATISFIED | `applyMemberState`; `ALLOWED_FROM`; conditional update; eval case 6 and `64-member-self`. |
| MEMB-05 People UI, Former staff, "(left)" labels | 64-03, 64-04, 64-06 | SATISFIED | PeopleTab, label helpers, eval cases 1 and 5, screenshots read. |
| MEMB-06 Remove deleted, guard | 64-03, 64-04, 64-06 | SATISFIED | Lint spec; no delete or `removeMember` anywhere in `src/`. |
| MEMB-07 paused page | 64-02, 64-03, 64-06 | SATISFIED | `/pending` paused branch, join-code refusal copy; `64-member-paused`. |
| MEMB-08 invites, join code, accept, switcher honour state | 64-02, 64-03, 64-06 | SATISFIED | `inviteWorker` reactivates `left` (same row) and refuses `suspended`; eval case 5. |
| MEMB-09 Needs a new owner, reassign, active-only picker | 64-04, 64-05, 64-06 | SATISFIED | `listHandover`, `reassignApprovalStep`, pickers; eval case 4. |
| MEMB-10 ledger kinds | 64-01, 64-02, 64-05, 64-06 | SATISFIED | Three kinds live in the CHECK and registries (spec); reassignment reuses `owner_change`. |
| MEMB-11 active members only wherever people are counted or picked | 64-04, 64-06 | SATISFIED | Lint guard: every members read status-aware or on a reasoned ALLOW list; notification writer filters active. |
| MEMB-12 ADR, matrix, pathways, feedback page | 64-01, 64-02, 64-03, 64-05, 64-06 | SATISFIED | See same-commit rules below. |
| MEMB-13 deployed eval | 64-03, 64-05, 64-06 | SATISFIED | `tests/evals/people.eval.ts` 6 of 6; all 64-* screenshots read per `64-EVAL.md`. |

### CLAUDE.md Same-Commit Maintenance Rules

| Rule | Status | Evidence |
|---|---|---|
| Routes and flows in `src/lib/journeys/journeys.ts`, zero not-mapped; worth team review in `src/lib/uat/tests.ts` | HONOURED | `/pending` detail updated (line 68); People "sheet", "Former staff" and "Needs a new owner" nodes added (lines 531-533); `phase64-leavers` entry in `uat/tests.ts` (line 354); `home.eval` DOCS-01 "zero unmapped" passed in the full deployed run. |
| RLS policy, guard or role check updates `.planning/codebase/CAPABILITY-MATRIX.md` | HONOURED | New rows for suspend, mark as left, reinstate, and reassign what a leaver owned; Manage team row rewritten; header paragraph explains the helper change; `tests/phase59/capability-matrix.spec.ts` passes. |
| Structural decision gets an ADR | HONOURED | ADR-0024 (Accepted, with Enforced-by list and How to comply). Project `CLAUDE.md` Learnings line 83 carries the rule. |

### Anti-Patterns Found

None blocking. No `TBD`, `FIXME`, `XXX`, `TODO` or `HACK` in the phase's changed files. No hollow returns in the new actions or modules.

| Item | Severity | Note |
|---|---|---|
| `tests/phase46/sop-edit-owner-access.spec.ts` live RLS probe hit `verifyOtp failed: Request rate limit reached` once in the full suite | Info | Environment (shared Supabase OTP budget), not a Phase 64 defect; recorded in `64-EVAL.md` open items. |
| Chart-view screenshot `64-member-suspended-chart` cuts off before the Suspended tag | Info | Eval coverage gap only; the tag is shown in the grid, phone and sheet shots. |
| Last-active-admin check is a read-then-write | Info | Not atomic against two simultaneous admin suspensions; the per-target conditional update still prevents double changes. Accepted ceiling for a small-site admin action. |

### Deferred Items

`deferred-items.md` lists Phase 63 spec failures found during 64-01 and a phone sticky-column overlap found in 64-03. The overlap was fixed in `17b5004a` and re-read on the deploy. The Phase 63 spec items are outside this phase's files and the phase's full suite later recorded 2181 passed with only the OTP probes red. Nothing here is a Phase 64 gap.

### Human Verification Required

None. The project verifies through deployed evals and screenshots read by Claude (`64-EVAL.md`), which cover the cut-off on the same token, the sign-out of the old session, the paused page, reinstate, Former staff, re-invite reactivation and handover with reassignment.

### Gaps Summary

No gaps. Every must-have and all 13 requirement IDs are backed by code at HEAD, the live database (re-asserted today), passing source-contract and lint specs, and a deployed eval record. The same-commit duties (journeys, uat test, capability matrix, ADR-0024) were honoured.

---

_Verified: 2026-10-24_
_Verifier: Claude (gsd-verifier)_
