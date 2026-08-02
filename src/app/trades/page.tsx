'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import type { Trade } from '@/lib/types'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'
import DateMaskInput from '@/components/DateMaskInput'
import { useAccount } from '@/contexts/AccountContext'
import * as XLSX from 'xlsx'
import { Download, Plus, Pencil, Trash2, X, ChevronLeft, ChevronRight, Columns3, FileSpreadsheet } from 'lucide-react'

const inputStyle = {
  background: 'var(--color-surface-alt)',
  borderColor: 'var(--color-border)',
  color: 'var(--color-text)',
}

const fmtMoney = (n: number) =>
  `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const fmtDateOnly = (iso: string) =>
  new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })

const fmtTimeOnly = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })

type ImportRow = {
  symbol: string
  direction: 'long' | 'short'
  entry_price: number
  exit_price: number | null
  quantity: number
  commission: number
  stop_loss: number | null
  take_profit: number | null
  strategy: string | null
  tags: string[]
  notes: string | null
  entry_date: string
  pnl: number | null
  error?: string
}

const EXCEL_IMPORT_COLUMNS = [
  { key: 'symbol', label: 'Símbolo', required: true },
  { key: 'date', label: 'Fecha (dd/mm/aaaa)', required: true },
  { key: 'time', label: 'Hora', required: false },
  { key: 'direction', label: 'Dirección (long/short)', required: false },
  { key: 'entryPrice', label: 'Precio entrada', required: false },
  { key: 'exitPrice', label: 'Precio salida', required: false },
  { key: 'size', label: 'Tamaño', required: false },
  { key: 'commission', label: 'Comisión', required: false },
  { key: 'pnl', label: 'P&L', required: true },
  { key: 'stopLoss', label: 'Stop Loss', required: false },
  { key: 'takeProfit', label: 'Take Profit', required: false },
  { key: 'strategy', label: 'Estrategia', required: false },
  { key: 'tags', label: 'Tags (separados por coma)', required: false },
  { key: 'notes', label: 'Notas', required: false },
] as const

// Convierte fechas de Excel (serial, Date, dd/mm/aaaa o aaaa-mm-dd) a ISO 'aaaa-mm-dd'
function excelDateToIso(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  if (value instanceof Date && !isNaN(value.getTime())) {
    return value.getFullYear() + '-' + String(value.getMonth() + 1).padStart(2, '0') + '-' + String(value.getDate()).padStart(2, '0')
  }
  if (typeof value === 'number') {
    const d = XLSX.SSF.parse_date_code(value)
    if (!d) return null
    return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
  }
  const str = String(value).trim()
  let m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(str) // dd/mm/aaaa o dd-mm-aaaa
  if (m) {
    const d = Number(m[1]), mo = Number(m[2]), y = Number(m[3])
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    return null
  }
  m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(str) // por si viene aaaa-mm-dd
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  return null
}

type ColumnKey = 'date' | 'time' | 'symbol' | 'direction' | 'entry' | 'exit' | 'size' | 'strategy' | 'commission' | 'pnl' | 'notes'

const HISTORY_COLUMNS: { key: ColumnKey; label: string; default: boolean }[] = [
  { key: 'date', label: 'Fecha', default: true },
  { key: 'time', label: 'Hora', default: false },
  { key: 'symbol', label: 'Símbolo', default: true },
  { key: 'direction', label: 'Dir.', default: true },
  { key: 'entry', label: 'Entrada', default: true },
  { key: 'exit', label: 'Salida', default: true },
  { key: 'size', label: 'Tamaño', default: true },
  { key: 'strategy', label: 'Estrategia', default: true },
  { key: 'commission', label: 'Comisión', default: false },
  { key: 'pnl', label: 'Net P&L', default: true },
  { key: 'notes', label: 'Notas', default: false },
]

const PAGE_SIZE = 10

export default function TradesPage() {
  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [trades, setTrades] = useState<Trade[]>([])
  const router = useRouter()
  const supabase = createClient()
  const { activeAccountId, activeAccount, loading: accountLoading } = useAccount()

  const [editingId, setEditingId] = useState<string | null>(null)
  const [symbol, setSymbol] = useState('')
  const [direction, setDirection] = useState<'long' | 'short'>('long')
  const [entryPrice, setEntryPrice] = useState('')
  const [exitPrice, setExitPrice] = useState('')
  const [quantity, setQuantity] = useState('')
  const [commission, setCommission] = useState('')
  const [pnlInput, setPnlInput] = useState('')
  const [stopLoss, setStopLoss] = useState('')
  const [takeProfit, setTakeProfit] = useState('')
  const [strategy, setStrategy] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [notes, setNotes] = useState('')
  const [entryDate, setEntryDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [showTradePanel, setShowTradePanel] = useState(false)

  const [filterSymbol, setFilterSymbol] = useState('')
  const [filterStrategy, setFilterStrategy] = useState('')
  const [filterTag, setFilterTag] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [historyPage, setHistoryPage] = useState(1)

  const [visibleColumns, setVisibleColumns] = useState<ColumnKey[]>(
    HISTORY_COLUMNS.filter((c) => c.default).map((c) => c.key)
  )
  const [showColMenu, setShowColMenu] = useState(false)

  const [showImportModal, setShowImportModal] = useState(false)
  const [importRows, setImportRows] = useState<ImportRow[]>([])
  const [importing, setImporting] = useState(false)
  const [importMessage, setImportMessage] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('historyColumns') || 'null')
      if (Array.isArray(saved) && saved.length) setVisibleColumns(saved)
    } catch {}
  }, [])

  const toggleColumn = (key: ColumnKey) => {
    setVisibleColumns((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
      const safe: ColumnKey[] = next.length ? next : ['date']
      localStorage.setItem('historyColumns', JSON.stringify(safe))
      return safe
    })
  }

  const loadTrades = useCallback(async (accId: string) => {
    const { data, error } = await supabase
      .from('trades')
      .select('*')
      .eq('account_id', accId)
      .order('entry_date', { ascending: false })
    if (!error && data) setTrades(data)
  }, [supabase])

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
      } else {
        setUser(user)
      }
      setAuthLoading(false)
    }
    getUser()
  }, [router, supabase])

  useEffect(() => {
    if (!accountLoading && activeAccountId) {
      loadTrades(activeAccountId)
    } else if (!accountLoading && !activeAccountId) {
      setTrades([])
    }
  }, [activeAccountId, accountLoading, loadTrades])

  useEffect(() => {
    setHistoryPage(1)
  }, [filterSymbol, filterStrategy, filterTag, filterFrom, filterTo])

  const resetForm = () => {
    setEditingId(null)
    setSymbol(''); setEntryPrice(''); setExitPrice(''); setQuantity(''); setCommission(''); setPnlInput('')
    setStopLoss(''); setTakeProfit(''); setStrategy(''); setTagsInput(''); setNotes(''); setEntryDate('')
    setMessage('')
  }

  // Convierte una fecha ISO guardada en base de datos al formato que necesita el input datetime-local
  const toDatetimeLocal = (iso: string) => {
    const d = new Date(iso)
    const pad = (n: number) => n.toString().padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  const openNewTradePanel = () => {
    resetForm()
    setShowTradePanel(true)
  }

  const handleEditClick = (trade: Trade) => {
    setEditingId(trade.id)
    setSymbol(trade.symbol)
    setDirection(trade.direction)
    setEntryPrice(trade.entry_price?.toString() ?? '')
    setExitPrice(trade.exit_price?.toString() ?? '')
    setQuantity(trade.quantity.toString())
    setCommission(trade.commission?.toString() ?? '')
    setPnlInput(trade.pnl != null ? trade.pnl.toString() : '')
    setStopLoss(trade.stop_loss?.toString() ?? '')
    setTakeProfit(trade.take_profit?.toString() ?? '')
    setStrategy(trade.strategy ?? '')
    setTagsInput(trade.tags?.join(', ') ?? '')
    setNotes(trade.notes ?? '')
    setEntryDate(toDatetimeLocal(trade.entry_date))
    setMessage('')
    setShowTradePanel(true)
  }

  const closeTradePanel = () => {
    setShowTradePanel(false)
    resetForm()
  }

  const handleAddTrade = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeAccountId) return
    setSaving(true)
    setMessage('')

    const entry = parseFloat(entryPrice)
    const exit = exitPrice ? parseFloat(exitPrice) : null
    const qty = parseFloat(quantity)
    const comm = parseFloat(commission) || 0
    const pnl = parseFloat(pnlInput)
    if (isNaN(pnl)) {
      setMessage('Error: ingresa el P&L en $')
      setSaving(false)
      return
    }
    const tags = tagsInput.split(',').map((t) => t.trim()).filter((t) => t.length > 0)

    const tradeData = {
      symbol: symbol.toUpperCase(),
      direction,
      entry_price: entry,
      exit_price: exit,
      quantity: qty,
      commission: comm,
      stop_loss: stopLoss ? parseFloat(stopLoss) : null,
      take_profit: takeProfit ? parseFloat(takeProfit) : null,
      pnl,
      strategy: strategy || null,
      tags,
      notes: notes || null,
      entry_date: entryDate ? new Date(entryDate).toISOString() : new Date().toISOString(),
    }

    if (editingId) {
      const { error } = await supabase.from('trades').update(tradeData).eq('id', editingId)
      if (error) {
        setMessage('Error: ' + error.message)
      } else {
        resetForm()
        setShowTradePanel(false)
        loadTrades(activeAccountId)
      }
    } else {
      const { error } = await supabase.from('trades').insert({
        account_id: activeAccountId,
        user_id: user?.id,
        ...tradeData,
      })
      if (error) {
        setMessage('Error: ' + error.message)
      } else {
        resetForm()
        setShowTradePanel(false)
        loadTrades(activeAccountId)
      }
    }

    setSaving(false)
  }

  const handleDeleteTrade = async (id: string) => {
    const { error } = await supabase.from('trades').delete().eq('id', id)
    if (!error && activeAccountId) {
      if (editingId === id) closeTradePanel()
      loadTrades(activeAccountId)
    }
  }

  // --- Importación desde Excel ---

  const downloadTemplate = () => {
    const headers = EXCEL_IMPORT_COLUMNS.map((c) => c.label)
    const example = ['EURUSD', '15/07/2026', '09:30', 'long', 1.085, 1.091, 0.5, 0, 150, 1.08, 1.095, 'Ruptura de rango', 'breakout,plan', 'Seguí el plan al pie de la letra']
    const ws = XLSX.utils.aoa_to_sheet([headers, example])
    ws['!cols'] = headers.map(() => ({ wch: 20 }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Trades')
    XLSX.writeFile(wb, 'plantilla-trades.xlsx')
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImportMessage('')
    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result
        const workbook = XLSX.read(data, { type: 'binary', cellDates: true })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet)

        const parsed: ImportRow[] = rows.map((row) => {
          let error = ''
          const symbolVal = String(row['Símbolo'] ?? '').toUpperCase().trim()

          const isoDate = excelDateToIso(row['Fecha (dd/mm/aaaa)'])
          const timeVal = String(row['Hora'] ?? '').trim()

          let directionVal = String(row['Dirección (long/short)'] ?? '').toLowerCase().trim()
          if (['compra', 'buy', 'long'].includes(directionVal)) directionVal = 'long'
          else if (['venta', 'sell', 'short'].includes(directionVal)) directionVal = 'short'
          else directionVal = 'long'

          const entryRaw = row['Precio entrada']
          const entryVal = entryRaw !== undefined && entryRaw !== '' ? parseFloat(String(entryRaw)) : NaN
          const exitRaw = row['Precio salida']
          const exitVal = exitRaw !== undefined && exitRaw !== '' && !isNaN(parseFloat(String(exitRaw))) ? parseFloat(String(exitRaw)) : null
          const qtyRaw = row['Tamaño']
          const qtyVal = qtyRaw !== undefined && qtyRaw !== '' ? parseFloat(String(qtyRaw)) : NaN
          const commRaw = row['Comisión']
          const commVal = commRaw !== undefined && commRaw !== '' && !isNaN(parseFloat(String(commRaw))) ? parseFloat(String(commRaw)) : 0
          const pnlRaw = row['P&L']
          const pnlManual = pnlRaw !== undefined && pnlRaw !== '' ? parseFloat(String(pnlRaw)) : NaN

          if (!symbolVal) error = 'Falta símbolo'
          else if (!isoDate) error = 'Fecha inválida (usa dd/mm/aaaa)'
          else if (isNaN(pnlManual)) error = 'P&L inválido o vacío'

          const dateVal = isoDate ? `${isoDate}T${timeVal || '00:00'}:00` : new Date().toISOString()

          const toNumOrNull = (v: unknown) => {
            const n = parseFloat(String(v ?? ''))
            return v === undefined || v === '' || v === null || isNaN(n) ? null : n
          }

          const tagsRaw = String(row['Tags (separados por coma)'] ?? '').trim()
          const tags = tagsRaw ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean) : []

          // El P&L es el valor directo de la columna (igual que en el HTML); entrada/salida son solo referencia.
          const pnlFinal = isNaN(pnlManual) ? null : pnlManual

          return {
            symbol: symbolVal,
            direction: directionVal as 'long' | 'short',
            entry_price: isNaN(entryVal) ? 0 : entryVal,
            exit_price: exitVal,
            quantity: isNaN(qtyVal) ? 0 : qtyVal,
            commission: commVal,
            stop_loss: toNumOrNull(row['Stop Loss']),
            take_profit: toNumOrNull(row['Take Profit']),
            strategy: row['Estrategia'] ? String(row['Estrategia']).trim() : null,
            tags,
            notes: row['Notas'] ? String(row['Notas']).trim() : null,
            entry_date: dateVal,
            pnl: pnlFinal,
            error: error || undefined,
          }
        })

        setImportRows(parsed)
      } catch {
        setImportMessage('Error: no se pudo leer el archivo. Verifica que sea un .xlsx o .csv válido.')
      }
    }
    reader.readAsBinaryString(file)
  }

  const handleConfirmImport = async () => {
    if (!activeAccountId) return
    const validRows = importRows.filter((r) => !r.error)
    if (validRows.length === 0) return

    setImporting(true)
    const { error } = await supabase.from('trades').insert(
      validRows.map((r) => ({
        account_id: activeAccountId,
        user_id: user?.id,
        symbol: r.symbol,
        direction: r.direction,
        entry_price: r.entry_price,
        exit_price: r.exit_price,
        quantity: r.quantity,
        commission: r.commission,
        stop_loss: r.stop_loss,
        take_profit: r.take_profit,
        pnl: r.pnl,
        strategy: r.strategy,
        tags: r.tags,
        notes: r.notes,
        entry_date: r.entry_date,
      }))
    )

    if (error) {
      setImportMessage('Error al importar: ' + error.message)
    } else {
      setImportMessage(`¡${validRows.length} trades importados correctamente!`)
      setImportRows([])
      if (fileInputRef.current) fileInputRef.current.value = ''
      loadTrades(activeAccountId)
    }
    setImporting(false)
  }

  const closeImportModal = () => {
    setShowImportModal(false)
    setImportRows([])
    setImportMessage('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const filteredTrades = trades.filter((trade) => {
    if (filterSymbol && !trade.symbol.toLowerCase().includes(filterSymbol.toLowerCase())) return false
    if (filterStrategy && trade.strategy !== filterStrategy) return false
    if (filterTag && !trade.tags?.includes(filterTag)) return false
    if (filterFrom && new Date(trade.entry_date) < new Date(filterFrom)) return false
    if (filterTo && new Date(trade.entry_date) > new Date(filterTo + 'T23:59:59')) return false
    return true
  })
  const totalPages = Math.max(1, Math.ceil(filteredTrades.length / PAGE_SIZE))
  const safePage = Math.min(historyPage, totalPages)
  const pageTrades = filteredTrades.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const uniqueStrategies = Array.from(new Set(trades.map((t) => t.strategy).filter(Boolean))) as string[]
  const uniqueTags = Array.from(new Set(trades.flatMap((t) => t.tags ?? [])))
  const hasFilters = !!(filterSymbol || filterStrategy || filterTag || filterFrom || filterTo)

  const today = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  if (authLoading || accountLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-bg)' }}>
        <p style={{ color: 'var(--color-text-muted)' }}>Cargando...</p>
      </div>
    )
  }

  const validCount = importRows.filter((r) => !r.error).length
  const errorCount = importRows.filter((r) => r.error).length

  const renderCell = (key: ColumnKey, trade: Trade) => {
    switch (key) {
      case 'date':
        return <span style={{ color: 'var(--color-text)' }}>{fmtDateOnly(trade.entry_date)}</span>
      case 'time':
        return <span style={{ color: 'var(--color-text)' }}>{fmtTimeOnly(trade.entry_date)}</span>
      case 'symbol':
        return <span className="font-semibold" style={{ color: 'var(--color-text)' }}>{trade.symbol}</span>
      case 'direction':
        return (
          <span
            className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
            style={{
              background: trade.direction === 'long' ? 'var(--color-green-bg)' : 'var(--color-red-bg)',
              color: trade.direction === 'long' ? 'var(--color-green)' : 'var(--color-red)',
            }}
          >
            {trade.direction === 'long' ? 'Long' : 'Short'}
          </span>
        )
      case 'entry':
        return <span style={{ color: 'var(--color-text)' }}>{trade.entry_price ?? '—'}</span>
      case 'exit':
        return <span style={{ color: 'var(--color-text)' }}>{trade.exit_price ?? '—'}</span>
      case 'size':
        return <span style={{ color: 'var(--color-text)' }}>{trade.quantity ?? '—'}</span>
      case 'strategy':
        return <span style={{ color: trade.strategy ? 'var(--color-text)' : 'var(--color-text-tertiary)' }}>{trade.strategy || '—'}</span>
      case 'commission':
        return <span style={{ color: 'var(--color-text)' }}>{trade.commission ? fmtMoney(trade.commission) : '—'}</span>
      case 'pnl':
        return (
          <span className="font-semibold" style={{ color: trade.pnl === null ? 'var(--color-text-secondary)' : trade.pnl >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>
            {trade.pnl !== null ? fmtMoney(trade.pnl) : '—'}
          </span>
        )
      case 'notes':
        return <span style={{ color: trade.notes ? 'var(--color-text)' : 'var(--color-text-tertiary)' }}>{trade.notes || '—'}</span>
      default:
        return '—'
    }
  }

  return (
    <div className="min-h-screen">
      <Sidebar email={user?.email ?? ''} />

      <main className="ml-[72px]">
        <div className="flex items-center justify-between px-8 py-5 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <div>
            <p className="text-xs capitalize" style={{ color: 'var(--color-text-secondary)' }}>{today}</p>
            <h1 className="font-display text-[22px] font-semibold" style={{ color: 'var(--color-text)' }}>Historial de trades</h1>
          </div>
          <div className="flex items-center gap-2">
            <Topbar />
          </div>
        </div>

        <div className="p-8">
          {!activeAccountId ? (
            <div className="glass-panel p-6">
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Crea una cuenta primero para poder registrar trades.</p>
            </div>
          ) : (
            <>
              {/* Barra de filtros */}
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <input
                  type="text" placeholder="Buscar símbolo..." value={filterSymbol}
                  onChange={(e) => setFilterSymbol(e.target.value)}
                  className="px-3 py-2 border rounded-lg text-sm focus:outline-none w-44" style={inputStyle}
                />
                <select
                  value={filterStrategy} onChange={(e) => setFilterStrategy(e.target.value)}
                  className="px-3 py-2 border rounded-lg text-sm focus:outline-none" style={inputStyle}
                >
                  <option value="">Todas las estrategias</option>
                  {uniqueStrategies.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <select
                  value={filterTag} onChange={(e) => setFilterTag(e.target.value)}
                  className="px-3 py-2 border rounded-lg text-sm focus:outline-none" style={inputStyle}
                >
                  <option value="">Todos los tags</option>
                  {uniqueTags.map((t) => <option key={t} value={t}>#{t}</option>)}
                </select>
                <DateMaskInput
                  value={filterFrom} onChange={setFilterFrom}
                  className="px-3 py-2 border rounded-lg text-sm focus:outline-none w-[130px]" style={inputStyle}
                />
                <DateMaskInput
                  value={filterTo} onChange={setFilterTo}
                  className="px-3 py-2 border rounded-lg text-sm focus:outline-none w-[130px]" style={inputStyle}
                />
                {hasFilters && (
                  <button
                    onClick={() => { setFilterSymbol(''); setFilterStrategy(''); setFilterTag(''); setFilterFrom(''); setFilterTo('') }}
                    className="text-sm hover:opacity-80" style={{ color: 'var(--color-text-secondary)' }}
                  >
                    Limpiar filtros
                  </button>
                )}

                <div className="ml-auto flex items-center gap-2">
                  <button
                    onClick={() => setShowImportModal(true)}
                    className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg border transition"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
                  >
                    <FileSpreadsheet size={15} /> Importar Excel
                  </button>
                  <button
                    onClick={openNewTradePanel}
                    className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg font-semibold transition"
                    style={{ background: 'var(--color-accent)', color: '#fff' }}
                  >
                    <Plus size={15} /> Nuevo trade
                  </button>
                </div>
              </div>

              {/* Tabla */}
              <div className="glass-panel p-6">
                <div className="flex justify-end mb-3 relative">
                  <button
                    onClick={() => setShowColMenu((v) => !v)}
                    className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border transition"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
                  >
                    <Columns3 size={13} /> Columnas
                  </button>
                  {showColMenu && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setShowColMenu(false)} />
                      <div
                        className="absolute right-0 top-9 z-20 w-48 rounded-lg border p-2 shadow-lg"
                        style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-border)' }}
                      >
                        {HISTORY_COLUMNS.map((c) => (
                          <label key={c.key} className="flex items-center gap-2 px-2 py-1.5 rounded text-xs cursor-pointer hover:opacity-80" style={{ color: 'var(--color-text)' }}>
                            <input type="checkbox" checked={visibleColumns.includes(c.key)} onChange={() => toggleColumn(c.key)} />
                            {c.label}
                          </label>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {pageTrades.length === 0 ? (
                  <p className="text-sm py-8 text-center" style={{ color: 'var(--color-text-muted)' }}>
                    {trades.length === 0 ? 'Aún no tienes trades registrados en esta cuenta.' : 'Ningún trade coincide con los filtros.'}
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr style={{ color: 'var(--color-text-tertiary)' }}>
                          {HISTORY_COLUMNS.filter((c) => visibleColumns.includes(c.key)).map((c) => (
                            <th key={c.key} className="text-left font-semibold uppercase tracking-wide text-[11px] pb-[10px] pr-[10px]">{c.label}</th>
                          ))}
                          <th className="pb-[10px]" />
                        </tr>
                      </thead>
                      <tbody>
                        {pageTrades.map((trade) => (
                          <tr key={trade.id} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                            {HISTORY_COLUMNS.filter((c) => visibleColumns.includes(c.key)).map((c) => (
                              <td key={c.key} className="text-[13px] py-[11px] pr-[10px]">{renderCell(c.key, trade)}</td>
                            ))}
                            <td className="py-[11px]">
                              <div className="flex items-center gap-3">
                                <button onClick={() => handleEditClick(trade)} title="Editar" style={{ color: 'var(--color-text-secondary)' }} className="hover:opacity-80">
                                  <Pencil size={14} />
                                </button>
                                <button onClick={() => handleDeleteTrade(trade.id)} title="Eliminar" style={{ color: 'var(--color-text-secondary)' }} className="hover:opacity-80">
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {filteredTrades.length > 0 && (
                  <div className="flex items-center justify-between gap-2 mt-5 pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      Mostrando {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filteredTrades.length)} de {filteredTrades.length} trades
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                        disabled={safePage <= 1}
                        className="w-7 h-7 rounded-lg border text-xs flex items-center justify-center disabled:opacity-40"
                        style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
                      >
                        <ChevronLeft size={14} />
                      </button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                        .map((p, idx, arr) => (
                          <span key={p} className="flex items-center gap-2">
                            {idx > 0 && arr[idx - 1] !== p - 1 && <span style={{ color: 'var(--color-text-muted)' }}>…</span>}
                            <button
                              onClick={() => setHistoryPage(p)}
                              className="w-7 h-7 rounded-lg border text-xs flex items-center justify-center"
                              style={{
                                borderColor: p === safePage ? 'var(--color-accent)' : 'var(--color-border)',
                                color: p === safePage ? 'var(--color-accent)' : 'var(--color-text-muted)',
                                background: p === safePage ? 'color-mix(in srgb, var(--color-accent) 10%, transparent)' : 'transparent',
                              }}
                            >
                              {p}
                            </button>
                          </span>
                        ))}
                      <button
                        onClick={() => setHistoryPage((p) => Math.min(totalPages, p + 1))}
                        disabled={safePage >= totalPages}
                        className="w-7 h-7 rounded-lg border text-xs flex items-center justify-center disabled:opacity-40"
                        style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
                      >
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>

      {/* Panel lateral: agregar / editar trade */}
      {showTradePanel && (
        <>
          <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={closeTradePanel} />
          <div
            className="fixed right-0 top-0 h-full w-full sm:w-[440px] z-50 overflow-y-auto p-6 border-l"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
                {editingId ? 'Editar trade' : 'Registrar trade'}
              </h2>
              <button onClick={closeTradePanel} style={{ color: 'var(--color-text-secondary)' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddTrade}>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm mb-1" style={{ color: 'var(--color-text-muted)' }}>Símbolo</label>
                  <input type="text" placeholder="EURUSD, BTC..." value={symbol} onChange={(e) => setSymbol(e.target.value)} required
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none" style={inputStyle} />
                </div>
                <div>
                  <label className="block text-sm mb-1" style={{ color: 'var(--color-text-muted)' }}>Dirección</label>
                  <select value={direction} onChange={(e) => setDirection(e.target.value as 'long' | 'short')}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none" style={inputStyle}>
                    <option value="long">Long</option>
                    <option value="short">Short</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm mb-1" style={{ color: 'var(--color-text-muted)' }}>Precio entrada</label>
                  <input type="number" step="any" value={entryPrice} onChange={(e) => setEntryPrice(e.target.value)} required
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none" style={inputStyle} />
                </div>
                <div>
                  <label className="block text-sm mb-1" style={{ color: 'var(--color-text-muted)' }}>Precio salida (opcional)</label>
                  <input type="number" step="any" value={exitPrice} onChange={(e) => setExitPrice(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none" style={inputStyle} />
                </div>
                <div>
                  <label className="block text-sm mb-1" style={{ color: 'var(--color-text-muted)' }}>Cantidad</label>
                  <input type="number" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} required
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none" style={inputStyle} />
                </div>
                <div>
                  <label className="block text-sm mb-1" style={{ color: 'var(--color-text-muted)' }}>Comisión</label>
                  <input type="number" step="any" placeholder="0" value={commission} onChange={(e) => setCommission(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none" style={inputStyle} />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm mb-1" style={{ color: 'var(--color-text-muted)' }}>P&L en $</label>
                  <input type="number" step="any" placeholder="150" value={pnlInput} onChange={(e) => setPnlInput(e.target.value)} required
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none" style={inputStyle} />
                </div>
                <div>
                  <label className="block text-sm mb-1" style={{ color: 'var(--color-text-muted)' }}>Stop Loss (opcional)</label>
                  <input type="number" step="any" value={stopLoss} onChange={(e) => setStopLoss(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none" style={inputStyle} />
                </div>
                <div>
                  <label className="block text-sm mb-1" style={{ color: 'var(--color-text-muted)' }}>Take Profit (opcional)</label>
                  <input type="number" step="any" value={takeProfit} onChange={(e) => setTakeProfit(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none" style={inputStyle} />
                </div>

                {(() => {
                  const entry = parseFloat(entryPrice)
                  const sl = parseFloat(stopLoss)
                  const tp = parseFloat(takeProfit)
                  if (isNaN(entry) || isNaN(sl) || isNaN(tp) || entry === sl) return null
                  const risk = Math.abs(entry - sl)
                  const reward = Math.abs(tp - entry)
                  const ratio = risk > 0 ? reward / risk : 0
                  return (
                    <div className="col-span-2 p-3 rounded-lg border flex items-center justify-between" style={{ background: 'var(--color-surface-alt)', borderColor: 'var(--color-border)' }}>
                      <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Risk/Reward calculado</span>
                      <span className="font-display text-lg font-bold" style={{ color: ratio >= 2 ? '#34D399' : ratio >= 1 ? '#FBBF24' : '#F87171' }}>
                        1 : {ratio.toFixed(2)}
                      </span>
                    </div>
                  )
                })()}

                <div>
                  <label className="block text-sm mb-1" style={{ color: 'var(--color-text-muted)' }}>Estrategia (opcional)</label>
                  <input type="text" placeholder="Ruptura de rango" value={strategy} onChange={(e) => setStrategy(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none" style={inputStyle} />
                </div>
                <div>
                  <label className="block text-sm mb-1" style={{ color: 'var(--color-text-muted)' }}>Fecha y hora</label>
                  <input type="datetime-local" value={entryDate} onChange={(e) => setEntryDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none" style={inputStyle} />
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm mb-1" style={{ color: 'var(--color-text-muted)' }}>Tags (separados por coma)</label>
                <input type="text" placeholder="breakout, noticia, disciplina" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none" style={inputStyle} />
              </div>

              <div className="mb-4">
                <label className="block text-sm mb-1" style={{ color: 'var(--color-text-muted)' }}>Notas (opcional)</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none" style={inputStyle} />
              </div>

              {message && (
                <p className="text-sm mb-4" style={{ color: message.startsWith('Error') ? '#F87171' : '#34D399' }}>{message}</p>
              )}

              <button type="submit" disabled={saving}
                className="w-full font-semibold py-2 rounded-lg transition disabled:opacity-50"
                style={{ background: 'var(--color-accent)', color: '#fff' }}>
                {saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Guardar trade'}
              </button>

              {editingId && (
                <button
                  type="button"
                  onClick={() => handleDeleteTrade(editingId)}
                  className="w-full text-sm mt-2 hover:opacity-80"
                  style={{ color: '#F87171' }}
                >
                  Eliminar trade
                </button>
              )}
            </form>
          </div>
        </>
      )}

      {/* Modal: importar desde Excel */}
      {showImportModal && (
        <>
          <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={closeImportModal} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="w-full max-w-lg rounded-2xl border p-6 max-h-[85vh] overflow-y-auto"
              style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
            >
              <div className="flex items-center justify-between mb-[18px]">
                <h2 className="font-display text-lg font-semibold" style={{ color: 'var(--color-text)' }}>Importar trades desde Excel</h2>
                <button onClick={closeImportModal} style={{ color: 'var(--color-text-secondary)' }}>
                  <X size={18} />
                </button>
              </div>
              <p className="text-[13px] mb-4 leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                Se importarán los trades a la cuenta activa: <strong style={{ color: 'var(--color-text)' }}>{activeAccount?.name ?? '—'}</strong>. Usa la plantilla para asegurarte de que las columnas coincidan.
              </p>

              <div className="mb-4">
                <button
                  onClick={downloadTemplate}
                  className="w-full flex items-center justify-center gap-2 text-sm px-4 py-2 rounded-lg border transition"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                >
                  <Download size={16} /> Descargar plantilla (.xlsx)
                </button>
              </div>

              <div className="flex flex-col gap-1.5 mb-2">
                <label className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Archivo Excel</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileChange}
                  className="text-sm rounded-lg border px-3 py-2"
                  style={inputStyle}
                />
                <span className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
                  Columnas obligatorias: Símbolo, Fecha (dd/mm/aaaa) y P&L. El resto es opcional.
                </span>
              </div>

              {importMessage && (
                <p className="text-sm mb-4" style={{ color: importMessage.startsWith('Error') ? '#F87171' : '#34D399' }}>
                  {importMessage}
                </p>
              )}

              {importRows.length > 0 && (
                <div>
                  <p className="text-sm mb-3" style={{ color: 'var(--color-text)' }}>
                    Se encontraron <strong>{importRows.length}</strong> filas — {validCount} válidas
                    {errorCount > 0 && <span style={{ color: '#F87171' }}> · {errorCount} con errores</span>}
                  </p>

                  <div className="max-h-64 overflow-y-auto space-y-2 mb-4">
                    {importRows.map((row, i) => (
                      <div
                        key={i}
                        className="flex justify-between items-center p-3 rounded-lg text-xs"
                        style={{
                          background: 'var(--color-surface-alt)',
                          border: `1px solid ${row.error ? '#F87171' : 'var(--color-border)'}`,
                        }}
                      >
                        <span style={{ color: 'var(--color-text)' }}>
                          {row.symbol || '—'} · {row.direction || '—'} · entrada {row.entry_price || '—'}
                        </span>
                        {row.error ? (
                          <span style={{ color: '#F87171' }}>{row.error}</span>
                        ) : (
                          <span style={{ color: '#34D399' }}>OK</span>
                        )}
                      </div>
                    ))}
                  </div>

                </div>
              )}

              <div className="flex justify-end gap-2.5 mt-[22px]">
                <button
                  onClick={closeImportModal}
                  className="text-sm px-4 py-2 rounded-lg border transition"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
                >
                  Cancelar
                </button>
                {importRows.length > 0 && (
                  <button
                    onClick={handleConfirmImport}
                    disabled={importing || validCount === 0}
                    className="text-sm px-4 py-2 rounded-lg font-semibold transition disabled:opacity-50"
                    style={{ background: 'var(--color-accent)', color: '#fff' }}
                  >
                    {importing ? 'Importando...' : `Importar trades`}
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
