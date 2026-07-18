# Permission Wiring Views

Validated 2026-07-17 (sketch 002-permission-wiring). The surface where SOP-library
access is assigned across the org model — every arity (1:N, N:1, N:M), site-wide
inheritance, and person-level overrides — legible at a glance.

## Design Decisions

- **Patch Bay (Wiring) is the DEFAULT view**: org units in a left column,
  library collections in a right column, access drawn as SVG wires between
  ports. **Click either side to trace** — the selection and everything
  connected to it lights up (`.lit`), everything else dims to 35% opacity.
  Click empty canvas to reset. This is the at-a-glance navigation the surface
  exists for.
- **Access Matrix ships as an alternative view**: org units × collections grid.
  Densest N:M representation; the audit lens ("show me everyone who can see
  Chemical Handling" = read one column).
- **Select & Illuminate ships as an alternative view**: pick any org unit or
  person, the library grid lights up with per-collection state; click a
  collection card to grant/revoke for the selection. The editing lens.
- **Three-way in-page toggle**: `⌇ Wiring / ▦ Matrix / ◉ Illuminate` — three
  lenses over one access model, no view-private state.
- **Access-state vocabulary (used identically in every view):**
  - **Direct grant** — solid green (`--accent-ok`); wire = solid line
  - **Inherited** — dashed green ring/border, labelled with its source
    ("✓ VIA WHOLE SITE"); propagates from ancestor grants
  - **Personal grant** — a person-level wire/row on top of dept inheritance,
    dashed wire in the patch bay (e.g. Priya Sharma + Chemical Handling)
  - **No access** — muted/empty, never red (absence isn't an error)
- **Grants attach at any level** — whole site, department, (role), person —
  and a unit's effective access = union up its inheritance chain. The seeded
  demo model every view shares: site→Safety (broadcast), Forming→{Hot End,
  Chemical}, Maintenance→{Machine Maint, Chemical}, person-override
  Priya→Chemical. Chemical Handling thus demonstrates N:1 (three sources).
- **Collections, not individual SOPs, are the wiring unit** — permissioning 43
  SOPs one-by-one is unmanageable; collections (categories) keep the graph
  legible. Per-SOP exceptions are a later refinement.

## Interaction: trace-on-click (the core move)

```js
// Selection = the clicked unit + everything sharing a connection with it.
const related = new Set([selected]);
CONNECTIONS.forEach(c => {
  if (c.from === selected) related.add(c.to);
  if (c.to === selected) related.add(c.from);
});
// .lit on related, .dim on the rest; wires redraw with active stroke/opacity.
```

Wires are drawn at runtime from element positions (never hardcoded):
```js
const f = fromEl.getBoundingClientRect(), t = toEl.getBoundingClientRect();
const x1 = f.right - bay.left, y1 = f.top + f.height/2 - bay.top;
const x2 = t.left - bay.left,  y2 = t.top + t.height/2 - bay.top;
path.setAttribute('d', `M ${x1} ${y1} C ${(x1+x2)/2} ${y1}, ${(x1+x2)/2} ${y2}, ${x2} ${y2}`);
// dashed personal grants: stroke-dasharray 5 4 · redraw on resize + view switch
```

Inheritance resolution (Illuminate + effective-access anywhere):
```js
const direct = new Set(GRANTS[unit]);
const inherited = {};                       // collectionId -> source ancestor
CHAIN[unit].slice(0, -1).forEach(anc =>     // e.g. ['org','quality','priya']
  GRANTS[anc].forEach(g => { if (!direct.has(g)) inherited[g] = anc; }));
```

## CSS Patterns

Patch-bay jack + port:
```css
.jack { background: var(--paper-1); border: 1.5px solid var(--ink-300);
  border-radius: 5px; padding: 9px 12px; position: relative; cursor: pointer; }
.jack.lit { border-color: var(--accent-step); box-shadow: 0 0 0 3px rgba(59,130,246,0.14); }
.jack.dim { opacity: 0.35; }
.port { position: absolute; top: 50%; width: 9px; height: 9px; border-radius: 50%;
  background: var(--paper-1); border: 2px solid var(--ink-400); transform: translateY(-50%); }
.jack.lit .port { border-color: var(--accent-step); background: var(--accent-step); }
```

Matrix cell marks:
```css
.dotmark.direct  { background: var(--accent-ok); }              /* solid  */
.dotmark.inherit { border: 2px dashed var(--accent-ok); }       /* dashed */
.dotmark.none    { border: 1px solid var(--ink-200); }          /* empty  */
```

Illuminate card states:
```css
.sop-card.direct  { border-color: var(--accent-ok); }
.sop-card.inherit { border-color: rgba(22,163,74,0.45); border-style: dashed; }
.sop-card.off     { opacity: 0.55; }
```

## What to Avoid

- **Revoking an inherited grant in place** — Illuminate deliberately blocks it
  ("revoke at the source"); a real build needs an explicit "exclude" affordance
  decision before allowing per-unit carve-outs of a broadcast grant.
- **Red for "no access"** — absence is a neutral state; red is reserved for
  hazards (semantic color system).
- **Single-view permissioning** — wiring is the wow/orientation view, matrix is
  the audit view, illuminate is the editing view; each is weak at the others'
  job.
- **Unvalidated at scale** — everything was proven at 4 depts × 6 collections;
  stress-pass at ~15 × ~20 (real Visy scale) before build. The patch bay
  especially risks wire spaghetti; likely needs collapse-to-group behaviour.

## Origin

Synthesized from sketch: 002-permission-wiring (winner A, Patch Bay).
Source: sources/002-permission-wiring/index.html
