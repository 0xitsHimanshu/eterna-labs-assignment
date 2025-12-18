import { Pool } from 'pg'
import fp from 'fastify-plugin'

export interface DatabasePluginOptions {
  // Specify Database plugin options here
}

declare module 'fastify' {
  export interface FastifyInstance {
    db: Pool
  }
}

export default fp<DatabasePluginOptions>(async (fastify, opts) => {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'order_execution',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000, // Increased timeout
  })

  pool.on('error', (err: Error) => {
    fastify.log.error(err, 'Unexpected database error')
  })

  // Test connection with retry logic
  let retries = 5
  let connected = false
  
  while (retries > 0 && !connected) {
    try {
      await pool.query('SELECT NOW()')
      connected = true
      fastify.log.info('Database connected successfully')
    } catch (error: any) {
      retries--
      if (retries === 0) {
        fastify.log.error(
          { 
            error: error.message,
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || '5432',
            database: process.env.DB_NAME || 'order_execution'
          },
          'Failed to connect to database. Please ensure PostgreSQL is running.'
        )
        fastify.log.warn('Application will continue but database operations will fail.')
        // Don't throw - allow app to start without DB for development
      } else {
        fastify.log.warn(`Database connection failed, retrying... (${5 - retries}/5)`)
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }
  }

  if (connected) {
    // Initialize schema
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS orders (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          order_id VARCHAR(255) UNIQUE NOT NULL,
          user_id VARCHAR(255),
          token_in VARCHAR(255) NOT NULL,
          token_out VARCHAR(255) NOT NULL,
          amount_in NUMERIC NOT NULL,
          amount_out NUMERIC,
          executed_price NUMERIC,
          status VARCHAR(50) NOT NULL,
          dex_used VARCHAR(50),
          tx_hash VARCHAR(255),
          error_message TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_orders_order_id ON orders(order_id);
        CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
        CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
      `)

      fastify.log.info('Database schema initialized')
    } catch (error: any) {
      fastify.log.error({ error: error.message }, 'Failed to initialize database schema')
    }
  }

  fastify.decorate('db', pool)

  fastify.addHook('onClose', async () => {
    await pool.end()
  })
})

