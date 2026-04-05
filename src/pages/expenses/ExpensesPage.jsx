import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Check, X, Search, ArrowUpDown, CheckCircle2, Eye, AlertCircle, Loader2, Plus } from 'lucide-react'
import PageHeader from '@/components/shared/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { fetchAllExpenses, updateExpense, createCaseTask } from '@/lib/db'
import { fetchMatchedJourneys } from '@/lib/matching'
import { fetchSurrogatesFromIntake, fetchIPsFromIntake } from '@/lib/db'
import { formatDate } from '@/lib/utils'
import { useRole } from '@/context/RoleContext'
import { mockUsers } from '@/data/mock/users'

function formatCurrency(val) {
  if (!val && val !== 0) return '—'
  return `$${Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function getAdminName(email) {
  if (!email) return '—'
  const user = mockUsers.find(u => u.email === email)
  return user ? user.name : email.split('@')[0]
}

const COLUMNS = [
  { key: 'expense_date', label: 'Date', format: 'date' },
  { key: 'amount', label: 'Amount', format: 'currency' },
  { key: 'paid_to', label: 'Paid To' },
  { key: 'cc_last4', label: 'CC Last 4', format: 'cc4' },
  { key: 'submitted_to_escrow', label: 'Escrow', format: 'yesno' },
  { key: 'notes', label: 'Notes' },
]

function CellValue({ col, value }) {
  if (value === null || value === undefined || value === '') return <span className="text-stone-300">—</span>
  if (col.format === 'currency') return <span>{formatCurrency(value)}</span>
  if (col.format === 'date') return <span>{formatDate(value)}</span>
  if (col.format === 'cc4') return <span className="font-mono text-stone-600">••••{value}</span>
  if (col.format === 'yesno') return <span className={value ? 'text-green-600 font-medium' : 'text-stone-400'}>{value ? 'Yes' : 'No'}</span>
  return <span>{String(value)}</span>
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
    if (col.format === 'cc4') saveVal = (val || '').replace(/\D/g, '').slice(-4) || null
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

  return (
    <div className="flex items-center gap-1">
      <Input
        value={val}
        onChange={e => setVal(col.format === 'cc4' ? e.target.value.replace(/\D/g, '').slice(0, 4) : col.format === 'currency' ? e.target.value.replace(/[^\d.]/g, '') : e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
        onBlur={col.format === 'currency' ? () => { const n = parseFloat(val); if (!isNaN(n)) setVal(n.toFixed(2)) } : undefined}
        className="h-7 text-xs"
        type={col.format === 'date' ? 'date' : 'text'}
        maxLength={col.format === 'cc4' ? 4 : undefined}
        autoFocus
        placeholder={col.format === 'cc4' ? '1234' : col.format === 'currency' ? '0.00' : col.label}
      />
      <button onClick={save} className="text-green-600 shrink-0"><Check className="size-3.5" /></button>
      <button onClick={() => setEditing(false)} className="text-stone-400 shrink-0"><X className="size-3.5" /></button>
    </div>
  )
}

function ExpenseTable({ expenses, journeyMap, onSave, onReconcile, showReconcile, currentUser, onExpenseUpdate }) {
  const [previewUrl, setPreviewUrl] = useState(null)
  const [reconcileId, setReconcileId] = useState(null)
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [taskNote, setTaskNote] = useState('')
  const [creatingTask, setCreatingTask] = useState(false)
  const reconcileExp = reconcileId ? expenses.find(e => e.id === reconcileId) : null
  const reconcileJourney = reconcileExp ? journeyMap[reconcileExp.journey_id] : null

  if (expenses.length === 0) {
    return (
      <div className="px-6 py-16 text-center text-stone-400">
        <p className="text-sm">No expenses found.</p>
        <p className="text-xs mt-1">Add expenses from a journey's detail page.</p>
      </div>
    )
  }

  return (
    <>
      {/* Attachment Preview Dialog */}
      <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Attachment Preview</DialogTitle>
          </DialogHeader>
          {previewUrl && (
            previewUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i) || previewUrl.match(/image\//)
              ? <img src={previewUrl} alt="Expense attachment" className="w-full rounded-lg" />
              : <iframe src={previewUrl} className="w-full h-[70vh] rounded-lg border" title="Attachment" />
          )}
        </DialogContent>
      </Dialog>

      {/* Reconcile Confirmation Dialog */}
      <Dialog open={!!reconcileId} onOpenChange={() => { setReconcileId(null); setShowTaskForm(false); setTaskNote('') }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Reconciliation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-800">
              {reconcileExp && (
                <>
                  <p>Are you sure you want to reconcile this expense for <strong>{reconcileJourney?.caseName || 'this journey'}</strong>?</p>
                  <p className="mt-2 font-semibold">{formatCurrency(reconcileExp.amount)} — {reconcileExp.paid_to || 'No payee'}</p>
                </>
              )}
            </div>

            {/* + Task section */}
            {reconcileExp?.task_created && (
              <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <AlertCircle className="size-3.5 shrink-0" />
                A task has already been created for this expense.
              </div>
            )}
            {!showTaskForm ? (
              <button onClick={() => setShowTaskForm(true)} className="text-xs text-abc-indigo hover:underline font-medium flex items-center gap-1">
                + {reconcileExp?.task_created ? 'Create Another Task' : 'Create Task'}
              </button>
            ) : (
              <div className="border border-stone-200 rounded-lg p-3 space-y-2">
                <p className="text-xs font-semibold text-stone-600">Create Task</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] text-stone-400 font-medium">Assigned To</label>
                    <p className="text-xs text-stone-700 font-medium bg-stone-50 rounded px-2 py-1.5">{reconcileJourney?.caseManager || '—'}</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-stone-400 font-medium">Due Date</label>
                    <p className="text-xs text-stone-700 font-medium bg-stone-50 rounded px-2 py-1.5">{formatDate(new Date())}</p>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-stone-400 font-medium">Note</label>
                  <Input value={taskNote} onChange={e => setTaskNote(e.target.value)} placeholder="e.g. Please upload the receipt for this expense" className="h-8 text-xs" />
                </div>
                <p className="text-[10px] text-red-500 font-medium">Priority: High</p>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => { setReconcileId(null); setShowTaskForm(false); setTaskNote('') }}>Cancel</Button>
              {showTaskForm ? (
                <Button size="sm" className="gap-1" style={{ backgroundColor: '#283693' }} disabled={creatingTask} onClick={async () => {
                  setCreatingTask(true)
                  try {
                    await createCaseTask({
                      case_id: reconcileExp.journey_id,
                      case_type: 'journey',
                      title: `Upload receipt — ${formatCurrency(reconcileExp.amount)} to ${reconcileExp.paid_to || 'vendor'}`,
                      assigned_to: reconcileJourney?.assignedTo || '',
                      due_date: new Date().toISOString().split('T')[0],
                      priority: 'high',
                      status: 'open',
                      description: taskNote || null,
                      created_by: currentUser?.email || '',
                    })
                    // Mark expense as having a task created
                    const updated = await updateExpense(reconcileExp.id, { task_created: true })
                    if (updated && onExpenseUpdate) onExpenseUpdate(reconcileExp.id, updated)
                    setReconcileId(null)
                    setShowTaskForm(false)
                    setTaskNote('')
                  } catch (err) {
                    console.error('Failed:', err)
                  } finally {
                    setCreatingTask(false)
                  }
                }}>
                  {creatingTask ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />}
                  Create Task
                </Button>
              ) : (
                <Button size="sm" className="gap-1 bg-green-600 hover:bg-green-700 text-white" onClick={() => { onReconcile(reconcileId); setReconcileId(null) }}>
                  <CheckCircle2 className="size-3" /> Reconcile
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-stone-50 dark:bg-[#1e1e2a] border-b border-stone-200 dark:border-[#2a2a38]">
              <th className="text-left px-5 py-3.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider sticky left-0 bg-stone-50 dark:bg-[#1a1a24] z-20 min-w-[200px] border-r border-stone-200 dark:border-[#2a2a38]">
                Case
              </th>
              {COLUMNS.map((col, i) => (
                <th key={col.key} className={`text-left px-4 py-3.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider whitespace-nowrap ${i < COLUMNS.length - 1 ? 'border-r border-stone-100 dark:border-[#2a2a38]' : ''}`}>
                  {col.label}
                </th>
              ))}
              <th className="text-center px-3 py-3.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider whitespace-nowrap border-l border-stone-100 dark:border-[#2a2a38]">
                Doc
              </th>
              {showReconcile && (
                <th className="text-center px-4 py-3.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider whitespace-nowrap">
                  Reconcile
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {expenses.map(exp => {
              const j = journeyMap[exp.journey_id] || {}
              const caseName = j.caseName || 'Unknown Journey'
              const caseManager = j.caseManager || '—'
              const journeyId = exp.journey_id

              return (
                <tr key={exp.id} className="border-b border-stone-100 dark:border-[#2a2a38] hover:bg-stone-50/50">
                  <td className="px-5 py-3.5 sticky left-0 bg-white dark:bg-[#1a1a24] z-20 border-r border-stone-200 dark:border-[#2a2a38]">
                    <Link to={`/journeys/${journeyId}`} className="font-semibold text-[#283693] dark:text-[#c0c8f0] hover:underline text-sm">
                      {caseName}
                    </Link>
                    <p className="text-[10px] text-stone-400 mt-0.5">{caseManager}</p>
                  </td>
                  {COLUMNS.map((col, i) => (
                    <td key={col.key} className={`px-4 py-3 ${i < COLUMNS.length - 1 ? 'border-r border-stone-100 dark:border-[#2a2a38]' : ''}`}>
                      <EditableCell
                        col={col}
                        value={exp[col.key]}
                        onSave={(v) => onSave(exp.id, col.key, v)}
                      />
                    </td>
                  ))}
                  <td className="px-3 py-3 text-center border-l border-stone-100 dark:border-[#2a2a38]">
                    {exp.attachment_url ? (
                      <button onClick={() => setPreviewUrl(exp.attachment_url)} className="text-stone-400 hover:text-abc-indigo transition-colors" title="View attachment">
                        <Eye className="size-4" />
                      </button>
                    ) : (
                      <span className="text-stone-200">—</span>
                    )}
                  </td>
                  {showReconcile && (
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => setReconcileId(exp.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium rounded-md bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
                        title="Mark as reconciled"
                      >
                        <CheckCircle2 className="size-3" /> Reconcile
                      </button>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

export default function ExpensesPage() {
  const { currentUser } = useRole()
  const [expenses, setExpenses] = useState([])
  const [journeyMap, setJourneyMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('expenses')
  const [search, setSearch] = useState('')
  const [adminFilter, setAdminFilter] = useState('')
  const [sortDir, setSortDir] = useState('desc') // desc = newest first

  useEffect(() => {
    async function load() {
      try {
        const [allExpenses, journeys, surrogates, ips] = await Promise.all([
          fetchAllExpenses(),
          fetchMatchedJourneys(),
          fetchSurrogatesFromIntake(),
          fetchIPsFromIntake(),
        ])

        // Build journey lookup with case names
        const gcMap = {}
        for (const s of surrogates) gcMap[s.id] = s.name
        const ipMap = {}
        for (const ip of ips) ipMap[ip.id] = ip.names

        const jMap = {}
        for (const j of journeys) {
          const gcName = gcMap[j.gc_case_id] || 'GC'
          const ipName = ipMap[j.ip_case_id] || 'IP'
          jMap[j.id] = {
            caseName: `${ipName} + ${gcName}`,
            caseManager: getAdminName(j.assigned_to),
            assignedTo: j.assigned_to,
          }
        }

        setExpenses(allExpenses)
        setJourneyMap(jMap)
      } catch (err) {
        console.error('Failed to load expenses:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function handleSave(expenseId, field, value) {
    try {
      const updated = await updateExpense(expenseId, { [field]: value })
      if (updated) {
        setExpenses(prev => prev.map(e => e.id === expenseId ? { ...e, ...updated } : e))
      }
    } catch (err) {
      console.error('Failed to update expense:', err)
    }
  }

  async function handleReconcile(expenseId) {
    try {
      const updated = await updateExpense(expenseId, { reconciled: true, reconciled_at: new Date().toISOString() })
      if (updated) {
        setExpenses(prev => prev.map(e => e.id === expenseId ? { ...e, ...updated } : e))
      }
    } catch (err) {
      console.error('Failed to reconcile expense:', err)
    }
  }

  // Filter and sort
  let filtered = expenses
  if (activeTab === 'expenses') {
    filtered = filtered.filter(e => !e.reconciled)
  } else {
    filtered = filtered.filter(e => e.reconciled)
  }

  if (search) {
    const q = search.toLowerCase()
    filtered = filtered.filter(e => {
      const j = journeyMap[e.journey_id] || {}
      const caseName = (j.caseName || '').toLowerCase()
      const amount = String(e.amount || '')
      const paidTo = (e.paid_to || '').toLowerCase()
      return caseName.includes(q) || amount.includes(q) || paidTo.includes(q)
    })
  }

  if (adminFilter) {
    filtered = filtered.filter(e => {
      const j = journeyMap[e.journey_id]
      return j?.assignedTo === adminFilter
    })
  }

  // Sort by date
  filtered.sort((a, b) => {
    const da = new Date(a.expense_date || 0)
    const db = new Date(b.expense_date || 0)
    return sortDir === 'desc' ? db - da : da - db
  })

  // Get unique admins for filter
  const adminEmails = [...new Set(Object.values(journeyMap).map(j => j.assignedTo).filter(Boolean))]

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        <PageHeader title="Expense Tracking" subtitle="Loading..." />
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <PageHeader title="Expense Tracking" subtitle="Track and reconcile journey expenses" />

      {/* Search + Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 size-3.5 text-stone-300" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by case, amount, or paid to..."
            className="h-9 pl-8 text-sm"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-2.5 text-stone-300 hover:text-stone-500">
              <X className="size-3.5" />
            </button>
          )}
        </div>
        <select
          value={adminFilter}
          onChange={e => setAdminFilter(e.target.value)}
          className="h-9 text-sm border border-stone-200 rounded-md px-2 bg-white min-w-[150px]"
        >
          <option value="">All Case Managers</option>
          {adminEmails.map(email => (
            <option key={email} value={email}>{getAdminName(email)}</option>
          ))}
        </select>
        <Button
          variant="outline"
          size="sm"
          className="gap-1 text-xs"
          onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
        >
          <ArrowUpDown className="size-3" />
          Date {sortDir === 'desc' ? '↓' : '↑'}
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="expenses" className="gap-1">
            Expenses
            <span className="text-[10px] bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded-full ml-1">
              {expenses.filter(e => !e.reconciled).length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="reconciled" className="gap-1">
            Reconciled
            <span className="text-[10px] bg-green-100 text-green-600 px-1.5 py-0.5 rounded-full ml-1">
              {expenses.filter(e => e.reconciled).length}
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="expenses" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <ExpenseTable
                expenses={filtered}
                journeyMap={journeyMap}
                onSave={handleSave}
                onReconcile={handleReconcile}
                showReconcile={true}
                currentUser={currentUser}
                onExpenseUpdate={(id, updated) => setExpenses(prev => prev.map(e => e.id === id ? { ...e, ...updated } : e))}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reconciled" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <ExpenseTable
                expenses={filtered}
                journeyMap={journeyMap}
                onSave={handleSave}
                onReconcile={() => {}}
                showReconcile={false}
                currentUser={currentUser}
                onExpenseUpdate={(id, updated) => setExpenses(prev => prev.map(e => e.id === id ? { ...e, ...updated } : e))}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
