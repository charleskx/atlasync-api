import { integer, jsonb, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'
import { users } from './users'

export const importJobs = pgTable('import_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .references(() => tenants.id)
    .notNull(),
  userId: uuid('user_id')
    .references(() => users.id)
    .notNull(),
  // queued | processing | done | failed
  status: varchar('status', { length: 20 }).default('queued').notNull(),
  // full | incremental
  mode: varchar('mode', { length: 20 }).default('full').notNull(),
  fileName: varchar('file_name', { length: 300 }),
  totalRows: integer('total_rows'),
  processedRows: integer('processed_rows').default(0),
  created: integer('created').default(0),
  updated: integer('updated').default(0),
  removed: integer('removed').default(0),
  failed: integer('failed').default(0),
  errorLog: jsonb('error_log'),
  startedAt: timestamp('started_at'),
  finishedAt: timestamp('finished_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
