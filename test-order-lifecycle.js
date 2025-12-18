const WebSocket = require('ws');
const http = require('http');

// Helper function for fetch (Node.js < 18 compatibility)
async function fetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {},
    };

    const req = http.request(requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          json: async () => JSON.parse(data),
          text: async () => data,
        });
      });
    });

    req.on('error', reject);
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

async function testOrderLifecycle() {
  console.log('🚀 Starting order lifecycle test...\n');

  // Step 1: Submit order
  console.log('1️⃣ Submitting order...');
  const response = await fetch('http://localhost:3000/api/orders/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tokenIn: 'SOL',
      tokenOut: 'USDC',
      amountIn: 100,
      userId: 'test-user'
    })
  });

  const order = await response.json();
  console.log('✅ Order submitted:', order.orderId);
  console.log('   Status:', order.status);
  console.log('   WebSocket URL:', order.websocketUrl);
  console.log('');

  // Step 2: Connect WebSocket
  console.log('2️⃣ Connecting to WebSocket for live updates...\n');
  
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:3000${order.websocketUrl}`);
    const statuses = [];
    let startTime = Date.now();

    ws.on('open', () => {
      console.log('✅ WebSocket connected\n');
      console.log('📊 Order Status Updates:\n');
    });

    ws.on('message', (data) => {
      const update = JSON.parse(data.toString());
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      
      statuses.push(update.status);
      
      console.log(`[${elapsed}s] Status: ${update.status.toUpperCase()}`);
      console.log(`   Message: ${update.message || 'N/A'}`);
      
      if (update.dexUsed) {
        console.log(`   DEX: ${update.dexUsed}`);
      }
      if (update.txHash) {
        console.log(`   TX Hash: ${update.txHash}`);
      }
      if (update.executedPrice) {
        console.log(`   Executed Price: ${update.executedPrice}`);
      }
      if (update.error) {
        console.log(`   Error: ${update.error}`);
      }
      console.log('');

      if (update.status === 'confirmed' || update.status === 'failed') {
        const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log('✅ Order lifecycle complete!');
        console.log(`   Total time: ${totalTime}s`);
        console.log(`   Status progression: ${statuses.join(' → ')}`);
        ws.close();
        resolve(update);
      }
    });

    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error);
      reject(error);
    });

    ws.on('close', () => {
      console.log('🔌 WebSocket closed');
    });
  });
}

// Run test
if (require.main === module) {
  testOrderLifecycle()
    .then(() => {
      console.log('\n✅ Test completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testOrderLifecycle };

