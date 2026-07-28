# Authoring & Creation Flow

How a SOP gets *made* — the on-ramp wizard, the inline builder, and the one-URL
read/walk/edit surface. Synthesized from three sketches (2026-07-14), wrapped
2026-07-28.

**Status: NOT SHIPPED.** Unlike the rest of this skill, nothing here is in the
codebase yet. These are the validated design decisions for the SOP
creation/conversion/authoring milestone. The shipped builder today is the
Phase 26 bespoke inline editor at `/admin/sops/builder/[sopId]`; these sketches
propose its next form. Treat this file as the design contract to build toward,
not a description of what exists.

---

## Design Decisions

### D-A1 · Every on-ramp lands in the identical builder

The single most-repeated decision across all three sketches. Whether the admin
starts from a template, an uploaded document, a video, an AI prompt, or a blank
canvas, **all paths converge on the same inline builder** — no per-method editor,
no "import review screen" that differs from the authoring screen.

The wizard copy states it outright: *"Every path lands in the same builder — this
just picks the fastest on-ramp. You can restructure anything once you're in."*

This replaces today's fragmented `/upload`, `/new/ai`, `/new/blank`, and video
screens with one funnel. The sketch's own closing note: *"One flow, not four."*

### D-A2 · Five on-ramps, upload recommended

Ordered by the wizard, with the recommendation weighting deliberate:

| On-ramp | Pill | Rationale in copy |
|---|---|---|
| Upload a document | `Recommended` (green) | "The fastest way to standardise what you already have" — most teams' true starting point |
| Build from a template | `Standardise` (blue) | "Keeps 100+ sites consistent" |
| From a video or recording | — | Clip, live recording, or YouTube link → transcribed to a draft |
| Draft with AI | — | Plain-words description → structured first version *into the template* |
| Blank canvas | muted tile | "Advanced — most teams pick a template instead" |

Blank canvas is visually de-emphasized (`.tile.muted`), not hidden. The
builder-redesign sketch's variant of this screen defaults the selection to
**template**, not upload — the two sketches disagree, and template-first is the
better default when the wizard is reached from "New SOP" rather than a drop.

### D-A3 · Template = a shape, chosen before the builder opens

Templates are pre-structured *section skeletons*, not content. Three shipped in
the sketches:

- **General Procedure** (`Most used`) — Purpose & scope · Hazards & PPE · Procedure steps · Sign-off. "Works for almost anything."
- **Machine Operation** — Hazards & LOTO · Pre-start · Operating steps · Measurements
- **Maintenance / LOTO** — Energy isolation · Lockout · Verify zero · Permit sign-off

The value proposition is worker-side, and the copy says so: *"so workers always
know where to find hazards, PPE and sign-off."* Consistency across sites is the
selling point for a multi-site customer (Visy: ~100 sites).

Note the template step is shown **even for the upload path** — the extracted
document is mapped *into* the chosen skeleton rather than producing an arbitrary
shape. That is what makes 100 sites' SOPs comparable.

### D-A4 · The canvas IS the worker document, edited in place

The builder's defining decision, stated in the sketch's own footnote:

> **One document, edited in place.** No block palette, no outline, no field rail —
> you change the same cards a worker sees.

Consequences:

- The only persistent panel is a **section rail** (~230px, left). No right-hand field inspector, no separate block drawer.
- Every block renders in its final worker styling. `contenteditable` directly on the text; the block *is* the editor.
- Block tools (`⧉` duplicate, `🗑` delete, `⠿` drag grip) appear **on hover**, never permanently.
- A persistent one-line explainer sits above the document: *"✎ You're editing the live worker document. Click any text to change it. Hover a block for its tools. Use ＋ to add."*
- A mobile preview renders the same blocks in one column — the toggle exists to *prove* what the worker gets, not to author separately. Footnote: *"Edit once. Desktop and phone render the same source."*

### D-A5 · Insertion is a four-tier context-aware picker

The `＋ insert block` affordance opens a picker whose contents depend on **where**
you are and **what precedes** the insertion point. Tiers, in the order they
appear on the picker's home page:

