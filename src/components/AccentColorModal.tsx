'use client'

import { Check, X } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'

export default function AccentColorModal({ onClose }: { onClose: () => void }) {
  const { accent, setAccent, accentOptions } = useTheme()

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md p-6 rounded-2xl border"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-1">
          <h2 className="font-display text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
            Color de acento
          </h2>
          <button onClick={onClose} style={{ color: 'var(--color-text-tertiary)' }}>
            <X size={20} />
          </button>
        </div>
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

        <div className="flex items-center justify-between gap-3 mt-5 pt-5 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex items-center gap-3">
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
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: 'var(--color-accent)', color: '#fff' }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}