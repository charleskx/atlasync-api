import { boolean, jsonb, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'

export const maps = pgTable('maps', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .references(() => tenants.id)
    .notNull(),
  name: varchar('name', { length: 120 }).notNull(),
  // internal | public
  type: varchar('type', { length: 20 }).notNull(),
  embedToken: varchar('embed_token', { length: 100 }).unique(),
  filters: jsonb('filters'),
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
})