- **Tier 0 — "Smart next"** — a single prediction from the block *above* the cursor, accepted with `↵` or `Tab`. Mappings: after a Measurement → Decision (*"branch on the result"*); after a Hazard → PPE (*"the gear this needs"*); after a Step → Measurement (*"capture a value"*).
- **Tier 1 — "Fits here"** — block types relevant to the current *section*, so the common case is 3–5 options rather than the full catalog:
  - Purpose & scope → Text, Visual, Tool
  - Hazards & PPE → Hazard, PPE, Emergency contact, Text
  - Procedure steps → Step, Measurement, Decision, Visual, Tool
  - Sign-off → Sign-off, Text
- **Tier 2 — "More block types"** — the full catalog, grouped: *Actions & flow* (Step, Decision) · *Safety* (Hazard, PPE, Emergency) · *Data capture* (Measurement, Visual, Tool) · *Guidance & gates* (Text, Sign-off)
- **Tier 3 — "Reuse a block or snippet"** — the department-scoped library, with a `Forming dept` / `All departments` scope toggle. Saved blocks carry usage counts ("LOTO — verify zero energy · Step · used ×23"); **snippets** are multi-block clusters ("LOTO isolation sequence · 5 steps + verify").

Plus a purple `✦ Describe with AI` row for generating a block from a description.

The picker is keyboard-first (`↑↓` move, `↵` insert, `esc` close) with a type-to-filter
input, and drill-down pages carry a back chevron and an "in **{section}**" context label.

### D-A6 · Smart ghosts — the aggressive suggestion path

Distinct from the picker: an inline dashed-purple **ghost** row appears *after* a
block whose successor is predictable, offering `Tab` to accept. The restraint
rules are the interesting part and must be preserved:

- A ghost is **suppressed entirely** if the predicted block already follows — no suggesting what's already there.
- Only the ghost **nearest the viewport centre** is live; all others sit at `opacity: .3`.
- A ghost scrolled past (`bottom < 64px`) is marked `.gone` and **never returns** — suggestions expire rather than accumulate.
- Typing inside a block dismisses every ghost except the one immediately after it.
- `Tab` accepts the live/hovered ghost and **never opens a menu** — the key is unambiguous.

This is the pattern that keeps AI assistance from becoming visual noise. Copy it
literally; the tuning is the whole design.

### D-A7 · The agent layer is a visible, toggleable twin

A `⚇ Agent layer` toggle overlays machine-readable metadata on the document —
banner copy: *"this metadata never renders for workers. Agents read, write &
reason from it (context · memory · learning · review)."*

Two levels:

- **SOP-level panel** — Summary (with `↻ regenerated by agent {date}` provenance), Entities, Hazard rollup, Cross-SOP links (shared library blocks, same-line SOPs, supersede lineage), Memory (worker voice-Q&A hits, near-misses logged per step), Learning (agent *proposals* with a `[review ▸]` action), Review status (AI-reviewed, human-verified, embedding coverage `6/6 blocks indexed`).
- **Per-block twin** — id · type · tags · entities · vector (`✓ embedded 1536d` + confidence) · links · agent read/write capability.

The stated principle: *"every block gets a machine-readable twin: nothing in the
SOP is hidden from agents."* This is the sketch's bet that the agent layer should
be **inspectable by the admin**, not a hidden index — it makes AI behaviour
auditable to a safety manager.

Note this presumes the Phase 26.5 agent-metadata layer as its data source.

### D-A8 · Conversion provenance is per-block and must be cleared by hand

Blocks extracted from an uploaded document carry a provenance line —
`✦ from source · page 1 ¶2` — with a `✦ tap to verify` action. The purple `✦`
mark is the visual signature of unverified imported content, and the document
footnote makes the contract explicit: *"Purple ✦ marks came from your uploaded
file; verify each to clear them."*

