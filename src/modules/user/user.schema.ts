import { z } from 'zod'

export const inviteUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(200),
  role: z.enum(['admin', 'employee']),
})

export const updateUserSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  role: z.enum(['admin', 'employee']).optional(),
})

export type InviteUserInput = z.infer<typeof inviteUserSchema>
export type UpdateUserInput = z.infer<typeof updateUserSchema>
