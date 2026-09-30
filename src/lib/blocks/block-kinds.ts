/**
 * Shared kind vocabulary for the Content Library — filter chips on
 * /admin/blocks and the create form at /admin/blocks/new both read this one
 * list so they cannot drift (CLAUDE.md 2026-09-27, D-03).
 *
 * Plain, client-safe module (only a type-only import). Each seed's `.kind`
 * equals its own slug, because section-blocks-core.ts rejects a block whose
 * content kind differs from its kind_slug ("Block kind/content mismatch").
 */
import type { BlockContent } from '@/lib/validators/blocks'

export const BLOCK_KINDS = [
  {
    value: 'hazard',
    label: 'Hazard',
    hint: 'Describe the hazard. It starts at warning severity — change it in the editor.',
  },
  {
    value: 'ppe',
    label: 'PPE',
    hint: 'One item per line.',
  },
  {
    value: 'step',
    label: 'Step',
    hint: 'The instruction the worker follows.',
  },
  {
    value: 'emergency',
    label: 'Emergency',
    hint: 'What to do in an emergency.',
  },
  {
    value: 'custom',
    label: 'Custom',
    hint: 'Free text.',
  },
] as const

export type BlockKindSlug = (typeof BLOCK_KINDS)[number]['value']

/** Builds schema-valid BlockContent for a kind from a single text field. */
export function seedBlockContent(kind: BlockKindSlug, text: string): BlockContent {
  const t = text.trim()
  switch (kind) {
    case 'hazard':
      // ponytail: severity starts at warning; the editor's JSON sets critical or notice.
      return { kind: 'hazard', text: t, severity: 'warning' }
    case 'ppe':
      return {
        kind: 'ppe',
        items: t
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line.length > 0),
      }
    case 'step':
      return { kind: 'step', text: t }
    case 'emergency':
      return { kind: 'emergency', text: t }
    case 'custom':
      return { kind: 'custom', data: { text: t } }
  }
}
