import { Worker } from 'bullmq'
import { eq } from 'drizzle-orm'
import { db } from '../../config/database'
import { redis } from '../../config/redis'
import { tenantSettings } from '../../db/schema'
import type { GeocodingJobPayload } from '../../queues/geocoding.queue'
import { partnerRepository } from '../partner/partner.repository'
import { geocodeAddress } from './geocoding.service'

export function createGeocodingWorker() {
  return new Worker<GeocodingJobPayload>(
    'geocoding',
    async job => {
      const { partnerId, address, tenantId } = job.data

      const settings = await db.query.tenantSettings.findFirst({
        where: eq(tenantSettings.tenantId, tenantId),
        columns: { googleMapsApiKey: true },
      })

      const apiKey = settings?.googleMapsApiKey
      if (!apiKey) {
        await partnerRepository.updateGeocode(partnerId, null, 'failed')
        return
      }

      const result = await geocodeAddress(address, apiKey)
      await partnerRepository.updateGeocode(partnerId, result, result ? 'done' : 'failed')
    },
    {
      connection: redis,
      concurrency: 5,
    },
  )
}
