-- Phase 56 SOP-01/02/03: placement, generated steps, conversion reports,
-- standards.
--
-- D-01 / A-01: converted steps live in their OWN table (sop_focus_steps). The
--       old step and section tables gain no column and no row, so every old
--       reader (worker page, builder, activity, agent synthesis, version clone)
--       stays byte-identical until Phase 58 reads the new table.
-- D-09: sops.placement is 'machine' or 'site'. It is backfilled from
--       sop_machines and kept true by an invoker trigger on sop_machines
--       insert/delete, because deleting a machine or a SOP removes the links by
--       foreign-key cascade and application code cannot see that.
-- D-11 / D-12: one org-wide standards list (seeded) plus an attachment table
--       with ONE foreign-key column per level (SOP, section, generated step).
--       A polymorphic target id has no foreign key, so deleting a section or a
--       step would leave orphan labels; one FK column per level cascades.
-- A-06: generated steps carry image_paths; the converter verifies each equals
--       an existing sop_images.storage_path. No image row is copied or moved.
-- A-07: sop_conversion_runs keeps the before/after counts per SOP so a re-run
--       on an unchanged layout hash is a no-op and the eval can read the report.
--
-- RLS (CLAUDE.md 2026-08-04): every policy is double-quoted, every arm carries
-- the org conjunct, and every WITH CHECK restates its USING in full. Every
-- tenant table here carries organisation_id directly, and no policy of the
-- referenced tables points back at these ones, so there is no recursion risk
-- (CLAUDE.md 2026-05-13).
--
-- No elevated-privilege function: the one function below runs as the invoking
-- role (CLAUDE.md 2026-07-05).
--
-- Idempotent: create ... if not exists, drop policy / trigger if exists before
-- create, create or replace function, seed with on conflict do nothing -- so the
-- applier's Management-API fallback can re-run this file safely.

-- ============================================================
-- 1. Placement (D-09)
-- ============================================================
alter table public.sops add column if not exists placement text not null default 'site';

alter table public.sops drop constraint if exists sops_placement_check;
alter table public.sops add constraint sops_placement_check check (placement in ('machine', 'site'));

update public.sops s set placement = 'machine'
where s.placement <> 'machine'
  and exists (select 1 from public.sop_machines m where m.sop_id = s.id);

update public.sops s set placement = 'site'
where s.placement <> 'site'
  and not exists (select 1 from public.sop_machines m where m.sop_id = s.id);

create or replace function public.sync_sop_placement() returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_sop uuid := coalesce(new.sop_id, old.sop_id);
  v_placement text;
begin
  v_placement := case
    when exists (select 1 from public.sop_machines where sop_id = v_sop) then 'machine'
    else 'site'
  end;
  update public.sops set placement = v_placement
  where id = v_sop and placement is distinct from v_placement;
  return null;
end;
$$;

drop trigger if exists sop_machines_sync_placement on public.sop_machines;
create trigger sop_machines_sync_placement
  after insert or delete on public.sop_machines
  for each row execute function public.sync_sop_placement();

-- ============================================================
-- 2. sop_focus_steps (A-01) -- generated steps, written by the converter
-- ============================================================
create table if not exists public.sop_focus_steps (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  sop_id uuid not null references public.sops(id) on delete cascade,
  section_id uuid not null references public.sop_sections(id) on delete cascade,
  kind text not null check (kind in ('hazard', 'ppe', 'step', 'check')),
  text text not null,
  tip text,
  photo_required boolean not null default false,
  image_paths text[] not null default '{}',
  required_tools text[],
  time_estimate_minutes numeric(6,1),
  sort_order integer not null,
  source_key text not null,
  run_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (section_id, source_key),
  unique (id, organisation_id)
);

create index if not exists sop_focus_steps_sop_id_idx on public.sop_focus_steps (sop_id);
create index if not exists sop_focus_steps_organisation_id_idx on public.sop_focus_steps (organisation_id);

alter table public.sop_focus_steps enable row level security;

-- The sops subquery runs under the caller's own sops policies, so department
-- visibility is inherited exactly as the old step table inherits it (D-10).
-- No write policy: only the service-role converter writes this table this phase.
drop policy if exists "org_members_can_view_sop_focus_steps" on public.sop_focus_steps;
create policy "org_members_can_view_sop_focus_steps"
  on public.sop_focus_steps for select to authenticated
  using (
    organisation_id = public.current_organisation_id()
    and exists (select 1 from public.sops s where s.id = sop_focus_steps.sop_id)
  );

