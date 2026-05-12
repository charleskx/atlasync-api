import { pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { users } from './users'

export const totpRecoveryCodes = pgTable('totp_recovery_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  codeHash: varchar('code_hash', { length: 300 }).notNull(),
  usedAt: timestamp('used_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
