import XLSX from 'xlsx'
import { slugify } from '../../shared/utils'

// Fixed column name aliases → internal field
const FIXED_COLUMNS: Record<string, string> = {
  nome: 'name',
  name: 'name',
  endereco: 'address',
  endereço: 'address',
  address: 'address',
  tipo: 'pinType',
  pin_type: 'pinType',
  tipo_do_pin: 'pinType',
  visibilidade: 'visibility',
  visibility: 'visibility',
}

export type ParsedRow = {
  name: string
  address: string
  pinType?: string
  visibility?: string
  externalKey: string
  dynamicValues: Record<string, string>
}

export type ParseResult = {
  rows: ParsedRow[]
  errors: Array<{ line: number; message: string }>
}

export function parseSpreadsheet(buffer: Buffer, filename: string): ParseResult {
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]

  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })

  const rows: ParsedRow[] = []
  const errors: Array<{ line: number; message: string }> = []

  for (let i = 0; i < rawRows.length; i++) {
    const raw = rawRows[i]
    const lineNum = i + 2 // header is line 1

    const fixed: Record<string, string> = {}
    const dynamic: Record<string, string> = {}

    for (const [originalKey, rawValue] of Object.entries(raw)) {
      const normalizedKey = slugify(originalKey)
      const value = String(rawValue ?? '').trim()
      const fixedField =
        FIXED_COLUMNS[normalizedKey] ?? FIXED_COLUMNS[originalKey.toLowerCase().trim()]

      if (fixedField) {
        fixed[fixedField] = value
      } else if (normalizedKey) {
        dynamic[originalKey.trim()] = value
      }
    }

    if (!fixed.name) {
      errors.push({ line: lineNum, message: 'Campo "nome" obrigatório ausente' })
      continue
    }
    if (!fixed.address) {
      errors.push({ line: lineNum, message: `Linha ${lineNum}: campo "endereço" ausente` })
      continue
    }

    rows.push({
      name: fixed.name,
      address: fixed.address,
      pinType: fixed.pinType || undefined,
      visibility: fixed.visibility || undefined,
      externalKey: slugify(fixed.name),
      dynamicValues: dynamic,
    })
  }

  return { rows, errors }
}
