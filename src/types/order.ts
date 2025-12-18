export type OrderStatus = 'pending' | 'routing' | 'building' | 'submitted' | 'confirmed' | 'failed'

export type DexName = 'raydium' | 'meteora'

export interface Order {
  orderId: string
  userId?: string
  tokenIn: string
  tokenOut: string
  amountIn: number
  amountOut?: number
  executedPrice?: number
  status: OrderStatus
  dexUsed?: DexName
  txHash?: string
  errorMessage?: string
  createdAt: Date
  updatedAt: Date
}

export interface OrderRequest {
  tokenIn: string
  tokenOut: string
  amountIn: number
  userId?: string
}

export interface DexQuote {
  dex: DexName
  price: number
  fee: number
  amountOut: number
  executionTime: number // estimated milliseconds
}

export interface OrderStatusUpdate {
  orderId: string
  status: OrderStatus
  message?: string
  txHash?: string
  error?: string
  executedPrice?: number
  dexUsed?: DexName
}

