# Layout primitives

Reusable UI patterns extracted from the sketch. Each becomes a React component during Phase 12.5 execution. Class names shown here match the sketch HTML — use the same semantic names in the React port so tests can cross-reference.

## Pills

Two variants — outline (default) and filled. Used for status labels, hazard severity, step counters, zone tags, timestamps.

### Outline pill

```css
.pill {
  display: inline-flex; align-items: center; gap: 4px;
  border: 1px solid currentColor;
  padding: 2px 8px; font-size: 10px; letter-spacing: 0.08em;
  text-transform: uppercase; font-weight: 500;
  border-radius: 2px;
}
```

Color comes from `currentColor` — wrap in a parent with the desired text color (e.g. `text-accent-hazard`).

### Filled pill

```css
.pill-filled { background: currentColor; }
.pill-filled > * { color: #fff; mix-blend-mode: normal; }
```

Use when the pill needs to dominate (e.g. current-step indicator in walkthrough header).

**React port sketch:**
```tsx
<span className="pill text-accent-hazard">
  <AlertTriangle size={10} />
  CRITICAL
</span>
```

Source: `sources/blueprint-sketch.html:50-60`.

## Tab buttons

Primary navigation between the 6 canonical tabs (overview, tools, hazards, flow, model, walkthrough).

```css
.tab {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 12px; font-size: 11px;
  letter-spacing: 0.06em; text-transform: uppercase; font-weight: 500;
  border-radius: 2px;
  color: var(--ink-500);
  background: transparent;
}
.tab.active {
  background: var(--ink-900); color: #fff;
}
.tab:hover:not(.active) {
  color: var(--ink-900); background: var(--paper-2);
}
```

Tab list lives in a `<nav>` at the top of the viewport with a bottom hairline border:
```css
border-bottom: 1px solid var(--ink-300);
```

Source: `sources/blueprint-sketch.html:485-510, 1481-1496`.

## Card / frame

Base card pattern for section content. Uses a 1.5px border (sharper than standard 1px) to match the engineering-drawing look.

```css
.frame {
  border: 1.5px solid var(--ink-300);
  background: var(--paper);
  padding: 24px;
  border-radius: 4px;
}
```

Semantic variants change only the border color:
- Hazard card: `border-color: var(--accent-hazard)` + red-tinted background (`rgba(239, 68, 68, 0.05)`)
- Measurement card: `border-color: var(--accent-measure)`
- Decision card: `border-color: var(--accent-decision)`
- Sign-off card: `border-color: var(--accent-signoff)`

**Header strip** (at top of each card):
```html
<div class="flex items-center justify-between mb-4 pb-2 border-b border-ink-300">
  <span class="mono text-[11px] uppercase tracking-wide text-ink-500">{card.type}</span>
  <span class="pill text-ink-500">{card.id}</span>
</div>
```

Source: `sources/blueprint-sketch.html:587-660` (overview hero card), `855-960` (hazard cards).

## Evidence button

Dashed-border capture button. Used in walkthrough step cards for photo / voice / measurement / signature capture. Transitions from dashed (empty) to solid green (captured).

```css
.evidence-btn {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 8px;
  border: 1px dashed var(--ink-300);
  background: var(--paper);
  color: var(--ink-500);
  padding: 16px;
  border-radius: 4px;
  min-height: 80px;
  font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em;
  cursor: pointer;
  transition: all 120ms;
}
.evidence-btn:hover { border-color: var(--ink-700); color: var(--ink-900); }
.evidence-btn.captured {
  border-style: solid;
  border-color: var(--accent-ok);
  background: rgba(16, 185, 129, 0.08);
  color: var(--accent-ok);
}
```

**Layout:** evidence buttons live in a 2-column grid on desktop, 1-column on mobile. Source: lines 1403-1438 (walkthrough evidence grid), 1810-1862 (mobile evidence capture UI).

## Measurement box

Specialized input for capturing a numeric measurement with an optional voice-capture mic. Orange border reinforces the semantic role.

```css
.measurement-box {
  border: 1.5px solid var(--accent-measure);
  background: rgba(249, 115, 22, 0.04);
  border-radius: 4px;
  padding: 16px;
  display: flex; flex-direction: column; gap: 12px;
}
.measurement-box label {
  font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em;
  color: var(--accent-measure); font-weight: 600;
}
.measurement-box input {
  font-family: 'JetBrains Mono', monospace;
  font-size: 20px; font-weight: 500;
  background: transparent; border: none; outline: none;
  color: var(--ink-900);
}
.measurement-box .mic-btn {
  width: 40px; height: 40px; border-radius: 50%;
  border: 1px solid var(--accent-measure);
  background: transparent;
  display: flex; align-items: center; justify-content: center;
}
```

The mic-btn cycles through states (idle, listening, transcribing, captured) — see `references/interaction-patterns.md` for the state machine.

Source: `sources/blueprint-sketch.html:1693-1760` (measurement UI inside mobile step), `1801-1862` (voice capture state transitions).

## Decision buttons

