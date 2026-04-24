# Design tokens

All tokens extracted from `sources/blueprint-sketch.html` `<style>` block (lines 11-82). These are the canonical values — if you need to port the sketch, these are the source of truth.

## Palette

| Token | Value | Used for |
|-------|-------|----------|
| `--brand-yellow` | `#fbbf24` | Brand accent; sign-off nodes; yellow CTA buttons |
| `--steel-900` | `#0a0a0b` | Dark chrome (top bar, mobile immersive step-card header) |
| `--steel-800` | `#141416` | Secondary dark surfaces |
| `--steel-700` | `#1f1f22` | Borders, dividers, muted backgrounds on dark surfaces |
| `--steel-600` | `#2a2a2e` | Hairline borders on dark surfaces |
| `--paper` | `#fafafa` | Primary worker-facing background (all tabs except dark chrome strips) |
| `--paper-2` | `#f4f4f5` | Secondary paper surface (card bodies, hover states) |
| `--ink-900` | `#09090b` | Primary text on paper surfaces |
| `--ink-700` | `#3f3f46` | Secondary text |
| `--ink-500` | `#71717a` | Muted text, labels, timestamps |
| `--ink-300` | `#d4d4d8` | Hairline borders on paper surfaces |

## Semantic accents

Each accent maps to exactly one role. Never use them decoratively.

| Token | Value | Role | Where it appears |
|-------|-------|------|------------------|
| `--accent-mcu` | `#06b6d4` | MCU / inspect / focus | Inspect nodes in flow graph; selected-step indicator |
| `--accent-measure` | `#f97316` | Measurement | Measurement nodes (flow), measurement box borders (walkthrough), measurement result pills |
| `--accent-decision` | `#ec4899` | Decision / branch | Decision diamond nodes (flow); YES/NO button group |
| `--accent-hazard` | `#ef4444` | Hazard / escalation | Hazard cards; escalate nodes; voice-listening pulse ring |
| `--accent-signoff` | `#fbbf24` | Sign-off | Sign-off nodes (flow); operator/supervisor sign-off badges; same hue as brand-yellow but semantically distinct |
| `--accent-step` | `#3b82f6` | Procedural step | Step nodes in flow graph |
| `--accent-ok` | `#10b981` | Completion / captured | Evidence buttons after capture; decision YES button; green checkmarks |

## Typography

| Role | Font | Fallback stack | Weights loaded |
|------|------|----------------|----------------|
| Mono (default body) | `'JetBrains Mono'` | `ui-monospace, monospace` | 300, 400, 500, 600, 700 |
| Prose (long-form descriptions, hazard body text) | `'Inter'` | `system-ui, sans-serif` | 400, 500, 600 |

Applied via utility classes:
```css
html, body { font-family: 'JetBrains Mono', ui-monospace, monospace; }
.prose { font-family: 'Inter', system-ui, sans-serif; }
.mono { font-family: 'JetBrains Mono', monospace; }
```

**Rule:** Technical content (IDs, step numbers, measurements, timestamps, tool names, hazard codes) uses mono by default. Long-form human-readable prose (step descriptions, hazard explanations, sign-off notes) switches to Inter via the `.prose` class on the content wrapper.

Fonts loaded via Google Fonts:
```html
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
```

In Next.js production, replace with `next/font/google` imports to eliminate the render-blocking link.

## Grid-paper backgrounds

Two variants — light (`.bg-grid`) and dark (`.bg-grid-dark`). Used on flow canvas, 3D model canvas, and the mobile immersive walkthrough when the content is a diagram.

```css
.bg-grid {
  background-color: #ffffff;
  background-image:
    linear-gradient(to right, rgba(0,0,0,0.04) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(0,0,0,0.04) 1px, transparent 1px);
  background-size: 20px 20px;
}

.bg-grid-dark {
  background-color: var(--steel-900);
  background-image:
    linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px);
  background-size: 20px 20px;
}
```

**Grid spacing:** 20px is the canonical unit. All node positioning in the flow SVG snaps to 20px multiples. If you extend the flow with new node types, preserve this grid.

## Border radii

The sketch favours small radii — this reinforces the engineering-drawing aesthetic (no rounded consumer-app corners).

| Role | Radius |
|------|--------|
| Pills | `2px` |
| Tab buttons | `2px` |
| Cards / frames | `4px` or no radius |
| Input fields | `2px` |
| Buttons (primary CTAs) | `4px` |
| Modals / sheets | `6px` maximum |

Any component with a radius > 8px is off-theme — revert it.

## Spacing

No explicit spacing scale in the sketch beyond Tailwind defaults. Follow Tailwind's default spacing (4px increments). Common values used in the sketch:
- Card padding: `24px` (p-6) for desktop, `16px` (p-4) for mobile
- Section gap: `32px` (gap-8) between cards
- Pill internal padding: `2px 8px`
- Tab internal padding: `6px 12px`

## Export as CSS custom properties

When implementing, lift the `:root` block from `sources/blueprint-sketch.html:11-82` into `src/app/globals.css` (or a new `src/styles/blueprint-theme.css` imported from `src/app/layout.tsx`). Then expose the accents to Tailwind via `tailwind.config.ts`:

```ts
theme: {
  extend: {
    colors: {
      paper: { DEFAULT: 'var(--paper)', 2: 'var(--paper-2)' },
      ink: {
        900: 'var(--ink-900)', 700: 'var(--ink-700)',
        500: 'var(--ink-500)', 300: 'var(--ink-300)',
      },
      accent: {
        mcu: 'var(--accent-mcu)',
        measure: 'var(--accent-measure)',
        decision: 'var(--accent-decision)',
        hazard: 'var(--accent-hazard)',
        signoff: 'var(--accent-signoff)',
        step: 'var(--accent-step)',
        ok: 'var(--accent-ok)',
      },
    },
    fontFamily: {
      mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      prose: ['Inter', 'system-ui', 'sans-serif'],
    },
  },
}
```

The existing Phase 12 `steel-*` and `brand-yellow` tokens stay in place — the blueprint palette is additive, not replacing. Admin surfaces (builder, library) keep the dark steel theme; worker-facing surfaces (walkthrough and everything the redesign covers) use the new paper/ink palette.

## Origin

Synthesized from `sources/blueprint-sketch.html` lines 11-82 (`:root` block) and lines 36-49 (typography + grid-paper rules). Cross-referenced against screenshots `sketch-01-overview.png` through `sketch-07-cmdk.png` for semantic usage validation.
