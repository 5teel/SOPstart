create table public.parse_jobs (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  sop_id          uuid not null references public.sops(id) on delete cascade,
  status          text not null default 'queued'
                  check (status in ('queued', 'processing', 'completed', 'failed')),
  file_path       text not null,
  file_type       text not null check (file_type in ('docx', 'pdf', 'image')),
  error_message   text,
  retry_count     int not null default 0,
  started_at      timestamptz,
  completed_at    timestamptz,
  created_at      timestamptz not null default now()
);

create index idx_parse_jobs_org_id on public.parse_jobs (organisation_id);
create index idx_parse_jobs_status on public.parse_jobs (status);
create index idx_parse_jobs_sop_id on public.parse_jobs (sop_id);

alter table public.parse_jobs enable row level security;

create policy "org_members_can_view_parse_jobs"
  on public.parse_jobs for select to authenticated
  using (organisation_id = public.current_organisation_id());

create policy "admins_can_manage_parse_jobs"
  on public.parse_jobs for all to authenticated
  using (
    organisation_id = public.current_organisation_id()
    and public.current_user_role() in ('admin', 'safety_manager')
  );

-- CRITICAL: Add to Realtime publication so Supabase Realtime picks up changes
-- (Pitfall 3 from research: without this, admin UI never receives status updates)
alter publication supabase_realtime add table public.parse_jobs;
