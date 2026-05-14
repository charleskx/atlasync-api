const Redis = require('ioredis')

async function run() {
  const redis = new Redis(process.env.REDIS_URL)

  try {
    await redis.ping()
    await redis.quit()
    process.exit(0)
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}

run()