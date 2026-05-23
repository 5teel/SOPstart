# Phase 15: Manufacturing-Line Mode — Pattern Map

**Mapped:** 2026-05-12
**Files analyzed:** 25 (16 new, 9 modified)
**Analogs found:** 22 / 25 (3 are net-new with no exact analog — useViewport, bundle-size script, voice modal a11y)

---

## File Classification

| New / Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| **NEW — hooks** | | | | |
| `src/hooks/useViewport.ts` | hook (client-only) | event-driven (matchMedia listener) | none — net-new (RESEARCH.md § Pattern 1 supplies full sketch) | net-new |
| **NEW — components (UI, client)** | | | | |
| `src/components/sop/walkthrough/DesktopWalkthrough.tsx` | component (client) | client-state, derived from `useSopDetail` | `src/components/sop/tabs/WalkthroughTab.tsx` | role-exact, data-flow-exact |
| `src/components/sop/walkthrough/MobileWalkthrough.tsx` | component (client) | client-state, derived from `useSopDetail` | `src/components/sop/tabs/WalkthroughTab.tsx` (near-rename) | role-exact, data-flow-exact |
| `src/components/sop/walkthrough/WalkthroughSwitcher.tsx` | component (client, dynamic-import host) | viewport-gated dynamic import | none — net-new (RESEARCH.md § Pattern 2 supplies full sketch) | net-new |
| `src/components/sop/voice/WalkthroughVoiceButton.tsx` | component (client) | client-only UI (button + open-modal callback) | floating-pill primitive in `blueprint-theme.css`; mic-icon use mirrors `src/lib/voice/deepgram-stream.ts` consumer pattern | role-match |
| `src/components/sop/voice/WalkthroughVoiceModal.tsx` | component (client, modal) | mixed — calls `/api/voice/query` fetch + Deepgram WS client-side | `src/components/admin/blocks/BlockUpdateReviewModal.tsx` (modal chrome) + `BlockPicker.tsx` (load+state pattern) | role-match (modal chrome); data-flow novel (voice) |
| `src/components/admin/SubTradePicker.tsx` | component (client, multi-select) | client-state + server action submit | `src/components/admin/blocks/BlockPicker.tsx` (multi-row select + chip filter) | role-match (multi-select picker over server-loaded vocab) |
| **NEW — server / API** | | | | |
| `src/app/api/voice/query/route.ts` | API route (POST handler) | request-response (fetch SOP → Anthropic answer → Anthropic verifier → JSON) | `src/app/api/sops/ai-prompt/route.ts` | role-match (Anthropic-driven route); data-flow-match (sync, no parse_jobs row) |
| `src/lib/voice/voice-qa.ts` | service module (server-only) | request-response (Anthropic two-call) | `src/lib/parsers/verify-sop.ts` (lazy-init Anthropic pattern) + `src/lib/parsers/gpt-parser.ts` (lazy-init Anthropic pattern) | role-exact |
| `src/lib/voice/sop-pack.ts` | utility (shared serializer) | pure function | none — net-new (RESEARCH.md § Code Examples supplies full helper). Closest existing analog for "shared formatting helper" pattern: `src/lib/builder/diff-block-content.ts` | role-match |
| `src/lib/validators/voice-query.ts` | validator (Zod schema) | pure schema | `src/lib/validators/sop.ts` (`aiPromptSchema`) | role-exact |
| `src/actions/sub-trades.ts` | server action module | CRUD over junction tables, RLS-respecting | `src/actions/blocks.ts` (admin gate + scope-decided client + validation pipeline) | role-exact, data-flow-exact |
| **NEW — database** | | | | |
| `supabase/migrations/00030_sub_trades.sql` | migration | DDL + seed + RLS + SECURITY DEFINER helper + completions column add | `supabase/migrations/00022_block_library_phase13.sql` (seed + RLS extension + `is_summit_admin()` SECURITY DEFINER pattern) + `00029_ai_prompt_input_type.sql` (idempotent CHECK + ADD COLUMN IF NOT EXISTS pattern) | role-exact |
| **NEW — scripts** | | | | |
| `scripts/capture-bundle-baseline.ts` | build script | file-I/O over `.next/app-build-manifest.json` | none — net-new (RESEARCH.md § Code Examples supplies the sister `check-bundle-size.ts` whose inverse is the baseline writer) | net-new |
| `scripts/check-bundle-size.ts` | CI script | file-I/O over `.next/app-build-manifest.json` | none — net-new (RESEARCH.md § Code Examples supplies full sketch) | net-new |
| **NEW — tests** | | | | |
| `tests/integration/desktop-walkthrough-layout.spec.ts` | test (Playwright integration) | UI render assertion | existing `tests/integration/*` (Phase 12.5 walkthrough specs — see existing fixture paths) | role-match |
| `tests/integration/sequential-ack.spec.ts` | test (Playwright integration) | UI interaction + route-guard assertion | existing Phase 12.5 walkthrough integration tests | role-match |
| `tests/integration/voice-qa-happy-path.spec.ts` | test (Playwright integration) | mocked-API + UI assertion | Phase 14 anthropic-mock tests | role-match |
| `tests/integration/voice-grounding-scope.spec.ts` | test (Playwright integration) | two-SOP fixture + API assertion | role-match (no exact analog for two-SOP fixture) | role-match |
| `tests/integration/sub-trade-rls-backward-compat.spec.ts` | test (Playwright integration, RLS gate) | Supabase JS query as authenticated user | Phase 13 RLS integration tests | role-match |
| `tests/e2e/sub-trade-assignment.spec.ts` | test (Playwright E2E) | admin UI → DB junction assertion | Phase 13 admin block-library E2E tests | role-match |
| `tests/fixtures/anthropic-voice-mock.ts` | fixture (mock) | request-stub | Phase 14 anthropic-mock.ts | role-exact |
| `tests/fixtures/visy-enf4-03-031.sql` | fixture (SQL seed) | DB insert | existing seed-fixture SQL files | role-match |
| **MODIFIED** | | | | |
| `src/app/(protected)/sops/[sopId]/page.tsx` | route (client component) | wire `WalkthroughSwitcher` into existing 6-tab layout | self — edit the existing `WalkthroughTab` slot | self-edit |
| `src/lib/parsers/verify-sop.ts` | service module (server-only) | add `mode: 'voice_qa'` branch + `VOICE_QA_VERIFY_SYSTEM` const | self — append to existing file following Phase 14 `mode: 'prompt'` extension | self-edit |
| `src/stores/walkthrough.ts` | Zustand store | client state — add ackTrace + markStepAcknowledged + getHighestAckIndex | self — extend existing store following existing methods | self-edit |
| `src/app/(protected)/admin/team/page.tsx` | route page (client) | add per-row `SubTradePicker` + bind to server action | self — same pattern as existing role assignment row | self-edit |
| `src/app/(protected)/admin/sops/[sopId]/assign/page.tsx` | route page (client) | add `SubTradePicker` alongside existing role picker | self — same row pattern | self-edit |
| `src/types/database.types.ts` | type module | manual extension for sub_trades, users_sub_trades, sops_sub_trades, completions.step_ack_trace | self — Phase 14 D-08 learning (CLAUDE.md 2026-05-08): manual extension, never auto-regen | self-edit |
| `src/types/sop.ts` | type module | add SubTrade type, voice-query response shape | self — additive types | self-edit |

