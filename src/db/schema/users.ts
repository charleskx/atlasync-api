import { boolean, index, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id)
      .notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    email: varchar('email', { length: 200 }).notNull().unique(),
    passwordHash: varchar('password_hash', { length: 500 }),
    googleId: varchar('google_id', { length: 200 }).unique(),
    // owner | admin | employee | super_admin
    role: varchar('role', { length: 30 }).notNull().default('employee'),
    emailVerified: boolean('email_verified').default(false).notNull(),
    emailVerifyToken: varchar('email_verify_token', { length: 200 }),
    emailVerifyExpiresAt: timestamp('email_verify_expires_at'),
    resetPasswordToken: varchar('reset_password_token', { length: 200 }),
    resetPasswordExpiresAt: timestamp('reset_password_expires_at'),
    totpSecret: varchar('totp_secret', { length: 200 }),
    totpEnabled: boolean('totp_enabled').default(false).notNull(),
    invitedBy: uuid('invited_by').references((): AnyPgColumn => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'),
  },
  t => ({
    tenantIdx: index('users_tenant_idx').on(t.tenantId),
    emailIdx: index('users_email_idx').on(t.email),
  }),
)
