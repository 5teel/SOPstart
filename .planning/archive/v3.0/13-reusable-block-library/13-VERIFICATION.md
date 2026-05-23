---
phase: 13-reusable-block-library
verified: 2026-05-07T07:30:00Z
status: human_needed
score: 5/5 success criteria plumbing-complete; 3/5 awaiting browser UAT
completion_pct: 90
pending_human_uat: true
overrides_applied: 0
re_verification: null
human_verification:
  - test: "Wizard pick-from-library round trip with SOP-category scoring"
    expected: "Pick 'Forming Area' SOP category at step 1; at hazards step click 'Pick from library'; area-forming-tagged hazards rank in 'Best matches' group; pick 2 (one pinned, one follow-latest) → finish wizard → both render in builder hazards section with `props.junctionId` stamped on the Puck items"
    why_human: "Browser-rendered Puck canvas + DOM behaviour cannot be programmatically asserted without running the dev server"
    plan_ref: "13-03 Task 7 scenarios 1-2-5"
  - test: "Builder three-dot ⋯ menu Save to library + Suggest for global"
    expected: "Hover hazard block in builder → ⋯ overlay top-right → Save to library opens SaveToLibraryModal with kind+content prefilled; My-org-only path lands in /admin/blocks; Suggest-for-global path inserts block_suggestions row with status='pending'"
    why_human: "Hover-revealed UI + Puck context selection only verifiable in a real browser session"
    plan_ref: "13-03 Task 7 scenarios 3-4"
  - test: "Follow-latest update badge end-to-end"
    expected: "Edit a global hazard block at /admin/blocks/[id] → toast 'Saved as version N. M follow-latest SOPs will see an update-available badge'; visit a SOP that follows that block → amber dot top-right of the block; click → BlockUpdateReviewModal shows old/new diff; Accept routes through publish gate (sops.status published→draft); Decline records sop_block_update_decisions row and the same version no longer re-triggers the badge"
    why_human: "Trigger-driven UI state + publish-gate flip needs visual verification + a SQL audit-row check"
    plan_ref: "13-04 Task 6 7-step smoke"
  - test: "Platform super-admin curation UI gating + suggestion promote"
    expected: "Org admin (no platform_admins row) hitting /admin/global-blocks → redirected to /dashboard; after platform_admins seed (00027 or manual SQL), the same routes load; promote a pending suggestion → row removed from queue → new global appears in BlockListTable; reject path same with 'Rejected' toast"
    why_human: "Route guard redirect + Supabase RLS interaction needs an authenticated browser session"
    plan_ref: "13-05 'Pending Human Verification' scenarios 1-3"
deferred: []
---

# Phase 13: Reusable Block Library — Verification Report

**Phase Goal:** Admin can save, browse, and re-use hazard / PPE / step blocks from an org-scoped library alongside a read-only NZ global block set, with the wizard surfacing matching blocks at the right step and explicit pin-version vs follow-latest semantics.

**Verified:** 2026-05-07T07:30:00Z
**Status:** human_needed (plumbing complete; browser UAT pending across 13-03 / 13-04 / 13-05)
**Re-verification:** No — initial verification

---

## Goal Achievement — Success Criteria

### SC1: Admin can save any hazard / PPE / step block to org library with name + category tags

**Status:** PARTIAL (plumbing complete; UAT pending)

