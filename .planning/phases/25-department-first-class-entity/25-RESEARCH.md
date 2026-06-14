---

## Open Questions (RESOLVED)

1. **`block_suggestions` table fate**
   - What we know: The `block_suggestions` table exists with its RLS policies and is written to by `saveFromSection(scope: 'suggest_global')`. The global promotion model is removed by Phase 25.
   - What's unclear: CONTEXT.md does not say whether to drop the table or leave it abandoned.
   - Recommendation: Drop the table and its policies in migration 00037. Remove `scope: 'suggest_global'` from `CreateBlockInput` and `SaveFromSectionInput`. Log in CLAUDE.md learnings that `block_suggestions` was sunset in Phase 25. If any UI component renders suggestion-related UI (e.g., a "Suggest for global" button), it must be removed.
   - **RESOLVED:** Plan 01 Task 3 drops `block_suggestions` + its policies in migration `00037_departments_rls_cleanup.sql` (`drop table if exists public.block_suggestions cascade`). Plan 03 Task 2 removes `scope: 'suggest_global'` from `CreateBlockInput`/`SaveFromSectionInput` in `blocks.ts` and deletes the `listBlockSuggestions`/`promoteSuggestion`/`rejectSuggestion`/`requirePlatformAdmin` actions; Plan 05 Task 2 removes the "Suggest for global" radio from `SaveToLibraryModal.tsx`. A CLAUDE.md learnings entry recording the Phase 25 sunset is to be added at phase completion.

2. **Multi-org block copy: what if no organisations exist at migration time?**
   - What we know: The data migration must copy 65 global blocks per org. In production there is at least one org. In CI/test environments there may be zero.
   - What's unclear: Whether migration 00036 should be a no-op if `organisations` table is empty.
   - Recommendation: The PL/pgSQL block should simply have zero iterations if no orgs exist (a `FOR org IN SELECT ... LOOP` with no rows is safe). Add an explicit `IF NOT FOUND THEN RAISE NOTICE` for debuggability.
   - **RESOLVED:** Plan 01 Task 2's `00036_departments_data.sql` uses copy-per-org (NOT convert-in-place): for each org it inserts a per-org copy of every `organisation_id IS NULL` global block with `all_departments=true`, then `DELETE FROM public.blocks WHERE organisation_id IS NULL` after the loop. The zero-org case is a no-op (a `FOR org IN SELECT ... LOOP` with no rows runs zero iterations) with a `RAISE NOTICE` no-op-safe path; an end-of-migration `RAISE EXCEPTION` asserts zero remaining null-org blocks. In-place `update public.blocks set organisation_id` is explicitly grep-guarded against (would lose cross-org access).

3. **`CategoryBottomSheet` consumer inventory**
   - What we know: It is exported from `src/components/sop/CategoryBottomSheet.tsx` and used in the SOP library worker view (likely in `src/app/(protected)/sops/page.tsx` or similar).
   - What's unclear: Whether the worker SOP library uses free-text `category` or `category_tag` or neither for filtering; Phase 25 scope says the library browse is gated by `sop_departments`/RLS, not by a client-side category filter.
   - Recommendation: Planner should grep `CategoryBottomSheet` and `CategorySidebar` for all consumers before deciding whether to extend or retire the component.
   - **RESOLVED:** Sole consumer identified as the worker SOP library at `src/app/(protected)/sops/page.tsx` (import L23, `CategorySidebar` L154, `CategoryBottomSheet` L179); the admin `admin/sops` create path is migrated separately via the wizard/AI department field. Plan 05 Task 3 reshapes `CategoryBottomSheet`/`CategorySidebar` to department props (departments/selectedIds/allDepartments/onSelect) and updates that single consumer; Plan 06 covers the `admin/sops/new/{blank,ai}` create-path department selection. Actual visibility remains the `sops_visible_by_department` RLS gate (Plan 01), not the in-page selector.
