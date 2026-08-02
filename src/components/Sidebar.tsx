'use client'

import { useState } from 'react'
import { Wallet, Plus, LayoutDashboard, Calendar, ListOrdered, Palette, Download, Sun, Moon, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, usePathname } from 'next/navigation'
import { useTheme } from '@/contexts/ThemeContext'
import AccentColorModal from '@/components/AccentColorModal'

export default function Sidebar({ email }: { email: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const { theme, setTheme } = useTheme()
  const [showAccentModal, setShowAccentModal] = useState(false)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const NavBtn = ({
    icon: Icon,
    label,
    onClick,
    active,
    accentBtn,
    extraMargin,
  }: {
    icon: typeof LayoutDashboard
    label: string
    onClick: () => void
    active?: boolean
    accentBtn?: boolean
    extraMargin?: boolean
  }) => (
    <button
      onClick={onClick}
      title={label}
      className={`group relative w-[46px] h-[46px] rounded-xl flex items-center justify-center transition hover:-translate-y-px active:scale-[0.92] ${extraMargin ? 'my-2.5' : ''}`}
      style={{
        background: accentBtn ? 'var(--color-accent)' : active ? 'var(--color-accent-bg)' : 'transparent',
        color: accentBtn ? '#fff' : active ? 'var(--color-accent)' : 'var(--color-text-tertiary)',
      }}
    >
      <Icon size={20} strokeWidth={1.8} />
      <span
        className="pointer-events-none absolute left-[56px] top-1/2 -translate-y-1/2 whitespace-nowrap rounded-md px-2.5 py-[5px] text-xs font-medium opacity-0 transition group-hover:opacity-100 z-[9999]"
        style={{ background: 'var(--color-text)', color: 'var(--color-bg)' }}
      >
        {label}
      </span>
    </button>
  )

  return (
    <aside
      className="w-[72px] h-screen flex flex-col items-center py-[18px] gap-1.5 fixed left-0 top-0 border-r z-50"
      style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
    >
      <div
        className="w-[38px] h-[38px] rounded-[10px] flex items-center justify-center text-white font-display font-bold text-[15px] mb-[22px]"
        style={{ background: 'linear-gradient(135deg, var(--color-accent), #9B6CFF)' }}
      >
        TF
      </div>

      <nav className="flex flex-col gap-1.5 flex-1">
        <NavBtn icon={Wallet} label="Cuentas" active={pathname === '/accounts'} onClick={() => router.push('/accounts')} />
        <NavBtn icon={Plus} label="Add Trade" accentBtn extraMargin onClick={() => router.push('/trades')} />
        <NavBtn icon={LayoutDashboard} label="Dashboard" active={pathname === '/dashboard'} onClick={() => router.push('/dashboard')} />
        <NavBtn icon={Calendar} label="Calendario" active={pathname === '/calendar'} onClick={() => router.push('/calendar')} />
        <NavBtn icon={ListOrdered} label="Historial" active={pathname === '/trades'} onClick={() => router.push('/trades')} />
      </nav>

      <div className="flex flex-col gap-1.5">
        <NavBtn icon={Palette} label="Color de acento" onClick={() => setShowAccentModal(true)} />
        <NavBtn icon={Download} label="Backup" onClick={() => router.push('/settings')} />
        <NavBtn
          icon={theme === 'dark' ? Sun : Moon}
          label="Cambiar tema"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        />
        {/* Este botón no existe en tu HTML de referencia (que no tiene login real).
            Lo agregamos porque nuestra app sí requiere cerrar sesión. */}
        <NavBtn icon={LogOut} label={email} onClick={handleLogout} />
      </div>

      {showAccentModal && <AccentColorModal onClose={() => setShowAccentModal(false)} />}
    </aside>
  )
}