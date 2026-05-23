# Milestones

Record of shipped SafeStart milestones. Each entry links to the archived planning
artifacts and captures the outcome without rehashing every decision — those live
in the per-phase SUMMARY.md files under `.planning/archive/{version}/`.

## v2.0 — SOP Creation Pathways

**Shipped:** 2026-04-13
**Archive:** `.planning/archive/v2.0/`

### Goal

Three new ways to create and consume SOPs — from video transcription, from expanded
file types (photos, Excel, PowerPoint), and as generated video content with AI
narration.

### Phases shipped

| # | Phase | Completed |
|---|-------|-----------|
| 1 | Foundation — multi-tenant auth, RBAC, PWA shell | 2026-03-23 |
| 2 | Document Intake — AI parse pipeline, admin review, publish | 2026-03-24 |
| 3 | Worker Experience — walkthrough, offline, library, assignment | 2026-03-25 |
| 4 | Completion and Sign-off — photo evidence, supervisor review | 2026-03-26 |
| 5 | Expanded File Intake — TUS uploads, photo OCR, xlsx/pptx/txt | 2026-04-03 |
| 6 | Video Transcription (Upload and URL) — MP4/MOV + YouTube → SOP | 2026-04-03 |
| 7 | Video Transcription (In-App Recording) — MediaRecorder + iOS fallback | 2026-04-04 |
| 8 | Video SOP Generation — narrated slideshow, screen-recording, AI video | 2026-04-04 |
| 9 | Streamlined File → Video Pipeline — one-click upload-to-video flow | 2026-04-13 |
| 10 | Video Version Management — multiple video versions per SOP | 2026-04-13 |

### Headline decisions locked in

- **Stack:** Next.js 16 + Supabase + GPT-4o + Dexie + @serwist/next + TanStack Query
- **Multi-tenancy:** Supabase RLS + JWT custom claims (not retrofittable — hardwired from Phase 1)
- **Completion records:** append-only (no UPDATE/DELETE) for legal defensibility
- **Async parsing:** all LLM work routed via `parse_jobs` + realtime + polling hybrid
- **Publish gate:** server-enforced unapproved-section check preserved byte-identically through all pipeline changes
- **Pipeline linkage (D-06):** `sop_pipeline_runs.id` threads upload → parse → sop → video for single-flow audit
- **Multi-version videos:** version_number incrementing, partial unique index for "one active per SOP"
- **Vimeo URL pathway:** deferred (API scope not confirmed); never use yt-dlp/ytdl-core for YouTube (ToS)

### Known debt carried into v3.0

- Phase 7 in-app recording has no formal UAT verification run (all stubs still `test.fixme`)
- Phase 9 verification status is `human_needed` — live UAT against remote Supabase pending
- LR-03 from Phase 9 code review: `after()` async errors do not surface to `video_generation_jobs` — worth promoting if user-facing pipeline failure visibility becomes a concern
- Phase 999.1 backlog parking lot: stale video job cleanup service still unscheduled
- Factory-floor NZ-accented transcription accuracy (75-85%) still flagged as a concern for specific terminology

### What v2.0 enables for v3.0

The pipeline infrastructure (`sop_pipeline_runs`, publish auto-queue, version management)
is reusable for authored-from-scratch SOPs that want to be rendered as video. The
`sop_sections` + `sop_steps` schema is the foundation the v3.0 builder will extend.

## v3.0 — Native SOP Builder

**Shipped:** 2026-05-23
**Archive:** `.planning/archive/v3.0/`

### Goal

Move SOP authoring from "upload-and-parse only" to first-class native authoring inside the app — a block-based builder backed by a reusable library, with an AI-drafted starting point, the paper/ink design language rolled across the whole product, and a manufacturing-line/kiosk mode informed by the Visy customer interview.

### Phases shipped

| # | Phase | Completed |
|---|-------|-----------|
| 11 | Section Schema & Block Foundation — additive `section_kinds` + `blocks`/`block_versions`/`sop_section_blocks` | 2026-04-15 |
| 12 | Builder Shell & Blank-Page Authoring — Puck builder + `layout_data` JSONB + blank-page wizard | 2026-04-24 |
| 12.5 | Blueprint Redesign — paper/ink worker UX overhaul + 7 new block kinds + voice/cmdk | 2026-05-07 |
| 13 | Reusable Block Library — org-vs-global block CRUD + 65 NZ seed blocks + platform-admin curation | 2026-05-07 |
| 14 | AI-Drafted SOPs — prompt → GPT-4o → Claude adversarial verifier → editable draft | 2026-05-10 |
| 14.5 | Blueprint Shell Rollout — paper/ink across admin/auth/dashboard/library/worker (~90 files) | 2026-05-12 |
| 15 | Manufacturing-Line Mode (Visy) — sub-trade tags, voice Q&A, site tier, kiosk shell, training-record export | 2026-05-13 |
| 20 (partial) | Conversion Pipeline V2 (slice) — DOCX → builder `layout_data` with side-by-side step + photo blocks | 2026-05-17 |

### Headline decisions locked in

