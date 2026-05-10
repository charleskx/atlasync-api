import type { FastifyInstance } from 'fastify'
import { authenticate } from '../../middlewares/authenticate'
import { subscriptionGuard } from '../../middlewares/subscription-guard'
import { AppError } from '../../shared/errors'
import {
  createMapSchema,
  embedSnippetQuerySchema,
  mapPinsQuerySchema,
  updateMapSchema,
} from './map.schema'
import { mapService } from './map.service'

const preHandler = [authenticate, subscriptionGuard]

export async function mapRoutes(app: FastifyInstance) {
  // ─── Rotas autenticadas ────────────────────────────────────────────────────

  app.get('/', { preHandler }, async req => {
    return mapService.list({ id: req.userId, role: req.userRole, tenantId: req.tenantId })
  })

  app.post('/', { preHandler }, async (req, reply) => {
    const body = createMapSchema.safeParse(req.body)
    if (!body.success) throw new AppError('VALIDATION_ERROR', 400, body.error.errors[0].message)

    const map = await mapService.create(body.data, {
      id: req.userId,
      role: req.userRole,
      tenantId: req.tenantId,
    })
    return reply.status(201).send(map)
  })

  app.get('/:id', { preHandler }, async req => {
    const { id } = req.params as { id: string }
    return mapService.getById(id, { id: req.userId, role: req.userRole, tenantId: req.tenantId })
  })

  app.patch('/:id', { preHandler }, async req => {
    const { id } = req.params as { id: string }
    const body = updateMapSchema.safeParse(req.body)
    if (!body.success) throw new AppError('VALIDATION_ERROR', 400, body.error.errors[0].message)

    return mapService.update(id, body.data, {
      id: req.userId,
      role: req.userRole,
      tenantId: req.tenantId,
    })
  })

  app.delete('/:id', { preHandler }, async (req, reply) => {
    const { id } = req.params as { id: string }
    await mapService.delete(id, { id: req.userId, role: req.userRole, tenantId: req.tenantId })
    return reply.status(204).send()
  })

  app.get('/:id/pins', { preHandler }, async req => {
    const { id } = req.params as { id: string }
    const query = mapPinsQuerySchema.safeParse(req.query)
    if (!query.success) throw new AppError('VALIDATION_ERROR', 400, query.error.errors[0].message)

    return mapService.getPins(id, query.data, {
      id: req.userId,
      role: req.userRole,
      tenantId: req.tenantId,
    })
  })

  app.post('/:id/embed-token', { preHandler }, async req => {
    const { id } = req.params as { id: string }
    return mapService.generateEmbedToken(id, {
      id: req.userId,
      role: req.userRole,
      tenantId: req.tenantId,
    })
  })

  app.get('/:id/embed', { preHandler }, async req => {
    const { id } = req.params as { id: string }
    const query = embedSnippetQuerySchema.safeParse(req.query)
    if (!query.success) throw new AppError('VALIDATION_ERROR', 400, query.error.errors[0].message)

    return mapService.getEmbedSnippet(id, query.data.type, {
      id: req.userId,
      role: req.userRole,
      tenantId: req.tenantId,
    })
  })

  // ─── Rotas públicas (sem autenticação) ────────────────────────────────────

  app.get('/public/:token/pins', async req => {
    const { token } = req.params as { token: string }
    const { city, state } = req.query as { city?: string; state?: string }
    return mapService.getPublicPins(token, city, state)
  })

  app.get('/public/:token/localities', async req => {
    const { token } = req.params as { token: string }
    return mapService.getPublicLocalities(token)
  })
}
