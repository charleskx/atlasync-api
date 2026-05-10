import { and, eq, isNull } from 'drizzle-orm'
import XLSX from 'xlsx'
import { db } from '../../config/database'
import { partnerColumns, partnerValues, partners } from '../../db/schema'
import { AppError } from '../../shared/errors'
import { defineAbilityFor } from '../../shared/permissions'
import type { ExportInput } from './export.schema'

// Colunas fixas disponíveis para exportação
const FIXED_COLUMNS: Record<string, string> = {
  name: 'Nome',
  address: 'Endereço',
  city: 'Cidade',
  state: 'Estado',
  visibility: 'Visibilidade',
  pinType: 'Tipo de Pin',
  geocodeStatus: 'Status Geocoding',
  source: 'Origem',
  createdAt: 'Criado em',
}

type Requester = { id: string; role: string; tenantId: string }

export const exportService = {
  async getAvailableColumns(requester: Requester) {
    const dynamicCols = await db.query.partnerColumns.findMany({
      where: eq(partnerColumns.tenantId, requester.tenantId),
      orderBy: (c, { asc }) => [asc(c.sortOrder), asc(c.label)],
    })

    const fixed = Object.entries(FIXED_COLUMNS).map(([key, label]) => ({
      key,
      label,
      type: 'fixed' as const,
    }))

    const dynamic = dynamicCols.map(c => ({
      key: c.key,
      label: c.label,
      type: 'dynamic' as const,
    }))

    return { columns: [...fixed, ...dynamic] }
  },

  async generate(input: ExportInput, requester: Requester) {
    const ability = defineAbilityFor({ role: requester.role })
    if (!ability.can('read', 'Partner')) throw new AppError('FORBIDDEN', 403, 'Sem permissão')

    // Buscar todos os parceiros ativos com valores dinâmicos
    const rows = await db
      .select({
        id: partners.id,
        name: partners.name,
        address: partners.address,
        city: partners.city,
        state: partners.state,
        visibility: partners.visibility,
        pinType: partners.pinType,
        geocodeStatus: partners.geocodeStatus,
        source: partners.source,
        createdAt: partners.createdAt,
      })
      .from(partners)
      .where(and(eq(partners.tenantId, requester.tenantId), isNull(partners.deletedAt)))

    // Buscar valores dinâmicos se houver colunas dinâmicas selecionadas
    const dynamicKeys = input.columns.filter(c => !FIXED_COLUMNS[c])

    const dynamicMap = new Map<string, Record<string, string>>()

    if (dynamicKeys.length > 0) {
      const values = await db
        .select({
          partnerId: partnerValues.partnerId,
          key: partnerColumns.key,
          value: partnerValues.value,
        })
        .from(partnerValues)
        .innerJoin(partnerColumns, eq(partnerColumns.id, partnerValues.columnId))
        .where(and(eq(partnerColumns.tenantId, requester.tenantId)))

      for (const v of values) {
        if (!dynamicMap.has(v.partnerId)) dynamicMap.set(v.partnerId, {})
        const entry = dynamicMap.get(v.partnerId)
        if (entry) entry[v.key] = v.value ?? ''
      }
    }

    // Montar linhas da planilha com as colunas selecionadas
    const sheetRows = rows.map(partner => {
      const row: Record<string, string> = {}
      const dyn = dynamicMap.get(partner.id) ?? {}

      for (const col of input.columns) {
        if (col in FIXED_COLUMNS) {
          const val = (partner as Record<string, unknown>)[col]
          row[FIXED_COLUMNS[col]] =
            val instanceof Date ? val.toISOString().split('T')[0] : String(val ?? '')
        } else {
          const dynCol = dynamicKeys.find(k => k === col)
          row[col] = dynCol ? (dyn[col] ?? '') : ''
        }
      }

      return row
    })

    const headers = input.columns.map(c => FIXED_COLUMNS[c] ?? c)

    if (input.format === 'csv') {
      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(sheetRows, { header: headers })
      XLSX.utils.book_append_sheet(wb, ws, 'Parceiros')
      return {
        buffer: XLSX.write(wb, { type: 'buffer', bookType: 'csv' }) as Buffer,
        contentType: 'text/csv',
        extension: 'csv',
      }
    }

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(sheetRows, { header: headers })
    XLSX.utils.book_append_sheet(wb, ws, 'Parceiros')
    return {
      buffer: XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      extension: 'xlsx',
    }
  },
}
