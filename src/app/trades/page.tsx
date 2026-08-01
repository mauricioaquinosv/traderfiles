'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import type { Trade } from '@/lib/types'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'
import { useAccount } from '@/contexts/AccountContext'
import * as XLSX from 'xlsx'
import { Download, Upload } from 'lucide-react'

const inputStyle = {
  background: 'var(--color-surface-alt)',
  borderColor: 'var(--color-border)',
  color: 'var(--color-text)',
}

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

export default function TradesPage() {
  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [trades, setTrades] = useState<Trade[]>([])
  const router = useRouter()
  const supabase = createClient()
  const { activeAccountId, loading: accountLoading } = useAccount()

  const [symbol, setSymbol] = useState('')
  const [direction, setDirection] = useState<'long' | 'short'>('long')
  const [entryPrice, setEntryPrice] = useState('')
  const [exitPrice, setExitPrice] = useState('')
  const [quantity, setQuantity] = useState('')
  const [commission, setCommission] = useState('')
  const [stopLoss, setStopLoss] = useState('')
  const [takeProfit, setTakeProfit] = useState('')
  const [strategy, setStrategy] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [notes, setNotes] = useState('')
  const [entryDate, setEntryDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const [filterSymbol, setFilterSymbol] = useState('')
  const [filterStrategy, setFilterStrategy] = useState('')
  const [filterTag, setFilterTag] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')

  const [importRows, setImportRows] = useState<ImportRow[]>([])
  const [importing, setImporting] = useState(false)
  const [importMessage, setImportMessage] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  const calculateRiskReward = () => {
  const entry = parseFloat(entryPrice)
  const sl = parseFloat(stopLoss)
  const tp = parseFloat(takeProfit)
  const qty = parseFloat(quantity) || 0

  if (isNaN(entry) || isNaN(sl) || isNaN(tp)) return null

  const risk = direction === 'long' ? entry - sl : sl - entry
  const reward = direction === 'long' ? tp - entry : entry - tp

  if (risk <= 0 || reward <= 0) return { invalid: true, risk, reward, ratio: 0, riskAmount: 0 }

  const ratio = reward / risk
  const riskAmount = risk * qty

  return { invalid: false, risk, reward, ratio, riskAmount }
}

const rr = calculateRiskReward()
  const calculatePnL = (entry: number, exit: number, qty: number, dir: string, comm: number) => {
    const diff = dir === 'long' ? exit - entry : entry - exit
    return diff * qty - comm
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
    const pnl = exit !== null ? calculatePnL(entry, exit, qty, direction, comm) : null
    const tags = tagsInput.split(',').map((t) => t.trim()).filter((t) => t.length > 0)

    const { error } = await supabase.from('trades').insert({
      account_id: activeAccountId,
      user_id: user?.id,
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
    })

    if (error) {
      setMessage('Error: ' + error.message)
    } else {
      setMessage('¡Trade guardado!')
      setSymbol(''); setEntryPrice(''); setExitPrice(''); setQuantity(''); setCommission('')
      setStopLoss(''); setTakeProfit(''); setStrategy(''); setTagsInput(''); setNotes(''); setEntryDate('')
      loadTrades(activeAccountId)
    }
    setSaving(false)
  }

  const handleDeleteTrade = async (id: string) => {
    const { error } = await supabase.from('trades').delete().eq('id', id)
    if (!error && activeAccountId) loadTrades(activeAccountId)
  }

  // --- Importación desde Excel ---

  const downloadTemplate = () => {
    const headers = ['symbol', 'direction', 'entry_price', 'exit_price', 'quantity', 'commission', 'stop_loss', 'take_profit', 'strategy', 'tags', 'notes', 'entry_date']
    const example = ['EURUSD', 'long', 1.085, 1.091, 0.5, 0, 1.08, 1.095, 'Ruptura de rango', 'breakout,plan', 'Ejemplo de fila', '2026-07-15 10:30']
    const ws = XLSX.utils.aoa_to_sheet([headers, example])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Trades')
    XLSX.writeFile(wb, 'plantilla-traderfiles.xlsx')
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
          const symbolVal = String(row.symbol ?? '').toUpperCase().trim()
          const directionVal = String(row.direction ?? '').toLowerCase().trim() as 'long' | 'short'
          const entryVal = parseFloat(String(row.entry_price ?? ''))
          const exitRaw = row.exit_price
          const exitVal = exitRaw !== undefined && exitRaw !== '' ? parseFloat(String(exitRaw)) : null
          const qtyVal = parseFloat(String(row.quantity ?? ''))
          const commVal = row.commission !== undefined && row.commission !== '' ? parseFloat(String(row.commission)) : 0

          if (!symbolVal) error = 'Falta símbolo'
          else if (directionVal !== 'long' && directionVal !== 'short') error = 'Dirección debe ser long o short'
          else if (isNaN(entryVal)) error = 'Precio de entrada inválido'
          else if (isNaN(qtyVal)) error = 'Cantidad inválida'

          let dateVal = ''
          if (row.entry_date instanceof Date) {
            dateVal = row.entry_date.toISOString()
          } else if (row.entry_date) {
            const d = new Date(String(row.entry_date))
            dateVal = isNaN(d.getTime()) ? '' : d.toISOString()
          }
          if (!dateVal) dateVal = new Date().toISOString()

          const tags = row.tags ? String(row.tags).split(',').map((t) => t.trim()).filter(Boolean) : []
          const pnl = exitVal !== null && !error ? calculatePnL(entryVal, exitVal, qtyVal, directionVal, commVal) : null

          return {
            symbol: symbolVal,
            direction: directionVal,
            entry_price: entryVal,
            exit_price: exitVal,
            quantity: qtyVal,
            commission: commVal,
            stop_loss: row.stop_loss ? parseFloat(String(row.stop_loss)) : null,
            take_profit: row.take_profit ? parseFloat(String(row.take_profit)) : null,
            strategy: row.strategy ? String(row.strategy) : null,
            tags,
            notes: row.notes ? String(row.notes) : null,
            entry_date: dateVal,
            pnl,
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

  const filteredTrades = trades.filter((trade) => {
    if (filterSymbol && !trade.symbol.toLowerCase().includes(filterSymbol.toLowerCase())) return false
    if (filterStrategy && trade.strategy !== filterStrategy) return false
    if (filterTag && !trade.tags?.includes(filterTag)) return false
    if (filterFrom && new Date(trade.entry_date) < new Date(filterFrom)) return false
    if (filterTo && new Date(trade.entry_date) > new Date(filterTo + 'T23:59:59')) return false
    return true
  })

  const uniqueStrategies = Array.from(new Set(trades.map((t) => t.strategy).filter(Boolean))) as string[]
  const uniqueTags = Array.from(new Set(trades.flatMap((t) => t.tags ?? [])))

  if (authLoading || accountLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-bg)' }}>
        <p style={{ color: 'var(--color-text-muted)' }}>Cargando...</p>
      </div>
    )
  }

  const validCount = importRows.filter((r) => !r.error).length
  const errorCount = importRows.filter((r) => r.error).length

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg)' }}>
      <Sidebar email={user?.email ?? ''} />

      <main className="ml-60 p-8">
        <div className="max-w-3xl mx-auto">
          <div className="mb-6">
            <h1 className="font-display text-2xl font-bold" style={{ color: 'var(--color-text)' }}>Trades</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>Registra y consulta tu historial completo</p>
          </div>

          <Topbar />

          {!activeAccountId ? (
            <div className="p-6 rounded-2xl border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Crea una cuenta primero para poder registrar trades.</p>
            </div>
          ) : (
            <>
              {/* Importar desde Excel */}
              <div className="p-6 rounded-2xl border mb-6" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                <h2 className="font-display text-lg font-semibold mb-2" style={{ color: 'var(--color-text)' }}>Importar desde Excel</h2>
                <p className="text-xs mb-4" style={{ color: 'var(--color-text-muted)' }}>
                  Descarga la plantilla, llénala con tus trades, y súbela aquí.
                </p>

                <div className="flex gap-3 mb-4">
                  <button
                    onClick={downloadTemplate}
                    className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg border transition"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
                  >
                    <Download size={16} /> Descargar plantilla
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg font-semibold transition"
                    style={{ background: 'var(--color-accent)', color: 'var(--color-bg)' }}
                  >
                    <Upload size={16} /> Subir archivo
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileChange}
                    className="hidden"
                  />
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

                    <button
                      onClick={handleConfirmImport}
                      disabled={importing || validCount === 0}
                      className="w-full font-semibold py-2 rounded-lg transition disabled:opacity-50"
                      style={{ background: 'var(--color-accent)', color: 'var(--color-bg)' }}
                    >
                      {importing ? 'Importando...' : `Importar ${validCount} trades`}
                    </button>
                  </div>
                )}
              </div>

              <div className="p-6 rounded-2xl border mb-6" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                <h2 className="font-display text-lg font-semibold mb-4" style={{ color: 'var(--color-text)' }}>Registrar trade</h2>
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
                    {rr && (
  <div className="col-span-2 p-3 rounded-lg text-sm" style={{
    background: rr.invalid ? 'rgba(248,113,113,0.1)' : 'color-mix(in srgb, var(--color-accent) 10%, transparent)',
    border: `1px solid ${rr.invalid ? '#F87171' : 'var(--color-accent)'}`,
  }}>
    {rr.invalid ? (
      <span style={{ color: '#F87171' }}>
        Revisa el SL/TP: no generan un riesgo/beneficio válido para esta dirección ({direction === 'long' ? 'Long' : 'Short'}).
      </span>
    ) : (
      <div className="flex justify-between items-center">
        <span style={{ color: 'var(--color-text)' }}>
          Ratio Risk/Reward: <strong>1:{rr.ratio.toFixed(2)}</strong>
        </span>
        <span style={{ color: 'var(--color-text-muted)' }}>
          Riesgo total: <strong style={{ color: 'var(--color-text)' }}>{rr.riskAmount.toFixed(2)}</strong>
        </span>
      </div>
    )}
  </div>
)}
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
                    style={{ background: 'var(--color-accent)', color: 'var(--color-bg)' }}>
                    {saving ? 'Guardando...' : 'Guardar trade'}
                  </button>
                </form>
              </div>

              <div className="p-6 rounded-2xl border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                <h2 className="font-display text-lg font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
                  Historial de trades ({filteredTrades.length})
                </h2>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                  <input type="text" placeholder="Buscar símbolo..." value={filterSymbol} onChange={(e) => setFilterSymbol(e.target.value)}
                    className="px-3 py-2 border rounded-lg text-sm focus:outline-none" style={inputStyle} />
                  <select value={filterStrategy} onChange={(e) => setFilterStrategy(e.target.value)}
                    className="px-3 py-2 border rounded-lg text-sm focus:outline-none" style={inputStyle}>
                    <option value="">Toda estrategia</option>
                    {uniqueStrategies.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <select value={filterTag} onChange={(e) => setFilterTag(e.target.value)}
                    className="px-3 py-2 border rounded-lg text-sm focus:outline-none" style={inputStyle}>
                    <option value="">Todo tag</option>
                    {uniqueTags.map((t) => <option key={t} value={t}>#{t}</option>)}
                  </select>
                  <input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)}
                    className="px-3 py-2 border rounded-lg text-sm focus:outline-none" style={inputStyle} />
                  <input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)}
                    className="px-3 py-2 border rounded-lg text-sm focus:outline-none" style={inputStyle} />
                </div>

                {(filterSymbol || filterStrategy || filterTag || filterFrom || filterTo) && (
                  <button
                    onClick={() => { setFilterSymbol(''); setFilterStrategy(''); setFilterTag(''); setFilterFrom(''); setFilterTo('') }}
                    className="text-xs mb-4 hover:opacity-80"
                    style={{ color: 'var(--color-accent)' }}
                  >
                    Limpiar filtros
                  </button>
                )}

                {filteredTrades.length === 0 ? (
                  <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                    {trades.length === 0 ? 'Aún no tienes trades registrados en esta cuenta.' : 'Ningún trade coincide con los filtros.'}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {filteredTrades.map((trade) => (
                      <div key={trade.id} className="flex justify-between items-center p-4 rounded-xl border" style={{ background: 'var(--color-surface-alt)', borderColor: 'var(--color-border)' }}>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold" style={{ color: 'var(--color-text)' }}>{trade.symbol}</span>
                            <span className="text-xs px-2 py-0.5 rounded" style={{
                              background: trade.direction === 'long' ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.15)',
                              color: trade.direction === 'long' ? '#34D399' : '#F87171',
                            }}>
                              {trade.direction === 'long' ? 'Long' : 'Short'}
                            </span>
                            {trade.strategy && (
                              <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--color-border)', color: 'var(--color-text-muted)' }}>{trade.strategy}</span>
                            )}
                            {trade.tags?.map((tag) => (
                              <span key={tag} className="text-xs px-2 py-0.5 rounded" style={{ background: 'color-mix(in srgb, var(--color-accent) 12%, transparent)', color: 'var(--color-accent)' }}>#{tag}</span>
                            ))}
                          </div>
                          <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                            Entrada: {trade.entry_price} → Salida: {trade.exit_price ?? '—'} | Cantidad: {trade.quantity}
                            {trade.stop_loss && ` | SL: ${trade.stop_loss}`}
                            {trade.take_profit && ` | TP: ${trade.take_profit}`}
                          </p>
                          {trade.notes && <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>{trade.notes}</p>}
                        </div>
                        <div className="flex items-center gap-3">
                          {trade.pnl !== null && (
                            <span className="font-semibold" style={{ color: trade.pnl >= 0 ? '#34D399' : '#F87171' }}>
                              {trade.pnl >= 0 ? '+' : ''}{trade.pnl.toFixed(2)}
                            </span>
                          )}
                          <button onClick={() => handleDeleteTrade(trade.id)} className="text-sm hover:opacity-80" style={{ color: 'var(--color-text-muted)' }}>
                            Eliminar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}