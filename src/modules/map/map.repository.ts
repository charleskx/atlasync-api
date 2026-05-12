import { and, eq, isNotNull, isNull } from 'drizzle-orm'
import { db } from '../../config/database'
import { maps, partners, pinTypes } from '../../db/schema'
import type { MapPinsQuery } from './map.schema'

export const mapRepository = {
  async findAll(tenantId: string) {
    return db.query.maps.findMany({
      where: and(eq(maps.tenantId, tenantId), isNull(maps.deletedAt)),
      orderBy: (m, { desc }) => [desc(m.createdAt)],
    })
  },

  async findById(id: string, tenantId: string) {
    return db.query.maps.findFirst({
      where: and(eq(maps.id, id), eq(maps.tenantId, tenantId), isNull(maps.deletedAt)),
    })
  },

  async findByEmbedToken(token: string) {
    return db.query.maps.findFirst({
      where: and(eq(maps.embedToken, token), isNull(maps.deletedAt), eq(maps.active, true)),
    })
  },

  async create(
    tenantId: string,
    data: { name: string; type: string; filters?: unknown; embedToken?: string },
  ) {
    const [map] = await db
      .insert(maps)
      .values({
        tenantId,
        name: data.name,
        type: data.type,
        filters: data.filters as never,
        embedToken: data.embedToken,
      })
      .returning()
    return map
  },

  async update(
    id: string,
    tenantId: string,
    data: { name?: string; filters?: unknown; active?: boolean; embedToken?: string },
  ) {
    const [updated] = await db
      .update(maps)
      .set({
        ...(data.name !== undefined && { name: data.name }),
        ...(data.filters !== undefined && { filters: data.filters as never }),
        ...(data.active !== undefined && { active: data.active }),
        ...(data.embedToken !== undefined && { embedToken: data.embedToken }),
      })
      .where(and(eq(maps.id, id), eq(maps.tenantId, tenantId)))
      .returning()
    return updated
  },

  async softDelete(id: string, tenantId: string) {
    await db
      .update(maps)
      .set({ deletedAt: new Date() })
      .where(and(eq(maps.id, id), eq(maps.tenantId, tenantId)))
  },

  async findPins(tenantId: string, filters: MapPinsQuery) {
    const conditions = [
      eq(partners.tenantId, tenantId),
      isNull(partners.deletedAt),
      isNotNull(partners.lat),
    ]

    if (filters.city) conditions.push(eq(partners.city, filters.city))
    if (filters.state) conditions.push(eq(partners.state, filters.state))
    if (filters.visibility) conditions.push(eq(partners.visibility, filters.visibility))
    if (filters.pinTypeId) conditions.push(eq(partners.pinTypeId, filters.pinTypeId))
    if (filters.geocodeStatus) conditions.push(eq(partners.geocodeStatus, filters.geocodeStatus))

    const rows = await db
      .select({
        id: partners.id,
        name: partners.name,
        address: partners.address,
        lat: partners.lat,
        lng: partners.lng,
        visibility: partners.visibility,
        city: partners.city,
        state: partners.state,
        pinType: {
          id: pinTypes.id,
          name: pinTypes.name,
          color: pinTypes.color,
        },
      })
      .from(partners)
      .leftJoin(pinTypes, eq(partners.pinTypeId, pinTypes.id))
      .where(and(...conditions))

    return rows.map(r => ({
      ...r,
      pinType: r.pinType?.id ? (r.pinType as { id: string; name: string; color: string }) : null,
    }))
  },

  async findPublicPins(tenantId: string, city?: string, state?: string, pinTypeId?: string) {
    const conditions = [
      eq(partners.tenantId, tenantId),
      isNull(partners.deletedAt),
      eq(partners.visibility, 'public'),
      isNotNull(partners.lat),
    ]

    if (city) conditions.push(eq(partners.city, city))
    if (state) conditions.push(eq(partners.state, state))
    if (pinTypeId) conditions.push(eq(partners.pinTypeId, pinTypeId))

    const rows = await db
      .select({
        id: partners.id,
        name: partners.name,
        address: partners.address,
        city: partners.city,
        state: partners.state,
        lat: partners.lat,
        lng: partners.lng,
        pinType: {
          id: pinTypes.id,
          name: pinTypes.name,
          color: pinTypes.color,
        },
      })
      .from(partners)
      .leftJoin(pinTypes, eq(partners.pinTypeId, pinTypes.id))
      .where(and(...conditions))

    return rows.map(r => ({
      ...r,
      pinType: r.pinType?.id ? (r.pinType as { id: string; name: string; color: string }) : null,
    }))
  },

  async findLocalities(tenantId: string, state?: string) {
    const conditions = [
      eq(partners.tenantId, tenantId),
      isNull(partners.deletedAt),
      eq(partners.visibility, 'public'),
      isNotNull(partners.lat),
    ]
    if (state) conditions.push(eq(partners.state, state))

    const rows = await db.query.partners.findMany({
      where: and(...conditions),
      columns: { city: true, state: true },
    })

    const cities = [...new Set(rows.map(r => r.city).filter(Boolean))] as string[]
    const states = [...new Set(rows.map(r => r.state).filter(Boolean))] as string[]

    return { cities: cities.sort(), states: states.sort() }
  },

  async findPublicPinTypes(tenantId: string) {
    const rows = await db
      .selectDistinct({ id: pinTypes.id, name: pinTypes.name, color: pinTypes.color })
      .from(partners)
      .innerJoin(pinTypes, eq(partners.pinTypeId, pinTypes.id))
      .where(and(
        eq(partners.tenantId, tenantId),
        isNull(partners.deletedAt),
        eq(partners.visibility, 'public'),
        isNotNull(partners.lat),
      ))
      .orderBy(pinTypes.name)
    return rows
  },
}
