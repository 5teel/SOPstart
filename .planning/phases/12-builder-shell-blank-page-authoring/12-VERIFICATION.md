---
phase: 12-builder-shell-blank-page-authoring
verified: 2026-04-24T00:00:00Z
status: human_needed
verdict: FLAG
score: 9/9 must-haves structurally verified (behavioural confirmation pending)
re_verification: false
requirements:
  SB-AUTH-01: satisfied
  SB-AUTH-04: satisfied
  SB-AUTH-05: satisfied_with_deviation
  SB-LAYOUT-01: satisfied
  SB-LAYOUT-02: satisfied
  SB-LAYOUT-03: satisfied
  SB-LAYOUT-04: satisfied_structurally
  SB-LAYOUT-06: satisfied
  SB-SECT-05: satisfied_structurally
human_verification:
  - test: "Install dependencies, run dev server, visit /admin/sops/new/blank as admin"
    expected: "4-step wizard loads, canonical kind checklist renders, submission creates draft + redirects to /admin/sops/builder/{id}"
    why_human: "No Playwright webServer / DB fixture harness in this phase; structural tests do not exercise the runtime route"
  - test: "In the builder at /admin/sops/builder/{sopId}, drag each of the 7 blocks onto the canvas, wait 5s"
    expected: "Within 5s the target sop_sections row has layout_version = 1 and non-null layout_data JSONB (confirm via Supabase SQL)"
    why_human: "Autosave round-trip (Puck onChange → Dexie debounce → sync-engine flush → updateSectionLayout) is only structurally asserted; no live Playwright test proves the debounce cascade under real Dexie"
  - test: "Toggle airplane-mode in dev tools while editing, then reconnect"
    expected: "Pill shows OFFLINE · QUEUED while offline, SAVING… then SAVED Ns AGO after reconnect; Supabase row reflects the last local edit within ~10s"
    why_human: "Offline/online transition + Dexie dirty sweep requires a real network toggle"
  - test: "Click MOBILE in the preview toggle"
    expected: "Canvas renders inside a 430px phone frame with notch + home indicator; DESKTOP restores full width"
    why_human: "Visual device-frame fidelity is subjective and CSS-dependent"
  - test: "Drag a section from the sidebar from index 3 to index 1"
    expected: "reorder_sections RPC runs; sort_order updates atomically; /sops/{id}/walkthrough reflects the new order on reload"
    why_human: "HTML5 drag synthesis varies by browser; atomicity only verifiable against the live DB"
  - test: "As a second admin, edit the same section the primary admin edited"
    expected: "Primary admin sees 'Updated by another admin — {section title}' toast after next sync pass (D-07 LWW)"
    why_human: "Cross-tab/cross-user scenario cannot be structurally asserted"
  - test: "As admin, publish a wizard-created SOP"
    expected: "Within 5s, db.draftLayouts rows for that sopId = 0 in the publishing admin's tab AND in any other admin's tab that next syncs (D-08)"
    why_human: "Dexie deletion observable only at runtime in a real browser"
  - test: "Create an upload SOP and a wizard SOP, open /admin/sops"
    expected: "Wizard row shows 'AUTHORED IN BUILDER' chip; upload row does not"
    why_human: "Product copy review + visual styling check"
  - test: "Craft a layout_data payload > 128KB, POST to updateSectionLayout"
    expected: "Returns { error: 'Layout exceeds 128 KB...' }; DB row untouched"
    why_human: "Rejection path cannot be exercised without runtime invocation"
  - test: "Seed a section with layout_version = 999 and load /sops/{id}/walkthrough"
    expected: "Renders via linear fallback; console logs '[layout] unsupported version 999' exactly once per page load"
    why_human: "Console assertions on unsupported-version fallback only reachable at runtime"
  - test: "Run `npm install` in the worktree, then `npx tsc --noEmit`"
    expected: "Zero errors (after install, @puckeditor/core types resolve)"
    why_human: "Current worktree node_modules does not have @puckeditor/core installed — tsc currently errors until install. Summaries record the same situation and document this as a one-shot fix"
