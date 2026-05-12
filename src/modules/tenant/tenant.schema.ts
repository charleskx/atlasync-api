import { z } from 'zod'

export const updateSettingsSchema = z.object({
  defaultMapZoom: z.number().int().min(1).max(21).optional(),
  defaultMapLat: z.number().optional(),
  defaultMapLng: z.number().optional(),
  publicMapEnabled: z.boolean().optional(),
})

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>
