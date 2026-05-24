---
phase: 21-safety-critical-parsing
mode: context-pointer
created: 2026-05-24
status: pre-locked
---

# Phase 21 CONTEXT — Safety-Critical Parsing

> This is a **pointer document**, not a discuss-phase distillation. Phase 21 inherits
> a fully-locked design contract from Phase 20 (Conversion Pipeline V2) plus four
> VALIDATED spikes. The decisions below were locked PRIOR to this phase; the planner
> should treat them as non-negotiable inputs.

## What Phase 21 delivers (one paragraph)

The Phase 20 contract complete. Word / PDF documents parse into the SOP builder with
(1) a persistent side-by-side source viewer so admins can verify nothing was misread,
(2) an AI reviewer running five specialised verification jobs (omission, anchoring,
step-image alignment, table fidelity, terminology consistency), and (3) a mandatory
per-block verify checklist at the publish gate. The publish button is hard-disabled
until every block carries a verified-by flag.

## Pre-locked design contract (DO NOT re-litigate)

### Phase 20 SPEC decisions (`.planning/archive/v3.0/20-conversion-pipeline-v2/20-SPEC.md`)

| ID | Decision | Status |
|----|----------|--------|
| D-CV2-01 | Fidelity bar = **restructured (semantic)**, NOT pixel-faithful | LOCKED |
| D-CV2-02 | Coverage = **all upload paths** (DOCX/PDF/scan/video; AI-prompt partial — Jobs D+E only, no verify gate per CONV-12) | LOCKED |
| D-CV2-03 | Review surface = **full builder** (Rung C); legacy `/admin/sops/[sopId]/review` retires | LOCKED |
| D-CV2-04 | Verification = **three independent layers** (side-by-side source viewer + AI reviewer + per-block verify checklist) | LOCKED |
| D-CV2-05 | Reviewer = **all five jobs** (A hallucination, B omission, C anchoring, D table fidelity / safety completeness, E terminology / clarity) | LOCKED |
| D-CV2-06 | Provenance = **required on every block**; `block_provenance` JSONB on `sop_section_blocks` | LOCKED-but-unshipped — column does NOT yet exist on master (grep across 00019..00031 returns zero matches). Phase 21 migration 00032 creates it. See "Already shipped" below for what IS on master. |
| D-CV2-07 | Library matching = parser proposes link-vs-write-new | DEFERRED (Phase 13-03 covers `propose link`; full pipeline integration is Phase 21 follow-up) |
| CONV-09 | Per-day re-run cap = **5 per SOP per day** | LOCKED |
| CONV-10 | Single-pass verify gate, no multi-role split | LOCKED for Phase 21; multi-role is Phase 24+ |
| CONV-11 | Video provenance = **timestamp range only**; frame-grab deferred | LOCKED (out of scope for Phase 21 — video sources optional) |
| CONV-12 | AI-prompt source = Jobs D+E only, **skip verify checklist gate** | LOCKED |

### Spike outcomes (VALIDATED 2026-05-15)

| Spike | Validation | Production approach |
|-------|------------|---------------------|
| 001 | PDF image extraction bundle-safe | `unpdf.extractImages(freshUint8Array, pageNum)` for bytes + `pdfjs` op-list+CTM-derived bbox for provenance. **0 MB bundle Δ.** Fresh `new Uint8Array(buf)` per call (CLAUDE.md learning logged). |
| 002 | Source-viewer bbox highlight | `pdfjs.getDocument` + per-page `<canvas>` + DOM overlay via `viewport.convertToViewportRectangle`. **33 ms click→overlay (6× under 200 ms budget).** |
| 003 | AI reviewer omission + anchoring | Sonnet 4.5 (or Haiku 4.5 — Plan 21-03 A/B before lock); ordered Jobs A → B → C → D → E in one HTTP session for prompt-cache reuse; `max_tokens 1500-2000`; "top 5 cap, ≤ 100-char descriptions" in system prompts. **$0.06 per parse for B+C; ~$0.15 for all five at Sonnet.** |
| 004 | Per-block verify checklist UX | Keyboard-driven (`j`/`k`/`a`/`d`/`Enter`); approve implicit-acknowledges flags; publish gate = `(approved === total) AND (every flagged block has been approved OR declined)`. **2.5 min for 50 blocks careful pace.** |

## Already shipped (on master — do NOT replan)

Build on these, don't redo:

