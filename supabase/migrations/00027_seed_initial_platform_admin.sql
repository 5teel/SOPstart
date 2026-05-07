-- ============================================================
-- 00027_seed_initial_platform_admin.sql
-- ============================================================
-- Seed the initial platform super-admin (Potenco) so /admin/global-blocks
-- and the suggestions queue are accessible from a fresh environment without
-- a manual SQL editor step.
--
-- Idempotent on two axes:
--   1. ON CONFLICT (user_id) DO NOTHING  — safe to re-run
--   2. SELECT FROM auth.users WHERE email = ... — yields zero rows on
--      environments where Simon's auth user has not yet signed up; the
--      INSERT then becomes a no-op (no error).
--
-- New environments: after `supabase db push`, sign up with the seeded email
-- once, then re-run this migration (or insert manually) to grant the role.
-- ============================================================

insert into public.platform_admins (user_id, notes)
select id, 'initial seed (Potenco) — 00027'
from auth.users
where email = 'simonscott86@gmail.com'
on conflict (user_id) do nothing;
