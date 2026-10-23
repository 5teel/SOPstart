-- Phase 66 / ADR-0028, part 1 of 2 (additive; applied before the app that uses it ships).
-- 00087 then moves every elevated write policy onto public.is_elevated().
--
-- 1. public.is_elevated(): an admin or safety manager (membership row re-checked by
--    current_user_role, 00082) whose session proved a second step. The signed aal claim is
--    the one claim policies may trust: it is session state, not membership state.
-- 2. mfa_recovery_codes: HMAC-SHA256(pepper) hashes of one-time recovery codes. RLS on with no
--    policies and no grants for anon/authenticated: only service-role code touches it.
-- 3. mfa_recovery_attempts + mfa_recovery_attempt(): at most 5 tries per 15 minutes per person,
--    counted on the try itself (ADR-0002: no scheduled job resets anything). service_role only.
-- 4. Ledger kinds mfa_enrolled, mfa_removed, mfa_reset, recovery_codes_issued, recovery_code_used.
-- 5. Notification kind signin_reset (every admin hears when someone's sign-in steps are reset).

create or replace function public.is_elevated()
returns boolean language sql stable set search_path = ''
as $$
  select coalesce(public.current_user_role() in ('admin'::public.app_role, 'safety_manager'::public.app_role), false)
     and coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
$$;
revoke all on function public.is_elevated() from public;
grant execute on function public.is_elevated() to anon, authenticated, service_role;

create table if not exists public.mfa_recovery_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code_hash text not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, code_hash)
);
alter table public.mfa_recovery_codes enable row level security;
revoke all on public.mfa_recovery_codes from anon, authenticated;

create table if not exists public.mfa_recovery_attempts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  attempts integer not null default 0,
  window_start timestamptz not null default now()
);
alter table public.mfa_recovery_attempts enable row level security;
revoke all on public.mfa_recovery_attempts from anon, authenticated;

-- One atomic statement: a try older than 15 minutes starts a new window. True while within 5.
create or replace function public.mfa_recovery_attempt(p_user uuid)
returns boolean language sql volatile security definer set search_path = ''
as $$
  insert into public.mfa_recovery_attempts as a (user_id, attempts, window_start)
  values (p_user, 1, now())
  on conflict (user_id) do update set
    attempts = case when a.window_start < now() - interval '15 minutes' then 1 else a.attempts + 1 end,
    window_start = case when a.window_start < now() - interval '15 minutes' then now() else a.window_start end
  returning attempts <= 5
$$;
revoke all on function public.mfa_recovery_attempt(uuid) from public, anon, authenticated;
grant execute on function public.mfa_recovery_attempt(uuid) to service_role;

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
  'member_suspended', 'member_left', 'member_reinstated',
  'passkey_added', 'passkey_removed',
  'mfa_enrolled', 'mfa_removed', 'mfa_reset', 'recovery_codes_issued', 'recovery_code_used'
));

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'approve_next', 'review_due', 'signoff', 'request_answered', 'new_version', 'asked', 'signin_reset'
));
