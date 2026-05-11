import { index, pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'

export const pinTypes = pgTable(
  'pin_types',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id)
      .notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    color: varchar('color', { length: 7 }).notNull().default('#6366f1'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'),
  },
  t => ({
    tenantIdx: index('pin_types_tenant_idx').on(t.tenantId),
    tenantNameUnique: uniqueIndex('pin_types_tenant_name_unique').on(t.tenantId, t.name),
  }),
)
