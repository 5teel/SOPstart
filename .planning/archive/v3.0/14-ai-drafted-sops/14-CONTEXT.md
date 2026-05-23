# Phase 14: AI-Drafted SOPs - Context

**Gathered:** 2026-05-10
**Status:** Ready for planning

<domain>
## Phase Boundary

A **third entry point** into the unified SOP builder, sitting alongside Phase 12's blank-page wizard and Phase 15's NZ template library. Admin types a short natural-language prompt at `/admin/sops/new/ai` ("PPE check for forklift operators at our Hamilton site") and the system:

1. Inserts a `sops` row with `source_type = 'ai'`, `status = 'parsing'`
2. Inserts a `parse_jobs` row with `input_type = 'ai_prompt'` and `prompt_text` populated for audit
3. Drives a 3-stage progress UI (`prompting -> drafting -> verifying`) on the existing `ParseJobStatus.tsx` stepper
4. Calls Anthropic Claude (haiku triage -> haiku-or-sonnet full parse) via the existing `parseSopWithGPT(promptText, { sourceMode: 'prompt', detailLevel })`
5. Resolves each emitted section's `section_type` slug -> `section_kinds.id` and persists with `section_kind_id` populated (closes ROADMAP success criterion #4 for this phase; Phase 6 retrofit deferred)
6. Calls `verifyTranscriptVsSop(promptText, parsed, { mode: 'prompt' })` (new mode parameter) + `detectMissingSections(parsed)` and writes the merged `VerificationFlag[]` to `parse_jobs.verification_flags`
7. Marks job `completed`; UI redirects admin to `/admin/sops/[sopId]/review` (NOT directly to the builder) so flags surface before editing per SB-INFRA-04
8. Admin clicks "Open in builder" from the review page to enter the unified builder. **NOTE: the "Open in builder" CTA does NOT currently exist on `ReviewClient.tsx` — only `WizardClient.tsx` (Phase 12 blank wizard) pushes to the builder route. 14-03 ADDS the CTA to ReviewClient.tsx as part of this phase.** From the builder onward, blank vs AI is indistinguishable.
9. The admin SOP library renders an "AI DRAFT" chip on tiles where `sops.source_type = 'ai'` (parallels the Phase 12 "AUTHORED IN BUILDER" chip).

This phase is **plumbing + prompt engineering**, NOT new architecture. Every primitive already exists; Phase 14 is a near-clone of `/api/sops/youtube/route.ts` plus three small generalisations (input_type CHECK, FORMAT_HINTS map, verifier mode flag, stage-set map on the stepper) and one small addition (Open-in-builder CTA on the review page).

</domain>

<decisions>
## Implementation Decisions

These six decisions are LOCKED. The planner / executor must NOT re-litigate them. Each is referenced by ID in the plan task actions.

### D-01: Use Anthropic Claude (NOT GPT-4o despite ROADMAP wording)
The ROADMAP entry for Phase 14 says "GPT-4o structured draft generator". This is **stale wording from earlier roadmap drafts**. The production SOP parser (`src/lib/parsers/gpt-parser.ts`) actually uses Anthropic Claude — `claude-haiku-4-5-20251001` for triage, escalating to `claude-sonnet-4-6` for COMPLEX inputs. The Phase 6 adversarial verifier (`verify-sop.ts`) is also Claude. **Phase 14 keeps Claude for consistency with Phase 6**; the function is named `parseSopWithGPT` for legacy reasons but its model selection is Claude. Diverging to GPT-4o solely for the AI-prompt path would duplicate the production parser without product benefit. ROADMAP wording will be reconciled at phase transition.

### D-02: Verifier gets a `mode` parameter
The existing `verifyTranscriptVsSop(transcriptText, parsed)` system prompt frames the task as "find discrepancies between the source TRANSCRIPT and the AI-structured SOP" — i.e. fidelity-to-source. A user PROMPT is not a transcript; there is no ground truth to verify *against*. Running the transcript-mode prompt unchanged would either (a) return `[]` for valid drafts, or (b) falsely flag inferred-but-not-stated content as "added information not present" — eroding admin trust in the amber banner.

