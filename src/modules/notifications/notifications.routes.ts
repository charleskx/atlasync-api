import type { FastifyInstance } from 'fastify'
import { authenticate } from '../../middlewares/authenticate'
import { notificationsService } from './notifications.service'

export async function notificationsRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: [authenticate] }, async req => {
    return notificationsService.list(req.tenantId)
  })
}