| Commit | What landed |
|--------|-------------|
| `7b9151e` | DOCX images anchored to steps by table-row containment (structural alignment, not stream proximity) — provenance foundation |
| `c4f9b9a` | Batched signed-URL fetch for 50+ images — source-viewer perf primitive |
| `e33669e` | DOCX → Puck `layout_data` written per `sop_sections` row — parsed drafts now land in builder directly |
| `c47baa7` | `StepWithPhotosBlock` + `PhotoGridBlock` registered in `BLOCK_REGISTRY` + contract-check exclusions — block types Phase 21 will hang `verified_by` flags on |
| `064e819` | `layout_data` photo URLs signed from private `sop-images` bucket — secure source-viewer image loading |

**Note: `block_provenance` JSONB column on `sop_section_blocks` is NOT on master** — D-CV2-06 is locked-but-unshipped. Phase 21 migration 00032 (Plan 21-01 Task 1) creates it. Shape captures: source file region (page/range/bbox), parser run id, parser version. Column is **nullable** so existing `sop_section_blocks` rows survive.

**Phase 20 was archived (`.planning/archive/v3.0/`) because the contract was renamed
"Safety-Critical Parsing" in the v4.0 roadmap pass. The SPEC + 4 spikes remain
authoritative inputs for Phase 21 planning.**

## Source artifact map

| Concern | Source |
|---------|--------|
| Goal | `.planning/REQUIREMENTS.md` § v4.0 → Safety-Critical Parsing (Phase 21) — 23 requirements |
| Design contract | `.planning/archive/v3.0/20-conversion-pipeline-v2/20-SPEC.md` — 12 locked requirements + 25 acceptance criteria |
| Feasibility | `.planning/spikes/001-pdf-image-extraction-bundle-safe/README.md` |
| | `.planning/spikes/002-source-viewer-bbox-highlight/README.md` |
| | `.planning/spikes/003-ai-reviewer-omission-anchoring/README.md` |
| | `.planning/spikes/004-per-block-verify-checklist-ux/README.md` |
| Code surface | `src/lib/parsers/` · `src/app/(protected)/admin/sops/builder/[sopId]/` · `src/components/sop/blocks/` · `src/actions/{sops,sop-section-blocks,sections,versioning}.ts` · `supabase/migrations/` (next = **00032**) |

## Decisions (locked — do not revisit)