---

## Pattern Assignments

### `src/hooks/useViewport.ts` (hook, client-only)

**Analog:** none — net-new. RESEARCH.md § Implementation Patterns "Pattern 1" supplies the full implementation. Copy verbatim.

**Pattern to copy** (from `15-RESEARCH.md` lines 155-178):

```tsx
'use client'
import { useState, useEffect } from 'react'

const DESKTOP_BREAKPOINT = '(min-width: 1024px)'

export function useViewport(): 'mobile' | 'desktop' {
  // CRITICAL: initial state MUST match SSR output (mobile) — D-04.
  // Brief mobile-render flash on desktop is acceptable; never read window during initial render.
  const [variant, setVariant] = useState<'mobile' | 'desktop'>('mobile')

  useEffect(() => {
    const mql = window.matchMedia(DESKTOP_BREAKPOINT)
    const update = () => setVariant(mql.matches ? 'desktop' : 'mobile')
    update() // sync once on mount
    mql.addEventListener('change', update)
    return () => mql.removeEventListener('change', update)
  }, [])

  return variant
}
```

**Pattern notes for planner**

- Do NOT call `window.matchMedia` inside `useState`'s initial value or during render — throws on SSR.
- Initial state `'mobile'` is load-bearing — matches SSR output per D-04. The flash is documented and accepted.

---

### `src/components/sop/walkthrough/MobileWalkthrough.tsx` (component, client)

**Analog:** `src/components/sop/tabs/WalkthroughTab.tsx` — this IS the existing walkthrough; rename / extract near-byte-identical.

**Imports pattern** (from `WalkthroughTab.tsx` lines 1-18):

```tsx
'use client'
import { useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CheckCircle2, ClipboardCheck, Camera } from 'lucide-react'
import type { SopWithSections, SopSection } from '@/types/sop'
import { ImmersiveStepCard } from '@/components/sop/walkthrough/ImmersiveStepCard'
import { ViewModeToggle } from '@/components/sop/walkthrough/ViewModeToggle'
import { useWalkthroughModeStore } from '@/stores/walkthroughMode'
import { useWalkthroughStore } from '@/stores/walkthrough'
import { useCompletionStore } from '@/stores/completionStore'
import { SafetyAcknowledgement } from '@/components/sop/SafetyAcknowledgement'
import { submitCompletion } from '@/actions/completions'
import { usePhotoQueue, addPhotoToQueue } from '@/hooks/usePhotoQueue'
import { flushPhotoQueue } from '@/lib/offline/sync-engine'
import { createClient } from '@/lib/supabase/client'
import { db } from '@/lib/offline/db'
import { upsertWalkthroughProgress } from '@/actions/walkthrough-progress'
```

**Core state-derivation pattern** (lines 19-67):

```tsx
export function WalkthroughTab({ sop }: { sop: SopWithSections }) {
  const router = useRouter()
  const search = useSearchParams()
  const walkthroughStore = useWalkthroughStore()
  const completionStore = useCompletionStore()
  // ...
  const sopId = sop.id
  const completedSteps = walkthroughStore.getCompletedSteps(sopId)
  const activeCompletion = completionStore.getActiveCompletion(sopId)
  const allSteps = sop.sop_sections.flatMap((s) => s.sop_steps ?? [])
  const currentId = search.get('step') ?? allSteps[0]?.id
  const currentIdx = Math.max(0, allSteps.findIndex((s) => s.id === currentId))
  // ...
}
```

**Pattern notes for planner**

- Rename / extract near-byte-identical. Mobile worker UAT was already green Phase 12.5 — any drift breaks SPEC acceptance criterion #2.
- Step state comes from `useWalkthroughStore` + `useCompletionStore`. Both shared with `DesktopWalkthrough`.
- For SB-LINE-02 (sequential ack on mobile): replace "checkbox" complete with the explicit "I've done this — Next" button gating forward navigation via `markStepAcknowledged` (new method on store).

---

### `src/components/sop/walkthrough/DesktopWalkthrough.tsx` (component, client)

**Analog:** `src/components/sop/tabs/WalkthroughTab.tsx` for the data flow; visual layout is net-new big-text. Step card primitive analog: `src/components/sop/walkthrough/ImmersiveStepCard` (already imported by WalkthroughTab).

**Pattern notes for planner**

- Same data hook chain (`useSopDetail` → `useWalkthroughStore` → render).
- Required CSS minimums per SPEC: body `font-size >= 24px`, secondary text >= 18px, primary "Next" button `min-height: 60px`. Use existing `--ink-*` / `--paper` tokens at scaled type sizes — no new design tokens.
- Single-step-per-viewport. NOT a list. The existing list-mode (`WalkthroughList.tsx`) is mobile-only; do not extend it.
- Must consume the SAME `useWalkthroughStore` ack methods as the mobile variant — both call `markStepAcknowledged(sopId, stepId)` and read `getHighestAckIndex(...)`.
- Code-split via `next/dynamic` with `ssr: false` (RESEARCH.md § Pattern 2, lines 184-219).

---

