-- ============================================================
-- 00083_member_hardening.sql — Phase 64 review fixes (64-REVIEW.md, ADR-0025)
-- ============================================================
-- Applied with scripts/apply-phase64b-migration.mjs (audit, apply, live assertions, rollback).
--
-- Sections:
--   1. HI-01  organisation_members INSERT / DELETE are service-role-only; the 00002 admin
--             INSERT policy is dropped. Pending invitees get their invite copied into
--             app_metadata (server-only), which acceptInvite now reads instead of user_metadata.
--   2. ME-01  the last active admin of an organisation can't be suspended, marked as left or
--             demoted by any path: a BEFORE UPDATE trigger locks the organisation row and
--             recounts inside the transaction.
--   3. ME-03  member_departments / users_sub_trades reads are tied to the caller's organisation
--             (the admin arm checked the caller's role but never the row's organisation).

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

-- 2. Keep one active admin (ME-01) -------------------------------------------------------------
-- The app counted active admins, then updated: two admins suspending each other at the same
-- moment both counted 2 and both succeeded. The trigger serialises every change that takes an
-- active admin away, per organisation (FOR NO KEY UPDATE on the organisations row, which does not
-- block foreign-key checks from other tables), and recounts after the lock with a fresh snapshot,
-- so the second change sees the first and is refused. Update only: deleting an organisation's
-- members (org merges, service-role scripts) is not a state change.
create or replace function public.keep_one_active_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'admin' and old.status = 'active'
     and (new.role <> 'admin' or new.status <> 'active') then
    perform 1 from public.organisations where id = old.organisation_id for no key update;
    if not exists (
      select 1 from public.organisation_members
      where organisation_id = old.organisation_id
        and id <> old.id
        and role = 'admin'
        and status = 'active'
    ) then
      raise exception 'last active admin' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists organisation_members_keep_admin on public.organisation_members;
create trigger organisation_members_keep_admin
  before update on public.organisation_members
  for each row execute function public.keep_one_active_admin();

-- 3. Junction reads tied to the organisation (ME-03) ----------------------------------------------
-- Neither table has an organisation_id. The 00035 / 00030 admin arm was "the caller is an admin
-- or safety manager", true for every row of every tenant (00048 fixed the same shape on
-- sop_access_people). The organisation predicate now sits outside the own-row / role OR, so
-- neither arm escapes it (CLAUDE.md: a policy that narrows by auth.uid() ANDs the org helper in).
-- No recursion: departments_org_read and org_members_can_view_own_org only call the helpers.
drop policy if exists "member_departments_self_read" on public.member_departments;
create policy "member_departments_self_read" on public.member_departments
  for select to authenticated
  using (
    exists (
      select 1 from public.departments d
      where d.id = member_departments.department_id
        and d.organisation_id = public.current_organisation_id()
    )
    and (
      member_id = auth.uid()
      or public.current_user_role() in ('admin', 'safety_manager')
    )
  );

drop policy if exists "users_sub_trades_self_read" on public.users_sub_trades;
create policy "users_sub_trades_self_read" on public.users_sub_trades
  for select to authenticated
  using (
    exists (
      select 1 from public.organisation_members m
      where m.user_id = users_sub_trades.user_id
        and m.organisation_id = public.current_organisation_id()
    )
    and (
      user_id = auth.uid()
      or public.current_user_role() in ('admin', 'safety_manager')
    )
  );
