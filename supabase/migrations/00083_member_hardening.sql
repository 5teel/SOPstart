-- ============================================================
-- 00083_member_hardening.sql — Phase 64 review fixes (64-REVIEW.md, ADR-0025)
-- ============================================================
-- Applied with scripts/apply-phase64b-migration.mjs (audit, apply, live assertions, rollback).
--
-- Sections:
--   1. HI-01  organisation_members INSERT / DELETE are service-role-only; the 00002 admin
--             INSERT policy is dropped. Pending invitees get their invite copied into
--             app_metadata (server-only), which acceptInvite now reads instead of user_metadata.

-- 1. Membership inserts are service-role-only (HI-01) ----------------------------------------
-- The 00002 policy let any admin or safety manager insert a row with any role, so a safety
-- manager could make a second account an admin and get around "only an admin changes an
-- admin". Every app insert already runs through the service role (inviteWorker,
-- joinWithInviteCode, and now acceptInvite), and a membership row is never deleted from src/.
drop policy if exists "admins_can_insert_members" on public.organisation_members;
revoke insert, delete on public.organisation_members from anon, authenticated;

-- acceptInvite inserts with the service role, so the org and role must come from somewhere the
-- invitee cannot write: user_metadata is user-writable (auth.updateUser({ data })), app_metadata
-- is not. inviteWorker now writes invite_org_id / invite_role to app_metadata; this copies the
-- invite of every invitee who has never signed in (so has never held a session that could have
-- edited user_metadata). Idempotent: a row that already carries invite_org_id is left alone.
update auth.users u
set raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb)
  || jsonb_build_object(
       'invite_org_id', u.raw_user_meta_data ->> 'organisation_id',
       'invite_role', coalesce(u.raw_user_meta_data ->> 'invited_role', 'worker'))
where u.invited_at is not null
  and u.last_sign_in_at is null
  and u.raw_user_meta_data ? 'organisation_id'
  and not (coalesce(u.raw_app_meta_data, '{}'::jsonb) ? 'invite_org_id');
