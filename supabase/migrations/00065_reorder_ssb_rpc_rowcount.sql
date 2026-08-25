-- Phase 46 WR-04 -- reorder_sop_section_blocks returned void, so an
-- RLS-denied or stale-id reorder (0 rows updated) was indistinguishable
-- from success and the action layer reported { success: true } with the
-- order unchanged. Return the affected row count so the caller can error
-- when it is less than the number of ids supplied.
--
-- Return type changes require DROP + CREATE (create or replace cannot
-- change a return type). The function stays NOT SECURITY DEFINER -- it must
-- keep running as the caller so ssb_admin_manage_own_org (00064) gates it.
-- The GRANT is re-issued because DROP discards it.

drop function if exists public.reorder_sop_section_blocks(uuid, uuid[]);

create function public.reorder_sop_section_blocks(
  p_sop_section_id        uuid,
  p_ordered_junction_ids  uuid[]
) returns integer
language plpgsql
as $$
declare
  n integer;
begin
  update public.sop_section_blocks
     set sort_order = arr.ord,
         updated_at = now()
    from unnest(p_ordered_junction_ids) with ordinality as arr(id, ord)
   where sop_section_blocks.sop_section_id = p_sop_section_id
     and sop_section_blocks.id             = arr.id;
  get diagnostics n = row_count;
  return n;
end;
$$;

grant execute on function public.reorder_sop_section_blocks(uuid, uuid[]) to authenticated;
