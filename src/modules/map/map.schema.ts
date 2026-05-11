import { z } from 'zod'

export const createMapSchema = z.object({
  name: z.string().min(1).max(120),
  type: z.enum(['internal', 'public']),
  filters: z.record(z.unknown()).optional(),
})

export const updateMapSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  filters: z.record(z.unknown()).optional(),
  active: z.boolean().optional(),
})

export const mapPinsQuerySchema = z.object({
  city: z.string().optional(),
  state: z.string().optional(),
  visibility: z.enum(['public', 'internal']).optional(),
  pinTypeId: z.string().uuid().optional(),
  geocodeStatus: z.enum(['pending', 'done', 'failed']).optional(),
})

export const embedSnippetQuerySchema = z.object({
  type: z.enum(['iframe', 'script']).default('iframe'),
})

export type CreateMapInput = z.infer<typeof createMapSchema>
export type UpdateMapInput = z.infer<typeof updateMapSchema>
export type MapPinsQuery = z.infer<typeof mapPinsQuerySchema>
