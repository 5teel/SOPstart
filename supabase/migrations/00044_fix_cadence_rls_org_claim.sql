-- ============================================================
-- Migration: 00044_fix_cadence_rls_org_claim
-- Fixes RLS SELECT policies that used
--   auth.jwt()->'app_metadata'->>'organisation_id'
-- which does NOT match this project's JWT shape: the custom access-token hook
-- (00001_foundation_schema.sql) injects organisation_id at the TOP LEVEL of the
-- claims, read via public.current_organisation_id(). This is the exact mistake
-- 00015_fix_video_gen_rls.sql was written to fix.
--
--   * sop_review_cadences (00043): read via the SESSION client
--     (fetchOrgCadences, publish route) — the broken predicate meant
--     organisation_id = NULL, so authenticated reads returned ZERO rows and
--     every org silently fell back to the 12-month default cadence (HR-01).
--   * ai_model_settings (00042): only ever read/written via service-role
--     (bypasses RLS), so currently asymptomatic — fixed here to stop the
--     copy-paste predicate from spreading.
-- ============================================================

-- sop_review_cadences (HR-01)
drop policy if exists sop_review_cadences_read_org on public.sop_review_cadences;
create policy sop_review_cadences_read_org on public.sop_review_cadences
  for select to authenticated
  using (organisation_id = public.current_organisation_id());

-- ai_model_settings (same class, currently asymptomatic)
drop policy if exists ai_model_settings_read_org on public.ai_model_settings;
create policy ai_model_settings_read_org on public.ai_model_settings
  for select to authenticated
  using (organisation_id = public.current_organisation_id());
