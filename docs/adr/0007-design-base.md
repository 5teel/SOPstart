# ADR-0007: The design base — colour for safety, shared controls, sentence-case headings

- **Status:** Accepted
- **Date:** 2026-10-10
- **Decided by:** Simon (chose the "Impeccable" review as the base for later design passes)
- **Supersedes:** ADR-0006 in part — its rule "labels and tags are caps, weight 700, +0.06em". The rest of ADR-0006 (faces, 12 px floor, tabular digits) stands.
- **Enforced by:** review only; `tests/lint/design-tokens.spec.ts` still owns where colours are defined

## Context
Four design reviews were applied to the same five screens on 2026-10-09 (`.planning/sketches/011-design-base/`). The Impeccable review found the app reading as a stock component kit: coloured left bars on every row and card, caps eyebrow labels over every group, pastel status pills where content should be, a violet sparkle "AI" box, red spent on admin chores, four different toggle styles, area colours sharing values with the safety accents. Simon chose that review as the base that later design passes build on.

## Decision
1. **Colour is for safety.** Red belongs to hazards and failures that block a worker; amber to PPE and overdue items. An admin chore (stuck, no owner, sign-off) is an ink tag. Ordinary steps and checks are ink. AI and agent marks are ink (`--ai` resolves to ink).
2. **No coloured left bars** on rows, cards, callouts or rail items. Area is a dot; the current rail item is a fill.
3. **Area colours are a muted data palette** (`--area-1..8`, one OKLCH lightness and chroma) that never equals a semantic accent. Step and measure share one blue.
4. **Section labels are sentence-case headings** (`.section-heading`). Caps are kept only for safety signal words (HAZARD, PPE), per ISO 3864 / ANSI Z535. Status tags are sentence case (`.tag`).
5. **One control vocabulary**, defined once in `src/styles/blueprint-theme.css`: `.seg` (segmented control), `.chip` (44 px filter chip), `.tag` / `.tag-warn` (status), `.signal` + `.signal-strip` (hazard / PPE sign), `.section-heading`. Components use these classes; a later design pass changes the class, not the call sites.
6. **No page explainer sentences, no generic page entrance animation, no icon-in-a-circle empty states.** An empty state shows the shape of what will appear.

## Consequences
- Easier: the next design pass edits one file for most changes; the tokens and classes above are the seams.
- Harder: a new screen must reuse the classes instead of inventing a toggle or pill; reviewers check for that.
- Changed now: the walk, browse, editor, home list, sign-offs inbox, people, training, my record and the account menu (see the commit that adds this ADR).
- Not yet swept: older admin screens (org model, observations, wizard, settings) still carry caps labels and Tailwind-default controls; bring them onto the base when they are next touched.

## How to comply
- A group label: `<h2 className="section-heading">Recent</h2>`, never `uppercase tracking-widest`.
- A two-way switch: `<span className="seg"><button aria-pressed={…}>Area</button>…</span>`; tabs use `aria-selected` inside `.seg`.
- A status: `<span className="tag">Stuck</span>`; overdue: `tag tag-warn`.
- A hazard: `<div className="signal signal-hazard"><div className="signal-strip">…Hazard</div>…</div>`.
