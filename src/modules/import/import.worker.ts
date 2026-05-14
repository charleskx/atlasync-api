import { Worker } from 'bullmq'
import { eq } from 'drizzle-orm'
import { redis } from '../../config/redis'
import { env } from '../../config/env'
import { db } from '../../config/database'
import { subscriptions } from '../../db/schema'
import { geocodingQueue } from '../../queues/geocoding.queue'
import type { ImportJobPayload } from '../../queues/import.queue'
import { importDoneHtml, sendMail } from '../../shared/mailer'
import { partnerRepository } from '../partner/partner.repository'
import { pinTypeRepository } from '../pin-type/pin-type.repository'
import { userRepository } from '../user/user.repository'
import { importRepository } from './import.repository'

async function getGeocodingPriority(tenantId: string): Promise<number> {
  const [sub] = await db
    .select({ planType: subscriptions.planType })
    .from(subscriptions)
    .where(eq(subscriptions.tenantId, tenantId))
    .limit(1)
  return sub?.planType === 'annual' ? 1 : 2
}

const PROGRESS_BATCH = 10

// Cache de nome → id por tenant para evitar consultas repetidas por linha
async function buildPinTypeCache(tenantId: string): Promise<Map<string, string>> {
  const all = await pinTypeRepository.findAll(tenantId)
  return new Map(all.map(pt => [pt.name.toLowerCase(), pt.id]))
}

export function createImportWorker() {
  return new Worker<ImportJobPayload>(
    'import',
    async job => {
      const { jobId, tenantId, rows, mode } = job.data

      const [, geocodingPriority] = await Promise.all([
        importRepository.update(jobId, {
          status: 'processing',
          mode,
          totalRows: rows.length,
          processedRows: 0,
          startedAt: new Date(),
        }),
        getGeocodingPriority(tenantId),
      ])

      let created = 0
      let updated = 0
      let failed = 0
      const errorLog: Array<{ row: number; message: string }> = []
      const processedKeys = new Set<string>()

      const pinTypeCache = await buildPinTypeCache(tenantId)

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        try {
          const pinTypeId = row.pinType
            ? (pinTypeCache.get(row.pinType.toLowerCase()) ?? null)
            : null

          const existing = await partnerRepository.findByExternalKey(row.externalKey, tenantId)

          if (existing) {
            await partnerRepository.update(existing.id, tenantId, {
              name: row.name,
              address: row.address,
              pinTypeId: pinTypeId ?? undefined,
              visibility: row.visibility as 'public' | 'internal' | undefined,
              dynamicValues: row.dynamicValues,
            })
            if (row.address !== existing.address) {
              await geocodingQueue.add('geocode', {
                partnerId: existing.id,
                address: row.address,
                tenantId,
              }, { priority: geocodingPriority })
            }
            updated++
          } else {
            const partner = await partnerRepository.create(tenantId, {
              name: row.name,
              address: row.address,
              pinTypeId: pinTypeId ?? undefined,
              visibility: (row.visibility as 'public' | 'internal') ?? 'public',
              dynamicValues: row.dynamicValues,
              source: 'import',
              externalKey: row.externalKey,
              importJobId: jobId,
            })
            await geocodingQueue.add('geocode', {
              partnerId: partner.id,
              address: partner.address,
              tenantId,
            }, { priority: geocodingPriority })
            created++
          }

          processedKeys.add(row.externalKey)
        } catch (err) {
          failed++
          errorLog.push({ row: i + 2, message: String(err) })
        }

        if ((i + 1) % PROGRESS_BATCH === 0 || i === rows.length - 1) {
          await importRepository.update(jobId, { processedRows: i + 1 })
        }
      }

      let removed = 0
      if (mode !== 'incremental') {
        removed = await softDeleteStale(tenantId, processedKeys, jobId)
      }

      await importRepository.update(jobId, {
        status: 'done',
        created,
        updated,
        removed,
        failed,
        processedRows: rows.length,
        errorLog: errorLog.length > 0 ? errorLog : null,
        finishedAt: new Date(),
      })

      // Send email notifications to uploader + owner
      await sendImportDoneEmails({ jobId, tenantId, created, updated, removed, failed, totalRows: rows.length })
    },
    {
      connection: redis,
      concurrency: 2,
    },
  )
}

async function sendImportDoneEmails(opts: {
  jobId: string
  tenantId: string
  created: number
  updated: number
  removed: number
  failed: number
  totalRows: number
}) {
  try {
    const { jobId, tenantId, created, updated, removed, failed, totalRows } = opts

    const [job, owner] = await Promise.all([
      importRepository.findByIdGlobal(jobId),
      userRepository.findOwner(tenantId),
    ])

    if (!job) return

    const uploader = await userRepository.findById(job.userId, tenantId)
    if (!uploader) return

    const appUrl = env.APP_URL ?? 'https://app.atlasync.com.br'
    const html = importDoneHtml({
      uploaderName: uploader.name,
      fileName: job.fileName ?? 'planilha',
      totalRows,
      created,
      updated,
      removed,
      failed,
      appUrl,
    })

    const subject = `✅ Importação concluída — ${job.fileName ?? 'planilha'}`

    // Always notify the uploader
    await sendMail({ to: uploader.email, subject, html })

    // Notify the owner if different from uploader
    if (owner && owner.id !== uploader.id) {
      await sendMail({ to: owner.email, subject, html })
    }
  } catch (err) {
    // Email failure must never break the import job itself
    console.error('[import-worker] Falha ao enviar e-mail de conclusão:', err)
  }
}

async function softDeleteStale(tenantId: string, processedKeys: Set<string>, jobId: string): Promise<number> {
  const existingKeys = await partnerRepository.findAllImportedKeys(tenantId)
  const toDelete = existingKeys.filter(k => !processedKeys.has(k))

  // softDeleteByExternalKeys recebe as chaves a PRESERVAR (excludeKeys = NOT IN).
  // Passamos processedKeys para que apenas os registros ausentes da nova planilha sejam deletados.
  await partnerRepository.softDeleteByExternalKeys(tenantId, Array.from(processedKeys), jobId)

  return toDelete.length
}
