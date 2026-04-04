-- ============================================================
-- Migration 00013: Video SOP generation pipeline
-- Creates video_generation_jobs table with FSM status enum,
-- extends sop_completions with completion_type discriminator,
-- creates sop-generated-videos Storage bucket with org-scoped RLS.
-- ============================================================

-- 1. Create video_gen_status enum
DO $$ BEGIN
  CREATE TYPE public.video_gen_status AS ENUM (
    'queued',
    'analyzing',
    'generating_audio',
    'rendering',
    'ready',
    'failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Create video_format enum
DO $$ BEGIN
  CREATE TYPE public.video_format AS ENUM (
    'narrated_slideshow',
    'screen_recording'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. Create video_generation_jobs table
CREATE TABLE IF NOT EXISTS public.video_generation_jobs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id     uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  sop_id              uuid NOT NULL REFERENCES sops(id) ON DELETE CASCADE,
  sop_version         int NOT NULL,
  format              public.video_format NOT NULL,
  status              public.video_gen_status NOT NULL DEFAULT 'queued',
  current_stage       text DEFAULT NULL,
  shotstack_render_id text DEFAULT NULL,
  video_url           text DEFAULT NULL,
  -- Array of {sectionId, title, timestamp} chapter markers for video navigation
  chapter_markers     jsonb DEFAULT NULL,
  error_message       text DEFAULT NULL,
  published           boolean NOT NULL DEFAULT false,
  created_by          uuid NOT NULL REFERENCES auth.users(id),
  completed_at        timestamptz DEFAULT NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  -- Idempotency constraint per D-14: one job per SOP + format + version
  CONSTRAINT video_generation_jobs_sop_format_version_unique UNIQUE (sop_id, format, sop_version)
);

-- 4. RLS on video_generation_jobs
ALTER TABLE public.video_generation_jobs ENABLE ROW LEVEL SECURITY;

-- SELECT: org members can read their org's jobs
CREATE POLICY "org members can read video generation jobs"
  ON public.video_generation_jobs
  FOR SELECT
  TO authenticated
  USING (organisation_id = (auth.jwt()->'app_metadata'->>'organisation_id')::uuid);

-- INSERT: admin/safety_manager roles only
CREATE POLICY "admins can insert video generation jobs"
  ON public.video_generation_jobs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organisation_id = (auth.jwt()->'app_metadata'->>'organisation_id')::uuid
    AND (
      (auth.jwt()->'app_metadata'->>'role')::text IN ('admin', 'safety_manager')
    )
  );

-- UPDATE: admin/safety_manager roles only (status updates from API routes use admin client)
CREATE POLICY "admins can update video generation jobs"
  ON public.video_generation_jobs
  FOR UPDATE
  TO authenticated
  USING (
    organisation_id = (auth.jwt()->'app_metadata'->>'organisation_id')::uuid
    AND (
      (auth.jwt()->'app_metadata'->>'role')::text IN ('admin', 'safety_manager')
    )
  );

-- No DELETE policy — jobs are permanent records

-- 5. Enable Realtime on video_generation_jobs for live status updates in admin UI
ALTER PUBLICATION supabase_realtime ADD TABLE public.video_generation_jobs;

-- 6. Extend sop_completions with completion_type discriminator (per D-15 / Pitfall 4)
ALTER TABLE public.sop_completions
  ADD COLUMN IF NOT EXISTS completion_type text NOT NULL DEFAULT 'walkthrough'
    CHECK (completion_type IN ('walkthrough', 'video_view'));

ALTER TABLE public.sop_completions
  ADD COLUMN IF NOT EXISTS video_job_id uuid REFERENCES public.video_generation_jobs(id);

-- 7. Create sop-generated-videos Storage bucket (private — presigned URLs required)
INSERT INTO storage.buckets (id, name, public)
VALUES ('sop-generated-videos', 'sop-generated-videos', false)
ON CONFLICT (id) DO NOTHING;

-- 8. Storage RLS for sop-generated-videos bucket
-- SELECT: org members can read videos stored under their org path
--   Storage path structure: {org_id}/{video_job_id}/{filename}
CREATE POLICY "org members can read generated videos"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'sop-generated-videos'
    AND (storage.foldername(name))[1] = (auth.jwt()->'app_metadata'->>'organisation_id')
  );

-- INSERT/UPDATE: admin client only (service role bypasses RLS — no direct user upload policy)
-- No INSERT/UPDATE policies for authenticated role; use supabase admin client in API routes
