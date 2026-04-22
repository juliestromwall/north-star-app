import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Check, X, Search, ArrowUpDown, CheckCircle2, Eye, AlertCircle, Loader2, Plus, Mail, DollarSign, ChevronDown, ChevronUp } from 'lucide-react'
import PageHeader from '@/components/shared/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { fetchAllExpenses, updateExpense, createCaseTask } from '@/lib/db'
import { getGoogleStatus, getEmail, parseEmailHeaders, parseEmailBody, parseEmailAttachments, getAttachment } from '@/lib/google'
import { fetchMatchedJourneys } from '@/lib/matching'
import { fetchSurrogatesFromIntake, fetchIPsFromIntake } from '@/lib/db'
import { formatDate } from '@/lib/utils'
import { useRole } from '@/context/RoleContext'
import { mockUsers, getAdminStaff } from '@/data/mock/users'

function formatCurrency(val) {
  if (!val && val !== 0) return '—'
  return `$${Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function getAdminName(email) {
  if (!email) return '—'
  const user = mockUsers.find(u => u.email === email)
  return user ? user.name : email.split('@')[0]
}

// Journeys excluded from the expense tracker (legacy/test data — expenses still live on the journey page itself)
const EXCLUDED_JOURNEY_IDS = new Set([19])

const COLUMNS = [
  { key: 'expense_date', label: 'Date', format: 'date' },
  { key: 'amount', label: 'Amount', format: 'currency' },
  { key: 'paid_to', label: 'Paid To' },
  { key: 'cc_last4', label: 'CC Last 4', format: 'cc4' },
]

// Derive the 4-way disposition (not_funded | yes | not_needed | paid) from
// the boolean / timestamp fields on a row. Priority: not_needed > paid > yes > not_funded.
export function getEscrowStatus(exp) {
  if (exp.escrow_not_needed) return 'not_needed'
  if (exp.disbursement_paid_at) return 'paid'
  if (exp.submitted_to_escrow) return 'yes'
  return 'not_funded'
}

// Map a selected option back to the DB updates needed to land in that state.
export function escrowStatusUpdates(next, { userEmail, nowIso }) {
  if (next === 'not_funded') {
    return {
      submitted_to_escrow: false,
      escrow_not_needed: false,
      disbursement_requested_at: null,
      disbursement_requested_by: null,
      disbursement_paid_at: null,
      disbursement_paid_by: null,
    }
  }
  if (next === 'yes') {
    return {
      submitted_to_escrow: true,
      escrow_not_needed: false,
      disbursement_requested_at: nowIso,
      disbursement_requested_by: userEmail,
      disbursement_paid_at: null,
      disbursement_paid_by: null,
    }
  }
  if (next === 'not_needed') {
    return {
      submitted_to_escrow: false,
      escrow_not_needed: true,
      disbursement_requested_at: null,
      disbursement_requested_by: null,
      disbursement_paid_at: null,
      disbursement_paid_by: null,
    }
  }
  return {}
}

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
      <button onClick={() => setEditing(true)} className="text-left cursor-text min-h-[20px] hover:bg-stone-50 rounded px-1 -mx-1" title="Click to edit">
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
        onChange={e => {
          if (col.format === 'cc4') setVal(e.target.value.replace(/\D/g, '').slice(0, 4))
          else if (col.format === 'currency') { const digits = e.target.value.replace(/[^\d]/g, ''); const cents = parseInt(digits || '0', 10); setVal((cents / 100).toFixed(2)) }
          else setVal(e.target.value)
        }}
        onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
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

// Collapsed/expanded long-notes cell. Two-line clamp by default;
// click to expand. Tiny chevron appears only when the content actually
// overflows two lines.
export function NotesCell({ value }) {
  const [open, setOpen] = useState(false)
  const [overflows, setOverflows] = useState(false)
  const ref = (el) => {
    if (!el) return
    // detect overflow post-mount
    const overflowing = el.scrollHeight - el.clientHeight > 1
    if (overflowing !== overflows) setOverflows(overflowing)
  }
  if (!value) return <span className="text-stone-300">—</span>
  return (
    <div className="max-w-[420px]">
      <p
        ref={ref}
        className={`text-[11px] leading-relaxed whitespace-pre-wrap break-words text-stone-600 ${open ? '' : 'line-clamp-2'}`}
      >
        {value}
      </p>
      {(overflows || open) && (
        <button
          onClick={() => setOpen(v => !v)}
          className="mt-0.5 inline-flex items-center gap-0.5 text-[10px] text-stone-400 hover:text-abc-indigo"
        >
          {open ? <><ChevronUp className="size-3" /> Less</> : <><ChevronDown className="size-3" /> More</>}
        </button>
      )}
    </div>
  )
}

// Inline dropdown for the 3-state escrow disposition. "Paid" is a terminal
// display state that the admin can still undo.
export function EscrowStatusCell({ exp, reconciled, onSetStatus, onMarkPaid }) {
  const status = getEscrowStatus(exp)

  const pill = (variant, label) => {
    const colors = {
      not_funded: 'text-stone-500 bg-stone-100 border-stone-200',
      yes: 'text-blue-700 bg-blue-50 border-blue-200',
      not_needed: 'text-emerald-700 bg-emerald-50 border-emerald-200',
      paid: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    }
    return (
      <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border ${colors[variant]}`}>
        {variant === 'paid' && <CheckCircle2 className="size-2.5" />}
        {label}
      </span>
    )
  }

  if (reconciled) {
    if (status === 'paid') return pill('paid', `Paid ${formatDate(exp.disbursement_paid_at)}`)
    if (status === 'not_needed') return pill('not_needed', 'Not Needed')
    if (status === 'yes') return pill('yes', 'Yes')
    return pill('not_funded', 'Escrow Not Funded')
  }

  if (status === 'paid') {
    return (
      <div className="flex flex-col gap-1 items-start">
        {pill('paid', `Paid ${formatDate(exp.disbursement_paid_at)}`)}
        <button
          onClick={() => onSetStatus(exp.id, 'yes')}
          className="text-[10px] text-stone-400 hover:text-stone-600 hover:underline"
        >
          Undo Paid
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1 items-start">
      <select
        value={status}
        onChange={e => onSetStatus(exp.id, e.target.value)}
        className={`h-7 text-[11px] font-medium border rounded-md pl-2 pr-6 bg-white focus:outline-none focus:ring-1 focus:ring-abc-indigo min-w-[160px] ${
          status === 'not_needed' ? 'text-emerald-700 border-emerald-200 bg-emerald-50' :
          status === 'yes' ? 'text-blue-700 border-blue-200 bg-blue-50' :
          'text-stone-500 border-stone-200'
        }`}
      >
        <option value="not_funded">Escrow Not Funded</option>
        <option value="yes">Yes</option>
        <option value="not_needed">Not Needed</option>
      </select>
      {status === 'yes' && (
        <button
          onClick={() => onMarkPaid(exp.id)}
          className="text-[10px] text-emerald-700 hover:underline"
        >
          Mark as Paid
        </button>
      )}
    </div>
  )
}

