-- ============================================================
-- SEED DATA: Two-org test data for cross-tenant isolation proof
-- ============================================================
-- This seed creates two organisations with users and members,
-- then runs SQL assertions to PROVE RLS isolation works.
-- If any assertion fails, the seed aborts with a raised exception.
--
-- Run via: npx supabase db reset (applies migrations then seed)
-- ============================================================

-- Create two test organisations
insert into public.organisations (id, name, invite_code)
values
  ('11111111-1111-1111-1111-111111111111', 'Org A - Glass Manufacturing Ltd', 'ORGA1234'),
  ('22222222-2222-2222-2222-222222222222', 'Org B - Steel Works NZ', 'ORGB5678');

-- Create test users via Supabase auth (service_role context in seed)
-- User A1: admin of Org A
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, confirmation_token, raw_app_meta_data, raw_user_meta_data)
values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'admin-a@orga.test',
  crypt('password123', gen_salt('bf')),
  now(), now(), now(), '',
  '{"provider":"email","providers":["email"]}',
  '{}'
);

-- User A2: worker of Org A
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, confirmation_token, raw_app_meta_data, raw_user_meta_data)
values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaab',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'worker-a@orga.test',
  crypt('password123', gen_salt('bf')),
  now(), now(), now(), '',
  '{"provider":"email","providers":["email"]}',
  '{}'
);

-- User B1: admin of Org B
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, confirmation_token, raw_app_meta_data, raw_user_meta_data)
values (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'admin-b@orgb.test',
  crypt('password123', gen_salt('bf')),
  now(), now(), now(), '',
  '{"provider":"email","providers":["email"]}',
  '{}'
);

-- Link users to organisations
insert into public.organisation_members (organisation_id, user_id, role)
values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'admin'),
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaab', 'worker'),
  ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'admin');

-- Create a supervisor assignment in Org A (for completeness)
insert into public.supervisor_assignments (organisation_id, supervisor_id, worker_id)
values (
  '11111111-1111-1111-1111-111111111111',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaab'
);

-- ============================================================
-- CROSS-TENANT ISOLATION ASSERTIONS
-- ============================================================
-- These assertions run as a DO block. If any assertion fails,
-- the seed raises an exception and `supabase db reset` fails.
-- This proves RLS isolation at the SQL level.
-- ============================================================

do $$
declare
  org_count integer;
  member_count integer;
  assignment_count integer;
begin
  -- Simulate Org A admin JWT context by setting the request.jwt.claims
  -- This mimics what the Custom Access Token Hook would produce
  perform set_config('request.jwt.claims', json_build_object(
    'sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'role', 'authenticated',
    'organisation_id', '11111111-1111-1111-1111-111111111111',
    'user_role', 'admin'
  )::text, true);

  -- Set the role to authenticated (RLS evaluates against this)
  set local role authenticated;

  -- Assertion 1: Org A admin can only see Org A (not Org B)
  select count(*) into org_count from public.organisations;
  if org_count != 1 then
    raise exception 'ISOLATION FAILURE: Org A admin sees % orgs, expected 1', org_count;
  end if;

  -- Assertion 2: Org A admin can only see Org A members (not Org B members)
  select count(*) into member_count from public.organisation_members;
  if member_count != 2 then
    raise exception 'ISOLATION FAILURE: Org A admin sees % members, expected 2', member_count;
  end if;

  -- Assertion 3: Org A admin can only see Org A supervisor assignments
  select count(*) into assignment_count from public.supervisor_assignments;
  if assignment_count != 1 then
    raise exception 'ISOLATION FAILURE: Org A admin sees % assignments, expected 1', assignment_count;
  end if;

  -- Now simulate Org B admin JWT context
  reset role;
  perform set_config('request.jwt.claims', json_build_object(
    'sub', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'role', 'authenticated',
    'organisation_id', '22222222-2222-2222-2222-222222222222',
    'user_role', 'admin'
  )::text, true);
  set local role authenticated;

  -- Assertion 4: Org B admin can only see Org B (not Org A)
  select count(*) into org_count from public.organisations;
  if org_count != 1 then
    raise exception 'ISOLATION FAILURE: Org B admin sees % orgs, expected 1', org_count;
  end if;

  -- Assertion 5: Org B admin can only see Org B members (not Org A members)
  select count(*) into member_count from public.organisation_members;
  if member_count != 1 then
    raise exception 'ISOLATION FAILURE: Org B admin sees % members, expected 1', member_count;
  end if;

  -- Assertion 6: Org B admin cannot see Org A supervisor assignments
  select count(*) into assignment_count from public.supervisor_assignments;
  if assignment_count != 0 then
    raise exception 'ISOLATION FAILURE: Org B admin sees % assignments, expected 0', assignment_count;
  end if;

  -- Reset role for subsequent seed operations
  reset role;

  raise notice 'CROSS-TENANT ISOLATION: All 6 assertions passed';
end;
$$;
