// Candidate A: unpdf — already a project dependency.
// Uses unpdf's PUBLIC `extractImages(buffer, pageNumber)` API — the right entry point for this job.
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { join, basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { extractImages, getDocumentProxy } from "unpdf";
import sharp from "sharp";

export const name = "unpdf";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_BASE = join(HERE, "..", "output");

function imageKindLabel(k) {
  return k === 1 ? "GRAYSCALE_1BPP" : k === 2 ? "RGB_24BPP" : k === 3 ? "RGBA_32BPP" : `unknown(${k})`;
}

export async function extract(pdfPath) {
  const buf = await readFile(pdfPath);

  // Determine numPages via a single fresh Uint8Array (do not reuse for extractImages — see below)
  let numPages = 0;
  {
    const probeData = new Uint8Array(buf);
    const pdf = await getDocumentProxy(probeData);
    numPages = pdf.numPages;
  }

  const sourceStem = basename(pdfPath, ".pdf");
  const outDir = join(OUT_BASE, sourceStem + "__unpdf");
  await mkdir(outDir, { recursive: true });

  const images = [];
  let savedCount = 0;
  let saveErrors = 0;

  // CRITICAL: pdfjs (inside unpdf) holds internal worker state on the ArrayBuffer.
  // Reusing the same Uint8Array across calls causes DataCloneError on subsequent calls.
  // A fresh Uint8Array per page-call sidesteps that.
  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    let pageImages;
    try {
      const freshData = new Uint8Array(buf);
      pageImages = await extractImages(freshData, pageNum);
    } catch (e) {
      images.push({
        page: pageNum,
        objName: null,
        opCode: null,
        error: String(e?.message || e).slice(0, 120),
        bbox: null,
      });
      continue;
    }

    for (let idx = 0; idx < (pageImages?.length ?? 0); idx++) {
      const img = pageImages[idx];
      const channels = img.channels ?? (img.kind === 3 ? 4 : img.kind === 2 ? 3 : img.kind === 1 ? 1 : null);

      let savedPath = null;
      let err = null;
      if (img.data && img.width && img.height && channels) {
        try {
          const outFile = join(outDir, `p${pageNum}-${idx + 1}.png`);
          await sharp(Buffer.from(img.data), {
            raw: { width: img.width, height: img.height, channels },
          })
            .png()
            .toFile(outFile);
          savedPath = outFile;
          savedCount++;
        } catch (e) {
          saveErrors++;
          err = "save:" + String(e?.message || e).slice(0, 100);
        }
      }

      images.push({
        page: pageNum,
        objName: img.name ?? null,
        opCode: null,
        width: img.width ?? null,
        height: img.height ?? null,
        kind: img.kind != null ? imageKindLabel(img.kind) : null,
        channels,
        dataLen: img.data?.byteLength ?? null,
        bytesAvailable: !!img.data,
        // unpdf.extractImages does NOT return bbox — it only returns the decoded image stream
        bbox: null,
        savedPath: savedPath ? basename(savedPath) : null,
        error: err,
      });
    }
  }

  await writeFile(
    join(outDir, "_report.json"),
    JSON.stringify({ pdf: basename(pdfPath), numPages, images }, null, 2)
  );

  return {
    extractor: name,
    numPages,
    imageCount: images.filter((i) => !i.error || i.bytesAvailable).length,
    imagesWithBytes: images.filter((i) => i.bytesAvailable).length,
    imagesWithBbox: 0,
    imagesSaved: savedCount,
    saveErrors,
    supportsImages: true,
    note: "unpdf.extractImages returns decoded image streams but NO bbox provenance.",
    sampleImages: images.slice(0, 3),
  };
}
