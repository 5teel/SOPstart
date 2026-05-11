'use client'

import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  ShieldCheck,
  ListChecks,
  Siren,
  CheckCircle2,
  FileText,
  Sparkles,
} from 'lucide-react'
import type { SectionKind } from '@/types/sop'
import { listSectionKinds } from '@/actions/sections'

// Map lucide icon names (stored in section_kinds.icon) to components. The
// 7 canonical seeds use these icons; custom org kinds without a matching
// icon name fall back to <Sparkles />.
const ICON_MAP: Record<string, React.ElementType> = {
  AlertTriangle,
  ShieldCheck,
  ListChecks,
  Siren,
  CheckCircle2,
  FileText,
  Sparkles,
}

interface SectionKindPickerProps {
  onSubmit: (input: { sectionKindId: string; title: string }) => Promise<void>
  onCancel: () => void
}

export function SectionKindPicker({ onSubmit, onCancel }: SectionKindPickerProps) {
  const [kinds, setKinds] = useState<SectionKind[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedKindId, setSelectedKindId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    listSectionKinds()
      .then((data) => {
        if (mounted) {
          setKinds(data)
          setLoading(false)
        }
      })
      .catch((e: unknown) => {
        if (mounted) {
          setError(e instanceof Error ? e.message : 'Failed to load section kinds')
          setLoading(false)
        }
      })
    return () => {
      mounted = false
    }
  }, [])

  const selectedKind = kinds.find((k) => k.id === selectedKindId) ?? null

  const handleSelect = (kindId: string) => {
    setSelectedKindId(kindId)
    const k = kinds.find((x) => x.id === kindId)
    // Prefill title from display_name for canonical kinds; leave empty for
    // custom so the admin is forced to type something specific.
    if (k) {
      if (k.slug === 'custom') {
        setTitle('')
      } else if (!title) {
        setTitle(k.display_name)
      }
    }
  }

  const handleSubmit = async () => {
    if (!selectedKindId || !title.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit({ sectionKindId: selectedKindId, title: title.trim() })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to add section')
    } finally {
      setSubmitting(false)
    }
  }

  // Group kinds: globals first (organisation_id === null), then own-org custom.
  const globals = kinds.filter((k) => k.organisation_id === null)
  const orgCustom = kinds.filter((k) => k.organisation_id !== null)

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-[var(--ink-500)]">
        Pick a kind for this section. You can add multiple sections of the same kind —
        e.g. two &ldquo;Hazards&rdquo; sections scoped to different machine states.
      </p>

      {loading && <p className="text-sm text-[var(--ink-500)]">Loading kinds…</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {!loading && (
        <>
          <div className="grid grid-cols-2 gap-2">
            {globals.map((k) => {
              const Icon = k.icon ? ICON_MAP[k.icon] ?? Sparkles : Sparkles
              const isSelected = k.id === selectedKindId
              return (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => handleSelect(k.id)}
                  className={[
                    'flex items-center gap-2 px-3 py-2 rounded-lg border text-left',
                    'min-h-[72px] transition-colors',
                    isSelected
                      ? 'border-[var(--ink-900)] bg-[var(--ink-900)]/10 text-[var(--ink-900)]'
                      : 'border-[var(--ink-100)] bg-white text-[var(--ink-900)] hover:bg-[var(--paper-2)]',
                  ].join(' ')}
                >
                  <Icon size={18} />
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold">{k.display_name}</span>
                    {k.description && (
                      <span className="text-xs text-[var(--ink-500)] line-clamp-2">
                        {k.description}
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>

          {orgCustom.length > 0 && (
            <>
              <div className="text-xs uppercase tracking-wide text-[var(--ink-500)] mt-2">
                Your organisation
              </div>
              <div className="grid grid-cols-2 gap-2">
                {orgCustom.map((k) => {
                  const isSelected = k.id === selectedKindId
                  return (
                    <button
                      key={k.id}
                      type="button"
                      onClick={() => handleSelect(k.id)}
                      className={[
                        'flex items-center gap-2 px-3 py-2 rounded-lg border text-left min-h-[72px]',
                        isSelected
                          ? 'border-[var(--ink-900)] bg-[var(--ink-900)]/10 text-[var(--ink-900)]'
                          : 'border-[var(--ink-100)] bg-white text-[var(--ink-900)] hover:bg-[var(--paper-2)]',
                      ].join(' ')}
                    >
                      <span className="text-sm font-semibold">{k.display_name}</span>
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {selectedKind && (
            <label className="flex flex-col gap-1">
              <span className="text-sm font-semibold text-[var(--ink-900)]">Section title</span>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={120}
                placeholder={
                  selectedKind.slug === 'custom'
                    ? 'e.g. Pre-flight check'
                    : selectedKind.display_name
                }
                className="bg-[var(--paper)] border border-[var(--ink-100)] rounded-lg px-3 py-2 text-base text-[var(--ink-900)] focus:outline-none focus:ring-2 focus:ring-[var(--ink-900)]/50"
              />
            </label>
          )}
        </>
      )}

      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!selectedKindId || !title.trim() || submitting || loading}
          className="h-[72px] px-5 bg-[var(--ink-900)] text-white font-bold rounded-lg hover:bg-[var(--ink-700)] text-sm disabled:opacity-60"
        >
          {submitting ? 'Adding…' : 'Add section'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="h-[72px] px-5 bg-[var(--paper-2)] text-[var(--ink-900)] font-semibold rounded-lg hover:bg-[var(--paper-2)] text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
