import { Readable } from 'node:stream'
import ExcelJS from 'exceljs'
import { slugify } from '../../shared/utils'

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

export async function parseSpreadsheet(buffer: Buffer, filename: string): Promise<ParseResult> {
  const ext = filename.split('.').pop()?.toLowerCase()
  const workbook = new ExcelJS.Workbook()

  if (ext === 'csv') {
    await workbook.csv.read(Readable.from(buffer))
  } else {
    // biome-ignore lint/suspicious/noExplicitAny: incompatibilidade de tipos Buffer entre @types/node@22 e exceljs
    await workbook.xlsx.load(buffer as any)
  }

  const worksheet = workbook.worksheets[0]
  if (!worksheet) return { rows: [], errors: [] }

  const headers: string[] = []
  const rawRows: Record<string, unknown>[] = []

  worksheet.eachRow((row, rowNum) => {
    if (rowNum === 1) {
      row.eachCell({ includeEmpty: true }, (cell, colNum) => {
        headers[colNum - 1] = String(cell.value ?? '').trim()
      })
    } else {
      const rowData: Record<string, unknown> = {}
      row.eachCell({ includeEmpty: true }, (cell, colNum) => {
        const header = headers[colNum - 1]
        if (header) rowData[header] = cell.value
      })
      if (Object.keys(rowData).length > 0) rawRows.push(rowData)
    }
  })

  const rows: ParsedRow[] = []
  const errors: Array<{ line: number; message: string }> = []

  for (let i = 0; i < rawRows.length; i++) {
    const raw = rawRows[i]
    const lineNum = i + 2

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
