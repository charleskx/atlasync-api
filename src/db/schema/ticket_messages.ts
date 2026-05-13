import { boolean, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { tickets } from './tickets'
import { users } from './users'

export const ticketMessages = pgTable('ticket_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  ticketId: uuid('ticket_id').references(() => tickets.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  body: text('body').notNull(),
  isStaff: boolean('is_staff').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
