-- Phase 56 DEC-01 / DEC-03 / DEC-04: the decision ledger.
--
-- D-05: one physical table beside the existing decision tables, never replacing
--       them. Every writer also writes one ledger row through recordDecision()
--       (server-side, service role, organisation and actor from the session).
-- D-06 / A-03: the migration backfills one row per eligible row of SEVEN source
--       tables (the five named in D-06 plus completion_sign_offs and
--       sop_assignments, which hold the sign-off and assign decisions), flagged
--       source = 'backfill', and asserts the per-source counts.
-- D-07 / DEC-03: append-only for EVERY role. A row trigger refuses UPDATE and
--       DELETE, a statement trigger refuses TRUNCATE (row triggers never fire on
--       TRUNCATE), both set to always fire, and the three app roles lose the
--       three privileges. A correction is a new row pointing at the one it
--       corrects (supersedes_decision_id). Honest limit: the table owner can
--       still switch a trigger off on purpose; that is outside every app role.
-- DEC-04: an agent decision without a name is refused by a CHECK constraint.
-- A-04: the two orphan block-update RPCs (no caller in src/) lose EXECUTE for
--       every app role, so an admin cannot write a decision row around the
--       ledger through PostgREST.
-- A-08: no foreign key on this table carries a cascade or a set-null action --
--       row triggers fire on referential actions, so one would block SOP, user
--       and organisation deletion. Plain uuid columns carry organisation, actor,
--       subject and SOP. Only supersedes_decision_id references decisions(id)
--       (insert-only reference, no action clause).
--
-- No authenticated INSERT policy (planner decision, 56-03): an own-actor insert
-- policy would still let any org member put a decision the system never made
-- into the audit trail through PostgREST. RLS is one SELECT policy
-- (admin / safety_manager, org-scoped); the only insert path is the server
-- writer, which uses the service role.
--
-- No elevated-privilege function: the trigger function only raises.
--
-- Idempotent: create ... if not exists, drop trigger / policy if exists before
-- create, and the backfill runs only while the ledger holds no live rows, so a
-- Management-API re-run after go-live can never double-log a decision that
-- recordDecision() already wrote (plus unique (legacy_table, legacy_id)).

-- ============================================================
-- 1. decisions
-- ============================================================
create table if not exists public.decisions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  kind text not null check (kind in (
    'approve', 'reject', 'sign_off', 'countersign', 'assign', 'unassign', 'publish',
    'owner_change', 'review', 'observation', 'verify', 'verify_withdrawn',
    'ai_finding_cleared', 'cadence_change', 'ai_field_write'
  )),
  actor_kind text not null check (actor_kind in ('person', 'agent')),
  actor_id uuid,
  actor_name text,
  subject_kind text not null,
  subject_id uuid,
  sop_id uuid,
  summary text not null check (char_length(summary) between 1 and 200),
  details jsonb not null default '{}'::jsonb,
  source text not null default 'live' check (source in ('live', 'backfill')),
  legacy_table text,
  legacy_id uuid,
  supersedes_decision_id uuid references public.decisions(id),
  created_at timestamptz not null default now(),
  constraint decisions_agent_named check (
    actor_kind <> 'agent' or (actor_name is not null and btrim(actor_name) <> '')
  ),
  constraint decisions_person_has_id check (
    actor_kind <> 'person' or actor_id is not null or source = 'backfill'
  )
);

create index if not exists decisions_org_created_idx on public.decisions (organisation_id, created_at desc);
create index if not exists decisions_org_kind_created_idx on public.decisions (organisation_id, kind, created_at desc);
create index if not exists decisions_sop_id_idx on public.decisions (sop_id);
create unique index if not exists decisions_legacy_key
  on public.decisions (legacy_table, legacy_id) where legacy_id is not null;

-- ============================================================
-- 2. RLS -- one SELECT policy, no write policy of any kind
-- ============================================================
alter table public.decisions enable row level security;

drop policy if exists "admins_can_read_decisions" on public.decisions;
create policy "admins_can_read_decisions"
  on public.decisions for select to authenticated
  using (
    organisation_id = public.current_organisation_id()
    and public.current_user_role() in ('admin', 'safety_manager')
  );

-- ============================================================
-- 3. Immutability triggers (DEC-03)
-- ============================================================
create or replace function public.decisions_refuse_change() returns trigger
language plpgsql
as $$
begin
  raise exception 'decisions is append-only: % refused - record a new decision that supersedes it', tg_op
    using errcode = '23001';
end;
$$;

drop trigger if exists decisions_no_update_delete on public.decisions;
create trigger decisions_no_update_delete
  before update or delete on public.decisions
  for each row execute function public.decisions_refuse_change();

drop trigger if exists decisions_no_truncate on public.decisions;
create trigger decisions_no_truncate
  before truncate on public.decisions
  for each statement execute function public.decisions_refuse_change();

alter table public.decisions enable always trigger decisions_no_update_delete;
alter table public.decisions enable always trigger decisions_no_truncate;