- **D-21-01** — Migration sequence number is **00032** (not 00031; 00031 is already taken by sub-trades RLS recursion fix from Phase 15)
- **D-21-02** — Reuse `verify-sop.ts` lazy-Anthropic-singleton + `fetch` indirection (Phase 15 fix preserved). NEW reviewer jobs extend this module, not parallel infra.
- **D-21-03** — All five AI jobs run in **one HTTP session per parse** to share the source-content prompt cache (`cache_control: {type:'ephemeral'}` on the source block).
- **D-21-04** — Reviewer outputs persist to `parse_jobs.ai_review_results` (JSONB) so re-runs are diff-able and the builder can lazy-load them per block.
- **D-21-05** — `sop_section_blocks.verified_by_admin_id` + `sop_section_blocks.verified_at` are **nullable** so old SOPs survive (and so Phase 23 G-01 supersede flow doesn't break on version bumps).
- **D-21-06** — Per-org Anthropic spend cap is enforced at the **reviewer-orchestrator boundary**, not per-job. Storage: a NEW `org_anthropic_spend` table created in migration 00032 (Plan 21-01 Task 1). The Phase 15 voice-qa cap was scoped per-feature, not shareable for reviewer; do NOT attempt to reuse — create the new table unconditionally. Columns: `organisation_id uuid PK`, `month_start date`, `spend_cents int4 DEFAULT 0`, `cap_cents int4 DEFAULT 500` ($5/month default).
- **D-21-07** — Bulk-verify, "approve all flagged", and trust-score skip are **prohibited UI**. The 2.5-min friction IS the safety feature (Spike 004 verdict, D-CV2-04).
- **D-21-08** — Re-editing a block invalidates its own `verified_by` only — NOT the whole SOP (SCP-VERIFY-04). Triggered server-side on any `sop_section_blocks` content mutation.
- **D-21-09** — Bundle isolation: any new admin-side viewer (pdfjs DOM overlay) or reviewer UI components MUST dynamic-import; verify worker bundle stays within ±2 KB of `/sops/[sopId]/page` baseline (1104 KB) via existing `scripts/check-bundle-size.ts` chunk-existence assertions.
- **D-21-10** — Wave 0 (Playwright test stubs) lands FIRST and all tests start as `test.fixme` per existing pattern (see `tests/integration/sb-*.test.ts`).
- **D-21-11** — SCP-AI-02 (anchoring) + SCP-AI-03 (step-image alignment) are served by **Job C as a single LLM call** that returns both `suggested_step_id` and `alignment_concern` in one response. Rationale: shared photo+step context, identical source content prefix, cost win, matches Spike 003 prompt shape. Splitting into two jobs would double cost for no fidelity gain.
- **D-21-12** — Legacy `/admin/sops/[sopId]/review` route retirement path: **option (b) — delete the route folder + redirect any inbound links to the new builder `/admin/sops/builder/[sopId]`**. Server-side redirect via `next.config.ts` `redirects()` so bookmarks survive. Removes ~600 LoC of dead component code. (Options considered: a/keep as read-only fallback, b/delete+redirect ← chosen, c/keep with deprecation banner.)
- **D-21-13** — Per-day reviewer re-run rate-limit storage: NEW `ai_review_rate_limits` table created in migration 00032 (Plan 21-01 Task 1). Columns: `sop_id uuid PK`, `runs_today int4 DEFAULT 0`, `runs_today_reset_at timestamptz DEFAULT now()`. Atomic increment via `UPDATE ... RETURNING`. This decision LOCKS the storage shape in Wave 1; no follow-up migration 00033 needed for Phase 21.

## Deferred Ideas (out of scope for Phase 21)

| Item | Reason | Future phase |
|------|--------|--------------|
| Frame-grab thumbnails for video provenance | CONV-11; timestamp range only in Phase 21 | Plan 20-02 enhancement on pilot demand |
| Multi-role split sign-off (hazards by safety_manager, steps by supervisor) | CONV-10; single-pass for Phase 21 | Phase 24+ |
| Per-org configurable reviewer prompts | Plan 20-04 ships one universal prompt set | Phase 21+ enhancement on pilot demand |
| Bulk migration of pre-Phase-20 SOPs to layout_data | Backward-compat tolerates absence; only NEW parses get full pipeline | Separate ops concern |
| `DiagramHotspotBlock` auto-placement | Phase 17 (Image Annotation) deliverable; Phase 21 falls back to `PhotoBlock` | Phase 17 |
| Streaming reviewer flags into UI | Ship full-response render in Phase 21; streaming is post-MVP | Phase 21+ |
| Multi-language reviewer (non-English SOPs) | Corpus is English; Visy pilot validates before any non-English plant | Phase 22 (voice multi-lang) explores adjacent |
| Mobile/tablet verify-checklist UX | Desktop-only per 2026-05-05 Visy interview | Out — not a future enhancement |

## Claude's Discretion

The planner / executors have discretion on:

- **Reviewer model lock** (Sonnet 4.5 vs Haiku 4.5) — Spike 003 used Sonnet for rigour; production lock decided in Plan 21-03 via A/B on a held-out corpus
- **Block-library matching threshold** — start at cosine similarity ≥ 0.78 (Phase 13 picker default); tune in implementation if pilot reveals drift
- **AI flag ranking order** — Spike 003 signal: sort `severity:critical` first, then by `source_location_hint` containing multiple page refs (proxy for warning-repeated-in-source = higher priority)
- **Reviewer auto-trigger debounce** — recommend 500ms post-save for Job C (cheap, ~$0.01 when clean); parse-completion only for B/D/E
- **Section-jump nav at 100+ block scale** — Spike 004 flagged as "if Visy SOPs routinely exceed 80 blocks." Discretion to add `Ctrl+1`-`Ctrl+9` if data warrants
- **Cost ceiling per parse** — recommend $0.15 / parse (Sonnet) hard ceiling, $0.03 / parse (Haiku) hard ceiling

## Future-phase compat notes

- **Phase 23 G-01 supersede compat** — When a new SOP version is created, the new `sop_section_blocks` rows MUST start with `verified_by_admin_id = NULL` (unverified). Wave 0 Task 2 (Playwright stub list) MUST include a test stub: `test.fixme('Phase 23 compat: version bump produces unverified blocks')` so the assertion is in the suite when Phase 23 lands and can be flipped live then.

## Gray areas / unresolved (none blocking)

None. All discuss-phase questions were resolved by Phase 20 SPEC + 4 spikes BEFORE Phase 21 was scoped.

---

*Phase 21 is a build-from-locked-contract phase. Read the SPEC + 4 spike READMEs; do not relitigate.*
