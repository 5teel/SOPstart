-- ============================================================
-- Migration 00012: Video transcription pipeline
-- Extends parse_jobs for video processing stages, transcript storage,
-- and verification flags. Creates sop-videos storage bucket.
-- Extends file_type and input_type constraints to include video types.
-- NOTE: This migration is idempotent with respect to 00011 — it uses
--       DROP CONSTRAINT IF EXISTS and ADD COLUMN IF NOT EXISTS so it
--       applies cleanly whether or not 00011 has been run.
-- ============================================================

-- 1. Extend file_type check on parse_jobs to include xlsx, pptx, txt, and video
--    (handles both phase-4-only and phase-5+ DBs by dropping any existing constraint)
ALTER TABLE parse_jobs DROP CONSTRAINT IF EXISTS parse_jobs_file_type_check;

-- Drop the inline check constraint from CREATE TABLE (named by Postgres as parse_jobs_file_type_check
-- in 00004 via inline CHECK syntax — already handled above; if it was named differently, catch below)
DO $$ BEGIN
  EXECUTE (
    SELECT 'ALTER TABLE parse_jobs DROP CONSTRAINT ' || conname
    FROM pg_constraint
    WHERE conrelid = 'parse_jobs'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%file_type%'
    LIMIT 1
  );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE parse_jobs ADD CONSTRAINT parse_jobs_file_type_check
  CHECK (file_type IN ('docx', 'pdf', 'image', 'xlsx', 'pptx', 'txt', 'video'));

-- 2. Add input_type column if not already present (added in 00011 — idempotent here)
ALTER TABLE parse_jobs ADD COLUMN IF NOT EXISTS input_type text DEFAULT 'upload';

-- Drop any existing input_type check constraint (from 00011 inline CHECK or named)
ALTER TABLE parse_jobs DROP CONSTRAINT IF EXISTS parse_jobs_input_type_check;
DO $$ BEGIN
  EXECUTE (
    SELECT 'ALTER TABLE parse_jobs DROP CONSTRAINT ' || conname
    FROM pg_constraint
    WHERE conrelid = 'parse_jobs'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%input_type%'
    LIMIT 1
  );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE parse_jobs ADD CONSTRAINT parse_jobs_input_type_check
  CHECK (input_type IN ('upload', 'scan', 'url', 'video_file', 'youtube_url'));

-- 3. Extend source_file_type on sops table to include xlsx, pptx, txt, and video
ALTER TABLE sops DROP CONSTRAINT IF EXISTS sops_source_file_type_check;
DO $$ BEGIN
  EXECUTE (
    SELECT 'ALTER TABLE sops DROP CONSTRAINT ' || conname
    FROM pg_constraint
    WHERE conrelid = 'sops'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%source_file_type%'
    LIMIT 1
  );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE sops ADD CONSTRAINT sops_source_file_type_check
  CHECK (source_file_type IN ('docx', 'pdf', 'image', 'xlsx', 'pptx', 'txt', 'video'));

-- 4. Add video-specific columns to parse_jobs
ALTER TABLE parse_jobs ADD COLUMN IF NOT EXISTS current_stage text DEFAULT NULL;
ALTER TABLE parse_jobs ADD COLUMN IF NOT EXISTS transcript_segments jsonb DEFAULT NULL;
ALTER TABLE parse_jobs ADD COLUMN IF NOT EXISTS transcript_text text DEFAULT NULL;
ALTER TABLE parse_jobs ADD COLUMN IF NOT EXISTS verification_flags jsonb DEFAULT NULL;
ALTER TABLE parse_jobs ADD COLUMN IF NOT EXISTS youtube_url text DEFAULT NULL;
ALTER TABLE parse_jobs ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 5. Create sop-videos storage bucket (public: false — access via presigned URLs)
INSERT INTO storage.buckets (id, name, public)
VALUES ('sop-videos', 'sop-videos', false)
ON CONFLICT (id) DO NOTHING;

-- 6. RLS policies for sop-videos bucket (same pattern as sop-documents)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Authenticated users can upload to sop-videos'
  ) THEN
    CREATE POLICY "Authenticated users can upload to sop-videos"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'sop-videos');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Authenticated users can read from sop-videos'
  ) THEN
    CREATE POLICY "Authenticated users can read from sop-videos"
      ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'sop-videos');
  END IF;
END $$;

-- 7. parse_jobs is already in supabase_realtime from migration 00004
--    The updated_at column additions will be automatically published.
