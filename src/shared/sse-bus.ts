import { EventEmitter } from 'events'

export type SseEvent =
  | { type: 'notification' }
  | { type: 'geocoding-updated'; partnerId: string }

const bus = new EventEmitter()
bus.setMaxListeners(500)

export function emitToTenant(tenantId: string, event: SseEvent) {
  bus.emit(`tenant:${tenantId}`, event)
}

export function onTenantEvent(tenantId: string, handler: (e: SseEvent) => void): () => void {
  bus.on(`tenant:${tenantId}`, handler)
  return () => bus.off(`tenant:${tenantId}`, handler)
}