### `src/components/sop/walkthrough/WalkthroughSwitcher.tsx` (component, client, dynamic-import host)

**Analog:** none — net-new. RESEARCH.md § Implementation Patterns "Pattern 2" supplies the full sketch.

**Pattern to copy** (from `15-RESEARCH.md` lines 184-209):

```tsx
'use client'
import dynamic from 'next/dynamic'
import { useViewport } from '@/hooks/useViewport'
import { MobileWalkthrough } from '@/components/sop/walkthrough/MobileWalkthrough'

// Desktop = NEW. Dynamic + ssr:false so it never ships to mobile bundles.
const DesktopWalkthrough = dynamic(
  () => import('@/components/sop/walkthrough/DesktopWalkthrough').then(m => m.DesktopWalkthrough),
  { ssr: false, loading: () => null }
)

// Voice modal — same treatment, only loads when mic is opened
const WalkthroughVoiceModal = dynamic(
  () => import('@/components/sop/voice/WalkthroughVoiceModal').then(m => m.WalkthroughVoiceModal),
  { ssr: false, loading: () => null }
)

export function WalkthroughSwitcher({ sop }: { sop: SopWithSections }) {
  const variant = useViewport()
  return variant === 'desktop' ? <DesktopWalkthrough sop={sop} /> : <MobileWalkthrough sop={sop} />
}
```

**Pattern notes for planner**

