import { describe, it, before, after } from 'node:test'
import assert from 'node:assert'
import { build } from '../helper'

describe('Order Flow Integration', () => {
  let fastify: any

  before(async () => {
    fastify = await build()
  })

  after(async () => {
    await fastify.close()
  })

  it('should complete full order lifecycle', { timeout: 15000 }, async () => {
    // Submit order
    const createResponse = await fastify.inject({
      method: 'POST',
      url: '/api/orders/execute',
      payload: {
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amountIn: 100,
      },
    })

    assert.strictEqual(createResponse.statusCode, 201)
    const { orderId } = JSON.parse(createResponse.body)

    // Wait for order to process (up to 15 seconds)
    let orderStatus = 'pending'
    let attempts = 0
    const maxAttempts = 30 // 30 * 500ms = 15 seconds max
    while (!['confirmed', 'failed'].includes(orderStatus) && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 500))
      const getResponse = await fastify.inject({
        method: 'GET',
        url: `/api/orders/${orderId}`,
      })
      const order = JSON.parse(getResponse.body)
      orderStatus = order.status
      attempts++
    }

    // Order should be confirmed or failed
    assert.ok(['confirmed', 'failed'].includes(orderStatus), 
      `Order should be confirmed or failed, but got: ${orderStatus}`)
  })

  it('should handle multiple orders in sequence', { timeout: 10000 }, async () => {
    const orderIds: string[] = []

    // Create 3 orders
    for (let i = 0; i < 3; i++) {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/orders/execute',
        payload: {
          tokenIn: 'SOL',
          tokenOut: 'USDC',
          amountIn: 50 + i * 10,
        },
      })
      assert.strictEqual(response.statusCode, 201)
      const { orderId } = JSON.parse(response.body)
      orderIds.push(orderId)
    }

    assert.strictEqual(orderIds.length, 3)
    
    // Verify all orders exist
    for (const orderId of orderIds) {
      const response = await fastify.inject({
        method: 'GET',
        url: `/api/orders/${orderId}`,
      })
      assert.strictEqual(response.statusCode, 200)
      const order = JSON.parse(response.body)
      assert.strictEqual(order.orderId, orderId)
    }

    // Wait a bit for orders to start processing (but don't wait for completion)
    // This allows the async operations to start without blocking the test
    await new Promise(resolve => setTimeout(resolve, 1000))
  })

  it('should track order status progression', { timeout: 10000 }, async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/api/orders/execute',
      payload: {
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amountIn: 100,
      },
    })

    const { orderId } = JSON.parse(response.body)

    // Check initial status
    let getResponse = await fastify.inject({
      method: 'GET',
      url: `/api/orders/${orderId}`,
    })
    let order = JSON.parse(getResponse.body)
    assert.strictEqual(order.status, 'pending')

    // Wait a bit and check status changed
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    getResponse = await fastify.inject({
      method: 'GET',
      url: `/api/orders/${orderId}`,
    })
    order = JSON.parse(getResponse.body)
    // Status should have progressed from pending
    assert.ok(['routing', 'building', 'submitted', 'confirmed', 'failed'].includes(order.status))
  })
})

