import { z } from 'zod'

export const exportSchema = z.object({
  columns: z.array(z.string()).min(1, 'Selecione ao menos uma coluna'),
  format: z.enum(['xlsx', 'csv']).default('xlsx'),
})

export type ExportInput = z.infer<typeof exportSchema>
