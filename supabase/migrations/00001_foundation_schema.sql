-- Organisations (root tenant entity)
create table public.organisations (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  invite_code     text not null unique default upper(substr(md5(random()::text), 1, 8)),
  trial_ends_at   timestamptz not null default (now() + interval '14 days'),
  created_at      timestamptz not null default now()
);

-- Role enum
create type public.app_role as enum ('worker', 'supervisor', 'admin', 'safety_manager');

-- Organisation members (links auth.users to organisations with role)
create table public.organisation_members (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  role            public.app_role not null default 'worker',
  created_at      timestamptz not null default now(),
  unique (organisation_id, user_id),
  unique (user_id)  -- Enforce one-org-per-user (research recommendation)
);

-- Indexes for RLS policy scans and hook lookup
create index idx_org_members_org_id on public.organisation_members (organisation_id);
create index idx_org_members_user_id on public.organisation_members (user_id);

-- Supervisor assignments (who supervises whom)
create table public.supervisor_assignments (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  supervisor_id   uuid not null references auth.users(id) on delete cascade,
  worker_id       uuid not null references auth.users(id) on delete cascade,
  created_at      timestamptz not null default now(),
  unique (organisation_id, supervisor_id, worker_id)
);

create index idx_supervisor_assignments_org_id on public.supervisor_assignments (organisation_id);

-- Enable RLS on all tables
alter table public.organisations enable row level security;
alter table public.organisation_members enable row level security;
alter table public.supervisor_assignments enable row level security;

-- Helper: extract current user's organisation_id from JWT
create or replace function public.current_organisation_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select nullif(auth.jwt() ->> 'organisation_id', 'null')::uuid
$$;

-- Helper: extract current user's role from JWT
create or replace function public.current_user_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select (auth.jwt() ->> 'user_role')::public.app_role
$$;

-- Custom Access Token Hook — injects org_id and role into JWT
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
begin
  select organisation_id, role
  into   member_record
  from   public.organisation_members
  where  user_id = (event->>'user_id')::uuid
  limit  1;

  claims := event->'claims';

  if member_record is not null then
    claims := jsonb_set(claims, '{organisation_id}', to_jsonb(member_record.organisation_id::text));
    claims := jsonb_set(claims, '{user_role}',       to_jsonb(member_record.role::text));
  else
    claims := jsonb_set(claims, '{organisation_id}', 'null');
    claims := jsonb_set(claims, '{user_role}',       '"pending"');
  end if;

  return jsonb_set(event, '{claims}', claims);
end;
$$;

-- Grant auth system permission to execute the hook
grant execute on function public.custom_access_token_hook to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook from authenticated, anon, public;
