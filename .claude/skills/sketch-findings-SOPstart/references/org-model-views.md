# Org Model Views

Validated 2026-07-17 (sketch 001-org-model-canvas). The surface where a business
(Visy first) draws its org structure: departments → roles → people.

## Design Decisions

- **Node Chart is the DEFAULT view** — a spatial org chart on 20px grid paper,
  the same visual language as the shipped SOP Flow tab. Org root → department
  nodes → role nodes; people render as mini-chips inside role nodes.
- **Column Builder ships as the alternative view** — departments as columns,
  roles as cards, people as chips. It wins on raw entry speed (Trello-like,
  no layout decisions); the chart wins on comprehension and doubles as the
  substrate for permission wiring.
- **In-page view switcher, not separate pages**: segmented `⊞ Chart / ▤ Columns`
  toggle at the top-right of the page header. Both views are lenses over ONE
  model — no view has private state.
- **Unnamed role-holders are first-class**: a role can be filled by a named
  person or held open as a role-descriptor vacancy ("Operator — night shift,
  unfilled"). Rendered as dashed chips with a dashed `+` avatar — deliberately
  NOT styled as an error.
- **Role capacity counts** (`3/4`, `1/2`) on every role card/row — filled vs
  budgeted headcount at a glance; vacancies explain the gap.
- **Outline Tree explored and REJECTED as a shipping view** (see What to Avoid).

## Data model implications

- Org chart introduces **roles** as an entity BETWEEN departments and members
  (the shipped Phase 25 model is departments ←junction→ members with no role
  layer). A `roles` table (org-scoped: department_id, name, budgeted_count)
  plus `role_members` junction, with vacancies = budgeted_count − filled.
- Existing `departments` table (name, colour, icon, owner_user_id) carries over
  directly — dept accent colours drive the node kickers and column dots.

## CSS Patterns

Node (chart view):
```css
.node {
  position: absolute; background: var(--paper-1);
  border: 1.5px solid var(--ink-300); border-radius: 5px;
  padding: 8px 12px; min-width: 130px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.04);
}
.node.selected { border-color: var(--accent-step); box-shadow: 0 0 0 3px rgba(59,130,246,0.15); }
.node .kicker { font-family: var(--mono); font-size: 9px; text-transform: uppercase;
  letter-spacing: 0.08em; color: var(--ink-500); }
.node.org-root { border-width: 2px; border-color: var(--ink-900); }
```

Person chip (named vs vacancy):
```css
.person-chip { display: inline-flex; align-items: center; gap: 6px;
  border: 1px solid var(--ink-300); border-radius: 999px;
  background: var(--paper-1); padding: 3px 10px 3px 4px; font-size: 12px; }
.person-chip .avatar { width: 20px; height: 20px; border-radius: 50%;
  background: var(--ink-900); color: #fff; font-family: var(--mono);
  font-size: 9px; font-weight: 700; display: grid; place-items: center; }
.person-chip.vacant { border-style: dashed; color: var(--ink-500); background: transparent; }
.person-chip.vacant .avatar { background: transparent; border: 1.5px dashed var(--ink-400); }
```

In-page view switcher (shared with permission views):
```css
.view-toggle { margin-left: auto; display: inline-flex;
  border: 1px solid var(--ink-300); border-radius: 3px; overflow: hidden; }
.view-toggle button { font-family: var(--mono); font-size: 10px; font-weight: 600;
  text-transform: uppercase; padding: 5px 12px; border: none;
  background: transparent; color: var(--ink-500); cursor: pointer; }
.view-toggle button + button { border-left: 1px solid var(--ink-300); }
.view-toggle button.on { background: var(--ink-900); color: #fff; }
```

Add affordances are dashed ghosts (`+ Add role`, `+ ADD DEPARTMENT`, `+ person`)
— dashed border, mono 10-11px, ink-500, hover → accent-step. Everything is added
in place; no modal for structure building.

## HTML Structures

Chart: `position:relative` canvas (`bg-grid`) + absolutely-positioned `.node`
divs + one `<svg>` underlay for parent→child connectors (cubic beziers,
`--ink-300`/`--ink-400` strokes). Columns: horizontal `overflow-x` flex board,
`flex: 0 0 250px` per department column.

## What to Avoid

- **Outline Tree as a primary view** — fastest keyboard entry but it reads as a
  roster admin table, not a "visual model"; failed the core brief. Keep the
  interaction ideas (Tab to indent, Enter for sibling) as chart/column keyboard
  shortcuts if ever needed.
- **Forcing a single view** — entry speed (columns) and comprehension (chart)
  are different jobs; the toggle resolves the tension. Don't collapse to one.
- Hand-positioned nodes without auto-layout: real build needs an auto-layout
  pass (chart positions in the sketch are hand-placed; drag-to-reposition is
  labelled but not implemented).

## Origin

Synthesized from sketch: 001-org-model-canvas (winner B, Node Chart).
Source: sources/001-org-model-canvas/index.html
