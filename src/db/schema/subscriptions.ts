import { pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'

export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .references(() => tenants.id)
    .notNull()
    .unique(),
  stripeCustomerId: varchar('stripe_customer_id', { length: 200 }),
  stripeSubscriptionId: varchar('stripe_subscription_id', { length: 200 }),
  // trialing | active | past_due | canceled | incomplete
  status: varchar('status', { length: 30 }).notNull().default('trialing'),
  // monthly | annual
  planType: varchar('plan_type', { length: 20 }),
  trialEndsAt: timestamp('trial_ends_at'),
  currentPeriodStart: timestamp('current_period_start'),
  currentPeriodEnd: timestamp('current_period_end'),
  canceledAt: timestamp('canceled_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
