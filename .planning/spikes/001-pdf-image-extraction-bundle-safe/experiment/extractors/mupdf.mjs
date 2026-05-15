// Candidate C: mupdf (wasm). No native binary, Railway-safe by construction.
// Installed locally into the spike's own node_modules — does not touch main project deps.
import { readFile } from "node:fs/promises";

export const name = "mupdf-wasm";

export async function extract(pdfPath) {
  const mupdfjs = await import("mupdf");
  const buf = await readFile(pdfPath);

  // Newer mupdf npm package exposes both default + PDFDocument as named exports
  const PDFDocument = mupdfjs.PDFDocument ?? mupdfjs.default?.PDFDocument;
  if (!PDFDocument) {
    throw new Error("mupdf shape unknown — could not find PDFDocument");
  }

  const doc = PDFDocument.openDocument(new Uint8Array(buf), "application/pdf");
  const numPages = doc.countPages();
  const images = [];

  for (let pageIdx = 0; pageIdx < numPages; pageIdx++) {
    const page = doc.loadPage(pageIdx);
    const pageRect = page.getBounds();
    const pageWidth = pageRect[2] - pageRect[0];
    const pageHeight = pageRect[3] - pageRect[1];

    // mupdf gives a structured-text view that includes image blocks with bbox
    const stext = page.toStructuredText("preserve-images");
    const json = JSON.parse(stext.asJSON());

    for (const block of json.blocks ?? []) {
      if (block.type === "image" && block.bbox) {
        images.push({
          page: pageIdx + 1,
          objName: null,
          opCode: "stext-image",
          width: block.image?.width ?? null,
          height: block.image?.height ?? null,
          bytesAvailable: false, // would need to walk page.getImages() to get bytes
          dataLen: null,
          bbox: [block.bbox.x, block.bbox.y, block.bbox.x + block.bbox.w, block.bbox.y + block.bbox.h],
          pageWidth,
          pageHeight,
        });
      }
    }
    stext.destroy?.();
    page.destroy?.();
  }
  doc.destroy?.();

  return {
    extractor: name,
    numPages,
    imageCount: images.length,
    imagesWithBytes: images.filter((i) => i.bytesAvailable).length,
    imagesWithBbox: images.filter((i) => i.bbox).length,
    supportsImages: true,
    sampleImages: images.slice(0, 3),
  };
}
