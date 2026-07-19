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

## v4.0 — Safety-Critical Parsing + Voice + AI Foundation

**Started:** 2026-05-24 · **Shipped:** 2026-07-02 *(backfilled entry 2026-07-19 — closeout was never formally run)*

- **Phase 21 + 21.5 + 21.6:** Safety-critical parsing contract (side-by-side source viewer, AI reviewer × 5 jobs, per-block verify checklist at publish gate) + builder review/edit UX redesign (Review Station, 3-stage stepper, humanized labels).
- **Phase 22:** Voice-driven walkthrough — live Deepgram STT push-to-talk, TTS read-back, spoken step progression, always-on visual layer (English-only; multi-language deferred).
- **Phase 23:** AI field layer (universal AI read/write on every editable field — the X-03 backbone) + version supersede/diff/restore + worker-instance sign-off chain.
- **Phase 24:** Procedure Flow spatial node graph (positioned colour-coded nodes, branch-labelled edges, FIT/EXPORT-PNG).
- **Phase 25:** Department as a first-class entity (org-scoped departments, m2m junctions to blocks/SOPs/members, RLS visibility gating, owner accountability).
- Residual human-UAT items (21.6/22/23/25) carried per the v3.0 field-verification precedent.

## v5.0 — AI-Native Builder + Agent Foundation

**Started:** 2026-07-02 · **Shipped:** 2026-07-12 *(backfilled entry 2026-07-19)*

- **Phase 26 (14 plans):** Puck fully replaced with a bespoke inline editor — one surface for create/convert/edit, tiered context-aware inserter, smart ghosts, unified Visual block with Konva diagram annotation (Phase 17 absorbed), bake-on-publish so workers never download Konva. The frozen `layout_data` / `sop_section_blocks` / `block_provenance` contract preserved — parse→AI-review→verify→publish spine untouched (git-diff-empty KEEP files).
- **Phase 26.5:** Agent metadata layer — per-SOP/per-block semantic tags, entities, embeddings, cross-SOP links, memory, learning proposals, review state.
- **Post-26.5 ad-hoc (2026-07-06→09):** AI provider flexibility (model registry, provider-agnostic adapter, org-level model override), unified AI-draft surface, QR deep links, read-aloud, draft triage queue, tree-rail overhaul, layout_data-trio fix + prod backfill.
- **Phase 27:** AI provider & settings formalization (v5.0 close).

## v6.0 — SOP Ownership & Governance Infrastructure

**Started:** 2026-07-12 · **Closed:** 2026-07-19 (quick-close)

North star (locked): ease of use and maintenance first — governance never blocks worker read/walkthrough access.

- **Phase 28 (6/6):** Owner on every SOP (auto-backfilled), review-due dates + cadence, unified governance queue with one-click actions.
- **Phase 29 (6/6):** Optional per-category 1–4 step approval chains, snapshotted per version, one-click approve; absent chain = publish exactly as before (assertPublishGates extraction).
- **Phase 30 (8/8):** UX consolidation — one home per role, one admin nav, one create entry, one governance surface, 3-tab worker SOP view, plain language (UX-01..08).
- **Phase 32 (9/9):** Visual org model & library permissions — access map (WiringPatchBay), access_grants model + materialization into sop_departments/sop_access_people junctions, org-scope isolation.
- **Phase 33 (11/11):** Per-SOP access granularity (SOP-target grants, narrowing override with snapshot/restore), full org-ladder teams column, plain-language access panel, Wayfinder builder header + single Tools menu. Gap-closure hardened deleteSop org-scoping (CR-01) and the all_departments restore ratchet (WR-02). Human UAT (5 items) verbally approved 2026-07-19; `33-HUMAN-UAT.md` retained.

### Rolled forward into v7.0

- **Phase 31: Training Records + AI Maintenance Schedule** (TRN-01..03, REV-05) — never planned/executed in v6.0. Its scope (per-worker training evidence, CSV export, trained-on-outdated-version surfacing, AI-prioritized review plan) is subsumed and extended by the v7.0 competency layer.

### What v6.0 enables for v7.0

- Access grants (Phases 32–33) encode who is REQUIRED to know what — the left-hand side of a training/competency matrix.
- Completions + immutable sign-off chains (Phase 23/D-17) are the evidence half. v7.0 joins the two.
