# Phase 64: Leavers and Suspended Members - Context

**Gathered:** 2026-10-21
**Status:** Ready for planning
**Source:** Security discussion with Simon, 2026-10-21 (passkeys / joiners / leavers / recovery). Simon approved "plan step 1 as a phase". Decisions below are Claude's calls from that discussion; Simon can overturn any at plan review.

<domain>
## Phase Boundary

Removing someone from an organisation stops their access at once and keeps their record.

In scope:
- Organisation membership gets a state: `active` | `suspended` | `left`. The hard delete (`removeMember` → `deleteOrgMember`) goes away.
- People (Office) gets "Suspend" and "Has left" in place of "Remove", and "Reinstate" for a suspended or left person.
- Suspend / Has left signs the person out everywhere and RLS stops their data access on the very next request, not at token expiry.
- Their completions, sign-offs, observations, training records and ledger rows stay attributed to them.
- SOPs they owned, and sign-offs / approvals / requests waiting on them, surface in a "needs a new owner" list for the safety manager / admin, who reassigns with the existing owner picker.
- Every state change and reassignment writes a ledger row (ADR-0008, via `recordDecision()`).

Out of scope (later phases of the same security plan): passkeys, admin MFA (aal2), recovery codes, supervisor-issued recovery, SMS invites, SSO/SCIM, security headers (backlog 999.3).

</domain>

<decisions>
## Implementation Decisions

### States
- D-01: Three states on the membership row: `active`, `suspended` (temporary, e.g. long leave or an investigation), `left` (no longer works here). Store as a column on `organisation_members` with `status_changed_at`, `status_changed_by`. Default `active`; existing rows backfill `active`.
- D-02: Both `suspended` and `left` deny all org data access. The difference: `left` also triggers the owner handover list and moves the person out of the default People list into a collapsed "Former staff" group. `suspended` stays in the main list with a plain-word tag ("Suspended").
- D-03: Reinstate works from either state back to `active`, same row, same history. Re-inviting a `left` person's email reactivates their existing row instead of creating a second membership.
- D-04: Hard delete of a membership is removed from the product. The server path that only the Remove button used is deleted too (CLAUDE.md: deleting a feature's UI means dropping the server params only it supplied).

### Who can do it
- D-05: Same authority as today's `removeMember`: admin and safety_manager; only an admin can change an admin's state; nobody changes their own state; the last active admin cannot be suspended or marked left (count active admins, not all admin rows).

### Cutting access
- D-06: Access must stop on the next request. Every RLS path that resolves "is this user a member of this org / what is their role" must require `status = 'active'`. Research must establish how membership is resolved today (helper SQL functions, JWT custom claims, `getSessionContext`, `org-model/resolve-access`) and cover every one; if any path reads org/role from JWT claims, it must also be closed.
- D-07: Also revoke the person's sessions (refresh tokens) so open tabs fail on their next refresh. Users can belong to several orgs (site switcher, demo orgs), so do not ban the auth user; revoke sessions only. Research picks the mechanism (Supabase admin API vs a service-role-only SQL function over `auth.sessions` / `auth.refresh_tokens`).
- D-08: A suspended / left user who signs in sees a plain page: "Your access to {org} has been paused. Talk to your supervisor." Reuse `/pending` if it fits.

### Records kept
- D-09: Nothing attributed to the person is deleted or reassigned automatically. Names still show on completions, sign-offs and ledger rows, with "(left)" or "(suspended)" where a name is shown in governance views.

### Owner handover
- D-10: When a person is marked `left` (and also on `suspended`, since work can't wait), everything waiting on them appears in a "Needs a new owner" list in the Office for admin / safety_manager: SOPs they own (`sops.owner_user_id`), and any pending sign-offs, approvals, requests or review-due items assigned to them. Research must enumerate every "assigned to a user" column.
- D-11: Reassignment uses the existing `OwnerPicker` / governance actions; each reassignment logs a ledger row. No automatic reassignment.

### Ledger
- D-12: New decision kinds: member suspended, member left, member reinstated; owner reassignment reuses the existing kind if one exists.

### Same-commit duties (CLAUDE.md)
- D-13: New ADR "Membership states replace removal" (next number after 0023).
- D-14: `.planning/codebase/CAPABILITY-MATRIX.md` rows for suspend / has left / reinstate / reassign.
- D-15: `src/lib/journeys/journeys.ts` and `src/lib/uat/tests.ts` updated; `/pathways` stays at 0 not-mapped.
- D-16: Deployed eval (`tests/evals/people.eval.ts` or extend `office.eval.ts`) against sopstart.com: suspend a fixture member → that member's session gets no SOP data and sees the paused page → reinstate → access returns; owner handover list shows a SOP owned by a left fixture. Fixtures key on their own markers; no "exactly N" assertions.

### Resolved after research (2026-10-21, Claude's calls on RESEARCH.md open questions)
- D-17: In-flight approvals whose next frozen step names a left/suspended person get a small `reassignApprovalStep` action (admin/safety_manager, active target only, logs `owner_change`). No auto-reassign.
- D-18: The "Needs a new owner" list lives in the Office Inbox (Sign-offs section) as a chip/group beside the existing "No owner" rows; no new tab.
- D-19: Scope the `sop-videos` bucket SELECT to the org folder via the helper in the same migration, provided the eval shows source-url and transcribe still work; otherwise record it as an accepted residual in the ADR.
- D-20: Requirement IDs MEMB-01..MEMB-13 as proposed in RESEARCH.md "Phase Requirements".

### Claude's Discretion
- Column name / enum vs check constraint, migration number, exact UI copy (plain words, no "block"/"walk"/"rooms"), placement of the handover list inside the Office, guard tests in `tests/lint/` if checkable (e.g. no `.delete()` on `organisation_members`).

</decisions>

<canonical_refs>
## Canonical References

- `CLAUDE.md` — conventions, Security/RLS learnings (session-org writes, `.select('id')` after update, permissive policies OR together, WITH CHECK restates org predicate)
- `docs/adr/README.md` — ADR-0008 (every action logged), ADR-0018 (new accounts need approval), ADR-0002 (no scheduled jobs)
- `.planning/codebase/CAPABILITY-MATRIX.md` — role access
- `src/actions/auth.ts` (`removeMember` ~line 461, invite accept ~281) and `deleteOrgMember`
- `src/actions/governance.ts` (~line 395 note on missing "deactivated" state), `src/components/admin/governance/OwnerPicker.tsx`
- `src/components/office/PeopleTab.tsx` (Remove button ~line 524)
- `src/lib/auth/getSessionContext`, `src/lib/auth/guards.ts`, `src/lib/org-model/resolve-access.ts`, `src/lib/supabase/middleware`
- `src/lib/decisions/record.ts`
- `supabase/migrations/` (latest 00081_user_approval.sql)
- Skill `sketch-findings-SOPstart` for the People / Office UI

</canonical_refs>

<specifics>
## Specific Ideas

- Gap found 2026-10-21: `removeMember` hard-deletes the membership row; access is cut by RLS but sessions stay live and there is no owner handover.
- Copy: "Suspend", "Has left", "Reinstate", "Needs a new owner", "Former staff".

</specifics>

<deferred>
## Deferred Ideas

- Passkeys + devices list with revoke; admin aal2; recovery codes; supervisor recovery codes; SMS invites; SSO/SCIM (later phases of the security plan).
- Notifying the suspended person by email.

</deferred>

---

*Phase: 64-leavers-and-suspended-members*
*Context gathered: 2026-10-21 from the security discussion*
