-- Phase 46 CR-02 -- CAP-02 completion: migration 00063 extended
-- sop_sections / sop_steps / sop_images with the owner-OR-role arm, but the
-- guard layer (guards.ts A2) also grants owners "block junctions" edit -- and
-- sop_section_blocks' only write policy (ssb_admin_manage_own_org, 00019)
-- stayed admin/safety_manager-only. Result: owner junction writes were
-- guard-approved then RLS-denied, two of them (delete, reorder RPC) as
-- SILENT zero-row false success (CLAUDE.md 2026-07-20 class).
--
-- Traps this migration must not repeat (CLAUDE.md 2026-08-04):
--   1. The owner arm goes INSIDE the org-scope AND -- never a sibling
--      CREATE POLICY (permissive policies OR together; a sibling arm is a
--      cross-tenant hole, the 00061 class).
--   2. UNLIKE the three 00063 policies, this policy DOES carry a WITH CHECK
--      (00019 wrote one). A WITH CHECK REPLACES the USING predicate for
--      writes -- so it must restate EVERY predicate, byte-for-byte identical
--      to USING (the 00062 class: a partial WITH CHECK is more dangerous
--      than none at all).
--
-- The reorder_sop_section_blocks RPC (00024) is deliberately NOT SECURITY
-- DEFINER -- it runs as the caller, so this policy is exactly what gates it.
-- No RPC change is needed for owner access.

drop policy if exists "ssb_admin_manage_own_org" on public.sop_section_blocks;
create policy "ssb_admin_manage_own_org"
  on public.sop_section_blocks for all to authenticated
  using (exists (
    select 1 from public.sop_sections sec
    join public.sops sop on sop.id = sec.sop_id
    where sec.id = sop_section_blocks.sop_section_id
      and sop.organisation_id = public.current_organisation_id()
      and (
        public.current_user_role() in ('admin', 'safety_manager')
        or sop.owner_user_id = auth.uid()
      )
  ))
  with check (exists (
    select 1 from public.sop_sections sec
    join public.sops sop on sop.id = sec.sop_id
    where sec.id = sop_section_blocks.sop_section_id
      and sop.organisation_id = public.current_organisation_id()
      and (
        public.current_user_role() in ('admin', 'safety_manager')
        or sop.owner_user_id = auth.uid()
      )
  ));
