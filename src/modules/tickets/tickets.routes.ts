import type { FastifyInstance } from 'fastify'
import { authenticate } from '../../middlewares/authenticate'
import { AppError } from '../../shared/errors'
import { ticketsService } from './tickets.service'

export async function ticketsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate)

  // List own tenant's tickets (or all, if super_admin)
  app.get('/', async req => {
    const requester = { id: req.userId, role: req.userRole, tenantId: req.tenantId }
    if (req.userRole === 'super_admin') return ticketsService.listAll(requester)
    return ticketsService.list(requester)
  })

  // Create a new ticket
  app.post('/', async (req, reply) => {
    const { title, body } = req.body as { title?: string; body?: string }
    if (!title?.trim() || !body?.trim()) throw new AppError('VALIDATION_ERROR', 400, 'Título e descrição são obrigatórios')
    const ticket = await ticketsService.create(title.trim(), body.trim(), {
      id: req.userId,
      role: req.userRole,
      tenantId: req.tenantId,
    })
    return reply.status(201).send(ticket)
  })

  // Get ticket detail + messages
  app.get('/:id', async req => {
    const { id } = req.params as { id: string }
    return ticketsService.getDetail(id, { id: req.userId, role: req.userRole, tenantId: req.tenantId })
  })

  // Add a reply message
  app.post('/:id/messages', async (req, reply) => {
    const { id } = req.params as { id: string }
    const { body } = req.body as { body?: string }
    if (!body?.trim()) throw new AppError('VALIDATION_ERROR', 400, 'Mensagem não pode ser vazia')
    const msg = await ticketsService.reply(id, body.trim(), { id: req.userId, role: req.userRole, tenantId: req.tenantId })
    return reply.status(201).send(msg)
  })

  // Update ticket status (super_admin only)
  app.patch('/:id/status', async (req, reply) => {
    const { id } = req.params as { id: string }
    const { status } = req.body as { status?: string }
    if (!status || !['open', 'in_progress', 'resolved'].includes(status)) {
      throw new AppError('VALIDATION_ERROR', 400, 'Status inválido')
    }
    const updated = await ticketsService.updateStatus(id, status, { id: req.userId, role: req.userRole, tenantId: req.tenantId })
    return reply.send(updated)
  })
}
