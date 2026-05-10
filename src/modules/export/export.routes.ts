import type { FastifyInstance } from 'fastify'
import { authenticate } from '../../middlewares/authenticate'
import { subscriptionGuard } from '../../middlewares/subscription-guard'
import { AppError } from '../../shared/errors'
import { exportSchema } from './export.schema'
import { exportService } from './export.service'

const preHandler = [authenticate, subscriptionGuard]

export async function exportRoutes(app: FastifyInstance) {
  app.get('/columns', { preHandler }, async req => {
    return exportService.getAvailableColumns({
      id: req.userId,
      role: req.userRole,
      tenantId: req.tenantId,
    })
  })

  app.post('/', { preHandler }, async (req, reply) => {
    const body = exportSchema.safeParse(req.body)
    if (!body.success) throw new AppError('VALIDATION_ERROR', 400, body.error.errors[0].message)

    const { buffer, contentType, extension } = await exportService.generate(body.data, {
      id: req.userId,
      role: req.userRole,
      tenantId: req.tenantId,
    })

    const filename = `atlasync-export-${Date.now()}.${extension}`

    return reply
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .header('Content-Type', contentType)
      .send(buffer)
  })
}
