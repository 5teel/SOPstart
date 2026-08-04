-- Cross-tenant read hole on public.sops. Found 2026-08-04 from a user-visible
-- symptom: assigning a department in the library detail pane returned "SOP
-- belongs to another organisation" — the WRITE guard correctly refusing a row
-- the READ path should never have shown.
--
-- Postgres OR-combines every permissive SELECT policy on a table. `sops` had
-- four, and only ONE carried an org predicate:
--
--   org_members_can_view_sops     organisation_id = current_organisation_id()   ✓
--   sops_visible_by_department    (all_departments = true)
--                                 OR NOT EXISTS (sop_departments for this sop)
--                                 OR sop_in_user_departments(id)               ✗ no org
--   sops_visible_by_sub_trade     NOT EXISTS (sops_sub_trades for this sop)
--                                 OR sub_trade_id_intersects(id)               ✗ no org
--   sops_visible_by_person_grant  sop_in_user_person_grants(id)                 ✗ no org
--
-- So the org-scoped policy was decorative: the second arm of
-- sops_visible_by_department matches ANY SOP in ANY organisation that has no
-- department tag, and the sub-trade policy does the same for any SOP with no
-- sub-trade tag. Measured on live data at the time of the fix: 15 of 30 SOPs
-- were readable by every authenticated user of every tenant, spanning three
-- organisations. The admin library was rendering 7 SOPs from three foreign
-- orgs to a user who is a member of exactly one.
--
-- This is the [2026-07-20] class in CLAUDE.md — "an RLS SELECT policy's branch
-- without an org check is a disclosure hole, and a cross-ORG isolation test
-- will never catch it" — recurring on a new table. The tagging arms exist to
-- NARROW visibility within an organisation (a worker sees their department's
-- SOPs), so each must be conjoined with the org predicate, never OR'd beside
-- it.
--
-- Fix: every arm gets `organisation_id = current_organisation_id() AND (…)`.
-- Intra-org behaviour is unchanged — a member sees exactly what they saw
-- before, minus other tenants' rows.
--
-- No recursion risk (42P17, migrations 00030/00031): the added conjunct is a
-- same-row column comparison, and the existing sop_departments / sops_sub_trades
-- subqueries are untouched — those tables keep their `using (true)` SELECT
-- policies, which is why referencing them here is safe.

-- ── department visibility ───────────────────────────────────────────────────
drop policy if exists "sops_visible_by_department" on public.sops;

create policy "sops_visible_by_department"
  on public.sops for select to authenticated
  using (
    organisation_id = public.current_organisation_id()
    and (
      all_departments = true
      or not exists (
        select 1 from public.sop_departments sd where sd.sop_id = sops.id
      )
      or public.sop_in_user_departments(id)
    )
  );

-- ── sub-trade visibility ────────────────────────────────────────────────────
drop policy if exists "sops_visible_by_sub_trade" on public.sops;

create policy "sops_visible_by_sub_trade"
  on public.sops for select to authenticated
  using (
    organisation_id = public.current_organisation_id()
    and (
      not exists (
        select 1 from public.sops_sub_trades sst where sst.sop_id = sops.id
      )
      or public.sub_trade_id_intersects(id)
    )
  );

-- ── person-grant visibility ─────────────────────────────────────────────────
-- sop_in_user_person_grants() derives the caller from auth.uid() internally, so
-- this arm was not itself a cross-org hole. The org conjunct is added anyway:
-- a grant row pointing at a foreign SOP must not become a read path, and the
-- invariant "every SELECT arm on sops is org-scoped" is worth being able to
-- state without exceptions.
drop policy if exists "sops_visible_by_person_grant" on public.sops;

create policy "sops_visible_by_person_grant"
  on public.sops for select to authenticated
  using (
    organisation_id = public.current_organisation_id()
    and public.sop_in_user_person_grants(id)
  );
