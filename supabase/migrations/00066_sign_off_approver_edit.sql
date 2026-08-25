-- A1 RESOLVED (Simon, 2026-08-25) -- sign-off authority = approval-chain
-- approvers (Phase 29 approval_chains/sop_approvals), NOT sops.owner_user_id.
-- Recreates the four CAP-02 content policies (00063: sections/steps/images,
-- 00064: block junctions) replacing the `owner_user_id = auth.uid()` arm with
-- public.is_sop_sign_off_approver(<sop id>). Accepted consequence: a SOP
-- whose category has NO configured chain (or empty steps) has zero people
-- with sign-off-derived edit rights -- only admin/safety_manager can edit it.
--
-- Two traps this migration must not repeat (CLAUDE.md 2026-08-04):
--   1. The approver arm goes INSIDE the existing policy's USING, conjoined
--      under the org-scope predicate -- never a sibling CREATE POLICY.
--      Permissive policies OR together at the top level; a sibling arm
--      without its own org predicate becomes a cross-tenant hole (the exact
--      class that hit public.sops in 00061). The helper ALSO self-enforces
--      org scope internally (defence in depth), but the nesting stays.
--   2. The three 00063 policies write NO WITH CHECK (Postgres reuses USING
--      as the check -- which is what makes createSection's insert work for
--      an approver). The junction policy DOES write a WITH CHECK (00019
--      did), so it restates the FULL predicate, byte-identical to USING --
--      a partial WITH CHECK REPLACES the USING predicate (the 00062 class).
--
-- Helper safety (CLAUDE.md 2026-07-05): is_sop_sign_off_approver is
-- SECURITY DEFINER and client-callable, which is safe ONLY because identity
-- derives from auth.uid() / current_organisation_id() / current_user_role()
-- INTERNALLY (the 00030 precedent). Its single parameter is the sop id, and
-- the answer is about the caller themselves -- it is not a parameter-trusting
-- function, so the 2026-07-05 REVOKE-to-service_role rule does not apply.
-- Cross-tenant probe with a foreign sop id returns false (org conjunct).

create or replace function public.is_sop_sign_off_approver(p_sop_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.sops s
    join public.approval_chains ac
      on ac.organisation_id = s.organisation_id
     and ac.category = s.category_slug
    cross join lateral jsonb_array_elements(ac.steps) as step
    where s.id = p_sop_id
      and s.organisation_id = public.current_organisation_id()
      and (
        step->>'userId' = auth.uid()::text
        or step->>'role' = public.current_user_role()::text
      )
  );
$$;

revoke execute on function public.is_sop_sign_off_approver(uuid) from public, anon;
grant execute on function public.is_sop_sign_off_approver(uuid) to authenticated, service_role;

-- The three 00063 policies: approver arm replaces the owner arm, nested
-- under the org conjunct. NO WITH CHECK (see trap 2).

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
          or public.is_sop_sign_off_approver(sops.id)
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
          or public.is_sop_sign_off_approver(sop.id)
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
          or public.is_sop_sign_off_approver(sops.id)
        )
    )
  );

-- The 00064 junction policy: WITH CHECK restates the FULL predicate,
-- byte-identical to USING (see trap 2).

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
        or public.is_sop_sign_off_approver(sop.id)
      )
  ))
  with check (exists (
    select 1 from public.sop_sections sec
    join public.sops sop on sop.id = sec.sop_id
    where sec.id = sop_section_blocks.sop_section_id
      and sop.organisation_id = public.current_organisation_id()
      and (
        public.current_user_role() in ('admin', 'safety_manager')
        or public.is_sop_sign_off_approver(sop.id)
      )
  ));
