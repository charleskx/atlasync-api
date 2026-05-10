import type { FastifyInstance } from 'fastify'
import { authenticate } from '../../middlewares/authenticate'
import { subscriptionGuard } from '../../middlewares/subscription-guard'
import { AppError } from '../../shared/errors'
import { inviteUserSchema, updateUserSchema } from './user.schema'
import { userService } from './user.service'

const preHandler = [authenticate, subscriptionGuard]

export async function userRoutes(app: FastifyInstance) {
  app.get('/', { preHandler }, async req => {
    return userService.listUsers(req.tenantId)
  })

  app.get('/:id', { preHandler }, async req => {
    const { id } = req.params as { id: string }
    return userService.getUserById(id, req.tenantId)
  })

  app.post('/invite', { preHandler }, async (req, reply) => {
    const body = inviteUserSchema.safeParse(req.body)
    if (!body.success) throw new AppError('VALIDATION_ERROR', 400, body.error.errors[0].message)

    const user = await userService.inviteUser(body.data, {
      id: req.userId,
      name: req.userName,
      role: req.userRole,
      tenantId: req.tenantId,
    })

    return reply.status(201).send(user)
  })

  app.patch('/:id', { preHandler }, async req => {
    const { id } = req.params as { id: string }
    const body = updateUserSchema.safeParse(req.body)
    if (!body.success) throw new AppError('VALIDATION_ERROR', 400, body.error.errors[0].message)

    return userService.updateUser(id, body.data, {
      id: req.userId,
      role: req.userRole,
      tenantId: req.tenantId,
    })
  })

  app.delete('/:id', { preHandler }, async (req, reply) => {
    const { id } = req.params as { id: string }

    await userService.deleteUser(id, {
      id: req.userId,
      role: req.userRole,
      tenantId: req.tenantId,
    })

    return reply.status(204).send()
  })
}
