-- ============================================================
-- Migration 00048: Phase 32 code-review WR-01 — org-scope the admin read arm
-- of sop_access_people_self_read.
--
-- 00046's policy admin arm checked only that the caller is an admin/
-- safety_manager SOMEWHERE (`exists ... om.user_id = auth.uid() and om.role in
-- ('admin','safety_manager')`) with no linkage between the caller's org and the
-- row — so a tenant-A admin could SELECT every tenant's (sop_id, member_id)
-- access map. The comment said "in same org"; the SQL didn't. This recreates
-- the policy with the admin arm joined to the TARGET MEMBER's org.
--
-- Deliberately does NOT reference public.sops — that would recurse via
-- sops_visible_by_person_grant -> sop_in_user_person_grants (42P17, the
-- 00030/00031 trap). organisation_members is safe to reference.
--
-- Known sibling: 00035's member_departments_self_read has the same unscoped
-- admin arm (this policy mirrored it). That fix is a separate follow-up —
-- out of Phase 32 review-fix scope.
-- ============================================================

begin;

drop policy if exists "sop_access_people_self_read" on public.sop_access_people;

-- Workers see their own rows; admins/safety_managers see rows for members of
-- THEIR OWN org only (WR-01).
create policy "sop_access_people_self_read" on public.sop_access_people
  for select to authenticated
  using (
    member_id = auth.uid()
    or exists (
      select 1
      from public.organisation_members om
      join public.organisation_members target
        on target.organisation_id = om.organisation_id
      where om.user_id = auth.uid()
        and om.role in ('admin', 'safety_manager')
        and target.user_id = sop_access_people.member_id
    )
  );

comment on policy "sop_access_people_self_read" on public.sop_access_people is
  'Phase 32 WR-01 (00048): self-read + SAME-ORG admin/safety_manager read — the admin arm is joined to the target member''s organisation_members row, unlike the 00046 original which granted any admin of any org a full-table read. No reference to public.sops (42P17 recursion trap).';

commit;
