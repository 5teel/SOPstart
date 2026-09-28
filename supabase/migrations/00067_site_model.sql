-- Phase 51 SIT-01: Site Model (site_layouts, site_machines, sop_machines) +
-- site-scenes storage bucket.
--
-- D-01: three tables, columns as listed, plus created_at on the junction.
-- D-02: polygon jsonb in scene px -- the DB checks it is an array of >= 3
--       entries; bounds are checked by the action against the layout's
--       width/height, not here.
-- D-03: every policy conjoins organisation_id = current_organisation_id();
--       writes are admin/safety_manager only; every WITH CHECK restates its
--       USING in full (CLAUDE.md 2026-08-04 -- a specified WITH CHECK
--       REPLACES the USING fallback, so a narrower check is worse than none.
--       That was the 00062 hole). organisation_id is denormalised onto all
--       three tables so no policy needs a cross-table subquery -- no
--       recursion risk (CLAUDE.md 2026-05-13, migrations 00030/00031).
-- D-05: private site-scenes bucket, jpeg/png, 15 MB, org-folder paths.
-- D-13: cascade directions -- deleting a machine or a SOP removes its links
--       (on delete cascade); deleting a department only clears
--       site_machines.department_id (on delete set null).
--
-- No elevated-privilege function, no functions, no RPCs (CLAUDE.md 2026-07-05
-- -- a function that runs as its owner and trusts a caller-supplied org id
-- is a PostgREST-exposed cross-tenant hole; this migration introduces none).
--
-- Idempotent: `create table if not exists`, `create index if not exists`,
-- `drop policy if exists` before every `create policy`, and the bucket row
-- upserts via `on conflict (id)` -- so the applier's Management-API fallback
-- can re-run this file safely.

-- ============================================================
-- 1. site_layouts
-- ============================================================
create table if not exists public.site_layouts (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  name text not null default 'Site' check (char_length(name) between 1 and 80),
  scene_path text,
  scene_width int check (scene_width > 0),
  scene_height int check (scene_height > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organisation_id)
);

create index if not exists site_layouts_organisation_id_idx on public.site_layouts (organisation_id);

alter table public.site_layouts enable row level security;

-- ============================================================
-- 2. site_machines
-- ============================================================
create table if not exists public.site_machines (
  id uuid primary key default gen_random_uuid(),
  site_layout_id uuid not null,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  department_id uuid references public.departments(id) on delete set null,
  polygon jsonb not null check (jsonb_typeof(polygon) = 'array' and jsonb_array_length(polygon) >= 3),
  sprite_path text,
  code text not null unique check (code ~ '^[0-9A-HJKMNP-TV-Z]{6}$'),
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organisation_id),
  foreign key (site_layout_id, organisation_id) references public.site_layouts (id, organisation_id) on delete cascade
);

create index if not exists site_machines_site_layout_id_idx on public.site_machines (site_layout_id);
create index if not exists site_machines_organisation_id_idx on public.site_machines (organisation_id);
create index if not exists site_machines_department_id_idx on public.site_machines (department_id);

alter table public.site_machines enable row level security;

-- ============================================================
-- 3. sop_machines (junction: which SOPs cover which machine)
-- ============================================================
create table if not exists public.sop_machines (
  sop_id uuid not null references public.sops(id) on delete cascade,
  machine_id uuid not null,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (sop_id, machine_id),
  foreign key (machine_id, organisation_id) references public.site_machines (id, organisation_id) on delete cascade
);

create index if not exists sop_machines_machine_id_idx on public.sop_machines (machine_id);
create index if not exists sop_machines_organisation_id_idx on public.sop_machines (organisation_id);

alter table public.sop_machines enable row level security;

-- ============================================================
-- Table policies -- exactly two per table. Every arm conjoins
-- organisation_id = current_organisation_id(); the write policy's WITH
-- CHECK is byte-identical to its USING (CLAUDE.md 2026-08-04/2026-07-20).
-- ============================================================

drop policy if exists "org_members_can_view_site_layouts" on public.site_layouts;
create policy "org_members_can_view_site_layouts"
  on public.site_layouts for select to authenticated
  using (organisation_id = public.current_organisation_id());

drop policy if exists "admins_can_write_site_layouts" on public.site_layouts;
create policy "admins_can_write_site_layouts"
  on public.site_layouts for all to authenticated
  using (
    organisation_id = public.current_organisation_id()
    and public.current_user_role() in ('admin', 'safety_manager')
  )
  with check (
    organisation_id = public.current_organisation_id()
    and public.current_user_role() in ('admin', 'safety_manager')
  );

drop policy if exists "org_members_can_view_site_machines" on public.site_machines;
create policy "org_members_can_view_site_machines"
  on public.site_machines for select to authenticated
  using (organisation_id = public.current_organisation_id());

drop policy if exists "admins_can_write_site_machines" on public.site_machines;
create policy "admins_can_write_site_machines"
  on public.site_machines for all to authenticated
  using (
    organisation_id = public.current_organisation_id()
    and public.current_user_role() in ('admin', 'safety_manager')
  )
  with check (
    organisation_id = public.current_organisation_id()
    and public.current_user_role() in ('admin', 'safety_manager')
  );

drop policy if exists "org_members_can_view_sop_machines" on public.sop_machines;
create policy "org_members_can_view_sop_machines"
  on public.sop_machines for select to authenticated
  using (organisation_id = public.current_organisation_id());

drop policy if exists "admins_can_write_sop_machines" on public.sop_machines;
create policy "admins_can_write_sop_machines"
  on public.sop_machines for all to authenticated
  using (
    organisation_id = public.current_organisation_id()
    and public.current_user_role() in ('admin', 'safety_manager')
  )
  with check (
    organisation_id = public.current_organisation_id()
    and public.current_user_role() in ('admin', 'safety_manager')
  );

-- ============================================================
-- Storage: site-scenes bucket + policies (D-05). Private, jpeg/png, 15 MB.
-- No UPDATE policy -- every scene is written once to a fresh
-- <org>/<layout-uuid>/scene.<ext> path (see src/lib/site/scene.ts scenePath).
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-scenes', 'site-scenes', false, 15728640, array['image/jpeg', 'image/png'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "admins_can_upload_site_scenes" on storage.objects;
create policy "admins_can_upload_site_scenes"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'site-scenes'
    and (storage.foldername(name))[1] = public.current_organisation_id()::text
    and public.current_user_role() in ('admin', 'safety_manager')
  );

drop policy if exists "org_members_can_read_site_scenes" on storage.objects;
create policy "org_members_can_read_site_scenes"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'site-scenes'
    and (storage.foldername(name))[1] = public.current_organisation_id()::text
  );

drop policy if exists "admins_can_delete_site_scenes" on storage.objects;
create policy "admins_can_delete_site_scenes"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'site-scenes'
    and (storage.foldername(name))[1] = public.current_organisation_id()::text
    and public.current_user_role() in ('admin', 'safety_manager')
  );
