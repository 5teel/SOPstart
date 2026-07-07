'use client'

import { useState, useTransition } from 'react'
import AiModelSelect from '@/components/ai/AiModelSelect'
import { setAiModelSetting } from '@/actions/ai-settings'
import type { AiModelKey } from '@/lib/ai/registry'
import type { OrgAiModels } from '@/lib/ai/org-settings'

export interface UseCaseSnapshot {
  key: AiModelKey
  capability: string
  provider: string
  description: string
  envVar: string | null
  resolvedDefault: string
  providerKeyConfigured: boolean
  orgConfigurable: boolean
}

export function AiSettingsClient({
  snapshot,
  orgSettings,
}: {
  snapshot: UseCaseSnapshot[]
  orgSettings: OrgAiModels
}) {
  const [settings, setSettings] = useState<OrgAiModels>(orgSettings)
  const [saveState, setSaveState] = useState<Record<string, 'saved' | 'error' | undefined>>({})
  const [pending, startTransition] = useTransition()

  const configurable = snapshot.filter((s) => s.orgConfigurable)
  const envManaged = snapshot.filter((s) => !s.orgConfigurable)

  const save = (key: AiModelKey, modelId: string, isDefault: boolean) => {
    startTransition(async () => {
      // Selecting the deployment default clears the org override (row deleted).
      const res = await setAiModelSetting(key, isDefault ? null : modelId)
      setSaveState((s) => ({ ...s, [key]: 'error' in res ? 'error' : 'saved' }))
      if (!('error' in res)) {
        setSettings((s) => {
          const next = { ...s }
          if (isDefault) delete next[key]
          else next[key] = modelId
          return next
        })
      }
    })
  }

  return (
    <div className="mt-6 space-y-8">
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--ink-500)]">
          Organisation overrides
        </h2>
        <p className="mt-1 text-xs text-[var(--ink-500)]">
          These apply to every document your organisation parses. Selecting the deployment default
          removes the override.
        </p>
        <div className="mt-3 space-y-4">
          {configurable.map((s) => (
            <div key={s.key} className="bg-white border border-[var(--ink-100)] rounded-xl p-4">
              <AiModelSelect
                useCase={s.key}
                value={settings[s.key] ?? s.resolvedDefault}
                onChange={(id) => save(s.key, id, id === s.resolvedDefault)}
                disabled={pending}
              />
              <div className="mt-2 flex items-center gap-2 text-[11px]">
                <span className="text-[var(--ink-400)]">{s.description}</span>
                {settings[s.key] && settings[s.key] !== s.resolvedDefault && (
                  <span className="text-amber-600 font-medium shrink-0">org override</span>
                )}
                {saveState[s.key] === 'saved' && <span className="text-green-600 shrink-0">✓ saved</span>}
                {saveState[s.key] === 'error' && <span className="text-red-500 shrink-0">save failed</span>}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--ink-500)]">
          Environment-managed
        </h2>
        <p className="mt-1 text-xs text-[var(--ink-500)]">
          Changed via deployment environment variables (Railway), not per organisation.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-[var(--ink-400)]">
                <th className="py-2 pr-3 font-medium">Use case</th>
                <th className="py-2 pr-3 font-medium">Model</th>
                <th className="py-2 pr-3 font-medium">Provider</th>
                <th className="py-2 font-medium">Override via</th>
              </tr>
            </thead>
            <tbody>
              {envManaged.map((s) => (
                <tr key={s.key} className="border-t border-[var(--ink-100)]">
                  <td className="py-2 pr-3 text-[var(--ink-900)]">{s.key}</td>
                  <td className="py-2 pr-3 font-mono text-xs text-[var(--ink-700)]">{s.resolvedDefault}</td>
                  <td className="py-2 pr-3 text-[var(--ink-700)]">
                    {s.provider}
                    {!s.providerKeyConfigured && (
                      <span className="ml-1 text-red-500 text-xs" title="Provider API key missing in this deployment">
                        ⚠ no key
                      </span>
                    )}
                  </td>
                  <td className="py-2 font-mono text-xs text-[var(--ink-500)]">{s.envVar ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
