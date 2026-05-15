// Build a structured source representation of one corpus PDF:
//   { pages: [{ pageNum, text }], images: [{ page, idx, bbox, savedPath }] }
// Reads spike-001 _report.json for image positions; uses unpdf to extract per-page text.
import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { getDocumentProxy } from "unpdf";

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = "C:\\Development\\SOPstart";
const SPIKE_001 = join(PROJECT_ROOT, ".planning", "spikes", "001-pdf-image-extraction-bundle-safe", "experiment");
const OUT = join(HERE, "fixture");
await mkdir(OUT, { recursive: true });
await mkdir(join(OUT, "source-images"), { recursive: true });

const PDF = process.argv[2] ?? "medium-forming-swabbing.pdf";
const stem = basename(PDF, ".pdf");
const pdfPath = join(SPIKE_001, "corpus", PDF);
const reportPath = join(SPIKE_001, "output", stem, "_report.json");

if (!existsSync(pdfPath)) throw new Error(`missing PDF: ${pdfPath}`);
if (!existsSync(reportPath)) throw new Error(`missing report: ${reportPath}`);

const buf = await readFile(pdfPath);
const data = new Uint8Array(buf);
const pdf = await getDocumentProxy(data);
const numPages = pdf.numPages;

// per-page text via pdfjs getTextContent
const pages = [];
for (let p = 1; p <= numPages; p++) {
  const page = await pdf.getPage(p);
  const tc = await page.getTextContent();
  const text = tc.items
    .map((it) => ("str" in it ? it.str : ""))
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  pages.push({ pageNum: p, text });
  page.cleanup?.();
}

const report = JSON.parse(await readFile(reportPath, "utf8"));
const imagesByPage = new Map();
for (const img of report.images ?? []) {
  if (!img.bbox || !img.savedPath) continue;
  if (!imagesByPage.has(img.page)) imagesByPage.set(img.page, []);
  imagesByPage.get(img.page).push(img);
}

// flatten with stable page-local index
const images = [];
for (const [page, list] of imagesByPage) {
  for (let i = 0; i < list.length; i++) {
    const img = list[i];
    const srcPath = join(SPIKE_001, "output", stem, img.savedPath);
    const dstName = `p${page}-${i + 1}.png`;
    const dstPath = join(OUT, "source-images", dstName);
    if (existsSync(srcPath) && !existsSync(dstPath)) {
      await copyFile(srcPath, dstPath);
    }
    images.push({
      id: `${page}-${i + 1}`,
      page,
      idxOnPage: i + 1,
      bbox: img.bbox,
      width: img.width,
      height: img.height,
      savedPath: `source-images/${dstName}`,
    });
  }
}

const source = {
  pdf: PDF,
  numPages,
  pages,
  images,
  generated: new Date().toISOString(),
};
await writeFile(join(OUT, "source.json"), JSON.stringify(source, null, 2));

const totalText = pages.map((p) => p.text).join("\n\n");
console.log(`PDF: ${PDF}`);
console.log(`Pages: ${numPages}, Images: ${images.length}, Total text chars: ${totalText.length}`);
console.log(`Wrote fixture/source.json`);
console.log(`---first 500 chars of text---`);
console.log(totalText.slice(0, 500));
