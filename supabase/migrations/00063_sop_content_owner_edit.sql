-- CAP-02 -- sign-off authority (sops.owner_user_id, Phase 28's single
-- accountable owner -- assumption A1) carries content-edit rights on that
-- SOP. Extends the org-scoped USING of admins_can_manage_sections/_steps/
-- _images with an owner-OR-role arm. Scope is content edit only (assumption
-- A2): publish/delete/version-supersede/owner-reassignment are untouched
-- (admins_can_update_sops, admins_can_delete_sops, admins_can_insert_sops,
-- and every SELECT policy are NOT modified by this migration).
--
-- Two traps this migration must not repeat (CLAUDE.md 2026-08-04):
--   1. The owner arm goes INSIDE the existing policy's USING, conjoined
--      under the org-scope predicate -- never a sibling CREATE POLICY.
--      Permissive policies OR together at the top level; a sibling arm
--      without its own org predicate becomes a cross-tenant hole (the
--      exact class that hit public.sops in 00061).
--   2. This migration writes NO WITH CHECK. These three policies have none
--      today, so Postgres reuses USING as the check for INSERT/UPDATE --
--      which is what makes createSection's insert work for an owner.
--      Writing a partial WITH CHECK here would REPLACE the USING predicate
--      and silently narrow access back to admin-only (the 00062 class).
--      If a future migration adds a WITH CHECK to any of these three
--      policies, it MUST restate the full
--      "org AND (role OR owner)" predicate, not just part of it.

drop policy if exists "admins_can_manage_sections" on public.sop_sections;
create policy "admins_can_manage_sections"
  on public.sop_sections for all to authenticated
  using (
    exists (
      select 1 from public.sops
      where sops.id = sop_sections.sop_id
        and sops.organisation_id = public.current_organisation_id()
        and (
          public.current_user_role() in ('admin', 'safety_manager')
          or sops.owner_user_id = auth.uid()
        )
    )
  );

drop policy if exists "admins_can_manage_steps" on public.sop_steps;
create policy "admins_can_manage_steps"
  on public.sop_steps for all to authenticated
  using (
    exists (
      select 1 from public.sop_sections s
      join public.sops sop on sop.id = s.sop_id
      where s.id = sop_steps.section_id
        and sop.organisation_id = public.current_organisation_id()
        and (
          public.current_user_role() in ('admin', 'safety_manager')
          or sop.owner_user_id = auth.uid()
        )
    )
  );

drop policy if exists "admins_can_manage_images" on public.sop_images;
create policy "admins_can_manage_images"
  on public.sop_images for all to authenticated
  using (
    exists (
      select 1 from public.sops
      where sops.id = sop_images.sop_id
        and sops.organisation_id = public.current_organisation_id()
        and (
          public.current_user_role() in ('admin', 'safety_manager')
          or sops.owner_user_id = auth.uid()
        )
    )
  );
