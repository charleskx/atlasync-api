import { type GeocodedResult, getFromCache, setInCache } from './geocoding.cache'

const BASE_URL = 'https://nominatim.openstreetmap.org/search'

export type FullGeoResult = GeocodedResult & { city?: string; state?: string }

type NominatimAddress = {
  city?: string
  town?: string
  village?: string
  municipality?: string
  county?: string
  state?: string
}

type NominatimResult = {
  lat: string
  lon: string
  address: NominatimAddress
}

export async function geocodeAddress(address: string): Promise<FullGeoResult | null> {
  const cached = await getFromCache(address)
  if (cached) return cached

  const params = new URLSearchParams({
    q: address,
    format: 'json',
    addressdetails: '1',
    limit: '1',
    'accept-language': 'pt-BR',
  })

  const res = await fetch(`${BASE_URL}?${params}`, {
    headers: {
      'User-Agent': 'AtlaSync/1.0 (https://atlasync.com)',
    },
  })

  // HTTP error → throw so the worker catch block records it as 'failed'
  if (!res.ok) {
    throw new Error(`Nominatim retornou HTTP ${res.status} (${res.statusText}) para o endereço "${address}"`)
  }

  const data = (await res.json()) as NominatimResult[]

  // Empty result → return null so worker records it as 'no_results'
  if (!data[0]) {
    throw new Error(`Nominatim não encontrou resultados para o endereço "${address}"`)
  }

  const { lat, lon, address: addr } = data[0]
  const city = addr.city ?? addr.town ?? addr.village ?? addr.municipality ?? addr.county
  const state = addr.state

  const result: FullGeoResult = { lat: Number(lat), lng: Number(lon), city, state }
  await setInCache(address, result)
  return result
}
