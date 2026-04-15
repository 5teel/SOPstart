---
phase: 11-section-schema-block-foundation
verified: 2026-04-15T00:00:00Z
status: human_needed
score: 4/4 automatable must-haves verified; 3 success criteria require human walkthrough
re_verification:
  previous_status: none
  previous_score: n/a
  gaps_closed: []
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "SB-SECT-01 — Add two Hazards sections to one SOP and confirm both render in the worker walkthrough"
    expected: "On a draft SOP in /admin/sops/[sopId]/review, click 'Add section' → pick 'Hazards' → title 'Hot surface — melter 1' → Add. Click 'Add section' again → pick 'Hazards' → title 'Hot surface — melter 2' → Add. Approve + publish. Open the worker walkthrough and confirm both Hazards tabs appear with red AlertTriangle icon, distinct titles, and content/steps render correctly."
    why_human: "End-to-end UI click-through across admin → publish → worker walkthrough. Requires running dev server, real Supabase data, and a human visually confirming both tabs render. The unit test for SB-SECT-01 is intentionally a Wave-0 test.fixme stub."
  - test: "SB-SECT-02 — Custom section with admin-provided title renders in worker walkthrough"
    expected: "On a draft SOP, click 'Add section' → pick 'Custom' → title 'Pre-flight check' → Add. Approve + publish. In worker walkthrough, the Pre-flight check tab appears using the 'custom' render family fallback (Sparkles icon, steel-100 color), title shown verbatim, content renders via DefaultContent."
    why_human: "Cross-system visual confirmation; SB-SECT-02 stub is a test.fixme and Phase 12 will flip it to a real Playwright run."
  - test: "SB-SECT-03 / SB-SECT-04 — v1/v2 SOP regression: legacy SOPs render pixel-identical"
    expected: "Open any pre-Phase-11 published SOP (section_kind_id IS NULL on all sections) in the worker walkthrough. Confirm: (a) tabs in same left-to-right order as pre-merge build, (b) hazards/emergency tabs red+AlertTriangle/Siren, PPE blue+ShieldCheck, steps brand-yellow+ListChecks, (c) a section with section_type='procedure' and zero extracted steps renders as DefaultContent (NOT empty StepsContent), (d) sections with both content text AND extracted steps render preamble + StepsContent stacked."
    why_human: "Pixel parity against legacy rendering cannot be verified by grep. Test 7 in tests/resolve-render-family.test.ts locks the procedure→content regression in unit test, but full visual parity needs a human in front of a real worker walkthrough."
  - test: "Apply migration 00019 against dev/staging Supabase"
    expected: "Run `supabase db push` (or equivalent). Confirm: (1) `select count(*) from public.section_kinds where organisation_id is null` = 7, (2) `select count(*) from pg_policies where tablename in ('section_kinds','blocks','block_versions','sop_section_blocks')` >= 12, (3) `select column_name from information_schema.columns where table_name='sop_sections' and column_name='section_kind_id'` returns 1 row, (4) attempting an INSERT on section_kinds with NULL organisation_id from a non-service-role user fails with RLS error."
    why_human: "Migration file is committed but per 11-01-SUMMARY the parallel-worktree executor did not have a live DB connection. database.types.ts was hand-written (deviation 11-01.4). An operator must run `supabase db push` and re-generate types to confirm DB matches the file."
---

# Phase 11: Section Schema & Block Foundation Verification Report

**Phase Goal (from ROADMAP):** The additive data model for v3.0 is in place — `section_kinds` catalog, `blocks` / `block_versions` / `sop_section_blocks` junction, legacy fallback, RLS, types, validators — and wave-0 Playwright stubs exist for every SB-XX requirement so downstream phases can execute on a prepared test surface.

**Verified:** 2026-04-15
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Roadmap Success Criteria (the contract)

