'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import type { Account } from '@/lib/types'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'
import { useAccount } from '@/contexts/AccountContext'
import { Pencil, Trash2, X } from 'lucide-react'

const inputStyle = {
  background: 'var(--color-surface-alt)',
  borderColor: 'var(--color-border)',
  color: 'var(--color-text)',
}

const fmtMoneyFull = (n: number, currency: string) => {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n)
  } catch {
    return `${n < 0 ? '-' : ''}$${Math.abs(n).toFixed(2)}`
  }
}

// P&L (trades) + neto de transacciones por cuenta
type AccountStats = { pnl: number; hasTrades: boolean; balance: number }

export default function AccountsPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [stats, setStats] = useState<Record<string, AccountStats>>({})
  const router = useRouter()
  const supabase = createClient()
  const { activeAccountId, setActiveAccountId, refreshAccounts } = useAccount()

  const [showFormModal, setShowFormModal] = useState(false)
  const [name, setName] = useState('')
  const [initialBalance, setInitialBalance] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [broker, setBroker] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const loadAccounts = useCallback(async () => {
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && data) {
      setAccounts(data)

      const ids = data.map((a) => a.id)
      if (ids.length > 0) {
        const [{ data: trades }, { data: txs }] = await Promise.all([
          supabase.from('trades').select('account_id, pnl').in('account_id', ids),
          supabase.from('transactions').select('account_id, type, amount').in('account_id', ids),
        ])

        const next: Record<string, AccountStats> = {}
        data.forEach((acc) => {
          const accTrades = (trades ?? []).filter((t) => t.account_id === acc.id)
          const accTxs = (txs ?? []).filter((t) => t.account_id === acc.id)
          const pnl = accTrades.reduce((s, t) => s + (t.pnl ?? 0), 0)
          const txNet = accTxs.reduce((s, t) => s + (t.type === 'deposit' ? t.amount : -t.amount), 0)
          next[acc.id] = {
            pnl,
            hasTrades: accTrades.length > 0,
            balance: acc.initial_balance + pnl + txNet,
          }
        })
        setStats(next)
      } else {
        setStats({})
      }
    }
  }, [supabase])

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
      } else {
        setUser(user)
        loadAccounts()
      }
      setLoading(false)
    }
    getUser()
  }, [router, supabase, loadAccounts])

  const openCreateModal = () => {
    resetForm()
    setShowFormModal(true)
  }

  const openEditModal = (acc: Account) => {
    setEditingId(acc.id)
    setName(acc.name)
    setInitialBalance(acc.initial_balance.toString())
    setCurrency(acc.currency)
    setBroker(acc.broker || '')
    setMessage('')
    setShowFormModal(true)
  }

  const resetForm = () => {
    setName('')
    setInitialBalance('')
    setCurrency('USD')
    setBroker('')
    setEditingId(null)
    setMessage('')
  }

  const closeFormModal = () => {
    setShowFormModal(false)
    resetForm()
  }

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage('')

    if (editingId) {
      const { error } = await supabase
        .from('accounts')
        .update({ name, currency, broker: broker || null })
        .eq('id', editingId)

      if (error) {
        setMessage('Error: ' + error.message)
        setSaving(false)
        return
      }
    } else {
      const { error } = await supabase.from('accounts').insert({
        user_id: user?.id,
        name,
        initial_balance: parseFloat(initialBalance) || 0,
        currency,
        broker: broker || null,
      })

      if (error) {
        setMessage('Error: ' + error.message)
        setSaving(false)
        return
      }
    }

    setSaving(false)
    setShowFormModal(false)
    resetForm()
    loadAccounts()
    refreshAccounts()
  }

  const handleSelectAccount = (accountId: string) => {
    setActiveAccountId(accountId)
  }

  const handleGoToTransactions = (accountId: string) => {
    setActiveAccountId(accountId)
    router.push('/transactions')
  }

  const handleDeleteAccount = async (id: string) => {
    const { error } = await supabase.from('accounts').delete().eq('id', id)
    setDeletingId(null)
    if (!error) {
      loadAccounts()
      refreshAccounts()
    }
  }

  const today = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-bg)' }}>
        <p style={{ color: 'var(--color-text-secondary)' }}>Cargando...</p>
      </div>
    )
  }

  const deletingAccount = accounts.find((a) => a.id === deletingId) || null

  return (
    <div className="min-h-screen">
      <Sidebar email={user?.email ?? ''} />

      <main className="ml-[72px]">
        <div className="flex items-center justify-between px-8 py-5 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <div>
            <p className="text-xs capitalize" style={{ color: 'var(--color-text-secondary)' }}>{today}</p>
            <h1 className="font-display text-[22px] font-semibold" style={{ color: 'var(--color-text)' }}>Cuentas</h1>
          </div>
          <Topbar />
        </div>

        <div className="p-8">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
              {accounts.length} cuenta{accounts.length !== 1 ? 's' : ''}
            </p>
            <button
              onClick={openCreateModal}
              className="px-4 py-2 rounded-lg text-sm font-semibold transition"
              style={{ background: 'var(--color-accent)', color: '#fff' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-accent-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--color-accent)')}
            >
              + Nueva cuenta
            </button>
          </div>

          {accounts.length === 0 ? (
            <div className="glass-panel p-10 flex flex-col items-center text-center">
              <p className="font-display text-base font-semibold mb-1" style={{ color: 'var(--color-text)' }}>
                Aún no tienes cuentas
              </p>
              <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
                Crea tu primera cuenta para empezar a registrar tu actividad de trading.
              </p>
              <button
                onClick={openCreateModal}
                className="px-4 py-2 rounded-lg text-sm font-semibold"
                style={{ background: 'var(--color-accent)', color: '#fff' }}
              >
                Crear cuenta
              </button>
            </div>
          ) : (
            <div
              className="grid gap-4"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}
            >
              {accounts.map((acc) => {
                const isActive = acc.id === activeAccountId
                const s = stats[acc.id]
                return (
                  <div
                    key={acc.id}
                    className="glass-card p-[18px] relative"
                    style={isActive ? { borderColor: 'var(--color-accent)', boxShadow: '0 0 0 1px var(--color-accent)' } : undefined}
                  >
                    {isActive && (
                      <span
                        className="absolute top-[18px] right-[18px] text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full"
                        style={{ background: 'var(--color-accent-bg)', color: 'var(--color-accent)' }}
                      >
                        Activa
                      </span>
                    )}

                    <p className="font-display font-bold text-[15px] mb-0.5 pr-16 truncate" style={{ color: 'var(--color-text)' }}>
                      {acc.name}
                    </p>
                    <p className="text-xs mb-3.5" style={{ color: 'var(--color-text-tertiary)' }}>
                      {acc.broker ? `${acc.broker} · ` : ''}{acc.currency}
                    </p>

                    <p className="font-display text-xl font-bold mb-1" style={{ color: 'var(--color-text)' }}>
                      {fmtMoneyFull(s ? s.balance : acc.initial_balance, acc.currency)}
                    </p>
                    <p
                      className="text-[12.5px] font-semibold mb-3.5"
                      style={{ color: !s || !s.hasTrades ? 'var(--color-text-secondary)' : s.pnl >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}
                    >
                      {s && s.hasTrades ? `${fmtMoneyFull(s.pnl, acc.currency)} P&L total` : 'Sin trades aún'}
                    </p>

                    <div className="grid grid-cols-2 gap-2">
                      {isActive ? (
                        <button
                          disabled
                          className="px-3 py-1.5 rounded-lg text-xs font-medium opacity-50 cursor-not-allowed border"
                          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
                        >
                          En uso
                        </button>
                      ) : (
                        <button
                          onClick={() => handleSelectAccount(acc.id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold transition"
                          style={{ background: 'var(--color-accent)', color: '#fff' }}
                        >
                          Seleccionar
                        </button>
                      )}
                      <button
                        onClick={() => handleGoToTransactions(acc.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium border transition truncate"
                        style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                      >
                        Depósito/Retiro
                      </button>
                      <button
                        onClick={() => openEditModal(acc)}
                        className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition"
                        style={{ color: 'var(--color-text-secondary)' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-surface-hover)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        title="Editar"
                      >
                        <Pencil size={13} /> Editar
                      </button>
                      <button
                        onClick={() => setDeletingId(acc.id)}
                        className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition"
                        style={{ background: 'var(--color-red-bg)', borderColor: 'var(--color-red)', color: 'var(--color-red)' }}
                        title="Eliminar"
                      >
                        <Trash2 size={13} /> Eliminar
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>

      {/* Modal crear / editar cuenta */}
      {showFormModal && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={closeFormModal}
        >
          <div
            className="w-full max-w-md p-6 rounded-2xl border"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <h2 className="font-display text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
                {editingId ? 'Editar cuenta' : 'Nueva cuenta'}
              </h2>
              <button onClick={closeFormModal} style={{ color: 'var(--color-text-tertiary)' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveAccount}>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="col-span-2">
                  <label className="block text-sm mb-1" style={{ color: 'var(--color-text-secondary)' }}>Nombre</label>
                  <input
                    type="text"
                    placeholder="Cuenta principal"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none"
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label className="block text-sm mb-1" style={{ color: 'var(--color-text-secondary)' }}>Balance inicial</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="10000"
                    value={initialBalance}
                    onChange={(e) => setInitialBalance(e.target.value)}
                    required
                    disabled={!!editingId}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none disabled:opacity-50"
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label className="block text-sm mb-1" style={{ color: 'var(--color-text-secondary)' }}>Moneda</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none"
                    style={inputStyle}
                  >
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="MXN">MXN</option>
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block text-sm mb-1" style={{ color: 'var(--color-text-secondary)' }}>Broker (opcional)</label>
                  <input
                    type="text"
                    placeholder="IC Markets"
                    value={broker}
                    onChange={(e) => setBroker(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none"
                    style={inputStyle}
                  />
                </div>
              </div>

              {editingId && (
                <p className="text-xs mb-4" style={{ color: 'var(--color-text-tertiary)' }}>
                  El balance inicial no se puede editar. Usa Transacciones para ajustar capital.
                </p>
              )}

              {message && (
                <p className="text-sm mb-4" style={{ color: message.startsWith('Error') ? 'var(--color-red)' : 'var(--color-green)' }}>
                  {message}
                </p>
              )}

              <button
                type="submit"
                disabled={saving}
                className="w-full font-semibold py-2 rounded-lg transition disabled:opacity-50"
                style={{ background: 'var(--color-accent)', color: '#fff' }}
              >
                {saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Crear cuenta'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal confirmar eliminación */}
      {deletingAccount && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={() => setDeletingId(null)}
        >
          <div
            className="w-full max-w-sm p-6 rounded-2xl border"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display text-lg font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
              ¿Eliminar cuenta?
            </h2>
            <p className="text-sm mb-6" style={{ color: 'var(--color-text-secondary)' }}>
              Esta acción eliminará <span style={{ color: 'var(--color-text)' }}>{deletingAccount.name}</span> junto con sus trades y transacciones. No se puede deshacer.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeletingId(null)}
                className="flex-1 py-2 rounded-lg text-sm font-medium border"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDeleteAccount(deletingAccount.id)}
                className="flex-1 py-2 rounded-lg text-sm font-semibold"
                style={{ background: 'var(--color-red)', color: '#fff' }}
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
