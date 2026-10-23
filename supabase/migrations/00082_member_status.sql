-- ============================================================
-- 00082_member_status.sql — membership states replace removal (ADR-0024)
-- ============================================================
-- Why: RLS trusted the organisation and role claims inside the access token, and a token
-- stays valid for up to an hour (jwt_exp 3600). Revoking sessions does not shorten that
-- either: the access token of a revoked session is still accepted until it expires. So a
-- suspended or departed person could keep reading and writing org data through PostgREST
-- and Storage for up to an hour. The helpers now re-check the membership row on every call:
-- the token's organisation claim only SELECTS which row, the row decides (status active).
--
-- Backwards compatible with the code deployed before it: the new column defaults to
-- 'active' for every row, the helpers return the same values for an active member, the hook
-- change is a no-op for active rows, role stays updatable (the only column a session client
-- writes), and the kind CHECK only widens.
--
-- Sections:
--   1. status, status_changed_at, status_changed_by on organisation_members (text + CHECK)
--   2. UPDATE lock: a signed-in user may update the role column only
--   3. current_organisation_id() / current_user_role() verify an active membership row
--   4. custom_access_token_hook skips non-active rows (ADR-0018 approval gate unchanged)
--   5. policies that read the token claims directly, rewritten onto the helpers; the dead
--      generated-videos read policy is dropped (it reads app_metadata and matches nothing,
--      video generation went in Phase 55)
--   6. sop_observations_read_org: the own-row arm is ANDed with the org predicate
--   7. sop_observation_refs_in_org: the observed worker must be an active member
--   8. revoke_user_sessions(uuid): service_role only
--   9. decisions_kind_check widened with member_suspended, member_left, member_reinstated
--  10. sop-videos SELECT scoped to the organisation folder (every object is org-prefixed)

-- 1. Columns ------------------------------------------------------------------------
alter table public.organisation_members
  add column if not exists status text not null default 'active',
  add column if not exists status_changed_at timestamptz,
  add column if not exists status_changed_by uuid references auth.users(id) on delete set null;

alter table public.organisation_members drop constraint if exists organisation_members_status_check;
alter table public.organisation_members add constraint organisation_members_status_check
  check (status in ('active', 'suspended', 'left'));

-- 2. UPDATE lock --------------------------------------------------------------------
-- The admin UPDATE policy lets an admin PATCH any column over the REST API. Status is
-- service-role-only, so the only column a signed-in user keeps is role.
revoke update on public.organisation_members from anon, authenticated;
grant update (role) on public.organisation_members to authenticated;

-- 3. Helpers ------------------------------------------------------------------------
-- Same names, same return types, same security definer + empty search_path, so every
-- dependent policy is covered without an edit. A pending claim now yields NULL instead of
-- an enum-cast error. The function owner reads the table past RLS (not forced), so no
-- recursion through the table's own policies.
create or replace function public.current_organisation_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.organisation_id
  from public.organisation_members m
  where m.user_id = auth.uid()
    and m.organisation_id = nullif(auth.jwt() ->> 'organisation_id', 'null')::uuid
    and m.status = 'active'
$$;

create or replace function public.current_user_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select m.role
  from public.organisation_members m
  where m.user_id = auth.uid()
    and m.organisation_id = nullif(auth.jwt() ->> 'organisation_id', 'null')::uuid
    and m.status = 'active'
$$;

-- 4. Access-token hook ---------------------------------------------------------------
-- The 00081 body, with both organisation_members selects filtered to active rows. A person
-- suspended in their chosen site falls back to their latest active site, else the claims
-- are empty and the account is sent to /pending.
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  claims         jsonb;
  member_record  record;
  active_org     uuid;
  raw_meta       jsonb;
  approval       text;
begin
  select status into approval from public.user_approvals where user_id = (event->>'user_id')::uuid;
  approval := coalesce(approval, 'pending');

  if approval = 'approved' then
    raw_meta := event->'claims'->'user_metadata';
    if raw_meta is not null and raw_meta->>'active_org_id' is not null then
      active_org := (raw_meta->>'active_org_id')::uuid;
      select organisation_id, role into member_record
      from public.organisation_members
      where user_id = (event->>'user_id')::uuid and organisation_id = active_org and status = 'active'
      limit 1;
    end if;

    if member_record is null then
      select organisation_id, role into member_record
      from public.organisation_members
      where user_id = (event->>'user_id')::uuid and status = 'active'
      order by created_at desc
      limit 1;
    end if;
  end if;

  claims := event->'claims';
  claims := jsonb_set(claims, '{approval}', to_jsonb(approval));
  if member_record is not null then
    claims := jsonb_set(claims, '{organisation_id}', to_jsonb(member_record.organisation_id::text));
    claims := jsonb_set(claims, '{user_role}', to_jsonb(member_record.role::text));
  else
    claims := jsonb_set(claims, '{organisation_id}', 'null');
    claims := jsonb_set(claims, '{user_role}', '"pending"');
  end if;

  return jsonb_set(event, '{claims}', claims);
end;
$$;

grant execute on function public.custom_access_token_hook to supabase_auth_admin;

-- 5. Policies that read the token claims directly -------------------------------------
-- Same name, command, roles and predicates; the claim reads become the helpers.
drop policy if exists "escalation_insert_own" on public.escalation_reports;
create policy "escalation_insert_own" on public.escalation_reports
  for insert to authenticated
  with check (
    organisation_id = public.current_organisation_id()
    and submitted_by = auth.uid()
  );

