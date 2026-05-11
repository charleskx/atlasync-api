import {
  doublePrecision,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { pinTypes } from './pin_types'
import { tenants } from './tenants'

export const partners = pgTable(
  'partners',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id)
      .notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    address: text('address').notNull(),
    lat: doublePrecision('lat'),
    lng: doublePrecision('lng'),
    geocodedAt: timestamp('geocoded_at'),
    // pending | done | failed
    geocodeStatus: varchar('geocode_status', { length: 20 }).default('pending'),
    pinTypeId: uuid('pin_type_id').references(() => pinTypes.id),
    // public | internal
    visibility: varchar('visibility', { length: 20 }).default('public').notNull(),
    // dashboard | import
    source: varchar('source', { length: 20 }).default('dashboard'),
    externalKey: varchar('external_key', { length: 300 }),
    city: varchar('city', { length: 200 }),
    state: varchar('state', { length: 100 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'),
  },
  t => ({
    tenantIdx: index('partners_tenant_idx').on(t.tenantId),
    externalKeyIdx: index('partners_extkey_idx').on(t.tenantId, t.externalKey),
    latLngIdx: index('partners_latlng_idx').on(t.lat, t.lng),
    visibilityIdx: index('partners_visibility_idx').on(t.tenantId, t.visibility),
    pinTypeIdx: index('partners_pin_type_idx').on(t.pinTypeId),
  }),
)