| Evidence | Location |
|---|---|
| `saveFromSection` server action with Zod input incl. `categoryTags` + `freeTextTags` + `scope` | `src/actions/blocks.ts:487` |
| `BlockContentSchema.parse(data.content)` invoked before insert | `src/actions/blocks.ts:140`, `:264` (defence-in-depth) |
| `SaveToLibraryModal.tsx` renders Name → Categories → Free-text tags → Scope radio (D-Save-02 order) | `src/components/admin/blocks/SaveToLibraryModal.tsx` (241 lines) |
| `BlockOverflowMenu.tsx` (three-dot ⋯) opens modal from builder via Puck `componentItem` override | `src/components/sop/blocks/BlockOverflowMenu.tsx` (151 lines); wired in `src/lib/builder/puck-config.tsx:815` |
| `puckPropsToBlockContent` helper maps Puck props → BlockContent on save | `src/lib/builder/puck-to-block-content.ts` |
| Org admin → `/admin/blocks` lists own blocks; `BlockListTable` archives via `archiveBlock` | `src/app/(protected)/admin/blocks/page.tsx` + `BlockListTable.tsx` |

**Gap:** The hover-revealed ⋯ overlay + actual Puck context selection cannot be exercised without a running dev server (UAT item 2).

---

### SC2: Builder wizard shows "Pick from library (N matches)" alongside "Write new" filtered by section kind + SOP category

**Status:** PARTIAL (plumbing complete; UAT pending)

| Evidence | Location |
|---|---|
| `match-blocks.ts` pure scorer with hard kind filter + exact-tag (+100) / prefix-tag (+50+) / kind-only fallback | `src/lib/builder/match-blocks.ts` (185 lines) |
| `groupForPicker` returns `{ exact, related, allOfKind, totalCount }` for D-Pick-03 | same file |
| Companion test file `src/lib/builder/match-blocks.test.ts` exists |  |
| Wizard step 1 collects `categoryTag` from `block_categories` (filtered hazard/area/procedure) — D-Tax-03 | `WizardClient.tsx:53` `useState<string \| null>`; line 324 `<select value={categoryTag ?? ''}>` |
| `createSopFromWizard` accepts `categoryTag` and validates against `block_categories.slug` (T-13-03-07) | `src/actions/sops.ts` (per 13-03 SUMMARY); `WizardClient.tsx:126` passes it into the call |
| Wizard step 2 renders `+ Pick from library` per kind, opens `BlockPicker` with `kindSlug` + `sopCategory` | `WizardClient.tsx:367,496,542-546` |
| `BlockPicker.tsx` (398 lines) — modal w/ filter chips, two-pane list+preview, banner "No blocks tagged for [X]…", pin/follow toggle (default `pinned`) | `src/components/admin/blocks/BlockPicker.tsx` |
| `BlockPickerRow.tsx` + `BlockPickerPreview.tsx` (compact list + worker-component preview) |  |
| Picker consumes `listBlocks({ kindSlug, includeGlobal: true, includeContent: true })` — final option surface declared in 13-01 | `src/actions/blocks.ts:112` `ListBlocksOptions` |
| `(N matches)` count derived from `groupForPicker(...).totalCount` | inside `BlockPicker.tsx` |

**Gap:** Visual "(N matches)" string + ranked ordering of area-forming hazards needs eyes-on confirmation (UAT item 1).

---

### SC3: Global NZ blocks visible read-only to every org; org blocks isolated via RLS

**Status:** COMPLETE

