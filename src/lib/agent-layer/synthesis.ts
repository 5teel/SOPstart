/**
 * Phase 26.5 D-03/D-04/D-05/D-12/D-16 — the synthesis pipeline.
 *
 * synthesizeSop(sopId, organisationId) embeds the whole published SOP via
 * Voyage, extracts tags/entities via Haiku (SYNTHESIS_MODEL), reads the four
 * signal sources (src/lib/agent-layer/signals.ts), writes free-append
 * agent_memory observations, derives a per-SOP assessment, raises
 * evidence-backed learning proposals where warranted, and upserts
 * sop_agent_metadata. triggerAgentSynthesis is the fire-and-forget wrapper
 * the publish route (Plan 26.5-05) calls.
 *
 * Each step below is independently try/caught (mirrors the ai-reviewer
 * orchestrator's per-job isolation, CLAUDE.md 2026-06-02) — one failing step
 * never blanks the whole run. Every write uses createAdminClient() with
 * organisation_id set explicitly (self-enforced — CLAUDE.md
 * 2026-06-15/2026-06-26). NEVER touches the editor's layout/autosave column
 * or path (D-01/D-04) — this pipeline only reads sections/steps/blocks to
 * build plain text and only writes to the agent_* tables.
 *
 * Pitfall 5 (2026-06-02 VERIFY_MODEL incident, same shape): a fire-and-forget
 * job that fails on every invocation is otherwise invisible. On any top-level
 * failure we log a distinct greppable "[agent-layer] synthesis failed" line
 * AND record last_synthesis_status='error' on sop_agent_metadata so an
 * all-failing state is observable from the dashboard, not just server logs.
 */
import { getVoyageClient } from './voyage-client'
import { EMBED_MODEL, SYNTHESIS_MODEL } from './model-constants'
import { getAnthropic } from '@/lib/parsers/verify-sop'
import { createAdminClient } from '@/lib/supabase/admin'
import { packSopForPrompt } from '@/lib/voice/sop-pack'
import { readAllSignals, type SignalBundle } from './signals'
import { createLearningProposal, appendMemory, type EvidenceRow } from '@/lib/ai-fields/agent-proposals'
import type { SopWithSections } from '@/types/sop'
import type { Json } from '@/types/database.types'

// Per-run cost guardrail (discretion, tunable): caps the number of evidence-
// backed proposals raised (and therefore the AI-adjacent write volume) in a
// single synthesis run, so one pass can't run away a per-org bill.
const MAX_PROPOSALS_PER_RUN = 3

type SynthesisSopRow = {
  id: string
  title: string
  version: number
  sop_sections: {
    id: string
    title: string
    content: string | null
    section_type: string
    sop_steps: { step_number: number; text: string; warning: string | null; caution: string | null }[]
    sop_section_blocks: { id: string; snapshot_content: unknown }[]
  }[]
}

/**
 * Load the published SOP's plain content (sections/steps/blocks) for one org.
 * Deliberately omits the editor's layout/autosave column — the synthesis
 * pipeline never reads or writes it (D-01/D-04).
 */
async function loadPublishedSop(
  sopId: string,
  organisationId: string,
): Promise<SynthesisSopRow | null> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('sops')
    .select(`
      id, title, version,
      sop_sections(
        id, title, content, section_type,
        sop_steps(step_number, text, warning, caution),
        sop_section_blocks(id, snapshot_content)
      )
    `)
    .eq('id', sopId)
    .eq('organisation_id', organisationId)
    .maybeSingle()
  if (error || !data) return null
  return data as unknown as SynthesisSopRow
}

/**
 * D-12: derive a per-SOP freshness assessment from the signal bundle.
 * Thresholds are directional/tunable (discretion) — not a locked spec.
 */
export function deriveAssessment(bundle: SignalBundle): 'fresh' | 'drifting' | 'needs-review' {
  const criticalFlags = bundle.reviewer.flagCountsBySeverity.critical
  const unverifiedRatio =
    bundle.verify.totalBlocks > 0 ? bundle.verify.unverifiedCount / bundle.verify.totalBlocks : 0

  if (criticalFlags > 0 || bundle.reviewer.allRunsErrored) return 'needs-review'
  if (unverifiedRatio > 0.3 || bundle.reviewer.flagCountsBySeverity.warning > 3) return 'drifting'
  return 'fresh'
}

/** Embed the whole SOP (unchunked — 32k context per D-03). Best-effort. */
async function embedSop(fullText: string): Promise<number[] | null> {
  if (!fullText.trim()) return null
  try {
    const result = await getVoyageClient().embed({
      input: fullText,
      model: EMBED_MODEL,
      inputType: 'document',
    })
    return result.data?.[0]?.embedding ?? null
  } catch (err) {
    console.error('[agent-layer] embed step failed:', err instanceof Error ? err.message : err)
    return null
  }
}

