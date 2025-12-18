import { describe, it, before } from 'node:test'
import assert from 'node:assert'
import { MockDexRouter } from '../../src/services/dex-router'

describe('MockDexRouter', () => {
  let router: MockDexRouter

  before(() => {
    router = new MockDexRouter()
  })

  it('should get Raydium quote', async () => {
    const quote = await router.getRaydiumQuote('SOL', 'USDC', 100)
    
    assert.ok(quote)
    assert.strictEqual(quote.dex, 'raydium')
    assert.ok(quote.price > 0)
    assert.ok(quote.fee === 0.003)
    assert.ok(quote.amountOut > 0)
    assert.ok(quote.executionTime >= 2000 && quote.executionTime <= 3000)
  })

  it('should get Meteora quote', async () => {
    const quote = await router.getMeteoraQuote('SOL', 'USDC', 100)
    
    assert.ok(quote)
    assert.strictEqual(quote.dex, 'meteora')
    assert.ok(quote.price > 0)
    assert.ok(quote.fee === 0.002)
    assert.ok(quote.amountOut > 0)
    assert.ok(quote.executionTime >= 2000 && quote.executionTime <= 3000)
  })

  it('should return best quote comparing both DEXs', async () => {
    const bestQuote = await router.getBestQuote('SOL', 'USDC', 100)
    
    assert.ok(bestQuote)
    assert.ok(['raydium', 'meteora'].includes(bestQuote.dex))
    assert.ok(bestQuote.amountOut > 0)
  })

  it('should execute swap and return transaction hash', async () => {
    const result = await router.executeSwap('raydium', 'SOL', 'USDC', 100, 95)
    
    assert.ok(result)
    assert.ok(result.txHash.startsWith('0x'))
    assert.strictEqual(result.txHash.length, 66) // 0x + 64 hex chars
    assert.ok(result.executedPrice > 0)
    assert.ok(result.actualAmountOut > 0)
    assert.ok(result.actualAmountOut <= 95) // Should account for slippage
  })

  it('should return consistent base prices for same pair', async () => {
    const quote1 = await router.getRaydiumQuote('SOL', 'USDC', 100)
    const quote2 = await router.getRaydiumQuote('SOL', 'USDC', 100)
    
    // Prices should be in similar range (within variance)
    const priceDiff = Math.abs(quote1.price - quote2.price) / quote1.price
    assert.ok(priceDiff < 0.1) // Less than 10% difference
  })
})

