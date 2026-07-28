-- ============================================================
-- Migration 00057: Restore the 00053 cross-org guard on
-- sop_observations_insert_recorder (Phase 37-06 fix-forward)
--
-- REGRESSION FOUND during 37-06's full-suite gate: migration 00056
-- (Phase 37-03) re-created sop_observations_insert_recorder to add the
-- is_assessor_override conjunct, but dropped the
-- sop_observation_refs_in_org(...) conjunct that migration 00053 added to
-- close a real cross-tenant write hole (T-34-03-01) — the exact write-hole
-- class flagged repeatedly in CLAUDE.md (2026-06-15, 2026-06-26 x2,
-- 2026-07-05, 2026-07-20). 00056's own post-apply assertion only checked
-- for `current_user_role` + `is_assessor_override` substrings in
-- with_check, so the silent drop of the org-ref guard went undetected
-- until tests/phase34/observation-cross-org-isolation.spec.ts red-flagged
-- it on this phase's full-suite gate.
--
-- Fix: re-create the policy carrying BOTH conjuncts — the 00053 org-ref
-- guard (sop_id/observed_worker_id must belong to organisation_id) AND
-- the 00056 override guard (a plain supervisor cannot self-stamp
-- is_assessor_override). Rule 1 auto-fix (CLAUDE.md deviation protocol).
-- ============================================================

drop policy if exists sop_observations_insert_recorder on public.sop_observations;
create policy sop_observations_insert_recorder on public.sop_observations
  for insert to authenticated
  with check (
    organisation_id = public.current_organisation_id()
    and public.current_user_role() in ('admin', 'safety_manager', 'supervisor')
    and observed_by = auth.uid()
    and public.sop_observation_refs_in_org(sop_id, observed_worker_id, organisation_id)
    and (not is_assessor_override or public.current_user_role() in ('admin', 'safety_manager'))
  );
