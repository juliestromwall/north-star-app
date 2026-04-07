import { useState, useEffect } from 'react'
import {
  Save, Loader2, Plus, X, AlertTriangle, ChevronDown, Check, Eye, EyeOff,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useRole } from '@/context/RoleContext'
import { formatDate } from '@/lib/utils'
import { fetchInsurance, upsertInsurance, cancelInsurance, fetchInsurancePayments, insertInsurancePayment } from '@/lib/db'

// ── Insurance Card Icon ────────────────────────────────
export function InsuranceCardIcon({ size = 16, color = 'currentColor', className = '' }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="3" />
      <path d="M7 8.5h2v2H7z" fill={color} stroke="none" />
      <path d="M7.5 8.5v2M6.5 9.5h2" strokeWidth="1.5" />
      <line x1="12" y1="8.5" x2="18" y2="8.5" />
      <line x1="12" y1="11" x2="18" y2="11" />
      <line x1="6" y1="14" x2="18" y2="14" />
      <line x1="6" y1="16.5" x2="14" y2="16.5" />
    </svg>
  )
}

const PAYMENT_METHODS = [
  { value: 'portal', label: 'Portal' },
  { value: 'website', label: 'Website' },
  { value: 'phone_call', label: 'Phone Call' },
  { value: 'mailed_check', label: 'Mailed Check' },
]