- The voice modal lives at the switcher level (NOT inside either variant) — both variants render the same mic button + modal pair (D-14, D-15).
- Mobile component is statically imported (it's the SSR path); Desktop + VoiceModal are dynamic-imported.
- Pitfall 5 (research): a single static import of `DesktopWalkthrough` anywhere in a client component will defeat the code-split. Lint via the no-static-desktop-import test.

---

### `src/components/sop/voice/WalkthroughVoiceModal.tsx` (component, client modal)

**Analog (modal chrome):** `src/components/admin/blocks/BlockUpdateReviewModal.tsx`

**Modal chrome pattern** (lines 104-137):

```tsx
return (
  <div
    role="dialog"
    aria-modal="true"
    aria-labelledby="block-update-review-title"
    className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--paper)]/80 backdrop-blur-sm p-4"
    onClick={(e) => {
      if (e.target === e.currentTarget) onClose()
    }}
  >
    <div className="w-full max-w-3xl max-h-[85vh] overflow-y-auto bg-white border border-[var(--ink-100)] rounded-xl shadow-xl">
      {/* Header */}
      <div className="flex items-start justify-between px-5 py-4 border-b border-[var(--ink-100)]">
        <div>
          <h2 id="block-update-review-title" className="text-base font-semibold text-[var(--ink-900)]">
            …title…
          </h2>
          <p className="mt-1 text-xs text-[var(--ink-500)]">…subtitle…</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close"
          className="text-[var(--ink-500)] hover:text-[var(--ink-900)]">
          <X className="h-4 w-4" />
        </button>
      </div>
      …
```

**Loading + transition state** (lines 40-50):

```tsx
const [isPending, startTransition] = useTransition()
// ...
startTransition(async () => {
  const res = await someServerCall(...)
  if ('error' in res) { setError(res.error); return }
  setToast('Success message')
  onReviewed?.()
})
```

**Pattern notes for planner**

- Modal root uses `role="dialog" aria-modal="true" aria-labelledby="..."` + `fixed inset-0 z-50 flex items-center justify-center bg-[var(--paper)]/80 backdrop-blur-sm`.
- Backdrop click handler: `if (e.target === e.currentTarget) onClose()` — keeps click events inside the modal from closing.
- Inner card: `bg-white border border-[var(--ink-100)] rounded-xl shadow-xl` with `max-h-[85vh] overflow-y-auto`.
- Close X icon from `lucide-react` at top-right with `aria-label="Close"`.
- For voice-specific additions: live waveform area, transcribed-text region with `aria-live="polite"`, Stop button (auto-focused on open per RESEARCH.md § Pattern 8), citation chips (clickable; scroll underlying walkthrough on click).
- ASR client: use existing `src/lib/voice/deepgram-stream.ts` + `media-recorder.ts` — DO NOT add a second ASR vendor.
- Verifier badge: if `verifier_flags.length > 0`, render the flagged-version answer with a yellow `bg-amber-950/30 border border-amber-700/40` callout (style matches `kindChanged` warning in BlockUpdateReviewModal lines 148-156).

---

### `src/components/sop/voice/WalkthroughVoiceButton.tsx` (component, client)

**Analog:** floating-pill primitive in `src/styles/blueprint-theme.css`; icon from `lucide-react` (use `Mic` icon).

**Pattern notes for planner**

- Fixed positioning per D-14: `position: fixed; right: 1rem; bottom: 1rem; padding-bottom: env(safe-area-inset-bottom);`
- Use `--ink-900` background + `--paper` icon for high contrast pill (paper/ink theme).
- Single primary button — emits `onOpenModal` callback to `WalkthroughSwitcher`.
- Lives at switcher level (NOT inside step cards) — persistent across all walkthrough steps in both layouts.

---

### `src/components/admin/SubTradePicker.tsx` (component, client, multi-select)

**Analog:** `src/components/admin/blocks/BlockPicker.tsx`

**Server-load pattern** (lines 30-70):

```tsx
const [items, setItems] = useState<SubTrade[]>([])
const [loading, setLoading] = useState(false)
const [error, setError] = useState<string | null>(null)
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(initialSelected))
const [submitting, setSubmitting] = useState(false)

useEffect(() => {
  if (!open) return
  let cancelled = false
  setLoading(true); setError(null)
  listSubTrades()
    .then((rows) => {
      if (cancelled) return
      setItems(rows); setLoading(false)
    })
    .catch((e: unknown) => {
      if (cancelled) return
      setError(e instanceof Error ? e.message : 'Failed to load sub-trades')
      setLoading(false)
    })
  return () => { cancelled = true }
}, [open])
```

**Pattern notes for planner**

- BlockPicker is a SINGLE-select picker; SubTradePicker is MULTI-select — keep the load+state shell, swap selection state from `string | null` to `Set<string>`.
- Vocab is small (5 rows) — render as checkbox list, no chip filter / scoring needed (sub-trades has no "exact / related / all" grouping).
- Same modal chrome conventions (role="dialog" aria-modal="true", paper/ink tokens).
- Submit calls `assignUserSubTrades(userId, [...selectedIds])` (or `assignSopSubTrades` from the SOP-assign page).
- For inline use on the team page (per-row tag display, NOT a modal), render an inline `<select multiple>` + chip preview instead. Decide at plan time.

---

### `src/app/api/voice/query/route.ts` (API route, POST)

**Analog:** `src/app/api/sops/ai-prompt/route.ts`

**Auth + role guard pattern** (lines 19-37):

```ts
export const maxDuration = 30 // ≤2s typical, 30s safety cap for Anthropic timeouts

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: { session } } = await supabase.auth.getSession()
  const jwtClaims = session?.access_token
    ? JSON.parse(atob(session.access_token.split('.')[1]))
    : {}
  const organisationId: string | null = jwtClaims['organisation_id'] ?? null
  if (!organisationId) return NextResponse.json({ error: 'No organisation found' }, { status: 403 })
  // (skip the admin-role check for voice — workers must be able to ask)
```

**Body validation pattern** (lines 40-49):

```ts
const body = await request.json()
const parseResult = voiceQuerySchema.safeParse(body)
if (!parseResult.success) {
  return NextResponse.json(
    { error: parseResult.error.issues[0]?.message ?? 'Invalid input' },
    { status: 400 },
  )
}
const { sopId, question } = parseResult.data
```

**Error envelope pattern** (lines 212-237):

```ts
} catch (error) {
  const message = error instanceof Error ? error.message : 'Unknown error'
  // Don't leak Anthropic errors verbatim to clients — log original, return generic.
  console.error('voice query pipeline error:', message)
  return NextResponse.json(
    { error: 'Voice query failed. Please try again or check the SOP directly.' },
    { status: 502 },
  )
}
```

**Pattern notes for planner**

- Use the auth pattern from `ai-prompt/route.ts` BUT drop the `['admin', 'safety_manager']` role check — workers need access.
- DO NOT create `parse_jobs` rows. Voice queries are synchronous (≤2s). See RESEARCH.md § Executive Summary point 2.
- Fetch the SOP via the regular `supabase` client (RLS enforces single-org + sub-trade gate from migration 00030). Do NOT use `createAdminClient()` — that would bypass RLS and break SB-LINE-04 grounding scope.
- Full server-side fetch (RESEARCH.md § Pattern 4 lines 291-304) joins sections + sop_steps + sop_section_blocks for the SOP only — never cross-SOP.
- Status codes per RESEARCH.md § Pattern 4 lines 318-323: 400 invalid_input / 401 unauthorized / 404 not_found / 429 concurrent_query (optional) / 502 voice_query_failed.

---

### `src/lib/voice/voice-qa.ts` (service module, server-only)

**Analog:** `src/lib/parsers/verify-sop.ts` (lazy-init Anthropic) + `src/lib/parsers/gpt-parser.ts` (lazy-init Anthropic).

**Lazy-init Anthropic pattern** (`verify-sop.ts` lines 1-12, **byte-identical to copy**):

```ts
import Anthropic from '@anthropic-ai/sdk'

// Lazy-initialized to avoid throwing at module load time during Next.js static analysis
let anthropic: Anthropic | null = null
function getAnthropic(): Anthropic {
  if (!anthropic) {
    anthropic = new Anthropic() // reads ANTHROPIC_API_KEY from env
  }
  return anthropic
}
```

**Anthropic call shape** (`verify-sop.ts` lines 72-85):

```ts
const response = await getAnthropic().messages.create({
  model: VERIFY_MODEL,
  max_tokens: 2048,
  system: systemPrompt,
  messages: [{ role: 'user', content: `${sourceLabel}:\n${sourceText}\n\nSTRUCTURED SOP (JSON):\n${JSON.stringify(parsedSop, null, 2)}` }],
})
const text = response.content[0].type === 'text' ? response.content[0].text : '[]'
const cleaned = text.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim()
return JSON.parse(cleaned) as VerificationFlag[]
```

**Phase 15 extension — add prompt caching** (RESEARCH.md lines 236-251, **net-new wiring**):

```ts
const response = await getAnthropic().messages.create({
  model: 'claude-haiku-4-5-20251001',
  max_tokens: 512,
  system: [
    { type: 'text', text: VOICE_QA_SYSTEM },                                  // small, stable
    { type: 'text', text: packed, cache_control: { type: 'ephemeral' } },     // 5-min cache breakpoint
  ],
  messages: [{ role: 'user', content: question }],
})
```

**Pattern notes for planner**

- COPY THE LAZY-INIT HELPER VERBATIM. Pitfall 2 (research): instantiating `new Anthropic()` at module top-level breaks Next.js 16 builds when `ANTHROPIC_API_KEY` is absent during static analysis. The existing pattern is the proven fix.
- Anthropic call shape (`system: [{...}, {...}]` block array with `cache_control`) is NEW for this codebase — `gpt-parser.ts` + `verify-sop.ts` use plain `system: string`. Phase 15 introduces the array-with-cache_control form.
- The answer call AND the verifier call MUST share `packSopForPrompt(sop)` output — byte-identical text above the cache breakpoint = cache hit. Different formatters = silent cache miss + 10x cost. (RESEARCH.md Pitfall 3 lines 633-641.)
- Verifier fail-safe: on Anthropic exception in `voice_qa` mode, return a synthetic warning flag, NOT empty array (RESEARCH.md Pitfall 10 lines 694-698). Current `verify-sop.ts` returns `[]` on error — that semantic must NOT apply in voice mode.

---

### `src/lib/voice/sop-pack.ts` (utility, pure)

**Analog:** none — net-new. RESEARCH.md § Code Examples lines 940-958 supplies the full helper. Closest existing same-role analog: `src/lib/builder/diff-block-content.ts` (shared formatter consumed by multiple places).

**Pattern to copy** (from `15-RESEARCH.md` lines 940-958):

```ts
import type { SopWithSections } from '@/types/sop'

export function packSopForPrompt(sop: SopWithSections): string {
  // Shared serialiser used by BOTH the answer call AND the verifier call.
  // CRITICAL: byte-identical output → same prompt cache hit.
  const lines = [`SOP TITLE: ${sop.title}`, `SOP VERSION: ${sop.version}`, '']
  for (const sec of sop.sop_sections) {
    lines.push(`## ${sec.title} [type=${sec.section_type}]`)
    if (sec.content) lines.push(sec.content)
    for (const step of sec.sop_steps ?? []) {
      lines.push(`  Step ${step.step_number}: ${step.text}`)
      if (step.warning) lines.push(`    WARNING: ${step.warning}`)
      if (step.caution) lines.push(`    CAUTION: ${step.caution}`)
    }
    for (const block of sec.sop_section_blocks ?? []) {
      lines.push(`  Block: ${JSON.stringify(block.snapshot_content)}`)
    }
    lines.push('')
  }
  return lines.join('\n')
}
```

**Pattern notes for planner**

- Treat as a load-bearing constant — any field-add or whitespace change in this function invalidates the prompt cache.
- Both `voice-qa.ts answerSopQuestion()` and the `mode: 'voice_qa'` branch of `verify-sop.ts` MUST import from this same file.
- Add a unit test asserting cache_creation_input_tokens > 0 on Q1 and cache_read_input_tokens > 0 on Q2 (RESEARCH.md Pitfall 3 line 638).

---

### `src/lib/validators/voice-query.ts` (validator, Zod)

**Analog:** `src/lib/validators/sop.ts` — `aiPromptSchema` (lines 159-168).

**Pattern to copy** (from `src/lib/validators/sop.ts` lines 159-168):

```ts
export const aiPromptSchema = z.object({
  promptText: z
    .string()
    .min(20, 'Prompt must be at least 20 characters — describe the procedure, site, or worker role')
    .max(2000, 'Prompt must be under 2000 characters'),
  categoryTag: z.string().optional(),
  detailLevel: z.number().int().min(1).max(5).default(3),
})
export type AiPromptInput = z.infer<typeof aiPromptSchema>
```

**Pattern notes for planner**

- New schema shape per RESEARCH.md § Pattern 4 lines 274-277:
  ```ts
  export const voiceQuerySchema = z.object({
    sopId: z.string().uuid(),
    question: z.string().min(5).max(500),
  })
  export type VoiceQueryInput = z.infer<typeof voiceQuerySchema>
  ```
- Co-locate the response type here too: `{ answer: string; citations: string[]; verifier_flags: VerificationFlag[] }`.

---

### `src/actions/sub-trades.ts` (server actions)

**Analog:** `src/actions/blocks.ts`

**`requireAdmin()` helper pattern** (lines 40-55, **copy verbatim**):

```ts
async function requireAdmin(): Promise<AdminCtx | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  const { data: { session } } = await supabase.auth.getSession()
  const jwtClaims: Record<string, any> = session?.access_token
    ? JSON.parse(atob(session.access_token.split('.')[1]))
    : {}
  const role: string = jwtClaims['user_role'] ?? ''
  if (!role || !['admin', 'safety_manager'].includes(role)) {
    return { error: 'Admin access required' }
  }
  const organisationId: string | null = jwtClaims['organisation_id'] ?? null
  return { supabase, user: { id: user.id }, role, organisationId }
}
```

**Validate-then-insert pattern** (lines 128-187):

```ts
export async function createBlock(input: z.input<typeof CreateBlockInput>):
  Promise<{ block: Block; version: BlockVersion } | { error: string }> {
  const parsed = CreateBlockInput.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  const data = parsed.data
  // ...
  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }
  if (!ctx.organisationId) return { error: 'No organisation' }
  // ...use ctx.supabase (RLS-respecting) for org-scoped writes
}
```

**Pattern notes for planner**

- Copy `requireAdmin()` verbatim — it's the standard gate.
- All sub-trade junction writes are org-scoped (workers + SOPs already have org_id), so use `ctx.supabase` (RLS-respecting). DO NOT use `createAdminClient()` unless writing to the seed vocab (and that ships via SQL migration, not server action).
- Return shape: `{ ok: true } | { error: string }` — matches existing `acceptBlockUpdate` / `declineBlockUpdate` from `actions/sop-section-blocks.ts`.
- Server actions needed:
  - `assignUserSubTrades(userId, subTradeIds[])` — replace junction rows in transaction
  - `assignSopSubTrades(sopId, subTradeIds[])` — same shape
  - `listSubTrades()` — read seed vocab (used by SubTradePicker)
- All inputs validated by Zod schemas in `src/lib/validators/voice-query.ts` (or sibling `sub-trades.ts`).

---

### `supabase/migrations/00030_sub_trades.sql` (migration)

**Analog:** `supabase/migrations/00022_block_library_phase13.sql` (Phase 13 — controlled vocab seed + RLS extension + SECURITY DEFINER helper) + `supabase/migrations/00029_ai_prompt_input_type.sql` (additive CHECK + ADD COLUMN IF NOT EXISTS).

**SECURITY DEFINER helper pattern** (`00022` lines 45-56, **template for `current_user_sub_trades()`**):

```sql
create or replace function public.is_summit_admin() returns boolean
  language sql
  stable
  security definer
  set search_path = public
