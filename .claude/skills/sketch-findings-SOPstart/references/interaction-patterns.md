# Interaction patterns

The three non-visual design decisions in the sketch. These are patterns the Phase 12.5 execution must preserve verbatim — they're the "feel" of the redesign, not the look.

## 1. Voice capture state machine

The single most distinctive interaction. Lets a worker populate a measurement or leave a note hands-free.

### States

```
┌─────────┐   tap mic   ┌───────────┐  silence (2s) ┌───────────────┐
│  IDLE   │ ──────────> │ LISTENING │ ────────────> │ TRANSCRIBING  │
│         │             │           │               │               │
└─────────┘             └─────┬─────┘               └───────┬───────┘
     ▲                        │                             │
     │                        │ tap mic (cancel)            │ result
     │                        ▼                             ▼
     │                  ┌───────────┐               ┌───────────────┐
     └──────────────────┤ CANCELLED │               │   CAPTURED    │
                        └───────────┘               │ (auto-advance │
                                                    │  + persist)   │
                                                    └───────┬───────┘
                                                            │ tap to edit
                                                            ▼
                                                    ┌───────────────┐
                                                    │   EDITING     │
                                                    └───────┬───────┘
                                                            │ blur
                                                            ▼
                                                    ┌───────────────┐
                                                    │   PERSISTED   │
                                                    └───────────────┘
```

### Visual treatment per state

| State | Mic button | Input field | Feedback |
|-------|-----------|-------------|----------|
| Idle | Orange outlined circle, mic icon | Empty, grey placeholder | — |
| Listening | Red pulse ring, mic icon filled | Empty | Red dot + "LISTENING" pill |
| Transcribing | Spinner overlay on mic | Draft value appears, greyed | "TRANSCRIBING…" pill |
| Captured | Green filled circle, check icon | Value populated, black mono | Green checkmark + value pill |
| Editing | Orange outlined circle (revert to idle) | Value editable | — |
| Persisted | Green checkmark pill (no button) | Value read-only | "CAPTURED" pill |

### Implementation notes

**Speech recognition API:** `webkitSpeechRecognition` (Chrome / Edge / Safari). Fallback: server-side Whisper (defer to spec-phase — open question whether this is in the Phase 12.5 scope).

**Parsing transcripts to numbers:** "seventy-two point five" → `72.5`. Use a dedicated parser — the sketch has a naive regex (`sources/blueprint-sketch.html:1780-1790`) but production needs a more robust mapper (number-to-words library).

**Validation:** after transcription, compare the parsed value against the `MeasurementBlock` `target` + `tolerance`. Within tolerance → CAPTURED. Outside tolerance → CAPTURED but with a warning badge ("OUT OF SPEC"). Do NOT block — the worker may legitimately need to record an out-of-spec reading and trigger an escalation.

**Timeout:** 2s of silence → move to TRANSCRIBING. Max listening duration 60s (configurable via MeasurementBlock `maxDuration`).

**Offline:** When `navigator.onLine === false`, voice capture still works for recording but transcription falls back to saving the audio blob to Dexie + queueing for later server-side transcription. The input field shows "OFFLINE — WILL TRANSCRIBE ON RECONNECT".

**Accessibility:** the mic button must have `aria-label="Start voice capture"` / `aria-label="Stop voice capture"`. Announce state transitions via `aria-live="polite"`.

Source: `sources/blueprint-sketch.html:1680-1806` (state machine logic), 1810-1862 (mobile voice capture UI).

## 2. Command palette (cmdk)

Keyboard-driven jump-to / search / ask-AI.

### Trigger

Global keyboard shortcut `Cmd+K` (Mac) / `Ctrl+K` (Windows/Linux). Also a dedicated button in the top chrome (small magnifying glass icon, right of the tab nav) for touch devices.

### Layout

- 640px wide modal on desktop, centered 24px from the top
- Full-screen takeover on mobile (same content structure)
- Backdrop: `bg-black/40`, dismisses on click

### Result groups

Three groups, in order:

