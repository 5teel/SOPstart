// Candidate B: pdfjs-dist directly with full operator-list walk + CTM tracking for bbox.
// Uses the same underlying lib unpdf wraps, but reconstructs bbox provenance from the
// current transformation matrix accumulated across `transform` ops between save/restore.
import { readFile } from "node:fs/promises";
import { getResolvedPDFJS } from "unpdf";

export const name = "pdfjs-direct-ctm";

// 6-element CTM multiply: result = a · b where each is [a, b, c, d, e, f]
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

// Image objects in PDF default to a unit square [0,0]→[1,1] (drawImage scales it).
// After applying CTM m, the four corners map to (m[4], m[5]), (m[0]+m[4], m[1]+m[5]),
// (m[2]+m[4], m[3]+m[5]), (m[0]+m[2]+m[4], m[1]+m[3]+m[5]). Take bbox = min/max.
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

export async function extract(pdfPath) {
  const pdfjs = await getResolvedPDFJS();
  const data = new Uint8Array(await readFile(pdfPath));
  const pdf = await pdfjs.getDocument({ data, disableFontFace: true }).promise;
  const numPages = pdf.numPages;

  const OPS = pdfjs.OPS;
  const PAINT_IMAGE = OPS.paintImageXObject;
  const PAINT_INLINE = OPS.paintInlineImageXObject;
  const PAINT_MASK = OPS.paintImageMaskXObject;
  const TRANSFORM = OPS.transform;
  const SAVE = OPS.save;
  const RESTORE = OPS.restore;

  const images = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1 });
    const pageWidth = viewport.width;
    const pageHeight = viewport.height;
    const ops = await page.getOperatorList();

    // Track CTM stack
    let ctm = [1, 0, 0, 1, 0, 0];
    const ctmStack = [];

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
        const bbox = ctmBbox(ctm);
        const objName = fn === PAINT_INLINE ? "(inline)" : args[0];
        let imgInfo = null;
        try {
          if (fn !== PAINT_INLINE && objName) {
            imgInfo = page.commonObjs.has(objName)
              ? page.commonObjs.get(objName)
              : page.objs.has(objName)
                ? page.objs.get(objName)
                : null;
          }
        } catch {
          imgInfo = null;
        }
        images.push({
          page: pageNum,
          objName,
          opCode: fn,
          width: imgInfo?.width ?? null,
          height: imgInfo?.height ?? null,
          bytesAvailable: !!imgInfo?.data,
          dataLen: imgInfo?.data?.byteLength ?? null,
          bbox,
          pageWidth,
          pageHeight,
        });
      }
    }
    page.cleanup();
  }

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
