# Order Execution Engine

A high-performance order execution engine built with Fastify, TypeScript, and BullMQ that processes market orders with DEX routing and real-time WebSocket status updates.

## Order Type Choice: Market Order

**Why Market Order?**

Market orders were chosen as the initial implementation because they represent the most straightforward execution flow - immediate execution at the best available price. This allows us to focus on the core architecture: DEX routing, queue management, and real-time status updates. Market orders require minimal state management compared to limit orders (which need price monitoring) or sniper orders (which need launch detection).

**Extending to Other Order Types:**

- **Limit Orders**: Add a price monitoring service that checks current market prices against limit prices. When conditions are met, route to the execution flow. Store limit orders in a separate table with `targetPrice` and `expiryDate` fields.

- **Sniper Orders**: Implement a token launch detection service that monitors new token deployments or migrations. When a target token is detected, immediately execute the order. This requires integration with Solana program event listeners or DEX launch APIs.

## Architecture

### Components

1. **DEX Router** (`src/services/dex-router.ts`)
   - Fetches quotes from both Raydium and Meteora
   - Compares prices and selects best execution venue
   - Mock implementation with realistic delays and price variance

2. **Order Executor** (`src/services/order-executor.ts`)
   - Manages order lifecycle: pending → routing → building → submitted → confirmed/failed
   - Handles WebSocket status updates
   - Updates database with execution results

3. **Order Queue** (`src/services/order-queue.ts`)
   - BullMQ-based queue system
   - Processes up to 10 orders concurrently
   - Rate limit: 100 orders/minute
   - Exponential backoff retry (max 3 attempts)

4. **HTTP → WebSocket Pattern** (`src/routes/order.ts`)
   - POST `/api/orders/execute` creates order and returns orderId
   - GET `/api/orders/execute?orderId=xxx` upgrades to WebSocket for live updates
   - Single endpoint handles both protocols

### Tech Stack

- **Runtime**: Node.js + TypeScript
- **Framework**: Fastify (with WebSocket support)
- **Queue**: BullMQ + Redis
- **Database**: PostgreSQL (order history) + Redis (active orders)
- **Testing**: Node.js test runner + c8 coverage

## Setup Instructions

### Prerequisites

- Node.js 18+ 
- PostgreSQL 14+
- Redis 6+

### Installation

#### Quick Start (Using Docker - Recommended)

1. **Clone the repository**
   ```bash
   git clone https://github.com/0xitsHimanshu/eterna-labs-assignment.git
   cd Order-Execution
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start PostgreSQL and Redis with Docker**
   ```bash
   docker-compose up -d
   ```
   This will start both services in the background. Wait a few seconds for them to be ready.

4. **Build and run**
   ```bash
   # Development mode (with hot reload)
   npm run dev

   # Production mode
   npm start
   ```

The server will start on `http://localhost:3000`

#### Manual Setup

If you prefer to run PostgreSQL and Redis manually:

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set up environment variables** (optional, defaults provided)
   Create a `.env` file:
   ```env
   # Database
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=order_execution
   DB_USER=postgres
   DB_PASSWORD=postgres

   # Redis
   REDIS_HOST=localhost
   REDIS_PORT=6379

   # Server
   PORT=3000
   ```

3. **Set up PostgreSQL database**
   ```bash
   # Create database
   createdb order_execution
   ```
   The schema will be automatically created on first run.

4. **Start Redis**
   ```bash
   redis-server
   ```

5. **Build and run**
   ```bash
   npm run dev
   ```

> **Note:** See `QUICKSTART.md` for detailed troubleshooting and setup instructions.

## API Endpoints

### POST `/api/orders/execute`
Submit a new order for execution.

**Request Body:**
```json
{
  "tokenIn": "SOL",
  "tokenOut": "USDC",
  "amountIn": 100,
  "userId": "user-123" // optional
}
```

**Response:**
```json
{
  "orderId": "uuid-here",
  "message": "Order submitted successfully",
  "websocketUrl": "/api/orders/execute?orderId=uuid-here",
  "status": "pending"
}
```

