import { describe, it, before, after } from 'node:test'
import assert from 'node:assert'
import { build } from '../helper'

describe('Order Routes', () => {
  let fastify: any

  before(async () => {
    fastify = await build()
  })

  after(async () => {
    await fastify.close()
  })

  it('should create order via POST /api/orders/execute', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/api/orders/execute',
      payload: {
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amountIn: 100,
        userId: 'test-user-1',
      },
    })

    assert.strictEqual(response.statusCode, 201)
    const body = JSON.parse(response.body)
    assert.ok(body.orderId)
    assert.strictEqual(body.status, 'pending')
    assert.ok(body.websocketUrl)
  })

  it('should reject invalid order request', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/api/orders/execute',
      payload: {
        tokenIn: 'SOL',
        // Missing tokenOut and amountIn
      },
    })

    assert.strictEqual(response.statusCode, 400)
  })

  it('should reject negative amount', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/api/orders/execute',
      payload: {
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amountIn: -100,
      },
    })

    assert.strictEqual(response.statusCode, 400)
  })

  it('should retrieve order status via GET /api/orders/:orderId', async () => {
    // First create an order
    const createResponse = await fastify.inject({
      method: 'POST',
      url: '/api/orders/execute',
      payload: {
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amountIn: 100,
      },
    })

    const { orderId } = JSON.parse(createResponse.body)

    // Then retrieve it
    const getResponse = await fastify.inject({
      method: 'GET',
      url: `/api/orders/${orderId}`,
    })

    assert.strictEqual(getResponse.statusCode, 200)
    const order = JSON.parse(getResponse.body)
    assert.strictEqual(order.orderId, orderId)
    assert.strictEqual(order.tokenIn, 'SOL')
    assert.strictEqual(order.tokenOut, 'USDC')
    assert.strictEqual(order.amountIn, 100)
  })

  it('should return 404 for non-existent order', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/api/orders/non-existent-id',
    })

    assert.strictEqual(response.statusCode, 404)
  })

  it('should return queue metrics', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/api/orders/metrics/queue',
    })

    assert.strictEqual(response.statusCode, 200)
    const metrics = JSON.parse(response.body)
    assert.ok(typeof metrics.waiting === 'number')
    assert.ok(typeof metrics.active === 'number')
    assert.ok(typeof metrics.completed === 'number')
    assert.ok(typeof metrics.failed === 'number')
  })
})

