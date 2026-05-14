import 'dotenv/config'
import argon2 from 'argon2'
import dayjs from 'dayjs'
import { eq } from 'drizzle-orm'
import { db } from '../config/database'
import { subscriptions, tenantSettings, tenants, users } from './schema'

const SLUG = 'mappahub-internal'

async function main() {
  const email = process.env.SUPER_ADMIN_EMAIL
  const password = process.env.SUPER_ADMIN_PASSWORD

  if (!email || !password) {
    console.error('❌ Defina SUPER_ADMIN_EMAIL e SUPER_ADMIN_PASSWORD nas variáveis de ambiente')
    process.exit(1)
  }

  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1)
  if (existing.length > 0) {
    console.log(`✅ Super admin já existe: ${email}`)
    process.exit(0)
  }

  let [tenant] = await db.select().from(tenants).where(eq(tenants.slug, SLUG)).limit(1)

  if (!tenant) {
    ;[tenant] = await db
      .insert(tenants)
      .values({ name: 'MappaHub Internal', slug: SLUG, email, active: true, updatedAt: new Date() })
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
  }

  const passwordHash = await argon2.hash(password)

  await db.insert(users).values({
    tenantId: tenant.id,
    name: 'Super Admin',
    email,
    passwordHash,
    role: 'super_admin',
    emailVerified: true,
    updatedAt: new Date(),
  })

  console.log(`✅ Super admin criado: ${email}`)
  process.exit(0)
}

main().catch(err => {
  console.error('❌ Erro:', err)
  process.exit(1)
})
