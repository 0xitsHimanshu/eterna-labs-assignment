import { DexQuote, DexName } from '../types/order'

// Sleep utility
const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Generate mock transaction hash
const generateMockTxHash = (): string => {
  return '0x' + Array.from({ length: 64 }, () => 
    Math.floor(Math.random() * 16).toString(16)
  ).join('')
}

export class MockDexRouter {
  private basePrices: Map<string, number> = new Map()

  /**
   * Get base price for a token pair (cached for consistency)
   */
  private getBasePrice(tokenIn: string, tokenOut: string): number {
    const pair = `${tokenIn}-${tokenOut}`
    if (!this.basePrices.has(pair)) {
      // Generate a base price between 0.1 and 10
      this.basePrices.set(pair, 0.1 + Math.random() * 9.9)
    }
    return this.basePrices.get(pair)!
  }

  /**
   * Get quote from Raydium
   * Simulates network delay and price variance
   */
  async getRaydiumQuote(
    tokenIn: string,
    tokenOut: string,
    amountIn: number
  ): Promise<DexQuote> {
    // Simulate network delay
    await sleep(200 + Math.random() * 100)

    const basePrice = this.getBasePrice(tokenIn, tokenOut)
    // Raydium price variance: 0.98 to 1.02 (2% variance)
    const price = basePrice * (0.98 + Math.random() * 0.04)
    const fee = 0.003 // 0.3% fee
    const amountOut = amountIn * price * (1 - fee)
    const executionTime = 2000 + Math.random() * 1000 // 2-3 seconds

    return {
      dex: 'raydium',
      price,
      fee,
      amountOut,
      executionTime,
    }
  }

  /**
   * Get quote from Meteora
   * Simulates network delay and price variance
   */
  async getMeteoraQuote(
    tokenIn: string,
    tokenOut: string,
    amountIn: number
  ): Promise<DexQuote> {
    // Simulate network delay
    await sleep(200 + Math.random() * 100)

    const basePrice = this.getBasePrice(tokenIn, tokenOut)
    // Meteora price variance: 0.97 to 1.02 (5% variance)
    const price = basePrice * (0.97 + Math.random() * 0.05)
    const fee = 0.002 // 0.2% fee
    const amountOut = amountIn * price * (1 - fee)
    const executionTime = 2000 + Math.random() * 1000 // 2-3 seconds

    return {
      dex: 'meteora',
      price,
      fee,
      amountOut,
      executionTime,
    }
  }

  /**
   * Compare quotes from both DEXs and select the best one
   */
  async getBestQuote(
    tokenIn: string,
    tokenOut: string,
    amountIn: number
  ): Promise<DexQuote & { comparison?: { raydium: DexQuote; meteora: DexQuote } }> {
    // Fetch quotes concurrently
    const [raydiumQuote, meteoraQuote] = await Promise.all([
      this.getRaydiumQuote(tokenIn, tokenOut, amountIn),
      this.getMeteoraQuote(tokenIn, tokenOut, amountIn),
    ])

    // Select DEX with better output amount (better price)
    const bestQuote = raydiumQuote.amountOut > meteoraQuote.amountOut
      ? raydiumQuote
      : meteoraQuote

    // Include comparison data for logging
    return {
      ...bestQuote,
      comparison: {
        raydium: raydiumQuote,
        meteora: meteoraQuote,
      },
    }
  }

  /**
   * Execute swap on chosen DEX (mock implementation)
   */
  async executeSwap(
    dex: DexName,
    tokenIn: string,
    tokenOut: string,
    amountIn: number,
    expectedAmountOut: number
  ): Promise<{ txHash: string; executedPrice: number; actualAmountOut: number }> {
    // Simulate transaction building and submission delay
    await sleep(1000 + Math.random() * 500)

    // Simulate network confirmation delay
    await sleep(2000 + Math.random() * 1000)

    // Simulate slight slippage (0.1% to 0.5%)
    const slippage = 0.001 + Math.random() * 0.004
    const actualAmountOut = expectedAmountOut * (1 - slippage)
    const executedPrice = actualAmountOut / amountIn

    return {
      txHash: generateMockTxHash(),
      executedPrice,
      actualAmountOut,
    }
  }
}

