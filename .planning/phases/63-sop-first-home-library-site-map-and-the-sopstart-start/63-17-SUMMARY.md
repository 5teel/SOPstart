---
phase: 63-sop-first-home-library-site-map-and-the-sopstart-start
plan: 17
subsystem: living-maps
tags: [journeys, pathways, uat, capability-matrix, claude-md, sketch-skill, word-01, docs-01]
requires: [63-12, 63-14, 63-15, 63-16]
provides:
  - "src/lib/journeys/journeys.ts describes the SOP-first home; no room, no walk word, no ?place= address"
  - "src/lib/journeys/roles.ts access matrix rows are sections"
  - "src/lib/uat/tests.ts: five plain home checks, picture-as-home checks archived"
  - "CAPABILITY-MATRIX.md speaks sections and the new addresses; no gate cell changed"
  - "tests/lint/no-walk-words.spec.ts also scans src/lib/journeys and src/lib/uat"
  - "user-visible access refusals no longer name a room"
affects: [63-18, 63-20, 63-21]
key-files:
  modified:
    - src/lib/journeys/journeys.ts
    - src/lib/journeys/roles.ts
    - src/lib/uat/tests.ts
    - tests/lint/no-walk-words.spec.ts
    - tests/phase51/site-workspace-wiring.spec.ts
    - tests/phase32/library-filter-deeplink.spec.ts
    - src/actions/asks.ts
    - src/actions/office.ts
    - src/actions/requests.ts
    - tests/phase59/inbox-model.spec.ts
    - tests/phase60/office-requests.spec.ts
    - .planning/codebase/CAPABILITY-MATRIX.md
    - tests/phase59/capability-matrix.spec.ts
    - tests/phase60/capability-matrix.spec.ts
    - CLAUDE.md
    - .claude/skills/sketch-findings-SOPstart/SKILL.md
    - .claude/skills/sketch-findings-SOPstart/references/one-screen-site.md
key-decisions:
  - "Journey steps whose screen is a section of the home use route '/' and name the section in the detail text (the coverage matcher keys on the exact route string); no step carries '/activity' or '/admin/training'."
  - "Matrix row labels that name a room were renamed (Office -- X tab -> Sign-offs -- / People --; Workshop drafts list -> Manage SOPs drafts list) and the phase59 / phase60 specs that look the rows up moved in the same commit. Row labels pinned by phase46 / phase58 (Walk SOP, Phase 58 -- ... walk ...) are internal names for sop_walks / the old mode switch and were left."
  - "UAT test ids and question ids are stable keys in uat_feedback, so they were not renamed; the question id walk-clear stays (an id, not text). The two picture-as-home checks are archived, not deleted, so past responses still resolve."
  - "CONVENTIONS.md names no room, so it was not touched."
  - "REQUIREMENTS DOCS-01 and WORD-01 are NOT ticked here: 63-21 ticks after the phase eval."
requirements-completed: []
completed: 2026-10-08
---

# Phase 63 Plan 17: living maps for the SOP-first home Summary

**The pathways map, UAT hub, access matrix, capability matrix, CLAUDE.md routing and the design skill now describe the SOP-first home (find, read, start, the site map, the sections) instead of rooms; the no-walk-words guard covers the two configs.**

## Journeys

