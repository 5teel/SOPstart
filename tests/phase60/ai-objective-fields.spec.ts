/**
 * Phase 60 -- AI objective fields (60-10).
 * Requirements: OBJ-03. Decisions: D-12, A-09, F-09, F-10.
 * Source-contract cases on comment-stripped source, plus the context schema run for real.
 * Registration: playwright.config.ts `phase60` project.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { FieldContextSchema, AiWriteRequestSchema } from '@/lib/validators/ai-fields'

const root = path.resolve(__dirname, '..', '..')
const read = (rel: string) => fs.readFileSync(path.join(root, rel), 'utf-8').replace(/\r\n/g, '\n')
const strip = (src: string) => src.split('\n').map((l) => (/^\s*(\/\/|\/\*|\*\/|\*)/.test(l) ? '' : l)).join('\n')

const DESCRIPTORS = strip(read('src/lib/ai-fields/registrations/objectives.ts'))
const BARREL = strip(read('src/lib/ai-fields/registrations/index.ts'))
const ACTION = strip(read('src/actions/ai-fields.ts'))
const SIGNALS = strip(read('src/lib/agent-layer/signals.ts'))
const SYNTHESIS = strip(read('src/lib/agent-layer/synthesis.ts'))
const body = (src: string, name: string) => {
  const start = src.indexOf(`export async function ${name}`)
  const next = src.indexOf('\nexport async function ', start + 1)
  return src.slice(start, next === -1 ? undefined : next)
}

const ID = '11111111-1111-4111-8111-111111111111'
const ORG = '22222222-2222-4222-8222-222222222222'

test.describe('AI objective fields (60-10)', () => {
  test('descriptors objective.site/department/machine/sop/person and read-only objectives.all are registered, low stake, via the barrel', () => {
    expect(DESCRIPTORS).toContain('for (const type of OBJECTIVE_SUBJECTS)')
    expect(DESCRIPTORS).toContain('const id = `objective.${type}`')
    expect(DESCRIPTORS).toMatch(/stakeLevel: 'low'/)
    const all = DESCRIPTORS.slice(DESCRIPTORS.indexOf("id: 'objectives.all'"))
    expect(all).toContain('listObjectivesCore()')
    expect(all).not.toMatch(/\bwrite\b/) // read-only
    expect(BARREL).toContain("import '@/lib/ai-fields/registrations/objectives'")
    expect(read('src/lib/objectives/model.ts')).toMatch(/OBJECTIVE_SUBJECTS = \['site', 'department', 'machine', 'sop', 'person'\]/)
  })

  test('FieldContext carries subjectId and agentName, and acceptProposal passes both on', () => {
    expect(FieldContextSchema.safeParse({ organisationId: ORG, subjectId: ID, agentName: 'SOPstart assistant' }).success).toBe(true)
    expect(FieldContextSchema.safeParse({ organisationId: ORG, subjectId: 'nope' }).success).toBe(false)
    expect(FieldContextSchema.safeParse({ organisationId: ORG, agentName: 'someone else' }).success).toBe(false)
    expect(AiWriteRequestSchema.safeParse({ fieldId: 'objective.site', context: { organisationId: ORG }, newValue: 'x' }).success).toBe(true)
    const accept = body(ACTION, 'acceptProposal')
    expect(accept).toContain("subjectId: ctx['subjectId']")
    expect(accept).toContain("agentName: ctx['agentName']")
  })

  test('applyAiWrite overwrites any context agentName with the validated top-level one, and logs the subject id', () => {
    const apply = body(ACTION, 'applyAiWrite')
    expect(apply).toContain('const agentName = parsed.data.agentName ?? DEFAULT_AGENT_NAME')
    expect(apply).toMatch(/safeContext = \{ \.\.\.context, organisationId, sopIsPublished: serverSopIsPublished, agentName \}/)
    expect(apply).toContain('context.subjectId ?? context.sectionId ?? context.sopId')
    expect(apply).toContain('agent: agentName')
    // one ledger row for an applied write
    expect(apply.match(/recordDecision\(/g)?.length).toBe(1)
    // WR-05: the row is keyed to the SOP when the resolved subject is one, carries the subject,
    // and names the session user because the actor column holds the agent
    expect(apply).toContain("sopId: serverSopId ?? (landed?.type === 'sop' ? landed.id : null)")
    expect(apply).toContain('session_user_id: userId')
    expect(apply).toContain('subject_type: landed.type, subject_id: landed.id')
    expect(DESCRIPTORS).toContain("return { outcome: 'applied', value: { text: result.text, dueOn: result.dueOn }, subject: result.subject }")
  })

  test('an agent write lands unconfirmed under the agent name, logged once, not diverted to a proposal', () => {
    // the core is called with the agent setter taken from the context, never from the value
    expect(DESCRIPTORS).toMatch(/\{ agent: ctx\.agentName \?\? DEFAULT_AGENT_NAME \}/)
    // the SOP id travels as subjectId; the published-SOP lookup in applyAiWrite keys on context.sopId only
    expect(DESCRIPTORS).not.toMatch(/sopId/)
    expect(body(ACTION, 'applyAiWrite')).toContain('if (context.sopId)')
    // the core writes no ledger row, so the agent path is exactly one row (ai_field_write)
    expect(strip(read('src/lib/objectives/core.ts'))).not.toMatch(/recordDecision/)
    expect(DESCRIPTORS).not.toMatch(/recordDecision/)
    // a missing subject is refused; the value is validated
    expect(DESCRIPTORS).toContain('context.subjectId is required')
    expect(DESCRIPTORS).toContain('ObjectiveValueSchema.safeParse(newValue)')
  })

  test('the role is re-checked inside the core, and no descriptor touches a database client', () => {
    expect(DESCRIPTORS).not.toMatch(/createClient|createAdminClient/)
    expect(DESCRIPTORS).toContain("from '@/lib/objectives/core'")
    expect(DESCRIPTORS).not.toMatch(/@\/actions\//) // the setter is not on a client-reachable action
    const core = strip(read('src/lib/objectives/core.ts'))
    expect(body(core, 'setObjectiveCore')).toContain('await editor()')
    expect(core).toContain("EDIT_ROLES = ['admin', 'safety_manager']")
    // the read route forwards subjectId so the read descriptors can see it
    expect(read('src/app/api/ai-fields/read/route.ts')).toContain("subjectId: searchParams.get('subjectId')")
  })

  test('packSopForPrompt output bytes are unchanged (the pack file is untouched since the pin)', () => {
    expect(() => execFileSync('git', ['diff', '--quiet', 'f1b2ff93', '--', 'src/lib/agent-layer/sop-pack.ts'], { cwd: root })).not.toThrow()
  })

  test('readObjectiveSignals filters by organisation_id, isolates its own failure, and joins readAllSignals', () => {
    const fn = body(SIGNALS, 'readObjectiveSignals')
    expect(fn).toContain(".eq('organisation_id', organisationId)")
    expect(fn).toMatch(/catch \(err\)/)
    expect(fn).toContain('error:')
    expect(SIGNALS).toMatch(/objectives: ObjectiveSignals/)
    expect(body(SIGNALS, 'readAllSignals')).toMatch(/readObjectiveSignals\(organisationId, sopId\)/)
    expect(body(SIGNALS, 'readAllSignals')).toMatch(/return \{ completions, reviewer, verify, voice, objectives \}/)
    // no names or emails in a line
    expect(fn).not.toMatch(/email|full_name/)
  })

  test('synthesis appends one "Objectives in force" observation and never touches the SOP pack or embedding text', () => {
    expect(SYNTHESIS).toContain('Objectives in force:')
    expect(SYNTHESIS).toContain("signalSource: 'objectives'")
    expect(SYNTHESIS).not.toMatch(/packSopForPrompt\([^)]*objective/)
  })
})
