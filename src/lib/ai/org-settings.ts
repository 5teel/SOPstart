/**
 * Per-organisation AI model overrides (server-only).
 *
 * Resolution order: org setting (ai_model_settings table) > env var > registry
 * default. Only ORG_CONFIGURABLE_KEYS are consulted at runtime — the AI
 * Settings page renders every registry use case, but marks the rest as
 * environment-managed so a selection never silently does nothing.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { aiModel, type AiModelKey } from './registry'

/** Use cases whose org override is actually consulted by runtime code. */
export const ORG_CONFIGURABLE_KEYS = [
  'parse-triage',
  'parse-simple',
  'parse-complex',
] as const satisfies readonly AiModelKey[]

export type OrgConfigurableKey = (typeof ORG_CONFIGURABLE_KEYS)[number]

export type OrgAiModels = Partial<Record<AiModelKey, string>>

/**
 * Fetch an org's model overrides (service-role or session client — table has
 * an org-scoped read policy). Returns {} on any error so callers fall back to
 * env/registry defaults — a settings-read outage must never block parsing.
 */
export async function getOrgAiModels(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: SupabaseClient<any>,
  organisationId: string,
): Promise<OrgAiModels> {
  try {
    const { data, error } = await client
      .from('ai_model_settings')
      .select('use_case, model_id')
      .eq('organisation_id', organisationId)
    if (error || !data) return {}
    const out: OrgAiModels = {}
    for (const row of data as Array<{ use_case: string; model_id: string }>) {
      out[row.use_case as AiModelKey] = row.model_id
    }
    return out
  } catch {
    return {}
  }
}

/** Resolve one use case with org override applied. */
export function resolveOrgModel(key: AiModelKey, overrides: OrgAiModels): string {
  return overrides[key] || aiModel(key)
}