as $$
  select exists (select 1 from public.summit_admins where user_id = auth.uid());
$$;

comment on function public.is_summit_admin() is
  'Phase 13: returns true if the calling user has a row in public.summit_admins (D-Global-01).';
```

**Controlled-vocab seed pattern** (`00022` lines 85-110):

```sql
alter table public.block_categories enable row level security;
create policy "block_categories_read_all" on public.block_categories
  for select to authenticated using (true);
-- writes: service_role only (no authenticated INSERT/UPDATE/DELETE policy)

insert into public.block_categories (slug, display_name, category_group, sort_order) values
  ('crush-entrapment',         'Crush / Entrapment',         'hazard',  10),
  ('electrocution',            'Electrocution',              'hazard',  20),
  ...
on conflict (slug) do nothing;
```

**Idempotent CHECK / column pattern** (`00029` lines 9-30):

```sql
ALTER TABLE parse_jobs DROP CONSTRAINT IF EXISTS parse_jobs_input_type_check;
DO $$ BEGIN
  EXECUTE (SELECT 'ALTER TABLE parse_jobs DROP CONSTRAINT ' || conname FROM pg_constraint
           WHERE conrelid = 'parse_jobs'::regclass AND contype = 'c'
             AND pg_get_constraintdef(oid) LIKE '%input_type%' LIMIT 1);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
