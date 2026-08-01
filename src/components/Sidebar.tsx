'use client'

import { LayoutDashboard, ListOrdered, Calendar, Wallet, Settings, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'

export default function Sidebar({ email }: { email: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard' },
    { icon: ListOrdered, label: 'Trades', href: '/trades' },
    { icon: Calendar, label: 'Calendario', href: '/calendar' },
    { icon: Wallet, label: 'Transacciones', href: '/transactions' },
    { icon: Settings, label: 'Configuración', href: '/settings' },
  ]

  return (
    <aside
      className="w-60 h-screen flex flex-col fixed left-0 top-0 border-r"
      style={{ background: 'var(--color-surface-alt)', borderColor: 'var(--color-border)' }}
    >
      <div className="p-6 border-b" style={{ borderColor: 'var(--color-border)' }}>
        <h1 className="font-display text-xl font-bold tracking-tight" style={{ color: 'var(--color-text)' }}>
          TraderFiles
        </h1>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.label}
              href={item.href}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition"
              style={{
                background: isActive ? 'color-mix(in srgb, var(--color-accent) 10%, transparent)' : 'transparent',
                color: isActive ? 'var(--color-accent)' : 'var(--color-text-muted)',
                fontWeight: isActive ? 500 : 400,
              }}
            >
              <item.icon size={18} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="p-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
        <p className="text-xs truncate mb-3" style={{ color: 'var(--color-text-muted)' }}>{email}</p>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <LogOut size={16} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}