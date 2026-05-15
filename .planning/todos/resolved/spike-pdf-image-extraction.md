---
title: Spike — PDF image extraction with provenance, bundle-safe
date: 2026-05-14
priority: high
gates: Phase 20 Plan 20-01
trigger: /gsd-explore session 2026-05-14 — Conversion Pipeline V2
status: RESOLVED 2026-05-15 → see .planning/spikes/001-pdf-image-extraction-bundle-safe/README.md
verdict: VALIDATED — unpdf.extractImages (bytes) + pdfjs-direct op-list+CTM (bbox); 0 MB bundle Δ
---

# Spike: PDF Image Extraction with Provenance, Bundle-Safe

## Why this exists

Phase 2 Plan 02-02 deferred PDF embedded-image extraction with this decision:

> **[Phase 02-02]: PDF image extraction skipped for v1 — @napi-rs/canvas 50MB+ bundle risk on Vercel**

That deferral is still live in production. Conversion Pipeline V2 (Phase 20) cannot ship without resolving it — D-CV2-02 commits to uniform coverage across all upload paths, and D-CV2-06 requires source-region provenance (page + bbox) on every block produced from a PDF.

Plan 20-01 has to commit to an extraction library/approach. Doing that without a feasibility spike risks repeating the 2-02 D mistake — picking a library that ships fine locally but blows the bundle budget or memory ceiling on Railway.

## Spike scope (run via /gsd-spike before /gsd-plan-phase 20)

**Question to answer:** Which PDF image-extraction approach is production-viable on Railway given our bundle budget and ~512 MB worker RAM?

**Candidates to compare:**

1. **`pdf-img-extract` / `pdf2pic`** — Node wrappers around GraphicsMagick / ImageMagick. Runtime dep on `gm` binary — Railway nixpack pin required.
2. **`pdfjs-dist`** server-side with custom render-to-canvas → extract — same canvas dependency that triggered the 2-02 D deferral.
3. **`unpdf` (current dep)** + custom image-extraction pass — `unpdf` already extracts text; check if its underlying `pdfjs` exposes embedded-image streams without rendering.
4. **`mupdf-js` / `mupdf` wasm** — wasm-only, no native dep; bundle cost TBD.
5. **External service call** — push PDF to a worker process / lambda / Supabase Edge Function that does extraction server-side, returns images + bbox metadata. Keeps Next.js bundle clean at cost of round-trip latency.
6. **Python sidecar** — `pdfplumber` / `PyMuPDF` are best-in-class. Railway can run a sidecar Python service. Heavy infra cost.

**Must-measure for each candidate:**

| Metric | Threshold |
|---|---|
| Production bundle size impact | ≤ +5 MB to `next start` bundle |
| Worker process RSS on 50-page PDF | ≤ 256 MB peak |
| Extraction time on 50-page PDF | ≤ 30s (current parse pipeline budget) |
| Image quality | Lossless or visually-lossless at native PDF resolution |
| Provenance metadata available | Per-image: `{page, bbox: [x0, y0, x1, y1]}` — this is non-negotiable |
| Railway nixpack compatibility | No manual binary installs that break on platform updates |

**Inputs to run against:**
- 1 small DOCX-converted PDF with embedded screenshots (~5 pages, ~3 images)
- 1 large industrial SOP PDF with photos + diagrams (~30 pages, ~20 images) — sourced from `.planning/research/customer-interviews/` or seeded
- 1 scanned-then-OCR'd PDF (image-per-page, no extractable embedded images — should gracefully fall back to scan-extraction path)

**Pitfalls to check explicitly:**
- Windows-only binary risk (cf. CLAUDE.md learning 2026-04-04 `@tailwindcss/oxide-win32-x64-msvc`)
- Node version compatibility — must work on Node 20+ per Railway pin
- Memory leak on long-running parse process — measure RSS across 5 consecutive 30-page extractions

## Deliverable

`.planning/spikes/pdf-image-extraction-bundle-safe/` containing:
- `README.md` with verdict (PICKED: candidate X / BLOCKED: reason) + measurements table
- `experiment/` — minimal working extractor for the picked candidate, runnable via `npx tsx`
- `notes.md` — discarded candidates with rejection reasons

## When this gates

`/gsd-plan-phase 20` MUST NOT run until this spike has a verdict written. Plan 20-01 commits to the schema *and* the extraction approach together — getting one without the other locks in a wrong choice.

## Related decisions

- `.planning/notes/conversion-pipeline-v2-decisions.md` § D-CV2-02 (coverage scope), D-CV2-06 (provenance metadata)
- `CLAUDE.md` learning 2026-04-04 (Windows-only npm packages break Railway builds)
- `CLAUDE.md` learning 2026-04-04 (Railway $PORT, Node 20+ pin)
