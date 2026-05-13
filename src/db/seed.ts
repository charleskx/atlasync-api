import 'dotenv/config'
import { faker } from '@faker-js/faker/locale/pt_BR'
import argon2 from 'argon2'
import dayjs from 'dayjs'
import { db } from '../config/database'
import {
  geocodingLogs,
  importJobs,
  maps,
  partnerColumns,
  partnerValues,
  partners,
  pinTypes,
  subscriptions,
  tenantSettings,
  tenants,
  ticketMessages,
  tickets,
  users,
} from './schema'

faker.seed(42)

// ─── Cidades e estados brasileiros para dados realistas ───────────────────────
const BR_CITIES = [
  { city: 'São Paulo', state: 'SP', lat: -23.5505, lng: -46.6333 },
  { city: 'Rio de Janeiro', state: 'RJ', lat: -22.9068, lng: -43.1729 },
  { city: 'Belo Horizonte', state: 'MG', lat: -19.9167, lng: -43.9345 },
  { city: 'Curitiba', state: 'PR', lat: -25.4296, lng: -49.2713 },
  { city: 'Porto Alegre', state: 'RS', lat: -30.0346, lng: -51.2177 },
  { city: 'Salvador', state: 'BA', lat: -12.9714, lng: -38.5014 },
  { city: 'Fortaleza', state: 'CE', lat: -3.7172, lng: -38.5434 },
  { city: 'Recife', state: 'PE', lat: -8.0476, lng: -34.877 },
  { city: 'Manaus', state: 'AM', lat: -3.119, lng: -60.0217 },
  { city: 'Brasília', state: 'DF', lat: -15.7801, lng: -47.9292 },
]

const PIN_TYPE_DEFS = [
  { name: 'Loja', color: '#6366f1' },
  { name: 'Distribuidor', color: '#f59e0b' },
  { name: 'Parceiro', color: '#10b981' },
  { name: 'Representante', color: '#ef4444' },
  { name: 'Franquia', color: '#3b82f6' },
]
const VISIBILITIES = ['public', 'internal'] as const

function randCity() {
  return BR_CITIES[Math.floor(Math.random() * BR_CITIES.length)]
}

function randCoordOffset(base: number, range = 0.3) {
  return base + (Math.random() - 0.5) * range
}

async function clearAll() {
  // delete in dependency order (children before parents)
  await db.delete(ticketMessages)
  await db.delete(tickets)
  await db.delete(geocodingLogs)
  await db.delete(importJobs)
  await db.delete(partnerValues)
  await db.delete(partnerColumns)
  await db.delete(maps)
  await db.delete(partners)
  await db.delete(pinTypes)
  await db.delete(users)
  await db.delete(subscriptions)
  await db.delete(tenantSettings)
  await db.delete(tenants)
  console.log('  ✓ Banco limpo')
}

async function createPinTypes(tenantId: string) {
  const inserted = await db
    .insert(pinTypes)
    .values(PIN_TYPE_DEFS.map(pt => ({ ...pt, tenantId, updatedAt: new Date() })))
    .returning()
  return inserted
}

async function createTenant(name: string, slug: string, email: string, planStatus: string) {
  const [tenant] = await db
    .insert(tenants)
    .values({ name, slug, email, active: true, updatedAt: new Date() })
    .returning()

  await db.insert(subscriptions).values({
    tenantId: tenant.id,
    status: planStatus,
    planType: Math.random() > 0.5 ? 'monthly' : 'annual',
    trialEndsAt: planStatus === 'trialing' ? dayjs().add(14, 'day').toDate() : null,
    currentPeriodStart: dayjs().startOf('month').toDate(),
    currentPeriodEnd: dayjs().endOf('month').toDate(),
    updatedAt: new Date(),
  })

  const city = randCity()
  await db.insert(tenantSettings).values({
    tenantId: tenant.id,
    defaultMapZoom: 12,
    defaultMapLat: city.lat,
    defaultMapLng: city.lng,
    publicMapEnabled: true,
    updatedAt: new Date(),
  })

  return tenant
}