/** Semantic tags/entities/summary via Haiku (SYNTHESIS_MODEL, D-16). Best-effort. */
async function extractTagsAndEntities(
  fullText: string,
): Promise<{ summary: string | null; tags: string[]; entities: unknown[] }> {
  const empty = { summary: null, tags: [] as string[], entities: [] as unknown[] }
  if (!fullText.trim()) return empty
  try {
    const response = await getAnthropic().messages.create({
      model: SYNTHESIS_MODEL,
      max_tokens: 1024,
      system:
        'You extract structured metadata from a Standard Operating Procedure. ' +
        'Respond with JSON only, no prose, no markdown: ' +
        '{"summary": "one-sentence summary", "tags": ["short lowercase tags"], ' +
        '"entities": [{"type":"equipment|chemical|standard|location","name":"string"}]}',
      messages: [{ role: 'user', content: fullText }],
    })
    const block = response.content[0]
    const text = block && block.type === 'text' ? block.text : '{}'
    const cleaned = text.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim()
    const parsed = JSON.parse(cleaned) as { summary?: string; tags?: string[]; entities?: unknown[] }
    return {
      summary: parsed.summary ?? null,
      tags: parsed.tags ?? [],
      entities: parsed.entities ?? [],
    }
  } catch (err) {
    console.error(
      '[agent-layer] tag/entity extraction failed:',
      err instanceof Error ? err.message : err,
    )
    return empty
  }
}

/**
 * Embed each block's text into block_agent_metadata, keyed by the
 * sop_section_blocks junction id (D-02). Best-effort per plan — one bad
 * block never stops the run.
 */
async function embedBlocks(
  organisationId: string,
  sopId: string,
  sections: SynthesisSopRow['sop_sections'],
): Promise<void> {
  const admin = createAdminClient()
  for (const section of sections) {
    for (const block of section.sop_section_blocks ?? []) {
      try {
        const text = JSON.stringify(block.snapshot_content)
        if (!text.trim()) continue
        const result = await getVoyageClient().embed({
          input: text,
          model: EMBED_MODEL,
          inputType: 'document',
        })
        const embedding = result.data?.[0]?.embedding
        if (!embedding) continue
        const { error } = await admin.from('block_agent_metadata').upsert(
          {
            organisation_id: organisationId,
            block_id: block.id,
            sop_id: sopId,
            embedding: JSON.stringify(embedding),
            regenerated_at: new Date().toISOString(),
          },
          { onConflict: 'block_id' },
        )
        if (error) console.error('[agent-layer] block embed upsert failed:', error.message)
      } catch (err) {
        console.error('[agent-layer] block embed failed:', err instanceof Error ? err.message : err)
      }
    }
  }
}

/** D-05/D-08: append-only memory observations derived from the signal bundle. */
async function writeMemoryFromSignals(
  organisationId: string,
  sopId: string,
  bundle: SignalBundle,
): Promise<void> {
  try {
    if (bundle.reviewer.allRunsErrored) {
      await appendMemory(organisationId, {
        sopId,
        scope: 'sop',
        observation: 'All AI reviewer runs errored — synthesis input may be incomplete.',
        signalSource: 'reviewer',
        metadata: { flagCounts: bundle.reviewer.flagCountsBySeverity },
      })
    }
    if (bundle.verify.totalBlocks > 0 && bundle.verify.unverifiedCount > 0) {
      await appendMemory(organisationId, {
        sopId,
        scope: 'sop',
        observation: `${bundle.verify.unverifiedCount}/${bundle.verify.totalBlocks} blocks remain unverified.`,
        signalSource: 'verify',
        metadata: {
          unverifiedCount: bundle.verify.unverifiedCount,
          totalBlocks: bundle.verify.totalBlocks,
        },
      })
    }
    if (bundle.voice.totalQuestions > 0) {
      await appendMemory(organisationId, {
        sopId,
        scope: 'sop',
        observation: `${bundle.voice.totalQuestions} worker voice questions logged for this SOP.`,
        signalSource: 'voice',
        metadata: { recentQuestions: bundle.voice.recentQuestions },
      })
    }
    if (bundle.completions.totalCompletions > 0) {
      await appendMemory(organisationId, {
        sopId,
        scope: 'sop',
        observation: `${bundle.completions.totalCompletions} completions recorded.`,
        signalSource: 'completions',
        metadata: { stepAckCounts: bundle.completions.stepAckCounts },
      })
    }
  } catch (err) {
    console.error(
      '[agent-layer] memory write step failed:',
      err instanceof Error ? err.message : err,
    )
  }
}

