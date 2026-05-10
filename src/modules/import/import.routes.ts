import type { FastifyInstance } from 'fastify'
import { authenticate } from '../../middlewares/authenticate'
import { subscriptionGuard } from '../../middlewares/subscription-guard'
import { AppError } from '../../shared/errors'
import { importService } from './import.service'

const preHandler = [authenticate, subscriptionGuard]

export async function importRoutes(app: FastifyInstance) {
  app.post('/upload', { preHandler }, async (req, reply) => {
    let data: Awaited<ReturnType<typeof req.file>>
    try {
      data = await req.file()
    } catch {
      throw new AppError('NO_FILE', 400, 'Envie o arquivo como multipart/form-data')
    }
    if (!data) throw new AppError('NO_FILE', 400, 'Arquivo não enviado')

    const ext = data.filename.split('.').pop()?.toLowerCase()
    if (!ext || !['xlsx', 'xls', 'csv'].includes(ext)) {
      throw new AppError('INVALID_FILE_TYPE', 400, 'Formato inválido. Use .xlsx, .xls ou .csv')
    }

    const buffer = await data.toBuffer()

    const result = await importService.upload(buffer, data.filename, {
      id: req.userId,
      role: req.userRole,
      tenantId: req.tenantId,
    })

    return reply.status(202).send(result)
  })

  app.get('/', { preHandler }, async req => {
    return importService.listJobs({ id: req.userId, role: req.userRole, tenantId: req.tenantId })
  })

  app.get('/:id', { preHandler }, async req => {
    const { id } = req.params as { id: string }
    return importService.getJob(id, { id: req.userId, role: req.userRole, tenantId: req.tenantId })
  })
}
