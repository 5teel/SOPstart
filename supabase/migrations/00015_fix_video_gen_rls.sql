-- ============================================================
-- Migration: 00015_fix_video_gen_rls
-- Fixes RLS policies on video_generation_jobs — migration 00013 used
-- auth.jwt()->'app_metadata'->>'organisation_id' which doesn't match the
-- project's JWT shape (claims are at the top level via custom auth hook).
-- All other tables use public.current_organisation_id() — this migration
-- rewrites the video_generation_jobs policies to match that pattern.
-- ============================================================

-- Drop the broken policies
DROP POLICY IF EXISTS "org members can read video generation jobs" ON public.video_generation_jobs;
DROP POLICY IF EXISTS "admins can insert video generation jobs" ON public.video_generation_jobs;
DROP POLICY IF EXISTS "admins can update video generation jobs" ON public.video_generation_jobs;

-- Recreate using the project's standard helper
CREATE POLICY "org members can read video generation jobs"
  ON public.video_generation_jobs
  FOR SELECT
  TO authenticated
  USING (organisation_id = public.current_organisation_id());

CREATE POLICY "admins can insert video generation jobs"
  ON public.video_generation_jobs
  FOR INSERT
  TO authenticated
  WITH CHECK (organisation_id = public.current_organisation_id());

CREATE POLICY "admins can update video generation jobs"
  ON public.video_generation_jobs
  FOR UPDATE
  TO authenticated
  USING (organisation_id = public.current_organisation_id());
