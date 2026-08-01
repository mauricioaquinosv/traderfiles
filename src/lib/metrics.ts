type Trade = {
  id: string
  symbol: string
  side: string
  entry_price: number
  exit_price: number | null
  quantity: number
  entry_date: string
  notes: string | null
}

export function calculatePnL(trade: Trade): number | null {
  if (trade.exit_price === null) return null
  const diff = trade.side === 'long'
    ? trade.exit_price - trade.entry_price
    : trade.entry_price - trade.exit_price
  return diff * trade.quantity
}

export function calculateMetrics(trades: Trade[]) {
  const closedTrades = trades.filter((t) => t.exit_price !== null)
  const pnls = closedTrades.map((t) => calculatePnL(t)!)

  const totalPnL = pnls.reduce((sum, pnl) => sum + pnl, 0)

  const wins = pnls.filter((pnl) => pnl > 0)
  const losses = pnls.filter((pnl) => pnl < 0)

  const winRate = closedTrades.length > 0
    ? (wins.length / closedTrades.length) * 100
    : 0

  const avgWin = wins.length > 0
    ? wins.reduce((sum, pnl) => sum + pnl, 0) / wins.length
    : 0

  const avgLoss = losses.length > 0
    ? losses.reduce((sum, pnl) => sum + pnl, 0) / losses.length
    : 0

  const grossProfit = wins.reduce((sum, pnl) => sum + pnl, 0)
  const grossLoss = Math.abs(losses.reduce((sum, pnl) => sum + pnl, 0))
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 0

  const expectancy = closedTrades.length > 0 ? totalPnL / closedTrades.length : 0

  const sortedByDate = [...closedTrades].sort(
    (a, b) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime()
  )

  let cumulative = 0
  const equityCurve = sortedByDate.map((trade, index) => {
    cumulative += calculatePnL(trade)!
    return {
      trade: index + 1,
      pnl: parseFloat(cumulative.toFixed(2)),
    }
  })

  return {
    totalPnL,
    winRate,
    avgWin,
    avgLoss,
    profitFactor,
    expectancy,
    totalTrades: trades.length,
    closedTrades: closedTrades.length,
    openTrades: trades.length - closedTrades.length,
    equityCurve,
  }
}