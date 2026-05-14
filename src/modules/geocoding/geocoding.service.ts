import { type GeocodedResult, getFromCache, setInCache } from './geocoding.cache'

const NOMINATIM = 'https://nominatim.openstreetmap.org/search'
const VIACEP = 'https://viacep.com.br/ws'
const UA = 'MappaHub/1.0 (https://atlasync.com)'
const CEP_RE = /^\d{5}-?\d{3}$/

export type FullGeoResult = GeocodedResult & { city?: string; state?: string }

type NominatimAddress = {
  city?: string; town?: string; village?: string
  municipality?: string; county?: string; state?: string
}
type NominatimResult = { lat: string; lon: string; address: NominatimAddress }

type ViaCepResult = {
  erro?: boolean
  logradouro?: string; bairro?: string
  localidade?: string; uf?: string; estado?: string
}

async function nominatim(q: string): Promise<FullGeoResult | null> {
  const params = new URLSearchParams({
    q, format: 'json', addressdetails: '1', limit: '1',
    'accept-language': 'pt-BR', countrycodes: 'br',
  })
  const res = await fetch(`${NOMINATIM}?${params}`, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`)
  const data = (await res.json()) as NominatimResult[]
  if (!data[0]) return null
  const { lat, lon, address: addr } = data[0]
  const city = addr.city ?? addr.town ?? addr.village ?? addr.municipality ?? addr.county
  return { lat: Number(lat), lng: Number(lon), city, state: addr.state }
}

async function resolveCep(cep: string): Promise<string[]> {
  const res = await fetch(`${VIACEP}/${cep.replace('-', '')}/json/`, { headers: { 'User-Agent': UA } })
  if (!res.ok) return []
  const d = (await res.json()) as ViaCepResult
  if (d.erro) return []
  const queries: string[] = []
  if (d.logradouro && d.localidade && d.uf)
    queries.push(`${d.logradouro}, ${d.localidade}, ${d.uf}, Brasil`)
  if (d.localidade && d.uf)
    queries.push(`${d.localidade}, ${d.uf}, Brasil`)
  if (d.uf)
    queries.push(`${d.estado ?? d.uf}, Brasil`)
  return queries
}

export async function geocodeAddress(address: string): Promise<FullGeoResult | null> {
  const cached = await getFromCache(address)
  if (cached) return cached

  const isCep = CEP_RE.test(address.trim())
  const queries = isCep ? await resolveCep(address.trim()) : [address]

  if (!queries.length) throw new Error(`CEP "${address}" não encontrado na base dos Correios`)

  for (const q of queries) {
    const result = await nominatim(q)
    if (result) {
      await setInCache(address, result)
      return result
    }
  }

  throw new Error(`Nominatim não encontrou resultados para "${address}"`)
}
