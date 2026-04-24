# New block types

The blueprint sketch introduces **8 block types** that are not in the Phase 12 palette. Each one must ship with full AI-accessibility — the **three-place contract** documented in `src/lib/builder/puck-config.tsx` is mandatory for every new block.

## The three-place contract

When adding a block type, you MUST update all three of the following. If the block is not in all three places, the AI `/api/schema` introspection endpoint will be out of sync and AI-authored SOPs will fail validation.

1. **`src/lib/builder/puck-config.tsx`** — register in `puckConfig.components`. Defines the palette entry, the render function, and the prop fields for Puck's side-panel editor.
2. **`src/actions/introspection.ts`** → `BLOCK_REGISTRY` — adds the block to the `/api/schema` response. Each entry is `{ schema, description, example }` where `schema` is the same Zod schema used by Puck.
3. **`src/lib/validators/blocks.ts`** → `BlockContentSchema` discriminated union — required if the block is stored in `sop_section_blocks.snapshot_content` (i.e. reusable block library entries). If the block type is layout-only (rendered inside `layout_data` and not stored as a reusable block), skip this third place but document the reason in the component file.

## Block inventory

Phase 12 has 7 blocks today: `TextBlock`, `HeadingBlock`, `PhotoBlock`, `CalloutBlock`, `StepBlock`, `HazardCardBlock`, `PPECardBlock`.

The 8 new types below are ordered by implementation priority (most foundational first).

### 1. MeasurementBlock

**Renders:** Orange-bordered measurement input box. Label + target value + unit + input field + mic button for voice capture.

**Where:**
- Inside StepBlock when a step requires a measurement
- As a flow-graph node (orange rounded rectangle, `--accent-measure`)

**Proposed props:**
```ts
z.object({
  label: z.string().min(1).max(120),        // "Oil pressure reading"
  target: z.number(),                        // 72.5
  unit: z.string().min(1).max(20),          // "psi" | "mm" | "°C"
  tolerance: z.number().nonnegative().optional(),  // ±2.5
  min: z.number().optional(),
  max: z.number().optional(),
  voiceEnabled: z.boolean().default(true),
})
```

**AI considerations:** AI-authored SOPs must know tolerance rules. Example in `BLOCK_REGISTRY`:
```ts
{ label: 'Oil pressure', target: 72.5, unit: 'psi', tolerance: 2.5, voiceEnabled: true }
```

**Validation result persistence:** captured value goes into `sop_completions.step_data` (the existing `StepDataSchema` record) — we'd need to extend `StepDataSchema` from `z.record(z.string(), z.number())` to `z.record(z.string(), z.union([z.number(), z.object({ value: z.number(), unit: z.string() })]))` to preserve units. Call that out in spec-phase.

### 2. DecisionBlock

**Renders:** A yes/no decision card. Two full-width decision buttons (green YES, red NO). Pink `--accent-decision` border.

**Where:**
- Inside a StepBlock when the procedure branches
- As a flow-graph node (pink diamond shape)

**Proposed props:**
```ts
z.object({
  question: z.string().min(1).max(280),
  yesLabel: z.string().default('YES'),
  noLabel: z.string().default('NO'),
  yesNextStepId: z.string().uuid().optional(),    // for flow-graph branching
  noNextStepId: z.string().uuid().optional(),
  criticalOnNo: z.boolean().default(false),       // if true, NO triggers EscalateBlock
})
```

**AI considerations:** the branching edges (`yesNextStepId`, `noNextStepId`) let AI reconstruct the flow graph. The `criticalOnNo` flag tells AI when a NO is a stop-the-line decision.

### 3. EscalateBlock

**Renders:** Red `--accent-hazard` card with "ESCALATE" header, reason text, and an acknowledgement button that triggers a supervisor alert.

**Where:**
- As the target of a DecisionBlock `criticalOnNo` branch
- As a flow-graph node (red rectangle)

**Proposed props:**
```ts
z.object({
  reason: z.string().min(1).max(500),
  supervisorRoles: z.array(z.enum(['supervisor', 'safety_manager', 'admin'])).min(1),
  haltProcedure: z.boolean().default(true),
})
```

**AI considerations:** When the AI composes a SOP with EscalateBlocks, it must attach at least one supervisor role. `haltProcedure: true` means the worker cannot advance past this step until a supervisor signs off (ties into SignOffBlock).

**Side effect:** triggering this block creates a row in `worker_notifications` (existing table from Phase 3) with `type: 'escalation'`.

### 4. SignOffBlock