1. **JUMP TO STEP** — lists all `sop_steps.step_number` + `sop_steps.text` (truncated to 80 chars). Arrow keys to navigate; Enter to jump into the walkthrough at that step.
2. **ASK AI** — free-form query. Submits to an AI rail. **Scope is an open question** for spec-phase — probably scoped to this SOP only (not cross-SOP) to keep the AI context tight.
3. **TOOLS & HAZARDS** — fuzzy-match on `tool_name` / `hazard_code` / `hazard_title`. Tapping a result opens a side drawer with the full tool/hazard detail.

### Search algorithm

Fuzzy match across all three groups simultaneously. Implementation: `fuse.js` or `fast-fuzzy` (both small, MIT). Weight step text higher than tool/hazard names (workers search for step content more often than tool names).

### Keyboard

| Key | Action |
|-----|--------|
| `Cmd+K` / `Ctrl+K` | Open / close |
| `Escape` | Close |
| `↑` / `↓` | Move selection |
| `Enter` | Activate selected result |
| `Tab` | Switch between result groups |

### State

Not persisted — the palette re-renders fresh on each open. Don't cache search history (keeps things fast + privacy-respectful).

Source: `sources/blueprint-sketch.html:1449-1477`.

## 3. Mobile immersive walkthrough

The most impactful UX decision in the sketch. Replaces the list-style walkthrough with a full-screen step card on phones. One step visible at a time; PREV/NEXT via sticky footer.

### Why this pattern

Workers hold a phone in one hand and often a tool in the other. Scrolling through a long list to find "where was I?" is error-prone. The immersive step card:
- Eliminates scroll-loss — the current step is always visible
- Makes evidence capture obvious — the capture grid is sized to the remaining space below the step text
- Treats each step as a commit point — advancing requires a deliberate action (tap NEXT) not just scrolling

### Anatomy

```
┌──────────────────────────────────┐
│ ■ SECTION / STEP N         N/TOT │  ← dark strip, steel-900, mono
├──────────────────────────────────┤
│                                  │
│   Step text (Inter prose)        │
│                                  │
│   [embedded measurement box]     │
│   [evidence grid: 📷 🎤 ✏️ ✍️]    │  ← scrollable body, bg-grid
│                                  │
│                                  │
├──────────────────────────────────┤
│ TAP TO ACKNOWLEDGE HAZARDS       │  ← sticky gate bar (only on gate steps)
├──────────────────────────────────┤
│  [ PREV ]        [   NEXT   ]    │  ← sticky footer, always visible
└──────────────────────────────────┘
```

### Transitions

- NEXT: slide left (300ms ease-out). New step slides in from the right.
- PREV: slide right (same duration).
- No horizontal swipe gesture — too easy to trigger accidentally. Workers tap explicit buttons.

### Progress indicator

`n/total` in the top-right of the header. No progress bar — the counter is enough signal and saves vertical space.

### Section jump

The breadcrumb in the header (`SECTION / STEP N`) is a tap target. Tap → opens a dropdown with all sections listed. Tap a section → jumps to its first step.

### Gate steps

When the current step is a gate (HazardCardBlock with `ack_required`, SignOffBlock, EscalateBlock), a yellow gate bar appears above the PREV/NEXT footer. NEXT is disabled until the gate is satisfied (e.g. hazards acknowledged, signature captured).

### State management

Step index lives in the URL: `/sops/{sopId}/walkthrough?step={stepId}`. This makes back-button behavior correct and lets workers bookmark their place.

