import { z } from 'zod'

export const createPartnerSchema = z.object({
  name: z.string().min(1),
  address: z.string().min(1),
  pinType: z.string().max(80).optional(),
  visibility: z.enum(['public', 'internal']).default('public'),
  dynamicValues: z.record(z.string()).optional(),
})

export const updatePartnerSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().min(1).optional(),
  pinType: z.string().max(80).optional(),
  visibility: z.enum(['public', 'internal']).optional(),
  dynamicValues: z.record(z.string()).optional(),
})

export const listPartnersSchema = z.object({
  visibility: z.enum(['public', 'internal']).optional(),
  pinType: z.string().optional(),
  geocodeStatus: z.enum(['pending', 'done', 'failed']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(50),
})

export type CreatePartnerInput = z.infer<typeof createPartnerSchema>
export type UpdatePartnerInput = z.infer<typeof updatePartnerSchema>
export type ListPartnersInput = z.infer<typeof listPartnersSchema>
