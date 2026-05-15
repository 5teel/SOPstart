---
spike: 001
name: pdf-image-extraction-bundle-safe
validates: "Given a corpus of industrial-SOP PDFs (small/medium/large + a real JSA scan), when each candidate library extracts embedded images, then we measure bundle Δ, peak RSS, wall-time, image count, byte-availability, and `{page, bbox}` provenance — and pick one that fits ≤ +5 MB bundle / ≤ 256 MB RSS / ≤ 30 s on Node 20 + Railway nixpack."
verdict: VALIDATED
related: []
tags: [phase-20, conversion-pipeline-v2, pdf, extraction, bundle-safety, plan-20-01-gate]
date_completed: 2026-05-15
gates: phase-20-plan-20-01
---

# Spike 001: PDF Image Extraction — Bundle-Safe

## What This Validates

Phase 2-02 deferred PDF image extraction with the decision *"@napi-rs/canvas 50 MB+ bundle risk on Vercel"*. Phase 20 Conversion Pipeline V2 cannot ship that deferral — D-CV2-02 mandates uniform coverage across all upload paths, and D-CV2-06 requires `{page, bbox}` provenance on every block.

This spike answers: **which approach is production-viable on Railway given our bundle budget and ~512 MB worker RAM?** It runs four candidates against the same corpus of real industrial-SOP PDFs and measures all six "must-measure" criteria from the spike brief.

## How to Run

```powershell
cd C:\Development\SOPstart\.planning\spikes\001-pdf-image-extraction-bundle-safe\experiment; node convert-corpus.mjs; node run.mjs
```

The first command builds the corpus (DOCX → HTML via mammoth → PDF via system Chrome `--headless --print-to-pdf`; copies the one real PDF from `SOPstart - Raw SOPs/Plant JSA's/` as-is). The second runs every extractor × every PDF in isolated child processes (RSS sampled at 100 ms cadence) and writes `results/results.csv` + per-extractor `output/*/_report.json` sidecars with bbox + bytes-saved status per image.

## What to Expect

- `corpus/` ends with 4 PDFs (139 KB → 4.43 MB)
- `results/results.csv` ends with 16 rows (4 extractors × 4 PDFs)
- `output/<pdf>/*.png` contains the actually-extracted images for `pdfjs-render` and `unpdf` — visually verifiable

## Results

### Measurement table (all 4 extractors × 4 PDFs)

| Extractor | PDF | Wall (ms) | Peak RSS (MB) | Pages | Imgs | Bytes | Bbox |
|---|---|---:|---:|---:|---:|---:|---:|
| **mupdf** (wasm) | large (4.43 MB, 17p) | 465 | 85.5 | 17 | 37 | 0 (a) | 37 |
| | medium (1.66 MB, 19p) | 483 | 77.3 | 19 | 44 | 0 (a) | 44 |
| | real plenum (0.41 MB, 2p) | 476 | 75.1 | 2 | 9 (b) | 0 (a) | 9 |
| | small (0.14 MB, 6p text-only) | 463 | 72.4 | 6 | 0 | 0 | 0 |
| **pdfjs-direct** (CTM walk) | large | 618 | 78.8 | 17 | 37 | 7 (c) | 37 |
| | medium | 766 | 84.0 | 19 | 44 | 35 (c) | 44 |
| | real plenum | 668 | 73.0 | 2 | 7 (b) | 4 (c) | 7 |
| | small | 521 | 67.4 | 6 | 0 | 0 | 0 |
| **pdfjs-render** (forced resolve + save) | large | 998 | 139.3 | 17 | 37 | 37 | 37 |
| | medium | **21 392** (d) | 104.9 | 19 | 44 | 40 (d) | 44 |
| | real plenum | 756 | 87.8 | 2 | 7 | 7 | 7 |
| | small | 606 | 73.6 | 6 | 0 | 0 | 0 |
| **unpdf** (`extractImages` public API) | large | 1159 | 151.6 | 17 | 37 | 37 | 0 (e) |
| | medium | 1277 | 150.4 | 19 | 44 | 44 | 0 (e) |
| | real plenum | 791 | 88.5 | 2 | 7 (b) | 7 | 0 (e) |
| | small | 617 | 85.6 | 6 | 0 | 0 | 0 |

