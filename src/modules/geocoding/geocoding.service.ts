import { type GeocodedResult, getFromCache, setInCache } from './geocoding.cache'

const BASE_URL = 'https://maps.googleapis.com/maps/api/geocode/json'

export type FullGeoResult = GeocodedResult & { city?: string; state?: string }

type GoogleComponent = { long_name: string; short_name: string; types: string[] }

export async function geocodeAddress(
  address: string,
  apiKey: string,
): Promise<FullGeoResult | null> {
  const cached = await getFromCache(address)
  if (cached) return cached

  const url = `${BASE_URL}?address=${encodeURIComponent(address)}&key=${apiKey}`
  const res = await fetch(url)
  if (!res.ok) return null

  const data = (await res.json()) as {
    status: string
    results: Array<{
      geometry: { location: { lat: number; lng: number } }
      address_components: GoogleComponent[]
    }>
  }

  if (data.status !== 'OK' || !data.results[0]) return null

  const { lat, lng } = data.results[0].geometry.location
  const components = data.results[0].address_components

  const city = components.find(c => c.types.includes('locality'))?.long_name
  const state = components.find(c => c.types.includes('administrative_area_level_1'))?.short_name

  const result: FullGeoResult = { lat, lng, city, state }
  await setInCache(address, result)
  return result
}
