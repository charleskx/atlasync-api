import { Worker } from 'bullmq'
import { redis } from '../../config/redis'
import type { GeocodingJobPayload } from '../../queues/geocoding.queue'
import { emitToTenant } from '../../shared/sse-bus'
import { partnerRepository } from '../partner/partner.repository'
import { geocodingLogsRepository } from './geocoding-logs.repository'
import { geocodeAddress } from './geocoding.service'

export function createGeocodingWorker() {
  return new Worker<GeocodingJobPayload>(
    'geocoding',
    async job => {
      const { partnerId, address, tenantId } = job.data

      let result: Awaited<ReturnType<typeof geocodeAddress>> = null
      let status: 'success' | 'no_results' | 'failed' = 'no_results'
      let errorReason: string | null = null

      try {
        result = await geocodeAddress(address)

        if (result) {
          status = 'success'
        } else {
          status = 'no_results'
          errorReason = 'Nenhum resultado encontrado para o endereço informado. Verifique se o endereço está completo e correto.'
        }
      } catch (err) {
        status = 'failed'
        if (err instanceof Error) {
          if (err.message.startsWith('Nominatim retornou HTTP')) {
            errorReason = err.message
          } else if (err.message.toLowerCase().includes('fetch') || err.message.toLowerCase().includes('network')) {
            errorReason = 'Falha de conexão com o serviço de geocodificação (Nominatim). Tente novamente mais tarde.'
          } else {
            errorReason = `Erro inesperado: ${err.message}`
          }
        } else {
          errorReason = 'Erro desconhecido ao processar geocodificação.'
        }
        console.error(`[geocoding] Erro ao geocodificar parceiro ${partnerId}:`, err)
      }

      // Update partner geocode status
      await partnerRepository.updateGeocode(partnerId, result, result ? 'done' : 'failed')

      // Notify connected clients in real time
      emitToTenant(tenantId, { type: 'geocoding-updated', partnerId })
      emitToTenant(tenantId, { type: 'notification' })

      // Always record the attempt in logs — isolated so a DB error here never retries the geocode job
      try {
        await geocodingLogsRepository.create({
          partnerId,
          tenantId,
          address,
          status,
          errorReason,
          lat: result?.lat ?? null,
          lng: result?.lng ?? null,
          provider: 'nominatim',
        })
      } catch (logErr) {
        console.error(`[geocoding] Falha ao salvar log para parceiro ${partnerId}:`, logErr)
      }
    },
    {
      connection: redis,
      concurrency: 1,
      limiter: { max: 1, duration: 1000 }, // Nominatim: max 1 req/s
    },
  )
}
