import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSessionContext } from '@/lib/auth/session-context'
import { createAdminClient } from '@/lib/supabase/admin'
import { AI_MODELS, aiModel, PROVIDER_ENV_KEYS, type AiModelKey, type AiProvider } from '@/lib/ai/registry'
import { ORG_CONFIGURABLE_KEYS, getOrgAiModels } from '@/lib/ai/org-settings'
import { AiSettingsClient } from './AiSettingsClient'

export const metadata: Metadata = {
  title: 'AI Settings — SOPstart',
  description: 'Configure which AI models power each part of SOPstart.',
}

export default async function AiSettingsPage() {
  // Auth guard — shared per-request session context (JWT verified locally).
  const { userId, role, organisationId } = await getSessionContext()
  if (!userId) redirect('/login')

  if (!role || !['admin', 'safety_manager'].includes(role) || !organisationId) {
    redirect('/dashboard')
  }

  const admin = createAdminClient()
  const orgSettings = await getOrgAiModels(admin, organisationId)

  // Server-side snapshot: resolved model (env overrides visible only here) +
  // provider key presence per use case.
  const keys = Object.keys(AI_MODELS) as AiModelKey[]
  const snapshot = keys.map((key) => {
    const def = AI_MODELS[key]
    const envKey = PROVIDER_ENV_KEYS[def.provider as AiProvider]
    return {
      key,
      capability: def.capability as string,
      provider: def.provider as string,
      description: def.description,
      envVar: def.envVar ?? null,
      resolvedDefault: aiModel(key),
      providerKeyConfigured: envKey === null ? true : Boolean(process.env[envKey]),
      orgConfigurable: (ORG_CONFIGURABLE_KEYS as readonly string[]).includes(key),
    }
  })

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-[var(--ink-900)]">AI Settings</h1>
      <p className="mt-1 text-sm text-[var(--ink-500)]">
        Which AI models power each part of SOPstart. Organisation overrides apply to your org only;
        everything else is managed by deployment environment variables.
      </p>
      <AiSettingsClient snapshot={snapshot} orgSettings={orgSettings} />
    </div>
  )
}
