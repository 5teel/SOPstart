/**
 * TypeSafe Jev (System One) client: typed, calibrated decisions, no generated text (ADR-0022).
 * The only module that calls the TypeSafe API (tests/lint/jev-one-door.spec.ts). Server-only.
 *
 * A question is { type: 'noul' | 'choice' | 'score', instructions, criteria }; questions cannot see
 * each other's answers. Limits: 64k tokens for state + all questions, 32k for state + one question.
 */
import { aiModel } from './registry'

export type JevQuestion =
  | { type: 'noul'; instructions: string; criteria?: { true: string; false: string } }
  | { type: 'choice'; instructions: string; criteria: Record<string, string> }

export type JevAnswer =
  | { type: 'noul'; noul: number }
  | { type: 'choice'; choice: string; confidence: number; probabilities: Record<string, number> }

const URL = 'https://api.typesafe.ai/v1/systemone'

export interface JevUsage { inputTokens: number; calls: number }

/** One call: every question judged against the same state. Retries 429 and 5xx up to 3 times. */
export async function jevAsk<Q extends Record<string, JevQuestion>>(
  state: string,
  questions: Q,
  usage?: JevUsage,
): Promise<{ [K in keyof Q]: JevAnswer }> {
  const key = process.env.TYPESAFE_API_KEY
  if (!key) throw new Error('TYPESAFE_API_KEY not configured')
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: aiModel('clear-fact-check'), state, questions }),
    })
    if ((res.status === 429 || res.status >= 500) && attempt < 3) {
      await new Promise((r) => setTimeout(r, 1000 * (Number(res.headers.get('retry-after')) || 2 ** attempt)))
      continue
    }
    if (!res.ok) throw new Error(`Jev ${res.status}: ${(await res.text()).slice(0, 200)}`)
    const j = (await res.json()) as { answers: { [K in keyof Q]: JevAnswer }; usage?: { input_tokens?: number } }
    if (usage) { usage.inputTokens += j.usage?.input_tokens ?? 0; usage.calls++ }
    return j.answers
  }
}

/** Run tasks with at most n in flight. */
export async function jevPool<T>(items: T[], n: number, fn: (item: T) => Promise<void>) {
  const queue = [...items]
  await Promise.all(Array.from({ length: Math.min(n, queue.length) }, async () => { while (queue.length) await fn(queue.shift()!) }))
}
