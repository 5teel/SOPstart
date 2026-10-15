-- ============================================================
-- 00081_user_approval.sql — every new account waits for a platform admin (ADR-0018)
-- ============================================================
-- One row per auth user. Until it says 'approved' the access-token hook leaves the
-- organisation and role claims empty, so every RLS policy keyed on
-- current_organisation_id() (all org data) refuses the account and the app sends it
-- to /pending. Writes: the trigger below and the service role (decideNewUser, a
-- platform-admin-only server action). No authenticated write policy.

create table public.user_approvals (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  status      text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  created_at  timestamptz not null default now(),
  decided_at  timestamptz,
  decided_by  uuid references auth.users(id) on delete set null
);

alter table public.user_approvals enable row level security;

create policy user_approvals_own_read on public.user_approvals
  for select to authenticated using (user_id = auth.uid());
create policy user_approvals_platform_read on public.user_approvals
  for select to authenticated using (public.is_platform_admin());

-- Everyone who has an account today is approved.
insert into public.user_approvals (user_id, status, decided_at)
select id, 'approved', now() from auth.users
on conflict (user_id) do nothing;

-- New accounts. Deferred to commit so it sees the finished row: an account created
-- already confirmed and not invited (our own service-role scripts and tests; public
-- sign-up is off) is approved; an invited or self-registered account waits.
create or replace function public.queue_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  u record;
  ok boolean;
begin
  select email_confirmed_at, invited_at into u from auth.users where id = new.id;
  if not found then
    return null;
  end if;
  ok := u.invited_at is null and u.email_confirmed_at is not null;
  insert into public.user_approvals (user_id, status, decided_at)
  values (new.id, case when ok then 'approved' else 'pending' end, case when ok then now() end)
  on conflict (user_id) do nothing;
  return null;
end;
$$;

drop trigger if exists queue_new_user on auth.users;
create constraint trigger queue_new_user
  after insert on auth.users
  deferrable initially deferred
  for each row execute function public.queue_new_user();

-- The access-token hook (00017) plus the approval gate.
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
      where user_id = (event->>'user_id')::uuid and organisation_id = active_org
      limit 1;
    end if;

    if member_record is null then
      select organisation_id, role into member_record
      from public.organisation_members
      where user_id = (event->>'user_id')::uuid
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