**Decision:** Extend the signature to `verifyTranscriptVsSop(sourceText, parsed, opts?: { mode?: 'transcript' | 'prompt' })`. Default `mode` is `'transcript'` (backwards-compatible — Phase 6 callers unchanged). When `mode === 'prompt'`, swap the system prompt to a **plausibility / hallucination-check** framing:
> "You are a safety auditor reviewing a Standard Operating Procedure draft generated from a user's short natural-language prompt. Find HALLUCINATIONS that a reviewer would object to — fake regulatory citations, fabricated equipment model numbers, invented company-specific names, fictional NZ locations or sites, and PPE/hazards that contradict the prompt's stated industry. Do NOT flag content that was reasonably INFERRED from the prompt context (e.g. inferring 'high-vis vest' from a forklift prompt is correct inference, not hallucination). Respond with the same JSON-array contract as transcript mode."

`detectMissingSections(parsed)` is mode-agnostic (operates on parsed structure, not source) — keep unchanged; it covers the "missing PPE" SB-INFRA-04 case.

### D-03: Hand-off lands on review page, NOT the builder
After the API route returns `{ sopId }`, the prompt page does `router.push('/admin/sops/${sopId}/review')` — same surface uploaded SOPs land on. SB-INFRA-04 requires hallucinated hazards/PPE be **flagged before reaching the reviewer**, which only makes sense if review is the landing point. From the review page, an "Open in builder" CTA takes admin into the unified builder. **The CTA does NOT currently exist on `ReviewClient.tsx`** — Phase 12 only added the blank→builder push from `WizardClient.tsx`, not from the review page. **Phase 14-03 ADDS this CTA to ReviewClient.tsx** as a primary action (gated to non-uploaded sources so docx/pdf/image SOPs without `layout_data` aren't pushed into the builder before they have one). **Do NOT skip the review page**; do NOT add a separate flag banner to the builder shell.

### D-04: Persist the original prompt text on `parse_jobs`
Add `parse_jobs.prompt_text TEXT NULL` in the same migration that extends the `input_type` CHECK. Rationale:
- Audit trail — admin can re-read what they typed weeks later
- Mirror of the existing `transcript_text` column for the video pipeline
- Enables future "regenerate from same prompt" affordance
- Negligible cost (column nullable, rows produced only by the AI path)

### D-05: Render an "AI DRAFT" chip on `/admin/sops` tiles
Parallels the Phase 12 chip pattern (`AUTHORED IN BUILDER` shown when `source_type !== 'uploaded'`). Replace the binary "uploaded vs anything else" check with explicit per-source-type chip rendering:
- `source_type = 'uploaded'` -> no chip
- `source_type = 'blank'` -> `AUTHORED IN BUILDER` chip (existing)
- `source_type = 'ai'` -> `AI DRAFT` chip (NEW — same chip shape, different label)
- `source_type = 'template'` -> reserved for Phase 15

ROADMAP success criterion #3 ("admin cannot tell 'draft source: AI' apart from 'draft source: blank' once they're editing") **only excludes source-tells while editing**, not in the library. Library chip is allowed.

### D-06: Min word count via Zod `min(20)`
Block prompts under 20 characters at the Zod validator (`aiPromptSchema` in `src/lib/validators/sop.ts`). Reasoning:
- "make me an SOP" is a wasted Anthropic call (~$0.01 + 30s wall clock)
- Triage stage will likely return "SIMPLE" anyway and produce a low-confidence generic SOP that admin discards
- 20 chars is generous (e.g. "PPE for forklift ops" = 19 chars, just trips the limit; admin must add at least a site/qualifier)

Also enforce `max(2000)` to bound LLM cost (admin could paste a 100KB policy document into the textarea).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-level
- `.planning/REQUIREMENTS.md` §SB-AUTH-02, §SB-INFRA-04 — the two requirements this phase closes
- `.planning/PROJECT.md` — project vision, validated capabilities through Phase 13
- `.planning/ROADMAP.md` §"Phase 14: AI-Drafted SOPs" — phase goal + 4 success criteria + 3 plan stub descriptions
- `.planning/phases/14-ai-drafted-sops/14-RESEARCH.md` — **the most important input**; full reusable-assets table, pitfalls list, prompt-engineering pattern, 6 [DECISION-NEEDED] items (now resolved as D-01..D-06 above)
- `CLAUDE.md` §Learnings — especially:
  - 2026-04-04: Lazy-init Anthropic client pattern (mirror in any new module touching `@anthropic-ai/sdk`)
  - 2026-04-24: Worktree executors must use cwd-relative paths
  - 2026-05-08 entries: ALTER TABLE RENAME does not rewrite SQL function bodies; anon key env var is `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; database.types.ts must be extended manually in this worktree

### Phase 6 (closest analogue — read before any code)
- `src/app/api/sops/youtube/route.ts` — **canonical template for `/api/sops/ai-prompt`**. Text-only pipeline, no file upload, JWT auth, creates SOP + parse_job, runs `parseSopWithGPT` -> verifier -> persist sections -> mark complete. Phase 14's route copies this 1:1 with three swaps (input_type, source_type, FORMAT_HINTS key).
- `src/app/api/sops/transcribe/route.ts` lines 89-95 — idempotency guard pattern (`if (job.status === 'completed') return; if (job.status === 'processing') return;`). NOTE: Phase 14-02 explicitly does NOT mirror this on the AI route (each POST creates a fresh SOP+job — see 14-02 Task 2 rationale block; trades retry-dedup for simpler request-id-less semantics).
- `src/lib/parsers/gpt-parser.ts` — Claude tool-use parser. Phase 14 extends `FORMAT_HINTS` with a `'prompt'` key and adds an `opts` object signature (see D-01 + 14-02 task plan).
- `src/lib/parsers/verify-sop.ts` — Claude adversarial verifier. Phase 14 adds the `mode` parameter (D-02).
- `src/components/admin/ParseJobStatus.tsx` — Realtime + 5s polling stepper. Phase 14 generalises `VIDEO_STAGES` const into a `STAGE_SETS` map and adds an `'ai_prompt'` set (`prompting -> drafting -> verifying`).
- `src/components/admin/AdversarialFlagBanner.tsx` — amber banner; **zero changes**, will display AI-path flags automatically once `parse_jobs.verification_flags` is populated.
- `src/components/admin/MissingSectionWarningBanner.tsx` — missing-section warn-but-allow gate; zero changes.
- `src/app/(protected)/admin/sops/[sopId]/review/page.tsx` + `ReviewClient.tsx` — already passes `verificationFlags` to ReviewClient regardless of source. Zero changes for flag display. **Phase 14-03 ADDS an "Open in builder" CTA to ReviewClient.tsx** (the CTA does NOT exist there today — verified via grep; only `WizardClient.tsx` pushes to the builder route from the Phase 12 blank-wizard finish step).
- `supabase/migrations/00012_video_transcription.sql` lines 36-50 — the `parse_jobs.input_type` CHECK constraint that Phase 14 must extend.
- `supabase/migrations/00012_video_transcription.sql` lines 52-67 — the `sops.source_file_type` CHECK constraint (currently includes `'docx', 'pdf', 'image', 'xlsx', 'pptx', 'txt', 'video'`). Column is `NOT NULL` (per 00003). Phase 14-02 inserts `source_file_type: 'txt'` since `'txt'` is already legal — no constraint change needed.
- `supabase/migrations/00020_section_layout_data.sql` lines 23-34 — the `sops.source_type` CHECK already permits `'ai'`. **No migration needed for source_type.**

### Phase 11 (section_kind resolver path)
- `src/actions/sections.ts::listSectionKinds()` — RLS-scoped fetch of canonical kinds catalog. Phase 14's API route calls this once per pipeline run, builds a `slug -> id` map, applies during section insert.
- Section_kinds catalog (00019 migration) seeded with: `hazards`, `ppe`, `steps`, `emergency`, `signoff`, `content`, `custom`. AI parser emits `section.type` strings like `"hazards"`, `"ppe"`, `"procedure"`, `"emergency"`. Resolver does case-insensitive substring match against the canonical slugs; falls back to `null` (legacy substring renderer covers the gap).

### Phase 12 (entry-point template + builder hand-off)
- `src/app/(protected)/admin/sops/new/blank/{page.tsx,WizardClient.tsx}` — auth + admin/safety_manager guard; `categories` prop fetched server-side; React Hook Form + Zod; final step calls server action then `router.push('/admin/sops/builder/${sopId}')`. Phase 14's `/admin/sops/new/ai` mirrors the auth/guard/categories pattern but pushes to the **review page** instead of the builder (D-03).
- `src/app/(protected)/admin/sops/page.tsx` lines 168-172 — the existing `AUTHORED IN BUILDER` chip render path. Phase 14 generalises this to a per-source-type chip (D-05).

### Phase 13 (CLAUDE.md learnings — manual database.types.ts pattern)
- `src/types/database.types.ts` — extended manually per worktree learning; Phase 14 adds `parse_jobs.prompt_text` Row/Insert/Update extension and `'ai_prompt'` to the input_type literal union.

### External references
- Anthropic Claude tool-use docs (already integrated; no new external lookup needed)
- No new npm packages required

</canonical_refs>

<specifics>
## Specific Ideas

These NZ industrial domain examples (from the ROADMAP phase goal text and Simon's career background — Hamilton-area glass manufacturing, Coles/Woolworths grocery FMCG, NZ WorkSafe regulatory frame) are seed prompts the implementer should keep in mind for prompt-engineering and test fixtures:

- "PPE check for forklift operators at our Hamilton site" — the canonical example in the ROADMAP goal text. Should produce: hazards (load instability, blind spots, pedestrian collision, hydraulic failure), PPE (high-vis, steel-cap, hard hat conditional, hi-grip gloves), 8-12 steps, emergency procedures.
- "Glass furnace cool-down procedure for night shift handover" — implies hazards (burns, glass breakage, heat stress), PPE (face shield, heat-resistant gloves, leather apron), specific NZ shift-handover convention.
- "Chemical storage SOP" — deliberately vague case. Should produce a generic NZ HSNO-aligned SOP with `overall_confidence <= 0.6` and `parse_notes` flagging that the admin must refine for specific substances.
- "Pre-start inspection for the new CNC mill in machine repair" — implies hazards (rotating parts, flying debris, oil mist, electrical), PPE (eye protection, hearing protection, no loose clothing), checklist-style steps.

The system prompt addition for `'prompt'` mode (the addendum to `FORMAT_HINTS`) is sketched in 14-RESEARCH.md "Prompt Engineering Pattern" and the executor of 14-02 should refine it during implementation. Test fixture `tests/fixtures/anthropic-mock.ts` should produce a deterministic ParsedSop for the seed prompt to keep tests fast (~30s real Anthropic call per spec is too slow).

The "AI DRAFT" chip should match the existing `AUTHORED IN BUILDER` chip's exact visual treatment (same `text-[10px] font-bold uppercase tracking-wider text-steel-400 border border-steel-600 rounded px-1.5 py-0.5` Tailwind classes — see line 169 of `src/app/(protected)/admin/sops/page.tsx`). Visual consistency matters; do not invent a new chip style.

</specifics>

<deferred>
## Deferred Ideas

The following are explicitly OUT of scope for Phase 14. The orchestrator must not bake these into plans; downstream phases or backlog items will pick them up.

- **AI editing inside the builder** — "while you're editing, ask Claude to rewrite this hazard section" is a separate phase. Phase 14 only delivers AI as a **draft seed**, not an in-builder co-pilot. Future phase (post-v3.0) will revisit.
- **AI suggestions during walkthrough** — workers do not get AI hints during step execution. Out of scope.
- **Phase 6 retrofit of the section_kind_id resolver** — Phase 14 fixes this for the AI path only. Retrofitting `transcribe/route.ts` and `youtube/route.ts` to populate `section_kind_id` would be additive (legacy substring renderer keeps working) but is unrelated work; defer to a separate cleanup task.
- **Regenerate-from-same-prompt** — the schema supports it (`prompt_text` persisted per D-04) but no UI is built in Phase 14. Backlog candidate after first usage data lands.
- **Multi-turn / conversational draft refinement** — admin can't have a back-and-forth with the AI in Phase 14. Single prompt -> single draft. Refinement happens in the builder (manual edits) or by re-prompting.
- **Vimeo / non-YouTube URL support** — unrelated; Phase 6 carry-over.
- **Voice prompt input** — Phase 12.5 added voice transcription but only for measurement / note capture. Pasting a voice transcript into the textarea works manually; voice-to-prompt-textarea wiring is out of scope.
- **Cross-org global prompt library / prompt templates** — not in Phase 14. Phase 15 (NZ template library) is the canonical "starting point" surface.
- **Cost / token telemetry surfacing** — admin doesn't see "this draft used N tokens / cost $X". Out of scope; existing Phase 6 routes don't surface this either.
- **Prompt-injection hardening beyond admin-only access** — admin-only flow is the trust boundary; advanced prompt-injection mitigations (output filtering, instruction-hierarchy guards) deferred. Standard Anthropic system-prompt-above-user-message ordering is sufficient at this trust tier.
- **Retry idempotency on /api/sops/ai-prompt** — see 14-02 Task 2 rationale block. Each POST creates a fresh SOP+job; duplicate submissions produce duplicate AI runs that admin dedupes via the library. Revisit if cost telemetry shows real-world duplication.

</deferred>

---

*Phase: 14-ai-drafted-sops*
*Context gathered: 2026-05-10*
*Decisions D-01..D-06 pre-locked from Simon's preferences (recorded in this file before planning began)*
