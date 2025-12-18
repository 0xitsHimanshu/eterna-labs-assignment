# API Collections Guide

This guide explains how to import and use the Postman and Insomnia collections for testing the Order Execution Engine API.

## 📦 Collections Included

- **Postman Collection**: `postman_collection.json`
- **Insomnia Collection**: `insomnia_collection.json`

Both collections contain the same endpoints and are ready to use.

---

## 🚀 Postman Setup

### Step 1: Import Collection

1. **Open Postman**
2. Click **Import** button (top left)
3. Select **File** tab
4. Choose `postman_collection.json`
5. Click **Import**

### Step 2: Configure Variables

1. Click on the collection name: **"Order Execution Engine API"**
2. Go to **Variables** tab
3. Verify/Update variables:
   - `baseUrl`: `http://localhost:3000` (default)
   - `orderId`: Leave empty (auto-populated after creating order)

### Step 3: Test the API (Correct Order)

#### 1️⃣ Execute Order (First Request)

1. Open **"1. Orders"** → **"Execute Order"**
2. Click **Send**
3. **Copy the `orderId`** from the response:
   ```json
   {
     "orderId": "550e8400-e29b-41d4-a716-446655440000",
     "websocketUrl": "/api/orders/execute?orderId=550e8400-e29b-41d4-a716-446655440000",
     "status": "pending"
   }
   ```
4. The `orderId` is automatically saved to collection variables (via test script)

#### 2️⃣ Get Order Status (Check Progress)

1. Open **"1. Orders"** → **"Get Order Status"**
2. The `orderId` variable is automatically used
3. Click **Send** to check current status
4. Repeat to poll for updates

#### 3️⃣ Get Queue Metrics (Optional)

1. Open **"1. Orders"** → **"Get Queue Metrics"**
2. Click **Send**
3. View queue statistics

#### 4️⃣ WebSocket Updates (Real-time)

**Note:** Postman's WebSocket support varies by version. If WebSocket doesn't work:

**Option A: Use Postman WebSocket (if supported)**
1. Open **"2. WebSocket"** → **"Order Status Updates (WebSocket)"**
2. Ensure `orderId` variable is set
3. Click **Connect**

**Option B: Use Browser/Node.js (Recommended)**
```javascript
// Get orderId from Execute Order response first
const orderId = 'your-order-id-here';

const ws = new WebSocket(`ws://localhost:3000/api/orders/execute?orderId=${orderId}`);

ws.onmessage = (event) => {
  const update = JSON.parse(event.data);
  console.log('Status:', update.status);
  
  if (update.status === 'confirmed' || update.status === 'failed') {
    ws.close();
  }
};
```

---

## 🔧 Insomnia Setup

### Step 1: Import Collection

1. **Open Insomnia**
2. Click **Create** → **Import From** → **File**
3. Select `insomnia_collection.json`
4. Click **Import**

### Step 2: Configure Environment

1. Click **Manage Environments** (top right)
2. Select **"Base Environment"**
3. Verify/Update variables:
   - `base_url`: `http://localhost:3000`
   - `order_id`: Leave empty (set manually after creating order)

### Step 3: Test the API (Correct Order)

#### 1️⃣ Execute Order (First Request)

1. Open **"Orders"** → **"1. Execute Order"**
2. Click **Send**
3. **Copy the `orderId`** from response JSON
4. **Set the environment variable:**
   - Click **Manage Environments**
   - Paste `orderId` into `order_id` field
   - Save

#### 2️⃣ Get Order Status (Check Progress)

1. Open **"Orders"** → **"2. Get Order Status"**
2. The `order_id` variable is automatically used
3. Click **Send** to check status
4. Repeat to poll for updates

#### 3️⃣ Get Queue Metrics (Optional)

1. Open **"Orders"** → **"3. Get Queue Metrics"**
2. Click **Send**
3. View queue statistics

#### 4️⃣ WebSocket Updates (Real-time)

**Note:** Insomnia has limited WebSocket support. Use a WebSocket client instead:

