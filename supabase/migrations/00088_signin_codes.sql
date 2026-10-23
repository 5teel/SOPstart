-- Phase 67 / ADR-0029: in-person sign-in codes. A supervisor or admin gives a locked-out person a
-- code; the person types their email and the code on the login screen and is signed in.
--
-- 1. signin_codes: HMAC-SHA256(RECOVERY_PEPPER) of an 8-letter code, bound to one person in one
--    organisation, 30 minutes, single use, void after 5 wrong tries. RLS on with no policies and no
--    grants for anon/authenticated: only service-role code touches it.
-- 2. signin_code_try(email, hash): the one place a code is checked. One locked row, so the attempt
--    count cannot race; expiry is read at the try (ADR-0002, no job). A wrong code, an unknown
--    email and a person who is no longer active all return null, so the caller cannot tell them
--    apart. service_role only.
-- 3. Ledger kinds signin_code_issued and signin_code_used.

create table if not exists public.signin_codes (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  code_hash text not null,
  issued_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null,
  used_at timestamptz,
  attempts integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists signin_codes_user_open on public.signin_codes (user_id, created_at desc) where used_at is null;
alter table public.signin_codes enable row level security;
revoke all on public.signin_codes from anon, authenticated;

create or replace function public.signin_code_try(p_email text, p_hash text)
returns jsonb language plpgsql volatile security definer set search_path = ''
as $$
declare
  c public.signin_codes%rowtype;
begin
  select sc.* into c
    from public.signin_codes sc
    join auth.users u on u.id = sc.user_id
   where lower(u.email) = lower(trim(p_email))
     and sc.used_at is null and sc.attempts < 5 and sc.expires_at > now()
   order by sc.created_at desc
   limit 1
   for update of sc;
  if not found then
    return null;
  end if;
  if c.code_hash = p_hash and exists (
    select 1 from public.organisation_members m
     where m.organisation_id = c.organisation_id and m.user_id = c.user_id and m.status = 'active'
  ) then
    update public.signin_codes set used_at = now() where id = c.id;
    return jsonb_build_object('user_id', c.user_id, 'organisation_id', c.organisation_id, 'code_id', c.id, 'issued_by', c.issued_by);
  end if;
  update public.signin_codes set attempts = attempts + 1 where id = c.id;
  return null;
end
$$;
revoke all on function public.signin_code_try(text, text) from public, anon, authenticated;
grant execute on function public.signin_code_try(text, text) to service_role;

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
  'mfa_enrolled', 'mfa_removed', 'mfa_reset', 'recovery_codes_issued', 'recovery_code_used',
  'signin_code_issued', 'signin_code_used'
));
