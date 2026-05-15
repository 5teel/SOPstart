// DOCX → HTML (mammoth) → PDF (system Chrome --headless --print-to-pdf).
// Avoids Playwright chromium download (TLS cert intercept on this machine).
import mammoth from "mammoth";
import { writeFile, readFile, mkdir, stat, copyFile, rm, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const RAW = "C:\\Development\\SOPstart\\SOPstart - Raw SOPs";
const OUT = join(HERE, "corpus");
await mkdir(OUT, { recursive: true });

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const TARGETS = [
  { src: "EN-FOR-02-001 Forming Safety.docx", out: "small-forming-safety.pdf", note: "small text-mostly baseline" },
  { src: "EN-FOR-03-001 Forming Machine Swabbing.docx", out: "medium-forming-swabbing.pdf", note: "medium image-rich" },
  { src: "EN-FOR-03-043 Blank Temperature Measurement with Rondot Probe.docx", out: "large-rondot-probe.pdf", note: "large industrial SOP" },
];

const realPdf = join(RAW, "Plant JSA's", "Plenum chamber change procedure.pdf");
const realDst = join(OUT, "real-plenum-chamber.pdf");
if (existsSync(realPdf) && !existsSync(realDst)) {
  await copyFile(realPdf, realDst);
  console.log("COPIED real PDF -> real-plenum-chamber.pdf");
}

for (const t of TARGETS) {
  const dst = join(OUT, t.out);
  if (existsSync(dst)) {
    console.log(`SKIP (exists): ${t.out}`);
    continue;
  }
  const src = join(RAW, t.src);
  if (!existsSync(src)) {
    console.log(`MISSING SRC: ${src}`);
    continue;
  }
  const tStart = Date.now();
  console.log(`CONVERT: ${t.src} (${t.note})`);

  const buf = await readFile(src);
  const result = await mammoth.convertToHtml({ buffer: buf });
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    body { font-family: Arial, sans-serif; margin: 24px; }
    img { max-width: 100%; }
    table { border-collapse: collapse; } td, th { border: 1px solid #999; padding: 4px; }
    h1, h2, h3 { page-break-after: avoid; }
  </style></head><body>${result.value}</body></html>`;

  const htmlPath = join(tmpdir(), `spike-001-${Date.now()}-${t.out}.html`);
  await writeFile(htmlPath, html);

  const fileUrl = "file:///" + htmlPath.replace(/\\/g, "/");
  // Each Chrome invocation needs an isolated user-data-dir to avoid lock conflicts.
  const userData = join(tmpdir(), `chrome-spike-${Date.now()}`);

  const r = spawnSync(
    CHROME,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--no-pdf-header-footer",
      `--user-data-dir=${userData}`,
      `--print-to-pdf=${dst}`,
      fileUrl,
    ],
    { encoding: "utf8" }
  );

  await rm(htmlPath, { force: true });
  await rm(userData, { recursive: true, force: true }).catch(() => {});

  if (r.status !== 0) {
    console.log(`  FAILED: chrome exited ${r.status}`);
    console.log(r.stderr?.slice(0, 500));
    continue;
  }
  const s = await stat(dst);
  console.log(`  -> ${t.out} (${(s.size / 1024 / 1024).toFixed(2)} MB, ${Date.now() - tStart} ms)`);
}

console.log("\n--- Corpus ready ---");
for (const f of (await readdir(OUT)).sort()) {
  const s = await stat(join(OUT, f));
  console.log(`  ${f}: ${(s.size / 1024 / 1024).toFixed(2)} MB`);
}