-- ============================================================
-- 3. sop_conversion_runs (A-07) -- before/after report per SOP
-- ============================================================
create table if not exists public.sop_conversion_runs (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  sop_id uuid not null references public.sops(id) on delete cascade,
  source text not null check (source in ('layout', 'rows', 'mixed', 'empty')),
  layout_hash text not null,
  converter_version integer not null,
  before jsonb not null,
  after jsonb not null,
  ok boolean not null,
  failures jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists sop_conversion_runs_sop_created_idx on public.sop_conversion_runs (sop_id, created_at desc);
create index if not exists sop_conversion_runs_organisation_id_idx on public.sop_conversion_runs (organisation_id);

alter table public.sop_conversion_runs enable row level security;

drop policy if exists "admins_can_view_sop_conversion_runs" on public.sop_conversion_runs;
create policy "admins_can_view_sop_conversion_runs"
  on public.sop_conversion_runs for select to authenticated
  using (
    organisation_id = public.current_organisation_id()
    and public.current_user_role() in ('admin', 'safety_manager')
  );

-- ============================================================
-- 4. standards (D-11, D-12) -- one org-wide list
-- ============================================================
create table if not exists public.standards (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organisation_id)
);

create unique index if not exists standards_org_name_key
  on public.standards (organisation_id, lower(btrim(name)));

alter table public.standards enable row level security;

drop policy if exists "org_members_can_view_standards" on public.standards;
create policy "org_members_can_view_standards"
  on public.standards for select to authenticated
  using (organisation_id = public.current_organisation_id());

drop policy if exists "admins_can_write_standards" on public.standards;
create policy "admins_can_write_standards"
  on public.standards for all to authenticated
  using (
    organisation_id = public.current_organisation_id()
    and public.current_user_role() in ('admin', 'safety_manager')
  )
  with check (
    organisation_id = public.current_organisation_id()
    and public.current_user_role() in ('admin', 'safety_manager')
  );

-- ============================================================
-- 5. standard_attachments -- one FK column per level, exactly one set
-- ============================================================
create table if not exists public.standard_attachments (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  standard_id uuid not null,
  sop_id uuid references public.sops(id) on delete cascade,
  section_id uuid references public.sop_sections(id) on delete cascade,
  focus_step_id uuid references public.sop_focus_steps(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (standard_id, organisation_id) references public.standards (id, organisation_id) on delete cascade,
  check (num_nonnulls(sop_id, section_id, focus_step_id) = 1)
);

create unique index if not exists standard_attachments_target_key
  on public.standard_attachments (standard_id, coalesce(sop_id, section_id, focus_step_id));
create index if not exists standard_attachments_sop_id_idx on public.standard_attachments (sop_id);
create index if not exists standard_attachments_section_id_idx on public.standard_attachments (section_id);
create index if not exists standard_attachments_focus_step_id_idx on public.standard_attachments (focus_step_id);
create index if not exists standard_attachments_organisation_id_idx on public.standard_attachments (organisation_id);

alter table public.standard_attachments enable row level security;

drop policy if exists "org_members_can_view_standard_attachments" on public.standard_attachments;
create policy "org_members_can_view_standard_attachments"
  on public.standard_attachments for select to authenticated
  using (organisation_id = public.current_organisation_id());

-- Insert: org + role + the target itself must belong to the caller's org (the
-- composite FK already pins the standard to the same org as the row).
drop policy if exists "admins_can_attach_standards" on public.standard_attachments;
create policy "admins_can_attach_standards"
  on public.standard_attachments for insert to authenticated
  with check (
    organisation_id = public.current_organisation_id()
    and public.current_user_role() in ('admin', 'safety_manager')
    and (
      (
        sop_id is not null
        and exists (
          select 1 from public.sops s
          where s.id = standard_attachments.sop_id
            and s.organisation_id = public.current_organisation_id()
        )
      )
      or (
        section_id is not null
        and exists (
          select 1 from public.sop_sections sec
          join public.sops s on s.id = sec.sop_id
          where sec.id = standard_attachments.section_id
            and s.organisation_id = public.current_organisation_id()
        )
      )
      or (
        focus_step_id is not null
        and exists (
          select 1 from public.sop_focus_steps f
          where f.id = standard_attachments.focus_step_id
            and f.organisation_id = public.current_organisation_id()
        )
      )
    )
  );

-- No update policy: an attachment is attached or it is not.
drop policy if exists "admins_can_detach_standards" on public.standard_attachments;
create policy "admins_can_detach_standards"
  on public.standard_attachments for delete to authenticated
  using (
    organisation_id = public.current_organisation_id()
    and public.current_user_role() in ('admin', 'safety_manager')
  );

-- ============================================================
-- 6. Seed (D-11) -- the starter list, for every organisation present
-- ============================================================
insert into public.standards (organisation_id, name)
select o.id, v.name
from public.organisations o
cross join (values
  ('LOTO'),
  ('Hot Work'),
  ('Confined Space'),
  ('Working at Height'),
  ('Manual Handling'),
  ('Electrical Isolation')
) as v(name)
on conflict do nothing;
