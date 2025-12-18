import { FastifyPluginAsync } from 'fastify'
import { v4 as uuidv4 } from 'uuid'
import { OrderRequest, OrderStatus } from '../types/order'
import { WebSocket } from 'ws'

const order: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  // GET endpoint with WebSocket upgrade support - MUST be registered first
  // This handles WebSocket upgrades for live order status updates
  // When a WebSocket upgrade request comes in, Fastify automatically routes it here
  fastify.get('/api/orders/execute', { websocket: true }, (socket: WebSocket, req) => {
    const query = req.query as { orderId?: string }
    const orderId = query.orderId

    fastify.log.info({ 
      orderId, 
      url: req.url,
      headers: req.headers 
    }, 'WebSocket connection attempt')

    if (!orderId) {
      fastify.log.warn('WebSocket connection rejected: Missing orderId')
      socket.close(1008, 'Missing orderId')
      return
    }

    fastify.log.info({ orderId }, 'WebSocket connection upgraded successfully')

    // Register WebSocket connection for order updates
    if (fastify.orderQueue) {
      fastify.orderQueue.registerWebSocket(orderId, socket)
    } else {
      fastify.log.error('OrderQueue not available')
      socket.close(1011, 'Server error: OrderQueue not available')
      return
    }

    socket.on('close', () => {
      fastify.log.info({ orderId }, 'WebSocket connection closed')
    })

    socket.on('error', (error: Error) => {
      fastify.log.error({ error, orderId }, 'WebSocket error')
    })
  })

  // POST endpoint to submit order
  // After submitting, client can upgrade to WebSocket using the returned orderId
  fastify.post<{ Body: OrderRequest }>('/api/orders/execute', async (request, reply) => {
    const { tokenIn, tokenOut, amountIn, userId } = request.body

    // Validate input
    if (!tokenIn || !tokenOut || !amountIn || amountIn <= 0) {
      return reply.code(400).send({
        error: 'Invalid request',
        message: 'tokenIn, tokenOut, and amountIn (positive number) are required',
      })
    }

    // Generate order ID
    const orderId = uuidv4()

    try {
      // Create order record in database
      const result = await fastify.db.query(
        `INSERT INTO orders (
          order_id, user_id, token_in, token_out, amount_in, status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        RETURNING *`,
        [orderId, userId || null, tokenIn, tokenOut, amountIn, 'pending']
      )

      const order = result.rows[0]

      // Add order to queue
      await fastify.orderQueue.addOrder({
        orderId: order.order_id,
        userId: order.user_id,
        tokenIn: order.token_in,
        tokenOut: order.token_out,
        amountIn: parseFloat(order.amount_in),
        status: 'pending' as OrderStatus,
        createdAt: order.created_at,
        updatedAt: order.updated_at,
      })

      fastify.log.info({ orderId, tokenIn, tokenOut, amountIn }, 'Order submitted')

      // Return orderId and WebSocket upgrade URL
      // Client can use this URL to upgrade to WebSocket for live updates
      return reply.code(201).send({
        orderId,
        message: 'Order submitted successfully',
        websocketUrl: `/api/orders/execute?orderId=${orderId}`,
        upgradeInstructions: 'To receive live updates, connect to the websocketUrl via WebSocket',
        status: 'pending',
      })
    } catch (error: any) {
      fastify.log.error({ error, orderId }, 'Failed to create order')
      
      // Check if it's a duplicate orderId
      if (error.code === '23505') { // Unique violation
        return reply.code(409).send({
          error: 'Duplicate order',
          message: 'Order with this ID already exists',
        })
      }

      return reply.code(500).send({
        error: 'Internal server error',
        message: 'Failed to create order',
      })
    }
  })

  // GET endpoint to retrieve order status
  fastify.get<{ Params: { orderId: string } }>('/api/orders/:orderId', async (request, reply) => {
    const { orderId } = request.params

    try {
      const result = await fastify.db.query(
        'SELECT * FROM orders WHERE order_id = $1',
        [orderId]
      )

      if (result.rows.length === 0) {
        return reply.code(404).send({
          error: 'Not found',
          message: 'Order not found',
        })
      }

      const order = result.rows[0]
      return reply.send({
        orderId: order.order_id,
        userId: order.user_id,
        tokenIn: order.token_in,
        tokenOut: order.token_out,
        amountIn: parseFloat(order.amount_in),
        amountOut: order.amount_out ? parseFloat(order.amount_out) : undefined,
        executedPrice: order.executed_price ? parseFloat(order.executed_price) : undefined,
        status: order.status,
        dexUsed: order.dex_used,
        txHash: order.tx_hash,
        errorMessage: order.error_message,
        createdAt: order.created_at,
        updatedAt: order.updated_at,
      })
    } catch (error: any) {
      fastify.log.error({ error, orderId }, 'Failed to retrieve order')
      return reply.code(500).send({
        error: 'Internal server error',
        message: 'Failed to retrieve order',
      })
    }
  })

  // GET endpoint to retrieve queue metrics
  fastify.get('/api/orders/metrics/queue', async (request, reply) => {
    try {
      const metrics = await fastify.orderQueue.getMetrics()
      return reply.send(metrics)
    } catch (error: any) {
      fastify.log.error({ error }, 'Failed to get queue metrics')
      return reply.code(500).send({
        error: 'Internal server error',
        message: 'Failed to get queue metrics',
      })
    }
  })
}

export default order

