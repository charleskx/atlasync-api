import { type GeocodedResult, getFromCache, setInCache } from './geocoding.cache'

const BASE_URL = 'https://maps.googleapis.com/maps/api/geocode/json'

export async function geocodeAddress(
  address: string,
  apiKey: string,
): Promise<GeocodedResult | null> {
  const cached = await getFromCache(address)
  if (cached) return cached

  const url = `${BASE_URL}?address=${encodeURIComponent(address)}&key=${apiKey}`
  const res = await fetch(url)
  if (!res.ok) return null

  const data = (await res.json()) as {
    status: string
    results: Array<{ geometry: { location: { lat: number; lng: number } } }>
  }

  if (data.status !== 'OK' || !data.results[0]) return null

  const { lat, lng } = data.results[0].geometry.location
  const result: GeocodedResult = { lat, lng }
  await setInCache(address, result)
  return result
}
