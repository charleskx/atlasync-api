import type { FastifyInstance } from 'fastify'
import { env } from '../../config/env'
import { authenticate } from '../../middlewares/authenticate'
import { AppError } from '../../shared/errors'

type AutocompleteResult = {
  placeId: string
  description: string
  mainText: string
  secondaryText: string
}

type PlaceDetails = {
  placeId: string
  address: string
  lat: number
  lng: number
  city?: string
  state?: string
}

type GooglePrediction = {
  place_id: string
  description: string
  structured_formatting: { main_text: string; secondary_text: string }
}

type GoogleAddressComponent = { long_name: string; types: string[] }

function getComponent(components: GoogleAddressComponent[], type: string) {
  return components.find(c => c.types.includes(type))?.long_name
}

export async function placesRoutes(app: FastifyInstance) {
  app.get('/autocomplete', { preHandler: [authenticate] }, async req => {
    if (!env.GOOGLE_MAPS_API_KEY) {
      throw new AppError('PLACES_DISABLED', 503, 'Google Places não está configurado')
    }

    const { input, sessiontoken } = req.query as { input?: string; sessiontoken?: string }
    if (!input || input.trim().length < 3) {
      throw new AppError('VALIDATION_ERROR', 400, 'input deve ter ao menos 3 caracteres')
    }

    const params = new URLSearchParams({
      input: input.trim(),
      key: env.GOOGLE_MAPS_API_KEY,
      language: 'pt-BR',
      components: 'country:br',
      types: 'address',
    })
    if (sessiontoken) params.set('sessiontoken', sessiontoken)

    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params}`,
    )
    if (!res.ok) throw new AppError('PLACES_ERROR', 502, 'Erro ao consultar Google Places')

    const data = (await res.json()) as { status: string; predictions: GooglePrediction[] }

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error(`[Places] Google status=${data.status} para input: "${input}"`)
      throw new AppError('PLACES_ERROR', 502, `Google Places retornou: ${data.status}`)
    }

    const results: AutocompleteResult[] = (data.predictions ?? []).map(p => ({
      placeId: p.place_id,
      description: p.description,
      mainText: p.structured_formatting.main_text,
      secondaryText: p.structured_formatting.secondary_text,
    }))

    return { results }
  })

  app.get('/details/:placeId', { preHandler: [authenticate] }, async req => {
    if (!env.GOOGLE_MAPS_API_KEY) {
      throw new AppError('PLACES_DISABLED', 503, 'Google Places não está configurado')
    }

    const { placeId } = req.params as { placeId: string }
    const { sessiontoken } = req.query as { sessiontoken?: string }

    const params = new URLSearchParams({
      place_id: placeId,
      key: env.GOOGLE_MAPS_API_KEY,
      language: 'pt-BR',
      fields: 'geometry,formatted_address,address_components',
    })
    if (sessiontoken) params.set('sessiontoken', sessiontoken)

    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?${params}`,
    )
    if (!res.ok) throw new AppError('PLACES_ERROR', 502, 'Erro ao consultar Google Places')

    const data = (await res.json()) as {
      status: string
      result: {
        formatted_address: string
        geometry: { location: { lat: number; lng: number } }
        address_components: GoogleAddressComponent[]
      }
    }

    if (data.status !== 'OK') {
      console.error(`[Places] Google Places Details status=${data.status} para placeId: "${placeId}"`)
      throw new AppError('PLACES_ERROR', 404, `Place não encontrado: ${data.status}`)
    }

    const { formatted_address, geometry, address_components } = data.result
    const details: PlaceDetails = {
      placeId,
      address: formatted_address,
      lat: geometry.location.lat,
      lng: geometry.location.lng,
      city:
        getComponent(address_components, 'administrative_area_level_2') ??
        getComponent(address_components, 'locality'),
      state: getComponent(address_components, 'administrative_area_level_1'),
    }

    return details
  })
}
