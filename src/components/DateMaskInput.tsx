'use client'

import { useEffect, useRef, useState } from 'react'
import { Calendar } from 'lucide-react'

type DateMaskInputProps = {
  value: string // formato ISO yyyy-mm-dd, o '' si está vacío
  onChange: (iso: string) => void
  placeholder?: string
  className?: string
  style?: React.CSSProperties
}

/**
 * Input de fecha con formato fijo dd/mm/aaaa (igual al mockup HTML original),
 * independiente de la configuración regional del navegador.
 * Internamente guarda y expone el valor en formato ISO (yyyy-mm-dd).
 */

// Convierte 'yyyy-mm-dd' -> 'dd/mm/yyyy'
function isoToDisplay(iso: string): string {
  if (!iso) return ''
  const parts = iso.split('-')
  if (parts.length !== 3) return ''
  const [y, m, d] = parts
  if (!y || !m || !d) return ''
  return `${d}/${m}/${y}`
}

// Convierte 'dd/mm/yyyy' -> 'yyyy-mm-dd', o '' si no es válida
function displayToIso(str: string): string {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(str.trim())
  if (!match) return ''
  const d = match[1].padStart(2, '0')
  const m = match[2].padStart(2, '0')
  const y = match[3]
  const dNum = Number(d)
  const mNum = Number(m)
  if (mNum < 1 || mNum > 12) return ''
  const daysInMonth = new Date(Number(y), mNum, 0).getDate()
  if (dNum < 1 || dNum > daysInMonth) return ''
  return `${y}-${m}-${d}`
}

// Aplica la máscara dd/mm/yyyy mientras el usuario escribe
function applyMask(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8)
  if (digits.length > 4) return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
  if (digits.length > 2) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return digits
}

export default function DateMaskInput({ value, onChange, placeholder = 'dd/mm/aaaa', className, style }: DateMaskInputProps) {
  const [text, setText] = useState(() => isoToDisplay(value))
  const [error, setError] = useState(false)
  const hiddenInputRef = useRef<HTMLInputElement>(null)

  // Si el valor externo (ISO) cambia (ej. se limpiaron los filtros), sincroniza el texto visible
  useEffect(() => {
    setText(isoToDisplay(value))
    setError(false)
  }, [value])

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setText(applyMask(e.target.value))
    setError(false)
  }

  const handleBlur = () => {
    if (!text) {
      setError(false)
      onChange('')
      return
    }
    const iso = displayToIso(text)
    if (!iso) {
      setError(true)
      return
    }
    setError(false)
    onChange(iso)
  }

  const openPicker = () => {
    const input = hiddenInputRef.current
    if (!input) return
    if (typeof input.showPicker === 'function') {
      input.showPicker()
    } else {
      input.focus()
    }
  }

  const handleHiddenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const iso = e.target.value
    setText(isoToDisplay(iso))
    setError(false)
    onChange(iso)
  }

  return (
    <div className="relative inline-flex items-center">
      <input
        type="text"
        inputMode="numeric"
        value={text}
        onChange={handleTextChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        className={className}
        style={{
          ...style,
          borderColor: error ? '#F0555A' : style?.borderColor,
          paddingRight: 30,
        }}
      />
      <button
        type="button"
        onClick={openPicker}
        tabIndex={-1}
        className="absolute right-2 flex items-center justify-center hover:opacity-70"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        <Calendar size={14} />
      </button>
      {/* Input nativo oculto que solo se usa para abrir el selector visual de calendario */}
      <input
        ref={hiddenInputRef}
        type="date"
        value={value}
        onChange={handleHiddenChange}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />
    </div>
  )
}
