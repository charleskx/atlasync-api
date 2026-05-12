import dayjs from 'dayjs'
import type { FastifyInstance } from 'fastify'
import { authenticate } from '../../middlewares/authenticate'
import { AppError } from '../../shared/errors'
import { generateToken } from '../../shared/utils'
import { authRepository } from './auth.repository'
import {
  acceptInviteSchema,
  forgotPasswordSchema,
  loginSchema,
  refreshSchema,
  registerSchema,
  resetPasswordSchema,
  totpLoginSchema,
  totpVerifySchema,
  verifyEmailSchema,
} from './auth.schema'
import { authService } from './auth.service'

export async function authRoutes(app: FastifyInstance) {
  app.post('/register', async (req, reply) => {
    const body = registerSchema.safeParse(req.body)
    if (!body.success) throw new AppError('VALIDATION_ERROR', 400, body.error.errors[0].message)

    const result = await authService.register(body.data)
    const accessToken = await reply.jwtSign({
      sub: result.user.id,
      tenantId: result.tenant.id,
      role: result.user.role,
      name: result.user.name,
    })

    return reply.status(201).send({ accessToken, refreshToken: result.refreshToken })
  })

  app.post(
    '/login',
    { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } },
    async (req, reply) => {
      const body = loginSchema.safeParse(req.body)
      if (!body.success) throw new AppError('VALIDATION_ERROR', 400, body.error.errors[0].message)

      const result = await authService.login(body.data)

      if (result.requiresTwoFactor) {
        return { requiresTwoFactor: true, tempToken: result.tempToken }
      }

      if (!result.user) throw new AppError('INTERNAL_ERROR', 500, 'Erro inesperado no login')

      const accessToken = await reply.jwtSign({
        sub: result.user.id,
        tenantId: result.user.tenantId,
        role: result.user.role,
        name: result.user.name,
      })

      return { requiresTwoFactor: false, accessToken, refreshToken: result.refreshToken }
    },
  )

  app.post('/2fa/login', async (req, reply) => {
    const body = totpLoginSchema.safeParse(req.body)
    if (!body.success) throw new AppError('VALIDATION_ERROR', 400, body.error.errors[0].message)

    const result = await authService.loginWithTotp(body.data.tempToken, body.data.code)
    const accessToken = await reply.jwtSign({
      sub: result.user.id,
      tenantId: result.user.tenantId,
      role: result.user.role,
      name: result.user.name,
    })

    return { accessToken, refreshToken: result.refreshToken }
  })

  app.post('/2fa/setup', { preHandler: [authenticate] }, async req => {
    return authService.setupTotp(req.userId)
  })

  app.post('/2fa/verify', { preHandler: [authenticate] }, async req => {
    const body = totpVerifySchema.safeParse(req.body)
    if (!body.success) throw new AppError('VALIDATION_ERROR', 400, body.error.errors[0].message)

    const result = await authService.verifyAndEnableTotp(req.userId, body.data.code)
    return { success: true, recoveryCodes: result.recoveryCodes }
  })

  app.post('/2fa/recover', async (req, reply) => {
    const body = totpLoginSchema.safeParse(req.body)
    if (!body.success) throw new AppError('VALIDATION_ERROR', 400, body.error.errors[0].message)

    const result = await authService.loginWithRecoveryCode(body.data.tempToken, body.data.code)
    const accessToken = await reply.jwtSign({
      sub: result.user.id,
      tenantId: result.user.tenantId,
      role: result.user.role,
      name: result.user.name,
    })

    return { accessToken, refreshToken: result.refreshToken }
  })

  app.delete('/2fa', { preHandler: [authenticate] }, async req => {
    const body = totpVerifySchema.safeParse(req.body)
    if (!body.success) throw new AppError('VALIDATION_ERROR', 400, body.error.errors[0].message)

    await authService.disableTotp(req.userId, body.data.code)
    return { success: true }
  })

  app.post('/refresh', async (req, reply) => {
    const body = refreshSchema.safeParse(req.body)
    if (!body.success) throw new AppError('VALIDATION_ERROR', 400, body.error.errors[0].message)

    const result = await authService.refresh(body.data.refreshToken)
    const accessToken = await reply.jwtSign({
      sub: result.user.id,
      tenantId: result.user.tenantId,
      role: result.user.role,
      name: result.user.name,
    })

    return { accessToken, refreshToken: result.refreshToken }
  })

  app.post('/logout', async req => {
    const body = refreshSchema.safeParse(req.body)
    if (!body.success) throw new AppError('VALIDATION_ERROR', 400, body.error.errors[0].message)

    await authService.logout(body.data.refreshToken)
    return { success: true }
  })

  app.get('/verify', async req => {
    const query = verifyEmailSchema.safeParse(req.query)
    if (!query.success) throw new AppError('VALIDATION_ERROR', 400, query.error.errors[0].message)

    await authService.verifyEmail(query.data.token)
    return { success: true }
  })

  app.post('/forgot-password', async req => {
    const body = forgotPasswordSchema.safeParse(req.body)
    if (!body.success) throw new AppError('VALIDATION_ERROR', 400, body.error.errors[0].message)

    await authService.forgotPassword(body.data.email)
    return { success: true, message: 'Se o e-mail existir, você receberá as instruções.' }
  })

  app.post('/reset-password', async req => {
    const body = resetPasswordSchema.safeParse(req.body)
    if (!body.success) throw new AppError('VALIDATION_ERROR', 400, body.error.errors[0].message)

    await authService.resetPassword(body.data)
    return { success: true }
  })

  app.post('/accept-invite', async (req, reply) => {
    const body = acceptInviteSchema.safeParse(req.body)
    if (!body.success) throw new AppError('VALIDATION_ERROR', 400, body.error.errors[0].message)

    const user = await authService.acceptInvite(body.data)
    if (!user) throw new AppError('USER_NOT_FOUND', 404)

    const accessToken = await reply.jwtSign({
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role,
      name: user.name,
    })

    const refreshTokenValue = generateToken(64)
    await authRepository.createRefreshToken({
      userId: user.id,
      tenantId: user.tenantId,
      token: refreshTokenValue,
      expiresAt: dayjs().add(30, 'day').toDate(),
    })

    return { accessToken, refreshToken: refreshTokenValue }
  })
}
