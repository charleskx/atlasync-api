import { and, eq, isNull } from 'drizzle-orm'
import { db } from '../../config/database'
import { users } from '../../db/schema'

export const userRepository = {
  async findById(id: string, tenantId: string) {
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, id), eq(users.tenantId, tenantId), isNull(users.deletedAt)))
      .limit(1)
    return user ?? null
  },

  async findAll(tenantId: string) {
    return db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        emailVerified: users.emailVerified,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(and(eq(users.tenantId, tenantId), isNull(users.deletedAt)))
      .orderBy(users.createdAt)
  },

  async create(data: typeof users.$inferInsert) {
    const [user] = await db.insert(users).values(data).returning()
    return user
  },

  async update(id: string, tenantId: string, data: Partial<typeof users.$inferInsert>) {
    const [user] = await db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(users.id, id), eq(users.tenantId, tenantId)))
      .returning()
    return user ?? null
  },

  async softDelete(id: string, tenantId: string) {
    await db
      .update(users)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(users.id, id), eq(users.tenantId, tenantId)))
  },
}
