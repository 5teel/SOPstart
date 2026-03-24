-- SOP status enum
create type public.sop_status as enum ('uploading', 'parsing', 'draft', 'published');

-- SOPs (root document entity)
create table public.sops (
  id                      uuid primary key default gen_random_uuid(),
  organisation_id         uuid not null references public.organisations(id) on delete cascade,
  title                   text,
  sop_number              text,
  revision_date           text,
  author                  text,
  category                text,
  department              text,
  related_sops            text[],
  applicable_equipment    text[],
  required_certifications text[],
  status                  public.sop_status not null default 'uploading',
  version                 int not null default 1,
  source_file_path        text not null,
  source_file_type        text not null check (source_file_type in ('docx', 'pdf', 'image')),
  source_file_name        text not null,
  overall_confidence      numeric(3,2),
  parse_notes             text,
  is_ocr                  boolean not null default false,
  uploaded_by             uuid not null references auth.users(id),
  published_at            timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index idx_sops_org_id on public.sops (organisation_id);
create index idx_sops_org_status on public.sops (organisation_id, status);

-- SOP Sections (flexible -- AI-detected types)
create table public.sop_sections (
  id              uuid primary key default gen_random_uuid(),
  sop_id          uuid not null references public.sops(id) on delete cascade,
  section_type    text not null,
  title           text not null,
  content         text,
  sort_order      int not null default 0,
  confidence      numeric(3,2),
  approved        boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_sop_sections_sop_id on public.sop_sections (sop_id);

-- SOP Steps (within a Steps-type section)
create table public.sop_steps (
  id                     uuid primary key default gen_random_uuid(),
  section_id             uuid not null references public.sop_sections(id) on delete cascade,
  step_number            int not null,
  text                   text not null,
  warning                text,
  caution                text,
  tip                    text,
  required_tools         text[],
  time_estimate_minutes  numeric(6,1),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index idx_sop_steps_section_id on public.sop_steps (section_id);

-- SOP Images (extracted from documents, associated with section or step)
create table public.sop_images (
  id              uuid primary key default gen_random_uuid(),
  sop_id          uuid not null references public.sops(id) on delete cascade,
  section_id      uuid references public.sop_sections(id) on delete set null,
  step_id         uuid references public.sop_steps(id) on delete set null,
  storage_path    text not null,
  content_type    text not null,
  alt_text        text,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now()
);

create index idx_sop_images_sop_id on public.sop_images (sop_id);

-- Enable RLS
alter table public.sops enable row level security;
alter table public.sop_sections enable row level security;
alter table public.sop_steps enable row level security;
alter table public.sop_images enable row level security;

-- RLS policies: org members can read all SOPs in their org
create policy "org_members_can_view_sops"
  on public.sops for select to authenticated
  using (organisation_id = public.current_organisation_id());

create policy "admins_can_insert_sops"
  on public.sops for insert to authenticated
  with check (
    organisation_id = public.current_organisation_id()
    and public.current_user_role() in ('admin', 'safety_manager')
  );

create policy "admins_can_update_sops"
  on public.sops for update to authenticated
  using (
    organisation_id = public.current_organisation_id()
    and public.current_user_role() in ('admin', 'safety_manager')
  );

create policy "admins_can_delete_sops"
  on public.sops for delete to authenticated
  using (
    organisation_id = public.current_organisation_id()
    and public.current_user_role() in ('admin', 'safety_manager')
  );

-- Sections: same org scoping via sop_id join
create policy "org_members_can_view_sections"
  on public.sop_sections for select to authenticated
  using (exists (
    select 1 from public.sops where sops.id = sop_sections.sop_id
    and sops.organisation_id = public.current_organisation_id()
  ));

create policy "admins_can_manage_sections"
  on public.sop_sections for all to authenticated
  using (exists (
    select 1 from public.sops where sops.id = sop_sections.sop_id
    and sops.organisation_id = public.current_organisation_id()
    and public.current_user_role() in ('admin', 'safety_manager')
  ));

-- Steps: same pattern
create policy "org_members_can_view_steps"
  on public.sop_steps for select to authenticated
  using (exists (
    select 1 from public.sop_sections s
    join public.sops sop on sop.id = s.sop_id
    where s.id = sop_steps.section_id
    and sop.organisation_id = public.current_organisation_id()
  ));

create policy "admins_can_manage_steps"
  on public.sop_steps for all to authenticated
  using (exists (
    select 1 from public.sop_sections s
    join public.sops sop on sop.id = s.sop_id
    where s.id = sop_steps.section_id
    and sop.organisation_id = public.current_organisation_id()
    and public.current_user_role() in ('admin', 'safety_manager')
  ));

-- Images: same pattern
create policy "org_members_can_view_images"
  on public.sop_images for select to authenticated
  using (exists (
    select 1 from public.sops where sops.id = sop_images.sop_id
    and sops.organisation_id = public.current_organisation_id()
  ));

create policy "admins_can_manage_images"
  on public.sop_images for all to authenticated
  using (exists (
    select 1 from public.sops where sops.id = sop_images.sop_id
    and sops.organisation_id = public.current_organisation_id()
    and public.current_user_role() in ('admin', 'safety_manager')
  ));
