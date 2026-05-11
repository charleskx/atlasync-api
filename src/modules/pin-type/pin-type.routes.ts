import type { FastifyInstance } from 'fastify'
import { authenticate } from '../../middlewares/authenticate'
import { subscriptionGuard } from '../../middlewares/subscription-guard'
import { AppError } from '../../shared/errors'
import { createPinTypeSchema, updatePinTypeSchema } from './pin-type.schema'
import { pinTypeService } from './pin-type.service'

const preHandler = [authenticate, subscriptionGuard]

export async function pinTypeRoutes(app: FastifyInstance) {
  app.get('/', { preHandler }, async req => {
    return pinTypeService.list({ id: req.userId, role: req.userRole, tenantId: req.tenantId })
  })

  app.post('/', { preHandler }, async (req, reply) => {
    const body = createPinTypeSchema.safeParse(req.body)
    if (!body.success) throw new AppError('VALIDATION_ERROR', 400, body.error.errors[0].message)

    const pinType = await pinTypeService.create(body.data, {
      id: req.userId,
      role: req.userRole,
      tenantId: req.tenantId,
    })
    return reply.status(201).send(pinType)
  })

  app.patch('/:id', { preHandler }, async req => {
    const { id } = req.params as { id: string }
    const body = updatePinTypeSchema.safeParse(req.body)
    if (!body.success) throw new AppError('VALIDATION_ERROR', 400, body.error.errors[0].message)

    return pinTypeService.update(id, body.data, {
      id: req.userId,
      role: req.userRole,
      tenantId: req.tenantId,
    })
  })

  app.delete('/:id', { preHandler }, async (req, reply) => {
    const { id } = req.params as { id: string }
    await pinTypeService.delete(id, { id: req.userId, role: req.userRole, tenantId: req.tenantId })
    return reply.status(204).send()
  })
}
