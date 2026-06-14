-- ============================================================
-- Migration 00037: Phase 25 Department as a First-Class Entity — RLS + table cleanup
-- Steps:
--   1. Drop the null-org global read policy on blocks (00019 — now all blocks are org-scoped after 00036)
--   2. Drop the platform-admin global write policies on blocks + block_versions (00022 — global model removed)
--   3. Drop block_suggestions RLS policies (00022 — global promotion model removed with Phase 25)
--   4. Drop block_suggestions table (00022 — sunset with the org-vs-global model)
--
-- SAFETY: is_platform_admin() / is_summit_admin() functions are NOT dropped here.
--   is_platform_admin() is still referenced by migration 00032 (ai_review_results policy).
--   is_summit_admin() is still referenced by 00022 summit_admins_self_read policy.
--   Dropping either would break surviving policies.
--
-- All changes here are destructive only for the retired global-block model.
-- No blocks, block_versions, sops, or departments data is touched.
-- ============================================================

begin;

-- ============================================================
-- 1. Drop null-org global read policy on blocks
-- (migration 00019 blocks_read_global_plus_org allowed organisation_id IS NULL reads;
--  after migration 00036 all blocks are org-scoped — this arm is dead weight.)
-- ============================================================
drop policy if exists "blocks_read_global_plus_org" on public.blocks;

-- ============================================================
-- 2. Drop platform-admin global write policies on blocks + block_versions
-- (migration 00022 — granted Summit/platform admins the ability to write
--  NULL-org blocks. After 00036 no NULL-org blocks exist, so these policies
--  are a dead surface that should be retired.)
-- ============================================================
drop policy if exists "blocks_summit_admin_global_write" on public.blocks;
drop policy if exists "blocks_summit_admin_global_update" on public.blocks;
drop policy if exists "block_versions_summit_admin_global_insert" on public.block_versions;

-- ============================================================
-- 3. Drop block_suggestions RLS policies (migration 00022)
-- The suggest-for-global workflow is sunset with the org-vs-global model.
-- block_suggestions table is dropped next, but policies must be dropped first
-- (or CASCADE handles it — using explicit drops for clarity).
-- ============================================================
drop policy if exists "block_suggestions_read" on public.block_suggestions;
drop policy if exists "block_suggestions_insert" on public.block_suggestions;
drop policy if exists "block_suggestions_update_summit_only" on public.block_suggestions;

-- ============================================================
-- 4. Drop block_suggestions table (migration 00022)
-- CASCADE drops any remaining indexes, policies, or FK references.
-- ============================================================
drop table if exists public.block_suggestions cascade;

commit;
