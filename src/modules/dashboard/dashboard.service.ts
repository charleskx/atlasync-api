import { dashboardRepository } from './dashboard.repository'

export const dashboardService = {
  async getStats(tenantId: string) {
    const [
      partnerStats,
      importStats,
      byState,
      byCity,
      byPinType,
      recentImports,
      partnersByMonth,
    ] = await Promise.all([
      dashboardRepository.getPartnerStats(tenantId),
      dashboardRepository.getImportStats(tenantId),
      dashboardRepository.getByState(tenantId),
      dashboardRepository.getByCity(tenantId),
      dashboardRepository.getByPinType(tenantId),
      dashboardRepository.getRecentImports(tenantId),
      dashboardRepository.getPartnersByMonth(tenantId),
    ])

    const geocodedPct =
      partnerStats.total > 0
        ? Math.round((partnerStats.geocodedDone / partnerStats.total) * 100)
        : 0

    return {
      partners: {
        total: partnerStats.total,
        thisMonth: partnerStats.thisMonthCount,
        lastMonth: partnerStats.lastMonthCount,
        geocodedDone: partnerStats.geocodedDone,
        geocodedFailed: partnerStats.geocodedFailed,
        geocodedPct,
        public: partnerStats.publicCount,
        internal: partnerStats.internalCount,
      },
      imports: {
        total: importStats.total,
        thisMonth: importStats.thisMonthCount,
        lastMonth: importStats.lastMonthCount,
      },
      geo: {
        byState: byState.map((r) => ({ state: r.state ?? '', count: r.count })).filter((r) => r.state),
        byCity: byCity.map((r) => ({ city: r.city ?? '', state: r.state ?? '', count: r.count })).filter((r) => r.city),
        byPinType: byPinType.map((r) => ({ id: r.id, name: r.name, color: r.color, count: r.count })),
      },
      recentImports: recentImports.map((r) => ({
        id: r.id,
        fileName: r.fileName ?? '',
        status: r.status,
        mode: r.mode,
        totalRows: r.totalRows ?? 0,
        created: r.created ?? 0,
        updated: r.updated ?? 0,
        removed: r.removed ?? 0,
        failed: r.failed ?? 0,
        createdAt: r.createdAt.toISOString(),
        finishedAt: r.finishedAt?.toISOString() ?? null,
        userName: r.userName ?? 'Sistema',
      })),
      partnersByMonth,
    }
  },
}
