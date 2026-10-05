-- Phase 60 (requests, notifications, objectives): three of the eight data types.
--
-- requests      -- a person or an agent asks for something (change a SOP, write a
--                  new one, observe me, do a SOP). D-01.
-- notifications -- one row per person per thing that needs them; replaces the
--                  unused worker_notifications table. D-07. That old table is NOT
--                  copied (A-02): the new one starts empty and the old one is
--                  left exactly as it is.
-- objectives    -- one statement of intent per site, department, machine, SOP or
--                  person. D-10. Each SOP's existing objective text is copied once
--                  (A-01) onto a row keyed on the SOP's lineage root; the old
--                  column stays but is no longer the source.
--
-- Ledger: the kind check also accepts request_accepted, request_declined,
-- objective_set, objective_cleared and objective_confirmed beside the eighteen
-- earlier kinds. Nothing else about the ledger changes.
--
-- Subjects are polymorphic, so no table here carries a foreign key to the SOP
-- table (A-10); the delete path clears these rows itself. A person's id on a
-- request or objective is a plain uuid with no foreign key, so removing a user
-- can never break the one-raiser or one-setter checks.
--
-- Writes are service-role only. Every table has row security on and a SELECT
-- policy; there is no INSERT or DELETE policy anywhere, and no UPDATE policy on
-- requests or objectives. The single authenticated write is a person marking
-- their own notification read, held to that one column by a column grant.
--
-- Request answered shape: an open row has no decided_at; an accepted or declined
-- row has one; a withdrawn row may carry its withdrawal time.
--
-- No elevated-privilege function, no table dropped. Idempotent throughout.

-- ============================================================
-- 1. Ledger kinds
-- ============================================================
alter table public.decisions drop constraint if exists decisions_kind_check;

alter table public.decisions add constraint decisions_kind_check check (kind in (
  'approve', 'reject', 'sign_off', 'countersign', 'assign', 'unassign', 'publish',
  'owner_change', 'review', 'observation', 'verify', 'verify_withdrawn',
  'ai_finding_cleared', 'cadence_change', 'ai_field_write',
  'role_change', 'member_invited', 'member_removed',
  'request_accepted', 'request_declined', 'objective_set', 'objective_cleared', 'objective_confirmed'
));

-- ============================================================
-- 2. requests
-- ============================================================
create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  kind text not null check (kind in ('change_sop', 'new_sop', 'observe_me', 'do_sop')),
  state text not null default 'open' check (state in ('open', 'accepted', 'declined', 'withdrawn')),
  raised_by_user uuid,
  raised_by_agent text,
  subject_type text not null check (subject_type in ('sop', 'machine', 'site')),
  subject_id uuid,
  target_role text check (target_role in ('worker', 'supervisor', 'admin', 'safety_manager')),
  target_user_id uuid,
  note text check (note is null or char_length(note) <= 500),
  answered_by uuid,
  answer_note text check (answer_note is null or char_length(answer_note) <= 500),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  constraint requests_one_raiser check ((raised_by_user is null) <> (raised_by_agent is null)),
  constraint requests_agent_named check (raised_by_agent is null or btrim(raised_by_agent) <> ''),
  constraint requests_subject_shape check ((subject_type = 'site') = (subject_id is null)),
  constraint requests_target_shape check (
    (kind = 'do_sop' and ((target_role is null) <> (target_user_id is null)))
    or (kind <> 'do_sop' and target_role is null and target_user_id is null)
  ),
  constraint requests_answered_shape check (
    (state = 'open' and decided_at is null)
    or (state in ('accepted', 'declined') and decided_at is not null)
    or state = 'withdrawn'
  )
);

-- an agent never has two open new_sop asks for the same machine
create unique index if not exists requests_one_open_agent_new_sop
  on public.requests (organisation_id, subject_id)
  where kind = 'new_sop' and state = 'open' and raised_by_agent is not null;
create index if not exists requests_org_state_idx
  on public.requests (organisation_id, state, created_at desc);
