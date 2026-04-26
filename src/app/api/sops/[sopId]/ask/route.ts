import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

// Lazy-initialized to avoid throwing at module load time during Next.js static analysis
let anthropic: Anthropic | null = null
function getAnthropic(): Anthropic {
  if (!anthropic) anthropic = new Anthropic() // reads ANTHROPIC_API_KEY from env
  return anthropic
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sopId: string }> }
) {
  const { sopId } = await params

  // Auth gate — same pattern as /api/voice/token
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const body = await req.json() as { query?: string }
  const query = typeof body.query === 'string' ? body.query.slice(0, 500) : ''
  if (!query) return new Response('Missing query', { status: 400 })

  // Fetch SOP sections + steps to build AI context (org-scoped via RLS)
  const { data: sop } = await supabase
    .from('sops')
    .select(`title, sop_sections ( title, content, sop_steps ( step_number, text, warning, tip ) )`)
    .eq('id', sopId)
    .order('sort_order', { referencedTable: 'sop_sections', ascending: true })
    .single()

  if (!sop) return new Response('SOP not found', { status: 404 })

  // Build context string (truncate to 12000 chars to stay within token budget)
  let context = `SOP: ${sop.title ?? 'Untitled'}\n\n`
  for (const section of (sop.sop_sections ?? []) as Array<{
    title: string
    content: string | null
    sop_steps: Array<{ step_number: number; text: string; warning: string | null; tip: string | null }>
  }>) {
    context += `## ${section.title}\n`
    if (section.content) context += `${section.content}\n`
    for (const step of section.sop_steps ?? []) {
      context += `${step.step_number}. ${step.text}`
      if (step.warning) context += ` [WARNING: ${step.warning}]`
      if (step.tip) context += ` [TIP: ${step.tip}]`
      context += '\n'
    }
    context += '\n'
    if (context.length > 12000) { context = context.slice(0, 12000) + '\n[truncated]'; break }
  }

  const systemPrompt = `You are a safety-focused SOP assistant. Answer questions about the following Standard Operating Procedure concisely and accurately. If the answer is not in the SOP, say so clearly. Do not add information not present in the SOP.\n\n${context}`

  // Stream response via Anthropic SDK streaming
  const stream = await getAnthropic().messages.stream({
    model: 'claude-haiku-4-5',
    max_tokens: 512,
    system: systemPrompt,
    messages: [{ role: 'user', content: query }],
  })

  const readable = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      for await (const event of stream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          controller.enqueue(encoder.encode(event.delta.text))
        }
      }
      controller.close()
    },
    cancel() {
      stream.abort()
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
