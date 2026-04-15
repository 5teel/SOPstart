---
phase: 11-section-schema-block-foundation
plan: "01"
subsystem: section-schema
tags: [schema, migration, rls, section-kinds, blocks, block-versions]
one_liner: "Additive migration 00019 lands section_kinds catalog, blocks library, block_versions history, and sop_section_blocks junction with full RLS + type regen."
dependency_graph:
  requires:
    - "00001_foundation_schema.sql (organisations, current_organisation_id, current_user_role)"
    - "00003_sop_schema.sql (sop_sections, sops)"
  provides:
    - "public.section_kinds table + 7 canonical global seeds"
    - "public.blocks, public.block_versions, public.sop_section_blocks tables"
    - "sop_sections.section_kind_id advisory FK"
    - "RLS read = globals + own-org; write = own-org admin/safety_manager only"
    - "database.types.ts shapes for Plan 11-02 typed surface"
  affects:
    - "supabase/migrations/00019_section_kinds_and_blocks.sql"
    - "src/types/database.types.ts"
tech_stack:
  added:
    - "Postgres discriminated-union jsonb blocks (content + snapshot_content)"
  patterns:
    - "coalesce(org_id, sentinel) unique index for global+org scoping"
    - "deferrable circular FK blocks.current_version_id ↔ block_versions.id"
    - "append-only RLS (no UPDATE/DELETE policies on block_versions)"
    - "offline-first snapshot_content cached at insertion time"
key_files:
  created:
    - "supabase/migrations/00019_section_kinds_and_blocks.sql"
  modified:
    - "src/types/database.types.ts"
decisions:
  - "No UNIQUE on (sop_section_id, block_id) — multi-instance same-block allowed"
  - "snapshot_content jsonb NOT NULL — workers never join block_versions at read time"
  - "section_kinds scope uniqueness via coalesce-sentinel index (NULL org vs real org distinct)"
  - "block_versions is append-only: SELECT + INSERT policies only, UPDATE/DELETE forbidden for authenticated role"
  - "database.types.ts updated by hand (no live DB in worktree) — orchestrator runs supabase db push after wave"
metrics:
  duration: "~4 minutes"
  tasks_completed: 4
  files_created: 1
  files_modified: 1
  completed_date: "2026-04-15"
requirements_satisfied:
  - SB-SECT-01
  - SB-SECT-02
  - SB-SECT-03
  - SB-SECT-04
---

# Phase 11 Plan 01: Section Schema + Block Library Foundation Summary

## One-liner

Additive migration 00019 lands `section_kinds` catalog, `blocks` library, `block_versions` history, and `sop_section_blocks` junction with full RLS + type regen. No existing tables, policies, or rows are modified beyond a nullable advisory FK and a fuzzy backfill.

## Tasks Completed

| Task | Name | Commit | Key Changes |
|------|------|--------|-------------|
| 1 | Migration 00019 — section_kinds catalog + seed + advisory FK | `e4e97d5` | `section_kinds` table, scope-unique index, 7 canonical seeds, `sop_sections.section_kind_id`, fuzzy backfill |
| 2 | Migration 00019 — blocks, block_versions, sop_section_blocks | `6cb87e1` | `blocks` (+ partial index), `block_versions` (append-only), deferrable circular FK, `sop_section_blocks` with `snapshot_content` |
| 3 | Migration 00019 — RLS policies | `f270d39` | RLS enabled on 4 tables, 12+ policies (read globals+own-org, write own-org admin only, block_versions append-only) |
| 4 | Update database.types.ts | `4aa434c` | Hand-written types for 4 new tables + `section_kind_id: string \| null` on `sop_sections` |

## Schema Surface

### New Tables (4)

1. **`section_kinds`** — Catalog of section kinds. Globals (org_id=NULL) plus per-org customs. Scope-unique via `coalesce(org_id, '0000...'::uuid), slug`.
2. **`blocks`** — Reusable block definitions. Partial index `idx_blocks_org_kind WHERE archived_at IS NULL`.
3. **`block_versions`** — Append-only history. `unique(block_id, version_number)`. Blocks.current_version_id is a deferrable circular FK.
4. **`sop_section_blocks`** — Junction with `pin_mode` (`pinned`|`follow_latest`), mandatory `snapshot_content jsonb not null`, `update_available` flag, `overridden_at` timestamp.

### Modified Tables (1)

