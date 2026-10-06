import 'server-only'
/**
 * Phase 60 (60-10, D-12, A-09) -- the objective fields of the AI field interface.
 *
 * An agent reads every objective (objectives.all) and sets one (objective.<subject>)
 * through POST /api/ai-fields/write; there is no agent endpoint of its own.
 *
 * Every descriptor calls the plain objectives core, which re-reads the session and
 * allows only an admin or safety manager, so the agent has exactly a person's
 * reach. The SOP id travels as subjectId, never sopId, so the published-SOP gate
 * does not divert an objective to a proposal. The write lands as set by the named
 * agent and unconfirmed. applyAiWrite logs it once as an AI field write naming the
 * agent; the core writes no ledger row.
 */
import { z } from 'zod'
import { registerField, type WriteResult } from '@/lib/ai-fields/registry'
import type { FieldContext } from '@/lib/validators/ai-fields'
import { DEFAULT_AGENT_NAME } from '@/lib/decisions/shape'
import { listObjectivesCore, readObjectiveCore, setObjectiveCore, type SubjectIn } from '@/lib/objectives/core'
import { OBJECTIVE_SUBJECTS, type ObjectiveSubject, type ObjectiveView } from '@/lib/objectives/model'

const ObjectiveValueSchema = z.union([
  z.string().transform((text) => ({ text, dueOn: null as string | null })),
  z.object({ text: z.string(), dueOn: z.string().nullable().optional() }).strict(),
])

const subjectOf = (type: ObjectiveSubject, ctx: FieldContext, who: string): SubjectIn => {
  if (type === 'site') return { type, id: null }
  if (!ctx.subjectId) throw new Error(`${who}: context.subjectId is required`)
  return { type, id: ctx.subjectId }
}

for (const type of OBJECTIVE_SUBJECTS) {
  const id = `objective.${type}`
  registerField<ObjectiveView | null>({
    id,
    label: `Objective (${type})`,
    stakeLevel: 'low',
    read: async (ctx) => {
      const found = await readObjectiveCore(subjectOf(type, ctx, `${id}.read`))
      if (found && 'error' in found) throw new Error(`${id}.read failed: ${found.error}`)
      return found
    },
    // the write value is untrusted input, validated here
    write: async (ctx, newValue: unknown): Promise<WriteResult> => {
      const value = ObjectiveValueSchema.safeParse(newValue)
      if (!value.success) throw new Error(`${id}.write: expected a text or { text, dueOn }`)
      const result = await setObjectiveCore(
        { subject: subjectOf(type, ctx, `${id}.write`), text: value.data.text, dueOn: value.data.dueOn ?? null },
        { agent: ctx.agentName ?? DEFAULT_AGENT_NAME },
      )
      if ('error' in result) throw new Error(`${id}.write failed: ${result.error}`)
      return { outcome: 'applied', value: { text: result.text, dueOn: result.dueOn } }
    },
  })
}

// Read-only: no write, so an agent cannot set several at once.
registerField<ObjectiveView[]>({
  id: 'objectives.all',
  label: 'Objectives',
  stakeLevel: 'low',
  read: async () => {
    const list = await listObjectivesCore()
    if ('error' in list) throw new Error(`objectives.all.read failed: ${list.error}`)
    return list.rows
  },
})
