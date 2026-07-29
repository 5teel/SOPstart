# Phase 40: Shared Creation Foundation - Context

**Gathered:** 2026-07-29
**Status:** Ready for planning

<domain>
## Phase Boundary

The four creation surfaces stop each carrying their own copy of the same thing. Exactly one component owns each of: file intake (accept list, size limits, HEIC→JPEG conversion), the department/category/title metadata picker, job progress (realtime + polling fallback, one stage vocabulary), and the admin page shell/nav. A SOP's category resolves to ONE column backed by ONE vocabulary, with every existing row backfilled and proven clean on prod. Nothing about the user-visible flow changes beyond what the decisions below explicitly allow — this phase exists to make Phase 41's nav change a one-line edit and Phase 42's convergence a rewiring job.

Requirements: DUP-01, DUP-02, DUP-03, DUP-04, DAT-01.

</domain>

<decisions>
## Implementation Decisions

### Category convergence (DAT-01)
- **D-01: New SOP-specific category vocabulary wins — BOTH existing columns retire.** `block_categories` was built for blocks (`area-forming` etc.), not SOPs. Seed a fresh SOP-category vocabulary from the real values currently in `sops.category` (free text, AI path) AND `sops.category_tag` (block_categories slugs, wizard path). Both old columns are retired onto the new one; no code path writes either retired column afterwards.
- **D-02: Backfill = exact/slug match first, AI-map the rest, null the unmappable.** One-off script: values matching the new vocab map directly; non-matching free text gets AI-mapped to the closest vocab entry; genuinely unmappable → null (uncategorised). A live query against prod must prove zero rows still carrying the retired columns (SC-5). Heed the [2026-07-05] null-clobber learning: failed AI-mapping steps must not overwrite good data — omit failed fields from writes.
- **D-03: Vocabulary is a fixed seed, code/migration-managed.** No org-editable CRUD surface this milestone (consolidation, not new capability). Org-editable list deferred (see Deferred Ideas).

### File intake (DUP-01)
- **D-04: One canonical accept list — level up, drop `.doc`.** Documents: `.docx .pdf .xlsx .pptx .txt`; images: `jpeg png webp heic/heif` with HEIC→JPEG conversion available on every surface (single implementation — the two existing copies collapse); video: `mp4/mov`. `.doc` is dropped everywhere: mammoth cannot parse it, so the new-version page accepting it was a silent accept-then-fail bug, not a feature. New-version gains xlsx/pptx/txt/webp/HEIC parity. Size limits carry forward as-is (50MB docs / 2GB video).
- **D-05: The list is IDENTICAL on all three surfaces — no per-context profiles.** The shared intake component exposes one accept list including video types on creation, video-generate, AND new-version. Simon explicitly chose this over a named-profiles shape.
- **D-06: New-version video is wired through the existing Phase 6 transcription pipeline in THIS phase.** A video dropped on the new-version page routes through the shipped video→SOP transcription pipeline to produce the new version's draft, same as creation. This is the one deliberate user-visible addition in the phase — required so D-05's identical acceptance is honest (never accept a type the backend can't process; that's the `.doc` bug again).

### Job progress (DUP-03)
- **D-07: One plain-language stage vocabulary, mapped over untouched internal keys.** A single universal worker-plain sequence (e.g. Uploading → Reading your document → Building the draft → Checking → Ready) that every pipeline's internal stages (parse, video transcription, AI draft, video generation) map onto. DB stage keys are NOT renamed — mapping happens at render. Consistent with the Phase 30 UX-07 plain-language pass.
- **D-08: `ParseJobStatus` is the base — extend it, retire the others.** It already supports per-source stage sets and realtime updates. Add the video-generation stage set and the polling fallback; `PipelineStepper` / `PipelineProgressClient` retire onto it. Realtime-with-polling-fallback is implemented exactly once.

### Metadata picker (DUP-02)
- **D-09: The shared picker owns title + departments + category.** The three core-metadata fields CRE-02 (Phase 42) will later require on every path. Detail-level is NOT a picker field — it's an AI-generation knob and stays per-surface (voice keeps its current hardcoding until Phase 42 addresses it).
- **D-10: One composite component (`SopMetadataFields` or similar), not a field kit.** A single component renders all fields with uniform layout; a surface may hide a field via prop only where its flow genuinely lacks it. The DUP-02 source sweep proves convergence by asserting the three near-identical copies are gone and every creation surface imports the one component.
- **D-11: Department writes stay on the Phase 33 grant-backed path.** The picker funnels through `assignSopDepartments` (SOP-target grants, overridden-from-birth semantics) — never direct `sop_departments` writes.
- **D-12: Upload does NOT get the picker in this phase.** Upload collecting metadata is CRE-02, Phase 42 scope. Phase 40 builds the component and swaps it into the three surfaces that already carry copies (PromptClient, WizardClient, VoiceDraftClient).

