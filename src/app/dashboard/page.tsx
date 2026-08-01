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
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadialBarChart, RadialBar, PolarAngleAxis,
} from 'recharts'

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [trades, setTrades] = useState<Trade[]>([])
  const [accentColor, setAccentColor] = useState('#E8A33D')
  const router = useRouter()
  const supabase = createClient()
  const { activeAccountId, loading: accountLoading } = useAccount()

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
        <p style={{ color: 'var(--color-text-muted)' }}>Cargando...</p>
      </div>
    )
  }

  const closedTrades = trades.filter((t) => t.pnl !== null)
  const pnls = closedTrades.map((t) => t.pnl!)
  const totalPnL = pnls.reduce((sum, p) => sum + p, 0)
  const wins = pnls.filter((p) => p > 0)
  const losses = pnls.filter((p) => p < 0)
  const winRate = closedTrades.length > 0 ? (wins.length / closedTrades.length) * 100 : 0
  const grossProfit = wins.reduce((s, p) => s + p, 0)
  const grossLoss = Math.abs(losses.reduce((s, p) => s + p, 0))
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 0
  const expectancy = closedTrades.length > 0 ? totalPnL / closedTrades.length : 0

  const sortedByDate = [...closedTrades].sort(
    (a, b) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime()
  )
  let cumulative = 0
  const equityCurve = sortedByDate.map((t, i) => {
    cumulative += t.pnl!
    return { trade: i + 1, pnl: parseFloat(cumulative.toFixed(2)) }
  })

  const gaugeData = [{ value: winRate, fill: accentColor }]

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg)' }}>
      <Sidebar email={user?.email ?? ''} />

      <main className="ml-60 p-8">
        <div className="max-w-5xl mx-auto">
          <div className="mb-6">
            <h1 className="font-display text-2xl font-bold" style={{ color: 'var(--color-text)' }}>Dashboard</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>Resumen de tu desempeño como trader</p>
          </div>

          <Topbar />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="p-5 rounded-2xl border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
              <p className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>P&L Total</p>
              <p className="font-display text-2xl font-bold" style={{ color: totalPnL >= 0 ? '#34D399' : '#F87171' }}>
                {totalPnL >= 0 ? '+' : ''}{totalPnL.toFixed(2)}
              </p>
            </div>
            <div className="p-5 rounded-2xl border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
              <p className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>Profit Factor</p>
              <p className="font-display text-2xl font-bold" style={{ color: 'var(--color-text)' }}>{profitFactor.toFixed(2)}</p>
            </div>
            <div className="p-5 rounded-2xl border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
              <p className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>Expectativa</p>
              <p className="font-display text-2xl font-bold" style={{ color: expectancy >= 0 ? '#34D399' : '#F87171' }}>
                {expectancy >= 0 ? '+' : ''}{expectancy.toFixed(2)}
              </p>
            </div>
            <div className="p-5 rounded-2xl border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
              <p className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>Trades cerrados</p>
              <p className="font-display text-2xl font-bold" style={{ color: 'var(--color-text)' }}>{closedTrades.length}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-6 rounded-2xl border flex flex-col items-center justify-center" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
              <p className="text-xs mb-2 self-start" style={{ color: 'var(--color-text-muted)' }}>Win Rate</p>
              <div className="relative w-full h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart innerRadius="70%" outerRadius="100%" data={gaugeData} startAngle={90} endAngle={-270}>
                    <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                    <RadialBar dataKey="value" cornerRadius={20} background={{ fill: 'var(--color-border)' }} />
                  </RadialBarChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="font-display text-2xl font-bold" style={{ color: 'var(--color-text)' }}>{winRate.toFixed(0)}%</span>
                </div>
              </div>
            </div>

            <div className="md:col-span-2 p-6 rounded-2xl border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
              <p className="text-xs mb-4" style={{ color: 'var(--color-text-muted)' }}>Curva de rendimiento</p>
              {equityCurve.length === 0 ? (
                <div className="h-36 flex items-center justify-center">
                  <p className="text-sm text-center" style={{ color: 'var(--color-text-muted)' }}>Cierra al menos un trade para ver tu curva de rendimiento.</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={equityCurve}>
                    <defs>
                      <linearGradient id="colorPnl" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={accentColor} stopOpacity={0.35} />
                        <stop offset="95%" stopColor={accentColor} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                    <XAxis dataKey="trade" stroke="var(--color-text-muted)" fontSize={11} />
                    <YAxis stroke="var(--color-text-muted)" fontSize={11} />
                    <Tooltip contentStyle={{ backgroundColor: 'var(--color-surface-alt)', border: '1px solid var(--color-border)', borderRadius: '8px' }} labelStyle={{ color: 'var(--color-text-muted)' }} />
                    <Area type="monotone" dataKey="pnl" stroke={accentColor} strokeWidth={2} fill="url(#colorPnl)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}