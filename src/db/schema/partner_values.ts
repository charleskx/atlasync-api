import { index, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { partnerColumns } from './partner_columns'
import { partners } from './partners'

export const partnerValues = pgTable(
  'partner_values',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    partnerId: uuid('partner_id')
      .references(() => partners.id, { onDelete: 'cascade' })
      .notNull(),
    columnId: uuid('column_id')
      .references(() => partnerColumns.id)
      .notNull(),
    value: text('value'),
  },
  t => ({
    partnerColumnUnique: uniqueIndex('partner_values_partner_column_unique').on(
      t.partnerId,
      t.columnId,
    ),
    partnerIdx: index('partner_values_partner_idx').on(t.partnerId),
  }),
)
