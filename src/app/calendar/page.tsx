'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import type { Trade } from '@/lib/types'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'
import { useAccount } from '@/contexts/AccountContext'
import { ChevronLeft, ChevronRight, Settings2 } from 'lucide-react'

const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const DOW_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const fmtMoney = (n: number) =>
  `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtMoneySigned = (n: number) => `${n > 0 ? '+' : ''}${fmtMoney(n)}`
const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`

function dayKey(dateStr: string) {
  return new Date(dateStr).toISOString().slice(0, 10)
}

function RingSvg({ pct, color, size = 56, stroke = 6 }: { pct: number; color: string; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(100, pct || 0))
  const offset = c - (clamped / 100) * c
  return (
    <svg className="absolute top-0 left-0" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-border)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c.toFixed(2)}
        strokeDashoffset={offset.toFixed(2)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  )
}

function computeStats(trades: Trade[]) {
  const closed = trades.filter((t) => t.pnl !== null)
  const pnls = closed.map((t) => t.pnl!)
  const wins = pnls.filter((p) => p > 0)
  const losses = pnls.filter((p) => p < 0)
  const totalTrades = closed.length
  const winRate = totalTrades > 0 ? (wins.length / totalTrades) * 100 : 0
  const avgWin = wins.length > 0 ? wins.reduce((s, p) => s + p, 0) / wins.length : 0
  const avgLoss = losses.length > 0 ? losses.reduce((s, p) => s + p, 0) / losses.length : 0
  const grossProfit = wins.reduce((s, p) => s + p, 0)
  const grossLoss = Math.abs(losses.reduce((s, p) => s + p, 0))
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : totalTrades > 0 ? Infinity : 0

  const rrTrades = trades.filter((t) => t.entry_price && t.stop_loss && t.take_profit)
  const rrValues = rrTrades.map((t) => {
    const risk = Math.abs(t.entry_price! - t.stop_loss!)
    const reward = Math.abs(t.take_profit! - t.entry_price!)
    return risk > 0 ? reward / risk : 0
  })
  const avgRR = rrValues.length > 0 ? rrValues.reduce((s, v) => s + v, 0) / rrValues.length : 0

  return { totalTrades, wins: wins.length, losses: losses.length, winRate, avgWin, avgLoss, profitFactor, avgRR }
}

