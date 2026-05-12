import { Worker } from 'bullmq'
import { redis } from '../../config/redis'
import { geocodingQueue } from '../../queues/geocoding.queue'
import type { ImportJobPayload } from '../../queues/import.queue'
import { partnerRepository } from '../partner/partner.repository'
import { pinTypeRepository } from '../pin-type/pin-type.repository'
import { importRepository } from './import.repository'

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

      await importRepository.update(jobId, {
        status: 'processing',
        mode,
        totalRows: rows.length,
        processedRows: 0,
        startedAt: new Date(),
      })

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
              })
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
            })
            await geocodingQueue.add('geocode', {
              partnerId: partner.id,
              address: partner.address,
              tenantId,
            })
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
        removed = await softDeleteStale(tenantId, processedKeys)
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
    },
    {
      connection: redis,
      concurrency: 2,
    },
  )
}

async function softDeleteStale(tenantId: string, processedKeys: Set<string>): Promise<number> {
  const existingKeys = await partnerRepository.findAllImportedKeys(tenantId)
  const toDelete = existingKeys.filter(k => !processedKeys.has(k))

  if (toDelete.length > 0) {
    await partnerRepository.softDeleteByExternalKeys(tenantId, toDelete)
  }

  return toDelete.length
}