The parse screen sets the expectation honestly before the builder opens:
*"AI is extracting structure. This usually takes 30–90 seconds for a real
document"*, with live per-item results (`✓ Split into 4 sections`, `✓ Found 4
procedure steps`, `✓ Detected 1 hazard · 1 measurement`, `◷ Matching photos to
steps…`). The drop screen promises: *"Nothing is published until you confirm it."*

This aligns with the shipped Phase 21/26 verify-checklist gate — the provenance
mark is that gate's per-block surface inside the authoring canvas.

### D-A9 · Read / Walk / Edit are three modes of ONE URL

From `unified-sop-surface`: a single SOP page carries a segmented mode switch
(`📖 Read` · `▸ Walk` · `✎ Edit`) instead of today's three separate routes
(`/sops/[id]`, `/sops/[id]/walkthrough`, `/admin/sops/builder/[id]`).

State is `{ mode, role }` only. Per mode:

| Mode | Banner lead | Left rail | Primary action |
|---|---|---|---|
| Read | "**Reading** — desktop-first, the whole procedure in one scroll" | Sections (no add) | `⤓ Download offline` + `▸ Start walkthrough` |
| Walk | "**Walkthrough** — enforced sequence · creates a completion record" | **Progress** — per-step, with `✓` on done | `✕ Exit to read` |
| Edit | "**Editing** — workers see the Read view" | Sections + `＋ Add section` | Build → Review → Publish stage chips |

Two details worth keeping:

- **Read and Edit share the same DOM pane** (`#pane-doc`); Edit just adds an `.editing` class that reveals add-block bars and enables `contenteditable`. Only Walk swaps to a different pane. This is what makes "you edit what the worker reads" structurally true rather than aspirational.
- **Role gating hides rather than disables** — for `role: worker` the Edit button is `display: none`, and `setMode('edit')` returns early as a server-side-equivalent guard. The `View as Admin/Worker` toggle in the sketch is a *sketch affordance* for demoing both, not a product feature.

The "Reading — **desktop-first**" framing is deliberate and traces to the Visy
interview finding that SOP reading happens at a desk far more than the
mobile-first assumption predicted. Walk stays the mobile-shaped mode.

### D-A10 · Wizard step 3 places the SOP before it exists

"Procedure details" collects title, department/category, trade/sub-trade, and
**site** — with site framed as an *overlay*: *"Site-specific SOPs sit on top of
the org template, so hazards can differ per plant."* Copy: *"Site & trade decide
which workers see it once it's published."*

Placement is therefore an authoring-time input, not a post-publish
administration step — it feeds the Phase 32/33 access model directly.

---

## CSS Patterns

### Block-as-editor (D-A4)

```css
/* the block IS the card the worker sees; tools appear only on hover */
.blk{position:relative;border:1px solid var(--ink-100);border-radius:6px;padding:12px 14px;background:#fff}
.blk .grip{position:absolute;left:-18px;top:12px;opacity:0;cursor:grab;color:var(--ink-300)}
.blk .tools{opacity:0;transition:opacity .12s}
.blk:hover .grip,.blk:hover .tools{opacity:1}
.blk .bd[contenteditable]{outline:none}
.blk .bd[contenteditable]:focus{background:rgba(251,191,36,.06)}

/* semantic left-edge accent per block type — identical to the worker render */
.blk.hazard{border-left:3px solid var(--accent-hazard)}
.blk.measure{border-left:3px solid var(--accent-measure)}
.blk.decision{border-left:3px solid var(--accent-decision)}
.blk.step{border-left:3px solid var(--accent-step)}
.blk.signoff{border-left:3px solid var(--accent-signoff)}
```

### Smart ghost (D-A6)

```css
.ghost{display:flex;align-items:center;gap:9px;
  border:1px dashed var(--ai);background:rgba(139,92,246,.06);color:var(--ai);
  border-radius:6px;padding:9px 12px;margin:2px 0 10px;font-size:11px;
  font-family:'Inter';cursor:pointer;transition:opacity .16s ease,background .12s}
.ghost:hover{background:rgba(139,92,246,.12)}
.ghost.dim{opacity:.3}          /* not the one near your view */
.ghost.dim:hover{opacity:1}
.ghost.gone{display:none}       /* scrolled past → dismissed for good */
.ghost .kb{font-family:'JetBrains Mono';font-size:9px;background:var(--ai);color:#fff;
  border-radius:3px;padding:2px 6px;text-transform:uppercase;letter-spacing:.05em}
.ghost .muted{color:var(--ink-500);margin-left:auto;font-size:10px}
```