| Removed | Added |
|---|---|
| Find & open a procedure | Find and read a SOP (search, Recent, Most used, All SOPs by area or type, Ask for one / Write it, Make a request) |
| Follow a procedure & complete it | Start a SOP and finish it (start -> running -> Done / Stop -> Back to Read; picks up at step N; begin from step 1 asks first) |
| The one screen | Browse the site map (whole site -> area -> object -> Read; Esc back) |
| The one screen (admin) | On a phone (tab bar, List \| Site map, numbered key, Read with back link) |
| Manage team & roles | My record, notifications and requests |
| Training matrix & records | Sign-offs (Inbox, Requests, Decisions; replaces Review & sign off) |
| | People and access |
| | Training (matrix, a person's record, assessment requests) |
| | Manage SOPs (New SOP, drafts, site and departments, objectives) |

Kept and reworded: log in, join, observations, assessment requests, admin tools menu, all create-an-SOP, publish, versions, standards, wire-up access, ask someone, agent layer, governance queue, departments, map the site, feedback, account. `route: '/activity'` and `route: '/admin/training'` appear nowhere in the file. roles.ts: two walk words replaced; the access matrix rows are now home / My record / Sign-offs / Sign-offs Decisions, People, Training / Manage SOPs.

## UAT entries

Added: The home: find, read and start a SOP; The site map; Your sections; My record and notifications; The home on a phone. Archived (kept so past responses resolve): the picture-as-home worker check and the old phone home check. Reworded in place: speed and feel, sign-off naming, Sign-offs inbox, Sign-offs and People, the focus screen, requests/notifications/objectives; every `?place=` and `/admin/training` link now points at `/?s=...`.

## Matrix lines reworded (no cell changed)

Cell-by-cell diff of the two table versions: 92 rows both sides, the only row whose cells differ is "Mark a SOP reviewed" and only in the worker cell's explanation text (the dash is unchanged). Reworded: row labels for the Sign-offs / People tabs and the Manage SOPs drafts list, every `/?place=` address (to `/?s=signoffs`, `/?s=people`, `/?s=people&tab=access`, `/?s=manage&view=site`), "own walk" -> "own completion" (and the sibling "walk already decided" / "own walks" phrases the server strings dropped in 63-16), the Smoko / Workshop / Noticeboard / Office mentions. Spec lookups moved with the labels.

## Server strings

"Office access required" (asks.ts x3, office.ts x2, requests.ts x1) -> "You don't have access to this." No client code matched the old string (grep of `src/` for it and for `access required` outside actions); the only pins were `tests/phase59/inbox-model.spec.ts` and `tests/phase60/office-requests.spec.ts`, changed in the same commit.

## Routing and banner text

CLAUDE.md auto-load bullet: the home is governed by sketch 009 (variant A + the site map), sketch 010, ADR-0004 and ADR-0005; `references/one-screen-site.md` is superseded for the home except its focus rule. one-screen-site.md opens with the requested banner; SKILL.md has a new row for the SOP-first home, the old row marked superseded (focus rule stands), and the "read first" line updated. ADR-0005 is written by 63-20 (the text names it ahead of time, as the plan directs).

## Guard

`tests/lint/no-walk-words.spec.ts` DIRS now include `src/lib/journeys` and `src/lib/uat`; the first run flagged 44 strings (journeys, roles, UAT), all fixed. The self-test and the 63-20 allowlist note are untouched.

## Deviations from Plan

**1. [Rule 3 - blocking] Stale source-contract specs repointed.**
- `tests/phase51/site-workspace-wiring.spec.ts` pinned `?place=edit` in journeys.ts; now pins `view=site`.
- `tests/phase32/library-filter-deeplink.spec.ts` pinned `/?place=dept:${focus}` in WiringPatchBay, which 63-14 repointed to `/?area=${focus}`; 63-14 did not run the phase32 project. Spec now pins the new address.
- Files and commit: `088f2b42`.

**2. [Scope] Matrix row labels renamed** (plan said "rename room references"): the specs that look up those labels (phase59, phase60) changed in the same commit, as the plan's R2 note requires.

No gate changed. No auth gates.

## Verification

- `npx tsc --noEmit` clean.
- phase15-stubs `no-walk-words`, `no-global-blocks-in-journeys`, `no-dead-internal-hrefs` green; the touched phase28/30/32/40/41/43/46/51/55/56/57/58/59/60 spec files green.
- Project run: phase52 + 57 + 58 + 59 + 60 + 63 + phase15-stubs: 871 passed, 27 skipped (the pre-existing test.fixme / git-diff skips), 0 failed.
- `npm run build` exit 0; bundle gate: `/sops/[sopId]/page` 802 (baseline 802, +0), `/page` 832 (baseline 831, +1, tolerance 2). `.bundle-baseline.json` untouched.
- Acceptance greps: no `Smoko|Workshop|Noticeboard|the Office|Now card` in journeys.ts / roles.ts / tests.ts; no `Smoko|Workshop|Noticeboard|?place=` in the matrix; banner present in one-screen-site.md.

## Commits

- `088f2b42` pathways, roles and UAT checks, guard dirs, two stale specs
- `7701dd92` access refusals no longer name a room
- `dc030098` matrix prose, CLAUDE.md routing, skill banner

## Deployed check

`/api/version` served `19bad6cf` (this plan's HEAD) before the check. Opened https://sopstart.com/pathways as the eval admin (session via `tests/evals/lib/session.ts`), pressed All screens, screenshot read: **18 screens, 18 in a pathway, 0 not mapped yet**; the left list shows the new journeys (Find and read a SOP, Start a SOP and finish it, Browse the site map, On a phone, My record, Sign-offs, ...). The existing `home.eval.ts` DOCS-01 case asserts the same line; the check here was a one-off run (temporary spec, deleted, not committed).

## Self-Check: PASSED

- Commits `088f2b42`, `7701dd92`, `dc030098`, `19bad6cf` exist on master; pushed.
- Files listed under key-files exist; `.bundle-baseline.json` untouched.
