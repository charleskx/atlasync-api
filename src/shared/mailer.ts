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
<p>Para continuar usando o AtlaSync sem interrupção, assine um dos nossos planos:</p>
<p><a href="${appUrl}/billing">Ver planos e assinar</a></p>
<p>Se tiver dúvidas, responda este e-mail.</p>`
}

export function inviteEmailHtml(inviterName: string, token: string, appUrl: string): string {
  const link = `${appUrl}/auth/accept-invite?token=${token}`
  return `<p><strong>${inviterName}</strong> convidou você para o AtlaSync.</p>
<p>Clique no link para definir sua senha e acessar a plataforma:</p>
<p><a href="${link}">${link}</a></p>
<p>Válido por 7 dias.</p>`
}

export function importDoneHtml(opts: {
  uploaderName: string
  fileName: string
  totalRows: number
  created: number
  updated: number
  removed: number
  failed: number
  appUrl: string
}): string {
  const { uploaderName, fileName, totalRows, created, updated, removed, failed, appUrl } = opts
  const modeLabel = removed > 0 ? 'substituição total' : 'incremental'
  return `
<p>Olá!</p>
<p>A importação do arquivo <strong>${fileName}</strong> iniciada por <strong>${uploaderName}</strong> foi concluída com sucesso.</p>
<table style="border-collapse:collapse;width:100%;max-width:400px;margin:16px 0">
  <tr style="background:#f5f5f5">
    <td style="padding:8px 12px;font-weight:600">Total de linhas</td>
    <td style="padding:8px 12px">${totalRows}</td>
  </tr>
  <tr>
    <td style="padding:8px 12px;font-weight:600">Criados</td>
    <td style="padding:8px 12px;color:#16a34a">${created}</td>
  </tr>
  <tr style="background:#f5f5f5">
    <td style="padding:8px 12px;font-weight:600">Atualizados</td>
    <td style="padding:8px 12px">${updated}</td>
  </tr>
  ${removed > 0 ? `<tr>
    <td style="padding:8px 12px;font-weight:600">Removidos</td>
    <td style="padding:8px 12px;color:#dc2626">${removed}</td>
  </tr>` : ''}
  ${failed > 0 ? `<tr style="background:#f5f5f5">
    <td style="padding:8px 12px;font-weight:600">Erros</td>
    <td style="padding:8px 12px;color:#dc2626">${failed}</td>
  </tr>` : ''}
  <tr ${removed > 0 || failed > 0 ? '' : 'style="background:#f5f5f5"'}>
    <td style="padding:8px 12px;font-weight:600">Modo</td>
    <td style="padding:8px 12px;text-transform:capitalize">${modeLabel}</td>
  </tr>
</table>
<p><a href="${appUrl}/import">Ver detalhes da importação</a></p>
`
}
