import { AbilityBuilder, createMongoAbility } from '@casl/ability'
import type { MongoAbility } from '@casl/ability'

type Actions = 'manage' | 'create' | 'read' | 'update' | 'delete'
type Subjects =
  | 'all'
  | 'Partner'
  | 'PinType'
  | 'User'
  | 'Map'
  | 'Import'
  | 'Export'
  | 'Settings'
  | 'Billing'
  | 'Tenant'

export type AppAbility = MongoAbility<[Actions, Subjects]>

export function defineAbilityFor(user: { role: string }): AppAbility {
  const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility)

  switch (user.role) {
    case 'super_admin':
      can('manage', 'all')
      break

    case 'owner':
      can('manage', 'Partner')
      can('manage', 'PinType')
      can('manage', 'User')
      can('manage', 'Map')
      can('manage', 'Import')
      can('manage', 'Export')
      can('manage', 'Settings')
      can('manage', 'Billing')
      break

    case 'admin':
      can('manage', 'Partner')
      can('manage', 'PinType')
      can('manage', 'Import')
      can('manage', 'Export')
      can('create', 'Map')
      can('read', 'Map')
      can('update', 'Map')
      can('read', 'User')
      can('create', 'User')
      can('read', 'Settings')
      can('update', 'Settings')
      break

    case 'employee':
      can('read', 'Partner')
      can('create', 'Partner')
      can('read', 'PinType')
      can('read', 'Map')
      break
  }

  return build()
}
