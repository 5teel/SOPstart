/**
 * Provider-agnostic LLM calls (server-only).
 *
 * The AI Settings page lets an org pick ANY vetted model for a use case —
 * including cross-provider picks (Anthropic Claude, OpenAI GPT, or any
 * OpenRouter-served model like GLM). This adapter routes a structured tool
 * call or plain text call to the right provider API based on the model ID, so
 * callers never touch a provider SDK directly:
 *
 *   const out = await llmToolCall({ model, system, messages, tool })
 *
 * Provider inference by model ID shape:
 *   - contains '/'            → OpenRouter (vendor-prefixed, e.g. z-ai/glm-5.2)
 *   - starts with 'claude'    → Anthropic
 *   - anything else           → OpenAI (gpt-*, o-series)
 *
 * Adding a provider: add a branch here + its key to PROVIDER_ENV_KEYS in
 * ./registry.ts + vetted models in ./model-options.ts. Nothing else changes.
 */
import Anthropic from '@anthropic-ai/sdk'
import type { AiProvider } from './registry'

export interface LlmTool {
  name: string
  description: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  input_schema: Record<string, any>
}

export interface LlmMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface LlmCallOpts {
  model: string
  system?: string
  messages: LlmMessage[]
  maxTokens?: number
}

export function providerForModel(model: string): AiProvider {
  if (model.includes('/')) return 'openrouter'
  if (model.startsWith('claude')) return 'anthropic'
  return 'openai'
}

// Lazy singleton — same pattern as sop-parser/verify-sop.
let anthropic: Anthropic | null = null
function getAnthropicClient(): Anthropic {
  if (!anthropic) anthropic = new Anthropic()
  return anthropic
}

async function openAiCompatCall(
  opts: LlmCallOpts & { tool?: LlmTool },
): Promise<{ text: string | null; toolInput: unknown | null }> {
  const provider = providerForModel(opts.model)
  const base = provider === 'openrouter' ? 'https://openrouter.ai/api/v1' : 'https://api.openai.com/v1'
  const key = provider === 'openrouter' ? process.env.OPENROUTER_API_KEY : process.env.OPENAI_API_KEY
  if (!key) throw new Error(`${provider} API key not configured (model ${opts.model})`)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body: Record<string, any> = {
    model: opts.model,
    max_tokens: opts.maxTokens ?? 8192,
    messages: [
      ...(opts.system ? [{ role: 'system', content: opts.system }] : []),
      ...opts.messages.map((m) => ({ role: m.role, content: m.content })),
    ],
  }
  if (opts.tool) {
    body.tools = [
      {
        type: 'function',
        function: {
          name: opts.tool.name,
          description: opts.tool.description,
          parameters: opts.tool.input_schema,
        },
      },
    ]
    body.tool_choice = { type: 'function', function: { name: opts.tool.name } }
  }

  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`${provider} ${res.status}: ${errText.slice(0, 400)}`)
  }
  const data = (await res.json()) as {
    choices?: Array<{
      message?: { content?: string | null; tool_calls?: Array<{ function?: { arguments?: string } }> }
    }>
  }
  const msg = data.choices?.[0]?.message
  const args = msg?.tool_calls?.[0]?.function?.arguments
  let toolInput: unknown | null = null
  if (args) {
    toolInput = JSON.parse(args)
  } else if (opts.tool && msg?.content) {
    // Some OpenRouter-served models answer forced tool calls with plain JSON in
    // content — accept the first JSON object as a fallback rather than failing.
    const m = msg.content.match(/\{[\s\S]*\}/)
    if (m) {
      try {
        toolInput = JSON.parse(m[0])
      } catch {
        /* fall through to null */
      }
    }
  }
  return { text: msg?.content ?? null, toolInput }
}

/** Plain text completion (e.g. the parse triage call). */
export async function llmText(opts: LlmCallOpts): Promise<string> {
  if (providerForModel(opts.model) === 'anthropic') {
    const res = await getAnthropicClient().messages.create({
      model: opts.model,
      max_tokens: opts.maxTokens ?? 1024,
      ...(opts.system ? { system: opts.system } : {}),
      messages: opts.messages,
    })
    const block = res.content[0]
    return block?.type === 'text' ? block.text : ''
  }
  const { text } = await openAiCompatCall(opts)
  return text ?? ''
}

/**
 * Forced structured tool call — returns the tool input object.
 * Throws if the provider returns no parseable structured output.
 */
export async function llmToolCall(opts: LlmCallOpts & { tool: LlmTool }): Promise<unknown> {
  if (providerForModel(opts.model) === 'anthropic') {
    const res = await getAnthropicClient().messages.create({
      model: opts.model,
      max_tokens: opts.maxTokens ?? 8192,
      ...(opts.system ? { system: opts.system } : {}),
      messages: opts.messages,
      tools: [opts.tool as Anthropic.Tool],
      tool_choice: { type: 'tool', name: opts.tool.name },
    })
    const block = res.content.find((b) => b.type === 'tool_use' && b.name === opts.tool.name)
    if (!block || block.type !== 'tool_use') {
      throw new Error(`${opts.model} returned no structured output — tool_use block missing`)
    }
    return block.input
  }
  const { toolInput } = await openAiCompatCall(opts)
  if (toolInput === null) {
    throw new Error(`${opts.model} returned no structured output — no tool call or parseable JSON`)
  }
  return toolInput
}
