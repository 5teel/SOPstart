-- ============================================================
-- Migration 00023: Phase 13 NZ Global Block Library Seed (D-Global-03 auto-seed)
-- Source: .planning/phases/13-reusable-block-library/seed-source/global-blocks.json
-- Counts: 57 hazard + 5 PPE + 3 step = 65 global blocks
-- Per D-Global-03: auto-seed full list with no human review pass; Summit cleans up post-launch.
-- All rows are organisation_id = NULL (global, read-only to every authenticated org via 00019 RLS).
-- ============================================================

begin;

-- Idempotency guard: skip if globals already seeded.
do $$
declare
  v_block_id uuid;
  v_version_id uuid;
begin
  if exists (select 1 from public.blocks where organisation_id is null and kind_slug = 'hazard' limit 1) then
    raise notice 'Phase 13 global hazard seed already present — skipping seed insert';
    return;
  end if;

  -- ============================================================
  -- Hazard blocks
  -- ============================================================

  -- Block 1: Caught in section
  insert into public.blocks (organisation_id, kind_slug, name, category_tags, free_text_tags, created_by)
    values (null, 'hazard', 'Caught in section', ARRAY['crush-entrapment', 'area-job-change']::text[], ARRAY[]::text[], null)
    returning id into v_block_id;
  insert into public.block_versions (block_id, version_number, content, change_note, created_by)
    values (v_block_id, 1, jsonb_build_object('kind', 'hazard', 'text', 'Caught in section.', 'severity', 'critical'), 'Initial NZ global seed (D-Global-03)', null)
    returning id into v_version_id;
  update public.blocks set current_version_id = v_version_id where id = v_block_id;
  -- Block 2: Entrapment
  insert into public.blocks (organisation_id, kind_slug, name, category_tags, free_text_tags, created_by)
    values (null, 'hazard', 'Entrapment', ARRAY['crush-entrapment', 'area-mould-repair']::text[], ARRAY[]::text[], null)
    returning id into v_block_id;
  insert into public.block_versions (block_id, version_number, content, change_note, created_by)
    values (v_block_id, 1, jsonb_build_object('kind', 'hazard', 'text', 'Entrapment.', 'severity', 'critical'), 'Initial NZ global seed (D-Global-03)', null)
    returning id into v_version_id;
  update public.blocks set current_version_id = v_version_id where id = v_block_id;
  -- Block 3: Prevent entrapment
  insert into public.blocks (organisation_id, kind_slug, name, category_tags, free_text_tags, created_by)
    values (null, 'hazard', 'Prevent entrapment', ARRAY['crush-entrapment', 'area-forming']::text[], ARRAY[]::text[], null)
    returning id into v_block_id;
  insert into public.block_versions (block_id, version_number, content, change_note, created_by)
    values (v_block_id, 1, jsonb_build_object('kind', 'hazard', 'text', 'Prevent entrapment in moving section.', 'severity', 'critical'), 'Initial NZ global seed (D-Global-03)', null)
    returning id into v_version_id;
  update public.blocks set current_version_id = v_version_id where id = v_block_id;
  -- Block 4: Entrapment in section
  insert into public.blocks (organisation_id, kind_slug, name, category_tags, free_text_tags, created_by)
    values (null, 'hazard', 'Entrapment in section', ARRAY['crush-entrapment', 'area-job-change']::text[], ARRAY[]::text[], null)
    returning id into v_block_id;
  insert into public.block_versions (block_id, version_number, content, change_note, created_by)
    values (v_block_id, 1, jsonb_build_object('kind', 'hazard', 'text', 'Entrapment in section.', 'severity', 'critical'), 'Initial NZ global seed (D-Global-03)', null)
    returning id into v_version_id;
  update public.blocks set current_version_id = v_version_id where id = v_block_id;
  -- Block 5: Crushed hand
  insert into public.blocks (organisation_id, kind_slug, name, category_tags, free_text_tags, created_by)
    values (null, 'hazard', 'Crushed hand', ARRAY['crush-entrapment', 'area-mould-repair']::text[], ARRAY[]::text[], null)
    returning id into v_block_id;
  insert into public.block_versions (block_id, version_number, content, change_note, created_by)
    values (v_block_id, 1, jsonb_build_object('kind', 'hazard', 'text', 'Crushed hand.', 'severity', 'critical'), 'Initial NZ global seed (D-Global-03)', null)
    returning id into v_version_id;
  update public.blocks set current_version_id = v_version_id where id = v_block_id;
  -- Block 6: Manual handling strain
  insert into public.blocks (organisation_id, kind_slug, name, category_tags, free_text_tags, created_by)
    values (null, 'hazard', 'Manual handling strain', ARRAY['manual-handling-strain', 'area-machine-repair']::text[], ARRAY[]::text[], null)
    returning id into v_block_id;
  insert into public.block_versions (block_id, version_number, content, change_note, created_by)
    values (v_block_id, 1, jsonb_build_object('kind', 'hazard', 'text', 'Manual handling.', 'severity', 'warning'), 'Initial NZ global seed (D-Global-03)', null)
    returning id into v_version_id;
  update public.blocks set current_version_id = v_version_id where id = v_block_id;
  -- Block 7: Back strain from lifting
  insert into public.blocks (organisation_id, kind_slug, name, category_tags, free_text_tags, created_by)
    values (null, 'hazard', 'Back strain from lifting', ARRAY['manual-handling-strain', 'area-finished-products']::text[], ARRAY[]::text[], null)
    returning id into v_block_id;
  insert into public.block_versions (block_id, version_number, content, change_note, created_by)
    values (v_block_id, 1, jsonb_build_object('kind', 'hazard', 'text', 'Back strain from lifting.', 'severity', 'warning'), 'Initial NZ global seed (D-Global-03)', null)
    returning id into v_version_id;
  update public.blocks set current_version_id = v_version_id where id = v_block_id;
  -- Block 8: Sprain or strain
  insert into public.blocks (organisation_id, kind_slug, name, category_tags, free_text_tags, created_by)
    values (null, 'hazard', 'Sprain or strain', ARRAY['manual-handling-strain', 'area-plant-services']::text[], ARRAY[]::text[], null)
    returning id into v_block_id;
  insert into public.block_versions (block_id, version_number, content, change_note, created_by)
    values (v_block_id, 1, jsonb_build_object('kind', 'hazard', 'text', 'Sprain or strain.', 'severity', 'warning'), 'Initial NZ global seed (D-Global-03)', null)
    returning id into v_version_id;
  update public.blocks set current_version_id = v_version_id where id = v_block_id;
  -- Block 9: Burnt or back strain handling hot ware
  insert into public.blocks (organisation_id, kind_slug, name, category_tags, free_text_tags, created_by)
    values (null, 'hazard', 'Burnt or back strain handling hot ware', ARRAY['manual-handling-strain', 'burns-hot', 'area-forming']::text[], ARRAY[]::text[], null)
    returning id into v_block_id;
  insert into public.block_versions (block_id, version_number, content, change_note, created_by)
    values (v_block_id, 1, jsonb_build_object('kind', 'hazard', 'text', 'Burnt or back strain when handling hot ware.', 'severity', 'warning'), 'Initial NZ global seed (D-Global-03)', null)
    returning id into v_version_id;
  update public.blocks set current_version_id = v_version_id where id = v_block_id;
  -- Block 10: Repetitive strain injury
  insert into public.blocks (organisation_id, kind_slug, name, category_tags, free_text_tags, created_by)
    values (null, 'hazard', 'Repetitive strain injury', ARRAY['manual-handling-strain', 'area-quality-control']::text[], ARRAY[]::text[], null)
    returning id into v_block_id;
  insert into public.block_versions (block_id, version_number, content, change_note, created_by)
    values (v_block_id, 1, jsonb_build_object('kind', 'hazard', 'text', 'Repetitive strain injury from sustained handling.', 'severity', 'warning'), 'Initial NZ global seed (D-Global-03)', null)
    returning id into v_version_id;
  update public.blocks set current_version_id = v_version_id where id = v_block_id;
  -- Block 11: Laceration
  insert into public.blocks (organisation_id, kind_slug, name, category_tags, free_text_tags, created_by)
    values (null, 'hazard', 'Laceration', ARRAY['cuts-lacerations', 'area-quality-control']::text[], ARRAY[]::text[], null)
    returning id into v_block_id;
  insert into public.block_versions (block_id, version_number, content, change_note, created_by)
    values (v_block_id, 1, jsonb_build_object('kind', 'hazard', 'text', 'Laceration.', 'severity', 'warning'), 'Initial NZ global seed (D-Global-03)', null)
    returning id into v_version_id;
  update public.blocks set current_version_id = v_version_id where id = v_block_id;
  -- Block 12: Laceration from broken glass
  insert into public.blocks (organisation_id, kind_slug, name, category_tags, free_text_tags, created_by)
    values (null, 'hazard', 'Laceration from broken glass', ARRAY['cuts-lacerations', 'glass-breakage', 'area-quality-control']::text[], ARRAY[]::text[], null)
    returning id into v_block_id;
  insert into public.block_versions (block_id, version_number, content, change_note, created_by)
    values (v_block_id, 1, jsonb_build_object('kind', 'hazard', 'text', 'Laceration from broken glass.', 'severity', 'warning'), 'Initial NZ global seed (D-Global-03)', null)
    returning id into v_version_id;
  update public.blocks set current_version_id = v_version_id where id = v_block_id;
  -- Block 13: Cuts to hands
  insert into public.blocks (organisation_id, kind_slug, name, category_tags, free_text_tags, created_by)
    values (null, 'hazard', 'Cuts to hands', ARRAY['cuts-lacerations', 'area-finished-products']::text[], ARRAY[]::text[], null)
    returning id into v_block_id;
  insert into public.block_versions (block_id, version_number, content, change_note, created_by)
    values (v_block_id, 1, jsonb_build_object('kind', 'hazard', 'text', 'Cuts to hands.', 'severity', 'warning'), 'Initial NZ global seed (D-Global-03)', null)
    returning id into v_version_id;
  update public.blocks set current_version_id = v_version_id where id = v_block_id;
  -- Block 14: Lacerations from sharp edges
  insert into public.blocks (organisation_id, kind_slug, name, category_tags, free_text_tags, created_by)
    values (null, 'hazard', 'Lacerations from sharp edges', ARRAY['cuts-lacerations', 'area-machine-repair']::text[], ARRAY[]::text[], null)
    returning id into v_block_id;
  insert into public.block_versions (block_id, version_number, content, change_note, created_by)
    values (v_block_id, 1, jsonb_build_object('kind', 'hazard', 'text', 'Lacerations from sharp edges.', 'severity', 'warning'), 'Initial NZ global seed (D-Global-03)', null)
    returning id into v_version_id;
  update public.blocks set current_version_id = v_version_id where id = v_block_id;
  -- Block 15: Cuts from broken bottles
  insert into public.blocks (organisation_id, kind_slug, name, category_tags, free_text_tags, created_by)
    values (null, 'hazard', 'Cuts from broken bottles', ARRAY['cuts-lacerations', 'glass-breakage', 'area-finished-products']::text[], ARRAY[]::text[], null)
    returning id into v_block_id;
  insert into public.block_versions (block_id, version_number, content, change_note, created_by)
    values (v_block_id, 1, jsonb_build_object('kind', 'hazard', 'text', 'Cuts from broken bottles.', 'severity', 'warning'), 'Initial NZ global seed (D-Global-03)', null)
    returning id into v_version_id;
  update public.blocks set current_version_id = v_version_id where id = v_block_id;
  -- Block 16: Burns from hot surfaces
  insert into public.blocks (organisation_id, kind_slug, name, category_tags, free_text_tags, created_by)
    values (null, 'hazard', 'Burns from hot surfaces', ARRAY['burns-hot', 'area-forming']::text[], ARRAY[]::text[], null)
    returning id into v_block_id;
  insert into public.block_versions (block_id, version_number, content, change_note, created_by)
    values (v_block_id, 1, jsonb_build_object('kind', 'hazard', 'text', 'Burns from hot surfaces.', 'severity', 'warning'), 'Initial NZ global seed (D-Global-03)', null)
    returning id into v_version_id;
  update public.blocks set current_version_id = v_version_id where id = v_block_id;
  -- Block 17: Burns from hot ware
  insert into public.blocks (organisation_id, kind_slug, name, category_tags, free_text_tags, created_by)
    values (null, 'hazard', 'Burns from hot ware', ARRAY['burns-hot', 'area-forming']::text[], ARRAY[]::text[], null)
    returning id into v_block_id;
  insert into public.block_versions (block_id, version_number, content, change_note, created_by)
    values (v_block_id, 1, jsonb_build_object('kind', 'hazard', 'text', 'Burns from hot ware.', 'severity', 'warning'), 'Initial NZ global seed (D-Global-03)', null)
    returning id into v_version_id;
  update public.blocks set current_version_id = v_version_id where id = v_block_id;
  -- Block 18: Burning from heat reflected off ware
  insert into public.blocks (organisation_id, kind_slug, name, category_tags, free_text_tags, created_by)
    values (null, 'hazard', 'Burning from heat reflected off ware', ARRAY['burns-hot', 'area-forming']::text[], ARRAY[]::text[], null)
    returning id into v_block_id;
  insert into public.block_versions (block_id, version_number, content, change_note, created_by)
    values (v_block_id, 1, jsonb_build_object('kind', 'hazard', 'text', 'Burning from heat reflected off ware.', 'severity', 'warning'), 'Initial NZ global seed (D-Global-03)', null)
    returning id into v_version_id;
  update public.blocks set current_version_id = v_version_id where id = v_block_id;
  -- Block 19: Burnt with hot gob
  insert into public.blocks (organisation_id, kind_slug, name, category_tags, free_text_tags, created_by)
    values (null, 'hazard', 'Burnt with hot gob', ARRAY['burns-hot', 'area-forming']::text[], ARRAY[]::text[], null)
    returning id into v_block_id;
  insert into public.block_versions (block_id, version_number, content, change_note, created_by)
    values (v_block_id, 1, jsonb_build_object('kind', 'hazard', 'text', 'Burnt with hot gob.', 'severity', 'warning'), 'Initial NZ global seed (D-Global-03)', null)
    returning id into v_version_id;
  update public.blocks set current_version_id = v_version_id where id = v_block_id;
  -- Block 20: Burns from hot oil or fluid
  insert into public.blocks (organisation_id, kind_slug, name, category_tags, free_text_tags, created_by)
    values (null, 'hazard', 'Burns from hot oil or fluid', ARRAY['burns-hot', 'pressurised-fluid', 'area-batch-furnace']::text[], ARRAY[]::text[], null)
    returning id into v_block_id;
  insert into public.block_versions (block_id, version_number, content, change_note, created_by)
    values (v_block_id, 1, jsonb_build_object('kind', 'hazard', 'text', 'Burns from hot oil or fluid splash.', 'severity', 'warning'), 'Initial NZ global seed (D-Global-03)', null)
    returning id into v_version_id;
  update public.blocks set current_version_id = v_version_id where id = v_block_id;
  -- Block 21: Environmental contamination
  insert into public.blocks (organisation_id, kind_slug, name, category_tags, free_text_tags, created_by)
    values (null, 'hazard', 'Environmental contamination', ARRAY['spill-environmental', 'area-factory-maintenance']::text[], ARRAY[]::text[], null)
    returning id into v_block_id;
  insert into public.block_versions (block_id, version_number, content, change_note, created_by)
    values (v_block_id, 1, jsonb_build_object('kind', 'hazard', 'text', 'Contamination.', 'severity', 'notice'), 'Initial NZ global seed (D-Global-03)', null)
    returning id into v_version_id;
  update public.blocks set current_version_id = v_version_id where id = v_block_id;
  -- Block 22: Oil or fluid leak
  insert into public.blocks (organisation_id, kind_slug, name, category_tags, free_text_tags, created_by)
    values (null, 'hazard', 'Oil or fluid leak', ARRAY['spill-environmental', 'area-machine-repair']::text[], ARRAY[]::text[], null)
    returning id into v_block_id;
  insert into public.block_versions (block_id, version_number, content, change_note, created_by)
    values (v_block_id, 1, jsonb_build_object('kind', 'hazard', 'text', 'Leak in hose or fitting.', 'severity', 'notice'), 'Initial NZ global seed (D-Global-03)', null)
    returning id into v_version_id;
  update public.blocks set current_version_id = v_version_id where id = v_block_id;
  -- Block 23: Spill on floor
  insert into public.blocks (organisation_id, kind_slug, name, category_tags, free_text_tags, created_by)
    values (null, 'hazard', 'Spill on floor', ARRAY['spill-environmental', 'slips-trips', 'area-plant-services']::text[], ARRAY[]::text[], null)
    returning id into v_block_id;
  insert into public.block_versions (block_id, version_number, content, change_note, created_by)
    values (v_block_id, 1, jsonb_build_object('kind', 'hazard', 'text', 'Spill on floor.', 'severity', 'notice'), 'Initial NZ global seed (D-Global-03)', null)
    returning id into v_version_id;
  update public.blocks set current_version_id = v_version_id where id = v_block_id;
  -- Block 24: Leak from valve
  insert into public.blocks (organisation_id, kind_slug, name, category_tags, free_text_tags, created_by)
    values (null, 'hazard', 'Leak from valve', ARRAY['spill-environmental', 'area-factory-maintenance']::text[], ARRAY[]::text[], null)
    returning id into v_block_id;
  insert into public.block_versions (block_id, version_number, content, change_note, created_by)
    values (v_block_id, 1, jsonb_build_object('kind', 'hazard', 'text', 'Leak from valve.', 'severity', 'notice'), 'Initial NZ global seed (D-Global-03)', null)
    returning id into v_version_id;
  update public.blocks set current_version_id = v_version_id where id = v_block_id;
  -- Block 25: Hose leak
  insert into public.blocks (organisation_id, kind_slug, name, category_tags, free_text_tags, created_by)
    values (null, 'hazard', 'Hose leak', ARRAY['spill-environmental', 'area-batch-furnace']::text[], ARRAY[]::text[], null)
    returning id into v_block_id;
  insert into public.block_versions (block_id, version_number, content, change_note, created_by)
    values (v_block_id, 1, jsonb_build_object('kind', 'hazard', 'text', 'Leak in hose.', 'severity', 'notice'), 'Initial NZ global seed (D-Global-03)', null)
    returning id into v_version_id;
  update public.blocks set current_version_id = v_version_id where id = v_block_id;
  -- Block 26: Slip hazard
  insert into public.blocks (organisation_id, kind_slug, name, category_tags, free_text_tags, created_by)
    values (null, 'hazard', 'Slip hazard', ARRAY['slips-trips', 'area-factory-maintenance']::text[], ARRAY[]::text[], null)
    returning id into v_block_id;
  insert into public.block_versions (block_id, version_number, content, change_note, created_by)
    values (v_block_id, 1, jsonb_build_object('kind', 'hazard', 'text', 'Slip on wet or oily floor.', 'severity', 'notice'), 'Initial NZ global seed (D-Global-03)', null)
    returning id into v_version_id;
  update public.blocks set current_version_id = v_version_id where id = v_block_id;
  -- Block 27: Trip hazard
  insert into public.blocks (organisation_id, kind_slug, name, category_tags, free_text_tags, created_by)
    values (null, 'hazard', 'Trip hazard', ARRAY['slips-trips', 'area-mould-repair']::text[], ARRAY[]::text[], null)
    returning id into v_block_id;
  insert into public.block_versions (block_id, version_number, content, change_note, created_by)
    values (v_block_id, 1, jsonb_build_object('kind', 'hazard', 'text', 'Trip hazard.', 'severity', 'notice'), 'Initial NZ global seed (D-Global-03)', null)
    returning id into v_version_id;
  update public.blocks set current_version_id = v_version_id where id = v_block_id;
  -- Block 28: Tripping over cables or hoses
  insert into public.blocks (organisation_id, kind_slug, name, category_tags, free_text_tags, created_by)
    values (null, 'hazard', 'Tripping over cables or hoses', ARRAY['slips-trips', 'area-electrical']::text[], ARRAY[]::text[], null)
    returning id into v_block_id;
  insert into public.block_versions (block_id, version_number, content, change_note, created_by)
    values (v_block_id, 1, jsonb_build_object('kind', 'hazard', 'text', 'Tripping over cables or hoses.', 'severity', 'notice'), 'Initial NZ global seed (D-Global-03)', null)
    returning id into v_version_id;
  update public.blocks set current_version_id = v_version_id where id = v_block_id;
  -- Block 29: Slip hazard in confined work area
  insert into public.blocks (organisation_id, kind_slug, name, category_tags, free_text_tags, created_by)
    values (null, 'hazard', 'Slip hazard in confined work area', ARRAY['slips-trips', 'area-plant-services']::text[], ARRAY[]::text[], null)
    returning id into v_block_id;
  insert into public.block_versions (block_id, version_number, content, change_note, created_by)
    values (v_block_id, 1, jsonb_build_object('kind', 'hazard', 'text', 'Limited work area causing slips and strains from spanner slipping.', 'severity', 'notice'), 'Initial NZ global seed (D-Global-03)', null)
    returning id into v_version_id;
  update public.blocks set current_version_id = v_version_id where id = v_block_id;
  -- Block 30: Trip on uneven walkway
  insert into public.blocks (organisation_id, kind_slug, name, category_tags, free_text_tags, created_by)
    values (null, 'hazard', 'Trip on uneven walkway', ARRAY['slips-trips', 'area-finished-products']::text[], ARRAY[]::text[], null)
    returning id into v_block_id;
  insert into public.block_versions (block_id, version_number, content, change_note, created_by)
    values (v_block_id, 1, jsonb_build_object('kind', 'hazard', 'text', 'Trip on uneven walkway.', 'severity', 'notice'), 'Initial NZ global seed (D-Global-03)', null)
    returning id into v_version_id;
  update public.blocks set current_version_id = v_version_id where id = v_block_id;
  -- Block 31: Electrocution
  insert into public.blocks (organisation_id, kind_slug, name, category_tags, free_text_tags, created_by)
    values (null, 'hazard', 'Electrocution', ARRAY['electrocution', 'area-electrical']::text[], ARRAY[]::text[], null)
    returning id into v_block_id;
  insert into public.block_versions (block_id, version_number, content, change_note, created_by)
    values (v_block_id, 1, jsonb_build_object('kind', 'hazard', 'text', 'Electrocution.', 'severity', 'critical'), 'Initial NZ global seed (D-Global-03)', null)
    returning id into v_version_id;
  update public.blocks set current_version_id = v_version_id where id = v_block_id;
  -- Block 32: Electric shock
  insert into public.blocks (organisation_id, kind_slug, name, category_tags, free_text_tags, created_by)
    values (null, 'hazard', 'Electric shock', ARRAY['electrocution', 'area-electrical']::text[], ARRAY[]::text[], null)
    returning id into v_block_id;
  insert into public.block_versions (block_id, version_number, content, change_note, created_by)
    values (v_block_id, 1, jsonb_build_object('kind', 'hazard', 'text', 'Electric shock.', 'severity', 'critical'), 'Initial NZ global seed (D-Global-03)', null)
    returning id into v_version_id;
  update public.blocks set current_version_id = v_version_id where id = v_block_id;
  -- Block 33: Shocks and electrocution from live circuits
  insert into public.blocks (organisation_id, kind_slug, name, category_tags, free_text_tags, created_by)
    values (null, 'hazard', 'Shocks and electrocution from live circuits', ARRAY['electrocution', 'isolation-energy', 'area-electrical']::text[], ARRAY[]::text[], null)
    returning id into v_block_id;
  insert into public.block_versions (block_id, version_number, content, change_note, created_by)
    values (v_block_id, 1, jsonb_build_object('kind', 'hazard', 'text', 'Shocks and electrocution from live circuits.', 'severity', 'critical'), 'Initial NZ global seed (D-Global-03)', null)
    returning id into v_version_id;
  update public.blocks set current_version_id = v_version_id where id = v_block_id;
  -- Block 34: Moving machinery
  insert into public.blocks (organisation_id, kind_slug, name, category_tags, free_text_tags, created_by)
    values (null, 'hazard', 'Moving machinery', ARRAY['moving-machinery', 'area-forming']::text[], ARRAY[]::text[], null)
    returning id into v_block_id;
  insert into public.block_versions (block_id, version_number, content, change_note, created_by)
    values (v_block_id, 1, jsonb_build_object('kind', 'hazard', 'text', 'Moving machinery.', 'severity', 'warning'), 'Initial NZ global seed (D-Global-03)', null)
    returning id into v_version_id;
  update public.blocks set current_version_id = v_version_id where id = v_block_id;
  -- Block 35: Moving parts
  insert into public.blocks (organisation_id, kind_slug, name, category_tags, free_text_tags, created_by)
    values (null, 'hazard', 'Moving parts', ARRAY['moving-machinery', 'area-machine-repair']::text[], ARRAY[]::text[], null)
    returning id into v_block_id;
  insert into public.block_versions (block_id, version_number, content, change_note, created_by)
    values (v_block_id, 1, jsonb_build_object('kind', 'hazard', 'text', 'Moving parts.', 'severity', 'warning'), 'Initial NZ global seed (D-Global-03)', null)
    returning id into v_version_id;
  update public.blocks set current_version_id = v_version_id where id = v_block_id;
  -- Block 36: Moving machinery noise and heat
  insert into public.blocks (organisation_id, kind_slug, name, category_tags, free_text_tags, created_by)
    values (null, 'hazard', 'Moving machinery noise and heat', ARRAY['moving-machinery', 'noise', 'burns-hot', 'area-forming']::text[], ARRAY[]::text[], null)
    returning id into v_block_id;
  insert into public.block_versions (block_id, version_number, content, change_note, created_by)
    values (v_block_id, 1, jsonb_build_object('kind', 'hazard', 'text', 'Moving machinery, noise and heat.', 'severity', 'warning'), 'Initial NZ global seed (D-Global-03)', null)
    returning id into v_version_id;
  update public.blocks set current_version_id = v_version_id where id = v_block_id;
  -- Block 37: Broken bottle
  insert into public.blocks (organisation_id, kind_slug, name, category_tags, free_text_tags, created_by)
    values (null, 'hazard', 'Broken bottle', ARRAY['glass-breakage', 'cuts-lacerations', 'area-quality-control']::text[], ARRAY[]::text[], null)
    returning id into v_block_id;
  insert into public.block_versions (block_id, version_number, content, change_note, created_by)
    values (v_block_id, 1, jsonb_build_object('kind', 'hazard', 'text', 'Broken bottle causing cuts.', 'severity', 'warning'), 'Initial NZ global seed (D-Global-03)', null)
    returning id into v_version_id;
  update public.blocks set current_version_id = v_version_id where id = v_block_id;
  -- Block 38: Broken glass
  insert into public.blocks (organisation_id, kind_slug, name, category_tags, free_text_tags, created_by)
    values (null, 'hazard', 'Broken glass', ARRAY['glass-breakage', 'cuts-lacerations', 'area-finished-products']::text[], ARRAY[]::text[], null)
    returning id into v_block_id;
  insert into public.block_versions (block_id, version_number, content, change_note, created_by)
    values (v_block_id, 1, jsonb_build_object('kind', 'hazard', 'text', 'Broken glass.', 'severity', 'warning'), 'Initial NZ global seed (D-Global-03)', null)
    returning id into v_version_id;
  update public.blocks set current_version_id = v_version_id where id = v_block_id;
  -- Block 39: Glass run out
  insert into public.blocks (organisation_id, kind_slug, name, category_tags, free_text_tags, created_by)
    values (null, 'hazard', 'Glass run out', ARRAY['glass-breakage', 'burns-hot', 'area-forming']::text[], ARRAY[]::text[], null)
    returning id into v_block_id;
  insert into public.block_versions (block_id, version_number, content, change_note, created_by)
    values (v_block_id, 1, jsonb_build_object('kind', 'hazard', 'text', 'Glass run out from forming machine.', 'severity', 'warning'), 'Initial NZ global seed (D-Global-03)', null)
    returning id into v_version_id;
  update public.blocks set current_version_id = v_version_id where id = v_block_id;
  -- Block 40: Falling objects
  insert into public.blocks (organisation_id, kind_slug, name, category_tags, free_text_tags, created_by)
    values (null, 'hazard', 'Falling objects', ARRAY['falling-objects', 'area-finished-products']::text[], ARRAY[]::text[], null)
    returning id into v_block_id;
  insert into public.block_versions (block_id, version_number, content, change_note, created_by)
    values (v_block_id, 1, jsonb_build_object('kind', 'hazard', 'text', 'Falling objects.', 'severity', 'warning'), 'Initial NZ global seed (D-Global-03)', null)
    returning id into v_version_id;
  update public.blocks set current_version_id = v_version_id where id = v_block_id;
  -- Block 41: Dropped loads from overhead hoist
  insert into public.blocks (organisation_id, kind_slug, name, category_tags, free_text_tags, created_by)
    values (null, 'hazard', 'Dropped loads from overhead hoist', ARRAY['falling-objects', 'forklift-vehicle', 'area-mould-repair']::text[], ARRAY[]::text[], null)
    returning id into v_block_id;
  insert into public.block_versions (block_id, version_number, content, change_note, created_by)
    values (v_block_id, 1, jsonb_build_object('kind', 'hazard', 'text', 'Dropped loads from overhead hoist.', 'severity', 'warning'), 'Initial NZ global seed (D-Global-03)', null)
    returning id into v_version_id;
  update public.blocks set current_version_id = v_version_id where id = v_block_id;
  -- Block 42: Hopper or container could drop
  insert into public.blocks (organisation_id, kind_slug, name, category_tags, free_text_tags, created_by)
    values (null, 'hazard', 'Hopper or container could drop', ARRAY['falling-objects', 'area-batch-furnace']::text[], ARRAY[]::text[], null)
    returning id into v_block_id;
  insert into public.block_versions (block_id, version_number, content, change_note, created_by)
    values (v_block_id, 1, jsonb_build_object('kind', 'hazard', 'text', 'Hopper could drop from carry position.', 'severity', 'warning'), 'Initial NZ global seed (D-Global-03)', null)
    returning id into v_version_id;
  update public.blocks set current_version_id = v_version_id where id = v_block_id;
  -- Block 43: Pinch points
  insert into public.blocks (organisation_id, kind_slug, name, category_tags, free_text_tags, created_by)
    values (null, 'hazard', 'Pinch points', ARRAY['pinch-points', 'area-machine-repair']::text[], ARRAY[]::text[], null)
    returning id into v_block_id;
  insert into public.block_versions (block_id, version_number, content, change_note, created_by)
    values (v_block_id, 1, jsonb_build_object('kind', 'hazard', 'text', 'Pinch points.', 'severity', 'notice'), 'Initial NZ global seed (D-Global-03)', null)
    returning id into v_version_id;
  update public.blocks set current_version_id = v_version_id where id = v_block_id;
  -- Block 44: Pinch points and moving parts
  insert into public.blocks (organisation_id, kind_slug, name, category_tags, free_text_tags, created_by)
    values (null, 'hazard', 'Pinch points and moving parts', ARRAY['pinch-points', 'moving-machinery', 'area-electrical']::text[], ARRAY[]::text[], null)
    returning id into v_block_id;
  insert into public.block_versions (block_id, version_number, content, change_note, created_by)
    values (v_block_id, 1, jsonb_build_object('kind', 'hazard', 'text', 'Moving parts and pinch points.', 'severity', 'notice'), 'Initial NZ global seed (D-Global-03)', null)
    returning id into v_version_id;
  update public.blocks set current_version_id = v_version_id where id = v_block_id;
  -- Block 45: Pinch points, slips and cuts
  insert into public.blocks (organisation_id, kind_slug, name, category_tags, free_text_tags, created_by)
    values (null, 'hazard', 'Pinch points, slips and cuts', ARRAY['pinch-points', 'slips-trips', 'cuts-lacerations', 'area-machine-repair']::text[], ARRAY[]::text[], null)
    returning id into v_block_id;
  insert into public.block_versions (block_id, version_number, content, change_note, created_by)
    values (v_block_id, 1, jsonb_build_object('kind', 'hazard', 'text', 'Pinch points, slips and cuts.', 'severity', 'notice'), 'Initial NZ global seed (D-Global-03)', null)
    returning id into v_version_id;
  update public.blocks set current_version_id = v_version_id where id = v_block_id;
  -- Block 46: Vehicle collision
  insert into public.blocks (organisation_id, kind_slug, name, category_tags, free_text_tags, created_by)
    values (null, 'hazard', 'Vehicle collision', ARRAY['forklift-vehicle', 'area-finished-products']::text[], ARRAY[]::text[], null)
    returning id into v_block_id;
  insert into public.block_versions (block_id, version_number, content, change_note, created_by)
    values (v_block_id, 1, jsonb_build_object('kind', 'hazard', 'text', 'Vehicle collision.', 'severity', 'warning'), 'Initial NZ global seed (D-Global-03)', null)
    returning id into v_version_id;
  update public.blocks set current_version_id = v_version_id where id = v_block_id;
  -- Block 47: Crane or hoist operation
  insert into public.blocks (organisation_id, kind_slug, name, category_tags, free_text_tags, created_by)
    values (null, 'hazard', 'Crane or hoist operation', ARRAY['forklift-vehicle', 'falling-objects', 'area-finished-products']::text[], ARRAY[]::text[], null)
    returning id into v_block_id;
  insert into public.block_versions (block_id, version_number, content, change_note, created_by)
    values (v_block_id, 1, jsonb_build_object('kind', 'hazard', 'text', 'Crane and hoist operations.', 'severity', 'warning'), 'Initial NZ global seed (D-Global-03)', null)
    returning id into v_version_id;
  update public.blocks set current_version_id = v_version_id where id = v_block_id;
  -- Block 48: Fire risk
  insert into public.blocks (organisation_id, kind_slug, name, category_tags, free_text_tags, created_by)
    values (null, 'hazard', 'Fire risk', ARRAY['fire-explosion', 'hot-work', 'area-batch-furnace']::text[], ARRAY[]::text[], null)
    returning id into v_block_id;
  insert into public.block_versions (block_id, version_number, content, change_note, created_by)
    values (v_block_id, 1, jsonb_build_object('kind', 'hazard', 'text', 'Fire risk.', 'severity', 'critical'), 'Initial NZ global seed (D-Global-03)', null)
    returning id into v_version_id;
  update public.blocks set current_version_id = v_version_id where id = v_block_id;
  -- Block 49: Sparks ignition risk
  insert into public.blocks (organisation_id, kind_slug, name, category_tags, free_text_tags, created_by)
    values (null, 'hazard', 'Sparks ignition risk', ARRAY['fire-explosion', 'hot-work', 'area-electrical']::text[], ARRAY[]::text[], null)
    returning id into v_block_id;
  insert into public.block_versions (block_id, version_number, content, change_note, created_by)
    values (v_block_id, 1, jsonb_build_object('kind', 'hazard', 'text', 'Sparks creating ignition risk.', 'severity', 'critical'), 'Initial NZ global seed (D-Global-03)', null)
    returning id into v_version_id;
  update public.blocks set current_version_id = v_version_id where id = v_block_id;
  -- Block 50: Airborne contaminants
  insert into public.blocks (organisation_id, kind_slug, name, category_tags, free_text_tags, created_by)
    values (null, 'hazard', 'Airborne contaminants', ARRAY['dust-airborne', 'area-batch-furnace']::text[], ARRAY[]::text[], null)
    returning id into v_block_id;
  insert into public.block_versions (block_id, version_number, content, change_note, created_by)
    values (v_block_id, 1, jsonb_build_object('kind', 'hazard', 'text', 'Airborne contaminants.', 'severity', 'notice'), 'Initial NZ global seed (D-Global-03)', null)
    returning id into v_version_id;
  update public.blocks set current_version_id = v_version_id where id = v_block_id;
  -- Block 51: Dust inhalation
  insert into public.blocks (organisation_id, kind_slug, name, category_tags, free_text_tags, created_by)
    values (null, 'hazard', 'Dust inhalation', ARRAY['dust-airborne', 'eye-injury', 'area-batch-furnace']::text[], ARRAY[]::text[], null)
    returning id into v_block_id;
  insert into public.block_versions (block_id, version_number, content, change_note, created_by)
    values (v_block_id, 1, jsonb_build_object('kind', 'hazard', 'text', 'Dust inhalation and dust in the eyes.', 'severity', 'notice'), 'Initial NZ global seed (D-Global-03)', null)
    returning id into v_version_id;
  update public.blocks set current_version_id = v_version_id where id = v_block_id;
  -- Block 52: High noise levels
  insert into public.blocks (organisation_id, kind_slug, name, category_tags, free_text_tags, created_by)
    values (null, 'hazard', 'High noise levels', ARRAY['noise', 'area-forming']::text[], ARRAY[]::text[], null)
    returning id into v_block_id;
  insert into public.block_versions (block_id, version_number, content, change_note, created_by)
    values (v_block_id, 1, jsonb_build_object('kind', 'hazard', 'text', 'Noise.', 'severity', 'notice'), 'Initial NZ global seed (D-Global-03)', null)
    returning id into v_version_id;
  update public.blocks set current_version_id = v_version_id where id = v_block_id;
  -- Block 53: Noise and heat exposure
  insert into public.blocks (organisation_id, kind_slug, name, category_tags, free_text_tags, created_by)
    values (null, 'hazard', 'Noise and heat exposure', ARRAY['noise', 'burns-hot', 'area-forming']::text[], ARRAY[]::text[], null)
    returning id into v_block_id;
  insert into public.block_versions (block_id, version_number, content, change_note, created_by)
    values (v_block_id, 1, jsonb_build_object('kind', 'hazard', 'text', 'Noise and heat exposure.', 'severity', 'notice'), 'Initial NZ global seed (D-Global-03)', null)
    returning id into v_version_id;
  update public.blocks set current_version_id = v_version_id where id = v_block_id;
  -- Block 54: Gas leak
  insert into public.blocks (organisation_id, kind_slug, name, category_tags, free_text_tags, created_by)
    values (null, 'hazard', 'Gas leak', ARRAY['chemical-exposure', 'fire-explosion', 'area-batch-furnace']::text[], ARRAY[]::text[], null)
    returning id into v_block_id;
  insert into public.block_versions (block_id, version_number, content, change_note, created_by)
    values (v_block_id, 1, jsonb_build_object('kind', 'hazard', 'text', 'Gas leak creating fire hazard.', 'severity', 'critical'), 'Initial NZ global seed (D-Global-03)', null)
    returning id into v_version_id;
  update public.blocks set current_version_id = v_version_id where id = v_block_id;
  -- Block 55: Exposure to chemicals
  insert into public.blocks (organisation_id, kind_slug, name, category_tags, free_text_tags, created_by)
    values (null, 'hazard', 'Exposure to chemicals', ARRAY['chemical-exposure', 'area-plant-services']::text[], ARRAY[]::text[], null)
    returning id into v_block_id;
  insert into public.block_versions (block_id, version_number, content, change_note, created_by)
    values (v_block_id, 1, jsonb_build_object('kind', 'hazard', 'text', 'Exposure to chemicals.', 'severity', 'critical'), 'Initial NZ global seed (D-Global-03)', null)
    returning id into v_version_id;
  update public.blocks set current_version_id = v_version_id where id = v_block_id;
  -- Block 56: Eyesight risk from flying debris
  insert into public.blocks (organisation_id, kind_slug, name, category_tags, free_text_tags, created_by)
    values (null, 'hazard', 'Eyesight risk from flying debris', ARRAY['flying-debris', 'eye-injury', 'area-machine-repair']::text[], ARRAY[]::text[], null)
    returning id into v_block_id;
  insert into public.block_versions (block_id, version_number, content, change_note, created_by)
    values (v_block_id, 1, jsonb_build_object('kind', 'hazard', 'text', 'Eyesight risk from small flying objects, dust inhalation, and skin damage.', 'severity', 'warning'), 'Initial NZ global seed (D-Global-03)', null)
    returning id into v_version_id;
  update public.blocks set current_version_id = v_version_id where id = v_block_id;
  -- Block 57: Pressurised fluid release
  insert into public.blocks (organisation_id, kind_slug, name, category_tags, free_text_tags, created_by)
    values (null, 'hazard', 'Pressurised fluid release', ARRAY['pressurised-fluid', 'area-machine-repair']::text[], ARRAY[]::text[], null)
    returning id into v_block_id;
  insert into public.block_versions (block_id, version_number, content, change_note, created_by)
    values (v_block_id, 1, jsonb_build_object('kind', 'hazard', 'text', 'Pressurised fluid release on disconnect.', 'severity', 'critical'), 'Initial NZ global seed (D-Global-03)', null)
    returning id into v_version_id;
  update public.blocks set current_version_id = v_version_id where id = v_block_id;

  -- ============================================================
  -- PPE blocks
  -- ============================================================

  -- Block 1: Safety Glasses
  insert into public.blocks (organisation_id, kind_slug, name, category_tags, free_text_tags, created_by)
    values (null, 'ppe', 'Safety Glasses', ARRAY['eye-injury']::text[], ARRAY[]::text[], null)
    returning id into v_block_id;
  insert into public.block_versions (block_id, version_number, content, change_note, created_by)
    values (v_block_id, 1, jsonb_build_object('kind', 'ppe', 'items', jsonb_build_array('Safety glasses (Z87.1 or AS/NZS 1337 rated)')), 'Initial NZ global seed (D-Global-03)', null)
    returning id into v_version_id;
  update public.blocks set current_version_id = v_version_id where id = v_block_id;
  -- Block 2: Hearing Protection
  insert into public.blocks (organisation_id, kind_slug, name, category_tags, free_text_tags, created_by)
    values (null, 'ppe', 'Hearing Protection', ARRAY['noise']::text[], ARRAY[]::text[], null)
    returning id into v_block_id;
  insert into public.block_versions (block_id, version_number, content, change_note, created_by)
    values (v_block_id, 1, jsonb_build_object('kind', 'ppe', 'items', jsonb_build_array('Class 4 ear muffs or Class 5 ear plugs (NRR >= 25 dB)')), 'Initial NZ global seed (D-Global-03)', null)
    returning id into v_version_id;
  update public.blocks set current_version_id = v_version_id where id = v_block_id;
  -- Block 3: Hi-Viz Vest
  insert into public.blocks (organisation_id, kind_slug, name, category_tags, free_text_tags, created_by)
    values (null, 'ppe', 'Hi-Viz Vest', ARRAY['forklift-vehicle']::text[], ARRAY[]::text[], null)
    returning id into v_block_id;
  insert into public.block_versions (block_id, version_number, content, change_note, created_by)
    values (v_block_id, 1, jsonb_build_object('kind', 'ppe', 'items', jsonb_build_array('AS/NZS 4602 Class D/N hi-viz vest or jacket')), 'Initial NZ global seed (D-Global-03)', null)
    returning id into v_version_id;
  update public.blocks set current_version_id = v_version_id where id = v_block_id;
  -- Block 4: Hard Hat
  insert into public.blocks (organisation_id, kind_slug, name, category_tags, free_text_tags, created_by)
    values (null, 'ppe', 'Hard Hat', ARRAY['falling-objects']::text[], ARRAY[]::text[], null)
    returning id into v_block_id;
  insert into public.block_versions (block_id, version_number, content, change_note, created_by)
    values (v_block_id, 1, jsonb_build_object('kind', 'ppe', 'items', jsonb_build_array('AS/NZS 1801 Type 1 hard hat')), 'Initial NZ global seed (D-Global-03)', null)
    returning id into v_version_id;
  update public.blocks set current_version_id = v_version_id where id = v_block_id;
  -- Block 5: Steel-Toe Safety Boots
  insert into public.blocks (organisation_id, kind_slug, name, category_tags, free_text_tags, created_by)
    values (null, 'ppe', 'Steel-Toe Safety Boots', ARRAY['crush-entrapment', 'falling-objects']::text[], ARRAY[]::text[], null)
    returning id into v_block_id;
  insert into public.block_versions (block_id, version_number, content, change_note, created_by)
    values (v_block_id, 1, jsonb_build_object('kind', 'ppe', 'items', jsonb_build_array('AS/NZS 2210.3 safety footwear with steel toe cap and oil-resistant sole')), 'Initial NZ global seed (D-Global-03)', null)
    returning id into v_version_id;
  update public.blocks set current_version_id = v_version_id where id = v_block_id;

  -- ============================================================
  -- Step pattern blocks
  -- ============================================================

  -- Block 1: Lock-out / Tag-out (LOTO)
  insert into public.blocks (organisation_id, kind_slug, name, category_tags, free_text_tags, created_by)
    values (null, 'step', 'Lock-out / Tag-out (LOTO)', ARRAY['isolation-energy', 'electrocution']::text[], ARRAY[]::text[], null)
    returning id into v_block_id;
  insert into public.block_versions (block_id, version_number, content, change_note, created_by)
    values (v_block_id, 1, jsonb_build_object('kind', 'step', 'text', 'Isolate the energy source, apply personal lock and tag, verify zero energy state before commencing work.', 'warning', 'Never remove another worker''s lock or tag.', 'tip', 'Photograph the isolation point as evidence.'), 'Initial NZ global seed (D-Global-03)', null)
    returning id into v_version_id;
  update public.blocks set current_version_id = v_version_id where id = v_block_id;
  -- Block 2: Manual Handling — Lift Technique
  insert into public.blocks (organisation_id, kind_slug, name, category_tags, free_text_tags, created_by)
    values (null, 'step', 'Manual Handling — Lift Technique', ARRAY['manual-handling-strain']::text[], ARRAY[]::text[], null)
    returning id into v_block_id;
  insert into public.block_versions (block_id, version_number, content, change_note, created_by)
    values (v_block_id, 1, jsonb_build_object('kind', 'step', 'text', 'Assess the load, plan the route, bend at the knees not the back, keep the load close to your body, lift smoothly.', 'warning', 'If the load exceeds 25 kg single-person, request mechanical aid or two-person lift.', 'tip', 'Use trolleys for any distance > 5 metres.'), 'Initial NZ global seed (D-Global-03)', null)
    returning id into v_version_id;
  update public.blocks set current_version_id = v_version_id where id = v_block_id;
  -- Block 3: Hot Work Permit Check
  insert into public.blocks (organisation_id, kind_slug, name, category_tags, free_text_tags, created_by)
    values (null, 'step', 'Hot Work Permit Check', ARRAY['hot-work', 'fire-explosion']::text[], ARRAY[]::text[], null)
    returning id into v_block_id;
  insert into public.block_versions (block_id, version_number, content, change_note, created_by)
    values (v_block_id, 1, jsonb_build_object('kind', 'step', 'text', 'Confirm a current hot work permit is in place, fire watch is assigned, fire extinguisher is within 3 metres, and combustibles within 11 metres are removed or shielded.', 'warning', 'No hot work proceeds without a permit.', 'tip', 'Permit expires daily — re-issue each shift.'), 'Initial NZ global seed (D-Global-03)', null)
    returning id into v_version_id;
  update public.blocks set current_version_id = v_version_id where id = v_block_id;

end $$;

commit;