Binary YES/NO buttons for decision steps. Full-width, color-coded.

```css
.decision-btn {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  flex: 1;
  border: 1px solid currentColor;
  padding: 14px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.1em;
  border-radius: 4px;
  cursor: pointer;
  transition: all 120ms;
}
.decision-btn.yes { color: var(--accent-ok); }
.decision-btn.yes:hover { background: var(--accent-ok); color: #fff; }
.decision-btn.no { color: var(--accent-hazard); }
.decision-btn.no:hover { background: var(--accent-hazard); color: #fff; }
```

**Layout:** flex row, 12px gap. Source: lines 1762-1800 (decision step block).

## Grid-paper canvas

Used as the background for the flow SVG, 3D model viewport, and some walkthrough step cards. Both light and dark variants.

Light (default, for paper-palette screens):
```html
<div class="bg-grid w-full h-full">{canvas content}</div>
```

Dark (for preview toggle when MOBILE is active over a dark chrome strip):
```html
<div class="bg-grid-dark w-full h-full">{canvas content}</div>
```

CSS in `references/design-tokens.md` under "Grid-paper backgrounds".

## Modal / overlay (cmdk)

Command palette modal. 640px wide, centered, paper-themed. Triggered by `Cmd/Ctrl + K`.

```html
<div class="fixed inset-0 bg-black/40 flex items-start justify-center pt-24 z-50">
  <div class="w-[640px] bg-paper border border-ink-300 rounded-md shadow-xl overflow-hidden">
    <!-- search input -->
    <div class="border-b border-ink-300 p-3 flex items-center gap-3">
      <Search size={14} class="text-ink-500" />
      <input class="flex-1 bg-transparent outline-none mono text-sm" placeholder="JUMP TO STEP, ASK AI, FIND TOOL OR HAZARD...">
    </div>
    <!-- result groups (JUMP TO STEP, ASK AI, TOOLS & HAZARDS) -->
    <div class="max-h-[400px] overflow-y-auto">...</div>
  </div>
</div>
```

Source: `sources/blueprint-sketch.html:1449-1477`.

## Mobile immersive step card

Full-screen card on phones (430px width) with three zones: header, body, sticky nav.

```html
<div class="fixed inset-0 bg-paper flex flex-col">
  <!-- header: breadcrumb + progress -->
  <div class="border-b border-ink-300 p-4 flex items-center justify-between bg-steel-900 text-white">
    <button class="mono text-[11px] uppercase">{section.title} / step {n}</button>
    <span class="mono text-[11px]">{n}/{total}</span>
  </div>
  <!-- body -->
  <div class="flex-1 overflow-y-auto p-6">{step content}</div>
  <!-- sticky footer -->
  <div class="border-t border-ink-300 p-4 flex gap-3">
    <button class="flex-1 border border-ink-300 py-3">PREV</button>
    <button class="flex-1 bg-ink-900 text-white py-3">NEXT</button>
  </div>
</div>
```

Key behaviour:
- Progress counter `n/total` in the top-right of the header
- Breadcrumb doubles as a section-jump dropdown (tap to open)
- PREV / NEXT never scroll; they're in a sticky footer
- Evidence buttons scroll inside the body

Source: `sources/blueprint-sketch.html:1300-1442`.

## Sticky CTA on mobile walkthrough

A dedicated "Tap to acknowledge / Continue" bar that pins to the bottom above the PREV/NEXT footer during hazard / sign-off gates.

```html
<div class="sticky bottom-0 bg-accent-signoff p-4 text-center mono uppercase text-[12px] font-semibold">
  TAP TO ACKNOWLEDGE HAZARDS
</div>
```

Only renders when the current step is a gate (HazardCardBlock with `ack_required`, SignOffBlock, or EscalateBlock). Source: lines 1444-1476.

## Where to place the React ports

During Phase 12.5 execution, map these primitives to:

| Primitive | Proposed file |
|-----------|---------------|
| Pill | `src/components/ui/Pill.tsx` (generic; use for both outline and filled via prop) |
| Tab nav | `src/components/sop/TabNav.tsx` |
| Frame / card | `src/components/sop/BlueprintFrame.tsx` (semantic variants via prop) |
| Evidence button | `src/components/sop/EvidenceButton.tsx` |
| Measurement box | Part of `src/components/sop/blocks/MeasurementBlock.tsx` (see `references/new-block-types.md`) |
| Decision buttons | Part of `src/components/sop/blocks/DecisionBlock.tsx` |
| Grid-paper canvas | `src/components/sop/BlueprintCanvas.tsx` (wrapper with `light` / `dark` variant) |
| Cmdk modal | `src/components/sop/CommandPalette.tsx` |
| Mobile immersive step card | `src/components/sop/walkthrough/ImmersiveStepCard.tsx` |

## Origin

Synthesized from `sources/blueprint-sketch.html:50-82` (CSS rules) + inline component usage across the 2015-line sketch. Cross-referenced against `sketch-01-overview.png` through `sketch-07-cmdk.png` and `sketch-mobile-*.png`.
