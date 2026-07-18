# Builder header orientation (G1)

Throwaway design sketches. Open `index.html` directly in a browser; switch concepts with the yellow toggle at the top. Each concept shows the locked state ("29 of 33 steps left") and the unlocked state.

## The problem

The SOP builder stacks four UI zones — breadcrumb, title+version, stage stepper ("1 Edit → 2 Send to workers 🔒 29 of 33 steps left"), tool buttons — with no visual grammar for *where I came from / where I am / what's next / why it's locked*. The interim fix (c75307f) deduplicated the title and added an orientation sentence; these sketches propose the real header. Logged as G1 in `32-HUMAN-UAT.md`.

## Concepts

### A · Wayfinder bar
One 58px dark bar split by hairlines into three fixed zones: **back** (left, "Back to · SOP library"), **here** (centre, yellow "YOU'RE EDITING" tick + title + version), **next** (right, a single forward chip that carries its own lock reason as a plain sentence — "Locked — 29 steps below still need checking"). Tools drop into a thin light toolbar below the dark bar, so orientation and furniture never compete. The strongest separation of concerns: each question has exactly one home, and the lock reason lives on the thing that's locked.

### B · Journey line
Breadcrumb and stepper describe the same journey, so they become one literal track: Library ─● **This SOP (you are here)** ─╌🔒 Send to workers. Past stops are clickable and sit left of a haloed you-are-here dot; the future track is dashed until the gate opens; the lock reason hangs directly under the locked stop. Tools in a bordered cluster off the track. The most self-explanatory spatial model — direction is drawn, not implied — but the most layout-fragile with long titles.

### C · Two decks
Dark deck = place only (back, title, version, tools). Light deck = a plain-English progress sentence ("4 of 33 steps checked — check the rest below, then you can send this to workers") plus a real progress bar ending in the Send button. The numbered stepper disappears; the bar *is* the gate, made mechanical and obvious. Closest evolution of the shipped interim fix (OrientationStrip becomes a permanent second deck).

## Trade-offs

| | A · Wayfinder | B · Journey line | C · Two decks |
|---|---|---|---|
| Answers "where am I / what's next" | Explicit zones, labelled | Literal drawn path | Sentence + bar |
| Lock reason visibility | On the locked chip | Under the locked stop | In the sentence AND the disabled button |
| Plain-language burden | Low–medium | Medium | Lowest — reads as one sentence |
| Vertical cost | 58px + 36px tools row | ~64px single row | 46px + ~44px |
| Long-title resilience | Good (centre zone ellipsizes) | Weak (title squeezes the track) | Good |
| 3-stage SOPs (Build → Review → Publish) | Chip shows next stage only — mid stages need a subline | Extra stops fit naturally on the track | Bar segments per stage; sentence adapts |
| Distance from shipped code | Medium | High | Low |

## Recommendation

**C (Two decks)**, with A's forward-chip idea folded in: keep the dark deck for place, and make the light deck's Send button carry the A-style two-line reason when disabled. C is the only concept where a non-technical reader gets the whole story in one sentence, it degrades best with long titles, and it is the shortest path from the shipped interim fix. B is the most delightful but pays for it in fragility; keep the dashed-future-track idea (it could style C's progress bar segments).

## Open questions

- 3-stage SOPs (source-doc flow: Build → Review → Publish): does the deck-2 sentence name the *next* stage only, or show all remaining stages? Sketch shows the 2-stage case from the UAT session.
- Does "Check" replace "Verify" as the product-wide verb? The sentence reads best with "checked"; the verify checklist and stepper currently say "verify".
- Where does the approval-chain state (Phase 29 pending-approval) surface in each concept — a fourth banner state on deck 2, or a variant of the Send button?
- Tools row in A/C: does "Actions ▾" absorb Edit flow + Flow too (one menu), or stay three buttons? Sketch keeps three to match shipped.
- Mobile/narrow builder widths: A's three zones and C's two decks both need a collapse rule (probably: back arrow icon only, sentence truncates to "4/33 checked").
