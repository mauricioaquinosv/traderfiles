'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Account } from '@/lib/types'

type AccountContextType = {
  accounts: Account[]
  activeAccountId: string | null
  activeAccount: Account | null
  setActiveAccountId: (id: string) => void
  loading: boolean
  refreshAccounts: () => Promise<void>
}

const AccountContext = createContext<AccountContextType | undefined>(undefined)

export function AccountProvider({ children }: { children: React.ReactNode }) {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [activeAccountId, setActiveAccountIdState] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const refreshAccounts = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && data) {
      setAccounts(data)
      const stored = localStorage.getItem('activeAccountId')
      const validStored = data.find((a) => a.id === stored)

      if (validStored) {
        setActiveAccountIdState(stored)
      } else if (data.length > 0) {
        setActiveAccountIdState(data[0].id)
        localStorage.setItem('activeAccountId', data[0].id)
      } else {
        setActiveAccountIdState(null)
      }
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    refreshAccounts()
  }, [refreshAccounts])

  const setActiveAccountId = (id: string) => {
    setActiveAccountIdState(id)
    localStorage.setItem('activeAccountId', id)
  }

  const activeAccount = accounts.find((a) => a.id === activeAccountId) || null

  return (
    <AccountContext.Provider value={{ accounts, activeAccountId, activeAccount, setActiveAccountId, loading, refreshAccounts }}>
      {children}
    </AccountContext.Provider>
  )
}

export function useAccount() {
  const ctx = useContext(AccountContext)
  if (!ctx) throw new Error('useAccount debe usarse dentro de AccountProvider')
  return ctx
}