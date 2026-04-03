'use client'

import { useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'
import type { VerificationFlag } from '@/types/sop'

interface AdversarialFlagBannerProps {
  flags: VerificationFlag[]
  onUnresolvedCountChange?: (count: number) => void  // Callback for publish gate
}

export default function AdversarialFlagBanner({ flags, onUnresolvedCountChange }: AdversarialFlagBannerProps) {
  const [expanded, setExpanded] = useState(false)
  const [resolvedFlags, setResolvedFlags] = useState<Set<number>>(new Set())
  const [dismissed, setDismissed] = useState(false)

  // Filter to only adversarial flags (exclude missing-section flags which have their own banner)
  const adversarialFlags = flags.filter(
    (f) =>
      !(
        (f.section_title === 'Hazards' || f.section_title === 'PPE') &&
        f.original_text === '(not found in transcript)'
      )
  )

  if (adversarialFlags.length === 0 || dismissed) return null

  function handleResolveFlag(index: number) {
    setResolvedFlags((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      // Count unresolved critical flags
      const unresolvedCritical = adversarialFlags.filter(
        (f, i) => f.severity === 'critical' && !next.has(i)
      ).length
      onUnresolvedCountChange?.(unresolvedCritical)
      return next
    })
  }

  return (
    <div className="bg-brand-orange/20 border border-brand-orange/50 rounded-lg px-4 py-3 mb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle size={16} className="text-brand-orange shrink-0" />
          <span className="text-sm font-semibold text-brand-orange">
            AI verification found {adversarialFlags.length} potential issue{adversarialFlags.length !== 1 ? 's' : ''} — review before publishing.
          </span>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          aria-label={expanded ? 'Collapse verification flags' : 'Expand verification flags'}
          className="text-steel-400 hover:text-steel-100 p-1"
        >
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {expanded && (
        <div className="mt-3 space-y-1">
          {adversarialFlags.map((flag, i) => (
            <div key={i} className="text-xs text-steel-100 py-1">
              <span className="font-semibold">
                {flag.section_title}{flag.step_number ? ` (step ${flag.step_number})` : ''}
                {flag.severity === 'critical' && (
                  <span className="ml-1 text-red-400">[critical]</span>
                )}
              </span>
              {' — '}{flag.description}
            </div>
          ))}
        </div>
      )}

      {expanded && (
        <div className="flex flex-wrap gap-2 mt-3">
          {adversarialFlags.map((flag, i) => (
            <button
              key={i}
              onClick={() => handleResolveFlag(i)}
              className={`text-xs px-2 py-1 rounded ${
                resolvedFlags.has(i)
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-steel-700 text-steel-400 hover:text-steel-100'
              }`}
            >
              {resolvedFlags.has(i) ? 'Resolved' : `Confirm #${i + 1}`}
            </button>
          ))}
          <button
            onClick={() => setDismissed(true)}
            className="text-xs px-2 py-1 rounded bg-steel-700 text-steel-400 hover:text-steel-100 ml-auto"
          >
            Dismiss all
          </button>
        </div>
      )}
    </div>
  )
}
