'use client'

import { useAccount } from '@/contexts/AccountContext'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'

export default function Topbar() {
  const { accounts, activeAccountId, setActiveAccountId, loading } = useAccount()
  const router = useRouter()

  if (loading) return null

  return (
    <div className="flex items-center gap-3 mb-6">
      <select
        value={activeAccountId ?? ''}
        onChange={(e) => setActiveAccountId(e.target.value)}
        className="text-sm rounded-lg px-3 py-2 border focus:outline-none"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
      >
        {accounts.length === 0 && <option value="">Sin cuentas</option>}
        {accounts.map((acc) => (
          <option key={acc.id} value={acc.id}>
            {acc.name} · {acc.currency}
          </option>
        ))}
      </select>
      <button
        onClick={() => router.push('/accounts')}
        className="flex items-center gap-1 text-xs rounded-lg px-3 py-2 border transition"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
      >
        <Plus size={14} /> Nueva cuenta
      </button>
    </div>
  )
}