function ExpenseTable({ expenses, journeyMap, surrogateMap = {}, onSave, onReconcile, showReconcile, currentUser, onExpenseUpdate, onViewEmail, onSetEscrowStatus, onMarkDisbursementPaid }) {
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
                      assigned_to: reconcileJourney?.assignedTo || 'julie@abcsurrogacy.com',
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

      <div className="p-4 sm:p-5 space-y-3">
        {expenses.map(exp => {
          const isPreMatch = !exp.journey_id && exp.surrogate_id
          const j = journeyMap[exp.journey_id] || {}
          const surrogateName = isPreMatch ? (surrogateMap[exp.surrogate_id] || 'Unknown Surrogate') : null
          const caseName = isPreMatch ? surrogateName : (j.caseName || 'Unknown Journey')
          const caseManager = j.caseManager || '—'
          const caseHref = isPreMatch ? `/surrogates/${exp.surrogate_id}` : `/journeys/${exp.journey_id}`
          const rowGreen = !!(exp.disbursement_paid_at || exp.escrow_not_needed)
          const gmailMatch = (exp.notes || '').match(/Gmail ID: ([a-zA-Z0-9]+)/)

          return (
            <div
              key={exp.id}
              className={`rounded-xl border transition-colors ${
                rowGreen
                  ? 'border-emerald-200 bg-emerald-50/50'
                  : 'border-stone-200 bg-white hover:border-stone-300'
              }`}
            >
              <div className="p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4 items-start">
                {/* Left column: case header + details + notes */}
                <div className="space-y-3 min-w-0">
                  {/* Header row: case + amount */}
                  <div className="flex items-baseline justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <Link to={caseHref} className="font-semibold text-[#283693] hover:underline text-sm leading-snug">
                        {caseName}
                      </Link>
                      <p className="text-[10px] text-stone-400 mt-0.5">
                        {isPreMatch ? 'Pre-match' : caseManager} · <EditableCell col={COLUMNS[0]} value={exp.expense_date} onSave={(v) => onSave(exp.id, 'expense_date', v)} />
                      </p>
                      {exp.paid_at && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-full mt-1.5">
                          <CheckCircle2 className="size-2.5" /> Paid {formatDate(exp.paid_at)}{exp.paid_by ? ` · ${getAdminName(exp.paid_by)}` : ''}
                        </span>
                      )}
                    </div>
                    <div className="text-base font-bold text-stone-800 tabular-nums">
                      <EditableCell col={COLUMNS[1]} value={exp.amount} onSave={(v) => onSave(exp.id, 'amount', v)} />
                    </div>
                  </div>

                  {/* Details grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-2 text-xs pt-2 border-t border-stone-100">
                    <div className="space-y-0.5 min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-stone-400 font-semibold">Paid To</p>
                      <div className="text-stone-700">
                        <EditableCell col={COLUMNS[2]} value={exp.paid_to} onSave={(v) => onSave(exp.id, 'paid_to', v)} />
                      </div>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-[10px] uppercase tracking-wider text-stone-400 font-semibold">CC Last 4</p>
                      <CCLast4Inline value={exp.cc_last4} onSave={(v) => onSave(exp.id, 'cc_last4', v)} />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-[10px] uppercase tracking-wider text-stone-400 font-semibold">Attachment</p>
                      <div className="flex items-center gap-2">
                        {exp.attachment_url ? (
                          <button onClick={() => setPreviewUrl(exp.attachment_url)} className="inline-flex items-center gap-1 text-[11px] text-abc-indigo hover:underline" title="View attachment">
                            <Eye className="size-3.5" /> View
                          </button>
                        ) : gmailMatch && onViewEmail ? (
                          <button onClick={() => onViewEmail(gmailMatch[1])} className="inline-flex items-center gap-1 text-[11px] text-stone-500 hover:text-abc-indigo" title="View linked email">
                            <Mail className="size-3.5" /> Email
                          </button>
                        ) : (
                          <span className="text-stone-300 text-[11px]">None</span>
                        )}
                        {j.gcPayPrefScreenshotUrl && (
                          <button
                            onClick={() => setPreviewUrl(j.gcPayPrefScreenshotUrl)}
                            className="inline-flex items-center gap-1 text-[11px] text-pink-500 hover:text-pink-600"
                            title="View surrogate's payment preference screenshot"
                          >
                            <Eye className="size-3.5" /> Pay pref
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Notes */}
                  {exp.notes && (
                    <div className="pt-2 border-t border-stone-100">
                      <p className="text-[10px] uppercase tracking-wider text-stone-400 font-semibold mb-1">Notes</p>
                      <NotesCell value={exp.notes} />
                    </div>
                  )}
                </div>

                {/* Right column: escrow status + reconcile */}
                <div className="flex lg:flex-col items-start lg:items-stretch gap-3 lg:min-w-[200px] lg:max-w-[200px] lg:border-l lg:border-stone-100 lg:pl-4">
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase tracking-wider text-stone-400 font-semibold">Submitted to Escrow</p>
                    <EscrowStatusCell
                      exp={exp}
                      reconciled={!!exp.reconciled}
                      onSetStatus={onSetEscrowStatus}
                      onMarkPaid={onMarkDisbursementPaid}
                    />
                  </div>
                  {showReconcile && (
                    <button
                      onClick={() => setReconcileId(exp.id)}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors"
                      title="Mark as reconciled"
                    >
                      <CheckCircle2 className="size-3.5" /> Reconcile
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}

// Inline editable CC last-4 field with placeholder prompting the admin
// to record which card paid this expense. Only accepts digits, max 4.
function CCLast4Inline({ value, onSave }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(value || '')
  useEffect(() => { setVal(value || '') }, [value])

  if (!editing) {
    if (value) {
      return (
        <button
          onClick={() => setEditing(true)}
          className="inline-flex items-center gap-1 text-xs font-mono text-stone-600 hover:text-abc-indigo"
          title="Click to edit"
        >
          ••••{value}
        </button>
      )
    }
    return (
      <button
        onClick={() => setEditing(true)}
        className="inline-flex items-center gap-1 text-[11px] text-stone-400 hover:text-abc-indigo italic"
      >
        + Add CC last 4
      </button>
    )
  }
  const save = () => {
    const clean = (val || '').replace(/\D/g, '').slice(-4) || null
    onSave(clean)
    setEditing(false)
  }
  return (
    <div className="inline-flex items-center gap-1">
      <Input
        value={val}
        onChange={e => setVal(e.target.value.replace(/\D/g, '').slice(0, 4))}
        onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
        className="h-7 text-xs w-[76px] font-mono"
        maxLength={4}
        placeholder="1234"
        autoFocus
      />
      <button onClick={save} className="text-green-600"><Check className="size-3.5" /></button>
      <button onClick={() => setEditing(false)} className="text-stone-400"><X className="size-3.5" /></button>
    </div>
  )
}

// Card-layout list of expenses in the "Expenses to Pay" tab. Each expense
// is one card with clear hierarchy: case + amount at top, payment details
// in a 2-col grid, notes with click-to-expand, and the Mark Paid CTA
// on the right.
function ExpensesToPayTable({ expenses, journeyMap, surrogateMap = {}, onMarkPaid, onReconcile, onSave, currentUser }) {
  if (expenses.length === 0) {
    return (
      <div className="px-6 py-16 text-center text-stone-400">
        <CheckCircle2 className="size-8 mx-auto mb-2 text-stone-300" />
        <p className="text-sm">No expenses awaiting payment.</p>
        <p className="text-xs mt-1">Direct-pay expenses from case Expenses tabs will appear here.</p>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-5 space-y-3">
      {expenses.map(exp => {
        const isPreMatch = !exp.journey_id && exp.surrogate_id
        const j = journeyMap[exp.journey_id] || {}
        const surrogateName = isPreMatch ? (surrogateMap[exp.surrogate_id] || 'Unknown Surrogate') : null
        const caseName = isPreMatch ? surrogateName : (j.caseName || 'Unknown Journey')
        const caseHref = isPreMatch ? `/surrogates/${exp.surrogate_id}` : `/journeys/${exp.journey_id}`
        const isPaid = !!exp.paid_at

        return (
          <div
            key={exp.id}
            className={`rounded-xl border transition-colors ${
              isPaid
                ? 'border-emerald-200 bg-emerald-50/50'
                : 'border-stone-200 bg-white hover:border-stone-300'
            }`}
          >
            <div className="p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4 items-start">
              {/* Left: case, details, notes */}
              <div className="space-y-3 min-w-0">
                {/* Header: case + amount */}
                <div className="flex items-baseline justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <Link to={caseHref} className="font-semibold text-[#283693] hover:underline text-sm leading-snug">
                      {caseName}
                    </Link>
                    <p className="text-[10px] text-stone-400 mt-0.5">
                      {isPreMatch ? 'Pre-match' : (j.caseManager || '—')} · {formatDate(exp.expense_date)}
                    </p>
                  </div>
                  <p className="text-base font-bold text-stone-800 tabular-nums">
                    {formatCurrency(exp.amount)}
                  </p>
                </div>

                {/* Details grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-2 text-xs pt-2 border-t border-stone-100">
                  <div className="space-y-0.5">
                    <p className="text-[10px] uppercase tracking-wider text-stone-400 font-semibold">Pay To</p>
                    <p className="text-stone-700">{exp.paid_to || <span className="text-stone-300">—</span>}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[10px] uppercase tracking-wider text-stone-400 font-semibold">Pay Via</p>
                    {exp.pay_via ? (
                      <div className="flex items-center gap-1.5">
                        <div>
                          <p className="font-medium capitalize text-stone-700">{exp.pay_via}</p>
                          {exp.pay_via_info && <p className="text-[10px] text-stone-400 break-all">{exp.pay_via_info}</p>}
                        </div>
                        {j.gcPayPrefScreenshotUrl && (
                          <a
                            href={j.gcPayPrefScreenshotUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-pink-400 hover:text-pink-600 transition-colors shrink-0"
                            title="View surrogate's payment preference screenshot"
                          >
                            <Eye className="size-4" />
                          </a>
                        )}
                      </div>
                    ) : j.gcPayPrefScreenshotUrl ? (
                      <a
                        href={j.gcPayPrefScreenshotUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-pink-500 hover:text-pink-600 transition-colors text-[11px]"
                      >
                        <Eye className="size-3.5" /> View pay preference
                      </a>
                    ) : (
                      <p className="text-stone-300">—</p>
                    )}
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[10px] uppercase tracking-wider text-stone-400 font-semibold">CC Last 4</p>
                    <CCLast4Inline value={exp.cc_last4} onSave={(v) => onSave(exp.id, 'cc_last4', v)} />
                  </div>
                </div>

                {/* Notes */}
                {exp.notes && (
                  <div className="pt-2 border-t border-stone-100">
                    <p className="text-[10px] uppercase tracking-wider text-stone-400 font-semibold mb-1">Notes</p>
                    <NotesCell value={exp.notes} />
                  </div>
                )}
              </div>

              {/* Right: action / paid state */}
              <div className="flex lg:flex-col items-start lg:items-end gap-2 lg:min-w-[160px] lg:border-l lg:border-stone-100 lg:pl-4">
                {isPaid ? (
                  <>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-full">
                      <CheckCircle2 className="size-3" /> Paid {formatDate(exp.paid_at)}
                    </span>
                    {exp.paid_by && <p className="text-[10px] text-stone-400">by {getAdminName(exp.paid_by)}</p>}
                    {!exp.reconciled ? (
                      <button
                        onClick={() => onReconcile(exp.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors mt-1"
                      >
                        <CheckCircle2 className="size-3.5" /> Reconcile
                      </button>
                    ) : (
                      <span className="text-[11px] text-emerald-600 font-medium">✓ Done</span>
                    )}
                  </>
                ) : (
                  <>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">Pending</span>
                    <button
                      onClick={() => onMarkPaid(exp.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-sm"
                    >
                      <CheckCircle2 className="size-3.5" /> Mark Paid
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function ExpensesPage() {
  const { currentUser } = useRole()
  const [expenses, setExpenses] = useState([])
  const [journeyMap, setJourneyMap] = useState({})
  const [surrogateMap, setSurrogateMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('expenses')
  const [search, setSearch] = useState('')
  const [adminFilter, setAdminFilter] = useState('')
  const [sortDir, setSortDir] = useState('desc') // desc = newest first
  const [emailViewId, setEmailViewId] = useState(null)
  const [emailViewData, setEmailViewData] = useState(null)
  const [emailViewLoading, setEmailViewLoading] = useState(false)
  const userId = currentUser?.userId || currentUser?.id

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

        // Build surrogate payment-preference lookup by case id
        const gcPayPrefMap = {}
        for (const s of surrogates) {
          const pref = s.answers?._paymentPreference
          if (pref?.screenshotUrl) gcPayPrefMap[s.id] = pref.screenshotUrl
        }

        const jMap = {}
        for (const j of journeys) {
          const gcName = gcMap[j.gc_case_id] || 'GC'
          const ipName = ipMap[j.ip_case_id] || 'IP'
          jMap[j.id] = {
            caseName: `${ipName} + ${gcName}`,
            caseManager: getAdminName(j.assigned_to),
            assignedTo: j.assigned_to,
            gcPayPrefScreenshotUrl: gcPayPrefMap[j.gc_case_id] || null,
          }
        }

        setExpenses(allExpenses.filter(e => !EXCLUDED_JOURNEY_IDS.has(Number(e.journey_id))))
        setJourneyMap(jMap)
        setSurrogateMap(gcMap)
      } catch (err) {
        console.error('Failed to load expenses:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function handleViewEmail(gmailId) {
    setEmailViewId(gmailId)
    setEmailViewLoading(true)
    setEmailViewData(null)
    try {
      const full = await getEmail(userId, gmailId, 'full')
      const headers = parseEmailHeaders(full)
      const bodyHtml = parseEmailBody(full)
      setEmailViewData({ ...headers, bodyHtml })
    } catch { setEmailViewData(null) }
    setEmailViewLoading(false)
  }

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

  async function handleMarkPaid(expenseId) {
    try {
      const updated = await updateExpense(expenseId, { paid_at: new Date().toISOString(), paid_by: currentUser?.email || '' })
      if (updated) {
        setExpenses(prev => prev.map(e => e.id === expenseId ? { ...e, ...updated } : e))
      }
    } catch (err) {
      console.error('Failed to mark paid:', err)
    }
  }

  async function handleSetEscrowStatus(expenseId, status) {
    try {
      const updates = escrowStatusUpdates(status, {
        userEmail: currentUser?.email || '',
        nowIso: new Date().toISOString(),
      })
      const updated = await updateExpense(expenseId, updates)
      if (updated) {
        setExpenses(prev => prev.map(e => e.id === expenseId ? { ...e, ...updated } : e))
      }
    } catch (err) {
      console.error('Failed to change escrow status:', err)
    }
  }

  async function handleMarkDisbursementPaid(expenseId) {
    try {
      const now = new Date().toISOString()
      const who = currentUser?.email || ''
      const row = expenses.find(e => e.id === expenseId)
      const updates = {
        disbursement_paid_at: now,
        disbursement_paid_by: who,
      }
      if (row && !row.disbursement_requested_at) {
        updates.disbursement_requested_at = now
        updates.disbursement_requested_by = who
      }
      const updated = await updateExpense(expenseId, updates)
      if (updated) {
        setExpenses(prev => prev.map(e => e.id === expenseId ? { ...e, ...updated } : e))
      }
    } catch (err) {
      console.error('Failed to mark disbursement paid:', err)
    }
  }

  // Filter and sort — Hold-for-Payment items never appear in the main tracker
  let filtered = expenses.filter(e => e.pay_to_type !== 'hold')
  if (activeTab === 'expenses') {
    // Awaiting reconciliation — either escrow-paid, or direct-pay that's already been marked Paid
    filtered = filtered.filter(e => !e.reconciled && (!e.needs_payment || !!e.paid_at))
  } else if (activeTab === 'to_pay') {
    // Still needs to be paid
    filtered = filtered.filter(e => e.needs_payment && !e.paid_at && !e.reconciled)
  } else {
    filtered = filtered.filter(e => e.reconciled)
  }

  if (search) {
    const q = search.toLowerCase()
    filtered = filtered.filter(e => {
      const j = journeyMap[e.journey_id] || {}
      const surrogateName = (surrogateMap[e.surrogate_id] || '').toLowerCase()
      const caseName = ((j.caseName || '') + ' ' + surrogateName).toLowerCase()
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
              {expenses.filter(e => !e.reconciled && !e.needs_payment).length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="to_pay" className="gap-1">
            Expenses to Pay
            {expenses.filter(e => e.needs_payment && !e.reconciled).length > 0 && (
              <span className="text-[10px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full ml-1">
                {expenses.filter(e => e.needs_payment && !e.reconciled).length}
              </span>
            )}
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
                surrogateMap={surrogateMap}
                onSave={handleSave}
                onReconcile={handleReconcile}
                showReconcile={true}
                currentUser={currentUser}
                onExpenseUpdate={(id, updated) => setExpenses(prev => prev.map(e => e.id === id ? { ...e, ...updated } : e))}
                onViewEmail={handleViewEmail}
                onSetEscrowStatus={handleSetEscrowStatus}
                onMarkDisbursementPaid={handleMarkDisbursementPaid}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="to_pay" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <ExpensesToPayTable
                expenses={filtered}
                journeyMap={journeyMap}
                surrogateMap={surrogateMap}
                onMarkPaid={handleMarkPaid}
                onReconcile={handleReconcile}
                onSave={handleSave}
                currentUser={currentUser}
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
                surrogateMap={surrogateMap}
                onSave={handleSave}
                onReconcile={() => {}}
                showReconcile={false}
                currentUser={currentUser}
                onExpenseUpdate={(id, updated) => setExpenses(prev => prev.map(e => e.id === id ? { ...e, ...updated } : e))}
                onViewEmail={handleViewEmail}
                onSetEscrowStatus={handleSetEscrowStatus}
                onMarkDisbursementPaid={handleMarkDisbursementPaid}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Email Viewer Dialog */}
      <Dialog open={!!emailViewId} onOpenChange={open => { if (!open) { setEmailViewId(null); setEmailViewData(null) } }}>
        <DialogContent className="!max-w-[90vw] w-[90vw] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Mail className="size-5 text-[#283693]" /> Linked Email</DialogTitle>
          </DialogHeader>
          {emailViewLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="size-6 animate-spin text-stone-400" /></div>
          ) : emailViewData ? (
            <div className="space-y-3">
              <div className="text-sm space-y-1 border-b border-stone-100 pb-3">
                <p><span className="text-stone-400">From:</span> {emailViewData.from}</p>
                <p><span className="text-stone-400">To:</span> {emailViewData.to}</p>
                {emailViewData.cc && <p><span className="text-stone-400">Cc:</span> {emailViewData.cc}</p>}
                <p><span className="text-stone-400">Date:</span> {emailViewData.date}</p>
                <p className="font-semibold">{emailViewData.subject}</p>
              </div>
              <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: emailViewData.bodyHtml || '<p>No content</p>' }} />
            </div>
          ) : (
            <p className="text-sm text-stone-400 text-center py-8">Could not load email. Make sure Google is connected.</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