drop policy if exists "escalation_select_scoped" on public.escalation_reports;
create policy "escalation_select_scoped" on public.escalation_reports
  for select to authenticated
  using (
    organisation_id = public.current_organisation_id()
    and (
      submitted_by = auth.uid()
      or public.current_user_role()::text = any (array['supervisor', 'admin', 'safety_manager'])
    )
  );

drop policy if exists "escalation_update_supervisor" on public.escalation_reports;
create policy "escalation_update_supervisor" on public.escalation_reports
  for update to authenticated
  using (
    organisation_id = public.current_organisation_id()
    and public.current_user_role()::text = any (array['supervisor', 'admin', 'safety_manager'])
  )
  with check (
    organisation_id = public.current_organisation_id()
  );

drop policy if exists "voice_notes_insert_own" on public.sop_voice_notes;
create policy "voice_notes_insert_own" on public.sop_voice_notes
  for insert to authenticated
  with check (
    organisation_id = public.current_organisation_id()
    and created_by = auth.uid()
  );

drop policy if exists "voice_notes_select_org" on public.sop_voice_notes;
create policy "voice_notes_select_org" on public.sop_voice_notes
  for select to authenticated
  using (organisation_id = public.current_organisation_id());

drop policy if exists "uat_feedback_insert_own" on public.uat_feedback;
create policy "uat_feedback_insert_own" on public.uat_feedback
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and organisation_id = public.current_organisation_id()
  );

drop policy if exists "uat_feedback_read_org" on public.uat_feedback;
create policy "uat_feedback_read_org" on public.uat_feedback
  for select to authenticated
  using (organisation_id = public.current_organisation_id());

drop policy if exists "voice_bucket_insert_own" on storage.objects;
create policy "voice_bucket_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'sop-voice-notes'
    and (storage.foldername(name))[1] = public.current_organisation_id()::text
    and owner = auth.uid()
  );

drop policy if exists "voice_bucket_select_org" on storage.objects;
create policy "voice_bucket_select_org" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'sop-voice-notes'
    and (storage.foldername(name))[1] = public.current_organisation_id()::text
  );

drop policy if exists "org members can read generated videos" on storage.objects;

-- 6. Observations own-row arm ----------------------------------------------------------
-- Permissive arms OR together: the own-row arm had no org predicate and would have survived
-- the helper change. The org predicate now sits outside the role / own-row OR.
drop policy if exists "sop_observations_read_org" on public.sop_observations;
create policy "sop_observations_read_org" on public.sop_observations
  for select to authenticated
  using (
    organisation_id = public.current_organisation_id()
    and (
      public.current_user_role() in ('admin', 'safety_manager', 'supervisor')
      or observed_worker_id = auth.uid()
    )
  );

-- 7. Observation reference check ---------------------------------------------------------
create or replace function public.sop_observation_refs_in_org(p_sop_id uuid, p_worker_id uuid, p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (select 1 from public.sops s where s.id = p_sop_id and s.organisation_id = p_org_id)
    and exists (
      select 1 from public.organisation_members m
      where m.user_id = p_worker_id and m.organisation_id = p_org_id and m.status = 'active'
    )
$$;

-- 8. Session revocation -------------------------------------------------------------------
-- No admin-API route revokes one user's sessions by id (signOut needs the user's own JWT,
-- a ban locks them out of every site). Deleting the session rows is what sign-out does;
-- refresh tokens and MFA claims cascade. Takes a user id, so service_role only.
create or replace function public.revoke_user_sessions(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  delete from auth.sessions where user_id = p_user_id;
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.revoke_user_sessions(uuid) from public, anon, authenticated;
grant execute on function public.revoke_user_sessions(uuid) to service_role;

-- 9. Ledger kinds ---------------------------------------------------------------------------
-- The full 00076 list plus the three member state kinds. member_removed stays: the ledger is
-- append-only and old rows carry it.
alter table public.decisions drop constraint if exists decisions_kind_check;

alter table public.decisions add constraint decisions_kind_check check (kind in (
  'approve', 'reject', 'sign_off', 'countersign', 'assign', 'unassign', 'publish',
  'owner_change', 'review', 'observation', 'verify', 'verify_withdrawn',
  'ai_finding_cleared', 'cadence_change', 'ai_field_write',
  'role_change', 'member_invited', 'member_removed',
  'request_accepted', 'request_declined', 'objective_set', 'objective_cleared', 'objective_confirmed',
  'supervisor_linked', 'supervisor_unlinked', 'department_change', 'access_change',
  'sop_created', 'sop_edited', 'sop_deleted', 'sop_version', 'standard_change',
  'site_change', 'settings_change',
  'member_suspended', 'member_left', 'member_reinstated'
));

-- 10. sop-videos read scope (D-19) ------------------------------------------------------------
-- The bucket-wide SELECT let any signed-in user read any tenant's video by path. Every object
-- in the bucket is under {organisation id}/..., so the read is pinned to the caller's folder.
drop policy if exists "Authenticated users can read from sop-videos" on storage.objects;
create policy "Authenticated users can read from sop-videos" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'sop-videos'
    and (storage.foldername(name))[1] = public.current_organisation_id()::text
  );
