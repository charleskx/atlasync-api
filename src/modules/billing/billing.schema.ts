import { z } from 'zod'

export const createCheckoutSchema = z.object({
  plan: z.enum(['monthly', 'annual']),
})

export type CreateCheckoutInput = z.infer<typeof createCheckoutSchema>
