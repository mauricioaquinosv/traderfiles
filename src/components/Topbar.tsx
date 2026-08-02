'use client'

import { useAccount } from '@/contexts/AccountContext'
import { useRouter } from 'next/navigation'
import { Plus, Wallet } from 'lucide-react'

export default function Topbar() {
  const { accounts, activeAccountId, setActiveAccountId, loading } = useAccount()
  const router = useRouter()

  if (loading) return null

  return (
    <div className="flex items-center gap-2">
      <div
        className="flex items-center gap-2 rounded-xl border px-3.5 py-2 min-w-[180px]"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
      >
        <Wallet size={15} style={{ color: 'var(--color-text-secondary)', flexShrink: 0 }} />
        <select
          value={activeAccountId ?? ''}
          onChange={(e) => setActiveAccountId(e.target.value)}
          className="bg-transparent text-sm font-medium outline-none w-full cursor-pointer"
          style={{ color: 'var(--color-text)' }}
        >
          {accounts.length === 0 && <option value="">Sin cuentas</option>}
          {accounts.map((acc) => (
            <option key={acc.id} value={acc.id} style={{ background: 'var(--color-surface)' }}>
              {acc.name} · {acc.currency}
            </option>
          ))}
        </select>
      </div>
      <button
        onClick={() => router.push('/accounts')}
        className="w-[38px] h-[38px] rounded-[10px] border flex items-center justify-center transition"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
        title="Nueva cuenta"
      >
        <Plus size={17} />
      </button>
    </div>
  )
}