import { and, desc, eq } from 'drizzle-orm'
import { db } from '../../config/database'
import { importJobs } from '../../db/schema'

type JobUpdate = {
  status?: string
  totalRows?: number
  created?: number
  updated?: number
  removed?: number
  failed?: number
  errorLog?: unknown
  startedAt?: Date
  finishedAt?: Date
}

export const importRepository = {
  async create(tenantId: string, userId: string, fileName: string) {
    const [job] = await db
      .insert(importJobs)
      .values({ tenantId, userId, fileName, status: 'queued' })
      .returning()
    return job
  },

  async update(id: string, data: JobUpdate) {
    const [updated] = await db.update(importJobs).set(data).where(eq(importJobs.id, id)).returning()
    return updated
  },

  async findById(id: string, tenantId: string) {
    return db.query.importJobs.findFirst({
      where: and(eq(importJobs.id, id), eq(importJobs.tenantId, tenantId)),
    })
  },

  async findAll(tenantId: string) {
    return db.query.importJobs.findMany({
      where: eq(importJobs.tenantId, tenantId),
      orderBy: (j, { desc: d }) => [d(j.createdAt)],
      limit: 50,
    })
  },
}