deferred:
  - truth: "DiagramHotspotBlock availability"
    addressed_in: "Phase 16 (Image & Diagram Annotation)"
    evidence: "SB-LAYOUT-05 intentionally remains test.fixme; SPEC § Out of scope explicitly defers to Phase 16"
  - truth: "AI-drafted SOP entry point"
    addressed_in: "Phase 14 (AI-Drafted SOPs)"
    evidence: "SB-AUTH-02 + SB-INFRA-04 fixmes remain; unified builder route accepts future AI entry point"
  - truth: "NZ template library entry point"
    addressed_in: "Phase 15 (NZ Template Library)"
    evidence: "SB-AUTH-03 fixme remains; template-clone flow targets the same /admin/sops/builder/[sopId] route"
  - truth: "Reusable org/global block library"
    addressed_in: "Phase 13 (Reusable Block Library)"
    evidence: "SB-BLOCK-01..06 stubs all fixme; Phase 12 blocks are inline-only"
  - truth: "Collaborative section locking"
    addressed_in: "Phase 17 (Collaborative Editing)"
    evidence: "Phase 12 ships LWW + quiet toast per D-07; SB-COLLAB-01..06 stubs fixme"
  - truth: "Pipeline linkage + bundle isolation CI"
    addressed_in: "Phase 18 (Pipeline Integration + Closeout)"
    evidence: "SB-INFRA-01..04 fixmes; Phase 18 takes the remaining closeout"
overrides: []
---

# Phase 12: Builder Shell & Blank-Page Authoring — Verification Report

**Phase Goal (ROADMAP):** Deliver a Puck-based admin builder shell + blank-page wizard with 7 shared block types, Dexie autosave + drag-reorder + preview toggle, `AUTHORED IN BUILDER` chip, and a version-safe worker `LayoutRenderer` with legacy linear fallback.

**Verified:** 2026-04-24 (goal-backward scan of the merged worktree)
**Verdict:** **FLAG** — every structural invariant from SPEC/CONTEXT holds on disk; none of the nine requirements are stub-dressed. But live behavioural proof (Puck DOM, Dexie round-trip, reorder atomicity, publish-purge, cross-admin LWW) is deferred to human UAT because the Playwright harness has no webServer + DB fixtures. `npm install` is a prerequisite (worktree is currently missing `node_modules/@puckeditor/core`).

---

## 1. Requirement-by-requirement verdict

