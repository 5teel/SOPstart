-- Phase 65 / ADR-0027: adding or removing a passkey writes a ledger row (ADR-0008).
-- The full 00082 kind list plus passkey_added and passkey_removed. The check only widens.
alter table public.decisions drop constraint if exists decisions_kind_check;

alter table public.decisions add constraint decisions_kind_check check (kind in (
  'approve', 'reject', 'sign_off', 'countersign', 'assign', 'unassign', 'publish',
  'owner_change', 'review', 'observation', 'verify', 'verify_withdrawn',
  'ai_finding_cleared', 'cadence_change', 'ai_field_write',
  'role_change', 'member_invited', 'member_removed',
  'request_accepted', 'request_declined', 'objective_set', 'objective_cleared', 'objective_confirmed',
  'supervisor_linked', 'supervisor_unlinked', 'department_change', 'access_change',
  'sop_created', 'sop_edited', 'sop_deleted', 'sop_version', 'standard_change',
  'site_change', 'settings_change',
  'member_suspended', 'member_left', 'member_reinstated',
  'passkey_added', 'passkey_removed'
));
