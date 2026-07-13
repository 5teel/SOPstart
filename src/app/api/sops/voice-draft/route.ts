import { NextRequest, NextResponse } from 'next/server'
import { getSessionContext } from '@/lib/auth/session-context'
import { aiModel } from '@/lib/ai/registry'
import { llmToolCall, type LlmTool } from '@/lib/ai/llm'

/**
 * Conversational voice SOP-drafting interviewer.
 *
 * The client (admin/sops/new/voice) sends the running conversation; each call
 * returns the assistant's next reply, the brief-so-far, and whether the brief
 * is complete enough to hand to the /api/sops/ai-prompt draft pipeline.
 * Stateless — the conversation lives in the client, same as the API's other
 * short-lived chat surfaces.
 */
export const maxDuration = 60

const MAX_TURNS = 30
const MAX_TEXT = 4000

interface TurnMessage {
  role: 'user' | 'assistant'
  text: string
}

const INTERVIEWER_SYSTEM = `You are a SOP-drafting interviewer for a New Zealand industrial workplace. An admin is describing, by voice, a procedure they want turned into a Standard Operating Procedure. Spoken input is informal and may contain transcription errors — interpret generously.

Your job each turn:
1. Update the BRIEF — a written summary of everything learned so far about the procedure: the task, equipment, location/site, hazards, PPE, key steps, and who performs it.
2. Reply conversationally in one or two short sentences. Ask ONE focused follow-up question about the most important gap (hazards and PPE first, then equipment specifics, then step order). Never ask about more than one thing at once — this is a spoken conversation.
3. Set ready=true once the brief covers the task, the main steps, and at least the obvious hazards — don't interrogate forever; three or four good answers is usually enough. When ready, your reply should tell them they can generate the draft (or keep adding detail).

Rules:
- The brief must contain ONLY what the admin said or clearly implied — do not invent equipment, hazards, or site details.
- Metric units only (never imperial).
- The brief must be 20-2000 characters, written as a dense prose paragraph (it becomes the prompt for the SOP generator).
- Keep replies natural to hear aloud: short, no markdown, no lists.`

const INTERVIEW_TOOL: LlmTool = {
  name: 'interview_turn',
  description: 'Return the interviewer reply and updated brief',
  input_schema: {
    type: 'object' as const,
    required: ['reply', 'brief', 'ready'],
    properties: {
      reply: { type: 'string', description: 'Spoken-style reply to the admin, 1-2 short sentences' },
      brief: { type: 'string', description: 'The full brief so far (20-2000 chars once any content exists)' },
      ready: { type: 'boolean', description: 'True when the brief is complete enough to generate a draft' },
    },
  },
}

export async function POST(request: NextRequest) {
  // Auth + role guard — mirrors /api/sops/ai-prompt.
  const { userId, role } = await getSessionContext()
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (!role || !['admin', 'safety_manager'].includes(role)) {
    return NextResponse.json({ error: 'You need admin access to create SOPs.' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const rawMessages = Array.isArray(body?.messages) ? (body.messages as TurnMessage[]) : null
  if (!rawMessages || rawMessages.length === 0) {
    return NextResponse.json({ error: 'messages required' }, { status: 400 })
  }
  const messages = rawMessages
    .slice(-MAX_TURNS)
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.text === 'string')
    .map((m) => ({ role: m.role, content: m.text.slice(0, MAX_TEXT) }))
  if (messages.length === 0 || messages[messages.length - 1].role !== 'user') {
    return NextResponse.json({ error: 'last message must be from the user' }, { status: 400 })
  }

  try {
    const out = (await llmToolCall({
      model: aiModel('voice-draft'),
      maxTokens: 1024,
      system: INTERVIEWER_SYSTEM,
      messages,
      tool: INTERVIEW_TOOL,
    })) as { reply?: string; brief?: string; ready?: boolean }
    return NextResponse.json({
      reply: out.reply ?? '',
      brief: out.brief ?? '',
      ready: out.ready === true,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'voice draft turn failed'
    // Billing/credit outages surface here — pass the provider message through
    // so the UI shows the real cause (2026-07-05 fail-open learning).
    console.error('[voice-draft] turn failed:', message)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
