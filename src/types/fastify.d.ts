declare module 'fastify' {
  interface FastifyRequest {
    userId: string
    tenantId: string
    userRole: string
    userName: string
  }
}

export {}
