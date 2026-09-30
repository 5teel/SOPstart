-- Missing SELECT policy on public.blocks and its transitive block_versions
-- reader, discovered by Phase 43's deployed eval (createBlock() through the
-- session client, not the admin client, for the first time — new-block.spec.ts
-- test A).
--
-- Migration 00037 ("Departments as a first-class entity — RLS cleanup") dropped
-- `blocks_read_global_plus_org` as dead weight (correct: all blocks are
-- org-scoped since 00036, so the null-org read arm was unreachable) but never
-- added an org-scoped replacement. With RLS enabled and zero permissive SELECT
-- policies left on `blocks`, Postgres denies every read of that table via any
-- role-scoped (non-service) client:
--   - createBlock()'s `.select('*').single()` after INSERT needs the new row
--     to also pass a SELECT check (INSERT ... RETURNING requires it); with no
--     SELECT policy it always fails with 42501 "new row violates row-level
--     security policy for table blocks" -- even though the INSERT's own
--     WITH CHECK (org + role) is satisfied.
--   - block_versions_read_via_blocks (00019) reads FROM public.blocks inside
--     its EXISTS subquery, which is itself RLS-gated — so block_versions reads
--     were silently empty for any session-client caller too.
--
-- This went undetected because every existing app read of `blocks` (the
-- Content Library page, the picker) goes through the admin/service-role
-- client, which bypasses RLS entirely. The first client-side session-client
-- read (this phase's /admin/blocks/new create-and-return flow) is what
-- surfaced it. Same failure class as [2026-08-04] on `public.sops`: an
-- RLS gap that is invisible until something actually exercises the
-- session-scoped path (CLAUDE.md "a green stub suite proves nothing about
-- RLS reachability").
--
-- Fix: reinstate a SELECT policy scoped to the caller's own organisation
-- (global/null-org blocks are retired per Phase 25 D-01 — no OR arm needed).

create policy "blocks_read_own_org"
  on public.blocks for select to authenticated
  using (organisation_id = public.current_organisation_id());