`--ai: #8b5cf6` (violet) is a **new token** introduced by these sketches — it marks
AI-generated/AI-suggested content everywhere (ghosts, the `✦ Describe with AI`
picker row, agent-layer proposals). It is *not* in the shipped palette; add it
alongside the six semantic accents when building this.

### Section header with rule (used in builder, read, and walk)

```css
.sec-h{display:flex;align-items:center;gap:10px;margin-bottom:14px}
.sec-h .n{font-size:10px;color:var(--ink-500);letter-spacing:.08em}
.sec-h h2{font-size:15px;font-weight:600;letter-spacing:-.01em;white-space:nowrap}
.sec-h .line{flex:1;height:1px;background:var(--ink-100)}
```

### Insertion affordance — the hairline `＋`

```css
.adddiv{display:flex;align-items:center;gap:8px;opacity:0;transition:opacity .12s;margin:2px 0}
.sec:hover .adddiv{opacity:1}
.adddiv .rule{flex:1;height:1px;background:var(--ink-100)}
.adddiv .plus{font-size:10px;color:var(--ink-500);cursor:pointer;white-space:nowrap}
.adddiv .plus:hover{color:var(--accent-step)}
```

### Mode switch (D-A9)

```css
.modesw{display:flex;background:var(--steel-700);border-radius:3px;padding:3px;gap:2px}
.modesw button{display:flex;align-items:center;gap:7px;font-size:11px;
  text-transform:uppercase;letter-spacing:.07em;font-weight:600;
  color:#a1a1aa;background:transparent;border:none;padding:7px 16px;border-radius:2px}
.modesw button.on{background:var(--paper);color:var(--ink-900)}
.modesw button.locked{opacity:.4;cursor:not-allowed}
```

The mode banner below it is a **fixed-height sticky slot** (`top: 54px`), consistent
with the cross-cutting rule from the permission-wiring sketches: contextual
banners live in permanently-reserved slots so the canvas never moves.

---

## HTML Structures

### Builder shell — two zones, not four

```html
<div class="body">
  <aside class="rail">            <!-- ~230px · the ONLY panel -->
    <div class="rh">Sections</div>
    <div class="item cur"><span class="mk"></span> Purpose &amp; scope <span class="ct">1</span></div>
    <!-- …one per section, colour-marked by its dominant block type… -->
    <button class="add">＋ Add section</button>
    <div class="tip">Drag a section to reorder. Everything you edit here is
      <b>exactly</b> what a worker reads.</div>
  </aside>

  <main class="canvas">
    <div class="doc deskdoc">      <!-- the real worker document -->
      <div class="sec">
        <div class="sec-h"><span class="n">01</span><h2 contenteditable>Purpose &amp; scope</h2><span class="line"></span></div>
        <div class="adddiv"><div class="rule"></div><span class="plus">＋ insert block</span></div>
        <div class="blk">
          <span class="grip">⠿</span>
          <div class="bh"><span class="ty">Text</span><span class="tools">…</span></div>
          <div class="bd prose" contenteditable>…</div>
          <div class="prov">✦ from source · page 1 ¶2 <span class="verify">✦ tap to verify</span></div>
        </div>
      </div>
    </div>
    <div class="phonewrap">…</div> <!-- same blocks, one column -->
  </main>
</div>
```

### Block type registry (drives picker tiers, ghosts, and colours from one place)

