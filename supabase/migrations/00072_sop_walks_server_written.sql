-- Phase 58 review CR-01: sop_walks is written only by the server.
--
-- 00071 gave authenticated users an INSERT and an UPDATE policy on their own
-- walk rows. Those policies constrained organisation_id, worker_id and sop_id,
-- but every other column (acks, done, photos, current_step_id, sop_version,
-- status) was writable by the row's own worker straight through PostgREST, so
-- the server gate in src/actions/walk.ts (step order, photo-required, ack only
-- on hazard/PPE steps) and the submit validation could be bypassed by forging
-- the row.
--
-- The walk actions already filter every read and write by the session
-- organisation and worker; from here they write with the service role. The
-- SELECT policy stays so the focus page and getPhotoUploadUrl can read the
-- worker's own row with the session client.
--
-- Dropping a table's only policy for a command is a full deny for that command
-- (CLAUDE.md 2026-09-30) -- here that is the intent. No delete policy existed.
--
-- Idempotent: drop policy if exists.

drop policy if exists "workers_can_start_own_sop_walks" on public.sop_walks;
drop policy if exists "workers_can_update_own_sop_walks" on public.sop_walks;
