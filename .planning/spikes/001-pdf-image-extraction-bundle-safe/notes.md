# Spike 001 — Discarded Candidates

Long-form rejection notes for libraries that were considered but not measured. The README's "Discarded candidates" section is the summary.

## `pdf2pic` / `pdf-img-extract`

Both wrap GraphicsMagick or ImageMagick. Requires:

- A `gm` or `convert` binary on the worker host
- Railway nixpack `nixPkgs` pin (`graphicsmagick` or `imagemagick`)
- Cross-platform install — Windows dev sometimes needs the binary in PATH manually

This is exactly the failure mode that triggered CLAUDE.md learning **2026-04-04 Windows-only npm packages break Railway (Linux) builds** and **2026-04-04 Railway Node version defaults to 18 — pin via nixpacksPlan**. The risk of "passes locally, breaks on Railway after a platform update" is non-trivial for a safety-critical extraction path.

**Rejected** — repeats the Phase 2-02 D rationale (native binary on serverless host).

## `@napi-rs/canvas`

Required to render `pdfjs` pages to a canvas on Node. Phase 2-02 D explicitly rejected this with the note *"50 MB+ bundle risk on Vercel"*. The chosen approach (pdfjs op-list walk for bbox + unpdf for bytes) does not require any canvas, so this candidate is moot.

**Rejected** — supersedes Phase 2-02 D entirely; we no longer need canvas-rendering at all.

## `mupdf-wasm`

**Measured.** See README results table. Strong runner-up:

- Cleanest bbox API (`page.toStructuredText("preserve-images").asJSON()` returns `{type: "image", bbox: {x, y, w, h}, image: {width, height}}` per image block)
- Fastest extractor in the corpus (0.5 s on the 17-page PDF — beats every pdfjs path)
- Lowest peak RSS (86 MB on large vs 152 MB for unpdf)
- Pure wasm — no native binary, Railway-safe by construction

Loses on:

- 9.6 MB wasm asset adds a Docker layer for no measurable production-fitness gain over unpdf-fusion (which is 0 MB bundle Δ)
- Image-byte extraction would require a separate `page.getImages()` traversal not implemented in this spike — adds development cost vs unpdf's one-liner

**Recommendation**: keep on the shelf for Phase 17 (Konva annotation) where a high-quality `Pixmap` API matters more than the bundle cost.

## External Supabase Edge Function / AWS Lambda

Theoretical advantage: keeps Next.js bundle clean by pushing PDF extraction off-process.

In practice:

- The chosen unpdf-fusion approach has 0 MB bundle Δ — there is nothing to offload.
- Round-trip latency adds 100–500 ms per extraction job (Supabase Edge Functions cold-start latency)
- Adds new ops surface: deploy pipeline, function logs, monitoring, RLS auth on the function
- Storage egress costs for the source PDF being uploaded twice (client → Storage → function)

**Rejected** — over-engineered when pure-JS clears all thresholds. Reconsider only if the Visy corpus (when sourced) reveals a class of PDF that pure-JS cannot handle.

## Python sidecar (`pdfplumber`, `PyMuPDF`)

Both are industry-leading for PDF parsing quality. PyMuPDF is the canonical reference for "how do I get the bbox of this image in a PDF" — many of the patterns in this spike are derived from PyMuPDF documentation.

In practice for SOPstart:

- Out of stack (Node + Next.js + Supabase + Railway, no Python)
- Railway can run a Python sidecar but that adds: a separate service, a Dockerfile, deploy pipeline, inter-service auth, and 50–200 ms latency per call
- All the extraction patterns we need are achievable in pdfjs/mupdf — no semantic gap

**Rejected** — out of stack. Same reasoning as Edge Function but with worse infra cost.
