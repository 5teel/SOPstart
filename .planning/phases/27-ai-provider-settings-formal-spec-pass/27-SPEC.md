# Phase 27: AI Provider & Settings — Specification

**Created:** 2026-07-12
**Requirements:** AIPS-REG-01, AIPS-REG-02, AIPS-SET-01, AIPS-SET-02, AIPS-PROMPT-01, AIPS-PARSE-01, AIPS-TITLE-01, AIPS-GAP-01, AIPS-GAP-02, AIPS-GAP-03

## Goal

Formally document, test, and regression-lock the AI provider-abstraction arc (model registry, provider-agnostic adapter, org-level model overrides, grounding/parse hardening, title guard) that shipped ad-hoc to master on 2026-07-06/07 without a GSD phase — so the next AI feature builds on documented, tested ground instead of undocumented-but-working prod code.

## Background

Five modules make up the arc, all already shipped and running in prod:

- `src/lib/ai/registry.ts` — single-source `AI_MODELS` map (15 keys across llm/vision/embedding/stt/tts/ocr capabilities), each entry env-overridable via `aiModel(key)`.
- `src/lib/ai/llm.ts` — provider-agnostic `llmText`/`llmToolCall`, routing by model-ID shape (`providerForModel`) to Anthropic SDK or an OpenAI-compatible REST call (OpenAI or OpenRouter), with a 3-stage JSON-extraction fallback (`extractJson`) and one retry for non-Anthropic forced tool calls.
- `src/lib/ai/org-settings.ts` — resolves `ORG_CONFIGURABLE_KEYS` (`parse-triage`/`parse-simple`/`parse-complex`) through org override → env var → registry default (`resolveOrgModel`), backed by `ai_model_settings` (migration `00042_ai_model_settings.sql`).
- `src/actions/ai-settings.ts` — `getAiSettings`/`setAiModelSetting` server actions; writes go through a service-role client (the table has no authenticated write policy by design, same 00031/00036 junction-table pattern) and self-enforce org scope from the caller's JWT.
- `src/lib/parsers/sop-title.ts` + `src/lib/parsers/sop-parser.ts` — the title guard (`ensureSopTitle`) and the grounding/structure system prompt (`SYSTEM_PROMPT`, `sop-parser.ts:75`) that encode the `.autoresearch` R&D-loop findings, plus parser hardening for non-Anthropic quirks.

No CONTEXT.md exists for this phase — it is a closure/documentation pass, not new design (27-RESEARCH.md § User Constraints). All ten AIPS-* requirement IDs below were locked directly from a same-day code survey (2026-07-12), not from a discovery interview.

## Architecture

```
Admin browser (/admin/ai-settings)
   │  reads registry keys + vetted options (AiModelSelect)
   ▼
AiSettingsClient.tsx ──calls──▶ getAiSettings() / setAiModelSetting()   [src/actions/ai-settings.ts, 'use server']
                                        │
                                        │ requireAdmin(): session cookie → parseJwtPayload(access_token)
                                        │   → { userId, organisationId, role } (never trusts client input)
                                        ▼
                                createAdminClient() [service-role, bypasses RLS]
                                        │  .eq('organisation_id', ctx.organisationId)  ◀── self-enforced scope
                                        ▼
                                ai_model_settings table (RLS: org-scoped SELECT only, no auth INSERT/UPDATE/DELETE policy)

Parse pipeline (api/sops/parse/route.ts, api/sops/ai-prompt/route.ts)
   │
   ▼
getOrgAiModels(admin, organisationId) [org-settings.ts]  — fails open to {} on any error
   │
   ▼
resolveOrgModel(key, overrides) = overrides[key] || aiModel(key)   [registry.ts default/env fallback]
   │
   ▼
llmText() / llmToolCall()  [llm.ts]
   │
   ├─ providerForModel(model): '/' in id → OpenRouter · starts 'claude' → Anthropic · else → OpenAI
   ▼
Anthropic SDK  |  openAiCompatCall() fetch → OpenAI or OpenRouter REST /chat/completions
   │
   ▼
extractJson() 3-stage fallback (direct parse → fenced block → outermost braces) for non-native tool-call responses
   │
   ▼
sop-parser.ts / sop-title.ts consume the returned text/tool-input; ensureSopTitle() falls back to filename → 'Untitled SOP' if the model still returns junk
```

*(Diagram reproduced from 27-RESEARCH.md § System Architecture Diagram, lines 51-85 — no changes, as-built only.)*

## Requirements

### 1. AIPS-REG-01 — Single-source model registry
- **Current:** `AI_MODELS` (`src/lib/ai/registry.ts:78-201`) maps every AI use-case to `{ capability, provider, defaultId, envVar?, description }`; `aiModel(key)` (`registry.ts:206-209`) resolves `process.env[envVar] || defaultId`.
- **Target:** Same — already shipped, no gap.
- **Acceptance:** Every key in `AI_MODELS` resolves via `aiModel(key)` to its `defaultId` when the env var is unset; setting the env var overrides it. Locked by `src/lib/ai/__tests__/registry.test.ts` (AIPS-GAP-03).