function formatCurrency(val) {
  if (!val) return ''
  const num = parseFloat(String(val).replace(/[^0-9.]/g, ''))
  if (isNaN(num)) return ''
  return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function getMonthOptions() {
  const options = []
  const now = new Date()
  for (let i = -2; i <= 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    options.push({ value: val, label })
  }
  return options
}

function EditForm({ form, setForm, saving, onSave, onCancel }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-sm text-stone-600">Has Insurance?</span>
        <div className="flex gap-1.5">
          <button onClick={() => setForm(f => ({ ...f, has_insurance: true }))}
            className={`px-3 py-1 rounded-full text-xs font-medium ${form.has_insurance ? 'bg-[#283693] text-white' : 'bg-stone-100 text-stone-500'}`}>Yes</button>
          <button onClick={() => setForm(f => ({ ...f, has_insurance: false }))}
            className={`px-3 py-1 rounded-full text-xs font-medium ${!form.has_insurance ? 'bg-[#283693] text-white' : 'bg-stone-100 text-stone-500'}`}>No</button>
        </div>
      </div>
      {form.has_insurance && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[11px] text-stone-400 font-medium">Insurance Status</label>
            <select value={form.insurance_status || 'active_policy'} onChange={e => setForm(f => ({ ...f, insurance_status: e.target.value }))}
              className="w-full h-8 text-sm border border-stone-200 rounded-md px-2 bg-white">
              <option value="active_policy">Verified Policy</option>
              <option value="verified_open_enrollment">Verified Policy (Open Enrollment)</option>
              <option value="policy_check">ART Risk Policy Check</option>
              <option value="open_enrollment">Open Enrollment</option>
              <option value="complete">Complete - Surrogacy Friendly</option>
              <option value="complete_not_friendly">Complete - Not Surrogacy Friendly</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] text-stone-400 font-medium">Status Year</label>
            <select value={form.insurance_status_year || ''} onChange={e => setForm(f => ({ ...f, insurance_status_year: e.target.value }))}
              className="w-full h-8 text-sm border border-stone-200 rounded-md px-2 bg-white">
              {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() + i).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] text-stone-400 font-medium">Insurance Carrier</label>
            <Input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} placeholder="Insurance carrier" className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] text-stone-400 font-medium">Website</label>
            <Input value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} placeholder="https://..." className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] text-stone-400 font-medium">Portal Login</label>
            <Input value={form.portal_login} onChange={e => setForm(f => ({ ...f, portal_login: e.target.value }))} placeholder="Username or email" className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] text-stone-400 font-medium">Portal Password</label>
            <Input type="password" value={form.portal_password} onChange={e => setForm(f => ({ ...f, portal_password: e.target.value }))} placeholder="Password" className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] text-stone-400 font-medium">Premium Amount</label>
            <Input value={form.premium_amount} onChange={e => setForm(f => ({ ...f, premium_amount: e.target.value }))} placeholder="$0.00" className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] text-stone-400 font-medium">Premium Due Day (of month)</label>
            <Input type="number" min="1" max="31" value={form.premium_due_day} onChange={e => setForm(f => ({ ...f, premium_due_day: e.target.value }))} placeholder="1-31" className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] text-stone-400 font-medium">Enrolled in Autopay?</label>
            <div className="flex gap-1.5 mt-1">
              <button onClick={() => setForm(f => ({ ...f, enrolled_autopay: true }))}
                className={`px-3 py-1 rounded-full text-xs font-medium ${form.enrolled_autopay ? 'bg-[#283693] text-white' : 'bg-stone-100 text-stone-500'}`}>Yes</button>
              <button onClick={() => setForm(f => ({ ...f, enrolled_autopay: false, autopay_day: '' }))}
                className={`px-3 py-1 rounded-full text-xs font-medium ${!form.enrolled_autopay ? 'bg-[#283693] text-white' : 'bg-stone-100 text-stone-500'}`}>No</button>
            </div>
          </div>
          {form.enrolled_autopay && (
            <div className="space-y-1">
              <label className="text-[11px] text-stone-400 font-medium">Autopay Day (of month)</label>
              <Input type="number" min="1" max="31" value={form.autopay_day} onChange={e => setForm(f => ({ ...f, autopay_day: e.target.value }))} placeholder="1-31" className="h-8 text-sm" />
            </div>
          )}
          <div className="space-y-1">
            <label className="text-[11px] text-stone-400 font-medium">Plan Start Date</label>
            <Input type="date" value={form.plan_start_date} onChange={e => setForm(f => ({ ...f, plan_start_date: e.target.value }))} className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] text-stone-400 font-medium">Plan End Date</label>
            <Input type="date" value={form.plan_end_date} onChange={e => setForm(f => ({ ...f, plan_end_date: e.target.value }))} className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] text-stone-400 font-medium">Binder Payment Paid?</label>
            <div className="flex gap-1.5 mt-1">
              <button onClick={() => setForm(f => ({ ...f, binder_payment_paid: true }))}
                className={`px-3 py-1 rounded-full text-xs font-medium ${form.binder_payment_paid ? 'bg-[#283693] text-white' : 'bg-stone-100 text-stone-500'}`}>Yes</button>
              <button onClick={() => setForm(f => ({ ...f, binder_payment_paid: false }))}
                className={`px-3 py-1 rounded-full text-xs font-medium ${!form.binder_payment_paid ? 'bg-[#283693] text-white' : 'bg-stone-100 text-stone-500'}`}>No</button>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] text-stone-400 font-medium">OB Doctor / Clinic</label>
            <Input value={form.ob_clinic} onChange={e => setForm(f => ({ ...f, ob_clinic: e.target.value }))} placeholder="OB name or clinic" className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] text-stone-400 font-medium">Delivery Hospital</label>
            <Input value={form.hospital} onChange={e => setForm(f => ({ ...f, hospital: e.target.value }))} placeholder="Hospital name" className="h-8 text-sm" />
          </div>
          <div className="space-y-1 col-span-2">
            <label className="text-[11px] text-stone-400 font-medium">Notes</label>
            <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Insurance notes..." rows={2} className="text-sm" />
          </div>
        </div>
      )}
      <div className="flex gap-2 pt-2">
        <Button size="sm" className="gap-1" style={{ backgroundColor: '#283693' }} onClick={onSave} disabled={saving}>
          {saving ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
          {saving ? 'Saving...' : 'Save'}
        </Button>
        <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  )
}