async function createUsers(tenantId: string) {
  const passwordHash = await argon2.hash('senha@123')

  const [owner] = await db
    .insert(users)
    .values({
      tenantId,
      name: faker.person.fullName(),
      email: `owner-${tenantId.slice(0, 6)}@atlasync-seed.dev`,
      passwordHash,
      role: 'owner',
      emailVerified: true,
      updatedAt: new Date(),
    })
    .returning()

  const extraRoles = ['admin', 'employee', 'employee'] as const
  for (const role of extraRoles) {
    await db.insert(users).values({
      tenantId,
      name: faker.person.fullName(),
      email: faker.internet.email().toLowerCase(),
      passwordHash,
      role,
      emailVerified: true,
      updatedAt: new Date(),
    })
  }

  return owner
}

async function createPartnerColumns(tenantId: string) {
  const cols = [
    { key: 'segmento', label: 'Segmento', dataType: 'text', sortOrder: 0 },
    { key: 'capacidade', label: 'Capacidade', dataType: 'number', sortOrder: 1 },
    { key: 'telefone', label: 'Telefone', dataType: 'text', sortOrder: 2 },
    { key: 'site', label: 'Site', dataType: 'url', sortOrder: 3 },
    { key: 'ativo', label: 'Ativo', dataType: 'boolean', sortOrder: 4 },
  ]

  const inserted = await db
    .insert(partnerColumns)
    .values(cols.map(c => ({ ...c, tenantId, visible: true, updatedAt: new Date() })))
    .returning()

  return inserted
}

async function createPartners(
  tenantId: string,
  columns: { id: string; key: string }[],
  seedPinTypes: { id: string }[],
  count: number,
) {
  const colMap = Object.fromEntries(columns.map(c => [c.key, c.id]))

  for (let i = 0; i < count; i++) {
    const location = randCity()
    const lat = randCoordOffset(location.lat)
    const lng = randCoordOffset(location.lng)
    const pinTypeId = seedPinTypes[Math.floor(Math.random() * seedPinTypes.length)].id

    const [partner] = await db
      .insert(partners)
      .values({
        tenantId,
        name: faker.company.name(),
        address: `${faker.location.streetAddress()}, ${location.city} - ${location.state}`,
        lat,
        lng,
        city: location.city,
        state: location.state,
        geocodeStatus: 'done',
        geocodedAt: new Date(),
        pinTypeId,
        visibility: VISIBILITIES[Math.floor(Math.random() * 2)],
        source: 'dashboard',
        externalKey: `seed-${tenantId.slice(0, 4)}-${i}`,
        updatedAt: new Date(),
      })
      .returning()

    await db.insert(partnerValues).values([
      {
        partnerId: partner.id,
        columnId: colMap.segmento,
        value: faker.commerce.department(),
      },
      {
        partnerId: partner.id,
        columnId: colMap.capacidade,
        value: String(faker.number.int({ min: 10, max: 500 })),
      },
      {
        partnerId: partner.id,
        columnId: colMap.telefone,
        value: faker.phone.number(),
      },
      {
        partnerId: partner.id,
        columnId: colMap.site,
        value: faker.internet.url(),
      },
      {
        partnerId: partner.id,
        columnId: colMap.ativo,
        value: Math.random() > 0.2 ? 'true' : 'false',
      },
    ])
  }
}

async function createMaps(tenantId: string) {
  await db.insert(maps).values([
    {
      tenantId,
      name: 'Mapa Público Geral',
      type: 'public',
      embedToken: `pub-${tenantId.slice(0, 8)}-${faker.string.alphanumeric(16)}`,
      active: true,
    },
    {
      tenantId,
      name: 'Mapa Interno — Equipe',
      type: 'internal',
      active: true,
    },
  ])
}