| REQ | Status | Evidence |
|-----|--------|----------|
| **SB-AUTH-01** Blank-page wizard (title → kinds → review → submit → /admin/sops/builder/{id}) | ✓ satisfied | `src/app/(protected)/admin/sops/new/blank/page.tsx` RSC + `WizardClient.tsx` 4-step stepper with RHF+Zod; `createSopFromWizard` in `src/actions/sops.ts:489` inserts `source_type='blank'`, JWT admin guard, RLS-scoped kind SELECT, compensating cleanup; `listSectionKinds` filtered to canonical 5 slugs; `router.push(\`/admin/sops/builder/${result.sopId}\`)` on success |
| **SB-AUTH-04** Single builder route; `sops.source_type` enum | ✓ satisfied | `find src/app -path "*admin/sops*builder*" -type d` returns exactly one `src/app/(protected)/admin/sops/builder/[sopId]`; migration 00020 adds `source_type text` with CHECK enum + backfill; wizard writes `'blank'`; Plan 03's changes have the library listing conditional on `source_type !== 'uploaded'` |
| **SB-AUTH-05** AUTHORED IN BUILDER chip + shared publish gate | ✓ satisfied (with documented SPEC reinterpretation) | `src/app/(protected)/admin/sops/page.tsx:152` renders chip when `source_type && source_type !== 'uploaded'`; `New SOP (blank)` link added; `BuilderClient` SEND TO REVIEW links to existing `/admin/sops/[sopId]/review` which calls existing `/api/sops/[sopId]/publish`. SPEC literal `grep "publishSop"` does not apply (no such export exists — behavioural convergence on the existing route handler; reinterpretation documented in Plan 03 frontmatter) |
| **SB-LAYOUT-01** Palette = exactly 7 block types, no DiagramHotspotBlock, 1-/2-col layouts | ✓ satisfied | `puck-config.tsx` registers `TextBlock, HeadingBlock, PhotoBlock, CalloutBlock, StepBlock, HazardCardBlock, PPECardBlock` (+ UnsupportedBlockPlaceholder for D-13). Grep `DiagramHotspot[A-Z]` returns 0 matches in blocks/ and puck-config. `puckOverrides.componentItem` exposes `data-testid="puck-palette-{name}"`. |
| **SB-LAYOUT-02** Shared component tree, admin = worker | ✓ satisfied | `BuilderClient.tsx` and `LayoutRenderer.tsx` both `import { puckConfig } from '@/lib/builder/puck-config'`; no `placeholderConfig` residue. Blocks never import `@puckeditor/core` (grep returns 0). Per-block named function + named schema exports — 14 matches in blocks/ |
| **SB-LAYOUT-03** Tailwind-only reflow, no JS viewport branching inside blocks | ✓ satisfied | `grep -rE "isMobile\|useMediaQuery\|navigator\.userAgent" src/components/sop/blocks/` → 0 matches. Preview toggle flips `body[data-view]` in CSS only. |
| **SB-LAYOUT-04** `layout_data` JSONB + `layout_version` pin + Phase 3 sync-engine autosave (750ms Dexie, 3s flush, LWW) | ✓ satisfied structurally — behavioural round-trip awaits human UAT | Migration 00020 landed (`layout_data jsonb`, `layout_version int`, additive, nullable). Dexie `db.version(4)` adds `draftLayouts` keyed by `section_id` with `section_id, sop_id, syncState, _cachedAt` index. `useBuilderAutosave` (750ms, `syncState: 'dirty'`, `CURRENT_LAYOUT_VERSION`), `useDraftLayoutSync` (3s, visibility/online/mount), `flushDraftLayouts` (LWW with `server_newer` sentinel + `overwrittenByServer`), `updateSectionLayout` server action enforces 128KB cap via `Buffer.byteLength(JSON.stringify(...))`, admin-role guard, and LWW select. D-08 purge path: `purgeDraftLayoutsOnPublish` helper + useSopSync `publishedTransitions` + ReviewClient belt-and-braces explicit call. D-07 cross-admin toast wired in `BuilderClient`. **NO live Playwright round-trip — SUMMARY explicitly defers this to a later infra plan.** |
| **SB-LAYOUT-06** Legacy linear fallback when `layout_data` is NULL or `layout_version` unsupported | ✓ satisfied | `SectionContent.tsx` has the single `layout_data != null && layout_version != null` branch above the preserved legacy switch; `LegacyRenderer` is byte-identical extraction of the pre-Phase-12 switch. `LayoutRenderer` version-checks via `SUPPORTED_LAYOUT_VERSIONS = [1]`, Zod-safe-parses `LayoutDataSchema`, and `console.warn`s once per page for unsupported version AND parse fail. `sanitizeLayoutContent` additionally rewrites unknown block types to a registered placeholder (D-13) BEFORE `<Render>` iterates. |
| **SB-SECT-05** Drag-reorder persists `sort_order` atomically | ✓ satisfied structurally — atomicity + UX drag verified by SUMMARY only | `SectionListSidebar.tsx` uses HTML5 drag handles with optimistic update + revert on error. `reorderSections` server action calls `supabase.rpc('reorder_sections', ...)` with Zod-validated input + admin-role guard. Migration 00020's plpgsql function uses `UPDATE ... FROM unnest(ids) WITH ORDINALITY` (atomic within a single statement), NOT SECURITY DEFINER, EXECUTE granted to `authenticated`. |

