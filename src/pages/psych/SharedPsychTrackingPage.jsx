import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { Search, Brain } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'
import { fetchSurrogatesFromIntake } from '@/lib/db'
import { fetchMatchedJourneys } from '@/lib/matching'
import { formatDate } from '@/lib/utils'

const TRACKING_KEY = 'psych_tracking'
const SHARE_KEY = 'psych_tracking_share'

const CHECKIN_COLS = [
  { key: 'week10', label: '10 Week' },
  { key: 'week20', label: '20 Week' },
  { key: 'week30', label: '30 Week' },
  { key: 'postDelivery', label: 'Post Delivery' },
]

async function getAppConfigPublic(key) {
  if (!supabase) return null
  const { data, error } = await supabase.from('app_config').select('config_value').eq('config_key', key).single()
  if (error) return null
  return data?.config_value ?? null
}

async function setAppConfigPublic(key, value) {
  if (!supabase) return null
  const { data, error } = await supabase.from('app_config').upsert(
    { config_key: key, config_value: value, updated_at: new Date().toISOString() },
    { onConflict: 'config_key' }
  ).select().single()
  if (error) return null
  return data
}

export default function SharedPsychTrackingPage() {
  const { token } = useParams()
  const [valid, setValid] = useState(null) // null = loading, true/false
  const [surrogates, setSurrogates] = useState([])
  const [journeys, setJourneys] = useState([])
  const [tracking, setTracking] = useState({})
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function load() {
      // Validate share token
      const shareData = await getAppConfigPublic(SHARE_KEY)
      if (!shareData?.token || shareData.token !== token) {
        setValid(false)
        return
      }

      // Load data
      const [gcs, js, saved] = await Promise.all([
        fetchSurrogatesFromIntake().catch(() => []),
        fetchMatchedJourneys().catch(() => []),
        getAppConfigPublic(TRACKING_KEY),
      ])
      setSurrogates(gcs || [])
      setJourneys(js || [])
      setTracking(saved || {})
      setValid(true)
    }
    load()
  }, [token])

  const saveTracking = useCallback(async (updated) => {
    setTracking(updated)
    await setAppConfigPublic(TRACKING_KEY, updated)
  }, [])

  const rows = useMemo(() => {
    const pregnantRows = journeys
      .filter(j => j.journey_data?.pregnant === 'yes')
      .map(j => {
        const gc = surrogates.find(s => s.id === j.gc_case_id)
        if (!gc) return null
        const t = tracking[gc.id] || {}
        return {
          id: gc.id,
          name: gc.name,
          email: gc.email || '',
          phone: gc.phone || '',
          week10: t.week10 || null,
          week20: t.week20 || null,
          week30: t.week30 || null,
          postDelivery: t.postDelivery || null,
        }
      }).filter(Boolean)

    const manualRows = Object.entries(tracking)
      .filter(([key, val]) => key.startsWith('manual_') && val._manual)
      .map(([key, val]) => ({
        id: key,
        name: val.name || 'Unknown',
        email: val.email || '',
        phone: val.phone || '',
        week10: val.week10 || null,
        week20: val.week20 || null,
        week30: val.week30 || null,
        postDelivery: val.postDelivery || null,
      }))

    return [...pregnantRows, ...manualRows]
  }, [surrogates, journeys, tracking])

  const filtered = useMemo(() => {
    if (!search) return rows
    const q = search.toLowerCase()
    return rows.filter(r => r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q))
  }, [rows, search])

  async function updateDate(surrogateId, field, value) {
    const updated = { ...tracking, [surrogateId]: { ...tracking[surrogateId], [field]: value } }
    await saveTracking(updated)
  }

  if (valid === null) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="text-stone-400 text-sm">Loading...</div>
      </div>
    )
  }

  if (valid === false) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <Card className="max-w-sm w-full mx-4">
          <CardContent className="py-12 text-center">
            <Brain className="size-10 mx-auto mb-3 text-stone-300" />
            <h2 className="text-lg font-semibold text-stone-800 mb-1">Invalid Share Link</h2>
            <p className="text-sm text-stone-500">This link is no longer valid or has been revoked.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center">
            <Brain className="size-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-stone-800">Psych Tracking</h1>
            <p className="text-sm text-stone-500">ABC Surrogacy · {rows.length} surrogates</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <Input placeholder="Search name or email..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>

        {/* Table */}
        <SharedPsychTable rows={filtered} onDateChange={updateDate} />

        <p className="text-[10px] text-stone-400 text-center pt-4">
          ABC Surrogacy · Shared view · Click any date cell to update
        </p>
      </div>
    </div>
  )
}

// ── Editable Date Cell (shared view) ──
function EditableDateCell({ value, onSave }) {
  const [editing, setEditing] = useState(false)

  if (value && !editing) {
    return (
      <span className="text-emerald-600 font-medium cursor-pointer hover:underline" onClick={() => setEditing(true)} title="Click to edit">
        {formatDate(value)}
      </span>
    )
  }

  return editing ? (
    <input
      type="date"
      autoFocus
      defaultValue={value || ''}
      className="text-xs border border-stone-300 rounded px-1.5 py-1 w-[130px]"
      onBlur={(e) => { if (e.target.value) onSave(e.target.value); setEditing(false) }}
      onKeyDown={(e) => { if (e.key === 'Enter' && e.target.value) { onSave(e.target.value); setEditing(false) } if (e.key === 'Escape') setEditing(false) }}
    />
  ) : (
    <button onClick={() => setEditing(true)} className="text-stone-400 hover:text-violet-500 text-xs transition-colors">
      + Add date
    </button>
  )
}

// ── Shared Table (no case links) ──
function SharedPsychTable({ rows, onDateChange }) {
  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="p-0">
          <div className="px-6 py-16 text-center text-stone-400">
            <p className="text-sm">No surrogates found.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200">
                <th className="text-left px-5 py-3.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider sticky left-0 bg-stone-50 z-20 min-w-[180px] border-r border-stone-200">
                  Surrogate
                </th>
                <th className="text-left px-4 py-3.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider whitespace-nowrap border-r border-stone-100">Email</th>
                <th className="text-left px-4 py-3.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider whitespace-nowrap border-r border-stone-100">Phone</th>
                {CHECKIN_COLS.map(col => (
                  <th key={col.key} className="text-left px-4 py-3.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider whitespace-nowrap border-r border-stone-100 last:border-r-0">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id} className="border-b border-stone-100 hover:bg-stone-50/50">
                  <td className="px-5 py-3.5 sticky left-0 bg-white z-20 border-r border-stone-200">
                    <span className="font-semibold text-xs text-stone-800">{row.name}</span>
                  </td>
                  <td className="px-4 py-3 border-r border-stone-100 text-stone-600">{row.email || '—'}</td>
                  <td className="px-4 py-3 border-r border-stone-100 text-stone-600">{row.phone || '—'}</td>
                  {CHECKIN_COLS.map(col => (
                    <td key={col.key} className={`px-4 py-3 border-r border-stone-100 last:border-r-0 ${row[col.key] ? 'bg-green-50/60' : ''}`}>
                      <EditableDateCell
                        value={row[col.key]}
                        onSave={(date) => onDateChange(row.id, col.key, date)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
