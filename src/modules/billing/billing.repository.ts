import { and, between, eq, isNotNull } from 'drizzle-orm'
import { db } from '../../config/database'
import { subscriptions, tenants, users } from '../../db/schema'

type SubscriptionUpdate = {
  stripeCustomerId?: string
  stripeSubscriptionId?: string
  status?: string
  planType?: string
  currentPeriodStart?: Date
  currentPeriodEnd?: Date
  canceledAt?: Date | null
}

export const billingRepository = {
  async findSubscriptionByTenantId(tenantId: string) {
    return db.query.subscriptions.findFirst({
      where: eq(subscriptions.tenantId, tenantId),
    })
  },

  async updateSubscription(tenantId: string, data: SubscriptionUpdate) {
    const [updated] = await db
      .update(subscriptions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(subscriptions.tenantId, tenantId))
      .returning()
    return updated
  },

  async findTenantByStripeCustomerId(customerId: string) {
    return db.query.subscriptions.findFirst({
      where: eq(subscriptions.stripeCustomerId, customerId),
      columns: { tenantId: true },
    })
  },

  async findTenantOwner(tenantId: string) {
    return db.query.users.findFirst({
      where: and(eq(users.tenantId, tenantId), eq(users.role, 'owner')),
      columns: { id: true, name: true, email: true },
    })
  },

  async findTenantById(tenantId: string) {
    return db.query.tenants.findFirst({
      where: eq(tenants.id, tenantId),
      columns: { id: true, name: true, email: true },
    })
  },

  async findExpiringTrials(targetDate: Date) {
    const start = new Date(targetDate)
    start.setHours(0, 0, 0, 0)
    const end = new Date(targetDate)
    end.setHours(23, 59, 59, 999)

    return db
      .select({
        tenantId: subscriptions.tenantId,
        tenantName: tenants.name,
        ownerEmail: users.email,
        trialEndsAt: subscriptions.trialEndsAt,
      })
      .from(subscriptions)
      .innerJoin(tenants, eq(tenants.id, subscriptions.tenantId))
      .innerJoin(users, and(eq(users.tenantId, subscriptions.tenantId), eq(users.role, 'owner')))
      .where(
        and(
          eq(subscriptions.status, 'trialing'),
          isNotNull(subscriptions.trialEndsAt),
          between(subscriptions.trialEndsAt, start, end),
        ),
      )
  },
}
