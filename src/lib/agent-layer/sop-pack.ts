import type { SopWithSections } from '@/types/sop'

/**
 * Phase 15 — SOP serializer for the agent-layer synthesis prompt (moved from
 * lib/voice in Phase 55 when voice Q&A was cut).
 *
 * ⚠️  LOAD-BEARING CONSTANT — DO NOT MODIFY WITHOUT UNDERSTANDING PROMPT CACHE.
 *
 * Pitfall 3 (cache key drift): byte-identical output → same Anthropic prompt-cache hit.
 * Any whitespace / field-order / formatting change here invalidates the cache and
 * costs 10x per question. 
 *
 * Unit-tested for byte-identical output in tests/phase55/sop-pack.spec.ts.
 */
export function packSopForPrompt(sop: SopWithSections): string {
  const lines = [`SOP TITLE: ${sop.title}`, `SOP VERSION: ${sop.version}`, '']
  for (const sec of sop.sop_sections) {
    lines.push(`## ${sec.title} [type=${sec.section_type}]`)
    if (sec.content) lines.push(sec.content)
    for (const step of sec.sop_steps ?? []) {
      lines.push(`  Step ${step.step_number}: ${step.text}`)
      if (step.warning) lines.push(`    WARNING: ${step.warning}`)
      if (step.caution) lines.push(`    CAUTION: ${step.caution}`)
    }
    const blocks =
      (sec as unknown as { sop_section_blocks?: Array<{ snapshot_content: unknown }> })
        .sop_section_blocks ?? []
    for (const block of blocks) {
      lines.push(`  Block: ${JSON.stringify(block.snapshot_content)}`)
    }
    lines.push('')
  }
  return lines.join('\n')
}
