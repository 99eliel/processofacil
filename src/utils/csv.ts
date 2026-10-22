export type CsvRow = Record<string, string>

function detectDelimiter(line: string) {
  const candidates = [',', ';', '\t']
  let best = ','
  let bestCount = -1

  for (const delimiter of candidates) {
    let count = 0
    let quoted = false
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index]
      if (char === '"') quoted = !quoted
      if (!quoted && char === delimiter) count += 1
    }
    if (count > bestCount) {
      bestCount = count
      best = delimiter
    }
  }

  return best
}

function parseLine(line: string, delimiter: string) {
  const values: string[] = []
  let current = ''
  let quoted = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]

    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"'
        index += 1
      } else {
        quoted = !quoted
      }
      continue
    }

    if (char === delimiter && !quoted) {
      values.push(current.trim())
      current = ''
      continue
    }

    current += char
  }

  values.push(current.trim())
  return values
}

export function normalizeHeader(value: string) {
  return value
    .replace(/^\uFEFF/, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

export function parseCsv(text: string): CsvRow[] {
  const source = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
  if (!source) return []

  const lines: string[] = []
  let current = ''
  let quoted = false

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]
    if (char === '"') {
      quoted = !quoted
      current += char
      continue
    }
    if (char === '\n' && !quoted) {
      lines.push(current)
      current = ''
      continue
    }
    current += char
  }
  if (current) lines.push(current)

  if (lines.length < 2) return []

  const delimiter = detectDelimiter(lines[0])
  const headers = parseLine(lines[0], delimiter).map(normalizeHeader)

  return lines.slice(1)
    .filter((line) => line.trim())
    .map((line) => {
      const values = parseLine(line, delimiter)
      return Object.fromEntries(
        headers.map((header, index) => [header, values[index]?.trim() ?? '']),
      )
    })
}

export function valueFromAliases(row: CsvRow, aliases: string[]) {
  for (const alias of aliases) {
    const value = row[normalizeHeader(alias)]
    if (value != null && value !== '') return value
  }
  return ''
}

export function parseNumberPtBr(value: string) {
  const cleaned = value.trim().replace(/\s/g, '')
  if (!cleaned) return null

  const normalized = cleaned.includes(',') && cleaned.includes('.')
    ? cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')
      ? cleaned.replace(/\./g, '').replace(',', '.')
      : cleaned.replace(/,/g, '')
    : cleaned.replace(',', '.')

  const number = Number(normalized)
  return Number.isFinite(number) ? number : null
}
