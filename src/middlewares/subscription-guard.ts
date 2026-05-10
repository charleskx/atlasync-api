import { eq } from 'drizzle-orm'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { db } from '../config/database'
import { subscriptions } from '../db/schema'
import { AppError } from '../shared/errors'

const ACTIVE_STATUSES = ['trialing', 'active']

export async function subscriptionGuard(req: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const [sub] = await db
    .select({ status: subscriptions.status })
    .from(subscriptions)
    .where(eq(subscriptions.tenantId, req.tenantId))
    .limit(1)

  if (!sub || !ACTIVE_STATUSES.includes(sub.status)) {
    throw new AppError('SUBSCRIPTION_INACTIVE', 402, 'Assinatura inativa ou vencida')
  }
}
