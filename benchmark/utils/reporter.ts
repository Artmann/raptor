export interface TableColumn {
  header: string
  align: 'left' | 'right'
  width?: number
}

export interface TableRow {
  [key: string]: string | number
}

/**
 * Format a value for table display
 */
function formatValue(
  value: string | number,
  align: 'left' | 'right',
  width: number
): string {
  const str = String(value)
  const padding = Math.max(0, width - str.length)

  if (align === 'right') {
    return ' '.repeat(padding) + str
  }

  return str + ' '.repeat(padding)
}

/**
 * Print a table to console
 */
export function printTable(columns: TableColumn[], rows: TableRow[]): void {
  const widths = columns.map((col, i) => {
    const headerWidth = col.header.length
    const maxValueWidth = Math.max(
      ...rows.map((row) => String(Object.values(row)[i]).length)
    )
    return col.width ?? Math.max(headerWidth, maxValueWidth)
  })

  const header = columns
    .map((col, i) => formatValue(col.header, col.align, widths[i]))
    .join('  ')

  console.log(header)

  const separator = widths.map((w) => '-'.repeat(w)).join('  ')

  console.log(separator)

  for (const row of rows) {
    const rowStr = Object.values(row)
      .map((value, i) => formatValue(value, columns[i].align, widths[i]))
      .join('  ')

    console.log(rowStr)
  }

  console.log()
}

/**
 * Print a section header
 */
export function printSection(title: string): void {
  console.log()
  console.log(`=== ${title} ===`)
  console.log()
}

/**
 * Format duration in seconds
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms.toFixed(0)}ms`
  }

  return `${(ms / 1000).toFixed(2)}s`
}

/**
 * Format throughput (items per second)
 */
export function formatThroughput(count: number, durationMs: number): string {
  const perSecond = (count / durationMs) * 1000
  if (perSecond >= 1) {
    return `${perSecond.toFixed(1)}/s`
  }

  return `${(1000 / (durationMs / count)).toFixed(1)}/s`
}

/**
 * Format percentage
 */
export function formatPercentage(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

/**
 * Print benchmark summary
 */
export function printSummary(
  title: string,
  metrics: Record<string, string | number>
): void {
  console.log(`${title}:`)

  const maxKeyLength = Math.max(...Object.keys(metrics).map((k) => k.length))

  for (const [key, value] of Object.entries(metrics)) {
    const padding = ' '.repeat(maxKeyLength - key.length)
    console.log(`  ${key}:${padding} ${value}`)
  }

  console.log()
}

/**
 * Export results to console with formatting
 */
export function exportResults(results: unknown): void {
  console.log()
  console.log('=== Complete Results ===')
  console.log(JSON.stringify(results, null, 2))
}

/**
 * Print a markdown-style table with pipe delimiters
 */
export function printMarkdownTable(
  columns: TableColumn[],
  rows: TableRow[]
): void {
  // Calculate column widths
  const widths = columns.map((col, i) => {
    const headerWidth = col.header.length
    const maxValueWidth = Math.max(
      ...rows.map((row) => String(Object.values(row)[i]).length)
    )

    return col.width ?? Math.max(headerWidth, maxValueWidth)
  })

  // Print header
  const header =
    '| ' +
    columns
      .map((col, i) => formatValue(col.header, 'left', widths[i]))
      .join(' | ') +
    ' |'

  console.log(header)

  // Print separator with alignment indicators
  const separator =
    '|' +
    widths
      .map((w, i) => {
        const dashes = '-'.repeat(w + 2)
        if (columns[i].align === 'right') {
          return dashes.slice(0, -1) + ':'
        }
        return dashes
      })
      .join('|') +
    '|'
  console.log(separator)

  for (const row of rows) {
    const rowStr =
      '| ' +
      Object.values(row)
        .map((value, i) => formatValue(value, columns[i].align, widths[i]))
        .join(' | ') +
      ' |'
    console.log(rowStr)
  }

  console.log()
}

/**
 * Print a modern section header with horizontal line
 */
export function printModernSection(title: string): void {
  const lineLength = 60
  console.log()
  console.log('─'.repeat(lineLength))
  console.log(title)
  console.log('─'.repeat(lineLength))
  console.log()
}

/**
 * Print a progress bar with percentage and count
 */
export function printProgressBar(
  current: number,
  total: number,
  width = 40
): string {
  const percentage = Math.round((current / total) * 100)
  const filled = Math.round((current / total) * width)
  const empty = width - filled

  const bar = '[' + '█'.repeat(filled) + '░'.repeat(empty) + ']'
  const counter = `(${current}/${total} completed)`

  return `${bar} ${percentage}% ${counter}`
}
