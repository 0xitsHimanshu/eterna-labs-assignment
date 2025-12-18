import { Order, OrderStatus, OrderStatusUpdate } from '../types/order'
import { MockDexRouter } from './dex-router'
import { FastifyInstance } from 'fastify'
// Import db type declaration
import '../db/client'

export class OrderExecutor {
  private dexRouter: MockDexRouter
  private fastify: FastifyInstance
  private wsConnections: Map<string, any> = new Map()

  constructor(fastify: FastifyInstance) {
    this.fastify = fastify
    this.dexRouter = new MockDexRouter()
  }

  /**
   * Register WebSocket connection for an order
   */
  registerWebSocket(orderId: string, ws: any): void {
    this.wsConnections.set(orderId, ws)
    ws.on('close', () => {
      this.wsConnections.delete(orderId)
    })
  }

  /**
   * Send status update via WebSocket
   */
  private async sendStatusUpdate(orderId: string, update: OrderStatusUpdate): Promise<void> {
    const ws = this.wsConnections.get(orderId)
    if (ws && ws.readyState === 1) { // WebSocket.OPEN
      try {
        ws.send(JSON.stringify(update))
      } catch (error) {
        this.fastify.log.error({ error, orderId }, 'Failed to send WebSocket update')
      }
    }
  }

  /**
   * Update order status in database
   */
  private async updateOrderStatus(
    orderId: string,
    status: OrderStatus,
    updates: Partial<Order> = {}
  ): Promise<void> {
    // Map Order fields to database column names
    const fieldMapping: Record<string, string> = {
      dexUsed: 'dex_used',
      amountOut: 'amount_out',
      executedPrice: 'executed_price',
      txHash: 'tx_hash',
      errorMessage: 'error_message',
    }

    const updateFields: string[] = ['status = $1']
    const values: any[] = [status]
    let paramIndex = 2

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined && value !== null) {
        const dbColumn = fieldMapping[key] || key
        updateFields.push(`${dbColumn} = $${paramIndex}`)
        values.push(value)
        paramIndex++
      }
    }

    values.push(orderId)
    const query = `
      UPDATE orders 
      SET ${updateFields.join(', ')}, updated_at = NOW()
      WHERE order_id = $${paramIndex}
    `

    await this.fastify.db.query(query, values)
  }

  /**
   * Execute order with status progression
   */
  async executeOrder(order: Order): Promise<void> {
    const { orderId, tokenIn, tokenOut, amountIn } = order

    try {
      // Status: pending → routing
      await this.sendStatusUpdate(orderId, {
        orderId,
        status: 'routing',
        message: 'Comparing DEX prices...',
      })
      await this.updateOrderStatus(orderId, 'routing')

      // Get best quote from DEX router
      const bestQuote = await this.dexRouter.getBestQuote(tokenIn, tokenOut, amountIn)
      
      // Log detailed price comparison
      if (bestQuote.comparison) {
        const { raydium, meteora } = bestQuote.comparison
        const priceDifference = Math.abs(raydium.amountOut - meteora.amountOut)
        const priceDifferencePercent = ((priceDifference / Math.max(raydium.amountOut, meteora.amountOut)) * 100).toFixed(2)
        
        this.fastify.log.info({
          orderId,
          comparison: {
            raydium: {
              price: raydium.price,
              fee: raydium.fee,
              amountOut: raydium.amountOut,
            },
            meteora: {
              price: meteora.price,
              fee: meteora.fee,
              amountOut: meteora.amountOut,
            },
            priceDifference: priceDifference.toFixed(4),
            priceDifferencePercent: `${priceDifferencePercent}%`,
          },
          selected: {
            dex: bestQuote.dex,
            price: bestQuote.price,
            amountOut: bestQuote.amountOut,
            reason: bestQuote.dex === 'raydium' 
              ? `Raydium offers ${priceDifference.toFixed(4)} more tokens (${priceDifferencePercent}% better)`
              : `Meteora offers ${priceDifference.toFixed(4)} more tokens (${priceDifferencePercent}% better)`,
          },
        }, 'DEX routing decision - Price comparison completed')
      } else {
        this.fastify.log.info({
          orderId,
          selectedDex: bestQuote.dex,
          price: bestQuote.price,
          amountOut: bestQuote.amountOut,
        }, 'DEX routing decision')
      }

      // Status: routing → building
      await this.sendStatusUpdate(orderId, {
        orderId,
        status: 'building',
        message: `Building transaction for ${bestQuote.dex}...`,
        dexUsed: bestQuote.dex,
      })
      await this.updateOrderStatus(orderId, 'building', {
        dexUsed: bestQuote.dex,
        amountOut: bestQuote.amountOut,
      })

      // Status: building → submitted
      await this.sendStatusUpdate(orderId, {
        orderId,
        status: 'submitted',
        message: 'Transaction submitted to network...',
        dexUsed: bestQuote.dex,
      })
      await this.updateOrderStatus(orderId, 'submitted', {
        dexUsed: bestQuote.dex,
      })

      // Execute swap
      const swapResult = await this.dexRouter.executeSwap(
        bestQuote.dex,
        tokenIn,
        tokenOut,
        amountIn,
        bestQuote.amountOut
      )

      // Status: submitted → confirmed
      await this.sendStatusUpdate(orderId, {
        orderId,
        status: 'confirmed',
        message: 'Transaction confirmed successfully',
        txHash: swapResult.txHash,
        executedPrice: swapResult.executedPrice,
        dexUsed: bestQuote.dex,
      })
      await this.updateOrderStatus(orderId, 'confirmed', {
        txHash: swapResult.txHash,
        executedPrice: swapResult.executedPrice,
        amountOut: swapResult.actualAmountOut,
        dexUsed: bestQuote.dex,
      })

    } catch (error: any) {
      const errorMessage = error.message || 'Unknown error occurred'
      
      this.fastify.log.error({ error, orderId }, 'Order execution failed')

      // Status: failed
      await this.sendStatusUpdate(orderId, {
        orderId,
        status: 'failed',
        error: errorMessage,
      })
      await this.updateOrderStatus(orderId, 'failed', {
        errorMessage,
      })
    }
  }
}