### 2. AIPS-REG-02 — Provider-agnostic adapter
- **Current:** `providerForModel()` (`llm.ts:42-46`) routes by model-ID shape (`/` → openrouter, `claude*` → anthropic, else → openai); `llmText`/`llmToolCall` (`llm.ts:136-179`) dispatch to the Anthropic SDK or `openAiCompatCall()`; `extractJson()` (`llm.ts:118-133`) is a 3-stage fallback (direct parse → fenced block → outermost braces); one retry on empty tool input for non-Anthropic providers (`llm.ts:174-177`).
- **Target:** Same — already shipped, no gap.
- **Acceptance:** `providerForModel('z-ai/glm-5.2')==='openrouter'`, `providerForModel('claude-haiku-4-5-20251001')==='anthropic'`, `providerForModel('gpt-4o-2024-08-06')==='openai'`; `extractJson()` resolves raw/fenced/prose-wrapped JSON to the same object and returns `null` (not throw) on garbage. Locked by `src/lib/ai/__tests__/llm-routing.test.ts` (AIPS-GAP-03).

### 3. AIPS-SET-01 — Per-org model override UI
- **Current:** `ORG_CONFIGURABLE_KEYS` (`org-settings.ts:13-17`) gates exactly `parse-triage`/`parse-simple`/`parse-complex`; `/admin/ai-settings/page.tsx` + `AiSettingsClient.tsx` call `getAiSettings`/`setAiModelSetting`.
- **Target:** Same — already shipped, no gap.
- **Acceptance:** Admin can set/clear a per-org override for the 3 configurable use cases; other registry keys render as environment-managed (not selectable). No new test — UI behavior, covered by manual verification during original shipping.

### 4. AIPS-SET-02 — Org-scoped write-path regression test
- **Current:** `setAiModelSetting(useCase, modelId)` (`ai-settings.ts:47-90`) takes **no `organisationId` parameter** — `ctx.organisationId` comes only from `requireAdmin()`'s `parseJwtPayload(session.access_token)` read, never from caller input; both the `.upsert()` and `.delete()` calls carry `.eq('organisation_id', ctx.organisationId)`. This already matches the safe self-enforcing pattern (contrast with the 2026-06-15 `signOffCompletion` cross-tenant bug, which this code does NOT repeat).
- **Target:** Same code, now regression-locked by a runtime behavioral test (not a fix — see T-27-01 in the threat register).
- **Acceptance:** `tests/phase27/ai-settings-org-scope.spec.ts` asserts Org A's write via `setAiModelSetting` never mutates Org B's `ai_model_settings` rows, and the written row's `organisation_id` equals Org A's JWT-derived id. Registered under `phase27-stubs`.

### 5. AIPS-PROMPT-01 — Grounding/structure/title system prompt
- **Current:** `SYSTEM_PROMPT` (`sop-parser.ts:75-153`) encodes strict GROUNDING rules ("nothing invented", `sop-parser.ts:79-84`) with mode-specific relaxations for video transcripts and AI-prompt briefs (`sop-parser.ts:165-185`); `SYSTEM_PROMPT_WITH_TITLE` (`sop-parser.ts:155-159`) injects `TITLE_CONVENTIONS` (loaded from `src/lib/parsers/prompts/sop-title-conventions.md` via `sop-title.ts:16-29`) so the main parse call names the SOP correctly the first time, with `ensureSopTitle()` as the guard-of-last-resort (see AIPS-TITLE-01).
- **Target:** Same — already shipped, no gap. This requirement is documentation-only; no test exists or is planned for the prompt's content-quality claims.
- **Acceptance (observable as-built behavior):** The parse call is instructed to never invent hazards, quantities, tools, or procedural steps not present in the source text, except in the two explicitly relaxed modes (video transcript, AI-prompt brief) where the relaxation is scoped and documented in-prompt. The `.autoresearch/` R&D loop is the historical provenance for the specific grounding/title wording (composite score and hallucination-rate improvements) — this SPEC does not re-derive those metrics; see `.autoresearch/` for R&D provenance.

### 6. AIPS-PARSE-01 — Non-Anthropic parser hardening
- **Current:** `sop-parser.ts:302-315` trims/nulls empty `warning`/`caution`/`tip` fields and filters out steps with empty `text` (normalizes model quirks seen on non-Anthropic providers before they hit downstream min-length validators); `api/sops/parse/route.ts:73-79` deletes prior `sop_images`/`sop_sections` before re-parsing (idempotent retry — FK cascade removes steps/junctions, so a retry never duplicates sections); `llm.ts:109-113` extracts JSON from OpenRouter-served models' fenced/prose responses when a forced tool call doesn't return native `tool_calls`, and `llm.ts:171-178` retries once before failing.
- **Target:** Same — already shipped, no gap.
- **Acceptance (observable as-built behavior):** A step with an empty/whitespace-only `text` field is silently dropped rather than persisted as a blank step; re-running parse on the same SOP replaces (not duplicates) its sections; an OpenRouter model returning JSON as fenced markdown in `message.content` instead of a native tool call still resolves to a valid tool input via `extractJson()` + one retry before the call is considered failed.