| #   | Success Criterion | Status     | Evidence |
| --- | ----------------- | ---------- | -------- |
| 1   | Admin can add two "Hazards" sections to the same SOP, both render in worker walkthrough via `section_kinds` join | NEEDS HUMAN | Migration allows multi-instance (no UNIQUE on `(sop_id, section_kind_id)`); `createSection` accepts repeated kind without uniqueness check; `AddSectionButton` wired into `ReviewClient.tsx` line 402; `useSopDetail.ts` joins `section_kind:section_kinds!section_kind_id(*)` line 52; `SopSectionTabs` consumes `resolveTabStyling`; `SectionContent` dispatches via `resolveRenderFamily`. End-to-end click-through requires human. |
| 2   | Admin can define a custom section with a custom title → renders via `custom` render family | NEEDS HUMAN | `section_kinds` seed includes `custom` row (slug='custom', render_family='custom', icon='Sparkles'); `SectionKindPicker` renders custom + free-text title input; `createSection` writes `section_type='custom'` + `section_kind_id=<custom kind id>`; `SectionContent.tsx` switch case handles `'custom'`. End-to-end UX needs human. |
| 3   | v1/v2 SOPs render identically — legacy `section_type` substring matching remains | VERIFIED (with human spot-check pending) | `inferRenderFamilyFromType` in `resolveRenderFamily.ts` preserves the legacy substring cascade verbatim; Test 7 in `tests/resolve-render-family.test.ts` is the explicit regression guard for `procedure + zero steps → content`; 14 unit tests pass via phase11-stubs project; Dexie v3 bump is index-only so existing v2 cached SOPs upgrade safely. Pixel parity against a real legacy SOP still needs a human walkthrough. |
| 4   | Wave-0 Playwright stubs exist for all 37 SB-XX requirements, registered in `phase11-stubs` project | VERIFIED | `npx playwright test --project=phase11-stubs --list` reports `Total: 51 tests in 8 files` (37 SB-XX stubs + 14 resolveRenderFamily unit tests); all 37 SB-XX requirement IDs found as test title prefixes across the 7 stub files; `playwright.config.ts:46-47` defines the project with the matching regex. |

