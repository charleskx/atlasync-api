import { notificationsRepository } from './notifications.repository'

export type NotificationItem = {
  id: string
  type: 'import_done' | 'import_failed' | 'geocoding_failures' | 'trial_expiring'
  title: string
  desc: string
  createdAt: string
}

export const notificationsService = {
  async list(tenantId: string): Promise<NotificationItem[]> {
    const [imports, geocodingFailures, trialDaysLeft] = await Promise.all([
      notificationsRepository.getRecentImports(tenantId),
      notificationsRepository.getGeocodingFailures(tenantId),
      notificationsRepository.getTrialDaysLeft(tenantId),
    ])

    const items: NotificationItem[] = []

    // Import notifications
    for (const job of imports) {
      if (job.status === 'done') {
        const parts: string[] = []
        if (job.created) parts.push(`${job.created} criados`)
        if (job.updated) parts.push(`${job.updated} atualizados`)
        if (job.removed) parts.push(`${job.removed} removidos`)
        items.push({
          id: `import-${job.id}`,
          type: 'import_done',
          title: `Importação concluída`,
          desc: `${job.fileName ?? 'Arquivo'} · ${parts.length ? parts.join(' · ') : 'sem alterações'}`,
          createdAt: (job.finishedAt ?? job.createdAt).toISOString(),
        })
      } else if (job.status === 'failed') {
        items.push({
          id: `import-${job.id}`,
          type: 'import_failed',
          title: `Importação falhou`,
          desc: `${job.fileName ?? 'Arquivo'} não pôde ser processado`,
          createdAt: (job.finishedAt ?? job.createdAt).toISOString(),
        })
      }
    }

    // Geocoding failures
    if (geocodingFailures > 0) {
      items.push({
        id: 'geocoding-failures',
        type: 'geocoding_failures',
        title: `${geocodingFailures} endereço${geocodingFailures > 1 ? 's' : ''} sem localização`,
        desc: 'Alguns parceiros não foram geocodificados. Verifique os endereços.',
        createdAt: new Date().toISOString(),
      })
    }

    // Trial expiry warning (≤ 5 days left)
    if (trialDaysLeft !== null && trialDaysLeft <= 5) {
      items.push({
        id: 'trial-expiring',
        type: 'trial_expiring',
        title: trialDaysLeft === 0 ? 'Seu trial expirou' : `Trial expira em ${trialDaysLeft} dia${trialDaysLeft > 1 ? 's' : ''}`,
        desc: 'Assine um plano para continuar usando o AtlaSync.',
        createdAt: new Date().toISOString(),
      })
    }

    // Sort by most recent first
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return items
  },
}
