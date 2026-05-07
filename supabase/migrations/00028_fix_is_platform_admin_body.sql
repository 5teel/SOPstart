-- ============================================================
-- 00028_fix_is_platform_admin_body.sql
-- ============================================================
-- Fix-forward: 00026 renamed `is_summit_admin` → `is_platform_admin` and
-- `summit_admins` → `platform_admins`, but Postgres did NOT rewrite the
-- SQL function body — it still references `public.summit_admins`. Calls
-- to is_platform_admin() now fail with:
--   ERROR: relation "public.summit_admins" does not exist (42P01)
--
-- Replace the function body so it reads from `public.platform_admins`.
-- All RLS policies that call is_platform_admin() inherit the fix.
-- ============================================================

create or replace function public.is_platform_admin() returns boolean
  language sql
  stable
  security definer
  set search_path = public
as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;

comment on function public.is_platform_admin() is
  'Phase 13 (00022 → 00026 → 00028 fix): returns true if calling user has a row in public.platform_admins.';
