import { eq } from 'drizzle-orm'
import { db } from '../../config/database'
import { subscriptions } from '../../db/schema'
import { geocodingQueue } from '../../queues/geocoding.queue'
import { AppError } from '../../shared/errors'
import { defineAbilityFor } from '../../shared/permissions'
import { partnerRepository } from './partner.repository'
import type { CreatePartnerInput, ListPartnersInput, UpdatePartnerInput } from './partner.schema'

type Requester = { id: string; role: string; tenantId: string }

async function getGeocodingPriority(tenantId: string): Promise<number> {
  const [sub] = await db
    .select({ planType: subscriptions.planType })
    .from(subscriptions)
    .where(eq(subscriptions.tenantId, tenantId))
    .limit(1)
  return sub?.planType === 'annual' ? 1 : 2
}

export const partnerService = {
  async list(requester: Requester, filters: ListPartnersInput) {
    const { data, total } = await partnerRepository.findAll(requester.tenantId, filters)
    return {
      data,
      total,
      page: filters.page,
      limit: filters.limit,
      totalPages: Math.ceil(total / filters.limit),
    }
  },

  async getById(id: string, requester: Requester) {
    const partner = await partnerRepository.findById(id, requester.tenantId)
    if (!partner) throw new AppError('PARTNER_NOT_FOUND', 404, 'Parceiro não encontrado')
    return partner
  },

  async create(data: CreatePartnerInput, requester: Requester) {
    const ability = defineAbilityFor({ role: requester.role })
    if (!ability.can('create', 'Partner')) throw new AppError('FORBIDDEN', 403, 'Sem permissão')

    const [partner, priority] = await Promise.all([
      partnerRepository.create(requester.tenantId, data),
      getGeocodingPriority(requester.tenantId),
    ])

    await geocodingQueue.add('geocode', {
      partnerId: partner.id,
      address: partner.address,
      tenantId: requester.tenantId,
    }, { priority })

    return partner
  },

  async update(id: string, data: UpdatePartnerInput, requester: Requester) {
    const ability = defineAbilityFor({ role: requester.role })
    if (!ability.can('update', 'Partner')) throw new AppError('FORBIDDEN', 403, 'Sem permissão')

    const existing = await partnerRepository.findById(id, requester.tenantId)
    if (!existing) throw new AppError('PARTNER_NOT_FOUND', 404, 'Parceiro não encontrado')

    const updated = await partnerRepository.update(id, requester.tenantId, data)

    if (data.address && data.address !== existing.address) {
      const priority = await getGeocodingPriority(requester.tenantId)
      await geocodingQueue.add('geocode', {
        partnerId: id,
        address: data.address,
        tenantId: requester.tenantId,
      }, { priority })
    }

    return updated
  },

  async delete(id: string, requester: Requester) {
    const ability = defineAbilityFor({ role: requester.role })
    if (!ability.can('delete', 'Partner')) throw new AppError('FORBIDDEN', 403, 'Sem permissão')

    const existing = await partnerRepository.findById(id, requester.tenantId)
    if (!existing) throw new AppError('PARTNER_NOT_FOUND', 404, 'Parceiro não encontrado')

    await partnerRepository.softDelete(id, requester.tenantId)
  },

  async getColumns(requester: Requester) {
    return partnerRepository.getColumns(requester.tenantId)
  },
}
