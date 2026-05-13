import { pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'
import { users } from './users'

export const tickets = pgTable('tickets', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id).notNull(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  title: varchar('title', { length: 300 }).notNull(),
  body: text('body').notNull(),
  // open | in_progress | resolved
  status: varchar('status', { length: 20 }).default('open').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
