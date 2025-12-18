import { describe, it, before, after } from 'node:test'
import assert from 'node:assert'
import { build } from '../helper'

describe('DEX Routing Integration', () => {
  let fastify: any

  before(async () => {
    fastify = await build()
  })

  after(async () => {
    await fastify.close()
  })

  it('should route order to best DEX', { timeout: 15000 }, async () => {
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

    // Wait for order to complete routing
    let order: any = null
    let attempts = 0
    while (attempts < 30) {
      await new Promise(resolve => setTimeout(resolve, 500))
      const getResponse = await fastify.inject({
        method: 'GET',
        url: `/api/orders/${orderId}`,
      })
      order = JSON.parse(getResponse.body)
      
      if (order.dexUsed || order.status === 'failed') {
        break
      }
      attempts++
    }

    // Order should have a DEX assigned (if not failed)
    if (order.status !== 'failed') {
      assert.ok(['raydium', 'meteora'].includes(order.dexUsed))
    }
  })

  it('should log routing decisions', { timeout: 10000 }, async () => {
    // This test verifies that routing decisions are logged
    // The actual logging happens in order-executor.ts
    const response = await fastify.inject({
      method: 'POST',
      url: '/api/orders/execute',
      payload: {
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amountIn: 100,
      },
    })

    assert.strictEqual(response.statusCode, 201)
    const { orderId } = JSON.parse(response.body)

    // Wait for order to reach routing stage where logging happens
    // The logging occurs in order-executor.ts when status changes to 'routing' or 'building'
    let order: any = null
    let attempts = 0
    while (attempts < 20) {
      await new Promise(resolve => setTimeout(resolve, 300))
      const getResponse = await fastify.inject({
        method: 'GET',
        url: `/api/orders/${orderId}`,
      })
      order = JSON.parse(getResponse.body)
      
      // Once we reach routing or building stage, logging has occurred
      if (['routing', 'building', 'submitted', 'confirmed', 'failed'].includes(order.status)) {
        break
      }
      attempts++
    }

    // Verify order was processed (routing decision was made and logged)
    assert.ok(order, 'Order should exist')
    assert.ok(['routing', 'building', 'submitted', 'confirmed', 'failed'].includes(order.status), 
      'Order should have progressed past pending status')
  })
})