**Offline:** step state is also mirrored to Dexie (`walkthrough_progress` table — doesn't exist yet, propose in spec-phase). On reconnect, sync to server.

### Accessibility

- Step body uses `role="main"` + `aria-labelledby="step-header"`.
- PREV / NEXT have clear labels ("Previous step", "Next step"). Disabled NEXT has `aria-disabled="true"` + a tooltip explaining why ("Acknowledge hazards to continue").

Source: `sources/blueprint-sketch.html:1300-1959`.

## 4. Preview toggle (desktop ↔ mobile frame)

**Already implemented** in Phase 12 for the admin builder (`BUILDER_VIEWPORTS` via Puck's native `viewports` prop). The redesign extends the pattern to worker-facing views.

### Extension points

- **Worker walkthrough preview** — a supervisor viewing `/sops/{sopId}/walkthrough` on a desktop should see the same `DESKTOP | MOBILE` toggle in the top chrome. MOBILE clamps the walkthrough to 430x932 (with the immersive step card filling that frame). DESKTOP shows the list-style walkthrough.
- **Overview / flow / model tabs** — these are already desktop-first. The toggle still appears but both modes render full width; MOBILE just changes CSS breakpoints.

### Implementation pattern (reuse from Phase 12)

The Phase 12 implementation uses **Puck's built-in `viewports` prop** — which only works inside a Puck editor context. For non-editor worker views, the redesign needs a parallel approach:

```tsx
// src/components/sop/PreviewToggle.tsx (new, worker-facing)
const [viewport, setViewport] = useState<'desktop' | 'mobile'>('desktop')

return (
  <div style={{ width: viewport === 'mobile' ? 430 : '100%' }}>
    {children}
  </div>
)
```

Store the user's preference in `localStorage` so it persists across sessions. Key: `safestart.preview-viewport`.

Source: Phase 12 implementation at `src/app/(protected)/admin/sops/builder/[sopId]/BuilderClient.tsx:13-26` + `BUILDER_VIEWPORTS` constant.

## 5. Evidence capture grid

Not a state machine — a layout pattern. But it's the most common interaction in the walkthrough so it's worth documenting here.

### Layout

2-column grid on desktop, 1-column on mobile. Each cell is an `.evidence-btn` (see `references/layout-primitives.md`).

### Evidence types

| Type | Icon | Capture | Validation |
|------|------|---------|-----------|
| Photo | 📷 `Camera` (Lucide) | Opens device camera via `<input type="file" capture="environment">` | Min 1 photo, configurable per step |
| Voice note | 🎤 `Mic` | Opens VoiceNoteBlock overlay (state machine above) | Optional |
| Measurement | 📏 `Ruler` | Opens MeasurementBlock inline | Required per MeasurementBlock |
| Signature | ✍️ `PenLine` | Opens SignOffBlock sheet | Required per SignOffBlock |

### State transitions

Idle (dashed border, muted) → Captured (solid green, `.captured` class). Once captured, the cell is read-only — tapping it opens a "view captured" modal where the worker can see the photo/note/value and optionally replace it (replace triggers a confirmation dialog; sign-offs cannot be replaced).

### Persistence

- Photos → Supabase Storage (existing pattern from Phase 4)
- Voice transcripts → new storage (see VoiceNoteBlock in `references/new-block-types.md`)
- Measurements → `sop_completions.step_data` (existing, with unit extension proposed)
- Signatures → `completion_sign_offs` (existing Phase 4 pattern)

Source: `sources/blueprint-sketch.html:1403-1438` (desktop grid), 1810-1862 (mobile capture UI).

## Summary for Phase 12.5 planner

The interaction contract for the redesign is:

1. **Voice works everywhere** measurements or notes are captured — same state machine.
2. **Cmdk is global** — a single top-level handler mounted in the worker walkthrough layout; no per-tab instantiation.
3. **Mobile walkthrough is immersive by default** — list view is desktop-only. Phones never see the list; they go straight to the step-by-step.
4. **Preview toggle is universal** — same `DESKTOP | MOBILE` pill on every worker-facing tab, persisted in localStorage.
5. **Evidence capture is declarative** — capture cells are rendered by block types, not by free-form step authoring. A step's evidence requirements come from its contained blocks.

## Origin

Synthesized from `sources/blueprint-sketch.html` voice logic (1680-1806), cmdk markup (1449-1477), mobile walkthrough (1300-1959), Phase 12 `BUILDER_VIEWPORTS` (`src/app/(protected)/admin/sops/builder/[sopId]/BuilderClient.tsx`), and screenshots `sketch-voice-*.png` + `sketch-mobile-*.png`.
