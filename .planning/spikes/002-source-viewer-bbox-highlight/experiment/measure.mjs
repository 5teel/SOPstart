// Spike 002 measurement runner.
// 1. Start the static server.
// 2. For each corpus PDF, open the harness with Playwright/system-Chrome.
// 3. Wait for ready, click N random blocks (or all if fewer), measure click-to-overlay timing.
// 4. Capture screenshots.
// 5. Write results.csv + results.json.

import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { writeFile, mkdir, readdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(HERE, "..", "..", "..", "..");
const RESULTS_DIR = join(HERE, "results");
const SCREENSHOTS_DIR = join(HERE, "screenshots");
await mkdir(RESULTS_DIR, { recursive: true });
await mkdir(SCREENSHOTS_DIR, { recursive: true });

const PORT = 4321;
const server = spawn(process.execPath, [join(HERE, "server.mjs")], {
  env: { ...process.env, PORT: String(PORT) },
  stdio: ["ignore", "pipe", "pipe"],
});
server.stdout.on("data", (d) => process.stdout.write(`[srv] ${d}`));
server.stderr.on("data", (d) => process.stderr.write(`[srv err] ${d}`));
// wait briefly for listen
await new Promise((r) => setTimeout(r, 300));

const SPIKE_001_OUTPUT = join(PROJECT_ROOT, ".planning", "spikes", "001-pdf-image-extraction-bundle-safe", "experiment", "output");
const SPIKE_001_CORPUS = join(PROJECT_ROOT, ".planning", "spikes", "001-pdf-image-extraction-bundle-safe", "experiment", "corpus");

const corpusPdfs = (await readdir(SPIKE_001_CORPUS)).filter((f) => f.toLowerCase().endsWith(".pdf"));

const cases = [];
for (const pdf of corpusPdfs) {
  const stem = pdf.replace(/\.pdf$/i, "");
  const reportPath = `${stem}/_report.json`;
  // make sure the report exists
  try {
    await readFile(join(SPIKE_001_OUTPUT, reportPath));
    cases.push({ pdf, report: reportPath });
  } catch {
    console.log(`skip ${pdf}: no Spike 001 report`);
  }
}

console.log(`Cases: ${cases.length}`);

let browser;
try {
  browser = await chromium.launch({ channel: "chrome", headless: true });
} catch (e) {
  console.error("chromium.launch({channel:'chrome'}) failed:", String(e?.message || e).slice(0, 200));
  console.error("Falling back to system Chrome via executablePath…");
  browser = await chromium.launch({
    headless: true,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  });
}

const results = [];

for (const c of cases) {
  console.log(`\n=== ${c.pdf} ===`);
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();

  // forward harness console errors
  const consoleErrors = [];
  page.on("pageerror", (e) => consoleErrors.push("pageerror:" + String(e?.message || e).slice(0, 200)));
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push("console.error:" + msg.text().slice(0, 200));
  });

  const url = `http://127.0.0.1:${PORT}/?pdf=${encodeURIComponent(c.pdf)}&report=${encodeURIComponent(c.report)}`;
  const tPageStart = Date.now();
  await page.goto(url, { waitUntil: "domcontentloaded" });

  // wait until __spike002.ready (with detailed failure mode reporting)
  try {
    await page.waitForFunction(() => window.__spike002 && window.__spike002.ready === true, null, { timeout: 60000 });
  } catch (e) {
    const dump = await page.evaluate(() => ({
      hasSpike: !!window.__spike002,
      ready: window.__spike002?.ready,
      errors: window.__spike002?.errors ?? [],
      statusText: document.getElementById("status")?.textContent,
    })).catch(() => null);
    console.error("waitForFunction failed:", e?.message);
    console.error("page state:", JSON.stringify(dump, null, 2));
    console.error("console errors captured:", consoleErrors);
    throw e;
  }
  const tReady = Date.now();
  const initial = await page.evaluate(() => ({ blocks: window.__spike002.blocks.length, errors: window.__spike002.errors }));
  console.log(`  ready in ${tReady - tPageStart} ms (${initial.blocks} blocks, ${initial.errors.length} errors)`);

  // pick up to 5 evenly-spread blocks to click
  const N = Math.min(5, initial.blocks);
  const picks = [];
  for (let i = 0; i < N; i++) picks.push(Math.floor((i + 0.5) * initial.blocks / N));

  const timings = [];
  for (const idx of picks) {
    // dispatch the click via API and read measurement back
    const t = await page.evaluate(async (i) => {
      // wait 2 frames to drain any previous render
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      window.__spike002.click(i);
      // wait until lastTotalMs updates
      const start = performance.now();
      while (window.__spike002.lastClickMs === null || performance.now() - window.__spike002.lastClickMs < 50 || window.__spike002.lastTotalMs === null) {
        await new Promise((r) => requestAnimationFrame(r));
        if (performance.now() - start > 2000) break;
      }
      return {
        idx: i,
        block: window.__spike002.blocks[i],
        clickToOverlayMs: window.__spike002.lastTotalMs,
      };
    }, idx);
    timings.push(t);
    console.log(`  click #${idx + 1} (page ${t.block.page}) → ${t.clickToOverlayMs?.toFixed?.(1) ?? "?"} ms`);
  }

  // For the screenshot, pick a mid-corpus block and re-click WITHOUT timing instrumentation,
  // then wait 250 ms (well above measured click→overlay budget) so scroll + paint settle.
  // This gives a reliable "overlay is visible on the right page" screenshot for human verification.
  if (initial.blocks > 0) {
    const shotIdx = Math.floor(initial.blocks / 2);
    await page.evaluate((i) => window.__spike002.click(i), shotIdx);
    await page.waitForTimeout(250);
  }
  const shotPath = join(SCREENSHOTS_DIR, `${c.pdf.replace(/\.pdf$/, "")}.png`);
  await page.screenshot({ path: shotPath, fullPage: false });

  const max = timings.map((t) => t.clickToOverlayMs).filter((x) => typeof x === "number").reduce((a, b) => Math.max(a, b), 0);
  const avg = timings.length ? timings.map((t) => t.clickToOverlayMs).reduce((a, b) => a + b, 0) / timings.length : null;

  results.push({
    pdf: c.pdf,
    blocks: initial.blocks,
    pageReadyMs: tReady - tPageStart,
    clicks: timings,
    maxClickToOverlayMs: max,
    avgClickToOverlayMs: avg,
    screenshot: `screenshots/${c.pdf.replace(/\.pdf$/, "")}.png`,
    errors: consoleErrors,
  });

  await ctx.close();
}

await browser.close();
server.kill();

// CSV summary
const csvHead = "pdf,blocks,pageReadyMs,avgClickToOverlayMs,maxClickToOverlayMs,errors";
const csvRows = results.map((r) =>
  [r.pdf, r.blocks, r.pageReadyMs, r.avgClickToOverlayMs?.toFixed(1) ?? "", r.maxClickToOverlayMs.toFixed(1), r.errors.length].join(",")
);
await writeFile(join(RESULTS_DIR, "results.csv"), [csvHead, ...csvRows].join("\n"));
await writeFile(join(RESULTS_DIR, "results.json"), JSON.stringify(results, null, 2));

console.log("\n=== SUMMARY ===");
for (const r of results) {
  console.log(
    `${r.pdf.padEnd(36)} ready=${String(r.pageReadyMs).padStart(5)}ms · click→overlay avg=${(r.avgClickToOverlayMs ?? NaN).toFixed(1)}ms max=${r.maxClickToOverlayMs.toFixed(1)}ms · ${r.blocks} blocks`
  );
}
console.log(`\nWrote ${results.length} rows to results/results.csv`);
