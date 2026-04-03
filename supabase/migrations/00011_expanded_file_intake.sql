-- ============================================================
-- Migration 00011: Expanded file intake
-- Extends parse_jobs.file_type and sops.source_file_type to
-- include xlsx, pptx, and txt file types.
-- Adds input_type column to parse_jobs for tracking submission method.
-- ============================================================

-- Extend file_type check constraint on parse_jobs to include new types
ALTER TABLE parse_jobs DROP CONSTRAINT IF EXISTS parse_jobs_file_type_check;
ALTER TABLE parse_jobs ADD CONSTRAINT parse_jobs_file_type_check
  CHECK (file_type IN ('docx', 'pdf', 'image', 'xlsx', 'pptx', 'txt'));

-- Add input_type column for tracking how the file was submitted
-- (single upload, multi-page scan, url, etc.)
ALTER TABLE parse_jobs ADD COLUMN IF NOT EXISTS input_type text
  DEFAULT 'upload'
  CHECK (input_type IN ('upload', 'scan', 'url'));

-- Extend source_file_type on sops table if constrained
ALTER TABLE sops DROP CONSTRAINT IF EXISTS sops_source_file_type_check;
ALTER TABLE sops ADD CONSTRAINT sops_source_file_type_check
  CHECK (source_file_type IN ('docx', 'pdf', 'image', 'xlsx', 'pptx', 'txt'));
