import mammoth from 'mammoth'
import fs from 'node:fs'
import path from 'node:path'

const root = 'C:\\Development\\SOPstart\\SOPstart - Raw SOPs'

function find(dir, ext, hits = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) find(p, ext, hits)
    else if (p.toLowerCase().endsWith(ext)) hits.push(p)
  }
  return hits
}

const docxs = find(root, '.docx')
console.log('docx count:', docxs.length)

const samples = docxs.slice(0, 3)
for (const f of samples) {
  console.log('\n====', path.basename(f), '====')
  const result = await mammoth.extractRawText({ path: f })
  console.log(result.value.substring(0, 2000))
  console.log('--- (length=' + result.value.length + ' chars) ---')
}
