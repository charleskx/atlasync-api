import { and, eq, ilike, isNull } from 'drizzle-orm'
import { db } from '../../config/database'
import { pinTypes } from '../../db/schema'
import type { CreatePinTypeInput, UpdatePinTypeInput } from './pin-type.schema'

export const pinTypeRepository = {
  async findAll(tenantId: string) {
    return db.query.pinTypes.findMany({
      where: and(eq(pinTypes.tenantId, tenantId), isNull(pinTypes.deletedAt)),
      orderBy: (pt, { asc }) => [asc(pt.name)],
    })
  },

  async findById(id: string, tenantId: string) {
    return db.query.pinTypes.findFirst({
      where: and(eq(pinTypes.id, id), eq(pinTypes.tenantId, tenantId), isNull(pinTypes.deletedAt)),
    })
  },

  async findByName(name: string, tenantId: string) {
    return db.query.pinTypes.findFirst({
      where: and(
        eq(pinTypes.tenantId, tenantId),
        ilike(pinTypes.name, name),
        isNull(pinTypes.deletedAt),
      ),
    })
  },

  async create(tenantId: string, data: CreatePinTypeInput) {
    const [pinType] = await db
      .insert(pinTypes)
      .values({ tenantId, name: data.name, color: data.color, updatedAt: new Date() })
      .returning()
    return pinType
  },

  async update(id: string, tenantId: string, data: UpdatePinTypeInput) {
    const updates: Partial<typeof pinTypes.$inferInsert> = { updatedAt: new Date() }
    if (data.name !== undefined) updates.name = data.name
    if (data.color !== undefined) updates.color = data.color

    const [updated] = await db
      .update(pinTypes)
      .set(updates)
      .where(and(eq(pinTypes.id, id), eq(pinTypes.tenantId, tenantId)))
      .returning()
    return updated
  },

  async softDelete(id: string, tenantId: string) {
    await db
      .update(pinTypes)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(pinTypes.id, id), eq(pinTypes.tenantId, tenantId)))
  },

  async existsByName(name: string, tenantId: string, excludeId?: string) {
    const row = await db.query.pinTypes.findFirst({
      where: and(
        eq(pinTypes.tenantId, tenantId),
        ilike(pinTypes.name, name),
        isNull(pinTypes.deletedAt),
      ),
    })
    if (!row) return false
    if (excludeId && row.id === excludeId) return false
    return true
  },
}
