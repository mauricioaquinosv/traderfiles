export type Account = {
  id: string
  user_id: string
  name: string
  initial_balance: number
  currency: string
  broker: string | null
  created_at: string
}

export type Trade = {
  id: string
  account_id: string
  user_id: string
  symbol: string
  direction: 'long' | 'short'
  entry_price: number | null
  exit_price: number | null
  quantity: number
  commission: number
  stop_loss: number | null
  take_profit: number | null
  pnl: number | null
  strategy: string | null
  tags: string[]
  notes: string | null
  entry_date: string
  created_at: string
}

export type Transaction = {
  id: string
  account_id: string
  user_id: string
  type: 'deposit' | 'withdrawal'
  amount: number
  date: string
  note: string | null
  created_at: string
}