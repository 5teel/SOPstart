import type { SopWithSections } from '@/types/sop'

/**
 * Phase 15 — Shared SOP serializer used by BOTH the answer call (voice-qa.ts)
 * AND the verifier call (verify-sop.ts mode: 'voice_qa').
 *
 * ⚠️  LOAD-BEARING CONSTANT — DO NOT MODIFY WITHOUT UNDERSTANDING PROMPT CACHE.
 *
 * Pitfall 3 (cache key drift): byte-identical output → same Anthropic prompt-cache hit.
 * Any whitespace / field-order / formatting change here invalidates the cache and
 * costs 10x per question. Both the answer call's cache_control breakpoint AND the
 * verifier call's cache_control breakpoint reference THIS function's output. If
 * two callers serialise the SOP differently above the breakpoint, the verifier
 * call becomes a cache miss → cost regression.
 *
 * Unit-tested for byte-identical output across calls in voice-qa-cache.test.ts.
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
