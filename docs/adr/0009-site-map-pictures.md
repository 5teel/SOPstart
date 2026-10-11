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

## Amendment (2026-10-11, same day)
Objects are pictured per named machine, not per object kind: `public/site-art/machine/<slug>.webp`, keyed by the SOP's first linked machine name; a SOP with no machine shows `notice-board`. They are GPT-image-2 / Seedream 5.0 isometric renders cut out with rembg. Hunyuan3D-2.1 was dropped: its texture pass ran out of memory on the 24 GB GPU (over 20 minutes per object). A machine without a picture keeps its drawn shape.

## Amendment 2 (2026-10-11)
Floor pictures are removed (Simon: the machine pictures make them unnecessary). An area is a tinted plate in its area colour with a dashed floor line inside its edge; every SOP's machine picture stands on it with a soft contact shadow; each area sign reads its name and "N SOPs" in one standard form.

## Amendment 3 (2026-10-11)
Each object stands in its own bay: a floor pad with a low partition on its two far sides, topped in the area colour (`Bay` in `MapShapes.tsx`, sized to the object's share of the plate). The ground carries walkways (`walkways()` in `iso-layout.ts`): a ring round the site, cross aisles between rows of areas and aisles between neighbouring areas, drawn pale with a dashed centre line in ink. Both are drawn shapes, not pictures, and carry no meaning.

Areas fill their row: every plate takes its row's depth and the last plate in a row runs to the site's width, so no bare floor is left beside the walkways. (Revised the same day: a short row shares its spare width across its plates, and a bay keeps its normal size in a wide area.)