```js
const BLK={
  step:     {c:'--accent-step',    n:'Step',              d:'numbered action'},
  hazard:   {c:'--accent-hazard',  n:'Hazard',            d:'acknowledge-to-pass'},
  ppe:      {c:'--accent-hazard',  n:'PPE required',      d:'gear checklist'},
  emergency:{c:'--accent-hazard',  n:'Emergency contact', d:'who to call'},
  measure:  {c:'--accent-measure', n:'Measurement',       d:'value + tolerance'},
  decision: {c:'--accent-decision',n:'Decision',          d:'yes / no branch'},
  text:     {c:'--ink-500',        n:'Text / note',       d:'plain guidance'},
  visual:   {c:'--accent-mcu',     n:'Visual',            d:'photo · diagram · video'},
  tool:     {c:'--accent-mcu',     n:'Tool / material',   d:'what you need'},
  signoff:  {c:'--accent-signoff', n:'Sign-off',          d:'signature gate'},
}
const LANE={                       // tier 1 — what fits in each section
  purpose:['text','visual','tool'],
  hazards:['hazard','ppe','emergency','text'],
  steps:  ['step','measure','decision','visual','tool'],
  signoff:['signoff','text'],
}
const SMART={                      // tier 0 — predicted from the block above
  measure:{t:'decision',why:'branch on the result'},
  hazard: {t:'ppe',     why:'the gear this needs'},
  step:   {t:'measure', why:'capture a value'},
}
```

**One definition, reused across tiers, ghosts, and (future) block-transform
menus.** When implementing, this registry should be derived from — or reconciled
with — the shipped `BLOCK_COMPONENTS` registry and `puck-to-block-content.ts`
converters rather than duplicated (see the 2026-07-13 learning in CLAUDE.md: the
render path for every block type already exists; a bespoke preview switch is
always the wrong call).

### Visual block — one block, several media

A `Visual` block holds photo **and** diagram **and** video together, each tagged
by medium (`visual:photo` / `visual:diagram` / `visual:video`) so agents can
filter by medium. The picker drills into a medium sub-choice, with the footer
noting: *"One Visual block can hold all three."*

---

## What to Avoid

- **A block palette / drawer / field inspector.** Explicitly rejected — *"No block palette, no outline, no field rail."* The document is the interface. A right-hand properties panel reintroduces exactly the indirection the redesign removes.
- **A separate editor per on-ramp.** Rejected by D-A1. Upload-review, AI-draft-review, and manual authoring are the same screen or the design fails.
- **A flat "all block types" list as the default insert menu.** The full catalog is *tier 2*, behind "More block types". Leading with 10 options is the thing the tiering exists to prevent.
- **Persistent AI suggestions.** Ghosts that accumulate, or that reappear after being scrolled past, turn assistance into noise. The dim/expire/suppress rules in D-A6 are the design, not polish.
- **`Tab` opening a menu.** `Tab` accepts the live ghost, unambiguously and only.
- **Separate URLs for read vs walk vs edit** (D-A9), and separate desktop/mobile authoring (D-A4). One source, rendered per mode and per viewport.
- **Disabling the Edit control for workers.** Hide it — a greyed-out control invites "how do I get access" support load on a surface workers should not perceive as theirs.
- **Publishing imported content without per-block verification.** The `✦` provenance mark must be cleared block-by-block; no bulk-verify affordance (this is already enforced by `tests/lint/no-bulk-verify-ui.spec.ts`).
- **Hiding the agent layer.** D-A7's bet is inspectability. A hidden index makes AI behaviour unauditable to the safety manager who owns the document.

---

## Open Questions

Carried from the sketches — resolve during spec/discuss of the authoring milestone:

- Wizard default selection conflicts between sketches: `admin-sop-new-wizard` defaults to **upload**, `sop-builder-redesign` defaults to **template**. Likely context-dependent (drop-triggered vs "New SOP"-triggered).
- The wizard is 4 steps (method → template → details → review) but the builder-redesign's own on-ramp is 2 (method → template, then straight in). Which is the real length, and does the upload path skip the template step when the parse produces a confident shape?
- Does the agent-layer toggle belong to the builder only, or also to Read mode for admins?
- Section rail colour marks derive from "dominant block type" in the sketch — is that computed, or an authored section-type property?
- Where does the Phase 29 approval-chain state surface in the Edit-mode stage chips (Build → Review → Publish)?
- `--ai` violet against the existing six semantic accents: does it need an accessibility pass at small sizes on paper background?

---

## Origin

Synthesized from sketches: `sop-builder-redesign`, `unified-sop-surface`,
`admin-sop-new-wizard` (all 2026-07-14, root-level `sketches/`, no README —
decisions read from the markup and inline copy).

Source files: `sources/authoring-flow/`
