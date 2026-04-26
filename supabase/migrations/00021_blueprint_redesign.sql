-- ============================================================
-- Migration 00021: Phase 12.5 Blueprint Redesign (additive)
-- Adds:
--   1. sop_voice_notes        — per-utterance voice note rows (D-06)
--   2. escalation_reports     — EscalateBlock form/lock/alert log (D-05)
--   3. walkthrough_progress   — per-user step progress (D-05)
--   4. sops.flow_graph jsonb  — explicit override for FlowCanvas (D-05)
--   5. sop-voice-notes Storage bucket + RLS (D-03, RESEARCH §Supabase Storage)
-- All RLS policies follow the Phase 4 append-only worker pattern
-- (sop_completions precedent, migration 00010).
-- This migration is fully additive — no existing rows are modified
-- and no existing constraints are relaxed.
-- ============================================================

begin;

-- ----------------------------------------------------------------
-- 1. sop_voice_notes (append-only per-utterance voice note log)
-- ----------------------------------------------------------------
create table if not exists public.sop_voice_notes (
  id                  uuid primary key default gen_random_uuid(),
  organisation_id     uuid not null references public.organisations(id) on delete cascade,
  sop_id              uuid not null references public.sops(id) on delete cascade,
  section_id          uuid references public.sop_sections(id) on delete set null,
  step_id             uuid references public.sop_steps(id) on delete set null,
  completion_id       uuid references public.sop_completions(id) on delete set null,
  block_type          text not null check (block_type in ('measurement','note')),
  transcript          text not null,
  audio_storage_path  text not null,
  confidence          numeric,
  language            text not null default 'en-NZ' check (language in ('en-NZ','en-AU','en-US')),
  created_by          uuid not null references auth.users(id) on delete restrict,
  created_at          timestamptz not null default now()
);

create index if not exists sop_voice_notes_org_sop_idx
  on public.sop_voice_notes (organisation_id, sop_id);
create index if not exists sop_voice_notes_completion_idx
  on public.sop_voice_notes (completion_id) where completion_id is not null;
create index if not exists sop_voice_notes_created_at_idx
  on public.sop_voice_notes (created_at desc);

alter table public.sop_voice_notes enable row level security;

-- Append-only: INSERT only if org matches JWT + worker owns the row
create policy "voice_notes_insert_own"
  on public.sop_voice_notes for insert to authenticated
  with check (
    organisation_id::text = (auth.jwt()->>'organisation_id')
    and created_by = auth.uid()
  );

-- Org-scoped reads
create policy "voice_notes_select_org"
  on public.sop_voice_notes for select to authenticated
  using (organisation_id::text = (auth.jwt()->>'organisation_id'));

-- No UPDATE / no DELETE policies → append-only (Phase 4 pattern)

-- ----------------------------------------------------------------
-- 2. escalation_reports (EscalateBlock hybrid mode log)
-- ----------------------------------------------------------------
create table if not exists public.escalation_reports (
  id                  uuid primary key default gen_random_uuid(),
  organisation_id     uuid not null references public.organisations(id) on delete cascade,
  sop_id              uuid not null references public.sops(id) on delete cascade,
  section_id          uuid references public.sop_sections(id) on delete set null,
  step_id             uuid references public.sop_steps(id) on delete set null,
  completion_id       uuid references public.sop_completions(id) on delete set null,
  escalation_mode     text not null check (escalation_mode in ('alert','lock','form')),
  reason              text,
  photos              text[],
  measurements        jsonb,
  status              text not null default 'open' check (status in ('open','acknowledged','resolved')),
  submitted_by        uuid not null references auth.users(id) on delete restrict,
  submitted_at        timestamptz not null default now(),
  acknowledged_by     uuid references auth.users(id) on delete set null,
  acknowledged_at     timestamptz
);

create index if not exists escalation_reports_org_sop_idx
  on public.escalation_reports (organisation_id, sop_id);
create index if not exists escalation_reports_status_idx
  on public.escalation_reports (status) where status <> 'resolved';
create index if not exists escalation_reports_submitted_by_idx
  on public.escalation_reports (submitted_by);

alter table public.escalation_reports enable row level security;

-- Worker insert (own row, own org)
create policy "escalation_insert_own"
  on public.escalation_reports for insert to authenticated
  with check (
    organisation_id::text = (auth.jwt()->>'organisation_id')
    and submitted_by = auth.uid()
  );

-- Worker sees their own; supervisors/admin/safety_manager see all in org
create policy "escalation_select_scoped"
  on public.escalation_reports for select to authenticated
  using (
    organisation_id::text = (auth.jwt()->>'organisation_id')
    and (
      submitted_by = auth.uid()
      or (auth.jwt()->>'user_role') in ('supervisor','admin','safety_manager')
    )
  );

-- Supervisors can update status + acknowledgement (no other UPDATEs allowed)
create policy "escalation_update_supervisor"
  on public.escalation_reports for update to authenticated
  using (
    organisation_id::text = (auth.jwt()->>'organisation_id')
    and (auth.jwt()->>'user_role') in ('supervisor','admin','safety_manager')
  )
  with check (
    organisation_id::text = (auth.jwt()->>'organisation_id')
  );

-- No DELETE policy — preserve audit trail

-- ----------------------------------------------------------------
-- 3. walkthrough_progress (per-user step progress; upsert on nav)
-- ----------------------------------------------------------------
create table if not exists public.walkthrough_progress (
  sop_id         uuid not null references public.sops(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  step_id        uuid references public.sop_steps(id) on delete set null,
  completed_at   timestamptz,
  updated_at     timestamptz not null default now(),
  primary key (sop_id, user_id)
);

create index if not exists walkthrough_progress_user_idx
  on public.walkthrough_progress (user_id, updated_at desc);

alter table public.walkthrough_progress enable row level security;

-- User sees + writes only their own progress
create policy "walkthrough_progress_select_own"
  on public.walkthrough_progress for select to authenticated
  using (user_id = auth.uid());

create policy "walkthrough_progress_insert_own"
  on public.walkthrough_progress for insert to authenticated
  with check (user_id = auth.uid());

create policy "walkthrough_progress_update_own"
  on public.walkthrough_progress for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ----------------------------------------------------------------
-- 4. sops.flow_graph jsonb (nullable, no backfill — D-05)
-- ----------------------------------------------------------------
alter table public.sops
  add column if not exists flow_graph jsonb;

-- ----------------------------------------------------------------
-- 5. sop-voice-notes Storage bucket + RLS
-- ----------------------------------------------------------------
insert into storage.buckets (id, name, public)
  values ('sop-voice-notes', 'sop-voice-notes', false)
  on conflict (id) do nothing;

-- Path convention: {org_id}/voice/{sop_id}/{uuid}.{ext}
-- (storage.foldername(name))[1] = org_id per migration 00005 precedent

create policy "voice_bucket_select_org"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'sop-voice-notes'
    and (storage.foldername(name))[1] = (auth.jwt()->>'organisation_id')
  );

create policy "voice_bucket_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'sop-voice-notes'
    and (storage.foldername(name))[1] = (auth.jwt()->>'organisation_id')
    and owner = auth.uid()
  );

-- No UPDATE / DELETE on storage.objects for voice — 30-day purge via service_role only

commit;
