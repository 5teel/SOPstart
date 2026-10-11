# ADR-0009: The site map may carry pictures

- **Status:** Accepted
- **Date:** 2026-10-11
- **Decided by:** Simon ("better looking site maps with actual beautiful graphics")
- **Enforced by:** review only

## Context
The library site map (ADR-0005) drew every area and object as flat token-coloured shapes. Simon asked for a map that looks like the place: a track yard, a filler hall, a switchboard room. ADR-0007 keeps colour for safety, so pictures need a rule about what they may mean.

## Decision
1. Each area may have a floor picture (`public/site-art/floor/<slug>.webp`, keyed by the department name; Site-wide uses `site-wide`), a top-down plan laid onto the plate's top face. Objects in a pictured area are drawn as rendered pictures (`public/site-art/obj/<kind>.webp`), one per object kind. Lookup lives in `src/lib/library/site-art.ts`.
2. Pictures decorate only. They carry no meaning: the plate outline in the area colour, the signs, counts, labels and status marks stay drawn on top, and each object is still exactly one SOP.
3. Pictures are muted and avoid red, amber and yellow as dominant colours, so hazard and overdue signals still stand out (ADR-0007).
4. Floors are made with GPT-image-2; objects are GPT-image-2 references turned into 3D with Hunyuan3D-2.1 and rendered at true isometric to match `project()` in `src/lib/library/iso.ts`. Working files live in `.planning/site-art-work/`.
5. An area without a picture keeps the flat plate and drawn objects.

## Consequences
- Easier: a site reads as its place at a glance; demo sites look real.
- Harder: a new department name has no picture until one is made and its slug is added to `site-art.ts`.
- Each picture is a static file; the map loads up to ~25 small webp files.