All 9 requirements have concrete code behind them. SB-AUTH-05 has a documented reinterpretation (no `publishSop` export in this codebase — convergence is behavioural on the existing review page + `/api/sops/[sopId]/publish` route). SB-LAYOUT-04 and SB-SECT-05 have full structural proof but no live runtime round-trip test.

---

## 2. Must-haves (per plan frontmatter) — honored?

### Plan 12-01 truths

| Truth | Honored | Evidence |
|---|---|---|
| `npm ls @puckeditor/core` returns 0.21.2 pinned no caret | Y (source) | `package.json:24` → `"@puckeditor/core": "0.21.2"` (literal, no caret). Current worktree `node_modules` is missing the package so `npm ls` fails until `npm install` runs. SUMMARY 03 records the same situation — one-shot fix. |
| Migration 00020 adds layout_data/layout_version/source_type + reorder_sections RPC | Y | `supabase/migrations/00020_section_layout_data.sql` — all three column additions present, CHECK-string-enum (uploaded\|blank\|ai\|template), backfill UPDATE, SET DEFAULT, SET NOT NULL, function body uses `unnest(...) WITH ORDINALITY`, GRANT EXECUTE TO authenticated. NOT SECURITY DEFINER. |
| Migration applied to live DB | Y (per SUMMARY) | Summary 12-01 shows `supabase db push` applied, idempotency confirmed, `source_type NULL count = 0`. Not re-verified live in this session. |
| Builder route `/admin/sops/builder/[sopId]` loads without SSR hydration warning | Y (source) | `page.tsx` imports `@puckeditor/core/puck.css` at module level, runs admin auth + role guard, awaits params; `BuilderClient.tsx` uses `dynamic(() => import('@puckeditor/core').then(m => m.Puck), { ssr: false, loading: ... })` |
| Worker walkthrough renders legacy SOP (layout_data NULL) byte-identically to pre-Phase-12 | Y | `LegacyRenderer` in `SectionContent.tsx` is a verbatim move of the prior switch; the steps case still wraps `section.content + <StepsContent>` identically to the pre-Phase-12 cascade |
| Worker walkthrough renders `layout_version = 999` via fallback + logs once | Y (source) | `LayoutRenderer.tsx:28-34` — `warnedUnsupportedVersion` module flag gates single console.warn per page load; returns `<>{fallback}</>` |

### Plan 12-02 truths

