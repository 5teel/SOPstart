# Phase 27: AI Provider & Settings — Pattern Map

**Mapped:** 2026-07-12
**Files analyzed:** 6 (1 doc, 4 test files, 2 edited config/env files)
**Analogs found:** 6 / 6

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `27-SPEC.md` | config (planning doc) | — | `.planning/phases/25-department-first-class-entity/25-SPEC.md` | exact |
| `src/lib/ai/__tests__/registry.test.ts` | test (unit) | transform | `src/lib/ai-fields/__tests__/registry.test.ts` | exact |
| `src/lib/ai/__tests__/llm-routing.test.ts` | test (unit) | transform | `src/lib/ai-fields/__tests__/registry.test.ts` | exact |
| `src/lib/parsers/__tests__/sop-title.test.ts` | test (unit) | transform | existing files already in `src/lib/parsers/__tests__/` (phase20-parsers project) | exact |
| `tests/phase27/ai-settings-org-scope.spec.ts` | test (integration, live Supabase) | CRUD (write isolation) | `tests/integration/departments-rls.spec.ts` | exact |
| `playwright.config.ts` | config | — | itself (edit in place) | exact |
| `.env.local.example` | config | — | itself (edit in place) | exact |

## Pattern Assignments

### `.planning/phases/27-ai-provider-settings-formal-spec-pass/27-SPEC.md`

**Analog:** `.planning/phases/25-department-first-class-entity/25-SPEC.md`

Structure to copy (headings, in order): `# Phase N: Title — Specification` → `**Created:**` / `**Ambiguity score:**` / `**Requirements:**` metadata line → `## Goal` (1 paragraph) → `## Background` (as-built context, cites migrations/files by path) → `## Requirements` (numbered list, each with **Current / Target / Acceptance** sub-structure) → `## Boundaries` (`**In scope:**` / presumably `**Out of scope:**` bullet lists).

Since Phase 27 is a documentation pass over shipped code (no CONTEXT.md, no new decisions — confirmed in RESEARCH.md "User Constraints"), the SPEC.md should:
- Use the "Current" column = "Target" column for most requirements (already shipped) — the Requirements section format still applies, just describing as-built state rather than a gap to close.
- Pull requirement text directly from REQUIREMENTS.md AIPS-* rows (already locked).
- Cite exact files/lines from 27-RESEARCH.md's "Sources" and "Code Examples" sections (e.g. `src/lib/ai/registry.ts:206-209`, `src/actions/ai-settings.ts:47-90`) instead of re-deriving.
- Include the System Architecture Diagram already drafted in 27-RESEARCH.md (lines 51-85) verbatim or lightly adapted — no need to redraw.

---

### `src/lib/ai/__tests__/registry.test.ts` and `llm-routing.test.ts` (test, unit)

**Analog:** `src/lib/ai-fields/__tests__/registry.test.ts` (excerpt below), registered under `phase23-unit` project (`testDir: './src/lib/ai-fields/__tests__'`).

**File header pattern** (lines 1-27) — copy this comment-block convention: cite the requirement IDs covered, state the registered Playwright project + testDir, restate the CLAUDE.md 2026-04-24 static-import rule verbatim (dynamic `import('@/...')` fails outside a scoped testDir), and list the source doc(s) informing the test:
```typescript
/**
 * Phase 27 — AIPS-GAP-03: <registry|llm routing> behavioral unit tests (static imports).
 *
 * Registered under the `phase27-unit` Playwright project:
 *   testDir: './src/lib/ai/__tests__'
 * This ensures Playwright's TS compiler resolves @/ path aliases via static imports.
 *
 * CLAUDE.md 2026-04-24: dynamic import('@/...') fails in Playwright Node runner
 * outside a testDir-scoped project. Use STATIC @/ imports here.
 *
 * NEVER use `await import('@/lib/ai/registry')` here — it will fail at runtime
 * in the Playwright Node runner with "SyntaxError: Unexpected token 'export'".
 *
 * Sources:
 *   - 27-RESEARCH.md § Code Examples — aiModel() / providerForModel() / extractJson()
 */
import { test, expect } from '@playwright/test'
import { aiModel, AI_MODELS } from '@/lib/ai/registry'
```