```javascript
// Browser Console or Node.js
const orderId = 'your-order-id-here';
const ws = new WebSocket(`ws://localhost:3000/api/orders/execute?orderId=${orderId}`);

ws.onmessage = (event) => {
  const update = JSON.parse(event.data);
  console.log('Status:', update.status);
  console.log('Update:', update);
  
  if (update.status === 'confirmed' || update.status === 'failed') {
    console.log('Order completed!');
    ws.close();
  }
};
```

---

## 📋 Complete Testing Workflow

### Recommended Testing Sequence:

1. **Start Server**
   ```bash
   npm run dev
   ```

2. **Execute Order** (POST)
   - Submit an order
   - Copy `orderId` from response

3. **Connect WebSocket** (Real-time)
   - Use browser console or WebSocket client
   - Connect to `ws://localhost:3000/api/orders/execute?orderId=YOUR_ORDER_ID`
   - Watch for status updates

4. **Poll Order Status** (GET) - Optional
   - Use as fallback if WebSocket fails
   - Poll every few seconds

5. **Check Queue Metrics** (GET) - Optional
   - Monitor system health
   - Verify orders are processing

---

## 🧪 Example Test Scenarios

### Scenario 1: Single Order Flow

1. Execute Order → Get `orderId`
2. Connect WebSocket with `orderId`
3. Watch status progression: `pending` → `routing` → `building` → `submitted` → `confirmed`
4. Verify `txHash` and `executedPrice` in final update

### Scenario 2: Multiple Orders

1. Execute Order #1 → Get `orderId1`
2. Execute Order #2 → Get `orderId2`
3. Execute Order #3 → Get `orderId3`
4. Connect WebSocket for each order
5. Check Queue Metrics → Should show `active: 3` (or less if processing)
6. Monitor all orders completing

### Scenario 3: Error Handling

1. Execute Order with invalid data (e.g., negative `amountIn`)
2. Verify 400 error response
3. Execute valid order
4. Monitor for `failed` status if execution fails

---

## 🔍 Troubleshooting

### Issue: `orderId` variable not set

**Postman:**
- Check collection variables tab
- Manually set `orderId` if test script didn't run
- Re-run "Execute Order" request

**Insomnia:**
- Manually copy `orderId` from response
- Paste into environment variable `order_id`

### Issue: WebSocket not connecting

1. Verify server is running: `npm run dev`
2. Check WebSocket URL format: `ws://localhost:3000/api/orders/execute?orderId=...`
3. Ensure `orderId` is valid UUID
4. Check server logs for connection errors

### Issue: 404 on WebSocket

1. Verify WebSocket plugin is registered (check server logs)
2. Ensure route is registered before other GET routes
3. Check URL: Must be `ws://` not `http://`
4. Verify `orderId` query parameter is present

### Issue: No status updates

1. Check if order is in queue (Get Queue Metrics)
2. Verify WebSocket connection is open
3. Check server logs for order processing
4. Try polling with GET `/api/orders/:orderId` as fallback

---

## 📚 Additional Resources

- **API Documentation**: See `README.md`
- **WebSocket Guide**: See `docs/WEBSOCKET_UPGRADE.md`
- **Setup Instructions**: See `QUICKSTART.md`

---

## 💡 Tips

1. **Use Environment Variables**: Set `baseUrl` to switch between dev/staging/prod
2. **Save Responses**: Postman/Insomnia can save responses for reference
3. **Use Pre-request Scripts**: Auto-generate test data
4. **Monitor Logs**: Keep server logs open to see order processing
5. **Test Concurrent Orders**: Submit multiple orders to test queue system

---

## 🎯 Quick Reference

| Endpoint | Method | Purpose | Order |
|----------|--------|---------|-------|
| `/api/orders/execute` | POST | Submit order | 1st |
| `/api/orders/execute?orderId=xxx` | WebSocket | Live updates | 2nd |
| `/api/orders/:orderId` | GET | Check status | 2nd (fallback) |
| `/api/orders/metrics/queue` | GET | Queue stats | Anytime |

---

Happy Testing! 🚀

