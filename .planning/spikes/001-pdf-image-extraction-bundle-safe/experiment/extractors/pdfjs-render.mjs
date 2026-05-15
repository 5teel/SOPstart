// Candidate D: pdfjs-direct + force-resolve image objects + save bytes to disk as PNG.
// Validates that we can not only locate images with bbox provenance but actually pull the bytes.
//
// Strategy: walk operator list, track CTM, on image-paint op AWAIT page.objs.get(name) which
// resolves the lazy image promise. Then encode the raw RGBA/grayscale buffer as PNG with sharp.

import { readFile, mkdir, writeFile } from "node:fs/promises";
import { join, basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { getResolvedPDFJS } from "unpdf";
import sharp from "sharp";

export const name = "pdfjs-render";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_BASE = join(HERE, "..", "output");

function mul(a, b) {
  return [
    a[0] * b[0] + a[1] * b[2],
    a[0] * b[1] + a[1] * b[3],
    a[2] * b[0] + a[3] * b[2],
    a[2] * b[1] + a[3] * b[3],
    a[4] * b[0] + a[5] * b[2] + b[4],
    a[4] * b[1] + a[5] * b[3] + b[5],
  ];
}

function ctmBbox(m) {
  const corners = [
    [m[4], m[5]],
    [m[0] + m[4], m[1] + m[5]],
    [m[2] + m[4], m[3] + m[5]],
    [m[0] + m[2] + m[4], m[1] + m[3] + m[5]],
  ];
  const xs = corners.map((c) => c[0]);
  const ys = corners.map((c) => c[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

// pdfjs ImageKind enum: GRAYSCALE_1BPP=1, RGB_24BPP=2, RGBA_32BPP=3
function imageKindLabel(k) {
  return k === 1 ? "GRAYSCALE_1BPP" : k === 2 ? "RGB_24BPP" : k === 3 ? "RGBA_32BPP" : `unknown(${k})`;
}

function awaitObj(objs, name) {
  return new Promise((resolve, reject) => {
    try {
      // pdfjs objs.get with callback resolves once the lazy object is available.
      objs.get(name, (img) => resolve(img));
    } catch (e) {
      reject(e);
    }
  });
}

export async function extract(pdfPath) {
  const pdfjs = await getResolvedPDFJS();
  const buf = await readFile(pdfPath);
  const data = new Uint8Array(buf);
  const pdf = await pdfjs.getDocument({ data, disableFontFace: true }).promise;
  const numPages = pdf.numPages;

  const OPS = pdfjs.OPS;
  const PAINT_IMAGE = OPS.paintImageXObject;
  const PAINT_INLINE = OPS.paintInlineImageXObject;
  const PAINT_MASK = OPS.paintImageMaskXObject;
  const TRANSFORM = OPS.transform;
  const SAVE = OPS.save;
  const RESTORE = OPS.restore;

  const sourceStem = basename(pdfPath, ".pdf");
  const outDir = join(OUT_BASE, sourceStem);
  await mkdir(outDir, { recursive: true });

  const images = [];
  let savedCount = 0;
  let saveErrors = 0;

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1 });
    const ops = await page.getOperatorList();

    let ctm = [1, 0, 0, 1, 0, 0];
    const ctmStack = [];
    let imageIdxOnPage = 0;

    for (let i = 0; i < ops.fnArray.length; i++) {
      const fn = ops.fnArray[i];
      const args = ops.argsArray[i];

      if (fn === SAVE) {
        ctmStack.push(ctm.slice());
      } else if (fn === RESTORE) {
        ctm = ctmStack.pop() ?? [1, 0, 0, 1, 0, 0];
      } else if (fn === TRANSFORM) {
        ctm = mul(args, ctm);
      } else if (fn === PAINT_IMAGE || fn === PAINT_INLINE || fn === PAINT_MASK) {
        imageIdxOnPage++;
        const bbox = ctmBbox(ctm);
        const objName = fn === PAINT_INLINE ? null : args[0];
        let img = null;
        let err = null;
        let savedPath = null;

        if (fn === PAINT_INLINE) {
          // inline image data is in args[0] (the image data dict)
          img = args[0];
        } else if (objName) {
          try {
            img = await Promise.race([
              awaitObj(page.objs, objName),
              new Promise((_, rej) => setTimeout(() => rej(new Error("img-resolve-timeout-5s")), 5000)),
            ]);
          } catch (e) {
            err = String(e?.message || e).slice(0, 120);
          }
        }

        if (img?.data && img.width && img.height) {
          try {
            const channels =
              img.kind === 3 ? 4 : img.kind === 2 ? 3 : img.kind === 1 ? 1 : null;
            if (channels) {
              const outFile = join(outDir, `p${pageNum}-${imageIdxOnPage}.png`);
              await sharp(Buffer.from(img.data), {
                raw: { width: img.width, height: img.height, channels },
              })
                .png()
                .toFile(outFile);
              savedPath = outFile;
              savedCount++;
            }
          } catch (e) {
            saveErrors++;
            err = (err ? err + " | " : "") + "save:" + String(e?.message || e).slice(0, 80);
          }
        }

        images.push({
          page: pageNum,
          objName,
          opCode: fn,
          width: img?.width ?? null,
          height: img?.height ?? null,
          kind: img?.kind != null ? imageKindLabel(img.kind) : null,
          dataLen: img?.data?.byteLength ?? null,
          bytesAvailable: !!img?.data,
          bbox,
          savedPath: savedPath ? basename(savedPath) : null,
          error: err,
        });
      }
    }
    page.cleanup();
  }

  // Write a per-PDF report sidecar
  await writeFile(
    join(outDir, "_report.json"),
    JSON.stringify({ pdf: basename(pdfPath), numPages, images }, null, 2)
  );

  return {
    extractor: name,
    numPages,
    imageCount: images.length,
    imagesWithBytes: images.filter((i) => i.bytesAvailable).length,
    imagesWithBbox: images.filter((i) => i.bbox).length,
    imagesSaved: savedCount,
    saveErrors,
    supportsImages: true,
    sampleImages: images.slice(0, 3),
  };
}
