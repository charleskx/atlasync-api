import type { FastifyInstance } from 'fastify'
import { authenticate } from '../../middlewares/authenticate'
import { subscriptionGuard } from '../../middlewares/subscription-guard'
import { AppError } from '../../shared/errors'
import { createPartnerSchema, listPartnersSchema, updatePartnerSchema } from './partner.schema'
import { partnerService } from './partner.service'

const preHandler = [authenticate, subscriptionGuard]

export async function partnerRoutes(app: FastifyInstance) {
  app.get('/', { preHandler }, async req => {
    const query = listPartnersSchema.safeParse(req.query)
    if (!query.success) throw new AppError('VALIDATION_ERROR', 400, query.error.errors[0].message)
    return partnerService.list(
      { id: req.userId, role: req.userRole, tenantId: req.tenantId },
      query.data,
    )
  })

  app.get('/columns', { preHandler }, async req => {
    return partnerService.getColumns({ id: req.userId, role: req.userRole, tenantId: req.tenantId })
  })

  app.get('/:id', { preHandler }, async req => {
    const { id } = req.params as { id: string }
    return partnerService.getById(id, {
      id: req.userId,
      role: req.userRole,
      tenantId: req.tenantId,
    })
  })

  app.post('/', { preHandler }, async (req, reply) => {
    const body = createPartnerSchema.safeParse(req.body)
    if (!body.success) throw new AppError('VALIDATION_ERROR', 400, body.error.errors[0].message)
    const partner = await partnerService.create(body.data, {
      id: req.userId,
      role: req.userRole,
      tenantId: req.tenantId,
    })
    return reply.status(201).send(partner)
  })

  app.patch('/:id', { preHandler }, async req => {
    const { id } = req.params as { id: string }
    const body = updatePartnerSchema.safeParse(req.body)
    if (!body.success) throw new AppError('VALIDATION_ERROR', 400, body.error.errors[0].message)
    return partnerService.update(id, body.data, {
      id: req.userId,
      role: req.userRole,
      tenantId: req.tenantId,
    })
  })

  app.delete('/:id', { preHandler }, async (req, reply) => {
    const { id } = req.params as { id: string }
    await partnerService.delete(id, { id: req.userId, role: req.userRole, tenantId: req.tenantId })
    return reply.status(204).send()
  })
}