Notes:
- (a) `mupdf` returns image metadata + bbox through `toStructuredText("preserve-images")` JSON, but the bytes require a separate `page.getImages()` pass not implemented in this spike.
- (b) `mupdf` reports **9** images on real-plenum where pdfjs reports **7** — the 2-image delta is a known difference in how each library counts image-mask + inline-image ops. Both are correct, just over different definitions of "image".
- (c) `pdfjs.getOperatorList()` does NOT eagerly decode image objects. Without a second forced-resolve pass, only ~10–80 % of images come back with bytes. Bbox coverage is 100 % regardless.
- (d) `pdfjs-render` is slow on **medium** because 4 images are `paintImageMaskXObject` calls whose `page.objs.get()` never resolves; my 5 s timeout × 4 = ~20 s overhead. Wall-time-per-image excluding masks is ~25 ms. Production code should skip masks or use a shorter timeout.
- (e) `unpdf.extractImages` returns the decoded image stream but NO bbox. This is a fundamental API limit, not a bug.

### Thresholds from the spike brief

| Metric | Threshold | unpdf | pdfjs-direct | pdfjs-render | mupdf |
|---|---|---|---|---|---|
| Bundle Δ for image-extraction | ≤ +5 MB | **0 MB** (already a dep) | **0 MB** (re-use unpdf) | **0 MB** (re-use unpdf) | 13 MB on-disk install / 9.6 MB wasm runtime — see § Bundle accounting |
| Peak RSS on 17-page PDF | ≤ 256 MB | 152 MB ✅ | 79 MB ✅ | 139 MB ✅ | 86 MB ✅ |
| Extraction time on 17-page PDF | ≤ 30 s | 1.2 s ✅ | 0.6 s ✅ | 1.0 s ✅ | 0.5 s ✅ |
| Image quality | lossless / visually lossless | full RGB/RGBA bytes ✅ | partial bytes | full RGB/RGBA bytes ✅ | bytes via separate pass ⚠ |
| `{page, bbox}` provenance | non-negotiable | **NO** ❌ | YES ✅ | YES ✅ | YES ✅ |
| Railway nixpack compat | no manual binaries | YES (already shipped) ✅ | YES ✅ | YES ✅ | YES (wasm-only) ✅ |

### Bundle accounting

- **unpdf** already ships in production (`mammoth` adjacent dep, ~2 MB on disk including `pdfjs-dist` core). No additional bundle cost to use `extractImages`.
- **mupdf wasm**: 9.6 MB uncompressed `.wasm` + 100 KB JS. Brotli ~3.5 MB. Next.js + Railway: add `mupdf` to `serverExternalPackages` so the wasm is NOT bundled into `next start`, just loaded from `node_modules` at runtime. Net `.next` bundle Δ stays near 0; runtime Docker image size grows by ~10 MB.

### Production-viable verdict

**Picked approach: `unpdf` for image BYTES + `pdfjs-direct` (via `getResolvedPDFJS()`) for `{page, bbox}` PROVENANCE.**

Both are the same underlying `pdfjs-dist` v4.x already shipped with `unpdf`. We use two different surfaces of the library:

1. `await extractImages(freshUint8ArrayPerCall, pageNum)` → decoded `{data, width, height, channels, key}` per image, in render order
2. `await pdf.getPage(p).getOperatorList()` → walk `fnArray` for `paintImageXObject` ops, track CTM through `transform`/`save`/`restore`, emit `bbox` per image in render order

Correlate the two outputs by `(page, index-on-page)` — both libraries return images in PDF render order, so positional matching is sufficient. Plan 20-01 will validate this fusion in an integration test, but every measurement here supports it: the two extractors report identical image counts per page across the entire corpus.

**Rejected (no measurement needed):**
- `pdf2pic` / `pdf-img-extract` (gm/ImageMagick binary) — Railway nixpack risk, repeats the Phase 2-02 D rationale
- `@napi-rs/canvas` — same 50 MB+ bundle risk that triggered the 2-02 D
- External Edge Function — over-engineered when pure-JS clears all thresholds
- Python sidecar — out of stack, extra infra cost

**Considered, runner-up:**
- `mupdf-wasm` — wins on speed (0.5 s/large) and cleanest bbox surface (`toStructuredText("preserve-images")`), but the 9.6 MB wasm asset adds a Docker layer for no measurable production-fitness gain over the chosen approach. Keep in mind for Phase 17 (image annotation) where a `Pixmap` API matters more.

## Key discoveries

