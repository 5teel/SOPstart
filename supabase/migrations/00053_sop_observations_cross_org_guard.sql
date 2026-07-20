-- ============================================================
-- Migration 00053: sop_observations cross-org write guard (T-34-03-01)
--
-- Rule-1/2 fix found by the live 34-03 SC-4 runtime probe: the original
-- 00052 INSERT policy checked `organisation_id = current_organisation_id()`
-- but never verified sop_id / observed_worker_id actually BELONG to that
-- organisation. Empirically, an authenticated org-B supervisor could
-- insert a row with organisation_id = orgB (their own, valid JWT claim)
-- while sop_id / observed_worker_id referenced org-A entities — a real
-- cross-tenant write (and, via the OBS-02 self-read branch, a minor
-- disclosure to the org-A worker that an unaffiliated org recorded an
-- observation naming them). This is the exact write-hole class flagged
-- 4+ times in CLAUDE.md Learnings (2026-06-15, 2026-06-26 x2, 2026-07-05).
--
-- Fix: SECURITY DEFINER helper (bypasses RLS on sops/organisation_members
-- so the check itself doesn't depend on the caller's own read visibility)
-- confirming both FKs resolve inside the org being inserted into.
-- ============================================================

create or replace function public.sop_observation_refs_in_org(p_sop_id uuid, p_worker_id uuid, p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (select 1 from public.sops s where s.id = p_sop_id and s.organisation_id = p_org_id)
    and exists (select 1 from public.organisation_members m where m.user_id = p_worker_id and m.organisation_id = p_org_id)
$$;

drop policy if exists sop_observations_insert_recorder on public.sop_observations;
create policy sop_observations_insert_recorder on public.sop_observations
  for insert to authenticated
  with check (
    organisation_id = public.current_organisation_id()
    and public.current_user_role() in ('admin', 'safety_manager', 'supervisor')
    and observed_by = auth.uid()
    and public.sop_observation_refs_in_org(sop_id, observed_worker_id, organisation_id)
  );
