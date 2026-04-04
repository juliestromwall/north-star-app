import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Eye, EyeOff, ExternalLink, Check, X, Info } from 'lucide-react'
import PageHeader from '@/components/shared/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { fetchSurrogatesFromIntake, fetchAllInsurance, upsertInsurance, fetchAllInsurancePayments } from '@/lib/db'
import { formatDate } from '@/lib/utils'
import { mockUsers } from '@/data/mock/users'

// Status options match tab names
const INSURANCE_STATUSES = [
  { value: 'active_policy', label: 'Active Policy' },
  { value: 'policy_check', label: 'Policy Check' },
  { value: 'open_enrollment', label: 'Open Enrollment' },
  { value: 'complete', label: 'Complete' },
]

function buildTabs() {
  const currentYear = new Date().getFullYear()
  const tabs = [{ id: 'active', label: 'Active Policies', banner: null, statusFilter: 'active_policy', year: null }]
  for (let y = currentYear; y <= currentYear + 5; y++) {
    tabs.push({ id: `checks-${y}`, label: `Policy Checks - ${y}`, banner: `These surrogates need to have their ${y} Policy Verified with Art Risk.`, statusFilter: 'policy_check', year: y })
    tabs.push({ id: `enrollment-${y}`, label: `Open Enrollment - ${y}`, banner: `These Surrogates will need a Policy for ${y + 1}.`, statusFilter: 'open_enrollment', year: y })
    tabs.push({ id: `complete-${y}`, label: `${y} - Complete`, banner: null, statusFilter: 'complete', year: y })
  }
  return tabs
}

const COLUMNS = [
  { key: 'state', label: 'State', readOnly: true },
  { key: 'insurance_status', label: 'Status', format: 'status' },
  { key: 'insurance_status_year', label: 'Year', format: 'year' },
  { key: 'company', label: 'Insurance Carrier' },
  { key: 'premium_amount', label: 'Premium', format: 'currency' },
  { key: 'premium_due_day', label: 'Due Date', format: 'day' },
  { key: 'website', label: 'Carrier Website', format: 'link' },
  { key: 'portal_login', label: 'Login' },
  { key: 'portal_password', label: 'Password', format: 'password' },
  { key: 'enrolled_autopay', label: 'Autopay', format: 'yesno' },
  { key: 'autopay_day', label: 'Autopay Date', format: 'day' },
  { key: 'plan_start_date', label: 'Plan Start', format: 'date' },
  { key: 'plan_end_date', label: 'Plan End', format: 'date' },
  { key: 'binder_payment_paid', label: 'Binder Paid', format: 'yesno' },
  { key: 'ob_clinic', label: 'OB' },
  { key: 'hospital', label: 'Hospital' },
  { key: 'notes', label: 'Notes' },
]

