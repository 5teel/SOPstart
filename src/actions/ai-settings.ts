'use server'

/**
 * AI Settings server actions — per-organisation AI model overrides.
 *
 * Writes use the SERVICE-ROLE client (ai_model_settings has no authenticated
 * write policy by design — 00031/00036 pattern) and therefore self-enforce
 * org scoping: organisation_id always comes from the caller's JWT, never from
 * client input (2026-06-15 learning).
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionContext } from '@/lib/auth/session-context'
import { AI_MODELS, type AiModelKey } from '@/lib/ai/registry'
import { AI_MODEL_OPTIONS } from '@/lib/ai/model-options'
import { ORG_CONFIGURABLE_KEYS, getOrgAiModels, type OrgAiModels } from '@/lib/ai/org-settings'

type AdminCtx = { userId: string; organisationId: string }

// Local (not requireAdminContext): narrower return shape + 'No organisation found'.
async function requireAdmin(): Promise<AdminCtx | { error: string }> {
  const { userId, role, organisationId } = await getSessionContext()
  if (!userId) return { error: 'Not authenticated' }
  if (!role || !['admin', 'safety_manager'].includes(role)) {
    return { error: 'Admin access required' }
  }
  if (!organisationId) return { error: 'No organisation found' }
  return { userId, organisationId }
}

/** Current org overrides for the caller's organisation. */
export async function getAiSettings(): Promise<{ settings: OrgAiModels } | { error: string }> {
  const ctx = await requireAdmin()
  if ('error' in ctx) return ctx
  const admin = createAdminClient()
  return { settings: await getOrgAiModels(admin, ctx.organisationId) }
}

/**
 * Set (or clear, with modelId=null) one use case's org override.
 * modelId must be one of the use case's vetted options (model-options.ts).
 */
export async function setAiModelSetting(
  useCase: string,
  modelId: string | null,
): Promise<{ ok: true } | { error: string }> {
  const ctx = await requireAdmin()
  if ('error' in ctx) return ctx

  if (!(useCase in AI_MODELS)) return { error: `Unknown use case: ${useCase}` }
  const key = useCase as AiModelKey
  if (!(ORG_CONFIGURABLE_KEYS as readonly string[]).includes(key)) {
    return { error: 'This use case is environment-managed and cannot be overridden per organisation.' }
  }

  // ai_model_settings is not yet in the generated database.types.ts — same
  // `(as any)` precedent as departments.ts for fresh tables.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  if (modelId === null) {
    const { error } = await admin
      .from('ai_model_settings')
      .delete()
      .eq('organisation_id', ctx.organisationId)
      .eq('use_case', key)
    if (error) return { error: error.message }
    return { ok: true }
  }

  if (!AI_MODEL_OPTIONS[key].some((o) => o.id === modelId)) {
    return { error: `${modelId} is not an approved model for ${key}` }
  }

  const { error } = await admin.from('ai_model_settings').upsert(
    {
      organisation_id: ctx.organisationId,
      use_case: key,
      model_id: modelId,
      updated_by: ctx.userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'organisation_id,use_case' },
  )
  if (error) return { error: error.message }
  return { ok: true }
}
