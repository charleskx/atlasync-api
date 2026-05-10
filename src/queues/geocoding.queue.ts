import { Queue } from 'bullmq'
import { redis } from '../config/redis'

export type GeocodingJobPayload = {
  partnerId: string
  address: string
  tenantId: string
}

export const geocodingQueue = new Queue<GeocodingJobPayload>('geocoding', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 3000 },
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 100 },
  },
})