create index if not exists requests_raiser_idx
  on public.requests (raised_by_user, created_at desc);
create index if not exists requests_target_idx
  on public.requests (target_user_id, created_at desc);

alter table public.requests enable row level security;

drop policy if exists "requests_read" on public.requests;
create policy "requests_read" on public.requests for select to authenticated
  using (
    organisation_id = public.current_organisation_id()
    and (
      raised_by_user = auth.uid()
      or target_user_id = auth.uid()
      or answered_by = auth.uid()
      or (target_role is not null and target_role = public.current_user_role()::text)
      or (state = 'open' and public.current_user_role() in ('admin', 'safety_manager', 'supervisor'))
    )
  );

-- ============================================================
-- 3. notifications
-- ============================================================
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('approve_next', 'review_due', 'signoff', 'request_answered', 'new_version', 'asked')),
  title text not null check (char_length(title) between 1 and 200),
  place text not null check (place like '/%' and place not like '//%' and char_length(place) <= 300),
  subject_type text not null,
  subject_id uuid not null,
  decision_id uuid,
  dedupe_key text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_user_dedupe_key unique (user_id, dedupe_key)
);

create index if not exists notifications_unread_idx
  on public.notifications (user_id, created_at desc) where read_at is null;

alter table public.notifications enable row level security;

drop policy if exists "notifications_read_own" on public.notifications;
create policy "notifications_read_own" on public.notifications for select to authenticated
  using (user_id = auth.uid() and organisation_id = public.current_organisation_id());

drop policy if exists "notifications_mark_own_read" on public.notifications;
create policy "notifications_mark_own_read" on public.notifications for update to authenticated
  using (user_id = auth.uid() and organisation_id = public.current_organisation_id())
  with check (user_id = auth.uid() and organisation_id = public.current_organisation_id());

-- title and place can never be rewritten from a session: only read_at is writable
revoke update on public.notifications from authenticated, anon;
grant update (read_at) on public.notifications to authenticated;

-- ============================================================
-- 4. objectives
-- ============================================================
create table if not exists public.objectives (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  subject_type text not null check (subject_type in ('site', 'department', 'machine', 'sop', 'person')),
  subject_id uuid,
  text text not null check (char_length(btrim(text)) between 1 and 200),
  due_on date,
  set_by_user uuid,
  set_by_agent text,
  set_at timestamptz not null default now(),
  confirmed_by uuid,
  confirmed_at timestamptz,
  constraint objectives_one_setter check ((set_by_user is null) <> (set_by_agent is null)),
  constraint objectives_site_no_subject check ((subject_type = 'site') = (subject_id is null)),
  constraint objectives_confirm_pair check ((confirmed_by is null) = (confirmed_at is null)),
  constraint objectives_one_per_subject unique nulls not distinct (organisation_id, subject_type, subject_id)
);

alter table public.objectives enable row level security;

drop policy if exists "objectives_read_org" on public.objectives;
create policy "objectives_read_org" on public.objectives for select to authenticated
  using (organisation_id = public.current_organisation_id());

-- ============================================================
-- 5. A-01 data step: each SOP's objective text, once, on its lineage root
-- ============================================================
insert into public.objectives (organisation_id, subject_type, subject_id, text, set_by_user, set_at)
select src.organisation_id, 'sop', src.root_id, left(btrim(src.objective), 200), src.setter, now()
from (
  select distinct on (coalesce(s.parent_sop_id, s.id))
    s.organisation_id,
    coalesce(s.parent_sop_id, s.id) as root_id,
    s.objective,
    coalesce(
      s.owner_user_id,
      (select m.user_id from public.organisation_members m
        where m.organisation_id = s.organisation_id and m.role = 'admin'
        order by m.created_at limit 1)
    ) as setter
  from public.sops s
  where s.objective is not null and btrim(s.objective) <> ''
  order by coalesce(s.parent_sop_id, s.id), s.version desc
) src
where src.setter is not null
on conflict do nothing;
