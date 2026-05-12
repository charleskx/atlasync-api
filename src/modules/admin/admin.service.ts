import { AppError } from '../../shared/errors'
import { adminRepository } from './admin.repository'

type Requester = { role: string }

function assertSuperAdmin(requester: Requester) {
  if (requester.role !== 'super_admin') {
    throw new AppError('FORBIDDEN', 403, 'Acesso restrito a super admins')
  }
}

export const adminService = {
  async listTenants(requester: Requester) {
    assertSuperAdmin(requester)
    return adminRepository.listTenants()
  },

  async getTenant(id: string, requester: Requester) {
    assertSuperAdmin(requester)
    const tenant = await adminRepository.findTenantById(id)
    if (!tenant) throw new AppError('TENANT_NOT_FOUND', 404, 'Tenant não encontrado')
    return tenant
  },

  async blockTenant(id: string, requester: Requester) {
    assertSuperAdmin(requester)
    const tenant = await adminRepository.findTenantById(id)
    if (!tenant) throw new AppError('TENANT_NOT_FOUND', 404, 'Tenant não encontrado')
    if (!tenant.active) throw new AppError('ALREADY_BLOCKED', 409, 'Tenant já está bloqueado')
    await adminRepository.setTenantActive(id, false)
  },

  async unblockTenant(id: string, requester: Requester) {
    assertSuperAdmin(requester)
    const tenant = await adminRepository.findTenantById(id)
    if (!tenant) throw new AppError('TENANT_NOT_FOUND', 404, 'Tenant não encontrado')
    if (tenant.active) throw new AppError('NOT_BLOCKED', 409, 'Tenant não está bloqueado')
    await adminRepository.setTenantActive(id, true)
  },

  async listTenantImports(tenantId: string, requester: Requester) {
    assertSuperAdmin(requester)
    return adminRepository.listTenantImports(tenantId, 10)
  },

  async rollbackImport(jobId: string, tenantId: string, requester: Requester) {
    assertSuperAdmin(requester)
    await adminRepository.rollbackImport(jobId, tenantId)
  },

  async getMetrics(requester: Requester) {
    assertSuperAdmin(requester)
    return adminRepository.getMetrics()
  },
}
