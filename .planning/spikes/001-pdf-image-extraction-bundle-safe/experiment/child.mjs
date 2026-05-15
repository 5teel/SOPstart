// Child process: dynamically import one extractor, run it on one PDF,
// sample own RSS to stderr, print RESULT=... JSON to stdout.
import { pathToFileURL } from "node:url";
const [, , extractorPath, pdfPath] = process.argv;

const rssInterval = setInterval(() => {
  const { rss } = process.memoryUsage();
  process.stderr.write(`RSS=${rss}\n`);
}, 100);

try {
  const mod = await import(pathToFileURL(extractorPath).href);
  const result = await mod.extract(pdfPath);
  clearInterval(rssInterval);
  // final RSS sample
  process.stderr.write(`RSS=${process.memoryUsage().rss}\n`);
  process.stdout.write("RESULT=" + JSON.stringify(result) + "\n");
  process.exit(0);
} catch (e) {
  clearInterval(rssInterval);
  process.stderr.write(`FATAL: ${e.stack || e.message || String(e)}\n`);
  process.exit(1);
}
