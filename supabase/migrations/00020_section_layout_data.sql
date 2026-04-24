-- ============================================================
-- Migration 00020: v3.0 Section Layout Data + Source Type (additive)
-- Adds:
--   1. sop_sections.layout_data    (jsonb, nullable) — Puck layout JSON
--   2. sop_sections.layout_version (int,   nullable) — monotonic integer version pin
--   3. sops.source_type            (text, default 'uploaded', NOT NULL)
--      CHECK constraint: uploaded | blank | ai | template
--   4. public.reorder_sections(p_sop_id uuid, p_ordered_section_ids uuid[])
--      Postgres function for atomic sort_order rewrite (supabase-js has no
--      client transactions — Research Pitfall 4).
-- This migration is fully additive — legacy rows keep NULL on layout_data
-- and layout_version; all existing sops are backfilled to source_type='uploaded'
-- before the NOT NULL constraint is enforced.
-- ============================================================

begin;

-- 1 + 2: sop_sections additive columns (no index, no backfill)
alter table public.sop_sections
  add column if not exists layout_data jsonb,
  add column if not exists layout_version int;

-- 3: sops.source_type with CHECK-string-enum (matching migration 00019 precedent)
alter table public.sops
  add column if not exists source_type text
    check (source_type in ('uploaded','blank','ai','template'));

-- Backfill existing rows to 'uploaded' BEFORE adding NOT NULL + default
-- (Research Pitfall 9: NULL != 'uploaded' returns NULL in SQL three-valued
-- logic and breaks the library chip filter).
update public.sops set source_type = 'uploaded' where source_type is null;

alter table public.sops alter column source_type set default 'uploaded';
alter table public.sops alter column source_type set not null;

-- 4: Atomic reorder RPC (workaround for supabase-js no-transaction limitation)
-- NOT SECURITY DEFINER — function runs as caller so RLS policies on
-- sop_sections still apply.
create or replace function public.reorder_sections(
  p_sop_id               uuid,
  p_ordered_section_ids  uuid[]
) returns void
language plpgsql
as $$
begin
  update public.sop_sections
     set sort_order = arr.ord,
         updated_at = now()
    from unnest(p_ordered_section_ids) with ordinality as arr(id, ord)
   where sop_sections.sop_id = p_sop_id
     and sop_sections.id    = arr.id;
end;
$$;

grant execute on function public.reorder_sections(uuid, uuid[]) to authenticated;

commit;
