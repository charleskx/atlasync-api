import type { FastifyInstance } from 'fastify'
import { authenticate } from '../../middlewares/authenticate'
import { subscriptionGuard } from '../../middlewares/subscription-guard'
import { dashboardService } from './dashboard.service'

export async function dashboardRoutes(app: FastifyInstance) {
  app.get('/stats', { preHandler: [authenticate, subscriptionGuard] }, async (req) => {
    return dashboardService.getStats(req.tenantId)
  })
}
