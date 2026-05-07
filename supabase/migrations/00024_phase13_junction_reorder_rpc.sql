-- ============================================================
-- Migration 00023.5: Phase 13 sop_section_blocks atomic reorder RPC
-- Mirrors public.reorder_sections() from 00020 — same pattern, different table.
-- Per CLAUDE.md learning: supabase-js has no client transactions, so atomic
-- sort_order rewrites must go through a Postgres function. Avoids drift if
-- a Promise.all of UPDATEs partially fails mid-flight.
-- NOT SECURITY DEFINER — function runs as caller so RLS policies on
-- sop_section_blocks (from 00019) still apply.
-- ============================================================

begin;

create or replace function public.reorder_sop_section_blocks(
  p_sop_section_id        uuid,
  p_ordered_junction_ids  uuid[]
) returns void
language plpgsql
as $$
begin
  update public.sop_section_blocks
     set sort_order = arr.ord,
         updated_at = now()
    from unnest(p_ordered_junction_ids) with ordinality as arr(id, ord)
   where sop_section_blocks.sop_section_id = p_sop_section_id
     and sop_section_blocks.id             = arr.id;
end;
$$;

grant execute on function public.reorder_sop_section_blocks(uuid, uuid[]) to authenticated;

commit;
