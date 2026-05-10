-- ============================================================
-- Migration 00029: Phase 14 AI-drafted SOPs — input_type extension + prompt_text audit column
-- Extends parse_jobs.input_type CHECK to permit 'ai_prompt' (added in Phase 14).
-- Adds parse_jobs.prompt_text TEXT NULL for audit trail (D-04 — mirrors transcript_text).
-- Pure-additive migration: no DROP TABLE, no DROP COLUMN, no destructive changes.
-- ============================================================

-- 1. Drop the existing input_type CHECK from 00012 (named or inline)
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

-- 2. Re-add input_type CHECK with the extended value list (now includes 'ai_prompt')
ALTER TABLE parse_jobs ADD CONSTRAINT parse_jobs_input_type_check
  CHECK (input_type IN ('upload', 'scan', 'url', 'video_file', 'youtube_url', 'ai_prompt'));

-- 3. Add prompt_text column (D-04 audit trail)
-- D-04: persist the original NL prompt for audit trail and future "regenerate from same prompt" affordance.
-- Mirrors the existing transcript_text column pattern from 00012.
ALTER TABLE parse_jobs ADD COLUMN IF NOT EXISTS prompt_text text DEFAULT NULL;
COMMENT ON COLUMN parse_jobs.prompt_text IS 'Phase 14: original natural-language prompt entered by admin when input_type = ai_prompt. NULL for all other input types.';
