# ADR-0003: Site templates are code; a layout records which one it came from

- **Status:** Superseded by ADR-0005
- **Date:** 2026-10-06
- **Decided by:** Simon ("make this homepage more generic, with different visual versions": railway maintenance, trades training centre, food-safety training kitchen, bottling factory)
- **Supersedes:** —
- **Enforced by:** `tests/phase57/rooms.spec.ts` (every template's rooms and machines are in range and do not overlap)

## Context
The home screen is one isometric picture per organisation with machine outlines drawn on it. The four rooms (Office, Smoko room, Workshop, Noticeboard) are fixed positions in `src/lib/site/rooms.ts` (Phase 57 D-01: no admin positions a room), tuned to the Visy picture. A second picture puts those rooms in the wrong place.

## Decision
1. A site template is a constant in `src/lib/site/presets.ts` (name, departments, machine outlines as fractions of the picture) with its picture in `public/site-presets/<id>.jpg` and its room positions in `PRESET_ROOMS` in the same file; the server resolves a layout's rooms with `roomsFor()` and sends only that list.
2. `site_layouts.preset` (nullable, check-constrained to the template ids) records which template a layout came from. Null means the default room table.
3. Applying a template (`applySitePreset`) is admin-only, only on an organisation with no site, and copies the picture into that organisation's scene path; after that the site is ordinary data the admin edits as any other.
4. Rooms stay fixed per picture: there is still no room table and no admin control that moves a room.

## Consequences
- New industries are added by generating a picture, placing outlines on a grid overlay of it, and adding one entry to each table — no migration beyond extending the check constraint.
- Room positions for a template change for every organisation on that template at once.

## How to comply
- Add a template: picture into `public/site-presets/`, entry in `SITE_PRESETS`, rooms in `PRESET_ROOMS`, id in `SITE_PRESET_IDS` (all in `presets.ts`) and the `site_layouts_preset_check` constraint (new migration).
- UI reads `layout.rooms` (resolved on the server); only the server calls `roomsFor(layout.preset)`.
