// Quick survey of DOCX internal structure across the corpus.
// Counts tables, paragraphs, lists, images, captions, headings.
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import JSZip from 'jszip'
import { DOMParser } from '@xmldom/xmldom'

const RAW = 'C:\\Development\\SOPstart\\SOPstart - Raw SOPs'

const files = (await readdir(RAW)).filter((f) => f.endsWith('.docx'))
console.log(`Surveying ${files.length} DOCX files…\n`)

for (const f of files) {
  const buf = await readFile(join(RAW, f))
  const zip = await JSZip.loadAsync(buf)
  const docXml = await zip.file('word/document.xml').async('string')
  const relsXml = await zip.file('word/_rels/document.xml.rels').async('string')
  const dom = new DOMParser({ errorHandler: { warning: () => {}, error: () => {}, fatalError: () => {} } }).parseFromString(docXml, 'text/xml')

  const NS_W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
  const NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main'

  const tables = dom.getElementsByTagNameNS(NS_W, 'tbl').length
  const paragraphs = dom.getElementsByTagNameNS(NS_W, 'p').length
  const blips = dom.getElementsByTagNameNS(NS_A, 'blip').length
  const styles = Array.from({ length: dom.getElementsByTagNameNS(NS_W, 'pStyle').length }).map((_, i) => {
    const el = dom.getElementsByTagNameNS(NS_W, 'pStyle').item(i)
    return el?.getAttribute('w:val') || ''
  })
  const captionStyles = styles.filter((s) => /caption/i.test(s)).length
  const headingStyles = styles.filter((s) => /^heading/i.test(s)).length
  const numPr = dom.getElementsByTagNameNS(NS_W, 'numPr').length

  // Image rels — count image relationships
  const relsDom = new DOMParser({ errorHandler: { warning: () => {}, error: () => {}, fatalError: () => {} } }).parseFromString(relsXml, 'text/xml')
  const imageRels = Array.from({ length: relsDom.getElementsByTagName('Relationship').length })
    .map((_, i) => relsDom.getElementsByTagName('Relationship').item(i))
    .filter((r) => /image/i.test(r?.getAttribute('Type') || '')).length

  // Tables containing images: scan each <w:tbl> for nested <a:blip>
  let tablesWithImages = 0
  let imagesInTables = 0
  let imagesOutsideTables = 0
  const allTables = dom.getElementsByTagNameNS(NS_W, 'tbl')
  const imagesIn = new Set()
  for (let i = 0; i < allTables.length; i++) {
    const t = allTables.item(i)
    const blipsIn = t.getElementsByTagNameNS(NS_A, 'blip')
    if (blipsIn.length > 0) {
      tablesWithImages++
      for (let j = 0; j < blipsIn.length; j++) {
        const id = blipsIn.item(j).getAttribute('r:embed')
        if (id) imagesIn.add(id)
      }
    }
  }
  imagesInTables = imagesIn.size
  imagesOutsideTables = blips - imagesIn.size

  // Sample first table: row count, col count
  let firstTableShape = '—'
  if (allTables.length > 0) {
    const t = allTables.item(0)
    const rows = t.getElementsByTagNameNS(NS_W, 'tr')
    const firstRow = rows.item(0)
    const cols = firstRow?.getElementsByTagNameNS(NS_W, 'tc').length ?? 0
    firstTableShape = `${rows.length}r × ${cols}c`
  }

  const sizeKb = (buf.byteLength / 1024).toFixed(0)
  console.log(`${f}`)
  console.log(`  size: ${sizeKb} KB  | paragraphs: ${paragraphs}  | tables: ${tables} (first: ${firstTableShape})  | lists: ${numPr}  | headings: ${headingStyles}  | captions: ${captionStyles}`)
  console.log(`  images: ${blips} blips, ${imageRels} rels  | in tables: ${imagesInTables} (across ${tablesWithImages} tables)  | outside tables: ${imagesOutsideTables}`)
}
