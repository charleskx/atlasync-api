import { count, eq, isNull, sql } from 'drizzle-orm'
import { db } from '../../config/database'
import { importJobs, subscriptions, tenants, users } from '../../db/schema'

export const adminRepository = {
  async listTenants() {
    return db
      .select({
        id: tenants.id,
        name: tenants.name,
        slug: tenants.slug,
        email: tenants.email,
        active: tenants.active,
        createdAt: tenants.createdAt,
        subscriptionStatus: subscriptions.status,
        planType: subscriptions.planType,
        trialEndsAt: subscriptions.trialEndsAt,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
      })
      .from(tenants)
      .leftJoin(subscriptions, eq(subscriptions.tenantId, tenants.id))
      .where(isNull(tenants.deletedAt))
      .orderBy(tenants.createdAt)
  },

  async findTenantById(id: string) {
    const [row] = await db
      .select({
        id: tenants.id,
        name: tenants.name,
        slug: tenants.slug,
        email: tenants.email,
        active: tenants.active,
        createdAt: tenants.createdAt,
        subscriptionStatus: subscriptions.status,
        planType: subscriptions.planType,
        stripeCustomerId: subscriptions.stripeCustomerId,
        trialEndsAt: subscriptions.trialEndsAt,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
      })
      .from(tenants)
      .leftJoin(subscriptions, eq(subscriptions.tenantId, tenants.id))
      .where(eq(tenants.id, id))

    if (!row) return null

    const [{ userCount }] = await db
      .select({ userCount: count() })
      .from(users)
      .where(eq(users.tenantId, id))

    return { ...row, userCount }
  },

  async setTenantActive(id: string, active: boolean) {
    await db.update(tenants).set({ active, updatedAt: new Date() }).where(eq(tenants.id, id))
  },

  async getMetrics() {
    const [{ totalTenants }] = await db
      .select({ totalTenants: count() })
      .from(tenants)
      .where(isNull(tenants.deletedAt))

    const [{ activeTenants }] = await db
      .select({ activeTenants: count() })
      .from(subscriptions)
      .where(sql`${subscriptions.status} IN ('active', 'trialing')`)

    const [{ activeSubscriptions }] = await db
      .select({ activeSubscriptions: count() })
      .from(subscriptions)
      .where(eq(subscriptions.status, 'active'))

    const [{ monthlyCount }] = await db
      .select({ monthlyCount: count() })
      .from(subscriptions)
      .where(sql`${subscriptions.status} = 'active' AND ${subscriptions.planType} = 'monthly'`)

    const [{ annualCount }] = await db
      .select({ annualCount: count() })
      .from(subscriptions)
      .where(sql`${subscriptions.status} = 'active' AND ${subscriptions.planType} = 'annual'`)

    const [{ totalImports }] = await db.select({ totalImports: count() }).from(importJobs)

    const [{ doneImports }] = await db
      .select({ doneImports: count() })
      .from(importJobs)
      .where(eq(importJobs.status, 'done'))

    return {
      totalTenants,
      activeTenants,
      activeSubscriptions,
      monthlySubscriptions: monthlyCount,
      annualSubscriptions: annualCount,
      totalImports,
      doneImports,
    }
  },
}