- **`sop_sections`** — Added `section_kind_id uuid references section_kinds(id) on delete set null` (nullable, advisory). Indexed `idx_sop_sections_kind`. No unique constraint on `(sop_id, section_kind_id)` so SB-SECT-01 multi-section-of-same-kind is allowed.

### Canonical Seed Rows (7)

| slug | display_name | render_family | icon | color_family | priority |
|------|--------------|---------------|------|--------------|----------|
| hazards | Hazards | hazard | AlertTriangle | red-400 | 10 |
| ppe | PPE | ppe | ShieldCheck | blue-400 | 20 |
| content | Overview | content | FileText | steel-100 | 30 |
| steps | Steps | steps | ListChecks | brand-yellow | 40 |
| emergency | Emergency | emergency | Siren | red-400 | 50 |
| signoff | Sign-off | signoff | CheckCircle2 | green-400 | 90 |
| custom | Custom | custom | Sparkles | steel-100 | 99 |

All seeded with `organisation_id IS NULL` and `ON CONFLICT DO NOTHING` (idempotent).

### Backfill

Legacy `sop_sections.section_type` free-text rows are fuzzy-matched to canonical slugs:
- Direct: `lower(section_type) = slug`
- `hazards`: substring `%hazard%`
- `ppe`: substring `%ppe%` or `%protective%`
- `emergency`: substring `%emergency%`
- `steps`: `steps` or `%procedure%`
- `signoff`: `%sign%off%` or `%sign_off%`
- `content`: in `('overview','notes','scope','content','introduction')`

Non-matching rows stay NULL; renderer falls back to legacy `section_type` substring matching.

## RLS Policy Count

Enabled on all 4 new tables. Policies written:

| Table | SELECT | INSERT | UPDATE | DELETE | Total |
|-------|--------|--------|--------|--------|-------|
| section_kinds | 1 | 1 | 1 | 1 | 4 |
| blocks | 1 | 1 | 1 | 1 | 4 |
| block_versions | 1 | 1 | 0 | 0 | 2 (append-only) |
| sop_section_blocks | 1 | 1 (via FOR ALL) | — | — | 2 named (1 read + 1 FOR ALL manage) |

**Total: 12 named policies.** (Verification criterion: `>= 12` policies ✓.)

**Write invariants enforced:**
- All INSERT/UPDATE/DELETE `with check`/`using` clauses require `organisation_id = public.current_organisation_id()` — explicit non-NULL equality, so authenticated users cannot write `organisation_id IS NULL` rows. Globals are seeded via migration (service_role context) only.
- All writes also require `public.current_user_role() in ('admin','safety_manager')`.
- `block_versions` has SELECT + INSERT only — no UPDATE or DELETE policies for authenticated role (immutable history).
- `sop_section_blocks` scopes via EXISTS join `sop_sections → sops` filtered by `current_organisation_id()`.

Task-3 verification script explicitly fails if any `insert` policy allows NULL org_id.

## Threat Model Mitigations

All STRIDE dispositions marked `mitigate` in PLAN `<threat_model>` are satisfied:

| Threat ID | Mitigation Delivered |
|-----------|---------------------|
| T-11-01-01 (EoP) | All write policies require non-NULL org + admin role; verify script greps for NULL-org insert |
| T-11-01-02 (Tampering) | `block_versions` has no UPDATE/DELETE policies for authenticated |
| T-11-01-03 (Info Disclosure, blocks) | `blocks_read_global_plus_org` + `block_versions_read_via_blocks` + `ssb_read_own_org` all scope by org |
| T-11-01-04 (Info Disclosure, section_kinds) | `section_kinds_read_global_plus_org` unions NULL + own-org only |
| T-11-01-07 (Injection) | Pure DDL + literal seed strings; no dynamic SQL |
| T-11-01-08 (Secrets) | No tokens/PII in migration |
| T-11-01-09 (Spoofing via NULL FK) | Coalesce-sentinel unique index keeps NULL-org and per-org slugs distinct |

Accepted (documented): T-11-01-05 (snapshot_content drift) and T-11-01-06 (jsonb DoS) — application-layer concerns deferred to later phases.

## Deviations from Plan

### Task 2 — Circular FK wrapped in `DO $$` block

**Found during:** Task 2 commit.
**Rule:** Rule 3 (blocking issue, idempotency).
**Issue:** The plan's raw `alter table ... add constraint ... deferrable initially deferred` is not idempotent — re-running the migration would fail with "constraint already exists."
**Fix:** Wrapped the `ADD CONSTRAINT` in a `DO $$ ... IF NOT EXISTS (select 1 from pg_constraint ...)` block so the migration stays idempotent like the rest of the `create table if not exists` / `create index if not exists` pattern used in the file.
**Files modified:** `supabase/migrations/00019_section_kinds_and_blocks.sql` (Step 5 only).
**Commit:** `6cb87e1`.

