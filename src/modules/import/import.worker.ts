import { Worker } from 'bullmq'
import { redis } from '../../config/redis'
import { geocodingQueue } from '../../queues/geocoding.queue'
import type { ImportJobPayload } from '../../queues/import.queue'
import { partnerRepository } from '../partner/partner.repository'
import { importRepository } from './import.repository'

export function createImportWorker() {
  return new Worker<ImportJobPayload>(
    'import',
    async job => {
      const { jobId, tenantId, rows } = job.data

      await importRepository.update(jobId, {
        status: 'processing',
        totalRows: rows.length,
        startedAt: new Date(),
      })

      let created = 0
      let updated = 0
      let failed = 0
      const errorLog: Array<{ row: number; message: string }> = []
      const processedKeys = new Set<string>()

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        try {
          const existing = await partnerRepository.findByExternalKey(row.externalKey, tenantId)

          if (existing) {
            await partnerRepository.update(existing.id, tenantId, {
              name: row.name,
              address: row.address,
              pinType: row.pinType,
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
              pinType: row.pinType,
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
      }

      // Soft-delete imported partners not present in this sheet
      const removed = await softDeleteStale(tenantId, processedKeys)

      await importRepository.update(jobId, {
        status: 'done',
        created,
        updated,
        removed,
        failed,
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
    await partnerRepository.softDeleteByExternalKeys(tenantId, Array.from(processedKeys))
  }

  return toDelete.length
}
