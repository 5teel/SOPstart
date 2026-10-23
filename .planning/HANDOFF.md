# Handoff — 2026-10-24 (end of the Phase 64 session)

Pick up here in a fresh context. Read CLAUDE.md, docs/adr/README.md (ADR-0024 and 0025 are new), and this file. Master is at the "docs(handoff)" commit or later; Fly.io deploys from master.

## Where things stand

### Shipped and live on sopstart.com
- **Phase 64 — Leavers and suspended members** (6 plans, `.planning/phases/64-leavers-and-suspended-members/`). A membership is `active` | `suspended` | `left`, and memberships are never deleted (ADR-0024). Suspend / Has left sign the person out and RLS re-checks the membership row on every request. People has Suspend / Has left / Reinstate and a folded Former staff group. The Sign-offs inbox has a "Needs a new owner" chip, and `reassignApprovalStep` hands over a stuck approval. Verification passed 13 of 13 (`64-VERIFICATION.md`), the deployed eval is in `64-EVAL.md`, and migrations 00082 and 00083 are live with assertions (`scripts/apply-phase64-migration.mjs`, `apply-phase64b-migration.mjs --assert-only`).
- **Code-review hardening** (`64-REVIEW.md`, all 11 findings closed, ADR-0025):
  - Signed-in users can no longer insert or delete `organisation_members`. Invites live in `app_metadata`, and `acceptInvite` inserts with the service role.
  - A per-org trigger (`keep_one_active_admin`) keeps at least one active admin.
  - Admin reads of `member_departments` / `users_sub_trades` are now scoped to the caller's org.
  - Approval reassign refuses self and earlier approvers.
- **`2411dc67`**: `assignMemberDepartments` no longer deletes a member's department rows in other orgs.

## Small follow-ups (no decision needed)
- **Missing invite data:** an invite sent in the few minutes between migration 00083 and its deploy (2026-10-23) has no `app_metadata` invite; the invitee needs a re-send.
- **Reassign picker:** it still lists the signed-in admin; choosing yourself shows the refusal. Hide self by passing the user id into `InboxRow`.
- **Supervises picker:** an admin can't untick an already-linked suspended worker (from 64-05).
- **Chart screenshot:** the chart-view eval shot cuts off before the Suspended tag (grid, phone and sheet shots show it).
- **Rate-limited probe:** `tests/phase46` `IMAGES NEGATIVE` live probe was OTP rate-limited. Re-run it once in a quiet window.
- **Bundle baseline:** `/page` has sat at 831 against an 834 baseline since 64-01. Lowering the baseline is an orchestrator call (diff the chunk list first; never re-capture blindly).
- **TRUNCATE grant:** authenticated still holds Supabase's default TRUNCATE on `organisation_members`. REST can't reach it, but a revoke would tidy it.
- **Traceability table:** `REQUIREMENTS.md` has 119 IDs missing from it (gsd-tools warning). It's bookkeeping only.

## Open decisions for Simon (carried over)
1. **Self-host full Inter** for the safety glyphs (`cv05`, `cv08`, slashed zero). Needs an ADR.
2. **Tool search** matches an exact tool name only (`src/hooks/useSopSearch.ts`). Make it partial and case-insensitive?
3. **Next security steps** from the 2026-10-21 discussion (out of Phase 64's scope): passkeys, admin MFA (aal2), recovery codes, supervisor-issued recovery, security headers (backlog 999.3). Which comes next?

## Process notes
- GSD: the roadmap's next entry is backlog 999.1. Run `/gsd-progress` to choose.
- Executors ran sequentially on the main tree; keep doing so for anything that pushes and runs a deployed eval.
