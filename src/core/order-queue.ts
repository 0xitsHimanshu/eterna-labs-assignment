import fp from 'fastify-plugin'
import { OrderQueue } from '../services/order-queue'

export interface OrderQueuePluginOptions {
  // Specify OrderQueue plugin options here
}

declare module 'fastify' {
  export interface FastifyInstance {
    orderQueue: OrderQueue
  }
}

export default fp<OrderQueuePluginOptions>(async (fastify, opts) => {
  const orderQueue = new OrderQueue(fastify, fastify.redis)
  
  fastify.decorate('orderQueue', orderQueue)

  fastify.addHook('onClose', async () => {
    await orderQueue.close()
  })
})

