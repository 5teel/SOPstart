# Phase 14: AI-Drafted SOPs — Research

**Researched:** 2026-05-10
**Domain:** Natural-language → structured SOP draft generator + adversarial verification + builder hand-off
**Confidence:** HIGH (almost every primitive already exists in src/; Phase 14 is plumbing + prompt engineering)

## Summary

Phase 14 is a thin third entry point on top of fully-built primitives. The Phase 6 video pipeline already implements the *exact* shape Phase 14 needs:

1. Insert a `sops` row with `status='parsing'`, then a `parse_jobs` row driving a 5-stage progress UI
2. Call `parseSopWithGPT(text, hint)` to produce a `ParsedSop` with sections + steps
3. Call `verifyTranscriptVsSop(sourceText, parsed)` (Claude adversarial verifier) and `detectMissingSections(parsed)` to populate `parse_jobs.verification_flags`
4. Persist to `sop_sections` / `sop_steps`, set `parse_jobs.status='completed'`
5. The existing `/admin/sops/[sopId]/review` page automatically displays `AdversarialFlagBanner` + `MissingSectionWarningBanner` keyed off `verification_flags`
6. Land in builder via `router.push('/admin/sops/builder/${sopId}')` (matches blank-page wizard's Step 4)

**Important correction to ROADMAP framing:** the parser is named `parseSopWithGPT` but is actually using **Anthropic Claude** (haiku-4-5 triage → sonnet-4-6 full) via tool-use structured output, not OpenAI GPT-4o. The research below treats the Claude tool-use schema as the canonical extension surface. The discuss-phase should clarify whether the intent is to keep using Claude (consistent with Phase 6) or genuinely switch to GPT-4o for the AI-prompt path.

**Primary recommendation:** Build 14-01 as a near-clone of `/api/sops/youtube/route.ts` (the cleanest reference — no file upload, just text → pipeline), with one new migration (`input_type IN (..., 'ai_prompt')`), one new prose-targeted format hint added to `gpt-parser.ts`, and one `isVideoSop`-style branch in `ParseJobStatus.tsx` to swap the stage label set to `prompting → drafting → verifying → ready`. Reuse everything else verbatim.

## User Constraints (from CONTEXT.md)

CONTEXT.md does not exist for Phase 14 yet. The discuss-phase will produce one. The four ROADMAP success criteria are treated as soft locks pending discuss output:

- AI prompt → structured draft within Phase 6 named-stages UI
- Output cross-checked by Claude before reaching review (amber banner reused)
- Lands in same builder as blank/template flows (admin can't tell sources apart while editing)
- Flows through Phase 2 publish gate + Phase 11 section-kind resolver

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SB-AUTH-02 | Admin types NL prompt → receives structured draft with hazards/PPE/steps/emergency pre-filled for review | 14-01 route + 14-02 generator (extend `gpt-parser.ts` with `'prompt'` source hint) |
| SB-INFRA-04 | AI-drafted content passes Phase 6 adversarial verifier before admin review (hallucinated hazards/missing PPE flagged) | 14-03 reuses `verifyTranscriptVsSop()` + `detectMissingSections()` — already returns `VerificationFlag[]` consumed by `AdversarialFlagBanner` |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Prompt entry form (textarea, category, submit) | Browser (admin client) | — | Standard React Hook Form pattern, stays consistent with blank-page wizard |
| Named-stage progress UI | Browser (admin client) | Realtime + DB polling | Reuses `ParseJobStatus.tsx` Realtime+5s-polling fallback verbatim |
| Prompt → structured SOP generation | API (Next.js Route Handler) | Anthropic API | Long-running (≥30s); MUST run server-side with `maxDuration = 300` per Phase 6 precedent |
| Adversarial verification | API (Route Handler) | Anthropic API | Same as Phase 6 — runs after structuring stage |
| Section persistence (`sop_sections`/`sop_steps`) | API + Postgres (RLS) | — | Identical to Phase 6's transcribe/youtube routes |
| Flag display + publish gate | Browser (review client) | — | `AdversarialFlagBanner` + `MissingSectionWarningBanner` already wired into `ReviewClient.tsx` |
| Cross-org isolation | Postgres RLS | JWT claims in route | `organisation_id` derived server-side from JWT; existing RLS on `sops`/`parse_jobs`/`sop_sections` covers it — NO new policies needed |

## Reusable Assets

| Asset | File | What it provides | "Do not reinvent" |
|-------|------|------------------|-------------------|
| **Adversarial verifier (Claude)** | `src/lib/parsers/verify-sop.ts` | `verifyTranscriptVsSop(sourceText, parsed) → VerificationFlag[]`; `detectMissingSections(parsed) → VerificationFlag[]` | Lazy-init Anthropic client; non-blocking on failure (returns `[]`); JSON-array system prompt with critical/warning severities |
| **GPT structured parser** | `src/lib/parsers/gpt-parser.ts` | `parseSopWithGPT(text, sourceFileType?, detailLevel?) → ParsedSop`; haiku triage → haiku-or-sonnet full parse via Claude tool-use; `FORMAT_HINTS` map for source-specific prompts | Tool schema (`SOP_TOOL`) is already aligned to `ParsedSopSchema`; just add a `'prompt'` key to `FORMAT_HINTS` and pass it from the new route |
| **Named-stage progress UI** | `src/components/admin/ParseJobStatus.tsx` | Realtime subscription on `parse_jobs.current_stage`; 5s polling fallback; `VIDEO_STAGES` const drives the stepper; `isVideoSop` branch toggles step list | Generalise the stepper: introduce a `STAGE_SETS` map keyed off `parse_jobs.input_type`, add `'ai_prompt'` set: `prompting → drafting → verifying`. Or pass `stageSet` prop from `ReviewClient`/`page.tsx` |
| **Adversarial flag banner** | `src/components/admin/AdversarialFlagBanner.tsx` | Amber banner; expandable; per-flag resolve; emits `onUnresolvedCountChange(criticalCount)` for publish gate | Already filters out missing-section flags (those go to MissingSectionWarningBanner); zero changes needed |
| **Missing-section warning banner** | `src/components/admin/MissingSectionWarningBanner.tsx` | "I understand — publish anyway" checkbox gates publish | Zero changes |
| **Review page wiring** | `src/app/(protected)/admin/sops/[sopId]/review/page.tsx` (line 80, 112) | Already reads `parseJob.verification_flags` and passes to `ReviewClient` regardless of source type | Zero changes — AI flags will appear automatically once persisted |
| **Builder entry point** | `/admin/sops/builder/[sopId]` (Phase 12) | Single unified Puck builder; reads `sop_sections.layout_data`; LayoutRenderer falls back to legacy linear render when `layout_data` is null | Phase 14 sections start with `layout_data = null` — builder + worker walkthrough already render correctly via legacy fallback |
| **YouTube route (closest analogue)** | `src/app/api/sops/youtube/route.ts` | Text → SOP pipeline with NO file upload; auth via JWT; creates SOP + parse_job, runs `parseSopWithGPT` then verifier, persists sections, marks complete | This is the canonical template for 14-02. Copy → swap "captions" for "prompt" → swap stage labels |
| **Blank wizard (entry point template)** | `src/app/(protected)/admin/sops/new/blank/{page.tsx,WizardClient.tsx}` | Auth + admin/safety_manager guard; `categories` prop; React Hook Form + zod; Step 1 (title) → Step 2 (sections) → Step 3 (review) → Step 4 (creating); router.push to builder | Mirror the structure for 14-01 — single-page form is enough, but reuse the auth guard pattern + categories prop pipeline |
| **Section-kind resolver** | `src/actions/sections.ts::listSectionKinds()` + `createSection()` | RLS-scoped fetch; canonical seeded slugs `hazards/ppe/steps/emergency/signoff/content/custom`; `section_type` mirrors `slug` | The AI generator emits `type: string` (e.g. "hazards", "ppe"). Map AI's `section.type` → `section_kinds.slug` (case-insensitive substring match) → assign `section_kind_id`. Fall back to `null` (legacy substring renderer still works) |
| **`source_type='ai'` enum value** | `supabase/migrations/00020_section_layout_data.sql` lines 23-34 | `sops.source_type CHECK (... 'ai' ...)` already exists | NO migration needed for source_type — column accepts `'ai'` today |
| **Cross-org isolation** | RLS on `sops`/`parse_jobs`/`sop_sections` (Phase 1) | All inserts use `organisation_id` derived from JWT claims; RLS gates SELECT/UPDATE/DELETE per-org | NO new policies needed |

## New Work per Plan

### 14-01: Prompt entry route + named-stage progress UI

**Files to create:**

- `src/app/(protected)/admin/sops/new/ai/page.tsx` — server component, auth + admin guard, fetch categories
- `src/app/(protected)/admin/sops/new/ai/PromptClient.tsx` — `'use client'`, prompt textarea (z-validated, min 20 chars / max 2000), category select, "Generate" button, optional detail-level slider (reuse `DetailLevelControl` from `ParseJobStatus.tsx`)
- `src/components/admin/AiPromptStageStepper.tsx` — OR — refactor `ParseJobStatus.tsx` to accept `stageSet: 'video' | 'ai_prompt'` and pull from a `STAGE_SETS` const

**Migration to create:**
- `supabase/migrations/00029_ai_prompt_input_type.sql` — `ALTER TABLE parse_jobs DROP CONSTRAINT parse_jobs_input_type_check; ALTER TABLE parse_jobs ADD CONSTRAINT parse_jobs_input_type_check CHECK (input_type IN ('upload', 'scan', 'url', 'video_file', 'youtube_url', 'ai_prompt'));`
- (Optional) Add `parse_jobs.prompt_text TEXT NULL` column for audit-trail visibility of the original prompt — mirrors the `transcript_text` column pattern. **[DECISION-NEEDED]** (see Open Questions)

**Edits:**
- `src/types/sop.ts` — add `'ai_prompt'` to `InputType` union; add `prompt_text?: string | null` to `ParseJob` if migration adds the column
- `src/components/admin/ParseJobStatus.tsx` — change `VIDEO_STAGES` to a `STAGE_SETS` map; detect AI source via `parse_jobs.input_type === 'ai_prompt'`; add stage labels: `prompting → drafting → verifying`
- `src/lib/validators/sop.ts` — add `aiPromptSchema` (textarea body z.string().min(20).max(2000), categoryTag optional, detailLevel 1-5)

**Server action:**
- `src/actions/sops.ts::createSopFromPrompt({ promptText, categoryTag, detailLevel }) → { sopId } | { error }` — JWT auth + admin guard, insert `sops` row with `source_type='ai'` + `status='parsing'`, insert `parse_jobs` with `input_type='ai_prompt'` + `current_stage='prompting'`, kick off the API route, return `sopId` for navigation. **OR** call the route directly from the client. (Phase 6 pattern is server-action-creates-row + client-fires-fetch-to-route — recommend matching.)

**Do NOT reinvent:**
- The Realtime polling/subscription logic in `ParseJobStatus.tsx` — pass it the `sopId` and it works
- Any auth flow — copy `/api/sops/youtube/route.ts` lines 14-35 verbatim
- Category selector — pass `categories` prop from server page just like blank wizard

### 14-02: GPT-4o (read: Claude) structured draft generator

**Files to create:**
- `src/app/api/sops/ai-prompt/route.ts` — copy `youtube/route.ts` structure 1:1; key differences below

**Edits:**
- `src/lib/parsers/gpt-parser.ts` — add `'prompt'` to `FORMAT_HINTS` (system-message addendum tuned for prompt-from-prose, see Prompt Engineering section); extend `SourceFileType`-or-introduce-a-new `ParseSourceMode` parameter so the route can pass a non-`SourceFileType` hint. Recommend extending the parameter type rather than overloading `SourceFileType`:

```ts
// Current signature
export async function parseSopWithGPT(extractedText: string, inputType?: SourceFileType, detailLevel: number = 3): Promise<ParsedSop>

// Recommended evolution
export async function parseSopWithGPT(extractedText: string, opts?: { sourceMode?: SourceFileType | 'prompt', detailLevel?: number }): Promise<ParsedSop>
```

This keeps `SourceFileType` clean (it maps to DB CHECK constraints) while adding a `'prompt'` mode for hint selection. Phase 6 callers continue to pass `'video'` literal.

- After `parseSopWithGPT`, **Phase 11 section-kind resolver hook**: post-process each section to set `section_kind_id` by slug-matching `section.type` against `listSectionKinds()` results. This is missing from the YouTube route too — it's why Phase 6 SOPs don't get section_kind_id. Phase 14 should fix it for the AI path; consider also retrofitting Phase 6 (defer that if scope-tight).

**Route flow (copy from `youtube/route.ts`, swap stages 1-3):**

| Stage | Phase 6 (YouTube) | Phase 14 (AI prompt) |
|-------|-------------------|----------------------|
| 1 | Fetch YouTube captions | Stage = `'prompting'` (validate prompt is non-empty / non-toxic) |
| 2 | Build `transcriptText` from segments | Stage = `'drafting'` — call `parseSopWithGPT(promptText, { sourceMode: 'prompt', detailLevel })` |
| 3 | Stage = `'verifying'` | Stage = `'verifying'` — call `verifyTranscriptVsSop(promptText, parsed)` + `detectMissingSections(parsed)` |
| 4 | Persist sections + steps | Identical — but ALSO populate `section_kind_id` per section (slug-resolve from cached `listSectionKinds()` map) |
| 5 | Mark `parse_jobs.status='completed'` | Identical |

**Do NOT reinvent:**
- The verifier (`verifyTranscriptVsSop`) treats the source-text-vs-structured-SOP pair generically — it doesn't care whether source is a transcript or a prompt. Just pass `promptText` as the first arg.
- The `ParsedSop` type, the section/step insert pattern, RLS — all reused

### 14-03: Adversarial verification reuse + builder hand-off

**Edits to existing review surface:**
- `src/app/(protected)/admin/sops/[sopId]/review/page.tsx` already passes `verificationFlags` to `ReviewClient` regardless of source. **Zero changes needed for flag display.**
- Confirm publish gate: `ReviewClient.tsx` lines 63-79 already gate publish on `unresolvedCriticalFlags + missingSectionAcknowledged`. Same gate applies to AI drafts automatically.

**Builder hand-off:**
- After the API route returns `{ sopId }`, the prompt page does `router.push('/admin/sops/builder/${sopId}')` — same as blank wizard's Step 4 (`WizardClient.tsx` line 146)
- **OR** route through the review page first so admin sees flags before editing: `router.push('/admin/sops/${sopId}/review')` — recommended for SB-INFRA-04 compliance ("flagged before reaching the reviewer" implies review is the landing point). **[DECISION-NEEDED]**

**Library chip:**
- The admin SOP library page already displays `source_type` chips (Phase 12 added "AUTHORED IN BUILDER" for `source_type='blank'`). Add an "AI DRAFT" chip for `source_type='ai'` — likely 5 lines in the SOP library card render path. **[DECISION-NEEDED]** — does ROADMAP success criterion #3 ("admin cannot tell 'draft source: AI' apart from 'draft source: blank' once they're editing") preclude this in the library too, or only inside the builder? Reading literally: only "while editing" — so library chip is allowed.

**Do NOT reinvent:**
- The adversarial banner — `AdversarialFlagBanner` filters its own input
- The publish gate — `ReviewClient`'s state machine handles unresolved-critical + missing-section-ack already

## Prompt Engineering Pattern

**Approach:** add a single `'prompt'` entry to the `FORMAT_HINTS` map in `gpt-parser.ts`. The existing `SYSTEM_PROMPT` already does most of the work — it tells Claude to *infer* hazards/PPE from context, list mitigations, score confidence. The `'prompt'` hint just guides the model on how to interpret terse natural-language input.

**Recommended hint addendum (draft — refine in 14-02 prompt-engineering wave):**

```
\n\nIMPORTANT: This input is a short natural-language prompt from an admin requesting a brand-new SOP draft. It is NOT a source document. Apply MAXIMUM inference:

1. Treat the prompt as a brief — your job is to author a complete, professional SOP from a one-line request.
2. Infer the work context: location, equipment, hazards, regulatory frame (NZ WorkSafe), worker role.
3. The prompt may name a NZ region (Hamilton, Auckland, Tauranga) or industry (forklift, glass, chemical, manufacturing). Use this to scope hazards and PPE realistically.
4. ALWAYS produce: hazards, PPE, steps, emergency procedures sections — even if the prompt only mentions one of these.
5. Steps should be procedurally complete (don't stop at "do the task" — break into preparation, execution, verification, cleanup).
6. Conservative on specifics: if the prompt does not name a model number, do not invent one. Use generic language ("the forklift", "the operator manual") instead of fake specifics.
7. Set parse_notes to list what you inferred vs what was stated.
8. If the prompt is vague (< 10 meaningful words), produce a generic SOP for the named domain and lower overall_confidence to ≤ 0.6.
```

**Example I/O 1 (NZ industrial):**

| Input | Output (abbreviated) |
|-------|----------------------|
| "PPE check for forklift operators at our Hamilton site" | title: "Forklift Operator PPE Check — Pre-shift Inspection (Hamilton site)"; sections: Hazards (4× — load instability, blind spots, pedestrian collision, hydraulic failure) / PPE (high-vis, steel-cap boots, hard hat where load suspended, hi-grip gloves) / Steps (10× — visual hi-vis check → boot inspection → helmet inspection → log entry) / Emergency (collision protocol, hydraulic-failure escape) |

**Example I/O 2 (deliberately vague):**

| Input | Output (abbreviated) |
|-------|----------------------|
| "chemical storage SOP" | title: "Chemical Storage — General Procedure"; overall_confidence: 0.55; parse_notes: "Prompt did not specify chemical class, regulatory framework, or container type. Output uses NZ HSNO Act-aligned generics — admin should refine sections for specific substances and reference SDS." |

**Token / latency budget (HIGH confidence — Phase 6 metrics):**
- Triage call (haiku): ~0.5s, ~10 output tokens
- Full parse (sonnet for COMPLEX): 5-15s, up to 8192 output tokens
- Verifier (haiku): ~3-8s, up to 2048 output tokens
- Total wall-clock: 10-30s typical, 60s worst-case → fits comfortably under route's `maxDuration = 300`

## Pitfalls

1. **`input_type` CHECK constraint blocks `'ai_prompt'`** — `00012_video_transcription.sql` line 50 hardcodes the allowed values. INSERT will fail with constraint violation if migration is missed. **Mitigation:** new migration `00029` extending the constraint (or use a flag column instead of input_type — discuss).

2. **`parser` name vs reality (Claude vs GPT-4o)** — ROADMAP says "GPT-4o structured draft generator" but `gpt-parser.ts` actually uses Anthropic Claude (haiku triage → sonnet). This is the production parser used by every other intake path. Migrating to GPT-4o for AI prompt only would diverge from the proven primitive and increase maintenance cost. **Mitigation:** clarify intent in discuss-phase. Recommend keeping Claude for consistency. **[DECISION-NEEDED]**

3. **Verifier semantics on prompt input** — the verifier system prompt says "find discrepancies between the source transcript and the AI-structured SOP." A user prompt is NOT a transcript — there is no ground truth to verify *against*. The verifier will likely return `[]` for valid drafts (no source to contradict) but may falsely flag inferred-but-not-stated content as "added information not present." **Mitigation:** create a verifier variant `verifyPromptVsSop()` (or pass a `mode: 'prompt' | 'transcript'` flag) that swaps the system prompt to focus on *plausibility & completeness* rather than *fidelity to source*. Specifically: "did the model invent fake regulatory citations, fake equipment model numbers, or hallucinated company-specific names?" The Phase 6 reuse claim in ROADMAP is technically true but underspecified — this is the highest-risk hidden work in Phase 14.

4. **`section_kind_id` not populated by current parser path** — `gpt-parser.ts` returns sections with `type: string` (slug-ish), but the YouTube + transcribe routes insert into `sop_sections` without setting `section_kind_id`. Workers still render via the legacy substring fallback (per SB-SECT-04). For Phase 14 this means: if you don't add the resolver step, AI drafts work but lack the v3.0 `section_kinds` join. The ROADMAP success criterion #4 ("flows through Phase 11 section-kind resolver") explicitly requires it. **Mitigation:** post-`parseSopWithGPT`, fetch all section_kinds once, build a `slug → id` map, set `section_kind_id` per inserted section.

5. **Lazy-init API client pattern (CLAUDE.md learning)** — `gpt-parser.ts` and `verify-sop.ts` already use `let client: Anthropic | null = null; function getAnthropic(){...}`. Any new module that touches Anthropic MUST follow the same pattern or Next.js static analysis will throw at module load. **Mitigation:** copy the `getAnthropic()` helper.

6. **Route timeout / cost runaway from long prompts** — admin could paste 5000 chars of pasted policy text into the prompt textarea. `parseSopWithGPT` has no input length cap. **Mitigation:** zod `max(2000)` on the prompt body in the validator + early reject in the route handler. Also Stage 1 triage (haiku) acts as a cheap circuit-breaker.

7. **Cross-org isolation — already handled, do not duplicate** — `organisation_id` is derived from JWT claims server-side in every existing route (`youtube/route.ts` lines 22-29). Phase 1 RLS gates `sops` / `parse_jobs` / `sop_sections` per-org. No new policies needed. The pitfall is *adding* unnecessary policies — don't.

8. **Prompt textarea XSS / prompt-injection** — admin-only flow (route guards on `admin`/`safety_manager` roles), so blast radius is tenant-internal. Still, the prompt is fed verbatim into a system-prompted LLM. Standard prompt-injection mitigations apply: keep the system prompt above the user message (already true), don't echo prompt content back to other users without sanitisation. Low priority for v3.0.

9. **`source_type='ai'` chip in admin library** — `00020_section_layout_data.sql` already permits the value; Phase 12 added the "AUTHORED IN BUILDER" chip for `source_type='blank'`. Phase 14 likely needs an "AI DRAFT" chip too — easy to forget because the schema already accepts the value silently. **Mitigation:** add chip in 14-01 alongside the route, before merge.

10. **Builder lands with empty `layout_data`** — `createSopFromPrompt` should NOT set `sop_sections.layout_data`. The LayoutRenderer (Phase 12) falls back to legacy linear render when `layout_data` is null, AND the Puck builder treats null as "empty canvas with auto-promoted blocks from sop_steps". This matches the blank wizard's behaviour, so AI drafts are visually indistinguishable from blank drafts inside the builder (success criterion #3). Don't pre-populate `layout_data` — that would diverge from blank flow.

11. **Idempotency / retry on 14-02 route** — Phase 6 transcribe route has `if (job.status === 'completed') return; if (job.status === 'processing') return;` guards. The AI prompt route should mirror this so a network blip + page refresh doesn't double-spend Claude tokens. Copy lines 89-95 of `transcribe/route.ts`.

12. **Detail-level slider already exists** — `ParseJobStatus.tsx` has `DetailLevelControl` (lines 422-470) and `parseSopWithGPT` accepts `detailLevel: 1-5`. Phase 14 should pass it through from the prompt form so admins can request "minimal SOP" vs "comprehensive SOP" up front. Saves a re-structure round-trip.

## Runtime State Inventory

Phase 14 is greenfield (new route, new generator hint, no rename/migration). Inventory N/A.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Anthropic API key | `gpt-parser.ts` + `verify-sop.ts` | ✓ (Phase 6 already in prod) | `@anthropic-ai/sdk` (latest) | None — fail closed |
| Supabase Realtime | `ParseJobStatus.tsx` Realtime channel | ✓ (Phase 1+) | — | 5s polling fallback already in `ParseJobStatus.tsx` |
| Postgres CHECK constraint mod | new migration `00029` | ✓ (`gknxhqinzjvuupccyojv` project) | — | None |

No new external dependencies. No new packages to install.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright 1.49 |
| Config file | `playwright.config.ts` |
| Quick run command | `npm run test:integration` |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SB-AUTH-02 | Admin types prompt → receives draft within named-stages UI | integration | `npx playwright test tests/integration/ai-prompt-draft.spec.ts -x` | ❌ Wave 0 |
| SB-AUTH-02 | Draft contains hazards + PPE + steps + emergency sections | integration | same file, separate test | ❌ Wave 0 |
| SB-AUTH-02 | Draft lands in builder identically to blank flow | e2e | `npx playwright test tests/e2e/ai-draft-builder-handoff.spec.ts -x` | ❌ Wave 0 |
| SB-INFRA-04 | Verifier flags hallucinated section content via amber banner | integration | mocks Anthropic verifier to return canned flag list, asserts banner renders | ❌ Wave 0 |
| SB-INFRA-04 | Missing-hazards prompt triggers MissingSectionWarningBanner | integration | prompt that explicitly asks for "PPE only" → expect missing-hazards flag | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run lint && npx playwright test --project=phase14-stubs`
- **Per wave merge:** `npm run test:integration`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/integration/ai-prompt-draft.spec.ts` — covers SB-AUTH-02
- [ ] `tests/integration/ai-prompt-verification.spec.ts` — covers SB-INFRA-04 (mocks Anthropic to canned `VerificationFlag[]`)
- [ ] `tests/e2e/ai-draft-builder-handoff.spec.ts` — covers SB-AUTH-02 hand-off + SB-AUTH-04 reuse (blank vs AI indistinguishable in builder)
- [ ] Test fixture: `tests/fixtures/anthropic-mock.ts` — server-side Anthropic mock returning a deterministic `ParsedSop` for the seed prompt. Without this, tests are non-deterministic and slow (~30s real Anthropic call per spec).

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | yes | Existing Supabase Auth + JWT (Phase 1) — copy `youtube/route.ts` lines 14-35 |
| V3 Session Management | yes | Existing — handled by `@supabase/ssr` middleware |
| V4 Access Control | yes | RLS on `sops`/`parse_jobs`/`sop_sections` (Phase 1); JWT role gate for `admin`/`safety_manager` in route + server action |
| V5 Input Validation | yes | zod `aiPromptSchema` (min 20 / max 2000 chars, optional categoryTag, detailLevel 1-5) — block too-long prompts to bound LLM cost |
| V6 Cryptography | no | No new crypto |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Prompt-injection (admin-tier) | Tampering | System prompt above user prompt; admin-only access narrows blast radius |
| LLM cost runaway via 100KB prompt | DoS | zod `max(2000)` cap + Stage 1 haiku triage as circuit breaker |
| Cross-org SOP creation | Information Disclosure | `organisation_id` from JWT, never from request body — already enforced everywhere |
| Forged `section_kind_id` | Tampering | Resolve via RLS-scoped `listSectionKinds()` (caller's client), never trust IDs from elsewhere — same pattern as `createSopFromWizard` |
| Stored XSS via prompt echoed in review UI | XSS | React renders text as text by default; only rendered as plain string in `parse_notes` / SOP title |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Phase 14 should keep using Claude (not migrate to OpenAI GPT-4o despite ROADMAP wording) | Recommendation | LOW — discuss-phase confirms; if user wants real GPT-4o, 14-02 grows by ~half a day to add an OpenAI client + structured-output schema duplicate |
| A2 | Verifier system prompt should be swapped to plausibility-mode for prompt input | Pitfall 3 | MEDIUM — without this, the verifier will produce noise (false "added information" flags) that erodes admin trust in the banner |
| A3 | `section_kind_id` resolution can be added in Phase 14 alongside this work (rather than retrofitted to Phase 6) | 14-02 | LOW — additive; doesn't break existing SOPs |
| A4 | "AI DRAFT" library chip is in scope (analogous to Phase 12's "AUTHORED IN BUILDER" chip) | 14-03 | LOW — 5-line UI tweak; can be deferred if discuss-phase says "out of scope" |
| A5 | Detail-level slider on prompt page is desirable (saves a re-structure round-trip) | Pitfall 12 | LOW — UI nice-to-have; pure additive |
| A6 | Hand-off lands on review page (not builder), so flags are seen first per SB-INFRA-04 | 14-03 | MEDIUM — opposite choice (straight to builder) is faster but skirts the literal SB-INFRA-04 requirement |

## Open Questions

1. **[DECISION-NEEDED] Claude vs GPT-4o for the AI-prompt path** (A1)
   - What we know: Production parser is Claude; ROADMAP wording says GPT-4o; Phase 6 verifier is Claude.
   - What's unclear: Was the GPT-4o wording aspirational (older roadmap text) or a deliberate divergence?
   - Recommendation: Keep Claude for consistency with Phase 6. Update ROADMAP wording to "AI structured draft generator" if confirmed.

2. **[DECISION-NEEDED] Verifier mode for prompt input** (Pitfall 3)
   - What we know: Verifier system prompt is transcript-vs-SOP focused.
   - What's unclear: Does Simon want the verifier to fire at all on AI drafts, or is the missing-section detection sufficient?
   - Recommendation: Add a `mode: 'transcript' | 'prompt'` parameter; for `'prompt'`, swap the system prompt to focus on plausibility/hallucinations rather than fidelity. Keep `detectMissingSections` unchanged (works on parsed structure, source-agnostic).

3. **[DECISION-NEEDED] Hand-off destination after generation** (14-03 + A6)
   - What we know: Blank wizard goes straight to builder; SB-INFRA-04 says flags must be visible "before reaching the reviewer."
   - What's unclear: Does "reviewer" mean the review page or the editing admin?
   - Options: (a) `router.push('/admin/sops/${sopId}/review')` first, banner visible, click "Open in builder" from there; (b) Direct to builder, surface flags as a top banner inside the builder shell.
   - Recommendation: (a) — review page is already wired, zero new code. Builder banner would be new UI work.

4. **[DECISION-NEEDED] Persist the original prompt text on `parse_jobs`?**
   - Pro: audit trail; admin can re-read what they typed; supports "regenerate from same prompt"
   - Con: another column, mild PII leak risk
   - Recommendation: Add `parse_jobs.prompt_text TEXT NULL` in the same migration as the `input_type` extension. Cheap.

5. **[DECISION-NEEDED] AI DRAFT chip in admin library** (A4)
   - Recommendation: Yes, mirror Phase 12 chip pattern. ROADMAP success #3 only excludes source-tells *while editing*.

6. **[DECISION-NEEDED] Auto-fail prompts under N words?**
   - "make me an SOP" is a wasted Anthropic call.
   - Recommendation: zod `min(20)` already enforces this in 14-01.

## Code Examples

### Pattern: extend `FORMAT_HINTS` for prompt input

```ts
// src/lib/parsers/gpt-parser.ts — diff against current
// Source: src/lib/parsers/gpt-parser.ts lines 104-119
const FORMAT_HINTS: Partial<Record<SourceFileType | 'prompt', string>> = {
  // ... existing entries ...
  prompt: `\n\nIMPORTANT: This input is a short natural-language prompt requesting a brand-new SOP draft, not a source document. Apply MAXIMUM inference: produce hazards, PPE, steps, and emergency sections even if the prompt only mentions one. Use generic language for unspecified details. Set parse_notes to list inference scope.`,
}
```

### Pattern: section-kind resolver post-process

```ts
// In src/app/api/sops/ai-prompt/route.ts after parseSopWithGPT
// Source: derived from src/actions/sections.ts::createSection
const { data: kindsRows } = await admin.from('section_kinds').select('id, slug')
const slugToId = new Map<string, string>(
  (kindsRows ?? []).map(k => [k.slug.toLowerCase(), k.id])
)
for (const section of parsed.sections) {
  const sectionKindId = slugToId.get(section.type.toLowerCase()) ?? null
  await admin.from('sop_sections').insert({
    sop_id: sop.id,
    section_type: section.type,
    section_kind_id: sectionKindId,  // NEW for Phase 14
    title: section.title,
    content: section.content ?? null,
    sort_order: section.order,
    confidence: section.confidence,
    approved: false,
  })
}
```

### Pattern: refactor stage stepper for multi-source

```tsx
// src/components/admin/ParseJobStatus.tsx — refactor sketch
// Source: refactor of current VIDEO_STAGES + isVideoSop branch
const STAGE_SETS = {
  video:     [{ key: 'uploading', label: 'Uploading' }, { key: 'extracting_audio', label: 'Extracting' }, { key: 'transcribing', label: 'Transcribing' }, { key: 'structuring', label: 'Structuring' }, { key: 'verifying', label: 'Verifying' }],
  ai_prompt: [{ key: 'prompting', label: 'Prompting' }, { key: 'drafting', label: 'Drafting' }, { key: 'verifying', label: 'Verifying' }],
} as const

// Detect via parse_jobs.input_type
const stageSet = inputType === 'ai_prompt' ? STAGE_SETS.ai_prompt
              : isVideoSop ? STAGE_SETS.video
              : null  // non-video file parse — no stepper, just spinner
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Anthropic SDK without lazy init | Lazy `getAnthropic()` helper | Phase 6 (CLAUDE.md learning) | Required for Next.js static analysis — must mirror |
| `gpt-4o` literal model strings | Claude tool-use with `claude-haiku-4-5-20251001` triage + `claude-sonnet-4-6` parse | Phase 5/6 | Phase 14 inherits — no model changes |
| Single system prompt for all sources | `FORMAT_HINTS` map keyed off source type | Phase 5 | Phase 14 adds `'prompt'` entry |
| Section storage without `section_kind_id` | Phase 11 added `section_kind_id` advisory FK | Phase 11 | Phase 14 should populate it (currently NOT populated by Phase 5/6 routes) |

## Sources

### Primary (HIGH confidence — code-verified)
- `src/lib/parsers/gpt-parser.ts` — actual parser (Claude, not GPT-4o)
- `src/lib/parsers/verify-sop.ts` — verifier signature, system prompt, fallback semantics
- `src/components/admin/ParseJobStatus.tsx` — stepper, Realtime+polling pattern, DetailLevelControl
- `src/components/admin/AdversarialFlagBanner.tsx` — flag display, resolve UX, publish-gate emit
- `src/components/admin/MissingSectionWarningBanner.tsx` — missing-section gate
- `src/app/api/sops/youtube/route.ts` — text-only pipeline reference
- `src/app/api/sops/transcribe/route.ts` — full 5-stage pipeline reference
- `src/app/(protected)/admin/sops/new/blank/{page.tsx,WizardClient.tsx}` — entry-point template
- `src/actions/sops.ts::createSopFromWizard` — atomic SOP+sections create with org/role guard
- `src/actions/sections.ts::listSectionKinds + createSection` — section_kind_id resolution path
- `supabase/migrations/00012_video_transcription.sql` — `parse_jobs` schema, `input_type` constraint
- `supabase/migrations/00020_section_layout_data.sql` — `source_type` enum (already includes `'ai'`)

### Secondary (MEDIUM confidence)
- `graphify-out/GRAPH_REPORT.md` — confirms `verifyTranscriptVsSop` is in Community 8 (video pipeline cluster), `parseSopWithGPT` is shared across communities

### Tertiary (LOW confidence — none used; all claims sourced from primary code)
- N/A

## Metadata

**Confidence breakdown:**
- Reusable assets: HIGH — every primitive read in source
- Architecture: HIGH — pattern proven in Phase 6 (production)
- Pitfalls: HIGH — 12/12 derived from concrete code or CLAUDE.md learnings
- Prompt engineering: MEDIUM — hint sketch is plausible but needs A/B refinement in 14-02 task
- Verifier mode mismatch (Pitfall 3): MEDIUM-HIGH — strong hypothesis but unverified empirically

**Research date:** 2026-05-10
**Valid until:** 2026-06-10 (30 days; stable codebase, no expected churn in Phase 6/12 surfaces)
