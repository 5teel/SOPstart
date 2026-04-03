'use client'

interface SopTableProps {
  markdown: string // Raw GitHub-flavored markdown table string
}

interface ParsedTable {
  headers: string[]
  rows: string[][]
  alignments: ('left' | 'center' | 'right')[]
}

/**
 * Parse a GitHub-flavored markdown table string into structured data.
 * Returns null if the markdown is malformed (fall through to plain text).
 */
function parseMarkdownTable(markdown: string): ParsedTable | null {
  const lines = markdown
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('|') && l.endsWith('|'))

  if (lines.length < 2) return null // Need at least header + separator

  // Parse header row
  const headers = lines[0]
    .slice(1, -1) // remove leading/trailing |
    .split('|')
    .map((h) => h.trim())

  // Validate separator row (must match /^:?-+:?$/ per cell)
  const sepLine = lines[1].slice(1, -1)
  const sepCells = sepLine.split('|').map((s) => s.trim())
  if (!sepCells.every((c) => /^:?-+:?$/.test(c))) return null

  // Parse alignments from separator
  const alignments = sepCells.map((c) => {
    if (c.startsWith(':') && c.endsWith(':')) return 'center' as const
    if (c.endsWith(':')) return 'right' as const
    return 'left' as const
  })

  // Parse data rows
  const rows = lines.slice(2).map((line) =>
    line
      .slice(1, -1)
      .split('|')
      .map((cell) => cell.trim())
  )

  return { headers, rows, alignments }
}

export function SopTable({ markdown }: SopTableProps) {
  const table = parseMarkdownTable(markdown)

  // Malformed table: fall through to plain text (per UI-SPEC)
  if (!table) {
    return (
      <p className="text-base text-steel-100 leading-relaxed whitespace-pre-wrap">
        {markdown}
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-steel-700 my-3">
      <table className="w-full text-sm border-collapse" role="table">
        <thead className="bg-steel-700 sticky top-0 z-10">
          <tr>
            {table.headers.map((header, i) => (
              <th
                key={i}
                className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-steel-400"
                style={{ textAlign: table.alignments[i] ?? 'left' }}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, rowIdx) => (
            <tr
              key={rowIdx}
              className={rowIdx % 2 === 0 ? 'bg-steel-800' : 'bg-steel-900'}
            >
              {row.map((cell, cellIdx) => (
                <td
                  key={cellIdx}
                  className="px-3 py-2 text-base text-steel-100 leading-snug min-h-[44px]"
                  style={{ textAlign: table.alignments[cellIdx] ?? 'left' }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Detect whether a content string contains a markdown table.
 * Used by SectionContent and SectionEditor to decide rendering mode.
 */
export function containsMarkdownTable(content: string | null): boolean {
  if (!content) return false
  const hasTableRow = /^\|.+\|$/m.test(content)
  const hasSeparator = /^\|[-| :]+\|$/m.test(content)
  return hasTableRow && hasSeparator
}
