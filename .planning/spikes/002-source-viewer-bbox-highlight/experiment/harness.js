// Spike 002 harness — renders a PDF with pdfjs, lists extracted blocks, click → scroll + overlay.
// Reads ?pdf=<name>&report=<name>.json from query string so the same page works for every corpus PDF.
//
// Timing instrumentation: window.__spike002 = { clickToOverlayMs, blocks, ready } for Playwright probe.

import * as pdfjs from "/vendor/pdf.mjs";

pdfjs.GlobalWorkerOptions.workerSrc = "/vendor/pdf.worker.mjs";

const status = document.getElementById("status");
const pdfNameEl = document.getElementById("pdfName");
const viewer = document.getElementById("viewer");
const blockListEl = document.getElementById("blockList");

const setStatus = (s) => { status.textContent = s; };

window.__spike002 = {
  ready: false,
  blocks: [],
  lastClickMs: null,
  lastOverlayPaintMs: null,
  lastTotalMs: null,
  errors: [],
};

const params = new URLSearchParams(location.search);
const pdfQuery = params.get("pdf");
const reportQuery = params.get("report");
if (!pdfQuery || !reportQuery) {
  setStatus("missing ?pdf=...&report=... query");
  pdfNameEl.textContent = "no PDF specified";
  throw new Error("missing query params");
}
pdfNameEl.textContent = pdfQuery;

// scale for canvas rendering — keep relatively low for speed (we're measuring viewer responsiveness, not output quality)
const RENDER_SCALE = 1.25;

const pageWrappers = []; // { pageNum, wrap, viewport, canvas }

async function main() {
  setStatus("loading PDF…");
  const pdfUrl = `/corpus/${encodeURIComponent(pdfQuery)}`;
  const pdf = await pdfjs.getDocument(pdfUrl).promise;
  setStatus(`rendering ${pdf.numPages} pages…`);

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const viewport = page.getViewport({ scale: RENDER_SCALE });
    const wrap = document.createElement("div");
    wrap.className = "page-wrap";
    wrap.dataset.page = String(p);
    wrap.style.width = `${viewport.width}px`;
    wrap.style.height = `${viewport.height}px`;
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    wrap.appendChild(canvas);
    viewer.appendChild(wrap);
    const ctx = canvas.getContext("2d");
    await page.render({ canvasContext: ctx, viewport }).promise;
    pageWrappers.push({ pageNum: p, wrap, viewport, canvas });
  }
  setStatus("loading blocks…");

  // Load the spike-001 _report.json for this PDF — gives real {page, bbox} provenance
  // reportQuery is a path like "dir/_report.json"; encode each segment separately so we don't escape the slash.
  const reportEncoded = reportQuery.split("/").map(encodeURIComponent).join("/");
  const reportRes = await fetch(`/reports/${reportEncoded}`);
  if (!reportRes.ok) throw new Error(`report fetch failed: ${reportRes.status}`);
  const report = await reportRes.json();
  const imgs = (report.images ?? []).filter((i) => i.bbox && i.bbox.length === 4);
  window.__spike002.blocks = imgs.map((i, idx) => ({
    idx,
    page: i.page,
    bbox: i.bbox,
    pageWidth: i.pageWidth ?? null,
    pageHeight: i.pageHeight ?? null,
    objName: i.objName ?? null,
  }));

  // Render sidebar
  for (const b of window.__spike002.blocks) {
    const el = document.createElement("div");
    el.className = "block";
    el.dataset.blockIdx = String(b.idx);
    el.innerHTML = `<div class="label">Block #${b.idx + 1} · page ${b.page}</div>
      <div class="meta">bbox [${b.bbox.map((n) => n.toFixed(0)).join(", ")}]</div>`;
    el.addEventListener("click", () => handleBlockClick(b.idx));
    blockListEl.appendChild(el);
  }

  setStatus(`ready · ${pdf.numPages} pages · ${imgs.length} blocks`);
  window.__spike002.ready = true;
}

function handleBlockClick(idx) {
  const b = window.__spike002.blocks[idx];
  if (!b) return;
  const tClick = performance.now();
  window.__spike002.lastClickMs = tClick;

  // sidebar active state
  for (const el of blockListEl.children) el.classList.toggle("active", el.dataset.blockIdx === String(idx));

  // find the page wrapper
  const pw = pageWrappers.find((p) => p.pageNum === b.page);
  if (!pw) {
    window.__spike002.errors.push(`no pageWrapper for page ${b.page}`);
    return;
  }

  // remove any existing overlay
  const existing = pw.wrap.querySelectorAll(".overlay");
  for (const o of existing) o.remove();

  // bbox is in PDF user-space units (origin bottom-left). pdfjs viewport gives us a mapping
  // from PDF coords to canvas pixels via viewport.convertToViewportRectangle.
  const [x0, y0, x1, y1] = b.bbox;
  const rect = pw.viewport.convertToViewportRectangle([x0, y0, x1, y1]);
  // rect = [vx0, vy0, vx1, vy1] — may be reversed in either axis depending on rotation; normalise
  const vx0 = Math.min(rect[0], rect[2]);
  const vy0 = Math.min(rect[1], rect[3]);
  const vx1 = Math.max(rect[0], rect[2]);
  const vy1 = Math.max(rect[1], rect[3]);

  const overlay = document.createElement("div");
  overlay.className = "overlay";
  overlay.style.left = `${vx0}px`;
  overlay.style.top = `${vy0}px`;
  overlay.style.width = `${vx1 - vx0}px`;
  overlay.style.height = `${vy1 - vy0}px`;
  pw.wrap.appendChild(overlay);

  // scroll page into view (smooth would feel nicer for humans, but we measure raw responsiveness)
  pw.wrap.scrollIntoView({ behavior: "auto", block: "start" });

  // wait for next animation frame to mark overlay visible — that's when the user actually sees it
  requestAnimationFrame(() => {
    overlay.classList.add("visible");
    requestAnimationFrame(() => {
      const tPaint = performance.now();
      window.__spike002.lastOverlayPaintMs = tPaint;
      window.__spike002.lastTotalMs = tPaint - tClick;
    });
  });
}

window.__spike002.click = (idx) => handleBlockClick(idx);

main().catch((e) => {
  window.__spike002.errors.push(String(e?.stack || e));
  setStatus("ERROR: " + String(e?.message || e).slice(0, 80));
});
