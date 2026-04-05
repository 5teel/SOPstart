-- ============================================================
-- Migration: 00014_video_bucket_size_limit
-- Raises the file size limit on sop-generated-videos bucket to 500MB.
-- Generated videos (narrated slideshow, screen-recording) can exceed
-- the default 50MB limit for SOPs with many sections or longer narration.
-- ============================================================

UPDATE storage.buckets
SET file_size_limit = 524288000  -- 500 MB
WHERE id = 'sop-generated-videos';