### GET `/api/orders/:orderId`
Retrieve order status.

**Response:**
```json
{
  "orderId": "uuid-here",
  "tokenIn": "SOL",
  "tokenOut": "USDC",
  "amountIn": 100,
  "amountOut": 95.5,
  "executedPrice": 0.955,
  "status": "confirmed",
  "dexUsed": "raydium",
  "txHash": "0x...",
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:05Z"
}
```

### GET `/api/orders/metrics/queue`
Get queue metrics.

**Response:**
```json
{
  "waiting": 5,
  "active": 3,
  "completed": 100,
  "failed": 2
}
```

### WebSocket `/api/orders/execute?orderId={orderId}`
Connect via WebSocket to receive real-time status updates.

**Status Progression:**
- `pending` - Order received and queued
- `routing` - Comparing DEX prices
- `building` - Creating transaction
- `submitted` - Transaction sent to network
- `confirmed` - Transaction successful (includes txHash)
- `failed` - Execution failed (includes error)

**Example WebSocket Message:**
```json
{
  "orderId": "uuid-here",
  "status": "routing",
  "message": "Comparing DEX prices...",
  "dexUsed": "raydium",
  "txHash": "0x...",
  "executedPrice": 0.955
}
```

## Testing

### Unit/Integration Tests

Run tests:
```bash
npm test
```

Test coverage includes:
- DEX router logic (quote comparison, swap execution)
- Queue behavior (concurrency, rate limiting)
- WebSocket lifecycle (connection, status updates)
- Order execution flow (status progression)
- Error handling and retries

### Order Lifecycle Simulation

Test the complete order lifecycle with real-time updates:

```bash
# Make sure server is running first
npm run dev

# In another terminal, run the lifecycle test
npm run test:lifecycle
```

Or use the test script directly:
```bash
node test-order-lifecycle.js
```

This will:
1. Submit an order
2. Connect via WebSocket
3. Show real-time status updates as the order progresses
4. Display the complete lifecycle: `pending → routing → building → submitted → confirmed`

**See `docs/ORDER_LIFECYCLE_SIMULATION.md` for detailed simulation guide.**

## API Collections

- **Postman**: `postman_collection.json`
- **Insomnia**: `insomnia_collection.json`

Import these collections to test the API endpoints.

## Development

### Project Structure

```
src/
├── app.ts                 # Fastify app setup
├── routes/
│   └── order.ts          # Order endpoints (HTTP + WebSocket)
├── services/
│   ├── dex-router.ts     # DEX routing logic
│   ├── order-executor.ts # Order execution service
│   └── order-queue.ts    # BullMQ queue management
├── plugins/
│   └── order-queue.ts    # Order queue plugin
├── db/
│   └── client.ts         # PostgreSQL client
├── redis/
│   └── client.ts         # Redis client
└── types/
    └── order.ts          # TypeScript types

test/
├── services/             # Unit tests
├── routes/               # Route tests
└── integration/          # Integration tests
```

### Key Design Decisions

1. **Mock DEX Implementation**: Chosen to focus on architecture and flow rather than blockchain complexity. Easy to swap with real SDKs later.

2. **Single Endpoint Pattern**: POST and WebSocket on same path simplifies client implementation - submit order, then upgrade connection.

3. **BullMQ for Queue Management**: Provides built-in concurrency limits, rate limiting, and retry logic with exponential backoff.

4. **PostgreSQL + Redis**: PostgreSQL for persistent order history, Redis for active order tracking and queue backend.

5. **Status Progression**: Clear state machine ensures traceability and allows clients to show progress to users.

## Deployment

### Environment Variables for Production

```env
DB_HOST=your-db-host
DB_PORT=5432
DB_NAME=order_execution
DB_USER=your-db-user
DB_PASSWORD=your-db-password

REDIS_HOST=your-redis-host
REDIS_PORT=6379

PORT=3000
NODE_ENV=production
```
