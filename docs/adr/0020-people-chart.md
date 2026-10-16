# ADR-0020: People opens on one org chart that collapses and answers every People question

- **Status:** Accepted
- **Date:** 2026-10-16
- **Decided by:** Simon (sketch 013, variant D: "Yes build variant D but I will need collapsability built into the charts as well - a large organisation will be difficult to view otherwise")
- **Supersedes:** — (the department board and the Who can do what grid stay as alternative views, per the 2026-07-17 multi-view decision)
- **Enforced by:** `tests/phase63/org-chart.spec.ts`, `tests/evals/office.eval.ts` (the People chart case)

## Context
The People section opened on department cards with text tags and a ✓/— table; supervision, training and SOP access were on other screens or invisible. Sketch 013 D folded them into one org chart. A large organisation (dozens of departments, hundreds of people) cannot be read as one fully open chart.

## Decision
1. **The People tab opens on the chart:** the site, its departments (nested departments inside their parent, ADR-0010), each department's job roles with filled-of-planned seats and dashed empty seats, and people as faces. Departments and Who can do what remain as views.
2. **One quiet Show switch, words and bars only** (ADR-0019's rule: no symbol needs a key): People (opening a supervisor lights the people they look after), Who can (sign off / approve changes / publish / manage people, and "Nobody here …" on a department), Training (a bar per person in open departments), SOP access (pick a SOP: who can see it, from the materialised access tables).
3. **Collapsing is built in:** a department folds to one summary row that still answers the current Show question; Open all / Close all; Find a person opens the departments holding a match and fades the rest. A chart over 40 people or 8 departments starts closed.
4. **The chart only reads.** Writes stay where they are: the person sheet, the invite form (an empty seat opens it), and the SOP access tab (Change who sees it opens it pinned to that SOP, where the collection-override rule is explained).
5. Training reads one department at a time and only for open departments while Training is shown.

## Consequences
- No new server action; the chart reuses `listOrgTree`, `getTrainingMatrix`, the library list and the person sheet.
- Supervision is shown by lighting, not drawn lines, so it survives collapsing and wrapping.
- Job roles and planned seats still cannot be edited (no action since Phase 59); "+ Add a role" waits for one.

## How to comply
- Add a new People question as another Show option that lights or labels faces in words, not as a new screen or a new symbol.
- Keep the chart read-only; route any change to the existing write surface.
