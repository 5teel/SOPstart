/**
 * Phase 13 plan 13-04 — pure text-level diff for two BlockContent variants.
 *
 * Per 13-CONTEXT Deferred Ideas, v1 is simple side-by-side text comparison.
 * Rich diff (per-prop, hunk-level) is deferred to a later phase.
 *
 * Strategy: switch on the discriminator and emit ALL text-bearing fields
 * (not just changed ones) so the modal can render the full block side-by-side.
 * `changed: true` flags any actual diff at all; `kindChanged: true` flags the
 * (rare) case where the discriminator itself changed.
 *
 * Pure / deterministic. No DB, no React, easily unit-testable.
 */

import type { BlockContent } from '@/types/sop'

export type BlockContentDiffField = {
  key: string
  oldValue: string
  newValue: string
}

export type BlockContentDiff = {
  changed: boolean
  /** true when oldContent.kind !== newContent.kind (rare; e.g. content shape was migrated) */
  kindChanged: boolean
  fields: BlockContentDiffField[]
}

// Stringify-with-fallback for JSON-bearing leaf values (tolerance objects, etc.)
function asJson(value: unknown): string {
  if (value === undefined || value === null) return ''
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function emitFields(content: BlockContent): BlockContentDiffField[] {
  const out: BlockContentDiffField[] = []
  switch (content.kind) {
    case 'hazard':
      out.push({ key: 'text', oldValue: content.text, newValue: '' })
      out.push({ key: 'severity', oldValue: content.severity, newValue: '' })
      break
    case 'ppe':
      out.push({ key: 'items', oldValue: (content.items ?? []).join('\n'), newValue: '' })
      break
    case 'step':
      out.push({ key: 'text', oldValue: content.text, newValue: '' })
      out.push({ key: 'warning', oldValue: content.warning ?? '', newValue: '' })
      out.push({ key: 'tip', oldValue: content.tip ?? '', newValue: '' })
      break
    case 'emergency':
      out.push({ key: 'text', oldValue: content.text, newValue: '' })
      out.push({
        key: 'contacts',
        oldValue: (content.contacts ?? []).join(', '),
        newValue: '',
      })
      break
    case 'measurement':
      out.push({ key: 'label', oldValue: content.label, newValue: '' })
      out.push({ key: 'unit', oldValue: content.unit, newValue: '' })
      out.push({ key: 'tolerance', oldValue: asJson(content.tolerance), newValue: '' })
      out.push({
        key: 'voiceEnabled',
        oldValue: String(content.voiceEnabled ?? false),
        newValue: '',
      })
      out.push({ key: 'hint', oldValue: content.hint ?? '', newValue: '' })
      break
    case 'decision':
      out.push({ key: 'question', oldValue: content.question, newValue: '' })
      out.push({
        key: 'options',
        oldValue: (content.options ?? [])
          .map((o) => o.label + (o.isEscalation ? ' (escalation)' : ''))
          .join('\n'),
        newValue: '',
      })
      break
    case 'escalate':
      out.push({ key: 'title', oldValue: content.title, newValue: '' })
      out.push({ key: 'reason', oldValue: content.reason ?? '', newValue: '' })
      out.push({
        key: 'escalationMode',
        oldValue: content.escalationMode ?? 'form',
        newValue: '',
      })
      out.push({
        key: 'recipients',
        oldValue: (content.recipients ?? []).join(', '),
        newValue: '',
      })
      break
    case 'signoff':
      out.push({ key: 'title', oldValue: content.title, newValue: '' })
      out.push({
        key: 'requiredRole',
        oldValue: content.requiredRole ?? 'supervisor',
        newValue: '',
      })
      out.push({
        key: 'acknowledgementText',
        oldValue: content.acknowledgementText ?? '',
        newValue: '',
      })
      break
    case 'zone':
      out.push({ key: 'label', oldValue: content.label, newValue: '' })
      out.push({ key: 'zoneType', oldValue: content.zoneType, newValue: '' })
      out.push({ key: 'notes', oldValue: content.notes ?? '', newValue: '' })
      break
    case 'inspect':
      out.push({ key: 'title', oldValue: content.title, newValue: '' })
      out.push({
        key: 'items',
        oldValue: (content.items ?? [])
          .map((i) => i.label + (i.requirePhoto ? ' [photo]' : ''))
          .join('\n'),
        newValue: '',
      })
      break
    case 'voice-note':
      out.push({ key: 'prompt', oldValue: content.prompt, newValue: '' })
      out.push({
        key: 'language',
        oldValue: content.language ?? 'en-NZ',
        newValue: '',
      })
      out.push({
        key: 'maxDurationSec',
        oldValue: String(content.maxDurationSec ?? 60),
        newValue: '',
      })
      break
    case 'custom':
      out.push({ key: 'data', oldValue: asJson(content.data), newValue: '' })
      break
    default: {
      // Exhaustiveness guard — if a new BlockContent variant is added without
      // updating this switch, TypeScript will surface it here.
      const _exhaustive: never = content
      void _exhaustive
      break
    }
  }
  return out
}

export function diffBlockContent(
  oldContent: BlockContent,
  newContent: BlockContent
): BlockContentDiff {
  // Kind mismatch is its own diff signal.
  if (oldContent.kind !== newContent.kind) {
    return {
      changed: true,
      kindChanged: true,
      fields: [
        {
          key: '__kind__',
          oldValue: oldContent.kind,
          newValue: newContent.kind,
        },
      ],
    }
  }

  const oldFields = emitFields(oldContent)
  const newFields = emitFields(newContent)

  // Both arrays share the same key sequence because they share the same kind.
  // Pair them positionally and compare.
  const fields: BlockContentDiffField[] = []
  let changed = false
  for (let i = 0; i < oldFields.length; i++) {
    const o = oldFields[i]
    const n = newFields[i] ?? { key: o.key, oldValue: '', newValue: '' }
    const oldValue = o.oldValue
    const newValue = n.oldValue // emitFields populates oldValue position
    if (oldValue !== newValue) changed = true
    fields.push({ key: o.key, oldValue, newValue })
  }

  return { changed, kindChanged: false, fields }
}
