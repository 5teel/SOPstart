# Phase 12: Builder Shell & Blank-Page Authoring - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-24
**Phase:** 12-builder-shell-blank-page-authoring
**Areas discussed:** Builder chrome + preview toggle, Dexie draft granularity + sync, Block component API + schema placement, Malformed data + unknown block resilience

---

## Area selection

| Option | Description | Selected |
|--------|-------------|----------|
| Builder chrome + preview toggle | Chrome around Puck canvas, preview toggle port from sketch | ✓ |
| Dexie draft granularity + sync | Row shape, cadence, conflict, retention | ✓ |
| Block component API + schema placement | Zod schemas, mode detection, export shape, styling | ✓ |
| Malformed data + unknown block resilience | Unknown types, bad props, bad JSON, admin surfacing | ✓ |

**User's choice:** All four areas selected.

---

## Area 1: Builder chrome + preview toggle

### Q1.1 — Port the sketch's desktop/mobile preview toggle?

| Option | Description | Selected |
|--------|-------------|----------|
| Port it — persistent top bar | Reuse sketch's DESKTOP/MOBILE toggle; 430px phone frame when mobile; Tailwind-only reflow; zero new design work | ✓ |
| Port it — only inside a dedicated 'Preview' mode | Preview mode toggle wraps the canvas in a device frame | |
| Skip — rely on browser devtools responsive mode | No in-app toggle | |

**User's choice:** Port it — persistent top bar (Recommended)
**Notes:** Reuses sketch commit 64f1bec. Keeps SPEC's Tailwind-only reflow constraint intact.

### Q1.2 — How does admin switch between SOP sections?

| Option | Description | Selected |
|--------|-------------|----------|
| Left sidebar with draggable section list | Puck sidebar idiom; drag handles do reorder (SB-SECT-05) | ✓ |
| Top tab strip (one tab per section) | Horizontal tabs; doesn't scale past ~6 sections | |
| Single scrolling canvas (no switcher) | All sections vertical; awkward for long SOPs | |

**User's choice:** Left sidebar with draggable section list (Recommended)
**Notes:** Matches sketch's left-sidebar pattern + serves double duty as the drag-reorder affordance.

### Q1.3 — Save-state indicator placement & copy?

| Option | Description | Selected |
|--------|-------------|----------|
| Top-right chrome, mono pill | `SAVED 2s AGO` / `SAVING…` / `OFFLINE · QUEUED` | ✓ |
| Bottom status strip | VS-Code-style bottom strip | |
| Inline per-block 'saved' tick | Per-block ticks during editing | |

**User's choice:** Top-right chrome, mono pill (Recommended)
**Notes:** Matches sketch aesthetic; always visible without stealing canvas space.

### Q1.4 — Publish gate wiring?

| Option | Description | Selected |
|--------|-------------|----------|
| 'Send to Review' → existing review page | Single source of truth; preserves Phase 2 publish gate | ✓ |
| Inline publish modal in the builder | Saves one nav step but duplicates UI | |
| Auto-publish on 'Mark Ready' | Skips review; conflicts with SPEC SB-AUTH-05 — rejected | |

**User's choice:** 'Send to Review' button → existing review page (Recommended)
**Notes:** Ensures both upload and builder paths use the same `publishSop` action per SPEC.

---

## Area 2: Dexie draft granularity + sync

### Q2.1 — Dexie draft table shape — row granularity?

| Option | Description | Selected |
|--------|-------------|----------|
| Row per section | Keyed by `section_id`; 1:1 with Supabase rows; enables partial sync | ✓ |
| Row per SOP (full layout blob) | Fewer writes but re-serialises whole SOP on every edit | |
| Row per block (fully normalised) | Most granular; reassembly needed for Puck | |

**User's choice:** Row per section (Recommended)
**Notes:** Pairs with sync-engine's per-record flush pattern.

### Q2.2 — Auto-save cadence — confirm SPEC defaults or override?

| Option | Description | Selected |
|--------|-------------|----------|
| Confirm SPEC: 750ms Dexie / 3s Supabase | Matches Phase 3 sync-engine | ✓ |
| Tighter: 300ms Dexie / 1s Supabase | More responsive, more writes | |
| Looser: 2s Dexie / 10s Supabase | Fewer writes but admin feels save delay | |

**User's choice:** Confirm SPEC defaults (Recommended)
**Notes:** No override needed.

### Q2.3 — Reconnect conflict resolution?

| Option | Description | Selected |
|--------|-------------|----------|
| Last-write-wins by client timestamp | Local updated_at vs server updated_at; remote-newer overwrites local with toast | ✓ |
| Local-always-wins (force push) | Risks stomping a parallel edit | |
| Show merge UI on conflict | Proper collab — Phase 17 scope | |

**User's choice:** Last-write-wins by client timestamp (Recommended)
**Notes:** Matches SPEC's LWW constraint; quiet toast `Updated by another admin` when remote wins.

### Q2.4 — Dexie retention after successful server ack?

