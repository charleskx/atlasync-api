import { and, eq, gte, isNull, lt, sql } from 'drizzle-orm'
import { db } from '../../config/database'
import { importJobs, partners, pinTypes, users } from '../../db/schema'

function monthBounds(offsetMonths = 0) {
  const now = new Date()
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offsetMonths, 1))
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offsetMonths + 1, 1))
  return { start, end }
}

export const dashboardRepository = {
  async getPartnerStats(tenantId: string) {
    const thisMonth = monthBounds(0)
    const lastMonth = monthBounds(-1)

    const [totals] = await db
      .select({
        total: sql<number>`count(*)::int`,
        geocodedDone: sql<number>`count(*) filter (where ${partners.geocodeStatus} = 'done')::int`,
        geocodedFailed: sql<number>`count(*) filter (where ${partners.geocodeStatus} = 'failed')::int`,
        publicCount: sql<number>`count(*) filter (where ${partners.visibility} = 'public')::int`,
        internalCount: sql<number>`count(*) filter (where ${partners.visibility} = 'internal')::int`,
        thisMonthCount: sql<number>`count(*) filter (where ${partners.createdAt} >= ${thisMonth.start} and ${partners.createdAt} < ${thisMonth.end})::int`,
        lastMonthCount: sql<number>`count(*) filter (where ${partners.createdAt} >= ${lastMonth.start} and ${partners.createdAt} < ${lastMonth.end})::int`,
      })
      .from(partners)
      .where(and(eq(partners.tenantId, tenantId), isNull(partners.deletedAt)))

    return totals
  },

  async getImportStats(tenantId: string) {
    const thisMonth = monthBounds(0)
    const lastMonth = monthBounds(-1)

    const [totals] = await db
      .select({
        total: sql<number>`count(*)::int`,
        thisMonthCount: sql<number>`count(*) filter (where ${importJobs.createdAt} >= ${thisMonth.start} and ${importJobs.createdAt} < ${thisMonth.end})::int`,
        lastMonthCount: sql<number>`count(*) filter (where ${importJobs.createdAt} >= ${lastMonth.start} and ${importJobs.createdAt} < ${lastMonth.end})::int`,
      })
      .from(importJobs)
      .where(eq(importJobs.tenantId, tenantId))

    return totals
  },

  async getByState(tenantId: string) {
    return db
      .select({
        state: partners.state,
        count: sql<number>`count(*)::int`,
      })
      .from(partners)
      .where(and(
        eq(partners.tenantId, tenantId),
        isNull(partners.deletedAt),
        sql`${partners.state} is not null`,
      ))
      .groupBy(partners.state)
      .orderBy(sql`count(*) desc`)
      .limit(10)
  },

  async getByCity(tenantId: string) {
    return db
      .select({
        city: partners.city,
        state: partners.state,
        count: sql<number>`count(*)::int`,
      })
      .from(partners)
      .where(and(
        eq(partners.tenantId, tenantId),
        isNull(partners.deletedAt),
        sql`${partners.city} is not null`,
      ))
      .groupBy(partners.city, partners.state)
      .orderBy(sql`count(*) desc`)
      .limit(10)
  },

  async getByPinType(tenantId: string) {
    return db
      .select({
        id: pinTypes.id,
        name: pinTypes.name,
        color: pinTypes.color,
        count: sql<number>`count(${partners.id})::int`,
      })
      .from(partners)
      .innerJoin(pinTypes, eq(partners.pinTypeId, pinTypes.id))
      .where(and(eq(partners.tenantId, tenantId), isNull(partners.deletedAt)))
      .groupBy(pinTypes.id, pinTypes.name, pinTypes.color)
      .orderBy(sql`count(${partners.id}) desc`)
      .limit(10)
  },

  async getRecentImports(tenantId: string) {
    const rows = await db
      .select({
        id: importJobs.id,
        fileName: importJobs.fileName,
        status: importJobs.status,
        mode: importJobs.mode,
        totalRows: importJobs.totalRows,
        created: importJobs.created,
        updated: importJobs.updated,
        removed: importJobs.removed,
        failed: importJobs.failed,
        createdAt: importJobs.createdAt,
        finishedAt: importJobs.finishedAt,
        userName: users.name,
      })
      .from(importJobs)
      .leftJoin(users, eq(importJobs.userId, users.id))
      .where(eq(importJobs.tenantId, tenantId))
      .orderBy(sql`${importJobs.createdAt} desc`)
      .limit(8)

    return rows
  },

  async getPartnersByMonth(tenantId: string) {
    // Last 6 months
    const rows = await db
      .select({
        month: sql<string>`to_char(date_trunc('month', ${partners.createdAt}), 'YYYY-MM')`,
        count: sql<number>`count(*)::int`,
      })
      .from(partners)
      .where(and(
        eq(partners.tenantId, tenantId),
        isNull(partners.deletedAt),
        gte(partners.createdAt, sql`now() - interval '6 months'`),
      ))
      .groupBy(sql`date_trunc('month', ${partners.createdAt})`)
      .orderBy(sql`date_trunc('month', ${partners.createdAt})`)

    return rows
  },
}
