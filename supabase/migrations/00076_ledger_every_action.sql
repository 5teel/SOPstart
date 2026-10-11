-- ADR-0008: every action a person takes is written to the decision ledger.
-- Widens the kind check with the kinds for the actions that were not logged
-- (supervisor links, departments, SOP access, SOP authoring, standards, the site
-- map and settings). No table, policy or function changes. Idempotent.
alter table public.decisions drop constraint if exists decisions_kind_check;

alter table public.decisions add constraint decisions_kind_check check (kind in (
  'approve', 'reject', 'sign_off', 'countersign', 'assign', 'unassign', 'publish',
  'owner_change', 'review', 'observation', 'verify', 'verify_withdrawn',
  'ai_finding_cleared', 'cadence_change', 'ai_field_write',
  'role_change', 'member_invited', 'member_removed',
  'request_accepted', 'request_declined', 'objective_set', 'objective_cleared', 'objective_confirmed',
  'supervisor_linked', 'supervisor_unlinked', 'department_change', 'access_change',
  'sop_created', 'sop_edited', 'sop_deleted', 'sop_version', 'standard_change',
  'site_change', 'settings_change'
));
