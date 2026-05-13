import { and, eq, isNull, sql } from 'drizzle-orm'
import { db } from '../../config/database'
import { importJobs, partners, subscriptions } from '../../db/schema'
import { ticketsRepository } from '../tickets/tickets.repository'

export const notificationsRepository = {
  async getRecentImports(tenantId: string) {
    return db
      .select({
        id: importJobs.id,
        fileName: importJobs.fileName,
        status: importJobs.status,
        mode: importJobs.mode,
        created: importJobs.created,
        updated: importJobs.updated,
        removed: importJobs.removed,
        failed: importJobs.failed,
        createdAt: importJobs.createdAt,
        finishedAt: importJobs.finishedAt,
      })
      .from(importJobs)
      .where(
        and(
          eq(importJobs.tenantId, tenantId),
          sql`${importJobs.status} IN ('done', 'failed')`,
          sql`${importJobs.createdAt} >= now() - interval '7 days'`,
        ),
      )
      .orderBy(sql`${importJobs.createdAt} desc`)
      .limit(10)
  },

  async getGeocodingFailures(tenantId: string) {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(partners)
      .where(
        and(
          eq(partners.tenantId, tenantId),
          eq(partners.geocodeStatus, 'failed'),
          isNull(partners.deletedAt),
        ),
      )
    return row?.count ?? 0
  },

  getRecentStaffReplies: (tenantId: string) => ticketsRepository.getRecentStaffReplies(tenantId),
  getOpenTickets: () => ticketsRepository.countOpenTickets(),

  async getTrialDaysLeft(tenantId: string) {
    const sub = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.tenantId, tenantId),
    })
    if (!sub || sub.status !== 'trialing' || !sub.trialEndsAt) return null
    const days = Math.ceil(
      (new Date(sub.trialEndsAt).getTime() - Date.now()) / 86_400_000,
    )
    return days > 0 ? days : 0
  },
}
