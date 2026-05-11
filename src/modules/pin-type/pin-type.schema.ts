import { z } from 'zod'

const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Cor deve ser um hex válido (ex: #FF5733)')

export const createPinTypeSchema = z.object({
  name: z.string().min(1).max(100),
  color: hexColor,
})

export const updatePinTypeSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: hexColor.optional(),
})

export type CreatePinTypeInput = z.infer<typeof createPinTypeSchema>
export type UpdatePinTypeInput = z.infer<typeof updatePinTypeSchema>
