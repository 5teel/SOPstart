import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AI_MODELS, aiModel, PROVIDER_ENV_KEYS, type AiModelKey, type AiProvider } from '@/lib/ai/registry'
import { ORG_CONFIGURABLE_KEYS, getOrgAiModels } from '@/lib/ai/org-settings'
import { AiSettingsClient } from './AiSettingsClient'

export const metadata: Metadata = {
  title: 'AI Settings — SOPstart',
  description: 'Configure which AI models power each part of SOPstart.',
}

export default async function AiSettingsPage() {
  // Auth guard — mirrors /admin/sops/new/ai/page.tsx (organisation_members.role lookup).
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('organisation_members')
    .select('role, organisation_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!member || !['admin', 'safety_manager'].includes(member.role)) {
    redirect('/dashboard')
  }

  const admin = createAdminClient()
  const orgSettings = await getOrgAiModels(admin, member.organisation_id)

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
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-[var(--ink-900)]">AI Settings</h1>
      <p className="mt-1 text-sm text-[var(--ink-500)]">
        Which AI models power each part of SOPstart. Organisation overrides apply to your org only;
        everything else is managed by deployment environment variables.
      </p>
      <AiSettingsClient snapshot={snapshot} orgSettings={orgSettings} />
    </div>
  )
}
