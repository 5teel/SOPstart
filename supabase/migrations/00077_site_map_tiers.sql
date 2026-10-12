-- ADR-0010: a tiered site map. A department may sit inside another department
-- (any depth: site -> hall -> line); the map draws a parent as a plate holding its
-- children. Cycles are refused by updateDepartment (src/actions/departments.ts).
alter table public.departments
  add column if not exists parent_id uuid references public.departments(id) on delete set null;
alter table public.departments drop constraint if exists departments_parent_not_self;
alter table public.departments add constraint departments_parent_not_self check (parent_id is null or parent_id <> id);
create index if not exists departments_parent_id_idx on public.departments (parent_id);

-- How the site map packs its areas: 'balanced' (even rows) or 'rows' (shelf rows, biggest first).
alter table public.organisations
  add column if not exists site_map_packing text not null default 'balanced';
alter table public.organisations drop constraint if exists organisations_site_map_packing_check;
alter table public.organisations add constraint organisations_site_map_packing_check
  check (site_map_packing in ('balanced', 'rows'));
