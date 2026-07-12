'use client'

/**
 * Phase 21 (Plan 21-03 Task 3) — Single reviewer-flag row.
 *
 * Compact horizontal layout per plan spec:
 *   [icon] [severity badge] [description text] [source-link icon]
 *
 * Colour by severity (critical red, warning amber); icon by kind. Click
 * fires the parent-supplied handler so the source viewer + builder canvas
 * jump to the right place (handled by `<ReviewerFlagsPanel>`).
 *
 * D-21-09 isolation — admin-only component, no static imports of pdfjs /
 * mammoth / any worker-side surface.
 */

import {
  AlertTriangle,
  EyeOff,
  Link2Off,
  Languages,
  TableProperties,
  ExternalLink,
} from 'lucide-react'
import type { ReviewerFlag, ReviewerFlagKind } from '@/lib/parsers/ai-reviewer'

export type FlagBadgeProps = {
  flag: ReviewerFlag
  onClick: (flag: ReviewerFlag) => void
}

/**
 * Phase 30 (30-07, UX-07) — plain-language flag titles (usability-lab R-C1).
 * UI-side mapping ONLY: the stored `kind` strings and the reviewer job
 * prompts are untouched. Flags name the human step/section (via
 * `source_location_hint`), never a raw block number.
 */
export const KIND_LABEL: Record<ReviewerFlagKind, string> = {
  hallucination: 'Made-up content',
  omission: 'Missing content',
  anchoring: 'Picture not linked to its step',
  table_fidelity: 'Table may be scrambled',
  terminology: 'Wording changed',
}

function kindIcon(kind: ReviewerFlagKind) {
  switch (kind) {
    case 'hallucination':
      return AlertTriangle
    case 'omission':
      return EyeOff
    case 'anchoring':
      return Link2Off
    case 'table_fidelity':
      return TableProperties
    case 'terminology':
      return Languages
    default:
      return AlertTriangle
  }
}

export function FlagBadge({ flag, onClick }: FlagBadgeProps): React.JSX.Element {
  const Icon = kindIcon(flag.kind)
  const isCritical = flag.severity === 'critical'
  const colourClasses = isCritical
    ? 'border-red-500/40 bg-red-500/10 text-red-300'
    : 'border-amber-500/40 bg-amber-500/10 text-amber-300'
  const plainTitle = KIND_LABEL[flag.kind] ?? flag.kind

  return (
    <button
      type="button"
      data-testid="reviewer-flag-badge"
      data-severity={flag.severity}
      data-kind={flag.kind}
      onClick={() => onClick(flag)}
      className={`flex w-full items-center gap-2 rounded border px-2 py-1.5 text-left text-xs transition-colors hover:bg-opacity-20 ${colourClasses}`}
      title={`${flag.severity.toUpperCase()} · ${plainTitle} · ${flag.source_location_hint ?? ''}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="font-mono text-[10px] uppercase tracking-wider opacity-80">
        {flag.severity}
      </span>
      <span className="shrink-0 font-semibold">{plainTitle}</span>
      <span className="flex-1 truncate opacity-90">{flag.description}</span>
      {flag.source_location_hint && (
        <span className="font-mono text-[10px] shrink-0 opacity-70">
          {flag.source_location_hint}
        </span>
      )}
      <ExternalLink className="h-3 w-3 shrink-0 opacity-60" aria-hidden="true" />
    </button>
  )
}
