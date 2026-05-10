import { eq } from 'drizzle-orm'
import { db } from '../../config/database'
import { tenantSettings } from '../../db/schema'
import type { UpdateSettingsInput } from './tenant.schema'

export const tenantRepository = {
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
