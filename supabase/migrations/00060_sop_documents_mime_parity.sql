-- Phase 40 UAT gap closure (test 3) — the third accept list.
--
-- 00005 created the sop-documents bucket with allowed_mime_types covering the
-- four formats the app supported at the time (docx, pdf, jpeg, png), and no
-- migration has touched it since. Phase 5 then added xlsx/pptx/txt and Phase 40
-- added webp to the CODE accept lists — src/lib/upload/file-intake.ts's
-- ACCEPTED_MIME_TYPES and, via plan 40-10, the server-side uploadFileSchema
-- that now derives from it. The bucket was never brought along.
--
-- The result is the exact accept-then-fail class DUP-01 exists to close, one
-- layer lower than anyone looked: the upload page ADVERTISES all of these
-- formats (INTAKE_HINT, file-intake.ts:75), the client validator accepts them,
-- the server schema accepts them, and then storage rejects the object. The user
-- sees only UploadDropzone's generic "Upload failed".
--
-- This migration brings the bucket to parity with ACCEPTED_MIME_TYPES, with two
-- deliberate exclusions:
--
--   * video/mp4 + video/quicktime — video never reaches this bucket. Videos have
--     their audio extracted client-side and TUS-upload to sop-videos (which
--     carries no MIME restriction). Adding them here would grant write scope the
--     upload paths do not use.
--   * image/heic + image/heif — converted to JPEG client-side by
--     convertHeicToJpeg() before any upload begins; a HEIC whose conversion
--     fails is rejected by validateIntakeFile and never uploaded. The bytes that
--     reach storage are always image/jpeg.
--
-- Parity is enforced going forward by tests/phase40/bucket-mime-parity.spec.ts,
-- which reads BOTH this file and file-intake.ts and fails on any divergence.

update storage.buckets
set allowed_mime_types = array[
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', -- .docx
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',       -- .xlsx
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', -- .pptx
  'text/plain',                                                             -- .txt
  'image/jpeg',
  'image/png',
  'image/webp'
]
where id = 'sop-documents';
