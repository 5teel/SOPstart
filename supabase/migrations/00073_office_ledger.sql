-- Phase 59 (the Office): the ledger learns three governance changes.
--
-- From this phase a role change, an invitation and a removal are recorded as
-- decisions, so the kind check must accept role_change, member_invited and
-- member_removed alongside the fifteen kinds 00070 shipped. Nothing else
-- changes: no read policy is added or widened (the Decisions tab stays admin /
-- safety manager only) and no write policy is added (recordDecision() with the
-- service role remains the only writer).
--
-- The constraint was created inline in 00070 and carries the generated name
-- decisions_kind_check (confirmed against pg_constraint before applying).
--
-- Idempotent: drop constraint if exists, then add.

alter table public.decisions drop constraint if exists decisions_kind_check;

alter table public.decisions add constraint decisions_kind_check check (kind in (
  'approve', 'reject', 'sign_off', 'countersign', 'assign', 'unassign', 'publish',
  'owner_change', 'review', 'observation', 'verify', 'verify_withdrawn',
  'ai_finding_cleared', 'cadence_change', 'ai_field_write',
  'role_change', 'member_invited', 'member_removed'
));
