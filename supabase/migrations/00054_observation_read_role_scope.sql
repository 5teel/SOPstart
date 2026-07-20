-- ============================================================
-- Migration 00054: sop_observations read role-scope (CR-01, Gap 1)
--
-- The 00052 sop_observations_read_org policy's org-wide branch had NO
-- role check: `organisation_id = current_organisation_id() OR
-- observed_worker_id = auth.uid()` let ANY same-org authenticated user
-- (including a plain worker) read EVERY observation in the org via
-- PostgREST -- peers' needs_support verdicts and supervisors' free-text
-- coaching notes. Found by 34-VERIFICATION.md / 34-REVIEW.md CR-01, and
-- is the exact org-wide-branch-without-role-check class logged in
-- CLAUDE.md 2026-07-20.
--
-- Fix: mirror the sop_completions (00010) role-scoped SELECT pattern --
-- the org-wide branch is role-checked to recorder roles, the self-read
-- branch (OBS-02) is untouched.
-- ============================================================

drop policy if exists sop_observations_read_org on public.sop_observations;
create policy sop_observations_read_org on public.sop_observations
  for select to authenticated
  using (
    (
      organisation_id = public.current_organisation_id()
      and public.current_user_role() in ('admin', 'safety_manager', 'supervisor')
    )
    or observed_worker_id = auth.uid()  -- OBS-02: worker self-read, own rows only (unchanged)
  );
