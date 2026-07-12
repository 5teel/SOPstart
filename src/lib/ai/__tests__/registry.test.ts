/**
 * Phase 27 — AIPS-REG-01 / AIPS-GAP-03: registry behavioral unit tests (static imports).
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
 *   - 27-RESEARCH.md § Code Examples — aiModel() resolution (registry.ts:206-209)
 *   - 27-PATTERNS.md § src/lib/ai/__tests__/registry.test.ts + llm-routing.test.ts
 */
import { test, expect } from '@playwright/test'
import { aiModel, AI_MODELS, PROVIDER_ENV_KEYS, type AiModelDef, type AiProvider } from '@/lib/ai/registry'

// ---------------------------------------------------------------------------
// Behavioral test 1: every AI_MODELS key resolves to its defaultId when the
// env var is unset (iterates all keys — new registry entries auto-covered).
// ---------------------------------------------------------------------------

test(
  'AIPS-REG-01 [default]: aiModel() resolves every AI_MODELS key to its defaultId when env var unset',
  async () => {
    for (const key of Object.keys(AI_MODELS) as Array<keyof typeof AI_MODELS>) {
      const def = AI_MODELS[key] as AiModelDef
      if (def.envVar) delete process.env[def.envVar]
      expect(aiModel(key)).toBe(def.defaultId)
    }
  },
)

// ---------------------------------------------------------------------------
// Behavioral test 2: setting the env var overrides the default for a
// representative key, then restoring env restores default resolution.
// ---------------------------------------------------------------------------

test(
  'AIPS-REG-01 [env-override]: setting process.env[envVar] overrides the default and restoring env restores it',
  async () => {
    const key = 'parse-triage'
    const def = AI_MODELS[key] as AiModelDef
    const envVar = def.envVar as string
    const original = process.env[envVar]

    try {
      delete process.env[envVar]
      expect(aiModel(key)).toBe(def.defaultId)

      process.env[envVar] = 'override-model-id'
      expect(aiModel(key)).toBe('override-model-id')
    } finally {
      if (original === undefined) delete process.env[envVar]
      else process.env[envVar] = original
    }

    expect(aiModel(key)).toBe(def.defaultId)
  },
)

// ---------------------------------------------------------------------------
// Behavioral test 3: PROVIDER_ENV_KEYS has an entry for every AiProvider
// referenced across AI_MODELS — no registry key can reference a provider with
// no env-key mapping (a silent config gap).
// ---------------------------------------------------------------------------

test(
  'AIPS-REG-01 [provider-coverage]: PROVIDER_ENV_KEYS has an entry for every provider referenced in AI_MODELS',
  async () => {
    const providersInUse = new Set<AiProvider>(
      (Object.keys(AI_MODELS) as Array<keyof typeof AI_MODELS>).map(
        (key) => (AI_MODELS[key] as AiModelDef).provider,
      ),
    )

    for (const provider of providersInUse) {
      expect(Object.prototype.hasOwnProperty.call(PROVIDER_ENV_KEYS, provider)).toBe(true)
    }
  },
)