export default function CalendarPage() {
  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [trades, setTrades] = useState<Trade[]>([])
  const [cursor, setCursor] = useState(() => ({ year: new Date().getFullYear(), month: new Date().getMonth() }))
  const [statsPeriod, setStatsPeriod] = useState<'monthly' | 'overall'>('monthly')
  const [cellInfo, setCellInfo] = useState<string[]>(['pnl', 'count'])
  const [showInfoMenu, setShowInfoMenu] = useState(false)
  const infoMenuRef = useRef<HTMLDivElement>(null)

  const router = useRouter()
  const supabase = createClient()
  const { activeAccountId, activeAccount, loading: accountLoading } = useAccount()

  useEffect(() => {
    const stored = localStorage.getItem('calendarCellInfo')
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed) && parsed.length) setCellInfo(parsed)
      } catch {}
    }
  }, [])

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (infoMenuRef.current && !infoMenuRef.current.contains(e.target as Node)) setShowInfoMenu(false)
    }
    document.addEventListener('click', onClickOutside)
    return () => document.removeEventListener('click', onClickOutside)
  }, [])

  const toggleCellInfo = (key: string) => {
    const next = cellInfo.includes(key) ? cellInfo.filter((k) => k !== key) : [...cellInfo, key]
    setCellInfo(next)
    localStorage.setItem('calendarCellInfo', JSON.stringify(next))
  }

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

  const { year, month } = cursor
  const closedTrades = trades.filter((t) => t.pnl !== null)

  const byDay: Record<string, { pnl: number; count: number }> = {}
  closedTrades.forEach((t) => {
    const key = dayKey(t.entry_date)
    if (!byDay[key]) byDay[key] = { pnl: 0, count: 0 }
    byDay[key].pnl += t.pnl!
    byDay[key].count += 1
  })

  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`
  const monthTrades = closedTrades.filter((t) => dayKey(t.entry_date).startsWith(monthKey))
  const monthlyMetrics = computeStats(monthTrades)
  const overallMetrics = computeStats(closedTrades)
  const statsMetrics = statsPeriod === 'overall' ? overallMetrics : monthlyMetrics

  const todayKey = new Date().toISOString().slice(0, 10)
  const todayPnl = closedTrades.filter((t) => dayKey(t.entry_date) === todayKey).reduce((s, t) => s + t.pnl!, 0)
  const overallNetPnl = closedTrades.reduce((s, t) => s + t.pnl!, 0)
  const initialBalance = activeAccount?.initial_balance ?? 0
  const balanceNow = initialBalance + overallNetPnl
  const balanceBeforeToday = balanceNow - todayPnl
  const todayPct = balanceBeforeToday !== 0 ? (todayPnl / Math.abs(balanceBeforeToday)) * 100 : 0
  const overallPct = initialBalance ? (overallNetPnl / Math.abs(initialBalance)) * 100 : 0

  const firstDay = new Date(year, month, 1)
  const startOffset = (firstDay.getDay() + 6) % 7 // lunes = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const tradeYears = closedTrades.map((t) => Number(dayKey(t.entry_date).slice(0, 4))).filter((n) => !isNaN(n))
  const minYear = Math.min(new Date().getFullYear() - 5, ...(tradeYears.length ? tradeYears : [new Date().getFullYear()]))
  const maxYear = Math.max(new Date().getFullYear() + 1, ...(tradeYears.length ? tradeYears : [new Date().getFullYear()]))
  const years: number[] = []
  for (let yy = maxYear; yy >= minYear; yy--) years.push(yy)

  const changeMonth = (delta: number) => {
    let m = month + delta
    let y = year
    if (m < 0) { m = 11; y-- }
    if (m > 11) { m = 0; y++ }
    setCursor({ year: y, month: m })
  }

  const pfDisplay = statsMetrics.totalTrades > 0 ? (statsMetrics.profitFactor === Infinity ? '∞' : statsMetrics.profitFactor.toFixed(2)) : '0.00'
  const pfRingPct = statsMetrics.totalTrades > 0 ? Math.max(0, Math.min(100, statsMetrics.profitFactor === Infinity ? 100 : (statsMetrics.profitFactor / 2) * 100)) : 0
  const winPct = statsMetrics.totalTrades > 0 ? (statsMetrics.wins / statsMetrics.totalTrades) * 100 : 0
  const lossPct = statsMetrics.totalTrades > 0 ? (statsMetrics.losses / statsMetrics.totalTrades) * 100 : 0

  const today = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const calRows = Math.ceil((startOffset + daysInMonth) / 7)

  return (
    <div className="min-h-screen">
      <Sidebar email={user?.email ?? ''} />

      <main className="ml-[72px] h-screen flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-8 py-5 border-b flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
          <div>
            <p className="text-xs capitalize" style={{ color: 'var(--color-text-secondary)' }}>{today}</p>
            <h1 className="font-display text-[22px] font-semibold" style={{ color: 'var(--color-text)' }}>Calendario de P&L</h1>
          </div>
          <Topbar />
        </div>

        <div className="flex-1 min-h-0 p-8 overflow-hidden">
          <div className="w-full h-full flex flex-col">
            <div className="flex gap-4 flex-1 min-h-0">
              {/* ---- Sidebar: PNLS + STATISTICS ---- */}
              <aside className="w-[236px] flex-shrink-0 flex flex-col gap-2.5 overflow-y-auto">
                <div className="rounded-[14px] border p-3.5" style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-glass-border)' }}>
                  <div className="text-[10.5px] uppercase tracking-wide font-bold mb-2.5" style={{ color: 'var(--color-text-tertiary)' }}>PNLS</div>
                  <div>
                    <div className="text-[11.5px] mb-[3px]" style={{ color: 'var(--color-text-secondary)' }}>Today&apos;s PnL</div>
                    <div className="text-lg font-bold leading-tight" style={{ color: todayPnl >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>{fmtMoneySigned(todayPnl)}</div>
                    <div className="text-[11px] font-semibold mt-0.5" style={{ color: todayPnl >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>{fmtPct(todayPct)}</div>
                  </div>
                  <div className="h-px my-2.5" style={{ background: 'var(--color-glass-border)' }} />
                  <div>
                    <div className="text-[11.5px] mb-[3px]" style={{ color: 'var(--color-text-secondary)' }}>Overall PnL</div>
                    <div className="text-lg font-bold leading-tight" style={{ color: overallNetPnl >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>{fmtMoneySigned(overallNetPnl)}</div>
                    <div className="text-[11px] font-semibold mt-0.5" style={{ color: overallNetPnl >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>{fmtPct(overallPct)}</div>
                  </div>
                </div>

                <div className="rounded-[14px] border p-3.5 flex-1 flex flex-col" style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-glass-border)' }}>
                  <div className="text-[10.5px] uppercase tracking-wide font-bold mb-2.5" style={{ color: 'var(--color-text-tertiary)' }}>STATISTICS</div>
                  <div className="flex rounded-[9px] p-[3px] gap-0.5 mb-2.5" style={{ background: 'var(--color-surface)' }}>
                    <button
                      onClick={() => setStatsPeriod('monthly')}
                      className="flex-1 text-xs font-semibold rounded-[7px] py-1.5 transition"
                      style={statsPeriod === 'monthly' ? { background: 'var(--color-surface-2)', color: 'var(--color-text)', boxShadow: 'var(--color-shadow)' } : { color: 'var(--color-text-secondary)' }}
                    >
                      Monthly
                    </button>
                    <button
                      onClick={() => setStatsPeriod('overall')}
                      className="flex-1 text-xs font-semibold rounded-[7px] py-1.5 transition"
                      style={statsPeriod === 'overall' ? { background: 'var(--color-surface-2)', color: 'var(--color-text)', boxShadow: 'var(--color-shadow)' } : { color: 'var(--color-text-secondary)' }}
                    >
                      Overall
                    </button>
                  </div>

                  <div className="mb-0.5">
                    <div className="text-[11.5px] mb-1" style={{ color: 'var(--color-text-secondary)' }}>Avg Win/Loss:</div>
                    <div className="text-[12.5px] font-bold flex items-center gap-1.5 flex-wrap">
                      <span style={{ color: 'var(--color-green)' }}>{fmtMoney(statsMetrics.avgWin)} win</span>
                      <span style={{ color: 'var(--color-text-tertiary)', fontWeight: 400 }}>|</span>
                      <span style={{ color: 'var(--color-red)' }}>{fmtMoney(statsMetrics.avgLoss)} loss</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-xs py-1.5 border-t" style={{ borderColor: 'var(--color-glass-border)', color: 'var(--color-text-secondary)' }}>
                    <span>Avg RR:</span>
                    <span className="font-bold" style={{ color: 'var(--color-text)' }}>1 / {statsMetrics.totalTrades && statsMetrics.avgRR ? statsMetrics.avgRR.toFixed(2) : '0.00'}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs py-1.5 border-t" style={{ borderColor: 'var(--color-glass-border)', color: 'var(--color-text-secondary)' }}>
                    <span>Wins:</span>
                    <span className="font-bold" style={{ color: 'var(--color-green)' }}>{statsMetrics.wins} ({winPct.toFixed(0)}%)</span>
                  </div>
                  <div className="flex justify-between items-center text-xs py-1.5 border-t" style={{ borderColor: 'var(--color-glass-border)', color: 'var(--color-text-secondary)' }}>
                    <span>Losses:</span>
                    <span className="font-bold" style={{ color: 'var(--color-red)' }}>{statsMetrics.losses} ({lossPct.toFixed(0)}%)</span>
                  </div>

                  <div className="flex justify-around mt-auto pt-3 pb-4">
                    <div className="relative w-14 h-14 flex items-center justify-center">
                      <RingSvg pct={statsMetrics.totalTrades > 0 ? Math.max(0, Math.min(100, statsMetrics.winRate)) : 0} color="var(--color-green)" />
                      <div className="text-xs font-bold relative z-10" style={{ color: 'var(--color-text)' }}>{statsMetrics.totalTrades ? statsMetrics.winRate.toFixed(0) : '0'} %</div>
                      <div className="absolute top-full mt-[7px] left-1/2 -translate-x-1/2 text-[10px] whitespace-nowrap" style={{ color: 'var(--color-text-tertiary)' }}>Winrate</div>
                    </div>
                    <div className="relative w-14 h-14 flex items-center justify-center">
                      <RingSvg pct={pfRingPct} color="var(--color-accent)" />
                      <div className="text-xs font-bold relative z-10" style={{ color: 'var(--color-text)' }}>{pfDisplay}</div>
                      <div className="absolute top-full mt-[7px] left-1/2 -translate-x-1/2 text-[10px] whitespace-nowrap" style={{ color: 'var(--color-text-tertiary)' }}>Net Profit Ratio</div>
                    </div>
                  </div>
                </div>
              </aside>

              {/* ---- Main: header + grid ---- */}
              <div className="flex-1 min-w-0 flex flex-col min-h-0">
                <div className="flex items-center justify-between flex-wrap gap-4 mb-[18px] flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => changeMonth(-1)}
                      className="w-[38px] h-[38px] rounded-[10px] border flex items-center justify-center transition"
                      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text-secondary)' }}
                    >
                      <ChevronLeft size={17} />
                    </button>
                    <select
                      value={month}
                      onChange={(e) => setCursor({ year, month: Number(e.target.value) })}
                      className="rounded-lg border px-2.5 py-1.5 text-[12.5px] font-semibold cursor-pointer outline-none"
                      style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                    >
                      {MONTH_NAMES.map((mn, i) => (
                        <option key={mn} value={i}>{mn}</option>
                      ))}
                    </select>
                    <select
                      value={year}
                      onChange={(e) => setCursor({ year: Number(e.target.value), month })}
                      className="rounded-lg border px-2.5 py-1.5 text-[12.5px] font-semibold cursor-pointer outline-none"
                      style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                    >
                      {years.map((yy) => (
                        <option key={yy} value={yy}>{yy}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => changeMonth(1)}
                      className="w-[38px] h-[38px] rounded-[10px] border flex items-center justify-center transition"
                      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text-secondary)' }}
                    >
                      <ChevronRight size={17} />
                    </button>
                  </div>

                  <div className="relative flex-shrink-0" ref={infoMenuRef}>
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowInfoMenu((v) => !v) }}
                      className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition"
                      style={{ borderColor: 'transparent', color: 'var(--color-text-secondary)', background: 'transparent' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-surface-hover)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <Settings2 size={14} />
                      Info en celdas
                    </button>
                    {showInfoMenu && (
                      <div
                        className="absolute top-[calc(100%+6px)] right-0 z-20 rounded-[10px] border p-1.5 min-w-[190px]"
                        style={{ background: 'var(--color-glass-bg-strong)', borderColor: 'var(--color-glass-border)', boxShadow: 'var(--color-shadow)', backdropFilter: 'blur(20px)' }}
                      >
                        <label className="flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] cursor-pointer hover:opacity-80" style={{ color: 'var(--color-text)' }}>
                          <input type="checkbox" checked={cellInfo.includes('pnl')} onChange={() => toggleCellInfo('pnl')} />
                          Monto P&L
                        </label>
                        <label className="flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] cursor-pointer hover:opacity-80" style={{ color: 'var(--color-text)' }}>
                          <input type="checkbox" checked={cellInfo.includes('count')} onChange={() => toggleCellInfo('count')} />
                          Cantidad de operaciones
                        </label>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex-1 min-h-0 flex flex-col">
                  <div className="grid grid-cols-7 gap-2 mb-2 flex-shrink-0">
                    {DOW_NAMES.map((d) => (
                      <div key={d} className="text-center text-[10.5px] uppercase font-semibold tracking-wide py-1" style={{ color: 'var(--color-text-tertiary)' }}>{d}</div>
                    ))}
                  </div>

                  <div
                    className="grid grid-cols-7 gap-2 flex-1 min-h-0"
                    style={{ gridTemplateRows: `repeat(${calRows}, 1fr)` }}
                  >
                    {Array.from({ length: startOffset }).map((_, i) => (
                      <div key={`empty-${i}`} />
                    ))}
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                      const d = i + 1
                      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
                      const info = byDay[dateStr]
                      const isToday = dateStr === todayKey
                      const isWin = info && info.pnl >= 0
                      const isLoss = info && info.pnl < 0
                      return (
                        <div
                          key={d}
                          className="min-h-0 min-w-0 rounded-xl border p-2.5 flex flex-col transition"
                          style={{
                            background: isWin ? 'var(--color-green-bg)' : isLoss ? 'var(--color-red-bg)' : 'var(--color-glass-bg)',
                            borderColor: isToday ? 'var(--color-accent)' : info ? 'transparent' : 'var(--color-glass-border)',
                            boxShadow: isToday ? 'inset 0 0 0 1px var(--color-accent)' : 'none',
                          }}
                        >
                          <div className="text-xs font-semibold text-center" style={{ color: isToday ? 'var(--color-accent)' : 'var(--color-text-secondary)' }}>{d}</div>
                          {info && (
                            <div className="mt-auto flex flex-col items-center">
                              {cellInfo.includes('pnl') && (
                                <div className="text-xs font-bold" style={{ color: info.pnl >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>
                                  {fmtMoney(info.pnl)}
                                </div>
                              )}
                              {cellInfo.includes('count') && (
                                <div className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
                                  {info.count} trade{info.count > 1 ? 's' : ''}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}