function formatCurrency(val) {
  if (!val && val !== 0) return '—'
  return `$${Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function ordinal(n) {
  if (!n) return '—'
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

function getAdminName(email) {
  if (!email) return '—'
  const user = mockUsers.find(u => u.email === email)
  return user ? user.name : email.split('@')[0]
}

function CellValue({ col, value }) {
  if (value === null || value === undefined || value === '') return <span className="text-stone-300">—</span>
  if (col.format === 'currency') return <span>{formatCurrency(value)}</span>
  if (col.format === 'day') return <span>{ordinal(value)}</span>
  if (col.format === 'link') {
    const href = value.startsWith('http') ? value : `https://${value}`
    const display = value.replace(/^https?:\/\//, '').slice(0, 22)
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="text-abc-indigo hover:underline inline-flex items-center gap-1">
        {display}{value.replace(/^https?:\/\//, '').length > 22 ? '…' : ''}
        <ExternalLink className="size-3 shrink-0" />
      </a>
    )
  }
  if (col.format === 'yesno') return <span className={value ? 'text-green-600 font-medium' : 'text-stone-400'}>{value ? 'Yes' : 'No'}</span>
  if (col.format === 'date') return <span>{formatDate(value)}</span>
  if (col.format === 'status') {
    const st = INSURANCE_STATUSES.find(s => s.value === value)
    return <span className="text-xs font-medium text-abc-indigo">{st?.label || value || '—'}</span>
  }
  if (col.format === 'year') return <span>{value || '—'}</span>
  return <span>{String(value)}</span>
}

function PasswordCell({ value, onSave }) {
  const [visible, setVisible] = useState(false)
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(value ?? '')

  useEffect(() => { setVal(value ?? '') }, [value])

  if (editing) {
    const save = () => { onSave(val || null); setEditing(false) }
    return (
      <div className="flex items-center gap-1">
        <Input value={val} onChange={e => setVal(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }} className="h-7 text-xs" autoFocus placeholder="Password" />
        <button onClick={save} className="text-green-600 shrink-0"><Check className="size-3.5" /></button>
        <button onClick={() => setEditing(false)} className="text-stone-400 shrink-0"><X className="size-3.5" /></button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5">
      <button onClick={() => setEditing(true)} className="cursor-text min-w-[40px]" title="Click to edit">
        {!value ? <span className="text-stone-300">—</span>
          : visible ? <span className="font-mono text-xs">{value}</span>
          : <span className="text-stone-400 tracking-wider">••••••</span>
        }
      </button>
      {value && (
        <button onClick={() => setVisible(v => !v)} className="text-stone-300 hover:text-stone-500 shrink-0" title={visible ? 'Hide' : 'Show'}>
          {visible ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
        </button>
      )}
    </div>
  )
}

function EditableCell({ col, value, onSave }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(value ?? '')

  useEffect(() => { setVal(value ?? '') }, [value])

  if (!editing) {
    return (
      <button onClick={() => setEditing(true)} className="w-full text-left cursor-text min-h-[20px]" title="Click to edit">
        <CellValue col={col} value={value} />
      </button>
    )
  }

  const save = () => {
    let saveVal = val
    if (col.format === 'currency') saveVal = parseFloat(val) || null
    if (col.format === 'day') saveVal = parseInt(val) || null
    if (col.format === 'yesno') saveVal = val === 'yes' || val === true
    onSave(saveVal)
    setEditing(false)
  }

  if (col.format === 'yesno') {
    return (
      <div className="flex items-center gap-1">
        <select value={val ? 'yes' : 'no'} onChange={e => setVal(e.target.value === 'yes')} className="h-7 text-xs border rounded px-1.5 bg-white" autoFocus>
          <option value="no">No</option>
          <option value="yes">Yes</option>
        </select>
        <button onClick={save} className="text-green-600"><Check className="size-3.5" /></button>
        <button onClick={() => setEditing(false)} className="text-stone-400"><X className="size-3.5" /></button>
      </div>
    )
  }

  if (col.format === 'status') {
    return (
      <div className="flex items-center gap-1">
        <select value={val || ''} onChange={e => setVal(e.target.value)} className="h-7 text-xs border rounded px-1.5 bg-white" autoFocus>
          <option value="">Select...</option>
          {INSURANCE_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <button onClick={save} className="text-green-600"><Check className="size-3.5" /></button>
        <button onClick={() => setEditing(false)} className="text-stone-400"><X className="size-3.5" /></button>
      </div>
    )
  }

  if (col.format === 'year') {
    const currentYear = new Date().getFullYear()
    return (
      <div className="flex items-center gap-1">
        <select value={val || ''} onChange={e => setVal(parseInt(e.target.value) || null)} className="h-7 text-xs border rounded px-1.5 bg-white" autoFocus>
          <option value="">Year...</option>
          {Array.from({ length: 6 }, (_, i) => currentYear + i).map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <button onClick={save} className="text-green-600"><Check className="size-3.5" /></button>
        <button onClick={() => setEditing(false)} className="text-stone-400"><X className="size-3.5" /></button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1">
      <Input
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
        className="h-7 text-xs"
        type={col.format === 'currency' ? 'number' : col.format === 'day' ? 'number' : col.format === 'date' ? 'date' : 'text'}
        step={col.format === 'currency' ? '0.01' : undefined}
        min={col.format === 'day' ? 1 : undefined}
        max={col.format === 'day' ? 31 : undefined}
        autoFocus
        placeholder={col.label}
      />
      <button onClick={save} className="text-green-600 shrink-0"><Check className="size-3.5" /></button>
      <button onClick={() => setEditing(false)} className="text-stone-400 shrink-0"><X className="size-3.5" /></button>
    </div>
  )
}

function InsuranceTable({ surrogates, insuranceMap, paymentsMap, currentMonth, onSave, filterStatus, filterYear, search, adminFilter }) {
  let rows = surrogates.filter(s => insuranceMap[s.id])

  // Search skips tab filtering — shows results across all statuses
  if (search) {
    const q = search.toLowerCase()
    rows = rows.filter(s => {
      const ins = insuranceMap[s.id] || {}
      return s.name.toLowerCase().includes(q) || (ins.company || '').toLowerCase().includes(q) || (s.location || '').toLowerCase().includes(q)
    })
  } else {
    // Only filter by status/year when not searching
    if (filterStatus === 'active_policy') {
      rows = rows.filter(s => {
        const st = insuranceMap[s.id]?.insurance_status
        return !st || st === 'active_policy'
      })
    } else if (filterStatus) {
      rows = rows.filter(s => {
        const ins = insuranceMap[s.id]
        if (ins?.insurance_status !== filterStatus) return false
        if (filterYear && ins?.insurance_status_year && ins.insurance_status_year !== filterYear) return false
        return true
      })
    }
  }

  // Admin filter
  if (adminFilter) {
    rows = rows.filter(s => s.assignedTo === adminFilter)
  }

  if (rows.length === 0) {
    return (
      <div className="px-6 py-16 text-center text-stone-400">
        <p className="text-sm">No surrogates in this category.</p>
        <p className="text-xs mt-1">Update a surrogate's insurance status to move them here.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-stone-50 dark:bg-[#1e1e2a] border-b border-stone-200 dark:border-[#2a2a38]">
            <th className="text-left px-5 py-3.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider sticky left-0 bg-stone-50 dark:bg-[#1a1a24] z-20 min-w-[180px] border-r border-stone-200 dark:border-[#2a2a38]">
              Surrogate
            </th>
            <th className="text-center px-3 py-3.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider sticky left-[180px] bg-stone-50 dark:bg-[#1a1a24] z-20 min-w-[80px] border-r border-stone-200 dark:border-[#2a2a38]">
              Pay Status
            </th>
            {COLUMNS.map((col, i) => (
              <th key={col.key} className={`text-left px-4 py-3.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider whitespace-nowrap ${i < COLUMNS.length - 1 ? 'border-r border-stone-100 dark:border-[#2a2a38]' : ''}`}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(s => {
            const ins = insuranceMap[s.id] || {}
            const state = s.location?.split(', ').pop() || ''
            return (
              <tr key={s.id} className="border-b border-stone-100 dark:border-[#2a2a38] hover:bg-stone-50/50">
                <td className="px-5 py-3.5 sticky left-0 bg-white dark:bg-[#1a1a24] z-20 border-r border-stone-200 dark:border-[#2a2a38]">
                  <Link to={`/surrogates/${s.id}`} className="font-semibold text-[#283693] dark:text-[#c0c8f0] hover:underline text-sm">
                    {s.name}
                  </Link>
                  <div className="text-[10px] text-stone-400 mt-0.5">
                    {getAdminName(s.assignedTo)}
                  </div>
                </td>
                <td className="px-3 py-3.5 text-center sticky left-[180px] bg-white dark:bg-[#1a1a24] z-20 border-r border-stone-200 dark:border-[#2a2a38]">
                  {(() => {
                    const paidMonths = paymentsMap[ins.id]
                    const isPaid = paidMonths?.has(currentMonth)
                    return isPaid
                      ? <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-700">PAID</span>
                      : <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold bg-red-100 text-red-600">UNPAID</span>
                  })()}
                </td>
                {COLUMNS.map((col, i) => {
                  const value = col.key === 'state' ? state : ins[col.key] ?? null
                  const borderCls = i < COLUMNS.length - 1 ? 'border-r border-stone-100 dark:border-[#2a2a38]' : ''
                  if (col.readOnly) {
                    return <td key={col.key} className={`px-4 py-3.5 text-stone-600 ${borderCls}`}>{value || '—'}</td>
                  }
                  if (col.format === 'password') {
                    return (
                      <td key={col.key} className={`px-4 py-3.5 ${borderCls}`}>
                        <PasswordCell value={value} onSave={val => onSave(s.id, col.key, val)} />
                      </td>
                    )
                  }
                  return (
                    <td key={col.key} className={`px-4 py-3.5 ${borderCls}`}>
                      <EditableCell col={col} value={value} onSave={val => onSave(s.id, col.key, val)} />
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function TabBanner({ message }) {
  return (
    <div className="flex items-start gap-2 px-5 py-3 bg-blue-50 border-b border-blue-100 text-sm text-blue-800">
      <Info className="size-4 shrink-0 mt-0.5 text-blue-500" />
      {message}
    </div>
  )
}

export default function InsurancePage() {
  const [surrogates, setSurrogates] = useState([])
  const [insuranceMap, setInsuranceMap] = useState({})
  const [paymentsMap, setPaymentsMap] = useState({}) // insuranceId -> Set of month_for strings
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('active')
  const [search, setSearch] = useState('')
  const [adminFilter, setAdminFilter] = useState('')

  const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`

  const tabs = buildTabs()

  useEffect(() => {
    async function load() {
      try {
        const [surrData, insData, payData] = await Promise.all([
          fetchSurrogatesFromIntake(),
          fetchAllInsurance(),
          fetchAllInsurancePayments(),
        ])
        setSurrogates(surrData || [])
        const map = {}
        ;(insData || []).forEach(ins => { map[ins.case_id] = ins })
        setInsuranceMap(map)
        // Build payments lookup: insuranceId -> Set of paid months
        const pmap = {}
        ;(payData || []).forEach(p => {
          if (!pmap[p.insurance_id]) pmap[p.insurance_id] = new Set()
          pmap[p.insurance_id].add(p.month_for)
        })
        setPaymentsMap(pmap)
      } catch (err) {
        console.error('Failed to load insurance data:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function handleSave(surrogateId, fieldKey, value) {
    try {
      const updated = await upsertInsurance(surrogateId, 'surrogate', { [fieldKey]: value })
      if (updated) {
        setInsuranceMap(prev => ({ ...prev, [surrogateId]: { ...prev[surrogateId], ...updated } }))
      }
    } catch (err) {
      console.error('Failed to save:', err)
    }
  }

  if (loading) {
    return (
      <div className="p-4 lg:p-6">
        <PageHeader title="Insurance" subtitle="Loading..." />
      </div>
    )
  }

  const insuredCount = surrogates.filter(s => insuranceMap[s.id]).length

  // Get unique admins from insured surrogates for filter dropdown
  const adminEmails = [...new Set(surrogates.filter(s => insuranceMap[s.id] && s.assignedTo).map(s => s.assignedTo))]
  const adminOptions = adminEmails.map(email => ({ email, name: getAdminName(email) })).sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="p-3 sm:p-4 lg:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <PageHeader title="Insurance" subtitle={`${insuredCount} active ${insuredCount === 1 ? 'policy' : 'policies'}`} />
        <div className="flex items-center gap-2">
          <div className="relative">
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, carrier, state..."
              className="h-8 text-sm w-56 pr-7"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
                <X className="size-3.5" />
              </button>
            )}
          </div>
          <select
            value={adminFilter}
            onChange={e => setAdminFilter(e.target.value)}
            className="h-8 text-sm border border-stone-200 rounded-md px-2 bg-white min-w-[140px]"
          >
            <option value="">All Case Managers</option>
            {adminOptions.map(a => (
              <option key={a.email} value={a.email}>{a.name}</option>
            ))}
          </select>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="overflow-x-auto pb-1">
          <TabsList className="inline-flex h-auto p-1 bg-stone-100 rounded-lg gap-0.5 flex-nowrap">
            {tabs.map(tab => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="whitespace-nowrap text-xs px-3 py-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm"
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {tabs.map(tab => (
          <TabsContent key={tab.id} value={tab.id} className="mt-3">
            <Card className="rounded-xl">
              <CardContent className="p-0">
                {tab.banner && <TabBanner message={tab.banner} />}
                <InsuranceTable
                  surrogates={surrogates}
                  insuranceMap={insuranceMap}
                  paymentsMap={paymentsMap}
                  currentMonth={currentMonth}
                  onSave={handleSave}
                  filterStatus={tab.statusFilter}
                  filterYear={tab.year}
                  search={search}
                  adminFilter={adminFilter}
                />
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