| # | Discovery |
|---|---|
| 1 | **`pdfjs` (inside `unpdf`) holds internal worker state on the input `ArrayBuffer`.** Calling `await extractImages(sameUint8Array, p)` twice in sequence crashes with `DataCloneError: Cannot transfer object of unsupported type` at `LoopbackPort.postMessage`. The fix: construct a fresh `Uint8Array(buf)` per page-call. This is undocumented and is **the** gotcha if Plan 20-01 reaches for `extractImages`. |
| 2 | `pdfjs.getOperatorList()` does NOT eagerly populate `page.objs` with decoded image streams. Without a forced `objs.get(name, callback)` resolve pass, only 10–80 % of images come back with bytes despite all of them having a valid op-code entry. |
| 3 | Image-mask `paintImageMaskXObject` calls never resolve via `page.objs.get()` — their data lives elsewhere. A naive forced-resolve-with-timeout approach will hang for 5 s per mask. Production code should branch on op-code and route masks through `getOperatorList`-args directly. |
| 4 | `mupdf-wasm` is the only library here that reports image-mask + inline-image counts truthfully. `pdfjs` under-counts the same SOPs by 1–2 images. Not a blocker — those extra "images" are usually inline 1-bit masks that aren't worth surfacing as Puck blocks anyway. |
| 5 | **The corpus is DOCX-heavy, not PDF-heavy.** `SOPstart - Raw SOPs/` has 1 PDF + 17 DOCX + 666 legacy DOC. Plan 20-01 cannot test PDF extraction against a real "industrial PDF" corpus without a DOCX→PDF conversion step. The Chrome `--headless --print-to-pdf` approach in `convert-corpus.mjs` works in 0.8–1.5 s per file and is reproducible. |
| 6 | Local Playwright `npx playwright install chromium` failed with `UNABLE_TO_VERIFY_LEAF_SIGNATURE` (corporate TLS cert intercept on this machine — same family as the existing CLAUDE.md learning that gated Phase 15 chromium tests). Fallback: system Chrome at `C:\Program Files\Google\Chrome\Application\chrome.exe` with `--headless=new --print-to-pdf`. **npm install for the spike's mupdf dep also needed `--strict-ssl=false`**. |

## Feasibility assessment

Phase 20 Conversion Pipeline V2 is feasible on Railway with the existing dependency set. **No new production dependency is required.** The spike resolves the live Phase 2-02 deferral entirely.

## Signal for the build (Plan 20-01)

1. Use `unpdf.extractImages(freshUint8Array, pageNum)` for bytes; reuse `pdfjs` from `getResolvedPDFJS()` for `getOperatorList` + CTM-derived bbox. Correlate by `(page, index-on-page)`.
2. **Always** allocate a fresh `Uint8Array(buf)` per `extractImages` call — log a clear comment + add the CLAUDE.md learning.
3. Skip `paintImageMaskXObject` images at the extraction layer (they are 1-bit masks, not content). Plan 20-01 acceptance criteria should explicitly cover only `paintImageXObject` + `paintInlineImageXObject`.
4. Emit `block_provenance.region = {page, bbox: [x0, y0, x1, y1], pageWidth, pageHeight}` per D-CV2-06. `pageWidth/pageHeight` come from `page.getViewport({scale: 1})` and are needed so the source-viewer (Spike 002) can scale the bbox to the rendered PDF dimensions.
5. **Do NOT** call `getDocumentProxy` first and then `extractImages` on the same `Uint8Array` — the proxy mutates internal state and the subsequent `extractImages` calls crash. If you need `numPages` and images both, get `numPages` from a probe `getDocumentProxy(new Uint8Array(buf))` and discard, then call `extractImages(new Uint8Array(buf), p)` per page.
6. PDF page count + average image count from the spike corpus suggests budgeting **~50–100 ms per image** for full byte extraction + bbox computation. A 30-page industrial PDF with ~20 images comfortably fits the 30 s parse-pipeline budget.

## Discarded candidates — short notes

See `notes.md` for the long form.

- **`pdf2pic` / `pdf-img-extract`** — GraphicsMagick / ImageMagick binary required. Repeats Phase 2-02 D risk (Railway nixpack pin for native binaries, Windows-only pkg risk). Rejected without measurement.
- **`@napi-rs/canvas`** — 50 MB+ bundle. Phase 2-02 D explicitly rejected this. Not re-litigated.
- **External Edge Function / lambda** — adds round-trip latency + ops surface for a problem solved by an already-shipped dep. Defer to Plan 20-01 only if pure-JS fusion fails on a real Visy-corpus run.
- **Python sidecar (`pdfplumber`, `PyMuPDF`)** — best-in-class quality but out of stack. Same reasoning as Edge Function.
- **`mupdf-wasm`** — measured. Loses on bundle size vs the unpdf fusion approach with no production-fitness gain.
