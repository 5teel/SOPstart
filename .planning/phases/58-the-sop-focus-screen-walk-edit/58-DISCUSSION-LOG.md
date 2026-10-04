# Phase 58: The SOP Focus Screen — Walk & Edit - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-05
**Phase:** 58-the-sop-focus-screen-walk-edit
**Areas discussed:** What the editor edits, Reading without walking, Walk mechanics, Versions & publish

---

## What the editor edits

| Option | Description | Selected |
|--------|-------------|----------|
| Steps — one model | Editor reads/writes `sop_focus_steps`; ticks + AI findings re-key to steps; block machinery retired after a final converter run | ✓ |
| Blocks stay, converter on save | Block editor keeps `layout_data`; converter re-runs on autosave; two models forever | |
| Steps now, blocks read-only | New edits to steps; old block content frozen until converted | |

**User's choice:** Steps — one model.

| Option | Description | Selected |
|--------|-------------|----------|
| Re-point AI check at steps | Reviewer reads focus steps, flags a step; clear = verify path re-keyed; old block flags dropped | ✓ |
| Keep block flags, map to steps | Reviewer keeps reading `layout_data`; mapping kept alive | |
| Pause the AI check this phase | Ticks only; findings return in 61 | |

**User's choice:** Re-point at steps.

| Option | Description | Selected |
|--------|-------------|----------|
| Attach / remove only | Add/remove a step photo; no annotation | |
| Keep annotation | Re-home the Konva annotation tool onto step images | ✓ |
| Read-only images this phase | Converted images show; editing waits for 61 | |

**User's choice:** Keep annotation. **Notes:** Claude had recommended attach/remove only; Simon wants annotation kept.

| Option | Description | Selected |
|--------|-------------|----------|
| Full: sections + steps | Add/rename/reorder/delete sections and steps; kind, tip, photo-required; standards at three levels | ✓ |
| Steps only, sections fixed | Sections renamable only | |
| Text + kind + tick only | No structural changes this phase | |

**User's choice:** Full structure editing.

---

## Reading without walking

| Option | Description | Selected |
|--------|-------------|----------|
| Walk in browse state | One focus screen; all steps scrollable; no completion until "Start walking" | ✓ |
| Separate read-only focus view | A third mode beside Walk and Edit | |
| No reading — Walk only | "Show me" dropped | |

**User's choice:** Walk in browse state.

| Option | Description | Selected |
|--------|-------------|----------|
| Row decides: Walk or Edit | Walk → browse, Edit → editor; admin-only Walk ⇄ Edit switch in the top bar | ✓ |
| Always Edit for admins | No preview | |
| Always browse first | Edit button in the top bar | |

**User's choice:** Row decides, with the admin switch.

---

## Walk mechanics

| Option | Description | Selected |
|--------|-------------|----------|
| The whole SOP, in order | Hazard/PPE first, then every section; one completion per SOP | ✓ |
| One section = one job | Pick a section; one completion per section | |
| Whole SOP, sections skippable | Sections can be marked "not today" | |

**User's choice:** Whole SOP in order.

| Option | Description | Selected |
|--------|-------------|----------|
| Back only; forward is locked | Done steps revisitable; steps ahead locked; acks unskippable | ✓ (as default) |
| Free jumping | Any step clickable; acks still required before submit | ✓ (via admin toggle) |
| No jumping | Rail is progress only | |

**User's choice:** Free text — "Make the default = Back only; forward is locked, but add a toggle in the admin that allows this option to be relaxed so that forward jumps are allowed." **Notes:** Claude placed the toggle per-SOP in the editor's "This SOP" rail (Simon said "in the admin" — org-level default deferred).

| Option | Description | Selected |
|--------|-------------|----------|
| Resume from the server | Each ack/step/photo writes to the in-progress completion; "Resume (step n of N)" on reopen | ✓ |
| Local resume only | localStorage keyed to completion id | |
| Start over | Reload discards progress | |

**User's choice:** Resume from the server.

| Option | Description | Selected |
|--------|-------------|----------|
| Done screen, then Back | "Done — sent for sign-off" card + Back; no confirmation | |
| Confirm before sending | Review every step and photo; "Send for sign-off" is the final press | ✓ |
| Straight back to the site | Record written, return to /?place= immediately | |

**User's choice:** Confirm before sending. **Notes:** Claude had recommended the bare done screen.

---

## Versions & publish

| Option | Description | Selected |
|--------|-------------|----------|
| A draft of the next version | First edit forks a draft; Publish replaces latest; old version kept | ✓ |
| Edit in place, version bumps on Publish | Live rows edited directly | |
| Edit in place, hidden until Publish | Snapshot column per step | |

**User's choice:** A draft of the next version.

| Option | Description | Selected |
|--------|-------------|----------|
| Finish on v3, then banner | In-flight walk keeps its version; "Updated since you last walked it" next time | ✓ |
| Stop and restart on v4 | Progress discarded | |
| Silently continue on v3 | No badge | |

**User's choice:** Finish on v3, then banner.

| Option | Description | Selected |
|--------|-------------|----------|
| Rail entry, read-only | "v4 · 3 earlier versions" in the rail; opens in browse state badged superseded | ✓ |
| Keep the versions page as a bridge | Old page survives with a Back bar until 61 | |
| Nothing visible this phase | DB + ledger only | |

**User's choice:** Rail entry, read-only.

---

## Claude's Discretion

- Walk/edit addresses and the legacy redirects; how `?from=` carries the originating place.
- Parse-in-progress display and the ETA source (WRK-03).
- What a `check` step asks (tick vs typed value).
- Progress bar, rail copy, hazard/PPE button wording, step-kind colours (contract values).
- Autosave vs explicit save in the editor; whether AI ghosts survive.
- Deletion mechanics (dropped list, sweeps, repoint inventory, journeys, matrix) — Phase 57 idiom.

## Deferred Ideas

- Org-wide default for the forward-jump toggle (Phase 61).
- Restore an earlier version as a new draft (Phase 61).
- Section-as-job walks / skippable sections.
- Assignments → requests (Phase 60).
- Worker notes / "flag a problem" mid-walk (Phase 60 requests).
- Phone layout for the focus screen.
- Standards manager mount (Phase 61).
