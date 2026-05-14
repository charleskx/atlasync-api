import { initSentry } from './src/config/sentry'
import { buildApp } from './src/app'
import { env } from './src/config/env'

// Must be called before anything else
initSentry()

async function main() {
  const app = await buildApp()
  await app.listen({ port: env.PORT, host: '0.0.0.0' })
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