async function createSuperAdmin() {
  const passwordHash = await argon2.hash('superadmin@123')

  const [tenant] = await db
    .insert(tenants)
    .values({
      name: 'Atlasync Internal',
      slug: 'atlasync-internal',
      email: 'admin@atlasync.dev',
      active: true,
      updatedAt: new Date(),
    })
    .returning()

  await db.insert(subscriptions).values({
    tenantId: tenant.id,
    status: 'active',
    planType: 'annual',
    currentPeriodStart: dayjs().startOf('year').toDate(),
    currentPeriodEnd: dayjs().endOf('year').toDate(),
    updatedAt: new Date(),
  })

  await db.insert(tenantSettings).values({ tenantId: tenant.id, updatedAt: new Date() })

  const [superAdmin] = await db
    .insert(users)
    .values({
      tenantId: tenant.id,
      name: 'Super Admin',
      email: 'superadmin@atlasync.dev',
      passwordHash,
      role: 'super_admin',
      emailVerified: true,
      updatedAt: new Date(),
    })
    .returning()

  return superAdmin
}

async function main() {
  console.log('\n🌱 Iniciando seed...\n')

  await clearAll()

  // ── Super Admin ──────────────────────────────────────────────────────────
  await createSuperAdmin()
  console.log('  ✓ Super admin criado')
  console.log('    email: superadmin@atlasync.dev')
  console.log('    senha: superadmin@123')

  // ── Tenant 1: plano ativo com muitos parceiros ───────────────────────────
  const tenant1 = await createTenant(
    'Distribuidora Alfa Ltda',
    'distribuidora-alfa',
    'contato@alfa.com.br',
    'active',
  )
  await createUsers(tenant1.id)
  const cols1 = await createPartnerColumns(tenant1.id)
  const pinTypes1 = await createPinTypes(tenant1.id)
  await createPartners(tenant1.id, cols1, pinTypes1, 40)
  await createMaps(tenant1.id)
  console.log('\n  ✓ Tenant 1 — Distribuidora Alfa Ltda (plano ativo, 40 parceiros)')
  console.log(`    owner email: owner-${tenant1.id.slice(0, 6)}@atlasync-seed.dev`)
  console.log('    senha: senha@123')

  // ── Tenant 2: trial ──────────────────────────────────────────────────────
  const tenant2 = await createTenant(
    'Rede Beta Franquias',
    'rede-beta',
    'admin@redebeta.com.br',
    'trialing',
  )
  await createUsers(tenant2.id)
  const cols2 = await createPartnerColumns(tenant2.id)
  const pinTypes2 = await createPinTypes(tenant2.id)
  await createPartners(tenant2.id, cols2, pinTypes2, 15)
  await createMaps(tenant2.id)
  console.log('\n  ✓ Tenant 2 — Rede Beta Franquias (trial, 15 parceiros)')
  console.log(`    owner email: owner-${tenant2.id.slice(0, 6)}@atlasync-seed.dev`)
  console.log('    senha: senha@123')

  // ── Tenant 3: cancelado (para testar bloqueio) ───────────────────────────
  const tenant3 = await createTenant(
    'Gama Corp (Cancelado)',
    'gama-corp',
    'ti@gamacorp.com.br',
    'canceled',
  )
  await createUsers(tenant3.id)
  const cols3 = await createPartnerColumns(tenant3.id)
  const pinTypes3 = await createPinTypes(tenant3.id)
  await createPartners(tenant3.id, cols3, pinTypes3, 5)
  console.log('\n  ✓ Tenant 3 — Gama Corp (assinatura cancelada, 5 parceiros)')
  console.log(`    owner email: owner-${tenant3.id.slice(0, 6)}@atlasync-seed.dev`)
  console.log('    senha: senha@123')

  console.log('\n✅ Seed concluído com sucesso!\n')

  process.exit(0)
}

main().catch(err => {
  console.error('❌ Erro no seed:', err)
  process.exit(1)
})
