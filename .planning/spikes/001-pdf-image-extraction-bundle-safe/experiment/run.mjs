// Spike 001 — PDF image extraction runner
// Iterates extractor × corpus, samples RSS during run, writes results.csv + JSON.
//
// Each extractor runs in a CHILD PROCESS so we capture true peak RSS isolated from the parent.

import { readFile, readdir, writeFile, stat, mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, basename } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const CORPUS_DIR = join(HERE, "corpus");
const EXTRACTORS_DIR = join(HERE, "extractors");
const RESULTS_DIR = join(HERE, "results");

await mkdir(RESULTS_DIR, { recursive: true });

const extractors = (await readdir(EXTRACTORS_DIR))
  .filter((f) => f.endsWith(".mjs"))
  .map((f) => ({ file: f, path: join(EXTRACTORS_DIR, f), name: f.replace(/\.mjs$/, "") }));

const corpus = (await readdir(CORPUS_DIR))
  .filter((f) => f.toLowerCase().endsWith(".pdf"))
  .map((f) => ({ file: f, path: join(CORPUS_DIR, f) }));

console.log("Extractors:", extractors.map((e) => e.name).join(", "));
console.log("Corpus:", corpus.map((c) => c.file).join(", "));

const results = [];

for (const ex of extractors) {
  for (const pdf of corpus) {
    const pdfStat = await stat(pdf.path);
    const result = await runChild(ex, pdf, pdfStat.size);
    results.push(result);
    console.log(
      `  ${ex.name} × ${pdf.file}: ${result.status} | ${result.wallMs}ms | RSS peak ${
        result.peakRssMB?.toFixed(1) ?? "?"
      }MB | imgs=${result.imageCount ?? "?"} (bytes=${result.imagesWithBytes ?? "?"}, bbox=${
        result.imagesWithBbox ?? "?"
      })`
    );
  }
}

// CSV
const csvHead = [
  "extractor",
  "pdf",
  "pdfBytes",
  "status",
  "wallMs",
  "peakRssMB",
  "numPages",
  "imageCount",
  "imagesWithBytes",
  "imagesWithBbox",
  "supportsImages",
  "error",
].join(",");
const csvRows = results.map((r) =>
  [
    r.extractor,
    r.pdf,
    r.pdfBytes,
    r.status,
    r.wallMs,
    r.peakRssMB?.toFixed(2) ?? "",
    r.numPages ?? "",
    r.imageCount ?? "",
    r.imagesWithBytes ?? "",
    r.imagesWithBbox ?? "",
    r.supportsImages ?? "",
    JSON.stringify(r.error ?? ""),
  ].join(",")
);
await writeFile(join(RESULTS_DIR, "results.csv"), [csvHead, ...csvRows].join("\n"));
await writeFile(join(RESULTS_DIR, "results.json"), JSON.stringify(results, null, 2));

console.log(`\nWrote ${results.length} rows to results/results.csv`);

function runChild(extractor, pdf, pdfBytes) {
  return new Promise((resolve) => {
    const start = Date.now();
    let peakRss = 0;
    const args = ["--experimental-vm-modules", join(HERE, "child.mjs"), extractor.path, pdf.path];
    const child = spawn(process.execPath, args, { stdio: ["ignore", "pipe", "pipe"] });

    let stdoutBuf = "";
    let stderrBuf = "";
    child.stdout.on("data", (d) => (stdoutBuf += d.toString()));
    child.stderr.on("data", (d) => (stderrBuf += d.toString()));

    // RSS sampling via memoryUsage of the child — Node doesn't expose other-process RSS easily on Windows.
    // Workaround: child reports memoryUsage().rss periodically on stderr lines tagged with RSS=.
    // We'll parse those.
    const rssMatcher = /\bRSS=(\d+)\b/g;
    const rssListener = () => {
      let m;
      while ((m = rssMatcher.exec(stderrBuf)) !== null) {
        const v = parseInt(m[1], 10);
        if (v > peakRss) peakRss = v;
      }
    };
    child.stderr.on("data", rssListener);

    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
    }, 120_000);

    child.on("close", (code) => {
      clearTimeout(timeout);
      const wallMs = Date.now() - start;
      let parsed = null;
      let parseError = null;
      try {
        // child prints a JSON result line prefixed with RESULT=
        const idx = stdoutBuf.lastIndexOf("RESULT=");
        if (idx !== -1) {
          parsed = JSON.parse(stdoutBuf.slice(idx + "RESULT=".length).trim());
        }
      } catch (e) {
        parseError = String(e);
      }
      resolve({
        extractor: extractor.name,
        pdf: basename(pdf.path),
        pdfBytes,
        status: code === 0 && parsed ? "ok" : "error",
        wallMs,
        peakRssMB: peakRss / (1024 * 1024) || null,
        numPages: parsed?.numPages,
        imageCount: parsed?.imageCount,
        imagesWithBytes: parsed?.imagesWithBytes,
        imagesWithBbox: parsed?.imagesWithBbox,
        supportsImages: parsed?.supportsImages,
        sampleImages: parsed?.sampleImages,
        error: code === 0 && parsed ? null : stderrBuf.split("\n").slice(-20).join("\n") + (parseError ? ` | parseError: ${parseError}` : ""),
      });
    });
  });
}