/** D-07: raise evidence-backed proposals where a signal pattern justifies one. Always pending. */
async function raiseProposalsFromSignals(
  organisationId: string,
  sopId: string,
  bundle: SignalBundle,
): Promise<void> {
  let raised = 0
  try {
    if (bundle.reviewer.flagCountsBySeverity.critical > 0 && raised < MAX_PROPOSALS_PER_RUN) {
      const evidence: EvidenceRow[] = [
        {
          source: 'reviewer',
          count: bundle.reviewer.flagCountsBySeverity.critical,
          detail: 'critical reviewer flags recurring on this SOP',
        },
      ]
      await createLearningProposal(organisationId, sopId, {
        kind: 'reviewer-critical-flags',
        description: `${bundle.reviewer.flagCountsBySeverity.critical} critical reviewer flag(s) recurring — recommend admin review.`,
        evidence,
      })
      raised++
    }
    if (
      bundle.verify.totalBlocks > 0 &&
      bundle.verify.unverifiedCount / bundle.verify.totalBlocks > 0.5 &&
      raised < MAX_PROPOSALS_PER_RUN
    ) {
      const evidence: EvidenceRow[] = [
        {
          source: 'verify',
          count: bundle.verify.unverifiedCount,
          detail: `${bundle.verify.unverifiedCount}/${bundle.verify.totalBlocks} blocks unverified`,
        },
      ]
      await createLearningProposal(organisationId, sopId, {
        kind: 'majority-unverified-blocks',
        description: 'Over half of this SOP\'s blocks are unverified — recommend a verify pass.',
        evidence,
      })
      raised++
    }
  } catch (err) {
    console.error(
      '[agent-layer] proposal raise step failed:',
      err instanceof Error ? err.message : err,
    )
  }
}

/**
 * D-03/D-04/D-05/D-12 — synthesize the agent-metadata layer for one published
 * SOP. Fully additive: never touches the editor's layout/autosave column or path.
 */
export async function synthesizeSop(sopId: string, organisationId: string): Promise<void> {
  try {
    const admin = createAdminClient()
    const sop = await loadPublishedSop(sopId, organisationId)
    if (!sop) {
      console.error(
        `[agent-layer] synthesis failed: SOP ${sopId} not found in organisation ${organisationId}`,
      )
      return
    }

    const fullText = packSopForPrompt(sop as unknown as SopWithSections)

    const [embedding, tagResult, bundle] = await Promise.all([
      embedSop(fullText),
      extractTagsAndEntities(fullText),
      readAllSignals(organisationId, sopId),
    ])
    const { summary, tags, entities } = tagResult

    await embedBlocks(organisationId, sopId, sop.sop_sections)
    await writeMemoryFromSignals(organisationId, sopId, bundle)
    await raiseProposalsFromSignals(organisationId, sopId, bundle)

    const assessment = deriveAssessment(bundle)

    const { error } = await admin.from('sop_agent_metadata').upsert(
      {
        organisation_id: organisationId,
        sop_id: sopId,
        summary,
        tags,
        entities: entities as unknown as Json,
        embedding: embedding ? JSON.stringify(embedding) : null,
        assessment,
        links: [] as unknown as Json,
        last_synthesis_status: 'ok',
        last_synthesis_error: null,
        regenerated_at: new Date().toISOString(),
      },
      { onConflict: 'sop_id' },
    )
    if (error) throw new Error(error.message)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    // Pitfall 5 / CLAUDE.md 2026-06-02 — a distinct greppable line so an
    // all-failing synthesis run is observable, not silently swallowed.
    console.error('[agent-layer] synthesis failed:', message)
    try {
      await createAdminClient()
        .from('sop_agent_metadata')
        .upsert(
          {
            organisation_id: organisationId,
            sop_id: sopId,
            last_synthesis_status: 'error',
            last_synthesis_error: message.slice(0, 500),
          },
          { onConflict: 'sop_id' },
        )
    } catch (writeErr) {
      console.error('[agent-layer] failed to record synthesis error status:', writeErr)
    }
  }
}

/**
 * Fire-and-forget wrapper — callers (the publish route, Plan 26.5-05) never
 * await this and it never throws to the caller (Pitfall 5).
 */
export function triggerAgentSynthesis(sopId: string, organisationId: string): void {
  synthesizeSop(sopId, organisationId).catch((err) => {
    console.error('[agent-layer] synthesis trigger failed:', err instanceof Error ? err.message : err)
  })
}
