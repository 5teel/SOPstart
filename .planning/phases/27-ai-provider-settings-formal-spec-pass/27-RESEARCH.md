# Phase 27: AI Provider & Settings — formal spec pass - Research

**Researched:** 2026-07-12
**Domain:** Retroactive documentation + test-backfill + 2 hardening checks for an already-shipped AI provider-abstraction layer (Next.js server code, Supabase RLS, Playwright unit/source-contract tests)
**Confidence:** HIGH — this is not exploratory research, it is a direct code survey. Every claim below is `[VERIFIED: codebase read]` unless marked otherwise.

## Summary

Phase 27 is documentation + test-backfill, not new architecture. The AI provider-abstraction arc (`registry.ts`, `llm.ts`, `org-settings.ts`, `ai-settings.ts`, the title guard, and parser hardening) is fully built, working, and already in prod. The code survey in this research confirms two of the three "gaps" listed in ROADMAP/REQUIREMENTS are real and narrow (`.env.local.example` missing `OPENROUTER_API_KEY`; zero test coverage across the whole arc) — but the third, most consequential-sounding one, is **good news**: `setAiModelSetting` in `src/actions/ai-settings.ts` **already self-enforces org-scoping correctly** (organisation_id is read from the caller's JWT via `parseJwtPayload`, never from client input, and both the `.upsert()` and `.delete()` calls carry `.eq('organisation_id', ctx.organisationId)`). This is the exact pattern that was missing in the 2026-06-15 `signOffCompletion` cross-tenant bug — here it was done right the first time. **AIPS-GAP-02 is therefore "write a regression test proving this," not "fix a security hole."**

**Primary recommendation:** Write one SPEC.md (as-built architecture, no new decisions to make), add REQUIREMENTS.md traceability rows (already partially present — see below), and land 3 small changes: (1) one line in `.env.local.example`, (2) a new `phase27-unit` Playwright project + ~4 test files covering registry/llm/org-settings/title-guard, (3) one regression test asserting `setAiModelSetting` cross-org isolation (expected to pass immediately, proving the existing code is correct — this is the same "prove it, don't just claim it" gap class as the 2026-06-15 and 2026-06-26 CLAUDE.md Learnings).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Model ID resolution (which model string to call) | API/Backend (`src/lib/ai/registry.ts`) | — | Server-only env-var resolution; client bundles get the static default only |
| Provider routing (Anthropic vs OpenAI vs OpenRouter) | API/Backend (`src/lib/ai/llm.ts`) | — | Pure function of model-ID string shape, called only from server code (route handlers, actions, lib modules) |
| Org model override storage | Database/Storage (`ai_model_settings` table) | API/Backend (service-role write) | RLS gives read-only SELECT to org members; all writes route through a service-role action — matches the 00031/00036 junction-table precedent already in this codebase |
| Org model override UI | Frontend Server (SSR page) + Browser (client component) | API/Backend (server actions) | `/admin/ai-settings/page.tsx` (server) + `AiSettingsClient.tsx` (client) calling `getAiSettings`/`setAiModelSetting` server actions |
| SOP title naming | API/Backend (`sop-title.ts`, called from parse pipeline) | — | Runs server-side inside the async parse job; not exposed as its own endpoint |
| Grounding/structure prompt | API/Backend (`sop-parser.ts` SYSTEM_PROMPT) | — | Static string compiled into the parse call; no runtime configurability beyond model selection |

## User Constraints

No CONTEXT.md exists for this phase (not yet discussed). This section is intentionally empty — the planner should treat the ROADMAP.md "### Phase 27" entry and REQUIREMENTS.md AIPS-* rows (both already written and locked by Simon) as the binding scope. Nothing in this phase is "Claude's discretion" in the exploratory sense — it is a closure/documentation pass over already-built code.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AIPS-REG-01 | Single-source model registry (`AI_MODELS`) maps every AI use-case to a provider + default model ID, resolvable via env override | Verified at `src/lib/ai/registry.ts:78-209` — 15 keys, `aiModel()` resolves env override > default |
| AIPS-REG-02 | Provider-agnostic adapter (`llmText`/`llmToolCall`) routes by model-ID shape, JSON-extraction fallback + one retry | Verified at `src/lib/ai/llm.ts:42-46` (routing), `118-133` (extractJson 3-stage fallback), `171-178` (one retry for non-Anthropic tool calls) |
| AIPS-SET-01 | Admin can override model selection per org for 3 parse use cases via `/admin/ai-settings` | Verified — `ORG_CONFIGURABLE_KEYS` in `org-settings.ts:13-17` gates exactly `parse-triage`/`parse-simple`/`parse-complex`; UI at `src/app/(protected)/admin/ai-settings/` |
| AIPS-SET-02 | `setAiModelSetting` write path has a test proving org-scoping self-enforcement | **Already correctly implemented** — see Common Pitfalls below. Only a test is missing, not a fix |
| AIPS-PROMPT-01 | SOP parser system prompt encodes R&D-validated grounding/structure/title rules | `src/lib/parsers/sop-parser.ts` SYSTEM_PROMPT + `TITLE_CONVENTIONS` injection — not independently re-verified against `.autoresearch` metrics in this research pass (out of scope: those numbers are historical R&D-loop output, not re-testable here) |
| AIPS-PARSE-01 | Parser hardened for non-Anthropic quirks: empty-field normalization, idempotent re-parse, OpenRouter fence/retry | Verified — `sop-parser.ts:302-315` (trim/null/filter empty step text), `api/sops/parse/route.ts:73-79` (delete-before-reparse), `llm.ts:109-113` + `171-178` (fence extraction + retry) |
| AIPS-TITLE-01 | `ensureSopTitle` rejects placeholder titles, falls back to filename or LLM naming call | Verified at `src/lib/parsers/sop-title.ts:31-89` — full fallback chain read and confirmed |
| AIPS-GAP-01 | `OPENROUTER_API_KEY` documented in `.env.local.example` | Confirmed absent. Exact insertion point identified below |
| AIPS-GAP-02 | Regression test proving `ai_model_settings` writes cannot cross org boundaries | Code already correct (self-enforced org scope) — task is test-only, not a fix |
| AIPS-GAP-03 | Automated test coverage for registry resolution, `llm.ts` routing, title-guard fallback | Zero existing tests confirmed (`src/lib/ai/__tests__/` does not exist). Recommended layout below |

## Standard Stack

No new libraries needed for this phase — it is 100% backfill against already-installed dependencies (`@anthropic-ai/sdk`, `@playwright/test`, existing Supabase clients). No package installs, so the **Package Legitimacy Audit** and **Environment Availability** sections are omitted per their skip conditions (no new external dependencies).

## Architecture Patterns

### System Architecture Diagram

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

### Recommended Project Structure (test backfill only — no source restructuring needed)
```
src/lib/ai/__tests__/
├── registry.test.ts        # AIPS-GAP-03: aiModel() default + env override resolution per key
├── llm-routing.test.ts     # AIPS-GAP-03: providerForModel() shape rules + extractJson() 3-stage fallback
tests/phase27/
├── ai-settings-org-scope.spec.ts   # AIPS-GAP-02/SET-02: cross-org write isolation regression
src/lib/parsers/__tests__/
├── sop-title.test.ts        # AIPS-GAP-03: isPlaceholderTitle / titleFromFileName / ensureSopTitle fallback chain
```

### Pattern: Test-layout precedent already in this repo
**What:** Every phase that adds pure-function unit tests uses a `testDir` project scoped to `./src/lib/<area>/__tests__` with `testMatch: /.*\.test\.ts$/`, so Playwright's TS compiler resolves `@/` static imports (CLAUDE.md 2026-04-24 learning: dynamic `import('@/...')` breaks outside a scoped testDir).
**When to use:** Any new pure-module unit test in this codebase.
**Example (existing, directly reusable):**
```typescript
// playwright.config.ts — phase15-unit precedent (registered pattern)
{
  name: 'phase23-unit',
  testDir: './src/lib/ai-fields/__tests__',
  testMatch: /.*\.test\.ts$/,
},
```
Recommendation for this phase: add **one new project entry**, `phase27-unit`, pointed at `./src/lib/ai/__tests__` (mirrors `phase23-unit` exactly), PLUS extend the existing `phase20-parsers` project (`testDir: './src/lib/parsers/__tests__'`, already registered and already matches `.test.ts$` broadly) to pick up `sop-title.test.ts` — no new project needed for that file, it lands in an existing scoped dir. For the org-scope regression spec (`AIPS-GAP-02`), this needs a live Supabase Playwright integration spec (it exercises the DB, not a pure function) — follow the `phase25-integration` precedent: register under `.` with a filename regex, e.g. add `ai-settings-org-scope` to a new `phase27-stubs` project (or extend `phase25-integration`'s regex — but a same-phase-numbered project is more consistent with the one-phase-one-project convention every prior phase uses). **Recommend: new `phase27-stubs` project**, `testDir: '.'`, `testMatch: /tests\/phase27\/.*\.(spec|test)\.ts$/` — mirrors the `phase26`/`phase26.5` "one broad testMatch, single registration point" pattern (CLAUDE.md 2026-05-25 learning: an unregistered spec file never runs). After adding, run `npx playwright test --list --project=phase27-unit` and `--project=phase27-stubs` to verify discovery before considering the plan's Wave 0 done.

### Anti-Patterns to Avoid
- **Testing via dynamic `import('@/...')` inside an unscoped test file:** breaks with `SyntaxError: Unexpected token 'export'` per the 2026-06-24 CLAUDE.md learning. Use static imports inside a `testDir`-scoped project.
- **Writing the org-scope regression test as a source-contract grep** (e.g. asserting the string `.eq('organisation_id'` appears in `ai-settings.ts`): this is exactly the "GREEN but meaningless" trap from the 2026-06-05/2026-06-08 CLAUDE.md learnings. AIPS-GAP-02 needs a REAL runtime test — call `setAiModelSetting` as an authenticated user of Org A, then read the row back as Org B (or via service-role) and assert Org B's row was untouched / Org A cannot write into Org B's row. A grep-only test would not have caught the 2026-06-15 `signOffCompletion` bug and must not be the pattern repeated here.

## Don't Hand-Roll

Not applicable — no new capability is being built. The registry/adapter/settings-resolution machinery already exists and is the "don't hand-roll" target for any FUTURE AI feature in this codebase (new code should call `aiModel()`/`llmText()`/`llmToolCall()`, never call an SDK directly or hardcode a model string — this is already stated in the file header comments and should be restated as an explicit rule in SPEC.md for future contributors).

## Common Pitfalls

### Pitfall 1: Assuming AIPS-SET-02/GAP-02 requires a code fix
**What goes wrong:** Planner reads "same risk class as the 2026-06-15 cross-tenant admin-client learning" in REQUIREMENTS.md and schedules a fix task before a test task.
**Why it happens:** The requirement wording (correctly) flags the *pattern* as historically dangerous, but doesn't say whether THIS instance already got it right.
**How to avoid:** This research confirms `src/actions/ai-settings.ts` (`requireAdmin()` + `.eq('organisation_id', ctx.organisationId)` on every write) already matches the safe pattern. **Plan AIPS-GAP-02 as test-only.** If the new regression test somehow fails, that would be a genuine (unexpected) finding — but the code as read is correct.
**Warning signs:** None currently — code reads clean. Flag only if the regression test surfaces something this research missed (e.g. a code path added after this research date).

### Pitfall 2: `.env.local.example` insertion point ambiguity
**What goes wrong:** OPENROUTER_API_KEY gets appended at the end of the file, disconnected from the other provider keys, making the file harder to scan.
**Why it happens:** No obvious "OpenRouter" section exists yet.
**How to avoid:** Insert immediately after the existing Anthropic block (current lines 9-10: `## Anthropic (adversarial SOP verification)` / `ANTHROPIC_API_KEY=sk-ant-...`), before the blank line preceding the Shotstack section (current line 11 is blank, line 12 is `## Shotstack...`). New block to insert:
```
## OpenRouter (cross-provider model routing — GLM 5.2 and other OpenRouter-served models)
OPENROUTER_API_KEY=
```
This groups it with the other LLM-provider keys (Supabase → OpenAI → Anthropic → OpenRouter → Shotstack → Deepgram), matching the file's existing "keys near their sibling keys" ordering. Confirmed current file has 26 lines total, ends with `NEXT_PUBLIC_MODEL_BLOCK_ENABLED=false` — no other provider-key gaps found (VOYAGE_API_KEY is also absent but is explicitly out of this phase's scope per REQUIREMENTS.md AIPS-GAP-01 wording, which names only OPENROUTER_API_KEY).

### Pitfall 3: `AiModelSelect`/`model-options.ts` scope creep
**What goes wrong:** While writing SPEC.md, it's tempting to also document/test `model-options.ts` (the vetted-candidate-list UI metadata) as if it were part of the "3 gaps."
**Why it happens:** It's adjacent code, imported by the same page.
**How to avoid:** REQUIREMENTS.md AIPS-GAP-03 explicitly scopes test coverage to "registry resolution, llm.ts provider routing, and title-guard fallback chain" — `model-options.ts` is UI-selector metadata (an array of labels), not logic worth a behavioral test. SPEC.md should still document it as part of the as-built architecture (it's referenced in the System Architecture Diagram above via `AiModelSelect`) but it does not need its own test file.

### Pitfall 4: The "13 callsites" ROADMAP claim vs the 15-key registry
**What goes wrong:** A literal-minded SPEC.md tries to reconcile "13 callsites normalized" (ROADMAP.md line 111) against the 15 `AI_MODELS` keys found in `registry.ts` and treats the mismatch as a bug.
**Why it happens:** These are two different counts of two different things.
**How to avoid:** `grep -rn "aiModel(\|resolveOrgModel("` across `src/` found **17 files** referencing the registry (some, like `agent-layer/model-constants.ts`, are a legacy re-export shim calling `aiModel()` 6 times for backward compatibility, not 6 independent callsites of new code). The ROADMAP's "13 callsites" almost certainly refers to the count of previously-hardcoded model-ID strings that were replaced when the registry was introduced (a historical migration count), not a live invariant that must match today's 15 registry KEYS or N call statements. **Recommend:** SPEC.md states the current, verifiable facts (15 registry keys covering 8 capability areas; provider routing by model-ID shape) and does NOT attempt to re-derive or "correct" the historical "13 callsites" ROADMAP sentence — it's backward-looking prose, not a checkable spec claim. Not worth a ROADMAP edit; flag as a non-issue in the SPEC's "as-built" framing if it comes up.

## Code Examples

### Registry resolution (already-shipped pattern to test against)
```typescript
// Source: src/lib/ai/registry.ts:206-209
export function aiModel(key: AiModelKey): string {
  const def = AI_MODELS[key] as AiModelDef
  return (def.envVar && process.env[def.envVar]) || def.defaultId
}
```
A `registry.test.ts` should assert: (a) every key in `AI_MODELS` resolves to `defaultId` when its env var is unset, (b) setting `process.env[envVar]` overrides the default for at least one representative key per capability, (c) `PROVIDER_ENV_KEYS` has an entry for every `AiProvider` used across `AI_MODELS` (a registry key referencing a provider with no `PROVIDER_ENV_KEYS` entry would be a silent config gap).

### Provider routing (already-shipped pattern to test against)
```typescript
// Source: src/lib/ai/llm.ts:42-46
export function providerForModel(model: string): AiProvider {
  if (model.includes('/')) return 'openrouter'
  if (model.startsWith('claude')) return 'anthropic'
  return 'openai'
}
```
Pure function, trivially unit-testable with representative IDs: `'z-ai/glm-5.2'` → openrouter, `'claude-haiku-4-5-20251001'` → anthropic, `'gpt-4o-2024-08-06'` → openai. Also test `extractJson()` (lines 118-133) with 3 fixtures: raw JSON string, fenced ```json block, and prose-wrapped `{...}` — each should resolve to the same parsed object, and garbage input should return `null` (not throw).

### Org-scope self-enforcement (already-shipped, needs a regression test)
```typescript
// Source: src/actions/ai-settings.ts:47-90 (setAiModelSetting)
const ctx = await requireAdmin() // organisationId derived from session JWT claims, NOT from any argument
...
const { error } = await admin.from('ai_model_settings').upsert(
  { organisation_id: ctx.organisationId, use_case: key, model_id: modelId, ... },
  { onConflict: 'organisation_id,use_case' },
)
```
Note `setAiModelSetting(useCase, modelId)` — the function signature has **no organisationId parameter at all**, so there is no client-supplied org id to spoof in the first place. This is a stronger guarantee than "self-enforced filter on a trusted param" (the 2026-06-15 bug class) — there's no attack surface for cross-org writes via this action's public signature. The regression test should still exist to lock this in behaviorally (assert Org B never sees a row written while authenticated as Org A), guarding against a future refactor that adds an org-id parameter without re-adding the guard.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The `.autoresearch` R&D loop's "composite 75.9→87.3, hallucinations 4→0" metrics (referenced in AIPS-PROMPT-01 and CLAUDE.md) are accurate historical results | Phase Requirements table (AIPS-PROMPT-01) | Low — these are cited from CLAUDE.md/ROADMAP as already-established facts, not re-verified against raw `.autoresearch` logs in this pass; if wrong, only affects a descriptive sentence in SPEC.md, not any code or test |
| A2 | "13 callsites normalized" in ROADMAP.md refers to a historical pre-registry migration count, not a live invariant | Pitfall 4 | Low — worst case is a planner spends 10 minutes trying to reconcile two numbers that were never meant to match; no functional impact |

**If this table is empty:** N/A — see above, both entries are low-risk documentation nits, not code-affecting.

## Open Questions

1. **Does SPEC.md need a "why OpenRouter/GLM 5.2" rationale section, or is architecture-as-built sufficient?**
   - What we know: ROADMAP.md and CLAUDE.md both mention GLM 5.2 validation came from the `.autoresearch` R&D loop.
   - What's unclear: Whether Simon wants that rationale captured in the formal SPEC.md or considers it already-documented in `.autoresearch/` and not worth duplicating.
   - Recommendation: Keep SPEC.md focused on the app-layer architecture (registry/adapter/settings/prompt/title-guard) with a one-line pointer to `.autoresearch/` for the R&D provenance, rather than re-deriving those findings. Low-stakes either way — planner's call.

2. **Should the AI Settings admin UI eventually expose more than the 3 `ORG_CONFIGURABLE_KEYS`?**
   - What we know: `AiModelSelect`/`ai-settings` page renders every registry key but marks non-configurable ones as "environment-managed."
   - What's unclear: Whether widening `ORG_CONFIGURABLE_KEYS` is in scope for Phase 27 or a future phase.
   - Recommendation: Out of scope — REQUIREMENTS.md AIPS-SET-01 explicitly names only the 3 parse use cases as shipped scope, and Phase 27's goal is formalizing what shipped, not expanding it. Planner should not add tasks here.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright Test (`@playwright/test`), used for both true e2e AND pure-function unit tests via `testDir`-scoped projects |
| Config file | `C:\Development\SOPstart\playwright.config.ts` |
| Quick run command | `npx playwright test --project=phase27-unit` (new) |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AIPS-GAP-03 (registry) | `aiModel()` default + env override resolution | unit | `npx playwright test src/lib/ai/__tests__/registry.test.ts --project=phase27-unit` | ❌ Wave 0 |
| AIPS-GAP-03 (llm routing) | `providerForModel()` shape rules + `extractJson()` fallback chain | unit | `npx playwright test src/lib/ai/__tests__/llm-routing.test.ts --project=phase27-unit` | ❌ Wave 0 |
| AIPS-GAP-03 (title guard) | `isPlaceholderTitle`/`titleFromFileName`/`ensureSopTitle` fallback chain | unit | `npx playwright test src/lib/parsers/__tests__/sop-title.test.ts --project=phase20-parsers` | ❌ Wave 0 (existing project, new file) |
| AIPS-GAP-02 / AIPS-SET-02 | `setAiModelSetting` cannot write across org boundary | integration (live Supabase) | `npx playwright test tests/phase27/ai-settings-org-scope.spec.ts --project=phase27-stubs` | ❌ Wave 0 |
| AIPS-GAP-01 | `.env.local.example` documents `OPENROUTER_API_KEY` | manual/source-contract (one-line file check, not worth a Playwright spec) | `grep OPENROUTER_API_KEY .env.local.example` | N/A — trivial file edit, no test needed |

### Sampling Rate
- **Per task commit:** `npx playwright test --project=phase27-unit --project=phase27-stubs`
- **Per wave merge:** `npm run test` (full suite) + `npx tsc --noEmit` + `npm run build` (per the 2026-06-02/2026-06-27 CLAUDE.md learnings: `next build` typecheck scope differs from bare `tsc`, and this phase touches `'use server'`-adjacent code, so a real build is the correct final gate)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/lib/ai/__tests__/registry.test.ts` — covers AIPS-REG-01, AIPS-GAP-03
- [ ] `src/lib/ai/__tests__/llm-routing.test.ts` — covers AIPS-REG-02, AIPS-GAP-03
- [ ] `src/lib/parsers/__tests__/sop-title.test.ts` — covers AIPS-TITLE-01, AIPS-GAP-03
- [ ] `tests/phase27/ai-settings-org-scope.spec.ts` — covers AIPS-SET-02, AIPS-GAP-02
- [ ] `playwright.config.ts` — add `phase27-unit` (testDir `./src/lib/ai/__tests__`) and `phase27-stubs` (testDir `.`, testMatch `tests/phase27/**`) project entries
- [ ] Framework install: none — `@playwright/test` already present

## Security Domain

`security_enforcement` is not set in `.planning/config.json` — treated as enabled per default. This phase touches exactly one security-relevant surface (org-scoped AI settings writes), already covered above.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V4 Access Control | yes | `requireAdmin()` role gate (admin/safety_manager) + JWT-derived org scoping on every `ai_model_settings` write (already implemented, needs regression test per AIPS-GAP-02) |
| V5 Input Validation | yes | `setAiModelSetting` validates `useCase` against `AI_MODELS` keys and `modelId` against `AI_MODEL_OPTIONS[key]` vetted list before writing — already implemented, no gap found |
| V6 Cryptography | no | No new crypto surface this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-tenant write via service-role action with unenforced org filter (recurring pattern in this codebase per 2026-06-15/2026-06-26 CLAUDE.md learnings) | Elevation of Privilege | Already mitigated in `ai-settings.ts` — org id sourced from JWT, never a parameter; `.eq('organisation_id', ...)` on every write. This phase's job is to LOCK it in with a test, not fix new code |
| Arbitrary model-ID injection into `setAiModelSetting` (e.g. a client picking an unvetted/expensive model) | Tampering | Already mitigated — `AI_MODEL_OPTIONS[key].some(o => o.id === modelId)` allowlist check before upsert |

## Sources

### Primary (HIGH confidence — direct codebase reads)
- `src/lib/ai/registry.ts` (full file read)
- `src/lib/ai/llm.ts` (full file read)
- `src/lib/ai/org-settings.ts` (full file read)
- `src/lib/ai/model-options.ts` (partial read, lines 1-50)
- `src/actions/ai-settings.ts` (full file read)
- `src/lib/parsers/sop-title.ts` (full file read)
- `src/lib/parsers/sop-parser.ts` (lines 280-319, empty-field normalization)
- `src/app/api/sops/parse/route.ts` (lines 55-94, idempotent delete-before-reparse)
- `src/lib/agent-layer/model-constants.ts` (full file — confirmed legacy shim, no duplication)
- `supabase/migrations/00042_ai_model_settings.sql` (full file read)
- `playwright.config.ts` (full file read — all existing project registrations)
- `.env.local.example` (full file read — exact current content/line numbers)
- `.planning/ROADMAP.md` §"Phase 27" and §"Post-26.5 ad-hoc work"
- `.planning/REQUIREMENTS.md` AIPS-* section (grep, lines 478-505)
- `.planning/STATE.md` (Current Position, Decisions — confirmed no conflicting locked decisions)
- `src/lib/journeys/journeys.ts` (grep confirmed `/admin/ai-settings` already mapped, line 235)
- `C:\Development\SOPstart\CLAUDE.md` `## Learnings` (2026-06-15, 2026-06-26, 2026-04-24, 2026-05-25, 2026-06-05/08 entries — applied directly to pitfalls/patterns above)

### Secondary (MEDIUM confidence)
- None used — this research required no external web lookups; the entire domain is internal, already-shipped code.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies, all existing code read directly
- Architecture: HIGH — full read of every file in the arc, not inferred
- Pitfalls: HIGH — cross-referenced against this project's own documented CLAUDE.md Learnings, not generic advice

**Research date:** 2026-07-12
**Valid until:** 30 days (code is stable/shipped; only risk is Simon shipping further ad-hoc changes to this arc before Phase 27 executes — re-grep `src/lib/ai/` and `src/actions/ai-settings.ts` at plan time if significant time has passed)
