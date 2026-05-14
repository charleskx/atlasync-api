const { createClient } = require('redis')

const c = createClient({
  url: process.env.REDIS_URL
})

c.connect()
  .then(async () => {
    await c.quit()
    process.exit(0)
  })
  .catch(() => {
    process.exit(1)
  })