**Renders:** Yellow `--accent-signoff` card with role-required label ("OPERATOR SIGN-OFF" / "SUPERVISOR SIGN-OFF"), signature capture area, and acknowledgement button.

**Where:**
- End of a section (per the sketch's sign-off chain)
- As a flow-graph node (yellow rectangle)

**Proposed props:**
```ts
z.object({
  role: z.enum(['worker', 'supervisor', 'safety_manager', 'admin']),
  label: z.string().default('Sign-off'),
  requirePhoto: z.boolean().default(false),        // optional photo + signature
  requireNote: z.boolean().default(false),         // optional text note
})
```

**AI considerations:** Sign-offs are immutable once submitted — they write to `completion_sign_offs` (existing table from Phase 4). AI-authored SOPs must place these at the correct points in the flow; the existing Phase-6 adversarial verifier (Claude cross-check) should flag SOPs that lack a worker sign-off at the end.

### 5. ZoneBlock

**Renders:** Amber `--brand-yellow` header band with zone name (e.g. "ZONE: Assembly bay B"). Visually groups subsequent blocks until the next ZoneBlock or section boundary.

**Where:**
- Inside sections to spatially group steps
- As a flow-graph container (amber-tinted region around its child nodes)

**Proposed props:**
```ts
z.object({
  zone: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
})
```

**AI considerations:** Lightweight layout primitive. Most relevant for the flow tab — AI composing a flow graph should group physically co-located steps in the same zone for spatial clarity.

### 6. InspectBlock

**Renders:** Cyan `--accent-mcu` card with inspection checklist + optional photo capture. Subset of StepBlock focused on visual inspection.

**Where:**
- Pre-start and post-operation inspection steps
- As a flow-graph node (cyan-bordered rectangle)

**Proposed props:**
```ts
z.object({
  subject: z.string().min(1).max(120),            // "Guard for damage"
  checklist: z.array(z.string().min(1).max(280)).min(1).max(10),
  requirePhoto: z.boolean().default(true),
  photoAnnotation: z.boolean().default(false),    // tie to Phase 16 annotation later
})
```

**AI considerations:** Inspection is a common SOP pattern. AI-authored SOPs should use InspectBlock instead of plain StepBlock when the step is pre-operational "check X".

### 7. VoiceNoteBlock

**Renders:** Mic button embedded in a step body. When tapped, opens the voice capture overlay (idle → listening → transcribing → captured). The persisted transcript renders as an italic note card below the button.

**Where:**
- Inside any step body where a worker might want to leave a free-form note
- Also available as part of MeasurementBlock (voice-populated numeric value)

**Proposed props:**
```ts
z.object({
  prompt: z.string().max(120).optional(),          // "Describe what you see"
  language: z.enum(['en-NZ', 'en-AU', 'en-US']).default('en-NZ'),
  maxDuration: z.number().int().positive().max(120).default(60),  // seconds
})
```

**AI considerations:** The transcript goes to a new table (proposed `sop_voice_notes` — not yet designed) or is appended to `sop_completions.notes`. Defer the storage shape to spec-phase.

### 8. ModelBlock

**Renders:** 3D viewer (three.js / react-three-fiber). Left sidebar with layer toggles + hotspot pins; right canvas.

**Where:**
- Only in the Model tab (not inline in steps — too heavy)
- Hotspot pins can reference step IDs to jump into walkthrough

**Proposed props:**
```ts
z.object({
  assetUrl: z.string().url(),                      // .glb or .usdz
  hotspots: z.array(z.object({
    id: z.string().uuid(),
    label: z.string().min(1).max(120),
    position: z.object({ x: z.number(), y: z.number(), z: z.number() }),
    stepId: z.string().uuid().optional(),          // jumps to this step on tap
  })).default([]),
  defaultLayers: z.array(z.string()).default([]),
})
```

**AI considerations:** ModelBlock is the heaviest addition — it requires a 3D asset pipeline, probably a separate upload flow. **Strong recommendation:** defer to Phase 12.6 or later. In Phase 12.5, register the block type in the three-place contract but gate the React implementation behind a feature flag so the palette entry exists for schema completeness without blocking the redesign release.

## Consolidated three-place contract update

When Phase 12.5 adds these blocks, the changes look like:

### 1. `src/lib/builder/puck-config.tsx`
```tsx
import {
  // ... existing imports
  MeasurementBlock, MeasurementBlockPropsSchema, type MeasurementBlockProps,
  DecisionBlock, DecisionBlockPropsSchema, type DecisionBlockProps,
  EscalateBlock, EscalateBlockPropsSchema, type EscalateBlockProps,
  SignOffBlock, SignOffBlockPropsSchema, type SignOffBlockProps,
  ZoneBlock, ZoneBlockPropsSchema, type ZoneBlockProps,
  InspectBlock, InspectBlockPropsSchema, type InspectBlockProps,
  VoiceNoteBlock, VoiceNoteBlockPropsSchema, type VoiceNoteBlockProps,
  // ModelBlock registered with feature flag check
} from '@/components/sop/blocks'

export const puckConfig: Config = {
  components: {
    // ... existing 7 blocks
    MeasurementBlock: { fields: {...}, render: ({ puck, ...props }) => <SafeRender block={MeasurementBlock} schema={MeasurementBlockPropsSchema} {...props} /> },
    DecisionBlock: { /* same pattern */ },
    EscalateBlock: { /* same pattern */ },
    SignOffBlock: { /* same pattern */ },
    ZoneBlock: { /* same pattern */ },
    InspectBlock: { /* same pattern */ },
    VoiceNoteBlock: { /* same pattern */ },
  },
}
```

### 2. `src/actions/introspection.ts` → `BLOCK_REGISTRY`
```ts
const BLOCK_REGISTRY: Record<string, { schema: z.ZodTypeAny; description: string; example: Record<string, unknown> }> = {
  // ... existing 7 entries
  MeasurementBlock: {
    schema: MeasurementBlockPropsSchema,
    description: 'Numeric measurement capture with target + tolerance + optional voice input.',
    example: { label: 'Oil pressure', target: 72.5, unit: 'psi', tolerance: 2.5, voiceEnabled: true },
  },
  DecisionBlock: {
    schema: DecisionBlockPropsSchema,
    description: 'Binary YES/NO decision with optional branching to next step and critical-on-no flag.',
    example: { question: 'Is the guard securely locked?', criticalOnNo: true },
  },
  // ... etc for all 8
}
```

### 3. `src/lib/validators/blocks.ts` → `BlockContentSchema`
```ts
export const BlockContentSchema = z.discriminatedUnion('kind', [
  // ... existing 5-7 variants
  z.object({ kind: z.literal('measurement'), ...MeasurementBlockPropsSchema.shape }),
  z.object({ kind: z.literal('decision'), ...DecisionBlockPropsSchema.shape }),
  z.object({ kind: z.literal('escalate'), ...EscalateBlockPropsSchema.shape }),
  z.object({ kind: z.literal('signoff'), ...SignOffBlockPropsSchema.shape }),
  z.object({ kind: z.literal('zone'), ...ZoneBlockPropsSchema.shape }),
  z.object({ kind: z.literal('inspect'), ...InspectBlockPropsSchema.shape }),
  z.object({ kind: z.literal('voice_note'), ...VoiceNoteBlockPropsSchema.shape }),
  // ModelBlock — deferred; only needed if stored as reusable library block, which it shouldn't be
])
```

## Flow graph data shape

The flow tab needs a new data structure. Two options (open question for spec-phase):

### Option A: derive from existing section/step topology + block types

Walk `sop_sections → sop_steps → layout_data.content[].type` and build the node list. Edges come from:
- Sequential edges: step N → step N+1 by `sort_order`
- Branching edges: DecisionBlock's `yesNextStepId` / `noNextStepId`
- Escalation edges: EscalateBlock's position as the target of a `criticalOnNo` branch

**Pros:** single source of truth, zero migration.
**Cons:** derivation is non-trivial, performance cost on every flow-tab render.

### Option B: explicit `sops.flow_graph` JSONB column

New column stores the node + edge list directly:
```ts
{
  nodes: [{ id, type, label, position: {x, y}, stepId? }, ...],
  edges: [{ from, to, kind: 'sequential' | 'yes' | 'no' | 'escalate' }, ...],
}
```

**Pros:** fast render, explicit positioning.
**Cons:** must be kept in sync with the section/step topology; AI authoring has two writes.

**Recommendation for spec-phase:** start with Option A (derive) + cache the derived graph in an in-memory / TanStack-Query layer. Add Option B only if performance requires it.

## Summary for the AI introspection endpoint

Once Phase 12.5 ships, `GET /api/schema` response will include **15 block types** (7 existing + 7 new non-Model + Model pending feature flag). Each with full JSON-Schema props, description, and example. This makes the AI agent authoring story complete for every block a SOP can contain.

## Origin

Synthesized from `sources/blueprint-sketch.html` flow SVG (lines 988-1200), measurement UI (1693-1760), decision UI (1762-1800), sign-off chain in overview (587-660), and all mobile step screenshots. Three-place contract derived from `src/lib/builder/puck-config.tsx:399-418` comment block.
