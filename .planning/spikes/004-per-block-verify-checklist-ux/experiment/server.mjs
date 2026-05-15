// Tiny static server for spike 004 — serves checklist.html + the 50-block fixture + the Spike 003 source.json.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import { join, extname, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(HERE, "..", "..", "..", "..");
const SPIKE_003_FIX = join(PROJECT_ROOT, ".planning", "spikes", "003-ai-reviewer-omission-anchoring", "experiment", "fixture");

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
};

const server = createServer(async (req, res) => {
  try {
    let url = req.url.split("?")[0];
    if (url === "/" || url === "/index.html") url = "/checklist.html";

    let filePath;
    if (url === "/checklist.html" || url === "/checklist.js") filePath = join(HERE, url.slice(1));
    else if (url === "/source.json") filePath = join(SPIKE_003_FIX, "source.json");
    else if (url.startsWith("/fixture/")) filePath = join(HERE, "fixture", url.slice("/fixture/".length));

    if (!filePath || !existsSync(filePath) || statSync(filePath).isDirectory()) {
      res.writeHead(404);
      res.end(`not found: ${url}`);
      return;
    }
    res.writeHead(200, { "Content-Type": TYPES[extname(filePath).toLowerCase()] ?? "application/octet-stream", "Cache-Control": "no-cache" });
    res.end(await readFile(filePath));
  } catch (e) {
    res.writeHead(500);
    res.end(`error: ${e?.message ?? e}`);
  }
});

const PORT = Number(process.env.PORT ?? 4322);
server.listen(PORT, () => console.log(`Spike 004 server listening on http://127.0.0.1:${PORT}`));
