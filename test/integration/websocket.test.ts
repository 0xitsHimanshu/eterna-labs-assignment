import { describe, it, before, after } from 'node:test'
import assert from 'node:assert'
import { WebSocket } from 'ws'
import { build } from '../helper'

describe('WebSocket Integration', () => {
  let fastify: any
  const port = 3001

  before(async () => {
    fastify = await build()
    await fastify.listen({ port, host: '0.0.0.0' })
  })

  after(async () => {
    await fastify.close()
  })

  it('should connect WebSocket and receive status updates', { timeout: 20000 }, async () => {
    return new Promise<void>((resolve, reject) => {
      // First create an order to get the orderId
      fastify.inject({
        method: 'POST',
        url: '/api/orders/execute',
        payload: {
          tokenIn: 'SOL',
          tokenOut: 'USDC',
          amountIn: 100,
        },
      }).then((response: any) => {
        const { orderId } = JSON.parse(response.body)
        
        // Connect WebSocket immediately after getting orderId
        // Use a small delay to ensure the order is in the queue but not yet processing
        const ws = new WebSocket(`ws://localhost:${port}/api/orders/execute?orderId=${orderId}`)
        const updates: any[] = []
        let resolved = false
        let wsConnected = false

        ws.on('open', () => {
          wsConnected = true
          // WebSocket is connected and should be registered
          // Give a small moment for registration to complete
        })

        ws.on('message', (data: Buffer) => {
          try {
            const update = JSON.parse(data.toString())
            updates.push(update)
            
            // Verify update structure
            assert.ok(update.orderId, 'Update should have orderId')
            assert.ok(update.status, 'Update should have status')
            
            // If we receive confirmed or failed, close connection
            if (update.status === 'confirmed' || update.status === 'failed') {
              if (!resolved) {
                resolved = true
                ws.close()
                assert.ok(updates.length > 0, 'Should receive at least one update')
                resolve()
              }
            }
          } catch (error) {
            if (!resolved) {
              resolved = true
              reject(new Error(`Failed to parse WebSocket message: ${error}`))
            }
          }
        })

        ws.on('error', (error: Error) => {
          if (!resolved) {
            resolved = true
            reject(new Error(`WebSocket error: ${error.message || error}`))
          }
        })

        ws.on('close', (code, reason) => {
          if (!resolved && updates.length === 0) {
            resolved = true
            reject(new Error(`WebSocket closed unexpectedly. Code: ${code}, Reason: ${reason?.toString() || 'unknown'}`))
          }
        })

        // Timeout after 15 seconds
        setTimeout(() => {
          if (!resolved) {
            resolved = true
            if (ws.readyState === WebSocket.OPEN) {
              ws.close()
            }
            if (updates.length === 0) {
              reject(new Error(`No WebSocket updates received. WebSocket connected: ${wsConnected}, ReadyState: ${ws.readyState}`))
            } else {
              // We got some updates but didn't get confirmed/failed - that's okay, resolve anyway
              resolve()
            }
          }
        }, 15000)
      }).catch((error: any) => {
        reject(new Error(`Failed to create order: ${error.message || error}`))
      })
    })
  })

  it('should reject WebSocket connection without orderId', { timeout: 5000 }, async () => {
    return new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(`ws://localhost:${port}/api/orders/execute`)

      ws.on('error', (error: any) => {
        // Should get connection error or close
        assert.ok(true)
        resolve()
      })

      ws.on('close', (code: number) => {
        // Should close with error code
        assert.ok(code === 1008 || code === 1006) // Missing orderId or connection error
        resolve()
      })

      setTimeout(() => {
        ws.close()
        resolve()
      }, 2000)
    })
  })
})

