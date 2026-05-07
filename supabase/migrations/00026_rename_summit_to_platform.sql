-- ============================================================
-- 00026_rename_summit_to_platform.sql
-- ============================================================
-- Rename the "Summit" super-admin surface introduced in 00022 to neutral
-- "platform_admins" / "is_platform_admin" naming. SOPstart is owned by
-- Potenco Pty Ltd and is unrelated to Summit Insights — the Summit prefix
-- in 00022 was a misattribution.
--
-- Renames:
--   table    public.summit_admins          -> public.platform_admins
--   function public.is_summit_admin()      -> public.is_platform_admin()
--   policy   summit_admins_self_read                       -> platform_admins_self_read
--   policy   block_suggestions_update_summit_only          -> block_suggestions_update_platform_only
--   policy   blocks_summit_admin_global_write              -> blocks_platform_admin_global_write
--   policy   blocks_summit_admin_global_update             -> blocks_platform_admin_global_update
--   policy   block_versions_summit_admin_global_insert     -> block_versions_platform_admin_global_insert
--
-- RLS policy bodies that call public.is_summit_admin() reference the function
-- by OID, not by text — renaming the function preserves all policy semantics.
-- No data migration is required.
-- ============================================================

-- 1. Rename the helper function. Existing RLS policies that reference it
--    keep working via OID dependency.
alter function public.is_summit_admin() rename to is_platform_admin;

comment on function public.is_platform_admin() is
  'Phase 13 (renamed in 00026): returns true if the calling user has a row in public.platform_admins. Replaces is_summit_admin().';

-- 2. Rename the role table.
alter table public.summit_admins rename to platform_admins;

comment on table public.platform_admins is
  'Phase 13 (renamed in 00026): platform super-admin grants (Potenco-owned). Service-role-only writes. Replaces summit_admins.';

-- 3. Rename policies (cosmetic — bodies are unchanged).
alter policy "summit_admins_self_read"
  on public.platform_admins
  rename to "platform_admins_self_read";

alter policy "block_suggestions_update_summit_only"
  on public.block_suggestions
  rename to "block_suggestions_update_platform_only";

alter policy "blocks_summit_admin_global_write"
  on public.blocks
  rename to "blocks_platform_admin_global_write";

alter policy "blocks_summit_admin_global_update"
  on public.blocks
  rename to "blocks_platform_admin_global_update";

alter policy "block_versions_summit_admin_global_insert"
  on public.block_versions
  rename to "block_versions_platform_admin_global_insert";
