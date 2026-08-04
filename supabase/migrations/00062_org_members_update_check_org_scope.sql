-- Cross-tenant WRITE hole on public.organisation_members, found by the
-- follow-up RLS audit after 00061 (the sops read hole).
--
--   admins_can_update_member_roles [UPDATE]
--     USING      organisation_id = current_organisation_id()   -- own-org rows only
--     WITH CHECK current_user_role() = 'admin'                 -- NO org constraint
--
-- USING governs which rows you may touch; WITH CHECK governs what the row is
-- allowed to become. An admin could therefore take a member row in their OWN
-- organisation and rewrite its organisation_id, pushing that user into another
-- tenant (or lifting a seat out of their own org into a foreign one).
--
-- The trap worth naming: a PARTIALLY-specified WITH CHECK is more dangerous
-- than none at all. Postgres falls back to the USING expression when WITH CHECK
-- is omitted — which is why the four sibling policies audited alongside this one
-- (sops, parse_jobs, video_generation_jobs, sop_pipeline_runs) are safe despite
-- having no WITH CHECK: they inherit their org-scoped USING. Writing a WITH
-- CHECK *replaces* that fallback, so a check added to express one rule ("only
-- admins may change roles") silently discarded the org rule it never mentioned.
--
-- Fix: restate BOTH conditions in the check. The role rule is preserved exactly;
-- the org rule is restored.
--
-- Enforced going forward by tests/lint/rls-org-scope.spec.ts, which fails on any
-- policy whose USING is org-scoped while an explicit WITH CHECK is not.

drop policy if exists "admins_can_update_member_roles" on public.organisation_members;

create policy "admins_can_update_member_roles"
  on public.organisation_members for update to authenticated
  using (
    organisation_id = public.current_organisation_id()
  )
  with check (
    organisation_id = public.current_organisation_id()
    and public.current_user_role() = 'admin'::app_role
  );