ALTER TABLE parse_jobs ADD CONSTRAINT parse_jobs_input_type_check
  CHECK (input_type IN ('upload', 'scan', 'url', 'video_file', 'youtube_url', 'ai_prompt'));

ALTER TABLE parse_jobs ADD COLUMN IF NOT EXISTS prompt_text text DEFAULT NULL;
COMMENT ON COLUMN parse_jobs.prompt_text IS 'Phase 14: original natural-language prompt …';
```

**Pattern notes for planner**

- Migration body is fully specified in RESEARCH.md § Migration Strategy lines 763-891 — paste that block verbatim into `00030_sub_trades.sql`.
- Wrap the whole migration in `begin; … commit;` — matches 00022.
- Add `comment on function current_user_sub_trades() is 'Phase 15: depends on users_sub_trades — recompile if renamed';` per CLAUDE.md learning [2026-05-08]. The Phase 13 cleanup bug (migration 00026 / 00028) is the documented precedent.
- Use `create or replace function` + `language sql stable security definer set search_path = public` exactly as in `is_summit_admin()`.
- Seed inserts use `on conflict (slug) do nothing` — idempotent re-runs.
- The RLS extension on `sops` SELECT is ADDITIVE (multiple permissive policies OR together). Verify A4 (RESEARCH.md line 1073) by reading the existing `sops` SELECT policies in migration `00001` first.
- Include the `completions.step_ack_trace JSONB` column add in the SAME migration (RESEARCH.md lines 884-888) — keeps Phase 15 schema changes in one transaction.

---

### `src/lib/parsers/verify-sop.ts` extension (MODIFIED)

**Analog:** self — append a third mode following the existing Phase 14 `mode: 'prompt'` extension.

**Existing pattern** (lines 62-91):

```ts
export async function verifyTranscriptVsSop(
  sourceText: string,
  parsedSop: ParsedSop,
  opts?: { mode?: 'transcript' | 'prompt' },
): Promise<VerificationFlag[]> {
  const mode = opts?.mode ?? 'transcript'
  const systemPrompt = mode === 'prompt' ? PROMPT_VERIFY_SYSTEM : ADVERSARIAL_SYSTEM
  const sourceLabel = mode === 'prompt' ? 'SOURCE PROMPT' : 'SOURCE TRANSCRIPT'
  // ...
}
```

**Pattern notes for planner**

- Extend the mode union: `'transcript' | 'prompt' | 'voice_qa'`.
- Add a sibling constant `VOICE_QA_VERIFY_SYSTEM` next to `PROMPT_VERIFY_SYSTEM` and `ADVERSARIAL_SYSTEM` — full prompt text in RESEARCH.md § Pattern 5 lines 332-345.
- Branch on `mode === 'voice_qa'`: input shape changes from `ParsedSop` to `{ answer: string; citations: Citation[] }`. Update the second param type to a union, OR cast at the call site (the existing call sites pass `ParsedSop` — only the new `voice-qa.ts` will pass the answer-shape).
- Change error semantics for `voice_qa` mode ONLY: do NOT return `[]` on catch — return a synthetic warning flag (RESEARCH.md Pitfall 10).
- Add `cache_control: { type: 'ephemeral' }` to the system block of the verifier call when `mode === 'voice_qa'` — voice mode wants the prompt-cache hit on the second call. Other modes do not need this.

---

### `src/stores/walkthrough.ts` extension (MODIFIED)

**Analog:** self.

**Existing store pattern** (lines 1-85):

```ts
import { create } from 'zustand'

interface WalkthroughState {
  completedSteps: Record<string, string[]>
  acknowledgedSops: Record<string, number>
  lockedSteps: Record<string, true>
  markStepComplete: (sopId: string, stepId: string) => void
  // ... methods that take (sopId, ...) and mutate keyed records
}

