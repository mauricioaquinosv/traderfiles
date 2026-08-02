'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import type { Trade } from '@/lib/types'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'
import { useAccount } from '@/contexts/AccountContext'
import {
  AreaChart, Area, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadialBarChart, RadialBar, PolarAngleAxis,
  RadarChart, PolarGrid, PolarRadiusAxis, Radar,
} from 'recharts'
import { Info } from 'lucide-react'

const fmtMoney = (n: number) =>
  `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [trades, setTrades] = useState<Trade[]>([])
  const [accentColor, setAccentColor] = useState('#4A47A3')
  const router = useRouter()
  const supabase = createClient()
  const { activeAccountId, activeAccount, loading: accountLoading } = useAccount()

  useEffect(() => {
    const computed = getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim()
    if (computed) setAccentColor(computed)
  }, [])

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
      } else {
        setUser(user)
      }
      setAuthLoading(false)
    }
    getUser()
  }, [router, supabase])

  useEffect(() => {
    const loadTrades = async () => {
      if (!activeAccountId) {
        setTrades([])
        return
      }
      const { data, error } = await supabase
        .from('trades')
        .select('*')
        .eq('account_id', activeAccountId)
        .order('entry_date', { ascending: false })

      if (!error && data) setTrades(data)
    }
    if (!accountLoading) loadTrades()
  }, [activeAccountId, accountLoading, supabase])

  if (authLoading || accountLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-bg)' }}>
        <p style={{ color: 'var(--color-text-secondary)' }}>Cargando...</p>
      </div>
    )
  }

  const closedTrades = trades.filter((t) => t.pnl !== null)
  const pnls = closedTrades.map((t) => t.pnl!)
  const netPnl = pnls.reduce((sum, p) => sum + p, 0)
  const wins = pnls.filter((p) => p > 0)
  const losses = pnls.filter((p) => p < 0)
  const winRate = closedTrades.length > 0 ? (wins.length / closedTrades.length) * 100 : 0
  const grossProfit = wins.reduce((s, p) => s + p, 0)
  const grossLoss = Math.abs(losses.reduce((s, p) => s + p, 0))
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 0

  const currentBalance = (activeAccount?.initial_balance ?? 0) + netPnl

  const sortedByDate = [...closedTrades].sort(
    (a, b) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime()
  )
  let cumulative = 0
  let peak = 0
  let maxDrawdown = 0
  const equityCurve = sortedByDate.map((t, i) => {
    cumulative += t.pnl!
    peak = Math.max(peak, cumulative)
    maxDrawdown = Math.max(maxDrawdown, peak - cumulative)
    return { trade: i + 1, pnl: parseFloat(cumulative.toFixed(2)) }
  })

  // P&L agrupado por día (para el gráfico de barras y day win %)
  const pnlByDay: Record<string, number> = {}
  sortedByDate.forEach((t) => {
    const day = new Date(t.entry_date).toISOString().slice(0, 10)
    pnlByDay[day] = (pnlByDay[day] ?? 0) + t.pnl!
  })
  const dailyBars = Object.entries(pnlByDay)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .slice(-14)
    .map(([day, pnl]) => ({ day: day.slice(5), pnl: parseFloat(pnl.toFixed(2)) }))

  const tradingDays = Object.keys(pnlByDay).length
  const winningDays = Object.values(pnlByDay).filter((v) => v > 0).length
  const dayWinPct = tradingDays > 0 ? (winningDays / tradingDays) * 100 : 0

  const avgWin = wins.length > 0 ? wins.reduce((s, p) => s + p, 0) / wins.length : 0
  const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s, p) => s + p, 0) / losses.length) : 0
  const winProb = winRate / 100
  const expectedValue = (winProb * avgWin) - ((1 - winProb) * avgLoss)

  const rrTrades = trades.filter((t) => t.entry_price && t.stop_loss && t.take_profit)
  const rrValues = rrTrades.map((t) => {
    const risk = Math.abs(t.entry_price! - t.stop_loss!)
    const reward = Math.abs(t.take_profit! - t.entry_price!)
    return risk > 0 ? reward / risk : 0
  })
  const avgRR = rrValues.length > 0 ? rrValues.reduce((s, v) => s + v, 0) / rrValues.length : 0

  const consistency = Math.max(
    0,
    100 - (maxDrawdown > 0 && netPnl > 0
      ? Math.min(100, (maxDrawdown / (netPnl + maxDrawdown || 1)) * 100)
      : (netPnl < 0 ? 70 : 20))
  )
  const winRateScore = Math.min(100, winRate)
  const profitFactorScore = Math.min(100, (profitFactor === Infinity ? 100 : profitFactor) * 33)
  const ddScore = Math.max(0, 100 - Math.min(100, (maxDrawdown / (Math.abs(netPnl) + maxDrawdown + 1)) * 140))
  const rrScore = Math.min(100, avgRR * 33)

  const radarData = [
    { dimension: 'Consistencia', value: consistency },
    { dimension: 'Win Rate', value: winRateScore },
    { dimension: 'Profit Factor', value: profitFactorScore },
    { dimension: 'Max Drawdown', value: ddScore },
    { dimension: 'Risk/Reward', value: rrScore },
  ]
  const overallScore = Math.round((consistency + winRateScore + profitFactorScore + ddScore + rrScore) / 5)

  const gaugeData = [{ value: winRate, fill: accentColor }]
  // Punto donde la curva cruza cero, para pintar verde arriba / rojo abajo
  const pnlValues = equityCurve.map((p) => p.pnl)
  const maxPnl = pnlValues.length ? Math.max(...pnlValues, 0) : 0
  const minPnl = pnlValues.length ? Math.min(...pnlValues, 0) : 0
  const zeroOffset = maxPnl <= 0 ? 0 : minPnl >= 0 ? 1 : maxPnl / (maxPnl - minPnl)

  const recentTrades = [...trades]
    .sort((a, b) => new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime())
    .slice(0, 6)

 const kpiRow1 = [
    {
      label: 'Realized PNL', value: fmtMoney(netPnl), color: netPnl >= 0 ? 'var(--color-green)' : 'var(--color-red)',
      tooltip: "Total profit or loss from trades you've already closed.",
    },
    {
      label: 'Winrate', value: closedTrades.length ? `${winRate.toFixed(1)}%` : '—', color: 'var(--color-text)',
      tooltip: 'The percentage of trades you have made profit in.',
    },
    {
      label: 'Profit Factor', value: closedTrades.length ? profitFactor.toFixed(2) : '—', color: 'var(--color-text)',
      tooltip: 'Calculated by dividing total gains by total losses. A value above 1 means you are profitable overall.',
    },
  ]

  const kpiRow2 = [
    { label: 'Day win %', value: tradingDays ? `${dayWinPct.toFixed(1)}%` : '—', color: 'var(--color-text)', tooltip: null as string | null },
    {
      label: 'Expected Value', value: closedTrades.length ? fmtMoney(expectedValue) : '—',
      color: expectedValue > 0 ? 'var(--color-green)' : expectedValue < 0 ? 'var(--color-red)' : 'var(--color-text)',
      tooltip: 'The average result you would expect from an investment or decision, based on previous performance.',
    },
    { label: 'Max drawdown', value: closedTrades.length ? fmtMoney(-maxDrawdown) : '—', color: 'var(--color-red)', tooltip: null as string | null },
    {
      label: 'Average RR', value: rrValues.length ? `${avgRR.toFixed(2)}:1` : '—', color: 'var(--color-text)',
      tooltip: 'Shows your potential gain for each unit of risk. Higher is better.',
    },
  ]

  const today = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="min-h-screen">
      <Sidebar email={user?.email ?? ''} />

      <main className="ml-[72px]">
        <div className="flex items-center justify-between px-8 py-5 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <div>
            <p className="text-xs capitalize" style={{ color: 'var(--color-text-secondary)' }}>{today}</p>
            <h1 className="font-display text-xl font-semibold" style={{ color: 'var(--color-text)' }}>Dashboard</h1>
          </div>
          <Topbar />
        </div>

        <div className="p-8">
          <div>
            {/* KPIs fila 1: Balance + Realized PNL + Winrate + Profit Factor */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="relative glass-card overflow-hidden p-5">
                <p className="text-xs mb-2 uppercase tracking-wide relative z-10" style={{ color: 'var(--color-text-secondary)' }}>Balance actual</p>
                <p className="font-display text-xl font-bold relative z-10" style={{ color: 'var(--color-text)' }}>{fmtMoney(currentBalance)}</p>
                {equityCurve.length > 1 && (
                  <div className="absolute bottom-0 left-0 right-0 h-11 opacity-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={equityCurve}>
                        <defs>
                          <linearGradient id="sparkBalance" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#2ECC8F" stopOpacity={0.5} />
                            <stop offset="100%" stopColor="#2ECC8F" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <Area type="monotone" dataKey="pnl" stroke="#2ECC8F" strokeWidth={1.5} fill="url(#sparkBalance)" dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
              {kpiRow1.map((card) => (
                <div key={card.label} className="relative glass-card overflow-hidden p-5">
                  {card.label === 'Realized PNL' && equityCurve.length > 1 && (
                    <div className="absolute bottom-0 left-0 right-0 h-11 opacity-40">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={equityCurve}>
                          <defs>
                            <linearGradient id="sparkPnl" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={netPnl >= 0 ? '#2ECC8F' : '#F0555A'} stopOpacity={0.5} />
                              <stop offset="100%" stopColor={netPnl >= 0 ? '#2ECC8F' : '#F0555A'} stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <Area type="monotone" dataKey="pnl" stroke={netPnl >= 0 ? '#2ECC8F' : '#F0555A'} strokeWidth={1.5} fill="url(#sparkPnl)" dot={false} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  <div className="relative z-10 flex items-center gap-1.5 mb-2">
                    <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--color-text-secondary)' }}>{card.label}</p>
                    {card.tooltip && (
                      <div className="group relative">
                        <Info size={12} style={{ color: 'var(--color-text-tertiary)' }} />
                        <span
                          className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 w-[190px] rounded-lg border px-3 py-2 text-[11px] font-normal normal-case leading-snug opacity-0 transition group-hover:opacity-100 z-50"
                          style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                        >
                          {card.tooltip}
                        </span>
                      </div>
                    )}
                  </div>
                  <p className="relative z-10 font-display text-xl font-bold" style={{ color: card.color }}>{card.value}</p>
                </div>
              ))}
            </div>

            {/* KPIs fila 2 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {kpiRow2.map((card) => (
                <div key={card.label} className="glass-card p-5">
                  <div className="relative z-10 flex items-center gap-1.5 mb-2">
                    <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--color-text-secondary)' }}>{card.label}</p>
                    {card.tooltip && (
                      <div className="group relative">
                        <Info size={12} style={{ color: 'var(--color-text-tertiary)' }} />
                        <span
                          className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 w-[190px] rounded-lg border px-3 py-2 text-[11px] font-normal normal-case leading-snug opacity-0 transition group-hover:opacity-100 z-50"
                          style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                        >
                          {card.tooltip}
                        </span>
                      </div>
                    )}
                  </div>
                  <p className="relative z-10 font-display text-xl font-bold" style={{ color: card.color }}>{card.value}</p>
                </div>
              ))}
            </div>

            {/* Curva acumulada | Radar */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="glass-panel p-6">
                <p className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text)' }}>Daily Net Cumulative P&L</p>
                {equityCurve.length === 0 ? (
                <div className="h-52 flex items-center justify-center">
                  <p className="text-sm text-center" style={{ color: 'var(--color-text-muted)' }}>Cierra al menos un trade para ver tu curva de rendimiento.</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={equityCurve}>
                    <defs>
                      <linearGradient id="splitFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset={zeroOffset} stopColor="#2ECC8F" stopOpacity={0.35} />
                        <stop offset={zeroOffset} stopColor="#F0555A" stopOpacity={0.35} />
                      </linearGradient>
                      <linearGradient id="splitStroke" x1="0" y1="0" x2="0" y2="1">
                        <stop offset={zeroOffset} stopColor="#2ECC8F" />
                        <stop offset={zeroOffset} stopColor="#F0555A" />
                      </linearGradient>
                      <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="4" result="blur" />
                        <feMerge>
                          <feMergeNode in="blur" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                    <XAxis dataKey="trade" stroke="var(--color-text-tertiary)" fontSize={11} />
                    <YAxis stroke="var(--color-text-tertiary)" fontSize={11} tickFormatter={(v) => fmtMoney(v)} width={70} />
                    <Tooltip formatter={(value: any) => fmtMoney(Number(value))} contentStyle={{ backgroundColor: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: '8px' }} labelStyle={{ color: 'var(--color-text-secondary)' }} />
                    <Area
                      type="monotone"
                      dataKey="pnl"
                      stroke="url(#splitStroke)"
                      strokeWidth={2.5}
                      fill="url(#splitFill)"
                      dot={false}
                      activeDot={{ r: 4 }}
                      style={{ filter: 'url(#glow)' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
              </div>

              <div className="glass-panel p-6">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Overall score</p>
                  {closedTrades.length > 0 && (
                    <span className="text-xs font-semibold px-3 py-1 rounded-full border" style={{ borderColor: accentColor, color: accentColor }}>
                      {overallScore}/100
                    </span>
                  )}
                </div>
                {closedTrades.length === 0 ? (
                  <div className="h-52 flex items-center justify-center">
                    <p className="text-sm text-center" style={{ color: 'var(--color-text-secondary)' }}>Cierra trades para ver tu perfil.</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <RadarChart data={radarData} outerRadius="70%">
                      <PolarGrid stroke="var(--color-border)" />
                      <PolarAngleAxis dataKey="dimension" tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }} />
                      <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                      <Radar dataKey="value" stroke={accentColor} fill={accentColor} fillOpacity={0.18} strokeWidth={2} dot={{ fill: accentColor, r: 3 }} />
                      <Tooltip contentStyle={{ backgroundColor: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: '8px' }} labelStyle={{ color: 'var(--color-text-secondary)' }} />
                    </RadarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Net Daily P&L | Trades recientes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="glass-panel p-6">
                <p className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text)' }}>Net Daily P&L</p>
                {dailyBars.length === 0 ? (
                  <div className="h-52 flex items-center justify-center">
                    <p className="text-sm text-center" style={{ color: 'var(--color-text-secondary)' }}>Sin datos suficientes todavía.</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={dailyBars}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                      <XAxis dataKey="day" stroke="var(--color-text-tertiary)" fontSize={10} />
                      <YAxis stroke="var(--color-text-tertiary)" fontSize={11} tickFormatter={(v) => fmtMoney(v)} width={70} />
                      <Tooltip formatter={(value: any) => fmtMoney(Number(value))} contentStyle={{ backgroundColor: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: '8px' }} labelStyle={{ color: 'var(--color-text-secondary)' }} />
                      <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                        {dailyBars.map((entry, i) => (
                          <Cell key={i} fill={entry.pnl >= 0 ? 'var(--color-green)' : 'var(--color-red)'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="glass-panel p-6">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Trades recientes</p>
                  <button onClick={() => router.push('/trades')} className="text-xs hover:opacity-80" style={{ color: 'var(--color-text-secondary)' }}>
                    Ver todos
                  </button>
                </div>
                {recentTrades.length === 0 ? (
                  <div className="h-52 flex items-center justify-center">
                    <p className="text-sm text-center" style={{ color: 'var(--color-text-secondary)' }}>Sin trades registrados.</p>
                  </div>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ color: 'var(--color-text-tertiary)' }}>
                        <th className="text-left font-medium pb-2">Fecha</th>
                        <th className="text-left font-medium pb-2">Símbolo</th>
                        <th className="text-left font-medium pb-2">Dir.</th>
                        <th className="text-right font-medium pb-2">Net P&L</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentTrades.map((t) => (
                        <tr key={t.id} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                          <td className="py-2" style={{ color: 'var(--color-text-secondary)' }}>
                            {new Date(t.entry_date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="py-2 font-medium" style={{ color: 'var(--color-text)' }}>{t.symbol}</td>
                          <td className="py-2">
                            <span
                              className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                              style={{
                                background: t.direction === 'long' ? 'var(--color-green-bg)' : 'var(--color-red-bg)',
                                color: t.direction === 'long' ? 'var(--color-green)' : 'var(--color-red)',
                              }}
                            >
                              {t.direction === 'long' ? 'Long' : 'Short'}
                            </span>
                          </td>
                          <td className="py-2 text-right font-semibold" style={{ color: t.pnl === null ? 'var(--color-text-secondary)' : t.pnl >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>
                            {t.pnl !== null ? fmtMoney(t.pnl) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}