export default function InsuranceTab({ caseId, caseType = 'surrogate', surrogateNameForDisplay }) {
  const { currentUser } = useRole()
  const [insurance, setInsurance] = useState(null)
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [payOpen, setPayOpen] = useState(false)
  const [payForm, setPayForm] = useState({ paid_date: new Date().toISOString().split('T')[0], month_for: '', payment_method: 'portal', payment_info: '', notes: '' })
  const [paySaving, setPaySaving] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const ins = await fetchInsurance(caseId, caseType)
        setInsurance(ins)
        if (ins) {
          const pays = await fetchInsurancePayments(ins.id)
          setPayments(pays)
        }
      } catch {} finally { setLoading(false) }
    }
    load()
  }, [caseId, caseType])

  function startEdit() {
    setForm({
      has_insurance: insurance?.has_insurance ?? false,
      insurance_status: insurance?.insurance_status || 'active_policy',
      insurance_status_year: insurance?.insurance_status_year || new Date().getFullYear(),
      company: insurance?.company || '',
      website: insurance?.website || '',
      portal_login: insurance?.portal_login || '',
      portal_password: insurance?.portal_password || '',
      premium_amount: insurance?.premium_amount || '',
      enrolled_autopay: insurance?.enrolled_autopay ?? false,
      premium_due_day: insurance?.premium_due_day || '',
      autopay_day: insurance?.autopay_day || '',
      plan_start_date: insurance?.plan_start_date || '',
      plan_end_date: insurance?.plan_end_date || '',
      binder_payment_paid: insurance?.binder_payment_paid ?? false,
      ob_clinic: insurance?.ob_clinic || '',
      hospital: insurance?.hospital || '',
      notes: insurance?.notes || '',
    })
    setEditing(true)
  }

  async function saveInsurance() {
    setSaving(true)
    try {
      // If no insurance, auto-set to open enrollment for current year
      const effectiveStatus = form.has_insurance === false || form.has_insurance === 'no'
        ? 'open_enrollment'
        : (form.insurance_status || 'active_policy')
      const effectiveYear = form.has_insurance === false || form.has_insurance === 'no'
        ? new Date().getFullYear()
        : (form.insurance_status_year ? parseInt(form.insurance_status_year) : null)
      const updated = await upsertInsurance(caseId, caseType, {
        has_insurance: form.has_insurance,
        status: 'active',
        cancelled_at: null,
        insurance_status: effectiveStatus,
        insurance_status_year: effectiveYear,
        company: form.company || null,
        website: form.website || null,
        portal_login: form.portal_login || null,
        portal_password: form.portal_password || null,
        premium_amount: form.premium_amount ? parseFloat(String(form.premium_amount).replace(/[^0-9.]/g, '')) : null,
        enrolled_autopay: form.enrolled_autopay,
        premium_due_day: form.premium_due_day ? parseInt(form.premium_due_day) : null,
        autopay_day: form.autopay_day ? parseInt(form.autopay_day) : null,
        plan_start_date: form.plan_start_date || null,
        plan_end_date: form.plan_end_date || null,
        binder_payment_paid: form.binder_payment_paid,
        ob_clinic: form.ob_clinic || null,
        hospital: form.hospital || null,
        notes: form.notes || null,
      })
      setInsurance(updated)
      setEditing(false)
    } catch (err) {
      alert('Failed to save: ' + (err.message || ''))
    } finally { setSaving(false) }
  }

  async function handleCancel() {
    setCancelling(true)
    try {
      const updated = await cancelInsurance(insurance.id)
      setInsurance(updated)
      setCancelOpen(false)
    } catch (err) {
      alert('Failed to cancel: ' + (err.message || ''))
    } finally { setCancelling(false) }
  }

  async function handleLogPayment() {
    if (!payForm.month_for || !payForm.paid_date) return
    setPaySaving(true)
    try {
      const payment = await insertInsurancePayment({
        insurance_id: insurance.id,
        paid_date: payForm.paid_date,
        month_for: payForm.month_for,
        payment_method: payForm.payment_method,
        payment_info: payForm.payment_info || null,
        notes: payForm.notes || null,
        logged_by: currentUser?.name || 'Unknown',
      })
      setPayments(prev => [payment, ...prev])
      setPayOpen(false)
      setPayForm({ paid_date: new Date().toISOString().split('T')[0], month_for: '', payment_method: 'portal', payment_info: '', notes: '' })
    } catch (err) {
      alert('Failed to log payment: ' + (err.message || ''))
    } finally { setPaySaving(false) }
  }

  if (loading) return <div className="text-center py-12 text-stone-400">Loading insurance...</div>

  // No insurance record yet and not editing — show setup
  if (!insurance && !editing) {
    return (
      <Card className="rounded-2xl">
        <CardContent className="py-12 text-center space-y-4">
          <InsuranceCardIcon size={48} color="#a8a29e" className="mx-auto" />
          <div>
            <p className="text-sm font-semibold text-stone-700">No insurance information</p>
            <p className="text-xs text-stone-400 mt-1">Add insurance details for {surrogateNameForDisplay || 'this surrogate'}</p>
          </div>
          <Button size="sm" className="gap-1.5" style={{ backgroundColor: '#283693' }} onClick={startEdit}>
            <Plus className="size-3.5" /> Add Insurance
          </Button>
        </CardContent>
      </Card>
    )
  }

  const isCancelled = insurance?.status === 'cancelled'

  // Editing with no record yet — show just the edit form
  if (editing && !insurance) {
    return (
      <Card className="rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <InsuranceCardIcon size={18} color="#283693" /> Add Insurance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <EditForm form={form} setForm={setForm} saving={saving} onSave={saveInsurance} onCancel={() => setEditing(false)} />
        </CardContent>
      </Card>
    )
  }

  // Has record — show info
  return (
    <div className="space-y-4">
      {/* Insurance Details Card */}
      <Card className="rounded-2xl">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <InsuranceCardIcon size={18} color={isCancelled ? '#a8a29e' : '#283693'} />
              Insurance {isCancelled && <span className="text-xs font-normal text-red-500 bg-red-50 px-2 py-0.5 rounded-full">Cancelled</span>}
            </CardTitle>
            <div className="flex gap-1.5">
              {!editing && (
                <>
                  <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={startEdit}>Edit</Button>
                  <Button variant="outline" size="sm" className="text-xs h-7 gap-1 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => setCancelOpen(true)}>
                    <X className="size-3" /> Cancel Policy
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {editing ? (
            <EditForm form={form} setForm={setForm} saving={saving} onSave={saveInsurance} onCancel={() => setEditing(false)} />
          ) : !insurance.has_insurance ? (
            <div className="py-4 text-center">
              <p className="text-sm text-stone-500">No insurance</p>
              <Button variant="outline" size="sm" className="mt-2 text-xs" onClick={startEdit}>Update</Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
              <div>
                <span className="text-stone-400 text-xs">Status</span>
                <p className="font-medium">{
                  ({ active_policy: 'Verified Policy', verified_open_enrollment: 'Verified (Open Enrollment)', policy_check: 'ART Risk Policy Check', open_enrollment: 'Open Enrollment', complete: 'Complete - Surrogacy Friendly', complete_not_friendly: 'Complete - Not Surrogacy Friendly' })[insurance.insurance_status] || 'Verified Policy'
                } {insurance.insurance_status_year ? `(${insurance.insurance_status_year})` : ''}</p>
              </div>
              <div>
                <span className="text-stone-400 text-xs">Insurance Carrier</span>
                <p className="font-medium">{insurance.company || '—'}</p>
              </div>
              <div>
                <span className="text-stone-400 text-xs">Website</span>
                <p className="font-medium">{insurance.website ? <a href={insurance.website} target="_blank" rel="noopener" className="text-[#283693] hover:underline">{insurance.website}</a> : '—'}</p>
              </div>
              <div>
                <span className="text-stone-400 text-xs">Portal Login</span>
                <p className="font-medium">{insurance.portal_login || '—'}</p>
              </div>
              <div>
                <span className="text-stone-400 text-xs">Portal Password</span>
                <p className="font-medium flex items-center gap-1.5">
                  {insurance.portal_password ? (
                    <>
                      <span>{showPassword ? insurance.portal_password : '••••••••'}</span>
                      <button onClick={() => setShowPassword(!showPassword)} className="text-stone-400 hover:text-stone-600">
                        {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                      </button>
                    </>
                  ) : '—'}
                </p>
              </div>
              <div>
                <span className="text-stone-400 text-xs">Premium Amount</span>
                <p className="font-medium">{insurance.premium_amount ? formatCurrency(insurance.premium_amount) : '—'}</p>
              </div>
              <div>
                <span className="text-stone-400 text-xs">Premium Due Day</span>
                <p className="font-medium">{insurance.premium_due_day ? `${insurance.premium_due_day}${['st','nd','rd'][((insurance.premium_due_day % 100 - 20) % 10 - 1)] || 'th'} of each month` : '—'}</p>
              </div>
              <div>
                <span className="text-stone-400 text-xs">Enrolled in Autopay</span>
                <p className="font-medium">{insurance.enrolled_autopay ? 'Yes' : 'No'}</p>
              </div>
              {insurance.enrolled_autopay && (
                <div>
                  <span className="text-stone-400 text-xs">Autopay Day</span>
                  <p className="font-medium">{insurance.autopay_day ? `${insurance.autopay_day}${['st','nd','rd'][((insurance.autopay_day % 100 - 20) % 10 - 1)] || 'th'} of each month` : '—'}</p>
                </div>
              )}
              <div>
                <span className="text-stone-400 text-xs">Plan Start</span>
                <p className="font-medium">{insurance.plan_start_date || '—'}</p>
              </div>
              <div>
                <span className="text-stone-400 text-xs">Plan End</span>
                <p className="font-medium">{insurance.plan_end_date || '—'}</p>
              </div>
              <div>
                <span className="text-stone-400 text-xs">Binder Payment Paid</span>
                <p className="font-medium">{insurance.binder_payment_paid ? 'Yes' : 'No'}</p>
              </div>
              <div>
                <span className="text-stone-400 text-xs">OB Doctor / Clinic</span>
                <p className="font-medium">{insurance.ob_clinic || '—'}</p>
              </div>
              <div>
                <span className="text-stone-400 text-xs">Delivery Hospital</span>
                <p className="font-medium">{insurance.hospital || '—'}</p>
              </div>
              {insurance.notes && (
                <div className="col-span-2">
                  <span className="text-stone-400 text-xs">Notes</span>
                  <p className="font-medium">{insurance.notes}</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment History */}
      {insurance.has_insurance && (
        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Payment History</CardTitle>
              {(
                <Button size="sm" className="gap-1 text-xs" style={{ backgroundColor: '#283693' }} onClick={() => setPayOpen(true)}>
                  <Plus className="size-3" /> Log Payment
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {payments.length === 0 ? (
              <p className="text-sm text-stone-400 text-center py-4">No payments logged yet</p>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-stone-50 text-[10px] uppercase tracking-wider text-stone-400">
                      <th className="text-left px-4 py-2 font-semibold">Month</th>
                      <th className="text-left px-4 py-2 font-semibold">Date Paid</th>
                      <th className="text-left px-4 py-2 font-semibold">Method</th>
                      <th className="text-left px-4 py-2 font-semibold">Payment Info</th>
                      <th className="text-left px-4 py-2 font-semibold">Logged By</th>
                      <th className="text-left px-4 py-2 font-semibold">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map(p => {
                      const [y, m] = p.month_for.split('-')
                      const monthLabel = new Date(y, parseInt(m) - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                      return (
                        <tr key={p.id} className="border-t hover:bg-stone-50/50">
                          <td className="px-4 py-3 font-medium">{monthLabel}</td>
                          <td className="px-4 py-3">{formatDate(p.paid_date)}</td>
                          <td className="px-4 py-3">{PAYMENT_METHODS.find(m => m.value === p.payment_method)?.label || p.payment_method}</td>
                          <td className="px-4 py-3 text-stone-500">{p.payment_info || '—'}</td>
                          <td className="px-4 py-3 text-stone-500">{p.logged_by || '—'}</td>
                          <td className="px-4 py-3 text-stone-500">{p.notes || '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Log Payment Dialog */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Log Insurance Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[11px] text-stone-400 font-medium">Month Premium Is For *</label>
              <select value={payForm.month_for} onChange={e => setPayForm(f => ({ ...f, month_for: e.target.value }))}
                className="w-full h-8 text-sm border border-stone-200 rounded-md px-2 bg-white">
                <option value="">Select month...</option>
                {getMonthOptions().map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-stone-400 font-medium">Date Paid *</label>
              <Input type="date" value={payForm.paid_date} onChange={e => setPayForm(f => ({ ...f, paid_date: e.target.value }))} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-stone-400 font-medium">How Paid *</label>
              <select value={payForm.payment_method} onChange={e => setPayForm(f => ({ ...f, payment_method: e.target.value }))}
                className="w-full h-8 text-sm border border-stone-200 rounded-md px-2 bg-white">
                {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-stone-400 font-medium">Payment Info (last 4 of CC or check #)</label>
              <Input value={payForm.payment_info} onChange={e => setPayForm(f => ({ ...f, payment_info: e.target.value }))} placeholder="e.g. 4242 or Check #1234" className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-stone-400 font-medium">Notes</label>
              <Textarea value={payForm.notes} onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes..." rows={2} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setPayOpen(false)}>Cancel</Button>
              <Button size="sm" className="gap-1" style={{ backgroundColor: '#283693' }} onClick={handleLogPayment} disabled={paySaving || !payForm.month_for || !payForm.paid_date}>
                {paySaving ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
                {paySaving ? 'Saving...' : 'Log Payment'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel Policy Dialog */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600">Cancel Insurance Policy</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              <p className="font-semibold flex items-center gap-1.5"><AlertTriangle className="size-4" /> Are you sure?</p>
              <p className="mt-1 text-xs">This will mark the policy as cancelled. All future premium reminders will be removed. This cannot be undone.</p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setCancelOpen(false)}>Keep Policy</Button>
              <Button variant="destructive" size="sm" onClick={handleCancel} disabled={cancelling} className="gap-1">
                {cancelling ? <Loader2 className="size-3 animate-spin" /> : <X className="size-3" />}
                {cancelling ? 'Cancelling...' : 'Cancel Policy'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