export const useWalkthroughStore = create<WalkthroughState>((set, get) => ({
  completedSteps: {},
  // ...
  markStepComplete: (sopId, stepId) =>
    set((state) => {
      const existing = state.completedSteps[sopId] ?? []
      if (existing.includes(stepId)) return state
      return { completedSteps: { ...state.completedSteps, [sopId]: [...existing, stepId] } }
    }),
}))
```

**Pattern notes for planner**

- Add fields per RESEARCH.md § Pattern 7 lines 425-434:
  ```ts
  ackTrace: Record<string, AckTraceEntry[]>             // sopId -> ordered ack trace
  markStepAcknowledged: (sopId: string, stepId: string) => void
  getHighestAckIndex: (sopId: string, allStepIds: string[]) => number
  getAckTrace: (sopId: string) => AckTraceEntry[]
  ```
- Mirror the existing `markStepComplete` shape: dedupe by stepId, append `{ stepId, timestamp: Date.now() }`.
- The ack trace is per-SOP; reset via `resetWalkthrough(sopId)`.
- `submitCompletion` server action (in `src/actions/completions.ts`) accepts `stepAckTrace: AckTraceEntry[]` and writes to `completions.step_ack_trace` JSONB column. Wire-up is in the plan that touches `actions/completions.ts`.

---

### `src/app/(protected)/sops/[sopId]/page.tsx` modification (MODIFIED)

**Analog:** self.

**Current shape** (lines 1-80 — relevant excerpts shown above) — uses `useSopDetail` + `SopTabNav` + a `WalkthroughTab` import slot.

**Pattern notes for planner**

- Replace the import `WalkthroughTab` from `@/components/sop/tabs` with `WalkthroughSwitcher` from `@/components/sop/walkthrough/WalkthroughSwitcher`.
- The active-tab dispatch (`{active === 'walkthrough' && <WalkthroughTab sop={sop} />}`) becomes `{active === 'walkthrough' && <WalkthroughSwitcher sop={sop} />}`.
- ALL other tabs (overview, tools, hazards, flow, model) are unchanged.
- The voice button + modal live INSIDE `WalkthroughSwitcher`, not in `[sopId]/page.tsx`. The page file only changes the switcher import.

---

### `src/app/(protected)/admin/team/page.tsx` and `[sopId]/assign/page.tsx` (MODIFIED)

**Analog:** self for surrounding chrome; `BlockPicker` for the picker drop-in.

**Pattern notes for planner**

- Add a `<SubTradePicker>` (inline mode, not modal) per worker row on `admin/team/page.tsx`. Loads current assignments from `users_sub_trades`, calls `assignUserSubTrades(userId, ids)` on change.
- Add a `<SubTradePicker>` alongside the role picker on `admin/sops/[sopId]/assign/page.tsx`. Loads current `sops_sub_trades`, calls `assignSopSubTrades(sopId, ids)`.
- Existing paper/ink tokens already roll through after Phase 14.5 — do not introduce new tokens. Reuse `--ink-900` / `--ink-500` / `--paper` for text + chip backgrounds.

---

### `src/types/database.types.ts` extension (MODIFIED)

**Analog:** self — Phase 14 D-08 learning (CLAUDE.md `2026-05-08`).

**Pattern notes for planner**

- Manual extension only. DO NOT run `supabase gen types` — file is hand-curated per CLAUDE.md learning.
- Add Row / Insert / Update types for: `sub_trades`, `users_sub_trades`, `sops_sub_trades`.
- Add `step_ack_trace: Json` field to `completions.Row` (and Insert/Update).
- Add the `current_user_sub_trades` and `sub_trade_id_intersects` function signatures under `Functions:`.

---

### `scripts/check-bundle-size.ts` + `scripts/capture-bundle-baseline.ts` (NEW)

**Analog:** none — net-new. RESEARCH.md § Code Examples lines 1010-1047 supplies the full sketch.

**Pattern notes for planner**

- `capture-bundle-baseline.ts`: runs after `next build`, writes `.bundle-baseline.json` keyed by route → KB. Run ONCE on Phase 14-head (Wave 0) before any Phase 15 file is created.
- `check-bundle-size.ts`: runs after `next build`, reads `.next/app-build-manifest.json` + `.bundle-baseline.json`, asserts delta ≤ 2 KB for `/sops/[sopId]/page`. Also asserts `DesktopWalkthrough` appears as a separate chunk (else the dynamic-import was bypassed).
- Wire into `npm run build` via `package.json` `"postbuild"` script — failing build = failing deploy. Matches Phase 12's existing `prebuild` contract-check pattern.

---

## Shared Patterns

### Anthropic SDK lazy-init

**Source:** `src/lib/parsers/verify-sop.ts` lines 1-12 (and identical in `gpt-parser.ts` lines 1-12)
**Apply to:** `src/lib/voice/voice-qa.ts` (NEW)

```ts
import Anthropic from '@anthropic-ai/sdk'

let anthropic: Anthropic | null = null
function getAnthropic(): Anthropic {
  if (!anthropic) {
    anthropic = new Anthropic() // reads ANTHROPIC_API_KEY from env
  }
  return anthropic
}
```

**Why mandatory:** Module-top-level `new Anthropic()` throws during Next.js 16 static analysis when env var is absent. Lazy-init is the proven fix already used twice in the codebase.

---

### Auth + JWT-claims extraction in API routes / server actions

**Source:** `src/app/api/sops/ai-prompt/route.ts` lines 19-37; `src/actions/blocks.ts` lines 40-55
**Apply to:** `src/app/api/voice/query/route.ts` (NEW); `src/actions/sub-trades.ts` (NEW)

```ts
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

const { data: { session } } = await supabase.auth.getSession()
const jwtClaims = session?.access_token
  ? JSON.parse(atob(session.access_token.split('.')[1]))
  : {}
const organisationId: string | null = jwtClaims['organisation_id'] ?? null
const role = jwtClaims['user_role']
```

**Voice route variant:** drop the admin role check — workers must be allowed.
**Sub-trades actions:** keep the admin role check — only admins assign tags.

---

### Modal chrome — paper/ink theme

**Source:** `src/components/admin/blocks/BlockUpdateReviewModal.tsx` lines 104-137; `src/components/admin/blocks/BlockPicker.tsx` lines 161-191
**Apply to:** `src/components/sop/voice/WalkthroughVoiceModal.tsx` (NEW); `src/components/admin/SubTradePicker.tsx` (NEW, if modal mode chosen)

```tsx
<div role="dialog" aria-modal="true" aria-labelledby="…"
  className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--paper)]/80 backdrop-blur-sm p-4"
  onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
  <div className="w-full max-w-3xl max-h-[85vh] overflow-y-auto bg-white border border-[var(--ink-100)] rounded-xl shadow-xl"
       onClick={(e) => e.stopPropagation()}>
    {/* header with X close button + aria-label="Close" */}
    {/* body */}
    {/* footer with primary + secondary actions */}
  </div>
</div>
```

---

### Zod validate-then-return-error envelope

**Source:** `src/actions/blocks.ts` lines 131-134; `src/app/api/sops/ai-prompt/route.ts` lines 42-47
**Apply to:** All new API route handlers + server actions

```ts
const parsed = SomeSchema.safeParse(input)
if (!parsed.success) {
  return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
}
const data = parsed.data
```

---

### SECURITY DEFINER RLS helper

**Source:** `supabase/migrations/00022_block_library_phase13.sql` lines 45-56 (`is_summit_admin()`)
**Apply to:** `current_user_sub_trades()` + `sub_trade_id_intersects()` in `00030_sub_trades.sql`

```sql
create or replace function public.<helper_name>(...) returns <type>
  language sql
  stable
  security definer
  set search_path = public
as $$
  select ... from public.<table> where user_id = auth.uid();
$$;

comment on function public.<helper_name>() is
  'Phase X: <description>. CRITICAL: SQL body references <table> by NAME — recompile after any rename (CLAUDE.md learning 2026-05-08).';
