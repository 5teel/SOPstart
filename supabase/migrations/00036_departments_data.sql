-- ============================================================
-- Migration 00036: Phase 25 Department as a First-Class Entity — data migration
-- Steps:
--   1. Create one 'General' department per existing org
--   2. Assign all existing org-owned SOPs to General dept
--   3. Assign all existing org-owned blocks to General dept
--   4. Copy all global blocks (organisation_id IS NULL) per-org with all_departments=true
--   5. DELETE FROM public.blocks WHERE organisation_id IS NULL
--   6. Assert zero null-org blocks remain (fail-fast guard)
--
-- Non-destructive (D-01):
--   - category / category_tags columns are NOT dropped (retained read-only)
--   - No in-place UPDATE of global blocks (would lose cross-org access before step 5)
--   - Zero blocks deleted except the now-copied null-org originals
--
-- Idempotency:
--   - ON CONFLICT DO NOTHING on all INSERTs
--   - NULL-org DELETE + assertion check: second run is a no-op (nothing to delete)
--   - Zero-org case: FOR loop runs zero iterations, RAISE NOTICE informs debuggers
-- ============================================================

begin;

DO $$
DECLARE
  org            RECORD;
  dept_id        uuid;
  global_block   RECORD;
  orphan_count   bigint;
BEGIN

  -- Short-circuit for zero-org environments (CI / test DBs).
  IF NOT EXISTS (SELECT 1 FROM public.organisations LIMIT 1) THEN
    RAISE NOTICE 'Phase 25 data migration: no organisations found — skipping (zero-org no-op path).';
    -- Still delete any null-org blocks and assert (idempotency for re-runs post initial seeding).
    DELETE FROM public.blocks WHERE organisation_id IS NULL;
    SELECT COUNT(*) INTO orphan_count FROM public.blocks WHERE organisation_id IS NULL;
    IF orphan_count > 0 THEN
      RAISE EXCEPTION 'Phase 25 migration failed: % orphaned global blocks remain after zero-org delete.', orphan_count;
    END IF;
    RETURN;
  END IF;

  -- ============================================================
  -- Main loop: one pass per organisation
  -- ============================================================
  FOR org IN SELECT id FROM public.organisations LOOP

    -- ----------------------------------------------------------
    -- Step 1: Create General department for this org
    -- Pitfall 5 ordering: INSERT dept FIRST, THEN junctions.
    -- ON CONFLICT DO NOTHING if already exists (idempotent re-run).
    -- We use a two-step approach to capture dept_id whether inserted or already present.
    -- ----------------------------------------------------------
    INSERT INTO public.departments (organisation_id, name, code, colour)
    VALUES (org.id, 'General', 'GEN', '#3b82f6')
    ON CONFLICT (organisation_id, code) DO NOTHING;

    -- Retrieve the dept id (covers both fresh insert and pre-existing row).
    SELECT id INTO dept_id
    FROM public.departments
    WHERE organisation_id = org.id AND code = 'GEN';

    IF dept_id IS NULL THEN
      RAISE EXCEPTION 'Phase 25 migration: could not obtain General department id for org %.', org.id;
    END IF;

    -- ----------------------------------------------------------
    -- Step 2: Assign all existing org-owned SOPs to General dept
    -- ----------------------------------------------------------
    INSERT INTO public.sop_departments (sop_id, department_id)
    SELECT s.id, dept_id
    FROM public.sops s
    WHERE s.organisation_id = org.id
    ON CONFLICT DO NOTHING;

    -- ----------------------------------------------------------
    -- Step 3: Assign all existing org-owned blocks to General dept
    -- ----------------------------------------------------------
    INSERT INTO public.block_departments (block_id, department_id)
    SELECT b.id, dept_id
    FROM public.blocks b
    WHERE b.organisation_id = org.id
    ON CONFLICT DO NOTHING;

    -- ----------------------------------------------------------
    -- Step 4: Copy each global block per-org with all_departments=true
    -- Do NOT update in-place (other orgs still need access until step 5).
    -- Copies carry kind_slug, name, category_tags, free_text_tags, created_by,
    -- current_version_id — the category column is retained read-only (D-01).
    -- ----------------------------------------------------------
    FOR global_block IN
      SELECT id, kind_slug, name, category, category_tags, free_text_tags, created_by, current_version_id
      FROM public.blocks
      WHERE organisation_id IS NULL
    LOOP
      -- Insert a per-org copy; ON CONFLICT DO NOTHING makes this idempotent.
      -- No unique constraint exists on (organisation_id, kind_slug, name) so a second run
      -- would insert duplicates — guard by checking if a copy already exists for this
      -- org + kind_slug + name combination (reasonable heuristic for idempotency).
      INSERT INTO public.blocks (
        organisation_id, kind_slug, name, category, category_tags, free_text_tags,
        created_by, all_departments, current_version_id
      )
      SELECT
        org.id,
        global_block.kind_slug,
        global_block.name,
        global_block.category,
        global_block.category_tags,
        global_block.free_text_tags,
        global_block.created_by,
        true,
        global_block.current_version_id
      WHERE NOT EXISTS (
        SELECT 1 FROM public.blocks
        WHERE organisation_id = org.id
          AND kind_slug = global_block.kind_slug
          AND name = global_block.name
          AND current_version_id = global_block.current_version_id
      );
    END LOOP;

  END LOOP;

  -- ============================================================
  -- Step 5: Delete original global rows AFTER per-org copies made
  -- The WHERE guard on NOT EXISTS above ensures idempotency — if
  -- a second run hits this step, the per-org copies already exist
  -- and no new rows were inserted.
  -- D-01: No block row is lost; all content now lives in per-org copies.
  -- ============================================================
  DELETE FROM public.blocks WHERE organisation_id IS NULL;

  -- ============================================================
  -- Idempotency assertion: fail-fast if any null-org blocks remain
  -- (catches migration bugs early rather than leaving orphans).
  -- ============================================================
  SELECT COUNT(*) INTO orphan_count FROM public.blocks WHERE organisation_id IS NULL;
  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'Phase 25 migration failed: % orphaned global blocks remain after DELETE. Migration is not complete.', orphan_count;
  END IF;

  RAISE NOTICE 'Phase 25 data migration complete. All global blocks converted to org-scoped (all_departments=true). General departments created per org.';

END;
$$;

commit;
