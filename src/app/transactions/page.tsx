'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import type { Transaction } from '@/lib/types'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'
import { useAccount } from '@/contexts/AccountContext'

const inputStyle = {
  background: 'var(--color-surface-alt)',
  borderColor: 'var(--color-border)',
  color: 'var(--color-text)',
}

export default function TransactionsPage() {
  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [tradesPnL, setTradesPnL] = useState(0)
  const router = useRouter()
  const supabase = createClient()
  const { activeAccountId, activeAccount, loading: accountLoading } = useAccount()

  const [type, setType] = useState<'deposit' | 'withdrawal'>('deposit')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

const loadTransactions = useCallback(async (accId: string) => {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('account_id', accId)
    .order('date', { ascending: false })
  if (!error && data) setTransactions(data)
}, [supabase])

const loadTradesPnL = useCallback(async (accId: string) => {
  const { data, error } = await supabase
    .from('trades')
    .select('pnl')
    .eq('account_id', accId)
  if (!error && data) {
    const total = data.reduce((sum, t) => sum + (t.pnl ?? 0), 0)
    setTradesPnL(total)
  }
}, [supabase])

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
  if (!accountLoading && activeAccountId) {
    loadTransactions(activeAccountId)
    loadTradesPnL(activeAccountId)
  } else if (!accountLoading && !activeAccountId) {
    setTransactions([])
    setTradesPnL(0)
  }
}, [activeAccountId, accountLoading, loadTransactions, loadTradesPnL])

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeAccountId) return
    setSaving(true)
    setMessage('')

    const { error } = await supabase.from('transactions').insert({
      account_id: activeAccountId,
      user_id: user?.id,
      type,
      amount: parseFloat(amount),
      date: date ? new Date(date).toISOString() : new Date().toISOString(),
      note: note || null,
    })

    if (error) {
      setMessage('Error: ' + error.message)
    } else {
      setMessage('¡Movimiento registrado!')
      setAmount('')
      setDate('')
      setNote('')
      loadTransactions(activeAccountId)
    }
    setSaving(false)
  }

  const handleDeleteTransaction = async (id: string) => {
    const { error } = await supabase.from('transactions').delete().eq('id', id)
    if (!error && activeAccountId) loadTransactions(activeAccountId)
  }

  if (authLoading || accountLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-bg)' }}>
        <p style={{ color: 'var(--color-text-muted)' }}>Cargando...</p>
      </div>
    )
  }

  const totalDeposits = transactions.filter((t) => t.type === 'deposit').reduce((s, t) => s + t.amount, 0)
  const totalWithdrawals = transactions.filter((t) => t.type === 'withdrawal').reduce((s, t) => s + t.amount, 0)
  const currentBalance = (activeAccount?.initial_balance ?? 0) + tradesPnL + totalDeposits - totalWithdrawals

  return (
    <div className="min-h-screen">
      <Sidebar email={user?.email ?? ''} />

      <main className="ml-60 p-8">
        <div>
          <div className="mb-6">
            <h1 className="font-display text-[22px] font-semibold" style={{ color: 'var(--color-text)' }}>Transacciones</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>Depósitos y retiros de tu cuenta</p>
          </div>

          <Topbar />

          {!activeAccountId ? (
            <div className="p-6 rounded-2xl border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Crea una cuenta primero.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="p-5 rounded-2xl border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
  <p className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>Balance actual</p>
  <p className="font-display text-xl font-bold" style={{ color: 'var(--color-text)' }}>
    {currentBalance.toFixed(2)} {activeAccount?.currency}
  </p>
</div>
<div className="p-5 rounded-2xl border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
  <p className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>P&L de trading</p>
  <p className="font-display text-xl font-bold" style={{ color: tradesPnL >= 0 ? '#34D399' : '#F87171' }}>
    {tradesPnL >= 0 ? '+' : ''}{tradesPnL.toFixed(2)}
  </p>
</div>
                <div className="p-5 rounded-2xl border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                  <p className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>Depósitos totales</p>
                  <p className="font-display text-xl font-bold" style={{ color: '#34D399' }}>+{totalDeposits.toFixed(2)}</p>
                </div>
                <div className="p-5 rounded-2xl border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                  <p className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>Retiros totales</p>
                  <p className="font-display text-xl font-bold" style={{ color: '#F87171' }}>-{totalWithdrawals.toFixed(2)}</p>
                </div>
              </div>

              <div className="p-6 rounded-2xl border mb-6" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                <h2 className="font-display text-lg font-semibold mb-4" style={{ color: 'var(--color-text)' }}>Registrar movimiento</h2>
                <form onSubmit={handleAddTransaction}>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm mb-1" style={{ color: 'var(--color-text-muted)' }}>Tipo</label>
                      <select value={type} onChange={(e) => setType(e.target.value as 'deposit' | 'withdrawal')}
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none" style={inputStyle}>
                        <option value="deposit">Depósito</option>
                        <option value="withdrawal">Retiro</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm mb-1" style={{ color: 'var(--color-text-muted)' }}>Monto</label>
                      <input type="number" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} required
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none" style={inputStyle} />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm mb-1" style={{ color: 'var(--color-text-muted)' }}>Fecha</label>
                      <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none" style={inputStyle} />
                    </div>
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm mb-1" style={{ color: 'var(--color-text-muted)' }}>Nota (opcional)</label>
                    <input type="text" placeholder="Retiro para gastos, aporte inicial..." value={note} onChange={(e) => setNote(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none" style={inputStyle} />
                  </div>

                  {message && (
                    <p className="text-sm mb-4" style={{ color: message.startsWith('Error') ? '#F87171' : '#34D399' }}>{message}</p>
                  )}

                  <button type="submit" disabled={saving}
                    className="w-full font-semibold py-2 rounded-lg transition disabled:opacity-50"
                    style={{ background: 'var(--color-accent)', color: 'var(--color-bg)' }}>
                    {saving ? 'Guardando...' : 'Registrar movimiento'}
                  </button>
                </form>
              </div>

              <div className="p-6 rounded-2xl border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                <h2 className="font-display text-lg font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
                  Historial ({transactions.length})
                </h2>
                {transactions.length === 0 ? (
                  <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Aún no hay movimientos registrados.</p>
                ) : (
                  <div className="space-y-3">
                    {transactions.map((t) => (
                      <div key={t.id} className="flex justify-between items-center p-4 rounded-xl border" style={{ background: 'var(--color-surface-alt)', borderColor: 'var(--color-border)' }}>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs px-2 py-0.5 rounded" style={{
                              background: t.type === 'deposit' ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.15)',
                              color: t.type === 'deposit' ? '#34D399' : '#F87171',
                            }}>
                              {t.type === 'deposit' ? 'Depósito' : 'Retiro'}
                            </span>
                            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                              {new Date(t.date).toLocaleDateString()}
                            </span>
                          </div>
                          {t.note && <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>{t.note}</p>}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-semibold" style={{ color: t.type === 'deposit' ? '#34D399' : '#F87171' }}>
                            {t.type === 'deposit' ? '+' : '-'}{t.amount.toFixed(2)}
                          </span>
                          <button onClick={() => handleDeleteTransaction(t.id)} className="text-sm hover:opacity-80" style={{ color: 'var(--color-text-muted)' }}>
                            Eliminar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}