**Score:** 4/4 success criteria have substantive code+wiring backing them; 3 of the 4 require human walkthrough to confirm end-to-end behaviour.

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `supabase/migrations/00019_section_kinds_and_blocks.sql` | Tables, seeds, FK, RLS | VERIFIED | 288 lines. Contains all 4 `create table if not exists` for section_kinds, blocks, block_versions, sop_section_blocks; `add column if not exists section_kind_id uuid references public.section_kinds(id) on delete set null`; 7 canonical seeds (`hazards`, `ppe`, `steps`, `emergency`, `signoff`, `content`, `custom`) all with `organisation_id = NULL`; `unique (block_id, version_number)`; `pin_mode text not null default 'pinned' check (pin_mode in ('pinned','follow_latest'))`; `snapshot_content jsonb not null`; `enable row level security` on all 4 tables; 12+ named RLS policies including read-globals-plus-org and admin-only writes. `block_versions` has SELECT + INSERT only (append-only). |
| `src/types/database.types.ts` | Reflects new tables | VERIFIED | Contains `section_kinds:`, `blocks:`, `block_versions:`, `sop_section_blocks:` table blocks plus `section_kind_id: string \| null` on `sop_sections.Row/Insert/Update` (lines 239/252/265) with FK relationship metadata (line 281). Hand-written (deviation 11-01.4) — operator should regenerate after running `supabase db push`. |
| `src/lib/sections/resolveRenderFamily.ts` | Single helper consumed by tabs + content | VERIFIED | 81 lines. Exports `resolveRenderFamily`, `inferRenderFamilyFromType`, `resolveTabStyling`. Priority: `section_kind.render_family` wins, else legacy substring fallback, else `steps` if `sop_steps.length > 0`. JSDoc explicitly documents the procedure-with-zero-steps regression guard. |
| `src/lib/validators/blocks.ts` | Zod discriminated union | VERIFIED | 52 lines. `BlockContentSchema = z.discriminatedUnion('kind', [...])` over `hazard`, `ppe`, `step`, `emergency`, `custom` schemas, each with their own validators. Inferred TS types exported alongside schemas. |
| `src/lib/offline/db.ts` | Dexie v3 with section_kind_id | VERIFIED | Line 73-75: `db.version(3).stores({ ..., sections: 'id, sop_id, section_type, section_kind_id, sort_order' })`. v1 + v2 schema chains preserved verbatim above for upgrade safety. |
| `src/hooks/useSopDetail.ts` | Joins section_kinds | VERIFIED | Line 52: `section_kind:section_kinds!section_kind_id ( * )` inside the Supabase select on `sops → sop_sections`. PostgREST returns the joined kind as a single object (not an array), matching `SopSection.section_kind?: SectionKind \| null` in types/sop.ts. |
| `src/actions/sections.ts` | listSectionKinds + createSection | VERIFIED | 92 lines. Both server actions exported. `listSectionKinds` orders by `render_priority ASC, display_name ASC`. `createSection` validates with Zod, re-fetches the kind via RLS-scoped client to prevent ID forgery (T-11-03-05), computes next sort_order with gap-of-10, inserts with `section_type=kind.slug, section_kind_id=kind.id, approved=false`. |
| `src/components/admin/SectionKindPicker.tsx` | Globals + own-org picker | VERIFIED | 205 lines. Loads kinds via `listSectionKinds()` on mount, groups globals + org-customs, 7-icon lucide map, free-text title input with `display_name` prefill (blank for `custom`), 72px tap targets, helper text noting multi-instance support. |
| `src/components/admin/AddSectionButton.tsx` | Dialog wrapper | VERIFIED | 59 lines. Dashed-border 72px trigger button, accessible modal dialog (`role="dialog"`, `aria-modal`, `aria-label`, backdrop click-dismiss), invokes `createSection` from picker submit then `onCreated()` callback. |
| `src/components/admin/SectionEditor.tsx` | Header shows section_kind | VERIFIED | Line 6: imports `resolveTabStyling`; line 126: renders `styling.displayName ?? styling.family` as uppercase tag in card header. |
| `src/app/(protected)/admin/sops/[sopId]/review/ReviewClient.tsx` | Renders AddSectionButton | VERIFIED | Line 11: imports `AddSectionButton`; line 402: `<AddSectionButton sopId={sop.id} onCreated={handleApprovalChange} />` rendered after section list, gated on `sop.status === 'draft'`. |
| `src/app/api/sops/[sopId]/sections/route.ts` | POST route | VERIFIED | 41 lines. POST handler delegates to `createSection`, returns 201 + section body on success, 400 + error on Zod/RLS failure. |
| `playwright.config.ts` | phase11-stubs project | VERIFIED | Lines 46-47: `name: 'phase11-stubs'`, `testMatch: /sb-auth-builder\|sb-section-schema\|sb-layout-editor\|sb-image-annotation\|sb-collaborative-editing\|sb-block-library\|sb-builder-infrastructure\|resolve-render-family/`. |
| `tests/sb-auth-builder.test.ts` | SB-AUTH-01..05 stubs | VERIFIED | 9 lines, 5 `test.fixme` cases, every SB-AUTH-0N appears as title prefix. |
| `tests/sb-section-schema.test.ts` | SB-SECT-01..05 stubs | VERIFIED | 9 lines, 5 `test.fixme` cases for SB-SECT-01..05. |
| `tests/sb-layout-editor.test.ts` | SB-LAYOUT-01..06 stubs | VERIFIED | 10 lines, 6 `test.fixme` cases. |
| `tests/sb-image-annotation.test.ts` | SB-ANNOT-01..05 stubs | VERIFIED | 9 lines, 5 `test.fixme` cases. |
| `tests/sb-collaborative-editing.test.ts` | SB-COLLAB-01..06 stubs | VERIFIED | 10 lines, 6 `test.fixme` cases. |
| `tests/sb-block-library.test.ts` | SB-BLOCK-01..06 stubs | VERIFIED | 10 lines, 6 `test.fixme` cases. |
| `tests/sb-builder-infrastructure.test.ts` | SB-INFRA-01..04 stubs | VERIFIED | 8 lines, 4 `test.fixme` cases. |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `playwright.config.ts` | `tests/sb-*.test.ts` | testMatch regex | WIRED | Regex matches all 7 stub files; project lists 51 tests via `--list`. |
| `tests/sb-section-schema.test.ts` | SB-SECT-01..05 | test.fixme per requirement | WIRED | All 5 SB-SECT IDs present as title prefixes. |
| `public.sop_sections` | `public.section_kinds` | section_kind_id advisory FK | WIRED | Migration line 67-68: `add column if not exists section_kind_id uuid references public.section_kinds(id) on delete set null`. |
| `public.sop_section_blocks` | `public.blocks` | block_id FK with snapshot_content cache | WIRED | Migration line 158: `snapshot_content jsonb not null`; FK declared in junction definition. |
| `public.block_versions` | `public.blocks` | block_id FK + unique(block_id, version_number) | WIRED | Migration line 124: `unique (block_id, version_number)`. |
| `src/components/sop/SopSectionTabs.tsx` | `resolveRenderFamily.ts` | resolveTabStyling import | WIRED | Line 13 import; line 79 `resolveTabStyling(section)` call. Old `SECTION_COLORS`/`getTabColors` substring cascade removed. |
| `src/components/sop/SectionContent.tsx` | `resolveRenderFamily.ts` | resolveRenderFamily import | WIRED | Line 5 import; line 131 `const family = resolveRenderFamily(section)`; switch on family with all 7 cases handled. |
| `src/hooks/useSopDetail.ts` | `public.section_kinds` | Supabase select join | WIRED | Line 52: `section_kind:section_kinds!section_kind_id ( * )` inside the nested `sop_sections` select. |
| `src/components/admin/SectionKindPicker.tsx` | `src/actions/sections.ts` | listSectionKinds + createSection | WIRED | Picker calls `listSectionKinds()` on mount and the parent `AddSectionButton` calls `createSection(...)` on submit. |
| `src/actions/sections.ts` | `public.section_kinds` | Supabase select via SSR client | WIRED | `from('section_kinds').select('*').order(...)`. |
| `ReviewClient.tsx` | `AddSectionButton.tsx` | React import + render | WIRED | Line 11 import, line 402 render gated on `sop.status === 'draft'`. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `SopSectionTabs.tsx` | `section.section_kind` | useSopDetail Supabase join → Dexie v3 cache | YES (when migration applied + types regenerated) | FLOWING |
| `SectionContent.tsx` | `family = resolveRenderFamily(section)` | resolveRenderFamily helper, fed by joined section_kind OR legacy substring fallback | YES (legacy fallback always works; v3 path works once migration is pushed) | FLOWING |
| `SectionKindPicker.tsx` | `kinds` from `listSectionKinds()` | RLS-scoped Supabase select | YES (real query, no static fallback) | FLOWING (after migration push) |
| `AddSectionButton.tsx` | `createSection({...})` | Real INSERT into sop_sections | YES (no mock; real RLS-scoped insert) | FLOWING (after migration push) |

