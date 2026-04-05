-- ============================================================
-- Migration 00016: SOP pipeline runs (D-06)
-- Links upload -> parse_job -> sop -> video_generation_job with
-- a single pipeline_run_id so the progress page can render one
-- unified stepper. Reuses public.current_organisation_id() RLS.
-- ============================================================

-- 1. Create sop_pipeline_runs table
CREATE TABLE IF NOT EXISTS public.sop_pipeline_runs (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id         uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  requested_video_format  public.video_format NOT NULL,
  status                  text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','completed','failed','cancelled')),
  created_by              uuid NOT NULL REFERENCES auth.users(id),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sop_pipeline_runs_org
  ON public.sop_pipeline_runs (organisation_id, created_at DESC);

-- 2. Add pipeline_run_id FK to parse_jobs, sops, video_generation_jobs
ALTER TABLE public.parse_jobs
  ADD COLUMN IF NOT EXISTS pipeline_run_id uuid
    REFERENCES public.sop_pipeline_runs(id) ON DELETE SET NULL;

ALTER TABLE public.sops
  ADD COLUMN IF NOT EXISTS pipeline_run_id uuid
    REFERENCES public.sop_pipeline_runs(id) ON DELETE SET NULL;

ALTER TABLE public.video_generation_jobs
  ADD COLUMN IF NOT EXISTS pipeline_run_id uuid
    REFERENCES public.sop_pipeline_runs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_parse_jobs_pipeline_run
  ON public.parse_jobs (pipeline_run_id) WHERE pipeline_run_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sops_pipeline_run
  ON public.sops (pipeline_run_id) WHERE pipeline_run_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_video_gen_jobs_pipeline_run
  ON public.video_generation_jobs (pipeline_run_id) WHERE pipeline_run_id IS NOT NULL;

-- 3. RLS on sop_pipeline_runs (matches public.current_organisation_id() pattern
--    from migration 00015_fix_video_gen_rls.sql)
ALTER TABLE public.sop_pipeline_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can read pipeline runs"
  ON public.sop_pipeline_runs
  FOR SELECT
  TO authenticated
  USING (organisation_id = public.current_organisation_id());

CREATE POLICY "org members can insert pipeline runs"
  ON public.sop_pipeline_runs
  FOR INSERT
  TO authenticated
  WITH CHECK (organisation_id = public.current_organisation_id());

CREATE POLICY "org members can update pipeline runs"
  ON public.sop_pipeline_runs
  FOR UPDATE
  TO authenticated
  USING (organisation_id = public.current_organisation_id());

-- No DELETE policy — pipeline runs are append-only audit trail

-- 4. Enable Realtime for progress page subscription
ALTER PUBLICATION supabase_realtime ADD TABLE public.sop_pipeline_runs;
