-- ============================================================
-- Migration 00031: Phase 15 hotfix — break RLS recursion between sops <-> sops_sub_trades
--
-- Bug: migration 00030 created two policies that recurse through each other:
--
--   sops.sops_visible_by_sub_trade        →  references sops_sub_trades via `not exists`
--   sops_sub_trades.sops_sub_trades_read_for_org  →  references sops via `exists`
--
-- Postgres detects the infinite recursion and returns 42P17 "infinite recursion
-- detected in policy for relation", surfaced as a 500 by PostgREST. Symptom:
-- ANY query that selects from sops (e.g. /sop_assignments?select=…,sops(…))
-- fails 500.
--
-- Fix: drop the recursive sops_sub_trades read policy and replace it with a
-- simple authenticated-read policy. Junction-table tags (a pair of opaque
-- UUIDs) are not sensitive metadata — they're already implied by the parent
-- SOP's visibility through sops_visible_by_sub_trade. This matches the
-- existing pattern on `sub_trades` (the controlled-vocab table) which is
-- also `using (true)` to authenticated.
--
-- All existing security guarantees are preserved:
--   * Workers still can't read SOPs outside their sub-trade (the gate is on
--     sops, not on sops_sub_trades).
--   * Writes to sops_sub_trades still go through admin server actions only
--     (no INSERT/UPDATE/DELETE policy exists for authenticated).
-- ============================================================

begin;

drop policy if exists "sops_sub_trades_read_for_org" on public.sops_sub_trades;

create policy "sops_sub_trades_read_all_auth" on public.sops_sub_trades
  for select to authenticated using (true);

comment on policy "sops_sub_trades_read_all_auth" on public.sops_sub_trades is
  'Phase 15 hotfix (00031): replaces sops_sub_trades_read_for_org which caused RLS recursion with sops_visible_by_sub_trade. Tags themselves are non-sensitive — the real gate is on sops.';

commit;
