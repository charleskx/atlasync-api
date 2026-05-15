import { type GeocodedResult, getFromCache, setInCache } from './geocoding.cache'

const NOMINATIM = 'https://nominatim.openstreetmap.org/search'
const UA = 'MappaHub/1.0 (https://atlasync.com)'

export type FullGeoResult = GeocodedResult & { city?: string; state?: string }

type NominatimAddress = {
  city?: string; town?: string; village?: string
  municipality?: string; county?: string; state?: string
}
type NominatimResult = { lat: string; lon: string; address: NominatimAddress }

export async function geocodeAddress(address: string): Promise<FullGeoResult | null> {
  const cached = await getFromCache(address)
  if (cached) return cached

  const params = new URLSearchParams({
    q: address,
    format: 'json',
    addressdetails: '1',
    limit: '1',
    'accept-language': 'pt-BR',
    countrycodes: 'br',
  })

  const res = await fetch(`${NOMINATIM}?${params}`, { headers: { 'User-Agent': UA } })

  if (!res.ok) {
    throw new Error(`Nominatim retornou HTTP ${res.status} (${res.statusText}) para o endereço "${address}"`)
  }

  const data = (await res.json()) as NominatimResult[]

  if (!data[0]) {
    throw new Error(`Nominatim não encontrou resultados para o endereço "${address}"`)
  }

  const { lat, lon, address: addr } = data[0]
  const city = addr.city ?? addr.town ?? addr.village ?? addr.municipality ?? addr.county

  const result: FullGeoResult = { lat: Number(lat), lng: Number(lon), city, state: addr.state }
  await setInCache(address, result)
  return result
}
