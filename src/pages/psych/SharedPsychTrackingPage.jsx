import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { Search, Brain, Lock, Eye, EyeOff, ShieldCheck, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'
import { fetchSurrogatesFromIntake } from '@/lib/db'
import { fetchMatchedJourneys } from '@/lib/matching'
import { formatDate } from '@/lib/utils'

const TRACKING_KEY = 'psych_tracking'
const SHARE_KEY = 'psych_tracking_share'

// ── Password hashing (SHA-256) ──
async function hashPassword(password) {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}

const CHECKIN_COLS = [
  { key: 'week10', label: '10 Week' },
  { key: 'week20', label: '20 Week' },
  { key: 'week30', label: '30 Week' },
  { key: 'postDelivery', label: 'Post Delivery' },
]

function calcMilestoneDates(dueDate) {
  if (!dueDate) return {}
  const due = new Date(dueDate + 'T00:00:00')
  const conceptionMs = due.getTime() - 280 * 24 * 60 * 60 * 1000
  const fmt = (ms) => new Date(ms).toISOString().split('T')[0]
  return {
    week10Date: fmt(conceptionMs + 70 * 24 * 60 * 60 * 1000),
    week20Date: fmt(conceptionMs + 140 * 24 * 60 * 60 * 1000),
    week30Date: fmt(conceptionMs + 210 * 24 * 60 * 60 * 1000),
  }
}

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
  const [authed, setAuthed] = useState(false)
  const [needsSetup, setNeedsSetup] = useState(false) // true = first time, set password
  const [shareData, setShareData] = useState(null)
  const [surrogates, setSurrogates] = useState([])
  const [journeys, setJourneys] = useState([])
  const [tracking, setTracking] = useState({})
  const [search, setSearch] = useState('')

  // Password state
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)

  const SESSION_KEY = `psych_share_session_${token}`

  useEffect(() => {
    async function load() {
      // Validate share token
      const sd = await getAppConfigPublic(SHARE_KEY)
      if (!sd?.token || sd.token !== token) {
        setValid(false)
        return
      }
      setShareData(sd)
      setValid(true)

      // Check if already authenticated this session
      if (sessionStorage.getItem(SESSION_KEY) === 'true') {
        setAuthed(true)
        await loadData()
        return
      }

      // Check if password has been set
      if (!sd.passwordHash) {
        setNeedsSetup(true)
      }
    }
    load()
  }, [token])

  async function loadData() {
    const [gcs, js, saved] = await Promise.all([
      fetchSurrogatesFromIntake().catch(() => []),
      fetchMatchedJourneys().catch(() => []),
      getAppConfigPublic(TRACKING_KEY),
    ])
    setSurrogates(gcs || [])
    setJourneys(js || [])
    setTracking(saved || {})
  }

  async function handleSetPassword() {
    setPasswordError('')
    if (password.length < 8) { setPasswordError('Password must be at least 8 characters'); return }
    if (password !== confirmPassword) { setPasswordError('Passwords do not match'); return }
    setPasswordSaving(true)
    try {
      const hash = await hashPassword(password)
      const updated = { ...shareData, passwordHash: hash, passwordSetAt: new Date().toISOString() }
      await setAppConfigPublic(SHARE_KEY, updated)
      setShareData(updated)
      sessionStorage.setItem(SESSION_KEY, 'true')
      setAuthed(true)
      setNeedsSetup(false)
      await loadData()
    } catch (err) { setPasswordError('Failed to set password. Please try again.') }
    finally { setPasswordSaving(false) }
  }

  async function handleLogin() {
    setPasswordError('')
    if (!password) { setPasswordError('Please enter your password'); return }
    setPasswordSaving(true)
    try {
      const hash = await hashPassword(password)
      if (hash !== shareData.passwordHash) {
        setPasswordError('Incorrect password')
        setPasswordSaving(false)
        return
      }
      sessionStorage.setItem(SESSION_KEY, 'true')
      setAuthed(true)
      await loadData()
    } catch (err) { setPasswordError('Something went wrong. Please try again.') }
    finally { setPasswordSaving(false) }
  }

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
        const jd = j.journey_data || {}
        const milestones = calcMilestoneDates(jd.dueDate)
        return {
          id: gc.id,
          name: gc.name,
          email: gc.email || '',
          phone: gc.phone || '',
          dueDate: jd.dueDate || null,
          deliveryDate: jd.deliveryDate || null,
          ...milestones,
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
        dueDate: val.dueDate || null,
        deliveryDate: val.deliveryDate || null,
        ...calcMilestoneDates(val.dueDate),
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

  // ── Set Password (first time) ──
  if (valid && !authed && needsSetup) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <Card className="max-w-sm w-full mx-4 rounded-2xl">
          <CardContent className="py-8 px-6 space-y-5">
            <div className="text-center">
              <div className="size-14 rounded-2xl bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center mx-auto mb-3">
                <ShieldCheck className="size-7 text-white" />
              </div>
              <h2 className="text-lg font-bold text-stone-800">Secure Your Access</h2>
              <p className="text-sm text-stone-500 mt-1">Create a password to protect this page. You'll use it each time you visit.</p>
            </div>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs text-stone-500 font-medium">Create Password</label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="pr-9"
                    onKeyDown={e => { if (e.key === 'Enter' && confirmPassword) handleSetPassword() }}
                  />
                  <button onClick={() => setShowPassword(!showPassword)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-stone-500 font-medium">Confirm Password</label>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  onKeyDown={e => { if (e.key === 'Enter') handleSetPassword() }}
                />
              </div>
              {passwordError && <p className="text-xs text-red-500 font-medium">{passwordError}</p>}
              <Button className="w-full gap-1.5" style={{ background: 'linear-gradient(135deg, #ed148c, #283693)' }} onClick={handleSetPassword} disabled={passwordSaving}>
                {passwordSaving ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}
                {passwordSaving ? 'Setting up...' : 'Set Password & Continue'}
              </Button>
            </div>
            <p className="text-[10px] text-stone-400 text-center leading-relaxed">
              This page contains confidential health information protected under HIPAA. Do not share your password or this link with unauthorized individuals.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── Enter Password ──
  if (valid && !authed && !needsSetup) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <Card className="max-w-sm w-full mx-4 rounded-2xl">
          <CardContent className="py-8 px-6 space-y-5">
            <div className="text-center">
              <div className="size-14 rounded-2xl bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center mx-auto mb-3">
                <Lock className="size-7 text-white" />
              </div>
              <h2 className="text-lg font-bold text-stone-800">Password Required</h2>
              <p className="text-sm text-stone-500 mt-1">Enter your password to access the Therapist Check-In sheet.</p>
            </div>
            <div className="space-y-3">
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="pr-9"
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') handleLogin() }}
                />
                <button onClick={() => setShowPassword(!showPassword)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {passwordError && <p className="text-xs text-red-500 font-medium">{passwordError}</p>}
              <Button className="w-full gap-1.5" style={{ background: 'linear-gradient(135deg, #ed148c, #283693)' }} onClick={handleLogin} disabled={passwordSaving}>
                {passwordSaving ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}
                {passwordSaving ? 'Verifying...' : 'Unlock'}
              </Button>
            </div>
            <p className="text-[10px] text-stone-400 text-center leading-relaxed">
              This page contains confidential health information protected under HIPAA. Do not share your password or this link with unauthorized individuals.
            </p>
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
            <h1 className="text-xl font-bold text-stone-800">Therapist Check-Ins</h1>
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
                <th className="text-left px-4 py-3.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider whitespace-nowrap border-r border-stone-100">Contact</th>
                <th className="text-left px-4 py-3.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider whitespace-nowrap border-r border-stone-100">Due Date</th>
                <th className="text-center px-4 py-3.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider whitespace-nowrap border-r border-stone-100" colSpan="2">10 Week</th>
                <th className="text-center px-4 py-3.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider whitespace-nowrap border-r border-stone-100" colSpan="2">20 Week</th>
                <th className="text-center px-4 py-3.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider whitespace-nowrap border-r border-stone-100" colSpan="2">30 Week</th>
                <th className="text-left px-4 py-3.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider whitespace-nowrap border-r border-stone-100">Delivery Date</th>
                <th className="text-center px-4 py-3.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider whitespace-nowrap">Post Delivery</th>
              </tr>
              <tr className="bg-stone-50/50 border-b border-stone-200">
                <th className="sticky left-0 bg-stone-50/50 z-20 border-r border-stone-200" />
                <th className="border-r border-stone-100" />
                <th className="border-r border-stone-100" />
                <th className="text-center px-2 py-1.5 text-[9px] text-stone-400 font-medium border-r border-stone-50">Due</th>
                <th className="text-center px-2 py-1.5 text-[9px] text-stone-400 font-medium border-r border-stone-100">Completed</th>
                <th className="text-center px-2 py-1.5 text-[9px] text-stone-400 font-medium border-r border-stone-50">Due</th>
                <th className="text-center px-2 py-1.5 text-[9px] text-stone-400 font-medium border-r border-stone-100">Completed</th>
                <th className="text-center px-2 py-1.5 text-[9px] text-stone-400 font-medium border-r border-stone-50">Due</th>
                <th className="text-center px-2 py-1.5 text-[9px] text-stone-400 font-medium border-r border-stone-100">Completed</th>
                <th className="border-r border-stone-100" />
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id} className="border-b border-stone-100 hover:bg-stone-50/50">
                  <td className="px-5 py-3.5 sticky left-0 bg-white z-20 border-r border-stone-200">
                    <span className="font-semibold text-xs text-stone-800">{row.name}</span>
                  </td>
                  <td className="px-4 py-3 border-r border-stone-100">
                    <p className="text-stone-600">{row.email || '—'}</p>
                    {row.phone && <p className="text-stone-400 text-[10px]">{row.phone}</p>}
                  </td>
                  <td className="px-4 py-3 border-r border-stone-100 text-stone-600 font-medium">{row.dueDate ? formatDate(row.dueDate) : '—'}</td>
                  <td className="px-3 py-3 border-r border-stone-50 text-center text-stone-400 text-[10px]">{row.week10Date ? formatDate(row.week10Date) : '—'}</td>
                  <td className={`px-3 py-3 border-r border-stone-100 ${row.week10 ? 'bg-green-50/60' : ''}`}>
                    <EditableDateCell value={row.week10} onSave={(date) => onDateChange(row.id, 'week10', date)} />
                  </td>
                  <td className="px-3 py-3 border-r border-stone-50 text-center text-stone-400 text-[10px]">{row.week20Date ? formatDate(row.week20Date) : '—'}</td>
                  <td className={`px-3 py-3 border-r border-stone-100 ${row.week20 ? 'bg-green-50/60' : ''}`}>
                    <EditableDateCell value={row.week20} onSave={(date) => onDateChange(row.id, 'week20', date)} />
                  </td>
                  <td className="px-3 py-3 border-r border-stone-50 text-center text-stone-400 text-[10px]">{row.week30Date ? formatDate(row.week30Date) : '—'}</td>
                  <td className={`px-3 py-3 border-r border-stone-100 ${row.week30 ? 'bg-green-50/60' : ''}`}>
                    <EditableDateCell value={row.week30} onSave={(date) => onDateChange(row.id, 'week30', date)} />
                  </td>
                  <td className="px-4 py-3 border-r border-stone-100 text-stone-600">
                    {row.deliveryDate ? <span className="font-medium text-emerald-600">{formatDate(row.deliveryDate)}</span> : <span className="text-stone-300">—</span>}
                  </td>
                  <td className={`px-3 py-3 ${row.postDelivery ? 'bg-green-50/60' : ''}`}>
                    <EditableDateCell value={row.postDelivery} onSave={(date) => onDateChange(row.id, 'postDelivery', date)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
