import { eq } from 'drizzle-orm'
import { db } from '../../config/database'
import { subscriptions, tenantSettings, tenants } from '../../db/schema'
import type { UpdateSettingsInput } from './tenant.schema'

const ACTIVE_SUBSCRIPTION_STATUSES = ['trialing', 'active']

export const tenantRepository = {
  async findTenantStatus(tenantId: string) {
    const [tenant] = await db
      .select({ active: tenants.active })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1)

    const [sub] = await db
      .select({ status: subscriptions.status })
      .from(subscriptions)
      .where(eq(subscriptions.tenantId, tenantId))
      .limit(1)

    return {
      tenantActive: tenant?.active ?? false,
      subscriptionActive: sub ? ACTIVE_SUBSCRIPTION_STATUSES.includes(sub.status) : false,
    }
  },

  async findSettings(tenantId: string) {
    return db.query.tenantSettings.findFirst({
      where: eq(tenantSettings.tenantId, tenantId),
    })
  },

  async upsertSettings(tenantId: string, data: UpdateSettingsInput) {
    const [result] = await db
      .insert(tenantSettings)
      .values({ tenantId, ...data, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: tenantSettings.tenantId,
        set: { ...data, updatedAt: new Date() },
      })
      .returning()
    return result
  },
}