```

**Why critical:** Per CLAUDE.md learning [2026-05-08] — Postgres `ALTER TABLE … RENAME` does NOT rewrite SQL function bodies. Add the comment as a future-proofing tripwire.

---

### Junction table + RLS read policy

**Source:** `supabase/migrations/00022_block_library_phase13.sql` (block_suggestions and related junction patterns)
**Apply to:** `users_sub_trades` and `sops_sub_trades` in `00030_sub_trades.sql`

Full DDL is specified in RESEARCH.md § Migration Strategy lines 798-839 — paste verbatim.

---

## No Analog Found

| File | Role | Data Flow | Reason / Mitigation |
|---|---|---|---|
| `src/hooks/useViewport.ts` | hook | matchMedia listener | Net-new. RESEARCH.md § Pattern 1 supplies full implementation. |
| `src/components/sop/walkthrough/WalkthroughSwitcher.tsx` | dynamic-import host | viewport-gated swap | Net-new (no prior dynamic-import-by-viewport in this codebase). RESEARCH.md § Pattern 2 supplies full sketch. |
| `src/lib/voice/sop-pack.ts` | shared serializer | pure function | Net-new. Closest pattern-of-purpose: `src/lib/builder/diff-block-content.ts`. RESEARCH.md § Code Examples lines 940-958 supplies full helper. |
| `scripts/capture-bundle-baseline.ts` + `scripts/check-bundle-size.ts` | CI scripts | file-I/O over `.next/app-build-manifest.json` | Net-new. RESEARCH.md § Code Examples lines 1010-1047 supplies full sketch. |
| Voice modal a11y wiring (focus trap, aria-live regions) | a11y additions inside WalkthroughVoiceModal | client-only | No focus-trap precedent in codebase (existing modals are minimal a11y). RESEARCH.md § Pattern 8 supplies spec. |

---

## Pattern Notes (cross-cutting reminders for the planner)

1. **Anthropic system-array form with `cache_control` is NEW** for this codebase — existing parsers use `system: string`. Phase 15 introduces `system: [{ type: 'text', text: ... }, { type: 'text', text: ..., cache_control: { type: 'ephemeral' } }]`. Document this in any plan that calls Anthropic.
2. **Pitfall 3 — cache key drift** is the highest-leverage hidden bug. Single `packSopForPrompt` helper imported by BOTH the answer call (`voice-qa.ts`) AND the verifier branch (`verify-sop.ts mode: 'voice_qa'`). Unit-test for `cache_read_input_tokens > 0` on Q2.
3. **Lazy-init Anthropic** (`let anthropic: Anthropic | null = null; function getAnthropic() { ... }`) — copy verbatim from `verify-sop.ts` lines 6-12 into any new file that imports `@anthropic-ai/sdk`. Failure to do this breaks Next.js builds.
4. **Manual `database.types.ts`** per CLAUDE.md learning [2026-05-08] — never auto-regen. Hand-add the three new tables + the `step_ack_trace` JSONB column.
5. **Migration helper-comment tripwires** — `current_user_sub_trades()` body references `users_sub_trades` by NAME. Per CLAUDE.md learning [2026-05-08], add a `comment on function …` warning future agents. Test the RPC end-to-end before declaring the migration complete.
6. **Mobile worker behaviour must remain byte-identical** — SPEC Constraint. `MobileWalkthrough.tsx` is the existing `WalkthroughTab.tsx` near-byte-identical; any drift breaks acceptance.
7. **No-static-import lint** — add a `tests/lint/no-static-desktop-import.spec.ts` that greps for static imports of `DesktopWalkthrough` and `WalkthroughVoiceModal` outside `WalkthroughSwitcher.tsx`. Pitfall 5 (research) — one missed static import silently defeats bundle isolation.
8. **Wave 0 baseline capture** — `scripts/capture-bundle-baseline.ts` MUST run on Phase-14-head BEFORE any Phase 15 file is created. Commit `.bundle-baseline.json` to the repo. Otherwise the CI check has nothing to compare against.
9. **Voice route auth** drops the admin role check (workers must ask questions) but keeps session + org checks. Sub-trade actions keep the admin role check.
10. **Local UAT must use `next build && next start`** per CLAUDE.md learning [2026-05-08] — `next dev` has a Windows file-lock race on `.next/server/app-paths-manifest.json` that breaks rapid Playwright navigation. Document in test setup.
11. **Mic icon** = `Mic` from `lucide-react` (matches Phase 12.5 voice-note button convention).
12. **PaperThemeMount is dead** (removed in Phase 14.5 cleanup) — body always ships `data-theme="paper"` at SSR. Do not add a theme mount around `DesktopWalkthrough`.

---

## Metadata

**Analog search scope:**
- `src/components/sop/` (walkthrough + tabs + blocks)
- `src/components/admin/blocks/` (Phase 13 multi-select + modal chrome)
- `src/app/api/sops/` (existing Anthropic-driven routes)
- `src/lib/parsers/` (Anthropic lazy-init + verifier pattern)
- `src/lib/voice/` (Deepgram client primitives)
- `src/lib/validators/` (Zod schema conventions)
- `src/stores/` (Zustand patterns)
- `src/actions/` (server action shape + admin gate)
- `supabase/migrations/00017, 00022, 00026, 00028, 00029` (RLS, SECURITY DEFINER helpers, seed vocab, idempotent ALTER patterns)

**Files scanned (with line ranges read):**
- `src/lib/parsers/verify-sop.ts` (1-130, full)
- `src/lib/parsers/gpt-parser.ts` (1-50, lazy-init pattern)
- `src/app/api/sops/ai-prompt/route.ts` (1-239, full)
- `src/components/sop/tabs/WalkthroughTab.tsx` (1-100)
- `src/components/sop/WalkthroughList.tsx` (1-80)
- `src/components/admin/blocks/BlockUpdateReviewModal.tsx` (1-220)
- `src/components/admin/blocks/BlockPicker.tsx` (1-200)
- `src/actions/blocks.ts` (1-220)
- `src/stores/walkthrough.ts` (1-85, full)
- `src/app/(protected)/sops/[sopId]/page.tsx` (1-80)
- `src/lib/validators/sop.ts` (1-80) + grep for `aiPromptSchema` (lines 159-168)
- `src/lib/validators/auth.ts` (1-46, full)
- `supabase/migrations/00022_block_library_phase13.sql` (1-120)
- `supabase/migrations/00017_multi_org_membership.sql` (1-58, full)
- `supabase/migrations/00029_ai_prompt_input_type.sql` (1-31, full)
- `graphify-out/GRAPH_REPORT.md` (1-227, full)

**Pattern extraction date:** 2026-05-12