### Claude's Discretion
- **DUP-04 page shell:** not discussed — clear-cut. Every admin creation route renders the shared `AdminNav`/page shell (`src/components/admin/AdminNav.tsx`); no route hand-rolls its own back-link. Implementation detail is Claude's call.
- New category column naming/shape (`category_id` FK vs slug text column), migration numbering/ordering, and the exact plain-language stage labels are planner/executor calls — the decisions above constrain intent, not identifiers.
- Backfill script mechanics (Management API vs supabase-js, PGRST205 handling) — follow the Learnings entries; Claude's call.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design contract
- `.claude/skills/sketch-findings-SOPstart/references/authoring-flow.md` — v8.0 design contract; decision D-A1 "every path lands in the same builder … One flow, not four". Phase 40 is the component-level groundwork for it.

### Milestone/phase definition
- `.planning/ROADMAP.md` — Phase 40 section (§ v8.0): goal, 5 success criteria, sequencing rationale, anti-goals, SB-LINE-06 constraint.
- `.planning/REQUIREMENTS.md` — DUP-01..04 + DAT-01 definitions (lines ~748-756) and traceability table.

### Prior-phase contracts the phase must not break
- `src/actions/departments.ts` / `src/actions/grants.ts` — Phase 33 grant-backed department write path (`assignSopDepartments`); the shared picker must keep writing through it.
- `src/lib/governance/publish-core.ts` — `assertPublishGates()`; the parse→AI-review→verify→publish spine is frozen (v8.0 build-on list).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/admin/ParseJobStatus.tsx` — already multi-stage-set aware (`STAGE_SETS`: video_file / youtube_url / ai_prompt), elapsed timers, retry, error-at-stage. D-08 base component.
- `src/components/admin/VideoFormatSelectionModal.tsx` (lines 10-77) — one of the two HEIC→JPEG copies (`heic2any` dynamic import); the surviving conversion implementation can start from this.
- `src/components/admin/AdminNav.tsx` — the shared admin nav (Phase 30 UX-02); DUP-04 target shell.
- Phase 6 video transcription pipeline (upload → extract audio → transcribe → structure → verify) — D-06 wires new-version video through it.

### Established Patterns
- Accept lists today: `UploadDropzone.tsx:26-43,671-687` (docs + video, 50MB/2GB), `VideoFormatSelectionModal.tsx:10-14` (docs, 50MB, own HEIC copy), `versions/page.tsx:446` (`.docx,.doc,.pdf,.jpg,.jpeg,.png,.webp` — the outlier). These three literals are what D-04/D-05 collapse.
- Category writes today: AI route `src/app/api/sops/ai-prompt/route.ts:69,174` writes `sops.category` (free text); wizard path `src/actions/sops.ts:551` writes `sops.category_tag` (validated against `block_categories`). These are what D-01 retires.
- Source-sweep proof pattern: SC-2 explicitly wants convergence "proven by a source sweep rather than by eye" — follow the `tests/lint/*` guard pattern (register in a Playwright project regex per the [2026-05-25] learning, verify with `--list`).
- Backfill: follow `scripts/backfill-section-layouts.ts` precedent (idempotent, only touches qualifying rows) + the [2026-07-28] migration-applier learning (applier file lists must include later corrective migrations; assertions must pin every clause).

### Integration Points
- Dropzone swap sites: `UploadDropzone.tsx`, `VideoFormatSelectionModal.tsx`, `admin/sops/[sopId]/versions/page.tsx`.
- Picker swap sites: `PromptClient.tsx`, `WizardClient.tsx`, `VoiceDraftClient.tsx` (the three near-identical copies).
- Progress swap sites: parse flow (ParseJobStatus callers) + video pipeline (`PipelineStepper.tsx` / `PipelineProgressClient` callers).
- Category filter readers: worker `src/app/(protected)/sops/page.tsx` + admin `src/app/(protected)/admin/sops/page.tsx` — Phase 41's merged-surface filters read the new single column (roadmap: "the single category column the merged surface's filters read").

</code_context>

<specifics>
## Specific Ideas

- Stage labels should read like the Phase 30 plain-language pass ("Reading your document", not "Parsing") — the example sequence in D-07 is illustrative, not final copy.
- SC-5's proof is a LIVE query against prod showing zero rows on the retired columns — a green migration alone doesn't satisfy it.

</specifics>

<deferred>
## Deferred Ideas

- **Org-editable SOP-category vocabulary** — admin-settings CRUD (like Phase 34's `observation_labels`). Deferred: new capability inside a consolidation milestone; promote only if orgs ask.

</deferred>

---

*Phase: 40-Shared Creation Foundation*
*Context gathered: 2026-07-29*
