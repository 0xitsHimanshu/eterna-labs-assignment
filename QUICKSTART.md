# Quick Start Guide

## Option 1: Using Docker (Recommended)

The easiest way to get started is using Docker Compose:

```bash
# Start PostgreSQL and Redis
docker-compose up -d

# Wait a few seconds for services to start, then start the app
npm run dev
```

## Option 2: Manual Setup

### Start PostgreSQL

**Windows:**
```bash
# If PostgreSQL is installed as a service
net start postgresql-x64-15

# Or start manually if installed via installer
# Check Services (services.msc) for PostgreSQL service
```

**macOS:**
```bash
# Using Homebrew
brew services start postgresql@15

# Or
pg_ctl -D /usr/local/var/postgres start
```

**Linux:**
```bash
# Ubuntu/Debian
sudo systemctl start postgresql

# Or
sudo service postgresql start
```

### Start Redis

**Windows:**
```bash
# Download Redis for Windows or use WSL
# Or use Docker: docker run -d -p 6379:6379 redis:7-alpine
```

**macOS:**
```bash
brew services start redis
```

**Linux:**
```bash
sudo systemctl start redis
# Or
redis-server
```

### Create Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE order_execution;

# Exit
\q
```

### Start the Application

```bash
npm install
npm run dev
```

## Troubleshooting

### PostgreSQL Connection Refused

1. **Check if PostgreSQL is running:**
   ```bash
   # Windows
   Get-Service postgresql*
   
   # macOS/Linux
   ps aux | grep postgres
   ```

2. **Check if port 5432 is in use:**
   ```bash
   # Windows
   netstat -an | findstr 5432
   
   # macOS/Linux
   lsof -i :5432
   ```

3. **Verify connection settings:**
   - Default: `localhost:5432`
   - Database: `order_execution`
   - User: `postgres`
   - Password: `postgres`

4. **Use Docker Compose (easiest):**
   ```bash
   docker-compose up -d
   ```

### Redis Connection Refused

1. **Check if Redis is running:**
   ```bash
   redis-cli ping
   # Should return: PONG
   ```

2. **Start Redis:**
   ```bash
   # Using Docker
   docker run -d -p 6379:6379 redis:7-alpine
   ```

### Environment Variables

Create a `.env` file in the root directory:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=order_execution
DB_USER=postgres
DB_PASSWORD=postgres

REDIS_HOST=localhost
REDIS_PORT=6379
```

## Verify Setup

Once everything is running, test the API:

```bash
# Health check (if you add one)
curl http://localhost:3000/

# Submit an order
curl -X POST http://localhost:3000/api/orders/execute \
  -H "Content-Type: application/json" \
  -d '{
    "tokenIn": "SOL",
    "tokenOut": "USDC",
    "amountIn": 100
  }'
```

