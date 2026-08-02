'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import Sidebar from '@/components/Sidebar'
import { useTheme } from '@/contexts/ThemeContext'
import { Sun, Moon, Check } from 'lucide-react'

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()
  const { theme, setTheme, accent, setAccent, accentOptions } = useTheme()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
      } else {
        setUser(user)
      }
      setLoading(false)
    }
    getUser()
  }, [router, supabase])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-bg)' }}>
        <p style={{ color: 'var(--color-text-muted)' }}>Cargando...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg)' }}>
      <Sidebar email={user?.email ?? ''} />

      <main className="ml-60 p-8">
        <div className="max-w-xl mx-auto">
          <div className="mb-6">
            <h1 className="font-display text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
              Configuración
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
              Personaliza la apariencia de TraderFiles
            </p>
          </div>

          <div className="p-6 rounded-2xl border mb-6" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <h2 className="font-display text-lg font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
              Tema
            </h2>
            <div className="flex gap-3">
              <button
                onClick={() => setTheme('dark')}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border text-sm transition"
                style={{
                  borderColor: theme === 'dark' ? 'var(--color-accent)' : 'var(--color-border)',
                  color: theme === 'dark' ? 'var(--color-accent)' : 'var(--color-text-muted)',
                  background: 'var(--color-surface-alt)',
                }}
              >
                <Moon size={16} /> Oscuro
              </button>
              <button
                onClick={() => setTheme('light')}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border text-sm transition"
                style={{
                  borderColor: theme === 'light' ? 'var(--color-accent)' : 'var(--color-border)',
                  color: theme === 'light' ? 'var(--color-accent)' : 'var(--color-text-muted)',
                  background: 'var(--color-surface-alt)',
                }}
              >
                <Sun size={16} /> Claro
              </button>
            </div>
          </div>

          <div className="p-6 rounded-2xl border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <h2 className="font-display text-lg font-semibold mb-1" style={{ color: 'var(--color-text)' }}>
              Color de acento
            </h2>
            <p className="text-xs mb-4" style={{ color: 'var(--color-text-secondary)' }}>
              Elige el color de acento del dashboard (botones, gráficos y resaltados). Se aplica al instante y se guarda para tu próxima visita.
            </p>
            <div className="grid grid-cols-5 gap-4">
              {accentOptions.map((option) => (
                <div key={option.value} className="flex flex-col items-center gap-1.5">
                  <button
                    onClick={() => setAccent(option.value)}
                    className="w-10 h-10 rounded-full flex items-center justify-center transition hover:scale-105"
                    style={{ background: option.value }}
                    title={option.name}
                  >
                    {accent.toLowerCase() === option.value.toLowerCase() && <Check size={18} color="#fff" />}
                  </button>
                  <span className="text-[10px] text-center leading-tight" style={{ color: 'var(--color-text-tertiary)' }}>
                    {option.name}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3 mt-5 pt-5 border-t" style={{ borderColor: 'var(--color-border)' }}>
              <label htmlFor="accent-custom-input" className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                Personalizado
              </label>
              <input
                id="accent-custom-input"
                type="color"
                value={accent}
                onChange={(e) => setAccent(e.target.value)}
                className="w-10 h-8 rounded cursor-pointer border"
                style={{ borderColor: 'var(--color-border)', background: 'transparent' }}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}