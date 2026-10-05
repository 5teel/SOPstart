/**
 * Phase 15 — SOP serializer for the agent-layer synthesis prompt (moved from
 * lib/voice in Phase 55 when voice Q&A was cut). Phase 58 repointed it from the
 * old step/block tables onto focus steps (hazard / ppe / step / check).
 *
 * ⚠️  LOAD-BEARING CONSTANT — DO NOT MODIFY WITHOUT UNDERSTANDING PROMPT CACHE.
 *
 * Pitfall 3 (cache key drift): byte-identical output → same Anthropic prompt-cache hit.
 * Any whitespace / field-order / formatting change here invalidates the cache and
 * costs 10x per question.
 *
 * Unit-tested for byte-identical output in tests/phase55/sop-pack.spec.ts.
 */
export type PackStep = {
  kind: 'hazard' | 'ppe' | 'step' | 'check'
  text: string
  tip: string | null
}

export type PackableSop = {
  title: string | null
  version: number
  sop_sections: Array<{
    title: string
    section_type: string
    content: string | null
    focus_steps: PackStep[]
  }>
}

const KIND_LABEL = { hazard: 'HAZARD', ppe: 'PPE', check: 'CHECK' } as const

export function packSopForPrompt(sop: PackableSop): string {
  const lines = [`SOP TITLE: ${sop.title}`, `SOP VERSION: ${sop.version}`, '']
  for (const sec of sop.sop_sections) {
    lines.push(`## ${sec.title} [type=${sec.section_type}]`)
    if (sec.content) lines.push(sec.content)
    let n = 0
    for (const step of sec.focus_steps) {
      if (step.kind === 'step') lines.push(`  Step ${++n}: ${step.text}`)
      else lines.push(`  ${KIND_LABEL[step.kind]}: ${step.text}`)
      if (step.tip) lines.push(`    TIP: ${step.tip}`)
    }
    lines.push('')
  }
  return lines.join('\n')
}
