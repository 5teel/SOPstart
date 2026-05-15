// Spike 004 — measure mechanical-floor time-to-publish AND simulate three speeds:
//   1. Machine-speed: full-speed keyboard mash (j a j a …)
//   2. Skim-speed: 500ms read pause per block + a
//   3. Careful-speed: 3000ms inspect pause per block + a (= realistic admin pace)
// All run against the same 50-block fixture. Output: results.csv + screenshot per pass.

import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const RESULTS = join(HERE, "results");
const SHOTS = join(HERE, "screenshots");
await mkdir(RESULTS, { recursive: true });
await mkdir(SHOTS, { recursive: true });

const PORT = 4322;
const server = spawn(process.execPath, [join(HERE, "server.mjs")], { env: { ...process.env, PORT: String(PORT) }, stdio: ["ignore", "pipe", "pipe"] });
server.stdout.on("data", (d) => process.stdout.write(`[srv] ${d}`));
server.stderr.on("data", (d) => process.stderr.write(`[srv err] ${d}`));
await new Promise((r) => setTimeout(r, 300));

let browser;
try {
  browser = await chromium.launch({ channel: "chrome", headless: true });
} catch {
  browser = await chromium.launch({ headless: true, executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" });
}

const passes = [
  { name: "machine-speed", pausePerBlockMs: 0 },
  { name: "skim-speed", pausePerBlockMs: 500 },
  { name: "careful-speed", pausePerBlockMs: 3000 },
];

const results = [];

for (const pass of passes) {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e?.message || e).slice(0, 200)));
  page.on("console", (msg) => { if (msg.type() === "error") errors.push("console: " + msg.text().slice(0, 200)); });

  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__spike004 && window.__spike004.blocks.length === 50, null, { timeout: 30000 });
  const totalBlocks = await page.evaluate(() => window.__spike004.blocks.length);

  console.log(`\n=== Pass: ${pass.name} (pause ${pass.pausePerBlockMs}ms/block) ===`);
  const t0 = Date.now();
  // Focus body and run the loop: pause → press 'a' (approve advances focus to next block)
  await page.locator("body").focus();
  for (let i = 0; i < totalBlocks; i++) {
    if (pass.pausePerBlockMs > 0) await page.waitForTimeout(pass.pausePerBlockMs);
    await page.keyboard.press("a");
  }
  // Wait for publish button to become enabled
  try {
    await page.waitForFunction(() => !document.getElementById("publish").disabled, null, { timeout: 5000 });
  } catch (e) {
    errors.push("publish button never enabled");
  }
  const stateBeforePublish = await page.evaluate(() => ({
    approved: window.__spike004.blocks.filter((b) => b.status === "approved").length,
    declined: window.__spike004.blocks.filter((b) => b.status === "declined").length,
    flaggedAcked: window.__spike004.blocks.filter((b) => b.flags?.length && b.flagsAcknowledged).length,
    keystrokes: window.__spike004.keystrokes,
    pointerEvents: window.__spike004.pointerEvents,
    publishDisabled: document.getElementById("publish").disabled,
  }));

  await page.locator("#publish").click({ trial: false }).catch(() => {});
  await page.waitForTimeout(50);
  const finalState = await page.evaluate(() => ({
    publishedAtMs: window.__spike004.publishedAtMs,
    keystrokes: window.__spike004.keystrokes,
    pointerEvents: window.__spike004.pointerEvents,
    startTs: window.__spike004.startTs,
  }));

  const wallMs = Date.now() - t0;
  const shotPath = join(SHOTS, `${pass.name}.png`);
  await page.screenshot({ path: shotPath, fullPage: false });

  console.log(`  approved=${stateBeforePublish.approved}/${totalBlocks}  publishedAt=${finalState.publishedAtMs?.toFixed?.(0)}ms  wall=${wallMs}ms  keys=${finalState.keystrokes}  errors=${errors.length}`);

  results.push({
    pass: pass.name,
    pausePerBlockMs: pass.pausePerBlockMs,
    totalBlocks,
    approved: stateBeforePublish.approved,
    declined: stateBeforePublish.declined,
    flaggedAcked: stateBeforePublish.flaggedAcked,
    publishedAtMs: finalState.publishedAtMs,
    wallMs,
    keystrokes: finalState.keystrokes,
    pointerEvents: finalState.pointerEvents,
    perBlockApproxMs: finalState.publishedAtMs ? finalState.publishedAtMs / totalBlocks : null,
    screenshot: `screenshots/${pass.name}.png`,
    errors,
  });

  await ctx.close();
}

await browser.close();
server.kill();

const csvHead = "pass,pausePerBlockMs,totalBlocks,approved,publishedAtMs,wallMs,keys,perBlockApproxMs,errors";
const csvRows = results.map((r) =>
  [r.pass, r.pausePerBlockMs, r.totalBlocks, r.approved, r.publishedAtMs?.toFixed?.(0) ?? "", r.wallMs, r.keystrokes, r.perBlockApproxMs?.toFixed?.(1) ?? "", r.errors.length].join(",")
);
await writeFile(join(RESULTS, "results.csv"), [csvHead, ...csvRows].join("\n"));
await writeFile(join(RESULTS, "results.json"), JSON.stringify(results, null, 2));

console.log("\n=== SUMMARY ===");
for (const r of results) {
  console.log(`${r.pass.padEnd(18)} pause=${r.pausePerBlockMs}ms  publishedAt=${(r.publishedAtMs ?? 0).toFixed(0).padStart(7)}ms  perBlock=${(r.perBlockApproxMs ?? 0).toFixed(1).padStart(6)}ms  approved=${r.approved}/${r.totalBlocks}  errors=${r.errors.length}`);
}
