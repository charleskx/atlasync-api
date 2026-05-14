import argon2 from 'argon2'
import dayjs from 'dayjs'
import { eq } from 'drizzle-orm'
import { and, isNull } from 'drizzle-orm'
import { generateSecret, generateURI, verifySync } from 'otplib'
import QRCode from 'qrcode'
import { db } from '../../config/database'
import { env } from '../../config/env'
import { refreshTokens, subscriptions, tenantSettings, tenants, totpRecoveryCodes, users } from '../../db/schema'
import { AppError } from '../../shared/errors'
import { inviteEmailHtml, resetPasswordHtml, sendMail, verifyEmailHtml } from '../../shared/mailer'
import { generateToken, slugify } from '../../shared/utils'
import { authRepository } from './auth.repository'
import type {
  AcceptInviteInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
} from './auth.schema'

// temp tokens armazenados em memória — suficiente para instância única; usar Redis em cluster
const tempTokens = new Map<string, { userId: string; expiresAt: Date }>()

export const authService = {
  async register({ tenantName, name, email, password }: RegisterInput) {
    const existing = await authRepository.findUserByEmail(email)
    if (existing) throw new AppError('EMAIL_TAKEN', 409, 'E-mail já cadastrado')

    let slug = slugify(tenantName)
    const slugTaken = await authRepository.findTenantBySlug(slug)
    if (slugTaken) slug = `${slug}-${generateToken(4)}`

    const passwordHash = await argon2.hash(password)
    const emailVerifyToken = generateToken()
    const refreshTokenValue = generateToken(64)

    const { user, tenant } = await db.transaction(async tx => {
      const [tenant] = await tx
        .insert(tenants)
        .values({ name: tenantName, slug, email, updatedAt: new Date() })
        .returning()

      const [user] = await tx
        .insert(users)
        .values({
          tenantId: tenant.id,
          name,
          email,
          passwordHash,
          role: 'owner',
          emailVerifyToken,
          emailVerifyExpiresAt: dayjs().add(24, 'hour').toDate(),
          updatedAt: new Date(),
        })
        .returning()

      await tx.insert(subscriptions).values({
        tenantId: tenant.id,
        status: 'trialing',
        trialEndsAt: dayjs().add(14, 'day').toDate(),
        updatedAt: new Date(),
      })

      await tx.insert(tenantSettings).values({
        tenantId: tenant.id,
        updatedAt: new Date(),
      })

      await tx.insert(refreshTokens).values({
        userId: user.id,
        tenantId: tenant.id,
        token: refreshTokenValue,
        expiresAt: dayjs().add(30, 'day').toDate(),
      })

      return { user, tenant }
    })

    sendMail({
      to: email,
      subject: 'Verifique seu e-mail — MappaHub',
      html: verifyEmailHtml(emailVerifyToken, env.APP_URL),
    }).catch(err => console.error('[mailer]', err))

    return { user, tenant, refreshToken: refreshTokenValue }
  },

  async login({ email, password }: LoginInput) {
    const user = await authRepository.findUserByEmail(email)
    if (!user) throw new AppError('INVALID_CREDENTIALS', 401, 'Credenciais inválidas')

    const valid = await argon2.verify(user.passwordHash, password)
    if (!valid) throw new AppError('INVALID_CREDENTIALS', 401, 'Credenciais inválidas')

    if (user.totpEnabled && user.totpSecret) {
      const tempToken = generateToken(32)
      tempTokens.set(tempToken, {
        userId: user.id,
        expiresAt: dayjs().add(5, 'minute').toDate(),
      })
      return { requiresTwoFactor: true, tempToken }
    }

    const refreshTokenValue = generateToken(64)

    await authRepository.createRefreshToken({
      userId: user.id,
      tenantId: user.tenantId,
      token: refreshTokenValue,
      expiresAt: dayjs().add(30, 'day').toDate(),
    })

    return { requiresTwoFactor: false, user, refreshToken: refreshTokenValue }
  },

  async loginWithTotp(tempToken: string, code: string) {
    const entry = tempTokens.get(tempToken)
    if (!entry || dayjs().isAfter(dayjs(entry.expiresAt))) {
      throw new AppError('INVALID_TOKEN', 401, 'Token temporário inválido ou expirado')
    }

    const user = await authRepository.findUserById(entry.userId)
    if (!user || !user.totpSecret)
      throw new AppError('INVALID_TOKEN', 401, 'Token temporário inválido')

    const result = verifySync({ token: code, secret: user.totpSecret })
    if (!result.valid) throw new AppError('INVALID_TOTP', 401, 'Código 2FA inválido')

    tempTokens.delete(tempToken)

    const refreshTokenValue = generateToken(64)
    await authRepository.createRefreshToken({
      userId: user.id,
      tenantId: user.tenantId,
      token: refreshTokenValue,
      expiresAt: dayjs().add(30, 'day').toDate(),
    })

    return { user, refreshToken: refreshTokenValue }
  },

  async setupTotp(userId: string) {
    const user = await authRepository.findUserById(userId)
    if (!user) throw new AppError('USER_NOT_FOUND', 404, 'Usuário não encontrado')
    if (user.totpEnabled) throw new AppError('TOTP_ALREADY_ENABLED', 409, '2FA já está ativado')

    const secret = generateSecret()
    const otpauth = generateURI({ issuer: 'MappaHub', label: user.email, secret })
    const qrCode = await QRCode.toDataURL(otpauth)

    await authRepository.updateUser(userId, { totpSecret: secret, updatedAt: new Date() })

    return { secret, qrCode }
  },

  async verifyAndEnableTotp(userId: string, code: string) {
    const user = await authRepository.findUserById(userId)
    if (!user || !user.totpSecret) {
      throw new AppError('TOTP_NOT_SETUP', 400, 'Configure o 2FA primeiro')
    }
    if (user.totpEnabled) throw new AppError('TOTP_ALREADY_ENABLED', 409, '2FA já está ativado')

    const result = verifySync({ token: code, secret: user.totpSecret })
    if (!result.valid) throw new AppError('INVALID_TOTP', 401, 'Código 2FA inválido')

    // Generate 8 recovery codes and store hashed versions
    const plainCodes = Array.from({ length: 8 }, () => {
      const a = generateToken(4).toUpperCase()
      const b = generateToken(4).toUpperCase()
      return `${a}-${b}`
    })

    await db.transaction(async tx => {
      await tx.update(users).set({ totpEnabled: true, updatedAt: new Date() }).where(eq(users.id, userId))
      // Remove any old recovery codes
      await tx.delete(totpRecoveryCodes).where(eq(totpRecoveryCodes.userId, userId))
      // Insert new hashed codes
      const hashed = await Promise.all(plainCodes.map(c => argon2.hash(c)))
      await tx.insert(totpRecoveryCodes).values(hashed.map(codeHash => ({ userId, codeHash })))
    })

    return { recoveryCodes: plainCodes }
  },

  async disableTotp(userId: string, code: string) {
    const user = await authRepository.findUserById(userId)
    if (!user || !user.totpEnabled || !user.totpSecret) {
      throw new AppError('TOTP_NOT_ENABLED', 400, '2FA não está ativado')
    }

    const result = verifySync({ token: code, secret: user.totpSecret })
    if (!result.valid) throw new AppError('INVALID_TOTP', 401, 'Código 2FA inválido')

    await db.transaction(async tx => {
      await tx.update(users).set({ totpSecret: null, totpEnabled: false, updatedAt: new Date() }).where(eq(users.id, userId))
      await tx.delete(totpRecoveryCodes).where(eq(totpRecoveryCodes.userId, userId))
    })
  },

  async loginWithRecoveryCode(tempToken: string, code: string) {
    const entry = tempTokens.get(tempToken)
    if (!entry || dayjs().isAfter(dayjs(entry.expiresAt))) {
      throw new AppError('INVALID_TOKEN', 401, 'Token temporário inválido ou expirado')
    }

    const user = await authRepository.findUserById(entry.userId)
    if (!user) throw new AppError('INVALID_TOKEN', 401, 'Token temporário inválido')

    // Find all unused recovery codes for the user
    const stored = await db
      .select()
      .from(totpRecoveryCodes)
      .where(eq(totpRecoveryCodes.userId, user.id))

    const unused = stored.filter(r => !r.usedAt)
    if (!unused.length) throw new AppError('NO_RECOVERY_CODES', 400, 'Sem códigos de recuperação disponíveis')

    // Try to match the provided code against stored hashes
    let matched: typeof unused[0] | null = null
    for (const row of unused) {
      const valid = await argon2.verify(row.codeHash, code.toUpperCase().replace(/\s/g, ''))
      if (valid) { matched = row; break }
    }

    if (!matched) throw new AppError('INVALID_RECOVERY_CODE', 401, 'Código de recuperação inválido')

    // Mark code as used
    await db.update(totpRecoveryCodes)
      .set({ usedAt: new Date() })
      .where(eq(totpRecoveryCodes.id, matched.id))

    tempTokens.delete(tempToken)

    const refreshTokenValue = generateToken(64)
    await authRepository.createRefreshToken({
      userId: user.id,
      tenantId: user.tenantId,
      token: refreshTokenValue,
      expiresAt: dayjs().add(30, 'day').toDate(),
    })

    return { user, refreshToken: refreshTokenValue }
  },

  async refresh(token: string) {
    const rt = await authRepository.findRefreshToken(token)

    if (!rt || rt.revokedAt || dayjs().isAfter(dayjs(rt.expiresAt))) {
      throw new AppError('INVALID_REFRESH_TOKEN', 401, 'Refresh token inválido ou expirado')
    }

    const user = await authRepository.findUserById(rt.userId)
    if (!user) throw new AppError('USER_NOT_FOUND', 404, 'Usuário não encontrado')

    const newTokenValue = generateToken(64)

    await db.transaction(async tx => {
      await tx
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(eq(refreshTokens.id, rt.id))

      await tx.insert(refreshTokens).values({
        userId: user.id,
        tenantId: user.tenantId,
        token: newTokenValue,
        expiresAt: dayjs().add(30, 'day').toDate(),
      })
    })

    return { user, refreshToken: newTokenValue }
  },

  async logout(token: string) {
    const rt = await authRepository.findRefreshToken(token)
    if (rt && !rt.revokedAt) {
      await authRepository.revokeRefreshToken(rt.id)
    }
  },

  async verifyEmail(token: string) {
    const user = await authRepository.findUserByVerifyToken(token)
    if (!user) throw new AppError('INVALID_TOKEN', 400, 'Token inválido')

    if (user.emailVerifyExpiresAt && dayjs().isAfter(dayjs(user.emailVerifyExpiresAt))) {
      throw new AppError('TOKEN_EXPIRED', 400, 'Token expirado')
    }

    await authRepository.updateUser(user.id, {
      emailVerified: true,
      emailVerifyToken: null,
      emailVerifyExpiresAt: null,
      updatedAt: new Date(),
    })
  },

  async resendVerification(email: string) {
    const user = await authRepository.findUserByEmail(email)
    // Resposta genérica para não vazar se o e-mail existe
    if (!user || user.emailVerified) return

    const newToken = generateToken()

    await authRepository.updateUser(user.id, {
      emailVerifyToken: newToken,
      emailVerifyExpiresAt: dayjs().add(24, 'hour').toDate(),
      updatedAt: new Date(),
    })

    sendMail({
      to: email,
      subject: 'Verifique seu e-mail — MappaHub',
      html: verifyEmailHtml(newToken, env.APP_URL),
    }).catch(err => console.error('[mailer]', err))
  },

  async forgotPassword(email: string) {
    const user = await authRepository.findUserByEmail(email)
    if (!user) return

    const resetToken = generateToken()

    await authRepository.updateUser(user.id, {
      resetPasswordToken: resetToken,
      resetPasswordExpiresAt: dayjs().add(1, 'hour').toDate(),
      updatedAt: new Date(),
    })

    sendMail({
      to: email,
      subject: 'Redefinição de senha — MappaHub',
      html: resetPasswordHtml(resetToken, env.APP_URL),
    }).catch(err => console.error('[mailer]', err))
  },

  async resetPassword({ token, password }: ResetPasswordInput) {
    const user = await authRepository.findUserByResetToken(token)
    if (!user) throw new AppError('INVALID_TOKEN', 400, 'Token inválido ou expirado')

    const passwordHash = await argon2.hash(password)

    await authRepository.updateUser(user.id, {
      passwordHash,
      resetPasswordToken: null,
      resetPasswordExpiresAt: null,
      updatedAt: new Date(),
    })
  },

  async acceptInvite({ token, name, password }: AcceptInviteInput) {
    const user = await authRepository.findUserByVerifyToken(token)
    if (!user) throw new AppError('INVALID_TOKEN', 400, 'Token de convite inválido')

    if (user.emailVerifyExpiresAt && dayjs().isAfter(dayjs(user.emailVerifyExpiresAt))) {
      throw new AppError('TOKEN_EXPIRED', 400, 'Convite expirado')
    }

    const passwordHash = await argon2.hash(password)

    await authRepository.updateUser(user.id, {
      name,
      passwordHash,
      emailVerified: true,
      emailVerifyToken: null,
      emailVerifyExpiresAt: null,
      updatedAt: new Date(),
    })

    return authRepository.findUserById(user.id)
  },

  async sendInvite(inviterName: string, userId: string, tenantId: string) {
    const user = await authRepository.findUserById(userId)
    if (!user || user.tenantId !== tenantId) {
      throw new AppError('USER_NOT_FOUND', 404, 'Usuário não encontrado')
    }

    const inviteToken = generateToken()

    await authRepository.updateUser(user.id, {
      emailVerifyToken: inviteToken,
      emailVerifyExpiresAt: dayjs().add(7, 'day').toDate(),
      updatedAt: new Date(),
    })

    sendMail({
      to: user.email,
      subject: `${inviterName} convidou você para o MappaHub`,
      html: inviteEmailHtml(inviterName, inviteToken, env.APP_URL),
    }).catch(err => console.error('[mailer]', err))
  },
}
