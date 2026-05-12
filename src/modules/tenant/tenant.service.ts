import { AppError } from '../../shared/errors'
import { defineAbilityFor } from '../../shared/permissions'
import { tenantRepository } from './tenant.repository'
import type { UpdateSettingsInput } from './tenant.schema'

type Requester = { id: string; role: string; tenantId: string }

export const tenantService = {
  async getSettings(requester: Requester) {
    const settings = await tenantRepository.findSettings(requester.tenantId)
    if (!settings) throw new AppError('SETTINGS_NOT_FOUND', 404, 'Configurações não encontradas')

    return settings
  },

  async updateSettings(data: UpdateSettingsInput, requester: Requester) {
    const ability = defineAbilityFor({ role: requester.role })
    if (!ability.can('update', 'Settings')) throw new AppError('FORBIDDEN', 403, 'Sem permissão')

    return tenantRepository.upsertSettings(requester.tenantId, data)
  },
}