| Truth | Honored | Evidence |
|---|---|---|
| Palette = 7 blocks, DiagramHotspotBlock absent | Y | `puck-config.tsx` components keys: 7 blocks + UnsupportedBlockPlaceholder (D-13 placeholder, not drag-addable from palette because it's a fallback-only component). Grep `DiagramHotspot[A-Z]` on `src/components/sop/blocks/` and `src/lib/builder/` → 0 matches |
| 14 grep matches for named function + schema exports | Y | `grep -rE "export (function\|const) (Text\|Heading\|Photo\|Callout\|Step\|HazardCard\|PPECard)Block" src/components/sop/blocks/` → 14 lines |
| Zero isMobile/useMediaQuery/navigator.userAgent in blocks/ | Y | grep returns 0 |
| Admin + worker produce matching inner HTML for a HazardCardBlock | Y (structural) | Both `BuilderClient` and `LayoutRenderer` call `sanitizeLayoutContent` then pass to the same `puckConfig`. SafeRender guards are shared; worker branch is `puck?.isEditing === true` false → plain empty-state. Byte-equality in actual DOM requires runtime, but the single-component-tree structural invariant is met. |
| Phone viewport reflow ≈ viewport width | Y (structurally) | Tailwind `md:`/`lg:` classes only; preview toggle clamps canvas to 430px via CSS. Live `getBoundingClientRect` assertion is deferred to human UAT |
| Unknown block type → grey placeholder + warn-once (D-13) | Y | `UnsupportedBlockPlaceholder` is a registered puckConfig entry; `sanitizeLayoutContent` rewrites unknown-type entries before Puck iterates children; `warnedUnsupportedBlock` module flag |
| Admin red-outline + Missing hint on Zod failure; worker plain empty-state (D-16) | Y | `SafeRender` branches on `puck?.isEditing === true` — admin gets `data-layout-error="true" data-block={name}` + `firstMissingField` hint; worker gets plain amber dashed container. Section-level toast in BuilderClient when `LayoutDataSchema.safeParse` fails on active section. |
| `data-testid="puck-palette-{BlockName}"` on palette tiles | Y | `puckOverrides.componentItem` wraps children in `<div data-testid="puck-palette-{name}">`; `puckOverrides` is `Partial<Overrides>` (see Plan 02 auto-fix) |

### Plan 12-03 truths

| Truth | Honored | Evidence |
|---|---|---|
| Admin 4-step wizard lands at `/admin/sops/builder/{newSopId}` | Y (source) | WizardClient state machine steps 1→2→3→4, `router.push` to builder route on success |
| `sops.source_type='blank'`, `status='draft'`, N sections w/ matching `section_kind_id` | Y (source) | createSopFromWizard insert payload hard-codes `source_type: 'blank'`, `status: 'draft'`; batched section insert uses `kind.slug` → `section_type` and `kind.id` → `section_kind_id` |
| AUTHORED IN BUILDER chip present for non-uploaded rows, absent for uploaded | Y | `admin/sops/page.tsx:152` conditional; SELECT extended to include `source_type` (line 60) |
| SEND TO REVIEW → existing `/admin/sops/[sopId]/review` → existing `/api/sops/[sopId]/publish` | Y | BuilderClient has `<Link href={\`/admin/sops/${sopId}/review\`}>SEND TO REVIEW</Link>`. No new publish server action was introduced. |
| Exactly one builder route directory | Y | `find` returns exactly one |
| After publish, `db.draftLayouts.count() == 0` within 5s | Y (wired, not live) | `purgeDraftLayoutsOnPublish` helper + useSopSync `publishedTransitions` loop + ReviewClient belt-and-braces call. Live Dexie assertion deferred to human UAT. |

### Plan 12-04 truths

| Truth | Honored | Evidence |
|---|---|---|
| Dexie v3 → v4 with draftLayouts, v3 stores preserved verbatim | Y | `db.ts` v4 block repeats sops/sections/steps/images/syncMeta/completions/photoQueue + adds draftLayouts |
| Edit → within 5s, sop_sections row has layout_version=1 + non-null layout_data | Wired | useBuilderAutosave → Dexie → useDraftLayoutSync → flushDraftLayouts → updateSectionLayout UPDATE. Live assertion deferred. |
| Airplane mode queues Dexie; reconnect flushes | Wired | `useNetworkStore` + useDraftLayoutSync online-transition useEffect. Deferred. |
| Drag section 3→1 → reorder_sections RPC → sort_order atomic | Wired | SectionListSidebar onDrop → reorderSections → `supabase.rpc('reorder_sections', ...)`. Deferred. |
| 128KB cap rejects oversize with clear error | Y | `MAX_LAYOUT_BYTES = 128 * 1024`, `Buffer.byteLength(JSON.stringify(layoutData))` gate |
| SAVED pill shows SAVED/SAVING…/OFFLINE·QUEUED | Y | BuilderClient derives `savePillLabel` from `!isOnline`, `syncing`, `lastSavedAt`; 2s Dexie poll + 1s tick |
| DESKTOP\|MOBILE toggle sets `body[data-view]`; 430px frame on mobile | Y | PreviewToggle cleanup effect resets to 'desktop' on unmount (T-12-04-08); `builder-preview.css` clamps to `width: 430px`, border-radius 44px, `::before` notch, `::after` home indicator |
| Cross-admin LWW overwrite surfaces quiet toast | Y | BuilderClient useEffect watches `lastSyncResult.overwrittenByServer`, auto-clears after 4s |

All 4 plan must-have blocks pass structural verification.

---

## 3. SPEC/CONTEXT invariants — spot-checks

| Invariant | Status |
|---|---|
| Puck 0.21.2 exact-pinned, no caret | ✓ `package.json:24` — literal `"0.21.2"` |
| Migration 00020 applied (layout_data, layout_version, sops.source_type, reorder_sections) | ✓ per Plan 01 SUMMARY's `db push` + `db query --linked` output |
| LayoutRenderer legacy path byte-identical | ✓ — LegacyRenderer is a verbatim lift |
| Unsupported version → linear fallback + single warn | ✓ — module-ref warn-once guard |
| 7 blocks, no DiagramHotspotBlock, no JS viewport branching in blocks/ | ✓ all three grep invariants green |
| Single puckConfig shared admin/worker | ✓ — both files import from `@/lib/builder/puck-config` |
| Dexie v4 draftLayouts + LWW overwrite toast + 128KB cap + reorder RPC + 750ms autosave + 3s flush | ✓ all structural — behavioural round-trip flagged for human |
| Preview toggle DESKTOP/MOBILE + 430px phone-frame + `body[data-view="mobile"]` | ✓ CSS-only; cleanup resets on unmount |
| `/admin/sops/new/blank` wizard → createSopFromWizard → `/admin/sops/builder/{id}` | ✓ |
| AUTHORED IN BUILDER chip for `source_type != 'uploaded'` | ✓ |
| D-08 draftLayouts purge on publish within 5s | Wired via 3 paths (helper, sync hook, explicit ReviewClient call) — runtime timing deferred to UAT |

---

## 4. Anti-pattern scan

Run against files modified in Phase 12 (per SUMMARY key-files):

| File | Finding | Severity |
|---|---|---|
| `src/actions/sops.ts` (createSopFromWizard) | Three `eslint-disable-next-line @typescript-eslint/no-explicit-any` casts on insert payload | ℹ Info — documented in Plan 03 SUMMARY as stopgap until `supabase gen types` regenerates. Matches pre-existing `createSection` precedent. |
| `src/actions/sections.ts` (reorderSections / updateSectionLayout) | `(supabase as any).rpc('reorder_sections', ...)`, `.update({...} as any)` | ℹ Info — same `supabase gen types` lag reason |
| `src/app/(protected)/admin/sops/page.tsx` | `let query: any = ...` with `any` cast on select result | ℹ Info — same reason |
| Blocks / puck-config | No TODO/FIXME/placeholder/stub strings in any block file | clean |
| `src/components/sop/SectionContent.tsx:170` | `// TODO(phase 12): dedicated SignoffContent — until then reuse DefaultContent` | ⚠ Warning — pre-existing from Phase 11. Not introduced or required by Phase 12. Resolution scope is a future plan; does not block SB-LAYOUT-06 (fallback still renders via DefaultContent). |
| Mock / dressed-up stubs | None found. All 7 block files have real JSX renders with real props. `UnsupportedBlockPlaceholder` is a deliberate D-13 fallback, not a stub. | clean |
| Duplicate publish flows | ✓ zero. Builder navigates to existing review page; no new publish server action. | clean |
| Hardcoded empty returns in API routes | No new API routes introduced. | clean |

---

## 5. Test health

| Test file | Live tests | Fixme (intentional) | Notes |
|---|---|---|---|
| tests/sb-layout-editor.test.ts | 9 (SB-LAYOUT-01/02/03/04/06, D01-preview, 13-unknown, 16-red-outline, D08-purge) | 1 (SB-LAYOUT-05 → Phase 16) | All 9 passing, all structural / file-grep assertions — they verify the on-disk shapes, not runtime DOM. Plan SUMMARYs all record this deviation and the reason (no Playwright `webServer`, no DB fixture harness). |
| tests/sb-auth-builder.test.ts | 3 (SB-AUTH-01/04/05) | 2 (SB-AUTH-02 → Phase 14, SB-AUTH-03 → Phase 15) | 3 passing structural. |
| tests/sb-builder-infrastructure.test.ts | 1 (SB-INFRA-00 route scaffold) | 4 (SB-INFRA-01..04 → Phase 18 / Phase 14) | New structural test for route scaffold. |
| tests/sb-section-schema.test.ts | 1 (SB-SECT-05) | 4 (SB-SECT-01..04 → pre-existing Phase 11 debt) | SB-SECT-01..04 fixme carry-over from Phase 11 (STATE.md 2026-04-15 note) — **these are not Phase 12's responsibility**, but phase-11 UAT is still outstanding. |

Playwright run of the Phase 12 test filter (`SB-LAYOUT\|SB-AUTH\|SB-SECT-05\|SB-INFRA-00`): **14 passed, 3 skipped (intentional fixme)** in 1.4s.

`npx tsc --noEmit`: **13 errors — all "Cannot find module '@puckeditor/core'" / downstream**. This is NOT a code defect — the current worktree's `node_modules` does not have `@puckeditor/core` installed. `package.json` + `package-lock.json` both pin 0.21.2. Plan 03 SUMMARY records the exact same situation and its one-shot fix: `npm install`. Flagged under Human Verification. No blocking source error if install is run.

---

## 6. Outstanding items

### Debt

- SB-SECT-01..04 remain `test.fixme` (carry-over from Phase 11 — STATE.md 2026-04-15). Phase 12 did not introduce or resolve these.
- Supabase-generated types lag behind migrations 00019/00020 — several localized `as any` casts exist in `src/actions/{sops,sections}.ts` and `src/app/(protected)/admin/sops/page.tsx`. A single `npx supabase gen types` pass would drop the casts. Out of scope for Phase 12 per SUMMARY records.
- Worktree `node_modules/@puckeditor/core` missing in the current working copy — runs through `npm install` (no package.json change required).

### UAT items → human verification block in frontmatter

See `human_verification` section above. The big ones:

1. Full wizard → builder → autosave → publish → purge happy path (real Dexie + real Supabase).
2. Airplane-mode dirty → reconnect → flush timing.
3. Drag-reorder atomicity under real drag synthesis.
4. Cross-admin LWW toast across two tabs/sessions.
5. Mobile preview device-frame visual fidelity.
6. 128KB oversize rejection path.
7. Unsupported-version + corrupt-JSON worker fallbacks at runtime (console warn-once, byte-identical legacy rendering).

### Deferred (correctly scheduled for later phases)

Five items already scheduled — see `deferred:` block in frontmatter: DiagramHotspotBlock (P16), AI entry (P14), Template entry (P15), Reusable library (P13), Collab locks (P17), Pipeline+CI closeout (P18).

---

## 7. Recommended next step

1. **Immediate:** Run `npm install` in the worktree so `@puckeditor/core` resolves and `tsc --noEmit` is clean. (No code change required.)
2. **Before Phase 13 starts:** Execute the 11 human-verification scenarios above as a UAT pass. If any fail, capture as follow-up findings; do not regress Phase 12 scope.
3. **Orthogonal infra cleanup (tracked debt, not phase 12 scope):**
   - One pass of `npx supabase gen types` to drop the `as any` casts added across sops.ts / sections.ts / page.tsx.
   - Add a Playwright `webServer` config + a minimal `tests/fixtures/builder-sops.ts` harness so future phases can flip structural assertions to live DOM tests without having to refactor every test file.
4. **If UAT passes:** Mark the 9 requirements' status in REQUIREMENTS.md traceability table as Complete and promote Phase 12 to "Complete" in ROADMAP.md progress table.
5. **Proceed to Phase 13** (Reusable Block Library) — it is unblocked by the single-component-tree + puckConfig scaffolding delivered in Phase 12.

**Net verdict: FLAG.** The phase delivered every artifact the SPEC and plan must-haves required, with no stub-dressed code and no missing wiring. The flag is the structural-assertion pattern — nine requirements are proven by on-disk shape, not runtime round-trip. A focused human UAT pass against the live dev server + Supabase is the right next step; a BLOCK is not warranted because every deviation is documented and scope-appropriate.

---

*Verified: 2026-04-24*
*Verifier: Claude (gsd-verifier)*
*Re-verification: No (initial)*