- **Builder data model:** Puck `layout_data` JSONB on `sop_sections` is the source of truth for authoring; legacy linear render is the read-only fallback
- **Block library separation:** every block kind has a global (Potenco-curated) tier and an org tier; SOPs reference blocks by junction row with explicit pin-version vs follow-latest semantics
- **Adversarial AI gate (D-14):** GPT-4o drafts → Claude verifier scrutinises before the admin sees anything — failures surface as inline flags, not invisible regressions
- **Paper/ink design language:** product-wide; legacy steel/yellow + SiteThemeProvider + ThemePicker removed in 14.5
- **Sub-trade tag visibility:** added to RLS via `SECURITY DEFINER` helpers (`current_user_sub_trades`, `sub_trade_id_intersects`); back-compat short-circuit for pre-Phase-15 SOPs with zero tags
- **Voice Q&A grounding:** RAG-grounded to a single SOP via `packSopForPrompt` shared between answer + verifier calls (byte-identical cache key)
- **Conversion Pipeline V2 contract (Phase 20 SPEC):** parsed drafts land as Puck `layout_data` in the builder; the dedicated review surface retires; three-layer verification (side-by-side viewer + AI reviewer × 5 jobs + per-block verify checklist at publish gate) is the safety story — slice shipped in v3.0, full contract carries to v4.0

### v3.0 closeout deferrals (carried to v4.0 backlog)

- **Phase 16: NZ Template Library** — curated WorkSafe / machinery / chemical-handling templates as a third builder entry point. Real value, but its own milestone-scale block of work.
- **Phase 17: Image & Diagram Annotation (Konva)** — dual-store (JSON edit + baked PNG worker view), DiagramHotspotBlock, stylus + palm rejection. Needs explicit customer pull before building.
- **Phase 18: Collaborative Editing** — section-level pessimistic locks + Realtime presence + conflict modal. Current single-admin pattern has not surfaced contention.
- **Phase 7: Video Transcription (In-App Recording)** — still blocked on iOS Safari MediaRecorder maturity (carried from v2.0).
- **Phase 9: Streamlined File → Video Pipeline** — partial code on master; v4.0 to decide whether to finish, descope, or absorb into Phase 20 video integration.
- **Phase 20 (remainder)** — persistent side-by-side source viewer, AI reviewer × 5 jobs (auto + manual), mandatory per-block verify checklist at publish gate. **Promoted to v4.0 Phase 01: Safety-Critical Parsing** — this is the load-bearing safety story for the next milestone.

### v3.0 closeout deletions

- **Phase 19: Pipeline Integration, Bundle Isolation & v3.0 Closeout** — deleted from roadmap. Its only purpose was to tie together Phases 9 + 16 + 17, all of which deferred. Bundle-isolation CI gate already lives in `scripts/check-bundle-size.ts` (Phase 15 Wave 4), so the CI half of Phase 19 was already shipped.

### Closeout dispositions (UAT debt closed without separate runs)

- **Phase 12 UAT #3 + #6** (airplane-mode queued save, cross-admin LWW toast): closed as field-verified — offline queue + LWW are structurally in code and prod usage since 2026-04-24 has not surfaced regressions.
- **Phase 13 UAT 13-03/04/05** (picker, diff modal, global-blocks UI): closed as field-verified — Phase 13 plumbing was exercised continuously through Phase 14/15/20 work without regression.
- **Phase 14 UAT 1/2/4** (live Anthropic API): closed as verified-via-downstream — Phase 20 work has been hitting the live Anthropic API path since 2026-05-15.
- **Phase 15 final UAT** (`supabase db push --include-all` migration 00030 + Visy demo dry-run): carried as a manual operator action for Simon — not a code gate.

### Known debt carried into v4.0

- ~~Migration 00030 push pending~~ — **cleared 2026-05-23**: `npx supabase db push --include-all` reported "Remote database is up to date". Phase 15 sub-trade RLS live on prod.
- **Phase 14.5 residual** — role-aware home + global Cmd+K were rolled forward into Phase 15 scope; verify these still land before they get forgotten.
- **Browser-tab/PWA icon caches** — paper/ink rebrand of `favicon.svg` + `apple-touch-icon.png` + PWA icons (commit `ff00006`) shipped 2026-05-22; OS-level icon caches are sticky on installed PWAs and may need home-screen reinstall to refresh.
- **Bundle baseline** — `/sops/[sopId]/page` re-baselined 1095 → 1104 KB on 2026-05-22 (global `TopHeader` added). ±2 KB tolerance preserved; further drift is real regression.
- **999.1 stale video-job cleanup service** — still parked in backlog from v2.0.
- **999.3 security hardening (CSP/HSTS/frame-ancestors)** — still parked in backlog.

### What v3.0 enables for v4.0

- The Puck `layout_data` model and the block-junction tables (`sop_section_blocks`, `block_versions`, `sop_block_update_decisions`) are the substrate the Phase 20 remainder builds on — the AI reviewer + per-block verify checklist both operate on block-level state, not the legacy linear section model.
- The paper/ink shell + global `TopHeader` (added 2026-05-22) give v4.0 a stable surface for any new admin/worker views.
- The sub-trade tag RLS pattern from Phase 15 is the template for any future tenant-scoped visibility rules.
