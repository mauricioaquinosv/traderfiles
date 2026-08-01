'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import type { Trade } from '@/lib/types'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'
import { useAccount } from '@/contexts/AccountContext'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

export default function CalendarPage() {
  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [trades, setTrades] = useState<Trade[]>([])
  const [currentDate, setCurrentDate] = useState(new Date())
  const router = useRouter()
  const supabase = createClient()
  const { activeAccountId, loading: accountLoading } = useAccount()

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

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const pnlByDay: Record<number, number> = {}
  trades.filter((t) => t.pnl !== null).forEach((trade) => {
    const date = new Date(trade.entry_date)
    if (date.getFullYear() === year && date.getMonth() === month) {
      const day = date.getDate()
      pnlByDay[day] = (pnlByDay[day] ?? 0) + trade.pnl!
    }
  })

  const monthlyTotal = Object.values(pnlByDay).reduce((sum, v) => sum + v, 0)
  const tradingDays = Object.keys(pnlByDay).length
  const winningDays = Object.values(pnlByDay).filter((v) => v > 0).length
  const dayWinRate = tradingDays > 0 ? (winningDays / tradingDays) * 100 : 0

  const firstDayOfMonth = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const calendarCells: (number | null)[] = []
  for (let i = 0; i < firstDayOfMonth; i++) calendarCells.push(null)
  for (let d = 1; d <= daysInMonth; d++) calendarCells.push(d)

  const changeMonth = (delta: number) => setCurrentDate(new Date(year, month + delta, 1))

  const getDayColors = (pnl: number | undefined) => {
    if (pnl === undefined || pnl === 0) return { background: 'var(--color-surface)', borderColor: 'var(--color-border)', text: 'var(--color-text-muted)' }
    const maxAbs = Math.max(...Object.values(pnlByDay).map(Math.abs), 1)
    const intensity = Math.min(Math.abs(pnl) / maxAbs, 1)
    const alpha = intensity > 0.6 ? 0.4 : intensity > 0.3 ? 0.25 : 0.15
    const color = pnl > 0 ? '52,211,153' : '248,113,113'
    return {
      background: `rgba(${color},${alpha})`,
      borderColor: `rgba(${color},${alpha + 0.15})`,
      text: pnl > 0 ? '#34D399' : '#F87171',
    }
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg)' }}>
      <Sidebar email={user?.email ?? ''} />

      <main className="ml-60 p-8">
        <div className="max-w-5xl mx-auto">
          <div className="mb-6">
            <h1 className="font-display text-2xl font-bold" style={{ color: 'var(--color-text)' }}>Calendario</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>Tu rendimiento día a día</p>
          </div>

          <Topbar />

          <div className="p-6 rounded-2xl border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <div className="flex items-center justify-between mb-6">
              <button onClick={() => changeMonth(-1)} className="p-2 rounded-lg transition" style={{ color: 'var(--color-text-muted)' }}>
                <ChevronLeft size={20} />
              </button>
              <h2 className="font-display text-lg font-semibold" style={{ color: 'var(--color-text)' }}>{MESES[month]} {year}</h2>
              <button onClick={() => changeMonth(1)} className="p-2 rounded-lg transition" style={{ color: 'var(--color-text-muted)' }}>
                <ChevronRight size={20} />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-2 mb-2">
              {DIAS.map((dia) => (
                <div key={dia} className="text-center text-xs font-medium py-1" style={{ color: 'var(--color-text-muted)' }}>{dia}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-2">
              {calendarCells.map((day, index) => {
                if (day === null) return <div key={`empty-${index}`} className="aspect-square" />
                const pnl = pnlByDay[day]
                const colors = getDayColors(pnl)
                return (
                  <div key={day} className="aspect-square rounded-lg border p-2 flex flex-col justify-between" style={{ background: colors.background, borderColor: colors.borderColor }}>
                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{day}</span>
                    {pnl !== undefined && (
                      <span className="text-xs font-semibold" style={{ color: colors.text }}>
                        {pnl >= 0 ? '+' : ''}{pnl.toFixed(0)}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t" style={{ borderColor: 'var(--color-border)' }}>
              <div>
                <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Total mensual</p>
                <p className="font-display text-xl font-bold" style={{ color: monthlyTotal >= 0 ? '#34D399' : '#F87171' }}>
                  {monthlyTotal >= 0 ? '+' : ''}{monthlyTotal.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Días operados</p>
                <p className="font-display text-xl font-bold" style={{ color: 'var(--color-text)' }}>{tradingDays}</p>
              </div>
              <div>
                <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Win Rate (días)</p>
                <p className="font-display text-xl font-bold" style={{ color: 'var(--color-text)' }}>{dayWinRate.toFixed(0)}%</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}