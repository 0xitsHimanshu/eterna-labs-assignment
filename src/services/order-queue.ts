import { Queue, Worker, Job } from 'bullmq'
import { Order } from '../types/order'
import { OrderExecutor } from './order-executor'
import { FastifyInstance } from 'fastify'
import Redis from 'ioredis'

export class OrderQueue {
  private queue: Queue
  private worker: Worker
  private orderExecutor: OrderExecutor
  private fastify: FastifyInstance

  constructor(fastify: FastifyInstance, redis: Redis) {
    this.fastify = fastify
    this.orderExecutor = new OrderExecutor(fastify)

    // Create BullMQ queue
    this.queue = new Queue('order-execution', {
      connection: redis,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000, // Start with 2 seconds
        },
        removeOnComplete: {
          age: 3600, // Keep completed jobs for 1 hour
          count: 1000, // Keep last 1000 completed jobs
        },
        removeOnFail: {
          age: 86400, // Keep failed jobs for 24 hours
        },
      },
    })

    // Create worker with concurrency limit
    this.worker = new Worker(
      'order-execution',
      async (job: Job<Order>) => {
        const order = job.data
        this.fastify.log.info({ orderId: order.orderId, jobId: job.id }, 'Processing order')
        await this.orderExecutor.executeOrder(order)
      },
      {
        connection: redis,
        concurrency: 10, // Process up to 10 orders concurrently
        limiter: {
          max: 100, // Max 100 jobs
          duration: 60000, // Per minute
        },
      }
    )

    this.worker.on('completed', (job) => {
      this.fastify.log.info({ jobId: job.id, orderId: job.data.orderId }, 'Order completed')
    })

    this.worker.on('failed', (job, err) => {
      this.fastify.log.error(
        { jobId: job?.id, orderId: job?.data?.orderId, error: err },
        'Order failed'
      )
    })
  }

  /**
   * Add order to queue
   */
  async addOrder(order: Order): Promise<void> {
    await this.queue.add('execute-order', order, {
      jobId: order.orderId, // Use orderId as jobId for idempotency
    })
  }

  /**
   * Register WebSocket connection for order updates
   */
  registerWebSocket(orderId: string, ws: any): void {
    this.orderExecutor.registerWebSocket(orderId, ws)
  }

  /**
   * Get queue metrics
   */
  async getMetrics() {
    const [waiting, active, completed, failed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
    ])

    return {
      waiting,
      active,
      completed,
      failed,
    }
  }

  /**
   * Close queue and worker
   */
  async close(): Promise<void> {
    await this.worker.close()
    await this.queue.close()
  }
}