**Test body pattern** (lines 36-52) — one `test()` per behavioral contract, named `'<REQ-ID> [case]: description'`, plain `expect()` assertions, no fixtures/beforeEach boilerplate:
```typescript
test(
  'AIPS-GAP-03 [default]: aiModel() resolves to defaultId when env var unset',
  async () => {
    const model = aiModel('parse-triage')
    expect(model).toBe(AI_MODELS['parse-triage'].defaultId)
  },
)
```
Behavioral contracts to cover per 27-RESEARCH.md § Code Examples:
- `registry.test.ts`: default resolution per key, env-var override for ≥1 representative key, `PROVIDER_ENV_KEYS` has an entry for every provider referenced in `AI_MODELS`.
- `llm-routing.test.ts`: `providerForModel()` on 3 representative ID shapes (`'z-ai/glm-5.2'`→openrouter, `'claude-haiku-4-5-20251001'`→anthropic, `'gpt-4o-2024-08-06'`→openai), `extractJson()` 3-stage fallback (raw JSON / fenced ```json block / prose-wrapped `{...}`) all parse to the same object, and garbage input returns `null` not throw.

---

### `src/lib/parsers/__tests__/sop-title.test.ts` (test, unit)

**Analog:** existing sibling files already in `src/lib/parsers/__tests__/` — same directory, already registered under `phase20-parsers` project (`testMatch: /.*\.test\.ts$/`), no config edit needed for this file. Follow the same header/body conventions as the `registry.test.ts` analog above (static `@/` imports, one `test()` per behavior). Cover: `isPlaceholderTitle` on known placeholder strings, `titleFromFileName` on a sample filename, and `ensureSopTitle`'s fallback chain (LLM title → filename → `'Untitled SOP'`) per RESEARCH.md AIPS-TITLE-01 (`src/lib/parsers/sop-title.ts:31-89`).

---

### `tests/phase27/ai-settings-org-scope.spec.ts` (test, integration — live Supabase)

**Analog:** `tests/integration/departments-rls.spec.ts`, registered under `phase25-integration` project.

**Do NOT** write this as a source-contract grep (RESEARCH.md Anti-Pattern explicitly warns against `expect(source).toContain(".eq('organisation_id'")` — this is the exact "GREEN but meaningless" trap from the 2026-06-05/06-08 CLAUDE.md learnings that would not have caught the 2026-06-15 cross-tenant bug). This spec must exercise the write path at runtime:

1. Authenticate as an Org A admin, call `setAiModelSetting('parse-triage', '<model-id>')`.
2. Using a service-role/admin client, read `ai_model_settings` rows for Org B and assert no row was created/mutated for Org B.
3. Assert the row that WAS created carries `organisation_id = <Org A id>` (not client-suppliable — confirms `ctx.organisationId` sourced from JWT per `src/actions/ai-settings.ts:47-90`).

**File header pattern** to copy from `departments-rls.spec.ts` (lines 1-15): state which requirement IDs are verified (AIPS-GAP-02, AIPS-SET-02), note Wave-0 status if using `test.fixme` until live-DB fixtures exist, and note the exact Playwright project registration line for verification (`npx playwright test --list --project=phase27-stubs`).

**Describe-block / test-naming pattern** (lines 35-90): `test.describe('AIPS-SET-02 — ai_model_settings write isolation', () => { test('<requirement label>: <specific assertion>', () => {...}) })`.

Source under test — `src/actions/ai-settings.ts:47-90` (`setAiModelSetting`), key excerpt confirming org id is JWT-derived and never a function parameter:
```typescript
async function requireAdmin(): Promise<AdminCtx | { error: string }> {
  ...
  const organisationId = claims['organisation_id'] as string | undefined
  if (!organisationId) return { error: 'No organisation found' }
  return { userId: user.id, organisationId }
}

export async function setAiModelSetting(useCase: string, modelId: string | null) {
  const ctx = await requireAdmin()
  ...
  const { error } = await admin.from('ai_model_settings').upsert(
    { organisation_id: ctx.organisationId, use_case: key, model_id: modelId, ... },
    { onConflict: 'organisation_id,use_case' },
  )
}
```
Note the function signature has no `organisationId` parameter at all — no client-supplied value to spoof.

---

### `playwright.config.ts` (config edit)

**Pattern:** copy the `phase23-unit` project entry verbatim, retarget testDir; copy the `phase26`/`phase26.5` "one broad testMatch per phase directory" pattern for the stubs project.

Add after the `phase23-unit` entry (around line 213), two new project objects:
```typescript
{
  // Phase 27 — AI Provider & Settings unit tests (pure modules; static imports).
  // Verify: `npx playwright test --list --project=phase27-unit`
  name: 'phase27-unit',
  testDir: './src/lib/ai/__tests__',
  testMatch: /.*\.test\.ts$/,
},
{
  // Phase 27 — ai_model_settings org-scope regression (live Supabase integration).
  // CLAUDE.md 2026-05-25: a spec file not in any project regex NEVER runs.
  // Verify: `npx playwright test --list --project=phase27-stubs`
  name: 'phase27-stubs',
  testDir: '.',
  testMatch: /tests\/phase27\/.*\.(spec|test)\.ts$/,
  use: { browserName: 'chromium' },
},
```
No new project needed for `sop-title.test.ts` — it lands in the existing `phase20-parsers` project directory and is picked up by its already-broad `testMatch: /.*\.test\.ts$/`.

---

### `.env.local.example` (config edit)

**Pattern:** insert immediately after the existing Anthropic block (current lines 9-10), before the blank line preceding the Shotstack section, matching the file's "keys near their sibling provider keys" ordering (Supabase → OpenAI → Anthropic → OpenRouter → Shotstack → Deepgram):
```
## OpenRouter (cross-provider model routing — GLM 5.2 and other OpenRouter-served models)
OPENROUTER_API_KEY=
```

## Shared Patterns

### "Spec file not registered = never runs" guard
**Source:** CLAUDE.md 2026-05-25 learning, restated in every `phase*-stubs`/`phase*-unit` project comment in `playwright.config.ts`.
**Apply to:** Both new playwright.config.ts project entries. After adding, run:
```
npx playwright test --list --project=phase27-unit
npx playwright test --list --project=phase27-stubs
```
and confirm the expected files appear before considering Wave 0 done.

### Static `@/` imports only, inside a testDir-scoped project
**Source:** `src/lib/ai-fields/__tests__/registry.test.ts` lines 1-13, `src/lib/voice/__tests__/*` (phase15-unit).
**Apply to:** All 3 new unit test files. Never use `await import('@/...')`.

### Org-scope regression must be behavioral, not grep
**Source:** `tests/integration/departments-rls.spec.ts` + RESEARCH.md Anti-Patterns section.
**Apply to:** `tests/phase27/ai-settings-org-scope.spec.ts`. A grep-only assertion (`toContain(".eq('organisation_id'")`) is explicitly rejected — must perform a real write as Org A and verify Org B's row set is untouched.

## No Analog Found

None — all 6 files have exact analogs already in the codebase.

## Metadata

**Analog search scope:** `.planning/phases/25-department-first-class-entity/`, `src/lib/ai-fields/__tests__/`, `src/lib/parsers/__tests__/`, `tests/integration/`, `playwright.config.ts`, `.env.local.example`
**Files scanned:** 25-SPEC.md, registry.test.ts (ai-fields), departments-rls.spec.ts, ai-settings.ts (source under test), playwright.config.ts (full)
**Pattern extraction date:** 2026-07-12