### Task 4 — database.types.ts hand-written instead of regenerated

**Found during:** Task 4 start.
**Rule:** Orchestrator instruction (not a rule deviation).
**Issue:** The worktree has no live Supabase connection to run `npx supabase gen types typescript`. The orchestrator's `<important_notes>` explicitly instructs to update `database.types.ts` by hand instead of running the generator.
**Fix:** Manually added Row/Insert/Update/Relationships blocks for `section_kinds`, `blocks`, `block_versions`, `sop_section_blocks` and added `section_kind_id: string | null` to `sop_sections` Row/Insert/Update. Placed the new tables adjacent to `sop_sections` (not strictly alphabetical because the existing file is not alphabetised).
**Files modified:** `src/types/database.types.ts`.
**Commit:** `4aa434c`.
**Note for operator:** After the wave, running `supabase db push` + `supabase gen types typescript --local` may produce a slightly different field ordering or relationship-name format. Any such re-ordering is cosmetic and should replace the hand-written block wholesale.

## Notes for Operator

1. **`supabase db push` was NOT run** per orchestrator instruction. The orchestrator will verify schema drift after all wave-1 worktrees merge.
2. **Canonical seeds use `on conflict do nothing`** so re-running the migration won't duplicate them.
3. **Deferrable circular FK** requires the block/version insert in application code to happen inside a single transaction so the constraint check is deferred until COMMIT:
   ```sql
   begin;
     insert into blocks (id, ...) values (:block_id, ...);
     insert into block_versions (id, block_id, version_number, content) values (:v1, :block_id, 1, :json);
     update blocks set current_version_id = :v1 where id = :block_id;
   commit;
   ```
4. **Seed row verification** (run post-push):
   ```sql
   select slug, display_name, render_family, render_priority
     from public.section_kinds
    where organisation_id is null
    order by render_priority;
   -- Expect 7 rows: hazards, ppe, content, steps, emergency, signoff, custom
   ```
5. **RLS policy count verification**:
   ```sql
   select count(*) from pg_policies
    where tablename in ('section_kinds','blocks','block_versions','sop_section_blocks');
   -- Expect 12
   ```

## Pitfalls Encountered

None. The only concern worth flagging:

- The plan's `Task 2` text literally adds `alter table public.blocks add constraint ...` without an `IF NOT EXISTS`. Postgres has no `add constraint if not exists` — the only safe forms are `DO $$ / pg_constraint` or dropping first. I used the `DO $$` guard so the migration is safely re-runnable in dev loops. Documented above as a deviation.

## Verification Results

### Automated Verify Checks
- Task 1: `OK` (all required DDL + seeds + FK present)
- Task 2: `OK` (all three new tables, circular FK, unique index, pin_mode, snapshot_content present)
- Task 3: `OK` (RLS enabled on 4 tables, 12+ policies, no NULL-org insert policy detected)
- Task 4: `OK` (database.types.ts contains section_kinds, blocks, block_versions, sop_section_blocks, section_kind_id)

### Manual Checks Against Success Criteria
- [x] `supabase/migrations/00019_section_kinds_and_blocks.sql` exists (288 lines)
- [x] Contains 4 new tables
- [x] `sop_sections.section_kind_id` advisory FK exists and is nullable
- [x] 7 canonical seed rows inserted with `organisation_id IS NULL`
- [x] RLS enabled on all 4 tables with read = globals + own-org; write = own-org admin only
- [x] `block_versions` has no authenticated UPDATE/DELETE policy
- [ ] Migration applied against dev DB (DEFERRED — orchestrator runs `supabase db push` after wave)
- [x] `src/types/database.types.ts` regenerated (hand-written) with new table shapes
- [x] Four atomic commits (catalog+seed+FK → blocks/versions/junction → RLS → types regen)
- [x] No existing tables or RLS policies modified (purely additive; only column added to sop_sections)

## Known Stubs

None. All tables, seeds, policies, and type shapes are real and complete.

## Self-Check: PASSED

- `supabase/migrations/00019_section_kinds_and_blocks.sql`: FOUND (288 lines)
- `src/types/database.types.ts`: FOUND (contains new tables)
- Commits: `e4e97d5`, `6cb87e1`, `f270d39`, `4aa434c` all in git log
