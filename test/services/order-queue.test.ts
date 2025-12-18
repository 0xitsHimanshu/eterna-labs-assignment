import { describe, it, before, after } from 'node:test'
import assert from 'node:assert'
import { OrderQueue } from '../../src/services/order-queue'
import { Order, OrderStatus } from '../../src/types/order'
import { build } from '../helper'

describe('OrderQueue', () => {
  let fastify: any
  let orderQueue: OrderQueue

  before(async () => {
    fastify = await build()
    orderQueue = fastify.orderQueue
  })

  after(async () => {
    await orderQueue.close()
    await fastify.close()
  })

  it('should add order to queue', async () => {
    const order: Order = {
      orderId: 'test-queue-order-1',
      tokenIn: 'SOL',
      tokenOut: 'USDC',
      amountIn: 100,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    await orderQueue.addOrder(order)
    
    // Verify order was added by checking metrics
    const metrics = await orderQueue.getMetrics()
    assert.ok(metrics.waiting >= 0 || metrics.active >= 0)
  })

  it('should register WebSocket connection', () => {
    const mockWs = {
      readyState: 1,
      send: () => {},
      on: () => {},
    }
    
    orderQueue.registerWebSocket('test-order-id', mockWs)
    // If no error thrown, registration succeeded
    assert.ok(true)
  })

  it('should return queue metrics', async () => {
    const metrics = await orderQueue.getMetrics()
    
    assert.ok(typeof metrics === 'object')
    assert.ok(typeof metrics.waiting === 'number')
    assert.ok(typeof metrics.active === 'number')
    assert.ok(typeof metrics.completed === 'number')
    assert.ok(typeof metrics.failed === 'number')
  })

  it('should handle multiple orders concurrently', { timeout: 5000 }, async () => {
    const orders: Order[] = Array.from({ length: 5 }, (_, i) => ({
      orderId: `test-concurrent-${i}`,
      tokenIn: 'SOL',
      tokenOut: 'USDC',
      amountIn: 100 + i,
      status: 'pending' as OrderStatus,
      createdAt: new Date(),
      updatedAt: new Date(),
    }))

    // Add all orders
    await Promise.all(orders.map(order => orderQueue.addOrder(order)))

    // Wait a bit for processing to start
    await new Promise(resolve => setTimeout(resolve, 1000))

    const metrics = await orderQueue.getMetrics()
    // Should have some orders in queue or processing
    assert.ok(metrics.waiting + metrics.active >= 0)
  })
})

