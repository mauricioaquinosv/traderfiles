'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import type { Account } from '@/lib/types'
import Sidebar from '@/components/Sidebar'

export default function AccountsPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [accounts, setAccounts] = useState<Account[]>([])
  const router = useRouter()
  const supabase = createClient()

const [name, setName] = useState('')
const [initialBalance, setInitialBalance] = useState('')
const [currency, setCurrency] = useState('USD')
const [broker, setBroker] = useState('')
const [saving, setSaving] = useState(false)
const [message, setMessage] = useState('')
const [editingId, setEditingId] = useState<string | null>(null)

  const loadAccounts = useCallback(async () => {
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && data) {
      setAccounts(data)
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

const handleCreateAccount = async (e: React.FormEvent) => {
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
    } else {
      setMessage('¡Cuenta actualizada!')
      resetForm()
      loadAccounts()
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
    } else {
      setMessage('¡Cuenta creada!')
      resetForm()
      loadAccounts()
    }
  }

  setSaving(false)
}

const resetForm = () => {
  setName('')
  setInitialBalance('')
  setBroker('')
  setEditingId(null)
}

const handleEditClick = (acc: Account) => {
  setEditingId(acc.id)
  setName(acc.name)
  setInitialBalance(acc.initial_balance.toString())
  setCurrency(acc.currency)
  setBroker(acc.broker || '')
  setMessage('')
}

  const handleSelectAccount = (accountId: string) => {
    localStorage.setItem('activeAccountId', accountId)
    router.push('/dashboard')
  }

  const handleDeleteAccount = async (id: string) => {
    const { error } = await supabase.from('accounts').delete().eq('id', id)
    if (!error) {
      loadAccounts()
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0B0F] flex items-center justify-center">
        <p className="text-zinc-400">Cargando...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0A0B0F]">
      <Sidebar email={user?.email ?? ''} />

      <main className="ml-60 p-8">
        <div>
          <div className="mb-8">
            <h1 className="font-display text-2xl font-bold text-white">
              Cuentas
            </h1>
            <p className="text-zinc-500 text-sm mt-1">
              Administra tus cuentas de trading
            </p>
          </div>

          {accounts.length > 0 && (
            <div className="bg-[#14161C] p-6 rounded-2xl border border-[#1F222B] mb-6">
              <h2 className="font-display text-lg font-semibold text-white mb-4">
                Tus cuentas
              </h2>
              <div className="space-y-3">
                {accounts.map((acc) => (
                  <div
                    key={acc.id}
                    className="flex justify-between items-center bg-[#0D0F14] p-4 rounded-xl border border-[#1F222B]"
                  >
                    <div>
                      <p className="font-semibold text-white">{acc.name}</p>
                      <p className="text-xs text-zinc-500">
                        Balance inicial: {acc.initial_balance} {acc.currency}
                        {acc.broker && ` · ${acc.broker}`}
                      </p>
                    </div>
                    <div className="flex gap-3">
  <button
    onClick={() => handleSelectAccount(acc.id)}
    className="bg-[#E8A33D] hover:bg-[#D6922E] text-[#0A0B0F] font-semibold px-4 py-1.5 rounded-lg text-sm transition"
  >
    Usar
  </button>
  <button
    onClick={() => handleEditClick(acc)}
    className="text-zinc-400 hover:text-white text-sm"
  >
    Editar
  </button>
  <button
    onClick={() => handleDeleteAccount(acc.id)}
    className="text-zinc-500 hover:text-red-400 text-sm"
  >
    Eliminar
  </button>
</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-[#14161C] p-6 rounded-2xl border border-[#1F222B]">
            <h2 className="font-display text-lg font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
  {editingId ? 'Editar cuenta' : 'Crear nueva cuenta'}
</h2>

            <form onSubmit={handleCreateAccount}>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Nombre</label>
                  <input
                    type="text"
                    placeholder="Cuenta principal"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-[#0D0F14] border border-[#1F222B] rounded-lg text-white focus:outline-none focus:border-[#E8A33D]"
                  />
                </div>

                <div>
  <label className="block text-sm text-zinc-400 mb-1">Balance inicial</label>
  <input
    type="number"
    step="any"
    placeholder="10000"
    value={initialBalance}
    onChange={(e) => setInitialBalance(e.target.value)}
    required
    disabled={!!editingId}
    className="w-full px-3 py-2 bg-[#0D0F14] border border-[#1F222B] rounded-lg text-white focus:outline-none focus:border-[#E8A33D] disabled:opacity-50"
  />
  {editingId && (
    <p className="text-xs text-zinc-500 mt-1">El balance inicial no se puede editar. Usa Transacciones para ajustar capital.</p>
  )}
</div>

                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Moneda</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0D0F14] border border-[#1F222B] rounded-lg text-white focus:outline-none focus:border-[#E8A33D]"
                  >
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="MXN">MXN</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Broker (opcional)</label>
                  <input
                    type="text"
                    placeholder="IC Markets"
                    value={broker}
                    onChange={(e) => setBroker(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0D0F14] border border-[#1F222B] rounded-lg text-white focus:outline-none focus:border-[#E8A33D]"
                  />
                </div>
              </div>

              {message && (
                <p className={`text-sm mb-4 ${message.startsWith('Error') ? 'text-red-400' : 'text-emerald-400'}`}>
                  {message}
                </p>
              )}

              <button
  type="submit"
  disabled={saving}
  className="w-full bg-[#E8A33D] hover:bg-[#D6922E] text-[#0A0B0F] font-semibold py-2 rounded-lg transition disabled:opacity-50"
>
  {saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Crear cuenta'}
</button>
{editingId && (
  <button
    type="button"
    onClick={resetForm}
    className="w-full text-sm text-zinc-400 hover:text-white mt-2"
  >
    Cancelar edición
  </button>
)}
            </form>
          </div>
        </div>
      </main>
    </div>
  )
}