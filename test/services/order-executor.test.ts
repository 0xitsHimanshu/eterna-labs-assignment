import { describe, it, before, after } from 'node:test'
import assert from 'node:assert'
import { OrderExecutor } from '../../src/services/order-executor'
import { Order } from '../../src/types/order'
import { build } from '../helper'

describe('OrderExecutor', () => {
  let fastify: any
  let executor: OrderExecutor

  before(async () => {
    fastify = await build()
    executor = new OrderExecutor(fastify)
  })

  after(async () => {
    await fastify.close()
  })

  it('should register WebSocket connection', () => {
    const mockWs = {
      readyState: 1,
      send: () => {},
      on: () => {},
    }
    
    executor.registerWebSocket('test-order-id', mockWs)
    // If no error thrown, registration succeeded
    assert.ok(true)
  })

  it('should execute order and update status', { timeout: 10000 }, async () => {
    const order: Order = {
      orderId: 'test-exec-order-1',
      tokenIn: 'SOL',
      tokenOut: 'USDC',
      amountIn: 100,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    // Create order in database first
    await fastify.db.query(
      `INSERT INTO orders (order_id, token_in, token_out, amount_in, status)
       VALUES ($1, $2, $3, $4, $5)`,
      [order.orderId, order.tokenIn, order.tokenOut, order.amountIn, 'pending']
    )

    // Execute order (this will take a few seconds)
    await executor.executeOrder(order)

    // Verify order was updated in database
    const result = await fastify.db.query(
      'SELECT * FROM orders WHERE order_id = $1',
      [order.orderId]
    )

    assert.strictEqual(result.rows.length, 1)
    const dbOrder = result.rows[0]
    assert.ok(['confirmed', 'failed'].includes(dbOrder.status))
    
    // Cleanup
    await fastify.db.query('DELETE FROM orders WHERE order_id = $1', [order.orderId])
  })
})