| Option | Description | Selected |
|--------|-------------|----------|
| Keep as offline cache, purge on publish | Row persists during authoring; moves to `sopCache` on publish | ✓ |
| Purge immediately on server ack | Smallest footprint but loses offline authoring | |
| Keep indefinitely | Simplest; Dexie bloats over months | |

**User's choice:** Keep as offline cache, purge on publish (Recommended)
**Notes:** Bounds Dexie growth to active drafts only.

---

## Area 3: Block component API + schema placement

### Q3.1 — Where do Zod schemas for block props live?

| Option | Description | Selected |
|--------|-------------|----------|
| Co-located per block file | `TextBlock.tsx` exports both `TextBlock` and `TextBlockPropsSchema` | ✓ |
| Central `src/lib/validators/blocks.ts` registry | Clearer overview but awkward imports | |
| Inline in Puck config only | Worker rendering would need to duplicate shapes | |

**User's choice:** Co-located per block file (Recommended)
**Notes:** Self-contained blocks; Puck config imports from each.

### Q3.2 — How do blocks know admin vs worker (if at all)?

| Option | Description | Selected |
|--------|-------------|----------|
| Environment-agnostic — no mode detection | Blocks stay pure; admin affordances in Puck Fields | ✓ |
| Context provider: `<BuilderModeProvider>` | Flexible but risks branching sprawl | |
| Prop: `mode: 'admin' \| 'worker'` | Pollutes every block's prop type | |

**User's choice:** Environment-agnostic — no mode detection (Recommended)
**Notes:** Enforces SPEC's "single component tree" grep assertion.

### Q3.3 — Block component export shape?

| Option | Description | Selected |
|--------|-------------|----------|
| Named function export + named schema | `export function TextBlock` + `export const TextBlockPropsSchema` | ✓ |
| Default export component, named schema | Requires renaming on import | |
| Class component with static schema | Not idiomatic; rejected | |

**User's choice:** Named function export + named schema (Recommended)
**Notes:** Matches SPEC acceptance grep pattern.

### Q3.4 — How do blocks receive styling?

| Option | Description | Selected |
|--------|-------------|----------|
| Inside the block, no external className | Blocks own all Tailwind; HTML diff is clean | ✓ |
| Accept optional className merging | Opens door to admin/worker visual drift | |
| Tailwind via composer wrapper in Puck config | Tight coupling between config and render | |

**User's choice:** Inside the block, no external className (Recommended)
**Notes:** Guarantees admin/worker HTML parity for SPEC's "identical rendering" test.

---

## Area 4: Malformed data + unknown block resilience

### Q4.1 — Unknown block type in layout_data?

| Option | Description | Selected |
|--------|-------------|----------|
| Skip the single block, render the rest | Grey placeholder; single warning logged | ✓ |
| Full linear fallback for whole section | Safer but workers lose layout on every augmented SOP | |
| Refuse to render the SOP — hard error | Single bad block breaks walkthrough — rejected | |

**User's choice:** Skip single block + placeholder (Recommended)

### Q4.2 — Invalid or missing props on a known block?

| Option | Description | Selected |
|--------|-------------|----------|
| Render block with visible empty-state, log warning | Photo without src → "Photo missing"; worker sees section structure | ✓ |
| Skip the block entirely | Worker can't tell something is missing — safety risk | |
| Block throws, error boundary catches | Heavy for 7-block set; error log noise | |

**User's choice:** Render with empty-state + log warning (Recommended)

### Q4.3 — Structurally broken layout_data (Zod parse failure)?

| Option | Description | Selected |
|--------|-------------|----------|
| Full fallback to legacy linear renderer + warning | Matches SPEC fallback intent (SB-LAYOUT-06) | ✓ |
| Show error banner, refuse to render section | Hides SOP content entirely | |
| Attempt best-effort partial render | Too many edge cases | |

**User's choice:** Full fallback to linear renderer (Recommended)

### Q4.4 — Admin-side error surfacing inside the builder?

| Option | Description | Selected |
|--------|-------------|----------|
| Inline red-outline per block + section-level toast | VS-Code-style diagnostics | ✓ |
| Silent in builder, fail only at publish time | Surprises admin at publish | |
| Dedicated 'Issues' panel | Over-built for MVP | |

**User's choice:** Inline red-outline per block + section-level toast (Recommended)

---

## Claude's Discretion

- **Wizard flow (client vs server per step)** — not discussed; default client-only stepper committing on final submit.
- **Puck version pin** — researcher picks latest stable; exact version pin in `package.json`.
- **`reorderSections` atomicity** — default single Supabase transaction; sequence-bump pattern as fallback.
- **Block inline editor UX** — default Puck standard side-panel.

## Deferred Ideas

- Wizard resumability across tab close (sessionStorage or Dexie `draftWizards`)
- Block inline comments for admins (Phase 17 scope)
- Puck's auto-generated preview from fields (out of scope — blocks render their own preview)
- Custom admin tokens / per-org theming (Phase 99.x)

## Reviewed Todos

None — `todo.match-phase` returned no matches for Phase 12.
