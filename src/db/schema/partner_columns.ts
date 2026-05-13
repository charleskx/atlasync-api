import {
  boolean,
  integer,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { tenants } from './tenants'

export const partnerColumns = pgTable(
  'partner_columns',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id)
      .notNull(),
    key: varchar('key', { length: 100 }).notNull(),
    label: varchar('label', { length: 200 }).notNull(),
    // text | number | boolean | date | url
    dataType: varchar('data_type', { length: 20 }).default('text'),
    visible: boolean('visible').default(true),
    sortOrder: integer('sort_order').default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  t => ({
    tenantKeyUnique: uniqueIndex('partner_columns_tenant_key_unique').on(t.tenantId, t.key),
  }),
)
