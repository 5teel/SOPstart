-- ============================================================
-- Migration 00018: Video version management
-- Drops single-version UNIQUE constraint, adds version_number,
-- label, archived columns, adds partial unique index for
-- one-published-per-SOP enforcement (D-03).
-- ============================================================

-- 1. Drop the old idempotency constraint (D-01)
ALTER TABLE public.video_generation_jobs
  DROP CONSTRAINT IF EXISTS video_generation_jobs_sop_format_version_unique;

-- 2. Add new columns for version management
ALTER TABLE public.video_generation_jobs
  ADD COLUMN IF NOT EXISTS version_number int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS label text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

-- 3. Backfill version_number for existing rows (assign 1 to all existing)
UPDATE public.video_generation_jobs
  SET version_number = 1
  WHERE version_number = 0;

-- 4. Partial unique index: enforce one published version per SOP (D-03)
-- Covers all formats — only one video can be published per SOP at a time
CREATE UNIQUE INDEX IF NOT EXISTS video_generation_jobs_one_published_per_sop
  ON public.video_generation_jobs (sop_id)
  WHERE published = true;

-- 5. Label length check constraint (60 chars max)
ALTER TABLE public.video_generation_jobs
  ADD CONSTRAINT video_generation_jobs_label_length
  CHECK (label IS NULL OR char_length(label) <= 60);
