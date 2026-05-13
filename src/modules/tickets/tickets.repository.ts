import { and, asc, desc, eq } from 'drizzle-orm'
import { db } from '../../config/database'
import { ticketMessages, tickets, users } from '../../db/schema'

export const ticketsRepository = {
  async create(tenantId: string, userId: string, title: string, body: string) {
    const [ticket] = await db
      .insert(tickets)
      .values({ tenantId, userId, title, body })
      .returning()
    return ticket
  },

  async findAll(tenantId: string) {
    return db
      .select({
        id: tickets.id,
        title: tickets.title,
        body: tickets.body,
        status: tickets.status,
        createdAt: tickets.createdAt,
        updatedAt: tickets.updatedAt,
        userName: users.name,
        userEmail: users.email,
      })
      .from(tickets)
      .leftJoin(users, eq(tickets.userId, users.id))
      .where(eq(tickets.tenantId, tenantId))
      .orderBy(desc(tickets.updatedAt))
  },

  async findAllGlobal() {
    return db
      .select({
        id: tickets.id,
        title: tickets.title,
        body: tickets.body,
        status: tickets.status,
        tenantId: tickets.tenantId,
        createdAt: tickets.createdAt,
        updatedAt: tickets.updatedAt,
        userName: users.name,
        userEmail: users.email,
      })
      .from(tickets)
      .leftJoin(users, eq(tickets.userId, users.id))
      .orderBy(desc(tickets.updatedAt))
  },

  async findById(id: string) {
    return db.query.tickets.findFirst({ where: eq(tickets.id, id) })
  },

  async updateStatus(id: string, status: string) {
    const [updated] = await db
      .update(tickets)
      .set({ status, updatedAt: new Date() })
      .where(eq(tickets.id, id))
      .returning()
    return updated
  },

  async addMessage(ticketId: string, userId: string, body: string, isStaff: boolean) {
    const [msg] = await db
      .insert(ticketMessages)
      .values({ ticketId, userId, body, isStaff })
      .returning()

    // Bump ticket's updatedAt so it bubbles to top of list
    await db
      .update(tickets)
      .set({ updatedAt: new Date() })
      .where(eq(tickets.id, ticketId))

    return msg
  },

  async getMessages(ticketId: string) {
    return db
      .select({
        id: ticketMessages.id,
        body: ticketMessages.body,
        isStaff: ticketMessages.isStaff,
        createdAt: ticketMessages.createdAt,
        userName: users.name,
        userId: ticketMessages.userId,
      })
      .from(ticketMessages)
      .leftJoin(users, eq(ticketMessages.userId, users.id))
      .where(eq(ticketMessages.ticketId, ticketId))
      .orderBy(asc(ticketMessages.createdAt))
  },

  // For notifications: staff replies to this tenant's tickets in last 7 days
  async getRecentStaffReplies(tenantId: string) {
    return db
      .select({
        id: ticketMessages.id,
        ticketId: ticketMessages.ticketId,
        ticketTitle: tickets.title,
        createdAt: ticketMessages.createdAt,
      })
      .from(ticketMessages)
      .innerJoin(tickets, eq(ticketMessages.ticketId, tickets.id))
      .where(
        and(
          eq(tickets.tenantId, tenantId),
          eq(ticketMessages.isStaff, true),
        ),
      )
      .orderBy(desc(ticketMessages.createdAt))
      .limit(5)
  },

  // For super admin notifications: count of open tickets
  async countOpenTickets() {
    const rows = await db
      .select({ id: tickets.id, title: tickets.title, createdAt: tickets.createdAt })
      .from(tickets)
      .where(eq(tickets.status, 'open'))
      .orderBy(desc(tickets.createdAt))
      .limit(5)
    return rows
  },
}
