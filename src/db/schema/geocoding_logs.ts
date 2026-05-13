import { doublePrecision, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { partners } from './partners'
import { tenants } from './tenants'

export const geocodingLogs = pgTable('geocoding_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  partnerId: uuid('partner_id')
    .references(() => partners.id, { onDelete: 'cascade' })
    .notNull(),
  tenantId: uuid('tenant_id')
    .references(() => tenants.id)
    .notNull(),
  address: text('address').notNull(),
  // success | no_results | failed
  status: varchar('status', { length: 20 }).notNull(),
  errorReason: text('error_reason'),
  provider: varchar('provider', { length: 50 }).default('nominatim').notNull(),
  lat: doublePrecision('lat'),
  lng: doublePrecision('lng'),
  attemptedAt: timestamp('attempted_at').defaultNow().notNull(),
})
