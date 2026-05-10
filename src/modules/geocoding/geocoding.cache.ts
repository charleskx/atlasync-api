import { redis } from '../../config/redis'

const TTL_SECONDS = 60 * 60 * 24 * 30 // 30 days

function cacheKey(address: string) {
  return `geocode:${address.toLowerCase().trim()}`
}

export type GeocodedResult = { lat: number; lng: number }

export async function getFromCache(address: string): Promise<GeocodedResult | null> {
  const val = await redis.get(cacheKey(address))
  if (!val) return null
  return JSON.parse(val) as GeocodedResult
}

export async function setInCache(address: string, result: GeocodedResult): Promise<void> {
  await redis.set(cacheKey(address), JSON.stringify(result), 'EX', TTL_SECONDS)
}