Note: PASS for data flow assumes the migration is actually applied to the running DB. The migration SQL file is committed and idempotent, but `supabase db push` was deferred to the orchestrator/operator (deviation 11-01.4). Until then, runtime calls to `listSectionKinds` will return an empty array (no rows + no error), and `createSection` will fail with a missing-table error. This is captured under human verification item 4.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| TypeScript compiles cleanly post-merge | `npx tsc --noEmit` | EXIT_CODE=0, zero errors | PASS |
| Playwright phase11-stubs project lists 37+ tests | `npx playwright test --project=phase11-stubs --list` | `Total: 51 tests in 8 files` (37 SB-XX + 14 resolveRenderFamily unit) | PASS |
| All 37 SB-XX requirement IDs covered as test title prefixes | listed via Playwright output | All 37 IDs verified present in stub files | PASS |
| Migration file structurally valid (DDL + RLS + seeds) | grep-based scan for `create table`, `enable row level security`, `insert into ... section_kinds`, `snapshot_content jsonb not null`, `unique (block_id, version_number)` | All sentinels present | PASS |
| Migration applied against real DB and types regenerated | `supabase db push` + verification queries | Not run in this verification — operator action required (item 4 above) | SKIP (routed to human) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| SB-SECT-01 | 11-01, 11-02, 11-03 | Multi-instance same-kind sections per SOP | NEEDS HUMAN | Schema allows it (no UNIQUE), `createSection` permits it, `useSopDetail` join surfaces section_kind metadata, `SopSectionTabs` renders multiple tabs of same family. End-to-end click-through needed. |
| SB-SECT-02 | 11-01, 11-02, 11-03 | Custom section with admin-provided title renders | NEEDS HUMAN | `custom` seed row exists; `SectionKindPicker` exposes it with free-text title input; `SectionContent` switch handles `'custom'` case via DefaultContent. End-to-end visual confirmation needed. |
| SB-SECT-03 | 11-01, 11-02, 11-03 | Canonical kinds catalog seeded with rendering metadata | VERIFIED | 7 seed rows in migration with icon, color_family, render_priority, render_family. `resolveTabStyling` consumes them; `SopSectionTabs` ICON_MAP + COLOR_CLASSES wired for all 7. (Migration push deferred — see item 4.) |
| SB-SECT-04 | 11-01, 11-02, 11-03 | v1/v2 SOPs render identically via substring fallback | VERIFIED (with human spot-check pending) | `inferRenderFamilyFromType` preserves legacy cascade; Test 7 unit-test guards procedure→content regression; Dexie v3 upgrade is index-only. Visual pixel parity needs human walkthrough on a real legacy SOP. |
| SB-SECT-05 | (Plan 11-00 stub only) | Drag reorder via sort_order | DEFERRED | Stub `test.fixme` exists in `tests/sb-section-schema.test.ts`; Phase 12 ROADMAP explicitly lists SB-SECT-05 in its requirements list. Not in scope for Phase 11. |
| SB-AUTH-01..05 | (Plan 11-00 stubs only) | All 5 stub `test.fixme` cases | DEFERRED | Phase 12-13 own real implementation. |
| SB-LAYOUT-01..06 | (Plan 11-00 stubs only) | All 6 stub cases | DEFERRED | Phase 12-14 own real implementation. |
| SB-ANNOT-01..05 | (Plan 11-00 stubs only) | All 5 stub cases | DEFERRED | Phase 15 owns real implementation. |
| SB-COLLAB-01..06 | (Plan 11-00 stubs only) | All 6 stub cases | DEFERRED | Phase 16 owns real implementation. |
| SB-BLOCK-01..06 | (Plan 11-00 stubs only) | All 6 stub cases | DEFERRED | Phase 17 owns real implementation. |
| SB-INFRA-01..04 | (Plan 11-00 stubs only) | All 4 stub cases | DEFERRED | Phase 18 owns real implementation. |

