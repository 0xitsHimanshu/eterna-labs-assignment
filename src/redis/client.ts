import Redis from 'ioredis'
import fp from 'fastify-plugin'

export interface RedisPluginOptions {
  // Specify Redis plugin options here
}

declare module 'fastify' {
  export interface FastifyInstance {
    redis: Redis
  }
}

export default fp<RedisPluginOptions>(async (fastify, opts) => {
  const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    retryStrategy: (times) => {
      const delay = Math.min(times * 50, 2000)
      return delay
    },
    maxRetriesPerRequest: null,
  })

  redis.on('error', (err) => {
    fastify.log.error(err, 'Redis connection error')
  })

  redis.on('connect', () => {
    fastify.log.info('Redis connected successfully')
  })

  fastify.decorate('redis', redis)

  fastify.addHook('onClose', async () => {
    await redis.quit()
  })
})