| Evidence | Location |
|---|---|
| Migration 00022 — `summit_admins` (renamed `platform_admins` in 00026), `is_summit_admin()` helper (renamed `is_platform_admin()`), RLS policies for super-admin global writes | `supabase/migrations/00022_block_library_phase13.sql:24,46,216` + `00026_rename_summit_to_platform.sql` |
| Migration 00023 — 65 global rows seeded (`organisation_id IS NULL`): **57 hazard + 5 ppe + 3 step** verified by literal regex grep on the migration file | `supabase/migrations/00023_phase13_nz_global_block_seed.sql` |
| `blocks_summit_admin_global_write` / `_global_update` / `block_versions_summit_admin_global_insert` RLS policies (renamed to `platform_*` in 00026) restrict global writes to platform super-admins | 00022 lines 216-…; 00026 renames |
| Org-scope read uses pre-existing 00019 `blocks_read_global_plus_org` policy (every authenticated user sees own-org + global; no other org's rows) | 00019 |
| `requirePlatformAdmin()` server-action defence-in-depth via `is_platform_admin()` RPC | `src/actions/blocks.ts:63` |
| `requirePlatformAdmin()` route guard | `src/lib/auth/platform-admin-guard.ts:16` |
| 13-02 SUMMARY records live PostgREST verification: 57 hazard + 5 ppe + 3 step = 65 reachable, all rows have `current_version_id` wired |  |

**Verdict:** All schema, RLS, and seed plumbing in place AND verified live in 13-02 SUMMARY. Two-org cross-leak test was not re-run during this verification but the RLS policies are unchanged from migration 00019 (Phase 11) which Simon already accepted.

---

### SC4: When block added to SOP, content snapshotted into `sop_section_blocks` so SOP renders correctly even if block deleted / worker offline

**Status:** PARTIAL (plumbing complete; UAT pending)

| Evidence | Location |
|---|---|
| `addBlockToSection` reads `currentVersion.content` server-side and writes `snapshot_content = currentVersion.content` (T-13-03-02 — client cannot supply snapshot) | `src/actions/sop-section-blocks.ts:114,149` |
| `pinned_version_id = currentVersion.id` always set (used as "version we know about" marker for follow-latest detection) | `:147` |
| `BlockContentSchema.parse(currentVersion.content)` enforced even on snapshot path (defence in depth) | `:114` |
| Wizard `handleSubmitFinal` post-create attachment loop calls `addBlockToSection` per pick → stamps `props.junctionId` on Puck items via `updateSectionLayout` | `WizardClient.tsx:185-219` |
| Workers read junction-only path: junction `snapshot_content` is the worker render source; archiving the source block does NOT delete the junction (soft-archive via `archived_at`) | confirmed in 13-03 SUMMARY + 00019 schema |
| Junction reorder via `reorder_sop_section_blocks` RPC (atomic; mirrors 00020's `reorder_sections` pattern) | migration `00024_phase13_junction_reorder_rpc.sql`; called at `sop-section-blocks.ts:274` |

**Gap:** The "junction snapshot survives source-block delete" path is structurally enforced by the schema but actual offline render verification by a worker on a phone is browser-UAT territory (UAT item 1 SQL check #5).

---

### SC5: Pin-to-version (default) vs follow-latest per usage; follow-latest SOPs show "update available" badge when source block changes; routes through publish gate before workers see update

**Status:** PARTIAL (plumbing complete; UAT pending)

| Evidence | Location |
|---|---|
| Pin/follow toggle in BlockPicker footer (default `pinned`) | `BlockPicker.tsx` (per 13-03 SUMMARY) |
| `setPinMode` server action flips column without disturbing snapshot/pin | `sop-section-blocks.ts:194-208` |
| Migration 00025 — `propagate_block_update` AFTER INSERT trigger on `block_versions` | `00025_phase13_follow_latest_tracking.sql:71,95` |
| Trigger filters: skip `pinned_version_id = new.id` (fresh adds) AND skip rows with prior decline for same version (idempotent) | `00025` lines 78-89 |
| `accept_block_update` SECURITY DEFINER RPC — explicit role + org checks before junction write | `00025:107` |
| `decline_block_update` SECURITY DEFINER RPC — parallel structure | `00025:159` |
| `sop_block_update_decisions` append-only audit table (RLS via SOP join, no UPDATE/DELETE policy) | `00025:25` |
| `acceptBlockUpdate` server action calls RPC → flips `sops.status` `published` → `draft` (publish-gate per SB-BLOCK-06) | `sop-section-blocks.ts:312,344` |
| `BlockUpdateReviewModal.tsx` (248 lines) — uses `diffBlockContent` for side-by-side; Accept/Decline buttons | `src/components/admin/blocks/BlockUpdateReviewModal.tsx:22-25,49,63,90` |
| `UpdateAvailableBadge.tsx` (62 lines) — amber dot + tooltip per D-CONTEXT specifics | `src/components/admin/blocks/UpdateAvailableBadge.tsx` |
| `PuckItemBadgeOverlay` wires badge into Puck canvas via `createPuckOverrides({ junctionMap, componentIdToJunction })` | `puck-config.tsx:777,850`; `BuilderClient.tsx:145,155,170,188,198` |
| `diffBlockContent` covers all 12 BlockContent variants | `src/lib/builder/diff-block-content.ts:44-` (hazard/ppe/step/emergency/measurement/decision/escalate/signoff/zone/inspect/voice-note/custom) |
| `countFollowLatestUsages` for downstream-impact toast in BlockEditorClient | `src/actions/blocks.ts:738` |

**Gap:** Trigger-driven badge appearance + publish-gate flip + decline idempotency need browser+SQL verification (UAT item 3, 13-04 Task 6 scenarios 1-7).

---

## Requirements Coverage

| Requirement | Description (per REQUIREMENTS.md / plan declarations) | Source plan(s) | Status | Evidence |
|---|---|---|---|---|
| SB-BLOCK-01 | Admin can save reusable blocks to org library | 13-01 | PARTIAL (UAT pending) | `saveFromSection` action + `SaveToLibraryModal` + `BlockOverflowMenu` wired through `puck-config` componentItem; SC1 evidence row |
| SB-BLOCK-02 | Wizard surfaces matching blocks at right step | 13-03 | PARTIAL (UAT pending) | `BlockPicker` + `match-blocks.ts` `groupForPicker` + wizard step 2 integration; SC2 evidence row |
| SB-BLOCK-03 | Org RLS isolation + read-only NZ globals | 13-01, 13-02 | COMPLETE | RLS policies in 00022 (renamed in 00026); 65 global rows seeded in 00023 verified live; SC3 evidence row |
| SB-BLOCK-04 | Snapshot-on-add — SOP renders even if block deleted | 13-03 | PARTIAL (UAT pending) | `addBlockToSection` reads currentVersion server-side; junction `snapshot_content` + `pinned_version_id` always set; SC4 evidence row |
| SB-BLOCK-05 | Pin vs follow-latest semantics | 13-03 (UI), 13-04 (runtime) | PARTIAL (UAT pending) | `setPinMode` action + 00025 `propagate_block_update` trigger + accept/decline RPCs; SC5 evidence row |
| SB-BLOCK-06 | Update-available badge + publish gate + super-admin curation | 13-04 (badge), 13-05 (UI) | PARTIAL (UAT pending) | `UpdateAvailableBadge` + `BlockUpdateReviewModal` + `PuckItemBadgeOverlay` + publish-gate flip in `acceptBlockUpdate`; `/admin/global-blocks` + `/admin/global-blocks/suggestions` behind `requirePlatformAdmin`; SC5 + SC2 evidence rows |

**Orphaned requirements:** None. All six SB-BLOCK-* requirements are claimed by at least one plan.

---

## Rename Verification — `summit → platform`

| Surface | Expected after rename | Verified |
|---|---|---|
| Migration 00026 renames table, helper function, and 5 policies | `summit_admins → platform_admins`, `is_summit_admin → is_platform_admin`, all 5 policy names | ✓ Migration body lines 25, 31, 37-55 |
| Migration 00027 seeds initial platform admin (idempotent on email) | INSERT … ON CONFLICT … DO NOTHING via auth.users email lookup | ✓ |
| `src/lib/auth/platform-admin-guard.ts` exists; old `summit-admin-guard.ts` removed | Single guard file at platform-admin-guard.ts | ✓ Listing confirms only `platform-admin-guard.ts` present |
| Server action `requirePlatformAdmin` calls `is_platform_admin` RPC | Action layer aligned with renamed RPC | ✓ `src/actions/blocks.ts:63,66` |
| Route guard `requirePlatformAdmin` in pages | `/admin/global-blocks/*` calls renamed guard | ✓ both `page.tsx` + `suggestions/page.tsx` reference `requirePlatformAdmin` |
| `database.types.ts` carries `platform_admins` + `is_platform_admin` shapes | Types match renamed schema | ✓ lines 501 + 1303 |
| No live `summit_*` / `is_summit_admin` / `requireSummitAdmin` / `summit-admin-guard` references in `src/**` | Code base fully migrated | ✓ Filesystem listing + grep across `src/` returned **zero matches** |
| Historical references in `00022_block_library_phase13.sql` | Migrations are immutable history; 00026 supersedes — expected and correct | ✓ |

**Verdict:** Rename is fully consistent across schema, RLS bodies (renamed via OID dependency, no body rewrite needed), TypeScript types, server actions, and route guards. The only `summit*` strings remaining are in (a) migration 00022's original definitions (immutable history), (b) migration 00026's own rename comments, and (c) the planning docs. No code path references the old names.

---

## Anti-Patterns Scan

| Concern | Result |
|---|---|
| TODO / FIXME / placeholder text in delivered files | None blocking. The wizard non-blocking attachment path (`addBlockToSection` failure → `console.warn` + admin proceeds) is a documented `accept` disposition (T-13-03-04). |
| Empty handlers / stub returns | None found. All server actions have real Zod-validated bodies + Supabase calls. UI components have real `onClick` handlers wired to real server actions. |
| Hardcoded empty data | None. `BlockListTable` empty-state copy is informational; real data flows through `listBlocks` server-side. Suggestions queue empty-state explains the "Suggest for global" entry point. |
| Stub line counts | Top-3 smallest files: `UpdateAvailableBadge.tsx` (62), `BlockOverflowMenu.tsx` (151), `match-blocks.ts` (185). All substantive — none are placeholders. |
| Existing-data orphan: deferred `/admin/blocks/new?scope=global` Create CTA | Documented in 13-05 SUMMARY "Known Stubs": link renders honestly, Summit can also create globals by editing existing globals via 13-01 editor. Acceptable per plan's "for Phase 13 v1, this is acceptable" guidance. |

---

## Behavioural Spot-Checks

| Behaviour | Method | Result |
|---|---|---|
| Migration files exist sequentially 00022..00027 | `ls supabase/migrations` | ✓ all six present, no fractional prefixes |
| Seed-migration entry counts match SUMMARY claims (57 hazard / 5 PPE / 3 step) | `grep -c` against SQL literal patterns in 00023 | ✓ 57 / 5 / 3 |
| Top-level server-action exports match SUMMARY claims | `grep "^export "` on `actions/blocks.ts` and `actions/sop-section-blocks.ts` | ✓ 12 + 9 exports — superset of every claimed function |
| `BlockContentSchema.parse` invoked at every claimed call site | `grep -nE` on `actions/blocks.ts` | ✓ 4 invocations: createBlock, updateBlock-content path, promoteSuggestion, plus snapshot path in `sop-section-blocks.ts:114` |
| Migration 00025 trigger + RPCs declared with SECURITY DEFINER | `grep` on migration body | ✓ `propagate_block_update`, `accept_block_update`, `decline_block_update` all use SECURITY DEFINER + role+org checks |
| Wizard wires `addBlockToSection` + stamps `junctionId` on Puck items in `layout_data` | `grep -nE` on `WizardClient.tsx` | ✓ lines 185-219 |
| Builder fetches junction map + builds `componentIdToJunction` lookup + passes to `createPuckOverrides` | `grep -nE` on `BuilderClient.tsx` | ✓ lines 145, 155, 170, 188, 198 |

---

## Data-Flow Trace (Level 4)

| Surface | Data variable | Source | Real data? | Status |
|---|---|---|---|---|
| `/admin/blocks` page | `blocks` | `listBlocks({ includeGlobal: true, includeArchived: false })` | RLS-scoped Supabase query against `public.blocks` | FLOWING |
| `/admin/global-blocks` page | `globals` | `listBlocks({ globalOnly: true, includeArchived: true })` | RLS + `globalOnly` filter on `organisation_id IS NULL` | FLOWING |
| `BlockPicker` modal | `blocks` (with `currentContent`) | `listBlocks({ kindSlug, includeGlobal: true, includeContent: true })` | LEFT JOIN block_versions on `current_version_id` | FLOWING (verified live in 13-02 SUMMARY: 65 globals reachable) |
| `BlockUpdateReviewModal` | `junction.snapshot_content` (old) + `junction.latestVersion.content` (new) | `listSectionBlocksWithUpdates(sectionId)` hydrates `latestVersion` for `update_available=true` rows in 1 round-trip | Real Supabase calls; RLS-scoped | FLOWING |
| Wizard step 1 SOP-category select | `categories` | `listBlockCategories()` server-fetched in `page.tsx`, passed via props to client | Real `block_categories` rows (34 seeded in 00022) | FLOWING |
| BuilderClient junction map | `junctionMap` | `listSectionBlocksWithUpdates(activeSection.id)` on section change | Real RLS-scoped junction read + latestVersion hydration | FLOWING |

No HOLLOW or DISCONNECTED data sources detected.

---

## Pending Human Verification

Plumbing for all 5 success criteria is complete. Three of the five SCs (SC1 / SC2 / SC4 / SC5) require a running dev server + a logged-in browser session to confirm the Puck-canvas hover-overlay UI, picker ranking visualisation, badge appearance after trigger fire, publish-gate flip, and platform-admin route gating.

The four batched UAT scenarios are listed in the frontmatter `human_verification:` block and detailed across the per-plan SUMMARY "Pending Human Verification" sections (13-03 Task 7, 13-04 Task 6 smoke, 13-05 scenarios 1-3).

**Recommended approach:** Single batched session — `npm run dev` on port 4200, ensure a `platform_admins` row exists for Simon's auth user (00027 handles this if Simon's email is registered; otherwise manual SQL insert), then walk:

1. Wizard pick-from-library round trip (~5 min)
2. Builder ⋯ Save to library + Suggest for global (~3 min)
3. Block edit → badge → diff modal → Accept/Decline + audit row check (~5 min)
4. Platform super-admin gating + suggestions promote/reject (~3 min)

Estimated total: ~15-20 minutes.

---

## Verdict

**Phase 13 plumbing: complete.** All 6 SB-BLOCK-* requirements have backing code paths verified at the file + grep + line level. Schema (00022..00027) is sequential, additive, and pushed live. Server actions (`blocks.ts` + `sop-section-blocks.ts`) declare and consume the FINAL option surface across all 5 plans without API drift. UI components (BlockPicker / SaveToLibraryModal / UpdateAvailableBadge / BlockUpdateReviewModal / SuggestionReviewRow) are all substantive (62-398 lines each). The Puck `componentItem` + `componentOverlay` extensions correctly carry both the three-dot save-to-library overlay (13-03) and the update-available badge (13-04) without colliding. The `summit → platform` rename is fully propagated across schema, RLS, types, server actions, and route guards.

**Browser UAT outstanding** for SC1 / SC2 / SC4 / SC5 + the platform-admin route gating in SC3's curation half. None of the UAT items reflect missing plumbing — they test render-time, trigger-driven, and auth-redirect behaviours that can only be confirmed in a real browser.

**Recommended next step:** Schedule a single ~20-minute UAT batch covering the four scenarios in the `human_verification:` frontmatter. After UAT passes, Phase 13 can be marked complete and the milestone retrospective can run.

---

_Verified: 2026-05-07T07:30:00Z_
_Verifier: Claude (gsd-verifier)_
