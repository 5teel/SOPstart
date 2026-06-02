/**
 * Phase 21.5 (Plan 21.5-01) — Humanized block-type label map.
 *
 * ADMIN-ONLY: This module is consumed only by admin builder routes.
 * Do NOT import from worker routes (D-21-09 isolation requirement).
 *
 * Exports:
 *   - BLOCK_TYPE_LABELS  — const map keyed by 14 internal block-type
 *     identifiers (PascalCase) + legacy 'PhotoGrid' alias.
 *     Each value: { label: string; pillVariant: string }
 *   - humanizeBlockType(type)  — lookup function that returns a human label
 *     for any input; falls back to 'Block' for unknown/empty input.
 *     R4 invariant: NEVER echoes a raw value ending in 'Block' or containing 'Grid'.
 *
 * Sources:
 *   - 21.5-UI-SPEC.md § "Humanized Type Label Mapping" (14-row table)
 *   - SPEC R4 acceptance text (PhotoGrid alias named explicitly)
 *   - SPEC R4/R5 — no internal symbol names visible to admin
 */

export type BlockTypeEntry = {
  /** Human-readable label shown in the UI, e.g. "Step", "Hazard" */
  label: string
  /**
   * Kind pill variant CSS class suffix consumed by NavRow in Plan 04.
   * One of: kind-step | kind-haz | kind-meas | kind-ins | kind-dec | kind-esc | kind-sign
   */
  pillVariant: string
}

/**
 * Authoritative map from internal block-type identifiers → human UI labels.
 * Keys are PascalCase component names OR the legacy PhotoGrid alias.
 * Source: 21.5-UI-SPEC.md "Humanized Type Label Mapping" table.
 */
export const BLOCK_TYPE_LABELS: Readonly<Record<string, BlockTypeEntry>> = {
  StepBlock: { label: 'Step', pillVariant: 'kind-step' },
  HazardCardBlock: { label: 'Hazard', pillVariant: 'kind-haz' },
  MeasurementBlock: { label: 'Measure', pillVariant: 'kind-meas' },
  InspectBlock: { label: 'Inspect', pillVariant: 'kind-ins' },
  DecisionBlock: { label: 'Decision', pillVariant: 'kind-dec' },
  EscalateBlock: { label: 'Escalate', pillVariant: 'kind-esc' },
  SignOffBlock: { label: 'Sign-off', pillVariant: 'kind-sign' },
  PhotoBlock: { label: 'Photo', pillVariant: 'kind-step' },
  TextBlock: { label: 'Text', pillVariant: 'kind-step' },
  HeadingBlock: { label: 'Heading', pillVariant: 'kind-step' },
  CalloutBlock: { label: 'Callout', pillVariant: 'kind-step' },
  PPECardBlock: { label: 'PPE', pillVariant: 'kind-haz' },
  VoiceNoteBlock: { label: 'Voice note', pillVariant: 'kind-step' },
  ZoneBlock: { label: 'Zone', pillVariant: 'kind-step' },
  // Legacy alias — named explicitly in SPEC R4 acceptance text
  PhotoGrid: { label: 'Photo grid', pillVariant: 'kind-step' },
} as const

/**
 * Snapshot `kind` slug → PascalCase block-type key lookup.
 * Allows lowercase slugs from the DB snapshot (e.g. 'step', 'hazard',
 * 'measurement') to resolve to their human label. Keys are lowercase slugs;
 * values are keys in BLOCK_TYPE_LABELS.
 */
const SLUG_TO_KEY: Readonly<Record<string, string>> = {
  step: 'StepBlock',
  hazard: 'HazardCardBlock',
  hazardcard: 'HazardCardBlock',
  measurement: 'MeasurementBlock',
  inspect: 'InspectBlock',
  decision: 'DecisionBlock',
  escalate: 'EscalateBlock',
  signoff: 'SignOffBlock',
  photo: 'PhotoBlock',
  text: 'TextBlock',
  heading: 'HeadingBlock',
  callout: 'CalloutBlock',
  ppe: 'PPECardBlock',
  ppecard: 'PPECardBlock',
  voicenote: 'VoiceNoteBlock',
  zone: 'ZoneBlock',
  photogrid: 'PhotoGrid',
} as const

/** Safe fallback returned for any unrecognised or empty input (R4 invariant). */
const FALLBACK_LABEL = 'Block'

/**
 * Returns the human-readable label for a block type identifier.
 *
 * Resolution order:
 *   1. Exact match in BLOCK_TYPE_LABELS (PascalCase keys + PhotoGrid alias)
 *   2. Case-insensitive leading-token match via SLUG_TO_KEY (snapshot kind slugs)
 *   3. Fallback: 'Block' (never echoes raw input ending in 'Block' or containing 'Grid')
 *
 * @param type  The raw block type string from the DB snapshot `kind` field or
 *              the Puck component type name.
 * @returns     A human label safe to render in the admin UI.
 */
export function humanizeBlockType(type: string): string {
  if (!type || typeof type !== 'string') return FALLBACK_LABEL

  const trimmed = type.trim()
  if (!trimmed) return FALLBACK_LABEL

  // 1. Exact match (handles PascalCase keys and the PhotoGrid alias as-is)
  const exact = BLOCK_TYPE_LABELS[trimmed]
  if (exact) return exact.label

  // 2. Case-insensitive slug match — strip whitespace and lowercase
  const slug = trimmed.toLowerCase().replace(/\s+/g, '')
  const slugKey = SLUG_TO_KEY[slug]
  if (slugKey) {
    const entry = BLOCK_TYPE_LABELS[slugKey]
    if (entry) return entry.label
  }

  // 3. Safe fallback — R4 invariant: never echo raw input ending in 'Block' or
  //    containing 'Grid'. Return the literal string 'Block' (a safe, non-leaking
  //    word that communicates "this is some kind of block" without exposing
  //    internal naming conventions).
  return FALLBACK_LABEL
}
