# ADR-0005: The library map replaces rooms

- **Status:** Accepted
- **Date:** 2026-10-08
- **Decided by:** Simon (sketch 009 variant A with the library site map, sketch 010; R1-R9 resolved by the orchestrator under ADR-0004)
- **Supersedes:** ADR-0003
- **Enforced by:** `tests/lint/no-rooms.spec.ts` (registered in `phase15-stubs`; retires ADR-0003's guard, `tests/phase57/rooms.spec.ts`)

## Context
ADR-0004 retired rooms as a metaphor for features and made the home find · read · start. ADR-0003
fixed four rooms per site template and resolved them on the server; with rooms gone those tables, the
two shells that drew them and the machine-coverage prompt ("this machine has no SOP") have no job.

## Decision
1. **No rooms.** The home's destinations are plain sections chosen by role. No room table, no room
   position, no picture-as-home.
2. **The home map is drawn in code from the library.** An area is a SOP's first machine's department,
   else its first department tag, else Site-wide, and is drawn only when it holds a visible published
   SOP. Every object is exactly one SOP; its kind is derived from the machine name, or a noticeboard-style
   site-wide object. Layout is automatic and colours come from the `--area-*` tokens.
3. **Site templates** (`src/lib/site/presets.ts`) give an admin a starting picture, departments and
   machines. They never place anything else. `site_layouts.preset` stays as data recording which
   template a layout came from; the home does not read it.
4. **The scene picture, machine outlines and the site editor are admin data** under Manage SOPs ->
   Site & departments. The home does not read them.
5. **There is no machine-coverage producer** (ADR-0004 rule 4). Stored agent machine requests stay as
   rows and are not offered for answer. The "machine without a SOP" row of ADR-0002's How-to-comply
   table no longer applies; ADR-0002's decision is unchanged.

## Consequences
- Machine objectives are edited in Manage, not shown on the home.
- SOP types are Machine / Process / Inspection / Emergency until a `sop_type` field exists.
- A new industry is still one template entry; it no longer needs room positions.
- The promo reel shows the earlier app until it is re-recorded.

## How to comply
- A new area is a department with a published SOP; nothing is added to a table.
- Never add a room table, a picture-as-home, or a "needs a SOP" prompt for a machine.
- Add a template: picture into `public/site-presets/`, entry in `SITE_PRESETS`, id in `SITE_PRESET_IDS`
  (all in `presets.ts`) and the `site_layouts_preset_check` constraint (new migration).
