import { env } from '../../config/env'
import { importDoneHtml, sendMail } from '../../shared/mailer'
import { AppError } from '../../shared/errors'
import { userRepository } from '../user/user.repository'
import { ticketsRepository } from './tickets.repository'

type Requester = { id: string; role: string; tenantId: string }

function ticketReplyHtml(opts: {
  ticketTitle: string
  replyBody: string
  status: string
  appUrl: string
}): string {
  const statusLabel: Record<string, string> = {
    open: 'Aberto',
    in_progress: 'Em andamento',
    resolved: 'Resolvido',
  }
  return `
<p>Seu ticket recebeu uma atualização da equipe AtlaSync.</p>
<p><strong>Ticket:</strong> ${opts.ticketTitle}</p>
<p><strong>Status atual:</strong> ${statusLabel[opts.status] ?? opts.status}</p>
<blockquote style="border-left:3px solid #6366f1;padding:8px 16px;margin:16px 0;color:#555">
  ${opts.replyBody.replace(/\n/g, '<br>')}
</blockquote>
<p><a href="${opts.appUrl}/support">Ver ticket completo</a></p>
`
}

function ticketResolvedHtml(opts: { ticketTitle: string; appUrl: string }): string {
  return `
<p>Seu ticket foi marcado como <strong>resolvido</strong>.</p>
<p><strong>Ticket:</strong> ${opts.ticketTitle}</p>
<p>Se o problema não foi solucionado, você pode abrir um novo ticket a qualquer momento.</p>
<p><a href="${opts.appUrl}/support">Ver tickets</a></p>
`
}

export const ticketsService = {
  async create(title: string, body: string, requester: Requester) {
    return ticketsRepository.create(requester.tenantId, requester.id, title, body)
  },

  async list(requester: Requester) {
    return ticketsRepository.findAll(requester.tenantId)
  },

  async listAll(requester: Requester) {
    if (requester.role !== 'super_admin') throw new AppError('FORBIDDEN', 403, 'Sem permissão')
    return ticketsRepository.findAllGlobal()
  },

  async getDetail(id: string, requester: Requester) {
    const ticket = await ticketsRepository.findById(id)
    if (!ticket) throw new AppError('TICKET_NOT_FOUND', 404, 'Ticket não encontrado')
    if (requester.role !== 'super_admin' && ticket.tenantId !== requester.tenantId) {
      throw new AppError('FORBIDDEN', 403, 'Sem permissão')
    }
    const messages = await ticketsRepository.getMessages(id)
    return { ...ticket, messages }
  },

  async reply(id: string, body: string, requester: Requester) {
    const ticket = await ticketsRepository.findById(id)
    if (!ticket) throw new AppError('TICKET_NOT_FOUND', 404, 'Ticket não encontrado')

    const isStaff = requester.role === 'super_admin'
    if (!isStaff && ticket.tenantId !== requester.tenantId) {
      throw new AppError('FORBIDDEN', 403, 'Sem permissão')
    }

    const message = await ticketsRepository.addMessage(id, requester.id, body, isStaff)

    // If staff replied, auto-move to in_progress and send email notifications
    if (isStaff && ticket.status === 'open') {
      await ticketsRepository.updateStatus(id, 'in_progress')
    }

    if (isStaff) {
      await sendTicketUpdateEmails({
        tenantId: ticket.tenantId,
        ticketUserId: ticket.userId,
        ticketTitle: ticket.title,
        replyBody: body,
        status: ticket.status === 'open' ? 'in_progress' : ticket.status,
      })
    }

    return message
  },

  async updateStatus(id: string, status: string, requester: Requester) {
    if (requester.role !== 'super_admin') throw new AppError('FORBIDDEN', 403, 'Sem permissão')
    const ticket = await ticketsRepository.findById(id)
    if (!ticket) throw new AppError('TICKET_NOT_FOUND', 404, 'Ticket não encontrado')

    const updated = await ticketsRepository.updateStatus(id, status)

    if (status === 'resolved') {
      await sendTicketResolvedEmails({ tenantId: ticket.tenantId, ticketUserId: ticket.userId, ticketTitle: ticket.title })
    }

    return updated
  },
}

async function sendTicketUpdateEmails(opts: {
  tenantId: string
  ticketUserId: string
  ticketTitle: string
  replyBody: string
  status: string
}) {
  try {
    const appUrl = env.APP_URL ?? 'https://app.atlasync.com.br'
    const html = ticketReplyHtml({ ticketTitle: opts.ticketTitle, replyBody: opts.replyBody, status: opts.status, appUrl })
    const subject = `💬 Novo comentário no ticket — ${opts.ticketTitle}`

    const [creator, owner] = await Promise.all([
      userRepository.findById(opts.ticketUserId, opts.tenantId),
      userRepository.findOwner(opts.tenantId),
    ])

    if (creator) await sendMail({ to: creator.email, subject, html })
    if (owner && owner.id !== creator?.id) await sendMail({ to: owner.email, subject, html })
  } catch (err) {
    console.error('[tickets] Falha ao enviar e-mail de resposta:', err)
  }
}

async function sendTicketResolvedEmails(opts: {
  tenantId: string
  ticketUserId: string
  ticketTitle: string
}) {
  try {
    const appUrl = env.APP_URL ?? 'https://app.atlasync.com.br'
    const html = ticketResolvedHtml({ ticketTitle: opts.ticketTitle, appUrl })
    const subject = `✅ Ticket resolvido — ${opts.ticketTitle}`

    const [creator, owner] = await Promise.all([
      userRepository.findById(opts.ticketUserId, opts.tenantId),
      userRepository.findOwner(opts.tenantId),
    ])

    if (creator) await sendMail({ to: creator.email, subject, html })
    if (owner && owner.id !== creator?.id) await sendMail({ to: owner.email, subject, html })
  } catch (err) {
    console.error('[tickets] Falha ao enviar e-mail de resolução:', err)
  }
}
