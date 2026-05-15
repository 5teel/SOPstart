// Tiny static server for the spike — serves harness.html + pdfjs vendor files + Spike 001 corpus + reports.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import { join, extname, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(HERE, "..", "..", "..", "..");
const SPIKE_001 = resolve(PROJECT_ROOT, ".planning", "spikes", "001-pdf-image-extraction-bundle-safe", "experiment");
const PDFJS_BUILD = resolve(PROJECT_ROOT, "node_modules", "pdfjs-dist", "build");

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".pdf": "application/pdf",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".map": "application/json",
};

function safeJoin(base, rel) {
  const target = resolve(base, "." + rel);
  if (!target.startsWith(base)) return null;
  return target;
}

const routes = [
  // /vendor/<file> → node_modules/pdfjs-dist/build/<file>
  { prefix: "/vendor/", base: PDFJS_BUILD },
  // /corpus/<file>  → spike-001 corpus
  { prefix: "/corpus/", base: join(SPIKE_001, "corpus") },
  // /reports/<file> → spike-001 output/*/_report.json (we'll allow nested)
  { prefix: "/reports/", base: join(SPIKE_001, "output") },
  // /screenshots/  → write target for playwright (read also fine)
  { prefix: "/screenshots/", base: join(HERE, "screenshots") },
];

const server = createServer(async (req, res) => {
  try {
    let url = req.url.split("?")[0];
    if (url === "/" || url === "/index.html") url = "/harness.html";

    let filePath;
    if (url === "/harness.html" || url === "/harness.js") {
      filePath = join(HERE, url.slice(1));
    } else {
      const route = routes.find((r) => url.startsWith(r.prefix));
      if (route) {
        filePath = safeJoin(route.base, "/" + url.slice(route.prefix.length));
      }
    }

    if (!filePath || !existsSync(filePath)) {
      res.writeHead(404);
      res.end(`not found: ${url}`);
      return;
    }
    const stats = statSync(filePath);
    if (stats.isDirectory()) {
      res.writeHead(404);
      res.end(`is dir: ${url}`);
      return;
    }
    const ext = extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": TYPES[ext] ?? "application/octet-stream", "Cache-Control": "no-cache" });
    res.end(await readFile(filePath));
  } catch (e) {
    res.writeHead(500);
    res.end(`server error: ${e?.message ?? e}`);
  }
});

const PORT = Number(process.env.PORT ?? 4321);
server.listen(PORT, () => {
  console.log(`Spike 002 server listening on http://127.0.0.1:${PORT}`);
});
