import type { FastifyInstance } from 'fastify'
import { authenticate } from '../../middlewares/authenticate'
import { onTenantEvent } from '../../shared/sse-bus'
import { notificationsService } from './notifications.service'

export async function notificationsRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: [authenticate] }, async req => {
    return notificationsService.list(req.tenantId, req.userRole)
  })

  app.get('/events', async (req, reply) => {
    const { token } = req.query as { token?: string }
    if (!token) {
      return reply.status(401).send({ error: 'Token obrigatório' })
    }

    let tenantId: string
    try {
      const payload = app.jwt.verify<{ tenantId: string }>(token)
      tenantId = payload.tenantId
    } catch {
      return reply.status(401).send({ error: 'Token inválido' })
    }

    reply.raw.setHeader('Content-Type', 'text/event-stream')
    reply.raw.setHeader('Cache-Control', 'no-cache')
    reply.raw.setHeader('Connection', 'keep-alive')
    reply.raw.setHeader('X-Accel-Buffering', 'no')
    reply.hijack()

    const send = (event: string, data: object) => {
      try {
        reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
      } catch {}
    }

    // Initial heartbeat so client knows the connection is live
    reply.raw.write(': connected\n\n')

    const heartbeat = setInterval(() => {
      try {
        reply.raw.write(': heartbeat\n\n')
      } catch {
        clearInterval(heartbeat)
      }
    }, 30_000)

    const unsubscribe = onTenantEvent(tenantId, event => {
      send(event.type, event)
    })

    req.raw.on('close', () => {
      clearInterval(heartbeat)
      unsubscribe()
      reply.raw.end()
    })
  })
}
