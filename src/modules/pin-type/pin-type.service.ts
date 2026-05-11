import { AppError } from '../../shared/errors'
import { defineAbilityFor } from '../../shared/permissions'
import { pinTypeRepository } from './pin-type.repository'
import type { CreatePinTypeInput, UpdatePinTypeInput } from './pin-type.schema'

type Requester = { id: string; role: string; tenantId: string }

export const pinTypeService = {
  async list(requester: Requester) {
    return pinTypeRepository.findAll(requester.tenantId)
  },

  async create(data: CreatePinTypeInput, requester: Requester) {
    const ability = defineAbilityFor({ role: requester.role })
    if (!ability.can('create', 'PinType')) throw new AppError('FORBIDDEN', 403, 'Sem permissão')

    const taken = await pinTypeRepository.existsByName(data.name, requester.tenantId)
    if (taken)
      throw new AppError('PIN_TYPE_NAME_TAKEN', 409, 'Já existe um tipo de pin com esse nome')

    return pinTypeRepository.create(requester.tenantId, data)
  },

  async update(id: string, data: UpdatePinTypeInput, requester: Requester) {
    const ability = defineAbilityFor({ role: requester.role })
    if (!ability.can('update', 'PinType')) throw new AppError('FORBIDDEN', 403, 'Sem permissão')

    const existing = await pinTypeRepository.findById(id, requester.tenantId)
    if (!existing) throw new AppError('PIN_TYPE_NOT_FOUND', 404, 'Tipo de pin não encontrado')

    if (data.name) {
      const taken = await pinTypeRepository.existsByName(data.name, requester.tenantId, id)
      if (taken)
        throw new AppError('PIN_TYPE_NAME_TAKEN', 409, 'Já existe um tipo de pin com esse nome')
    }

    return pinTypeRepository.update(id, requester.tenantId, data)
  },

  async delete(id: string, requester: Requester) {
    const ability = defineAbilityFor({ role: requester.role })
    if (!ability.can('delete', 'PinType')) throw new AppError('FORBIDDEN', 403, 'Sem permissão')

    const existing = await pinTypeRepository.findById(id, requester.tenantId)
    if (!existing) throw new AppError('PIN_TYPE_NOT_FOUND', 404, 'Tipo de pin não encontrado')

    await pinTypeRepository.softDelete(id, requester.tenantId)
  },
}