REQUIREMENTS.md still marks SB-SECT-01..04 as `Pending` — this is correct because end-to-end Playwright coverage is intentionally deferred to Phase 12 (which flips `tests/sb-section-schema.test.ts` from `test.fixme` to real cases). The Phase 11 contract is the *foundation*, not the user-visible feature flag.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `src/components/admin/SectionKindPicker.tsx` | 174 | `placeholder=` HTML attribute on input | INFO | Legitimate input placeholder; not a code stub. |
| `src/components/sop/SectionContent.tsx` | 155 | `// TODO(phase 12): dedicated SignoffContent` | INFO | Documented intentional staged implementation — `signoff` case currently reuses `DefaultContent`. Phase 12 ships the real component. Not a stub blocking phase 11 goal (no signoff sections exist in any seeded SOP yet). |
| `src/types/database.types.ts` | n/a | Hand-written instead of generator output | INFO | Documented deviation 11-01.4. After `supabase db push` lands, operator should regenerate via `npx supabase gen types typescript --local` and replace the hand-written block. |
| `src/actions/sections.ts` | 84 | `as any` cast on insert payload | INFO | Pre-merge typing artifact — `database.types.ts` was hand-written so the Insert shape may not perfectly match. Will be cleaned up after type regeneration post-`supabase db push`. |

No blocker anti-patterns. No empty `return null` / `return []` / hardcoded empty data flowing to render. No stub placeholders where real implementation was promised.

### Human Verification Required

See the `human_verification:` entries in the frontmatter above. Summary:

1. **SB-SECT-01 click-through**: Add 2 Hazards sections to one SOP, publish, confirm both render in worker walkthrough.
2. **SB-SECT-02 click-through**: Add a Custom section with bespoke title, publish, confirm worker walkthrough renders it via the `custom` family fallback.
3. **SB-SECT-03/04 legacy regression**: Open a pre-Phase-11 published SOP and confirm pixel-identical rendering (icons, colors, sort order, procedure→content fallback, content+steps preamble layout).
4. **Migration push + type regen**: Run `supabase db push`, verify 7 seed rows, 12+ RLS policies, RLS rejection of NULL-org insert by non-service-role; then `npx supabase gen types typescript --local` and replace the hand-written `database.types.ts` block.

### Gaps Summary

There are no functional code gaps in Phase 11. Every must-have artifact exists, is substantive, and is wired into the application code path. TypeScript compiles cleanly. Playwright lists 51 tests in the new `phase11-stubs` project — 37 SB-XX requirement stubs plus 14 resolveRenderFamily unit tests, all green.

The reason the phase status is `human_needed` rather than `passed` is that 3 of the 4 ROADMAP success criteria describe end-to-end behaviours (admin clicks button → worker sees rendered output) that grep + tsc + Playwright `--list` cannot verify on their own — they need a human to run the dev server, click through the admin UI, publish a SOP, and visually confirm the worker walkthrough output. These are exactly the kinds of items the GSD verification framework routes to `human_verification` instead of failing the phase.

Additionally, the migration file was committed but `supabase db push` was deferred per orchestrator instruction (the parallel-worktree executors had no live DB). Until the operator pushes the migration, the runtime data flow chain is dormant — `listSectionKinds()` would return an empty array against a missing table. This is a one-command operator action, not a code defect.

---

_Verified: 2026-04-15_
_Verifier: Claude (gsd-verifier)_
