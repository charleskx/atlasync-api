import type { FastifyReply, FastifyRequest } from 'fastify'
import { AppError } from '../shared/errors'

interface JwtPayload {
  sub: string
  tenantId: string
  role: string
  name: string
}

export async function authenticate(req: FastifyRequest, _reply: FastifyReply): Promise<void> {
  try {
    const payload = await req.jwtVerify<JwtPayload>()
    req.userId = payload.sub
    req.tenantId = payload.tenantId
    req.userRole = payload.role
    req.userName = payload.name
  } catch {
    throw new AppError('UNAUTHORIZED', 401, 'Token inválido ou expirado')
  }
}
