import { and, eq, inArray, isNull, sql } from 'drizzle-orm'
import { db } from '../../config/database'
import { partnerColumns, partnerValues, partners } from '../../db/schema'
import { slugify } from '../../shared/utils'
import type { CreatePartnerInput, ListPartnersInput, UpdatePartnerInput } from './partner.schema'

export const partnerRepository = {
  async findAll(tenantId: string, filters: ListPartnersInput) {
    const { page, limit, visibility, pinType, geocodeStatus } = filters
    const offset = (page - 1) * limit

    const conditions = [eq(partners.tenantId, tenantId), isNull(partners.deletedAt)]
    if (visibility) conditions.push(eq(partners.visibility, visibility))
    if (pinType) conditions.push(eq(partners.pinType, pinType))
    if (geocodeStatus) conditions.push(eq(partners.geocodeStatus, geocodeStatus))

    const rows = await db.query.partners.findMany({
      where: and(...conditions),
      limit,
      offset,
      orderBy: (p, { asc }) => [asc(p.name)],
    })

    const withValues = await Promise.all(rows.map(p => attachDynamicValues(p)))
    return withValues
  },

  async findById(id: string, tenantId: string) {
    const partner = await db.query.partners.findFirst({
      where: and(eq(partners.id, id), eq(partners.tenantId, tenantId), isNull(partners.deletedAt)),
    })
    if (!partner) return null
    return attachDynamicValues(partner)
  },

  async findByExternalKey(externalKey: string, tenantId: string) {
    return db.query.partners.findFirst({
      where: and(
        eq(partners.externalKey, externalKey),
        eq(partners.tenantId, tenantId),
        isNull(partners.deletedAt),
      ),
    })
  },

  async findAllImportedKeys(tenantId: string): Promise<string[]> {
    const rows = await db
      .select({ externalKey: partners.externalKey })
      .from(partners)
      .where(
        and(
          eq(partners.tenantId, tenantId),
          eq(partners.source, 'import'),
          isNull(partners.deletedAt),
        ),
      )
    return rows.map(r => r.externalKey).filter(Boolean) as string[]
  },

  async create(
    tenantId: string,
    data: CreatePartnerInput & { source?: string; externalKey?: string },
  ) {
    const [partner] = await db
      .insert(partners)
      .values({
        tenantId,
        name: data.name,
        address: data.address,
        pinType: data.pinType,
        visibility: data.visibility,
        source: data.source ?? 'dashboard',
        externalKey: data.externalKey,
        updatedAt: new Date(),
      })
      .returning()

    if (data.dynamicValues && Object.keys(data.dynamicValues).length > 0) {
      await upsertDynamicValues(partner.id, tenantId, data.dynamicValues)
    }

    return partner
  },

  async update(id: string, tenantId: string, data: UpdatePartnerInput) {
    const updates: Partial<typeof partners.$inferInsert> = { updatedAt: new Date() }
    if (data.name !== undefined) updates.name = data.name
    if (data.address !== undefined) updates.address = data.address
    if (data.pinType !== undefined) updates.pinType = data.pinType
    if (data.visibility !== undefined) updates.visibility = data.visibility

    const [updated] = await db
      .update(partners)
      .set(updates)
      .where(and(eq(partners.id, id), eq(partners.tenantId, tenantId)))
      .returning()

    if (data.dynamicValues) {
      await upsertDynamicValues(id, tenantId, data.dynamicValues)
    }

    return updated
  },

  async updateGeocode(
    id: string,
    geo: { lat: number; lng: number } | null,
    status: 'done' | 'failed',
  ) {
    await db
      .update(partners)
      .set({
        lat: geo?.lat,
        lng: geo?.lng,
        geocodedAt: new Date(),
        geocodeStatus: status,
        updatedAt: new Date(),
      })
      .where(eq(partners.id, id))
  },

  async softDelete(id: string, tenantId: string) {
    await db
      .update(partners)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(partners.id, id), eq(partners.tenantId, tenantId)))
  },

  async softDeleteByExternalKeys(tenantId: string, excludeKeys: string[]) {
    if (excludeKeys.length === 0) {
      await db
        .update(partners)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(
          and(
            eq(partners.tenantId, tenantId),
            eq(partners.source, 'import'),
            isNull(partners.deletedAt),
          ),
        )
      return
    }
    // Delete imported partners whose external key is NOT in the current sheet
    await db.execute(
      sql`UPDATE partners SET deleted_at = NOW(), updated_at = NOW()
          WHERE tenant_id = ${tenantId}
            AND source = 'import'
            AND deleted_at IS NULL
            AND external_key NOT IN (${sql.join(
              excludeKeys.map(k => sql`${k}`),
              sql`, `,
            )})`,
    )
  },

  async getColumns(tenantId: string) {
    return db.query.partnerColumns.findMany({
      where: eq(partnerColumns.tenantId, tenantId),
      orderBy: (c, { asc }) => [asc(c.sortOrder), asc(c.label)],
    })
  },
}

type Partner = typeof partners.$inferSelect

async function attachDynamicValues(partner: Partner) {
  const rows = await db
    .select({
      key: partnerColumns.key,
      value: partnerValues.value,
    })
    .from(partnerValues)
    .innerJoin(partnerColumns, eq(partnerColumns.id, partnerValues.columnId))
    .where(eq(partnerValues.partnerId, partner.id))

  const dynamic: Record<string, string | null> = {}
  for (const row of rows) {
    dynamic[row.key] = row.value ?? null
  }

  return { ...partner, dynamicValues: dynamic }
}

async function upsertDynamicValues(
  partnerId: string,
  tenantId: string,
  values: Record<string, string>,
) {
  for (const [rawKey, value] of Object.entries(values)) {
    const key = slugify(rawKey)
    if (!key) continue

    let col = await db.query.partnerColumns.findFirst({
      where: and(eq(partnerColumns.tenantId, tenantId), eq(partnerColumns.key, key)),
    })

    if (!col) {
      const [inserted] = await db
        .insert(partnerColumns)
        .values({ tenantId, key, label: rawKey, updatedAt: new Date() })
        .onConflictDoNothing()
        .returning()
      col = inserted
    }

    if (!col) continue

    await db
      .insert(partnerValues)
      .values({ partnerId, columnId: col.id, value })
      .onConflictDoUpdate({
        target: [partnerValues.partnerId, partnerValues.columnId],
        set: { value },
      })
  }
}
