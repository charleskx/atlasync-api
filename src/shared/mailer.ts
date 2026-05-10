import { env } from '../config/env'

interface MailOptions {
  to: string
  subject: string
  html: string
}

export async function sendMail(options: MailOptions): Promise<void> {
  if (env.NODE_ENV !== 'production') {
    console.log('\n📧 [MAILER DEV]')
    console.log(`  To: ${options.to}`)
    console.log(`  Subject: ${options.subject}`)
    console.log(`  Body: ${options.html}\n`)
    return
  }
  // TODO: implementar SMTP em produção
}

export function verifyEmailHtml(token: string, appUrl: string): string {
  const link = `${appUrl}/auth/verify?token=${token}`
  return `<p>Clique no link para verificar seu e-mail:</p>
<p><a href="${link}">${link}</a></p>
<p>Válido por 24 horas.</p>`
}

export function resetPasswordHtml(token: string, appUrl: string): string {
  const link = `${appUrl}/auth/reset-password?token=${token}`
  return `<p>Clique no link para redefinir sua senha:</p>
<p><a href="${link}">${link}</a></p>
<p>Válido por 1 hora. Se não solicitou, ignore este e-mail.</p>`
}

export function trialExpiringHtml(tenantName: string, daysLeft: number, appUrl: string): string {
  const dayLabel = daysLeft === 1 ? 'dia' : 'dias'
  return `<p>Olá, <strong>${tenantName}</strong>!</p>
<p>Seu período de teste gratuito expira em <strong>${daysLeft} ${dayLabel}</strong>.</p>
<p>Para continuar usando o Atlasync sem interrupção, assine um dos nossos planos:</p>
<p><a href="${appUrl}/billing">Ver planos e assinar</a></p>
<p>Se tiver dúvidas, responda este e-mail.</p>`
}

export function inviteEmailHtml(inviterName: string, token: string, appUrl: string): string {
  const link = `${appUrl}/auth/accept-invite?token=${token}`
  return `<p><strong>${inviterName}</strong> convidou você para o Atlasync.</p>
<p>Clique no link para definir sua senha e acessar a plataforma:</p>
<p><a href="${link}">${link}</a></p>
<p>Válido por 7 dias.</p>`
}
