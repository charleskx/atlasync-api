import type { FastifyInstance } from 'fastify'
import { authenticate } from '../../middlewares/authenticate'
import { geocodingLogsRepository } from './geocoding-logs.repository'

export async function geocodingLogsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate)

  // Tenant: all failed partners (with log detail when available)
  app.get('/geocoding-logs', async (req, reply) => {
    const logs = await geocodingLogsRepository.findFailedByTenant(req.tenantId)
    return reply.send(logs)
  })

  // Tenant: logs for a specific partner
  app.get('/geocoding-logs/partner/:partnerId', async (req, reply) => {
    const { partnerId } = req.params as { partnerId: string }
    const logs = await geocodingLogsRepository.findByPartner(partnerId)
    return reply.send(logs)
  })

}