### 7. AIPS-TITLE-01 — Title-naming guard
- **Current:** `isPlaceholderTitle()` (`sop-title.ts:34-37`) flags titles under 4 chars or matching a placeholder regex (`untitled`, `sop`, `new sop`, etc.); `titleFromFileName()` (`sop-title.ts:40-50`) strips extension/doc-codes/draft-noise from the source filename; `ensureSopTitle()` (`sop-title.ts:56-89`) keeps an existing non-placeholder title untouched, otherwise makes one dedicated LLM naming call and falls back to `titleFromFileName()` → `'Untitled SOP'` if that call fails or still returns a placeholder.
- **Target:** Same — already shipped, no gap. Added after GLM 5.2's first prod run returned placeholder titles (per REQUIREMENTS.md AIPS-TITLE-01).
- **Acceptance:** All three fallback rungs (LLM title kept / placeholder → filename-derived / no filename → `'Untitled SOP'`) are exercised. Locked by `src/lib/parsers/__tests__/sop-title.test.ts` (AIPS-GAP-03), registered under the existing `phase20-parsers` project.

### 8. AIPS-GAP-01 — `OPENROUTER_API_KEY` env documentation
- **Current:** `.env.local.example` documents Supabase/OpenAI/Anthropic/Shotstack/Deepgram keys but not `OPENROUTER_API_KEY`, despite `llm.ts:60` reading `process.env.OPENROUTER_API_KEY` for any OpenRouter-routed model.
- **Target:** `.env.local.example` documents `OPENROUTER_API_KEY` grouped with the sibling provider keys, immediately after the Anthropic block.
- **Acceptance:** `.env.local.example` contains a `## OpenRouter` comment header + `OPENROUTER_API_KEY=` line between the Anthropic and Shotstack blocks.

### 9. AIPS-GAP-02 — Org-isolation regression test
- **Current:** No automated test exists proving `setAiModelSetting` cannot write across org boundaries, even though the code (see AIPS-SET-02 above) already self-enforces it.
- **Target:** A real runtime behavioral test (never a source grep) exists proving the isolation property.
- **Acceptance:** Same as AIPS-SET-02 above — `tests/phase27/ai-settings-org-scope.spec.ts`.

### 10. AIPS-GAP-03 — Test coverage for registry/routing/title-guard
- **Current:** Zero tests exist across the whole arc (`src/lib/ai/__tests__/` does not exist prior to this phase).
- **Target:** `registry.test.ts`, `llm-routing.test.ts` (both under new `phase27-unit` project) and `sop-title.test.ts` (under existing `phase20-parsers` project) cover the behavioral contracts listed under AIPS-REG-01/02 and AIPS-TITLE-01 above.
- **Acceptance:** All three files green (`npx playwright test --project=phase27-unit` and `npx playwright test src/lib/parsers/__tests__/sop-title.test.ts --project=phase20-parsers`).

## Future Contributors Rule

New AI code in this codebase MUST call `aiModel()` / `llmText()` / `llmToolCall()` — never call a provider SDK directly, and never hardcode a model-ID string. This is the "don't hand-roll" target the registry/adapter exist for (27-RESEARCH.md § Don't Hand-Roll); adding a new model or provider is a registry/`PROVIDER_ENV_KEYS` edit, not a new call site.

## Boundaries

**In scope:**
- Documenting all 10 AIPS-* requirements as-built in this SPEC.md
- `OPENROUTER_API_KEY` line in `.env.local.example`
- Backfilled unit tests: `registry.test.ts`, `llm-routing.test.ts`, `sop-title.test.ts`
- Runtime org-scope write-isolation regression test for `setAiModelSetting`
- Two new Playwright project registrations (`phase27-unit`, `phase27-stubs`)
- REQUIREMENTS.md checkbox/traceability updates for AIPS-SET-02/GAP-01/GAP-02/GAP-03

**Out of scope:**
- Widening `ORG_CONFIGURABLE_KEYS` beyond the 3 parse use-cases (RESEARCH § Open Question 2 — a future-phase product decision, not this phase's job)
- Documenting/adding `VOYAGE_API_KEY` to `.env.local.example` (REQUIREMENTS.md AIPS-GAP-01 names only `OPENROUTER_API_KEY`)
- Behavioral tests for `model-options.ts` (UI-selector metadata — an array of labels, not logic worth testing; RESEARCH § Pitfall 3)
- Re-deriving or reconciling the historical "13 callsites" ROADMAP.md prose against the current 15-key registry (RESEARCH § Pitfall 4 — two different counts of two different things, not a checkable spec claim)
- Any code change to the AI provider arc itself — the shipped code was confirmed correct by direct read; this phase is documentation + tests only

---
*Phase: 27-ai-provider-settings-formal-spec-pass*
*Spec created: 2026-07-12*
