import { Worker } from 'bullmq'
import { redis } from '../../config/redis'
import type { GeocodingJobPayload } from '../../queues/geocoding.queue'
import { partnerRepository } from '../partner/partner.repository'
import { geocodeAddress } from './geocoding.service'

export function createGeocodingWorker() {
  return new Worker<GeocodingJobPayload>(
    'geocoding',
    async job => {
      const { partnerId, address } = job.data

      const result = await geocodeAddress(address)
      await partnerRepository.updateGeocode(partnerId, result, result ? 'done' : 'failed')
    },
    {
      connection: redis,
      concurrency: 1,
      limiter: { max: 1, duration: 1000 }, // Nominatim: max 1 req/s
    },
  )
}
