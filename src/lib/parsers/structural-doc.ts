import { z } from 'zod'

/**
 * Structural intermediate for parsed source documents.
 *
 * Phase 20 CONV-02 (Conversion Pipeline V2) commits to a unified provenance
 * model across DOCX / PDF / scan / video. This module is the DOCX-first
 * implementation of that contract — same `StructuredBlock` shape will be
 * produced by future PDF/scan/video extractors so the GPT parser only needs
 * to learn ONE input format.
 *
 * The point of this intermediate is to preserve the alignment signal that
 * gets destroyed when DOCX is linearized to flat text + image tokens. In
 * particular: a procedural table's `[step text | step images | comments]`
 * row structure is the actual semantic anchor between a step and its
 * images. Row-major containment is captured directly here so the LLM never
 * has to guess from token proximity.
 */

// Each extracted image gets a stable numeric index assigned in document
// order during DOCX walk. Image-bearing blocks reference these indexes.
export const ImageRefSchema = z.object({
  index: z.number().int().nonnegative(),
  // Optional alt text from the DOCX <wp:docPr descr="…"> attribute.
  altText: z.string().nullable(),
})
export type ImageRef = z.infer<typeof ImageRefSchema>

const BaseFields = {
  // Unique paragraph identifier from the DOCX source (paraId or synthesised).
  // Reserved for Phase 20 CONV-02 `block_provenance.region.paragraph_id`.
  paragraphId: z.string(),
}

export const HeadingBlockSchema = z.object({
  kind: z.literal('heading'),
  text: z.string(),
  level: z.number().int().min(1).max(6),
  ...BaseFields,
})

export const ParagraphBlockSchema = z.object({
  kind: z.literal('paragraph'),
  text: z.string(),
  images: z.array(z.number().int().nonnegative()),
  ...BaseFields,
})

export const ListItemBlockSchema = z.object({
  kind: z.literal('listItem'),
  text: z.string(),
  depth: z.number().int().min(0).max(8),
  numbering: z.enum(['bullet', 'decimal', 'unknown']),
  images: z.array(z.number().int().nonnegative()),
  ...BaseFields,
})

export const CaptionBlockSchema = z.object({
  kind: z.literal('caption'),
  text: z.string(),
  // Which extracted image this caption describes, if associable.
  forImage: z.number().int().nonnegative().nullable(),
  ...BaseFields,
})

export const TableCellSchema = z.object({
  colIndex: z.number().int().nonnegative(),
  // Cells can contain rich content — collapse to a single text + image set
  // for the prompt layer. Phase 20 may switch this to nested blocks if a
  // cell holds non-trivial structure (lists within cells, etc.).
  text: z.string(),
  images: z.array(z.number().int().nonnegative()),
})

export const TableRowSchema = z.object({
  rowIndex: z.number().int().nonnegative(),
  isHeader: z.boolean(),
  cells: z.array(TableCellSchema),
})

export const TableBlockSchema = z.object({
  kind: z.literal('table'),
  tableIndex: z.number().int().nonnegative(),
  rows: z.array(TableRowSchema),
  // True when the first row matches the canonical SOP-table header
  // ("Step Instruction | Images | …") — the alignment signal we care about
  // most. The prompt layer uses this to tell GPT "the step text and its
  // image cell are in the SAME row".
  isProcedural: z.boolean(),
  // Optional column-role hints derived from header cells when isProcedural
  // is true. Columns are 0-indexed.
  roleHint: z
    .object({
      stepCol: z.number().int().nonnegative().nullable(),
      imagesCol: z.number().int().nonnegative().nullable(),
      commentsCol: z.number().int().nonnegative().nullable(),
    })
    .nullable(),
  ...BaseFields,
})

export const StructuredBlockSchema = z.discriminatedUnion('kind', [
  HeadingBlockSchema,
  ParagraphBlockSchema,
  ListItemBlockSchema,
  CaptionBlockSchema,
  TableBlockSchema,
])

export type HeadingBlock = z.infer<typeof HeadingBlockSchema>
export type ParagraphBlock = z.infer<typeof ParagraphBlockSchema>
export type ListItemBlock = z.infer<typeof ListItemBlockSchema>
export type CaptionBlock = z.infer<typeof CaptionBlockSchema>
export type TableCell = z.infer<typeof TableCellSchema>
export type TableRow = z.infer<typeof TableRowSchema>
export type TableBlock = z.infer<typeof TableBlockSchema>
export type StructuredBlock = z.infer<typeof StructuredBlockSchema>

export const StructuredDocSchema = z.object({
  blocks: z.array(StructuredBlockSchema),
  // Image metadata in document order. blocks[].images reference these by index.
  imageRefs: z.array(ImageRefSchema),
  // Non-fatal warnings from extraction (unrecognised elements, missing rels).
  warnings: z.array(z.string()),
  // Counts surfaced for logging / observability.
  stats: z.object({
    blockCount: z.number().int(),
    tableCount: z.number().int(),
    proceduralTableCount: z.number().int(),
    imageCount: z.number().int(),
    imagesInTables: z.number().int(),
    imagesOutsideTables: z.number().int(),
  }),
})
export type StructuredDoc = z.infer<typeof StructuredDocSchema>