-- ============================================================
-- 4. Grants -- service_role keeps SELECT and INSERT (the server writer)
-- ============================================================
revoke all on public.decisions from anon;
revoke insert, update, delete, truncate on public.decisions from authenticated;
revoke update, delete, truncate on public.decisions from service_role;

-- ============================================================
-- 5. Orphan RPC lockdown (A-04)
-- ============================================================
revoke execute on function public.accept_block_update(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.decline_block_update(uuid, uuid, text) from public, anon, authenticated;

-- ============================================================
-- 6. Backfill (D-06, A-03) -- only while the ledger holds no live rows
-- ============================================================
do $$
declare
  v_src bigint;
  v_got bigint;
begin
  if exists (select 1 from public.decisions where source = 'live') then
    raise notice 'decisions backfill skipped: live rows already present';
    return;
  end if;

  -- sop_approvals
  insert into public.decisions (
    organisation_id, kind, actor_kind, actor_id, actor_name, subject_kind, subject_id,
    sop_id, summary, details, source, legacy_table, legacy_id, created_at
  )
  select
    a.organisation_id,
    case when a.action = 'approved' then 'approve' else 'reject' end,
    'person', a.approver_user_id,
    (select u.email::text from auth.users u where u.id = a.approver_user_id),
    'sop', a.sop_id, a.sop_id,
    case when a.action = 'approved'
      then format('Approved approval step %s (version %s)', a.step_index + 1, a.version)
      else format('Sent back at approval step %s (version %s)', a.step_index + 1, a.version)
    end,
    jsonb_build_object('version', a.version, 'step_index', a.step_index, 'action', a.action, 'comment', a.comment),
    'backfill', 'sop_approvals', a.id, a.created_at
  from public.sop_approvals a
  on conflict (legacy_table, legacy_id) where legacy_id is not null do nothing;

  -- sop_completion_signatures (no sop_id of its own: left join the completion)
  insert into public.decisions (
    organisation_id, kind, actor_kind, actor_id, actor_name, subject_kind, subject_id,
    sop_id, summary, details, source, legacy_table, legacy_id, created_at
  )
  select
    cs.organisation_id,
    case when cs.role = 'supervisor' then 'countersign' else 'sign_off' end,
    'person', cs.roster_user_id,
    (select u.email::text from auth.users u where u.id = cs.roster_user_id),
    'completion', cs.completion_id, c.sop_id,
    format('Completion signed (%s)', cs.role),
    jsonb_build_object('role', cs.role),
    'backfill', 'sop_completion_signatures', cs.id, cs.signed_at
  from public.sop_completion_signatures cs
  left join public.sop_completions c on c.id = cs.completion_id
  on conflict (legacy_table, legacy_id) where legacy_id is not null do nothing;

  -- sop_observations
  insert into public.decisions (
    organisation_id, kind, actor_kind, actor_id, actor_name, subject_kind, subject_id,
    sop_id, summary, details, source, legacy_table, legacy_id, created_at
  )
  select
    o.organisation_id, 'observation', 'person', o.observed_by,
    (select u.email::text from auth.users u where u.id = o.observed_by),
    'worker', o.observed_worker_id, o.sop_id,
    format('Observation recorded: %s', replace(o.verdict, '_', ' ')),
    jsonb_build_object(
      'verdict', o.verdict, 'sop_version', o.sop_version, 'completion_id', o.completion_id,
      'note', o.note, 'is_assessor_override', o.is_assessor_override,
      'override_reason', o.override_reason
    ),
    'backfill', 'sop_observations', o.id, o.created_at
  from public.sop_observations o
  on conflict (legacy_table, legacy_id) where legacy_id is not null do nothing;

  -- sop_review_events
  insert into public.decisions (
    organisation_id, kind, actor_kind, actor_id, actor_name, subject_kind, subject_id,
    sop_id, summary, details, source, legacy_table, legacy_id, created_at
  )
  select
    r.organisation_id, 'review', 'person', r.reviewed_by,
    (select u.email::text from auth.users u where u.id = r.reviewed_by),
    'sop', r.sop_id, r.sop_id,
    case when r.action = 'confirmed_current'
      then 'Confirmed the SOP is still current'
      else 'Marked the SOP as superseded'
    end,
    jsonb_build_object('action', r.action),
    'backfill', 'sop_review_events', r.id, r.created_at
  from public.sop_review_events r
  on conflict (legacy_table, legacy_id) where legacy_id is not null do nothing;

  -- sop_block_update_decisions (no org column: derive through junction -> section -> sop)
  insert into public.decisions (
    organisation_id, kind, actor_kind, actor_id, actor_name, subject_kind, subject_id,
    sop_id, summary, details, source, legacy_table, legacy_id, created_at
  )
  select
    s.organisation_id,
    case when d.decision = 'accept' then 'approve' else 'reject' end,
    'person', d.decided_by,
    (select u.email::text from auth.users u where u.id = d.decided_by),
    'section_block', d.sop_section_block_id, s.id,
    case when d.decision = 'accept'
      then 'Accepted an update to a section'
      else 'Declined an update to a section'
    end,
    jsonb_build_object('decision', d.decision, 'block_version_id', d.block_version_id, 'note', d.note),
    'backfill', 'sop_block_update_decisions', d.id, d.decided_at
  from public.sop_block_update_decisions d
  join public.sop_section_blocks ssb on ssb.id = d.sop_section_block_id
  join public.sop_sections sec on sec.id = ssb.sop_section_id
  join public.sops s on s.id = sec.sop_id
  on conflict (legacy_table, legacy_id) where legacy_id is not null do nothing;

  -- completion_sign_offs (no sop_id of its own: left join the completion)
  insert into public.decisions (
    organisation_id, kind, actor_kind, actor_id, actor_name, subject_kind, subject_id,
    sop_id, summary, details, source, legacy_table, legacy_id, created_at
  )
  select
    so.organisation_id,
    case when so.decision = 'approved' then 'sign_off' else 'reject' end,
    'person', so.supervisor_id,
    (select u.email::text from auth.users u where u.id = so.supervisor_id),
    'completion', so.completion_id, c.sop_id,
    case when so.decision = 'approved' then 'Signed off a completion' else 'Rejected a completion' end,
    jsonb_build_object(
      'decision', so.decision, 'reason', so.reason,
      'is_assessor_override', so.is_assessor_override, 'override_reason', so.override_reason
    ),
    'backfill', 'completion_sign_offs', so.id, so.created_at
  from public.completion_sign_offs so
  left join public.sop_completions c on c.id = so.completion_id
  on conflict (legacy_table, legacy_id) where legacy_id is not null do nothing;

  -- sop_assignments, excluding self-adds (a worker bookmarking a SOP is not a
  -- governance decision; the live path allowlists selfAddSop the same way)
  insert into public.decisions (
    organisation_id, kind, actor_kind, actor_id, actor_name, subject_kind, subject_id,
    sop_id, summary, details, source, legacy_table, legacy_id, created_at
  )
  select
    sa.organisation_id, 'assign', 'person', sa.assigned_by,
    (select u.email::text from auth.users u where u.id = sa.assigned_by),
    'assignment', sa.id, sa.sop_id,
    format('Assigned a SOP to %s',
      case when sa.assignment_type::text = 'role' then 'the ' || sa.role::text || ' role' else 'a person' end),
    jsonb_build_object(
      'assignment_type', sa.assignment_type::text, 'role', sa.role::text, 'user_id', sa.user_id
    ),
    'backfill', 'sop_assignments', sa.id, sa.created_at
  from public.sop_assignments sa
  where not (sa.assignment_type::text = 'individual' and sa.user_id = sa.assigned_by)
  on conflict (legacy_table, legacy_id) where legacy_id is not null do nothing;

  -- Per-source count assertions: the ledger must hold exactly one row per
  -- eligible source row.
  select count(*) into v_src from public.sop_approvals;
  select count(*) into v_got from public.decisions where legacy_table = 'sop_approvals';
  if v_src <> v_got then
    raise exception 'decisions backfill count mismatch for sop_approvals: source %, ledger %', v_src, v_got;
  end if;

  select count(*) into v_src from public.sop_completion_signatures;
  select count(*) into v_got from public.decisions where legacy_table = 'sop_completion_signatures';
  if v_src <> v_got then
    raise exception 'decisions backfill count mismatch for sop_completion_signatures: source %, ledger %', v_src, v_got;
  end if;

  select count(*) into v_src from public.sop_observations;
  select count(*) into v_got from public.decisions where legacy_table = 'sop_observations';
  if v_src <> v_got then
    raise exception 'decisions backfill count mismatch for sop_observations: source %, ledger %', v_src, v_got;
  end if;

  select count(*) into v_src from public.sop_review_events;
  select count(*) into v_got from public.decisions where legacy_table = 'sop_review_events';
  if v_src <> v_got then
    raise exception 'decisions backfill count mismatch for sop_review_events: source %, ledger %', v_src, v_got;
  end if;

  select count(*) into v_src
  from public.sop_block_update_decisions d
  join public.sop_section_blocks ssb on ssb.id = d.sop_section_block_id
  join public.sop_sections sec on sec.id = ssb.sop_section_id
  join public.sops s on s.id = sec.sop_id;
  select count(*) into v_got from public.decisions where legacy_table = 'sop_block_update_decisions';
  if v_src <> v_got then
    raise exception 'decisions backfill count mismatch for sop_block_update_decisions: source %, ledger %', v_src, v_got;
  end if;

  select count(*) into v_src from public.completion_sign_offs;
  select count(*) into v_got from public.decisions where legacy_table = 'completion_sign_offs';
  if v_src <> v_got then
    raise exception 'decisions backfill count mismatch for completion_sign_offs: source %, ledger %', v_src, v_got;
  end if;

  select count(*) into v_src
  from public.sop_assignments sa
  where not (sa.assignment_type::text = 'individual' and sa.user_id = sa.assigned_by);
  select count(*) into v_got from public.decisions where legacy_table = 'sop_assignments';
  if v_src <> v_got then
    raise exception 'decisions backfill count mismatch for sop_assignments: source %, ledger %', v_src, v_got;
  end if;
end;
$$;
