import { useState, useEffect } from 'react'
import { useRole } from '@/context/RoleContext'
import { Search, Filter, Eye, ExternalLink, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import PageHeader from '@/components/shared/PageHeader'
import { mockIntakeSubmissions, DQ_REASON_LABELS, getSourceLabel } from '@/data/mock/intakeSubmissions'
import { fetchIntakeSubmissions, updateIntakeSubmissionStatus } from '@/lib/db'

const STATUS_CONFIG = {
  pending_review: { label: 'Pending Review', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  reviewed: { label: 'Reviewed', className: 'bg-violet-100 text-violet-700 border-violet-200' },
  qualified: { label: 'Qualified', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  approved: { label: 'Approved', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  disqualified: { label: 'Disqualified', className: 'bg-red-100 text-red-700 border-red-200' },
  rejected: { label: 'Rejected', className: 'bg-stone-100 text-stone-500 border-stone-200' },
}

function StatusBadge({ status }) {
  const config = STATUS_CONFIG[status] || { label: status, className: 'bg-stone-100 text-stone-500' }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${config.className}`}>
      {config.label}
    </span>
  )
}

function getApplicantName(sub) {
  if (sub.type === 'gc') return `${sub.answers?.firstName || ''} ${sub.answers?.lastName || ''}`.trim() || 'Unknown'
  return `${sub.answers?.primaryFirstName || ''} ${sub.answers?.primaryLastName || ''}`.trim() || 'Unknown'
}

function getApplicantEmail(sub) {
  return sub.answers?.email || sub.answers?.primaryEmail || ''
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function GCAnswerDetail({ answers }) {
  const a = answers || {}
  const yn = (v) => v === true || v === 'yes' ? 'Yes' : v === false || v === 'no' ? 'No' : '—'
  const bmi = (a.heightFt && a.weightLbs) ? ((a.weightLbs * 703) / ((parseInt(a.heightFt) * 12 + parseInt(a.heightIn || 0)) ** 2)).toFixed(1) : null

  return (
    <div className="space-y-6 text-sm">
      <section>
        <p className="font-semibold text-stone-700 mb-3 pb-1 border-b">Personal Information</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          <div><span className="text-stone-400">First Name</span><p className="font-medium">{a.firstName}</p></div>
          <div><span className="text-stone-400">Last Name</span><p className="font-medium">{a.lastName}</p></div>
          <div><span className="text-stone-400">Email</span><p className="font-medium">{a.email}</p></div>
          <div><span className="text-stone-400">Phone</span><p className="font-medium">{a.phone}</p></div>
          <div><span className="text-stone-400">Date of Birth</span><p className="font-medium">{a.dob}</p></div>
          <div><span className="text-stone-400">State</span><p className="font-medium">{a.state}</p></div>
          <div><span className="text-stone-400">U.S. Citizen</span><p className="font-medium">{yn(a.usCitizen)}</p></div>
          <div><span className="text-stone-400">Marital Status</span><p className="font-medium">{a.maritalStatus || '—'}</p></div>
        </div>
      </section>
      <section>
        <p className="font-semibold text-stone-700 mb-3 pb-1 border-b">Physical</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          <div><span className="text-stone-400">Height</span><p className="font-medium">{a.heightFt}'{a.heightIn}"</p></div>
          <div><span className="text-stone-400">Weight</span><p className="font-medium">{a.weightLbs} lbs</p></div>
          {bmi && <div><span className="text-stone-400">BMI</span><p className={`font-medium ${bmi > 33 || bmi < 19 ? 'text-red-600' : 'text-emerald-600'}`}>{bmi}</p></div>}
        </div>
      </section>
      <section>
        <p className="font-semibold text-stone-700 mb-3 pb-1 border-b">Screening Questions</p>
        <div className="grid grid-cols-1 gap-y-2">
          <div className="flex items-center justify-between py-1.5 border-b border-stone-100">
            <span className="text-stone-500">Have you had a healthy pregnancy and delivery?</span>
            <span className={`font-semibold ${a.healthyPregnancy === false ? 'text-red-600' : 'text-emerald-600'}`}>{yn(a.healthyPregnancy)}</span>
          </div>
          <div className="flex items-center justify-between py-1.5 border-b border-stone-100">
            <span className="text-stone-500">Have you had 6 or more pregnancies?</span>
            <span className={`font-semibold ${a.sixOrMoreDeliveries === true ? 'text-red-600' : 'text-emerald-600'}`}>{yn(a.sixOrMoreDeliveries)}</span>
          </div>
          <div className="flex items-center justify-between py-1.5 border-b border-stone-100">
            <span className="text-stone-500">Have you had more than 2 C-sections?</span>
            <span className={`font-semibold ${a.moreThanTwoCsections === true ? 'text-red-600' : 'text-emerald-600'}`}>{yn(a.moreThanTwoCsections)}</span>
          </div>
        </div>
      </section>
      <section>
        <p className="font-semibold text-stone-700 mb-3 pb-1 border-b">Other</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          <div><span className="text-stone-400">Preferred Contact</span><p className="font-medium">{a.preferredContact || '—'}</p></div>
          <div><span className="text-stone-400">How did you hear about us?</span><p className="font-medium">{a.hearAboutUs || '—'}{a.hearAboutUsOther ? ` — ${a.hearAboutUsOther}` : ''}</p></div>
          <div><span className="text-stone-400">Agreed to Background Check</span><p className="font-medium">{yn(a.agreeBackgroundCheck)}</p></div>
        </div>
      </section>
    </div>
  )
}

function IPAnswerDetail({ answers }) {
  const hasPartner = answers.hasPartner === 'yes' || answers.hasPartner === true
  return (
    <div className="space-y-6 text-sm">
      <section>
        <p className="font-semibold text-stone-700 mb-3 pb-1 border-b">Intended Parent 1</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          <div><span className="text-stone-400">Name</span><p className="font-medium">{answers.primaryFirstName} {answers.primaryLastName}</p></div>
          <div><span className="text-stone-400">Date of Birth</span><p className="font-medium">{answers.primaryDob}</p></div>
          <div><span className="text-stone-400">Email</span><p className="font-medium">{answers.email}</p></div>
          <div><span className="text-stone-400">Phone</span><p className="font-medium">{answers.phone}</p></div>
        </div>
      </section>
      <section>
        <p className="font-semibold text-stone-700 mb-3 pb-1 border-b">Address</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          <div className="col-span-2"><span className="text-stone-400">Street</span><p className="font-medium">{answers.street}{answers.street2 ? `, ${answers.street2}` : ''}</p></div>
          <div><span className="text-stone-400">City</span><p className="font-medium">{answers.city}</p></div>
          <div><span className="text-stone-400">State</span><p className="font-medium">{answers.stateProv}</p></div>
          <div><span className="text-stone-400">Zip</span><p className="font-medium">{answers.zipCode}</p></div>
          <div><span className="text-stone-400">Country</span><p className="font-medium">{answers.country}</p></div>
        </div>
      </section>
      <section>
        <p className="font-semibold text-stone-700 mb-3 pb-1 border-b">Intended Parent 2</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          <div className="col-span-2"><span className="text-stone-400">Has Partner</span><p className="font-medium">{hasPartner ? 'Yes' : 'No'}</p></div>
          {hasPartner && (
            <>
              <div><span className="text-stone-400">Partner Name</span><p className="font-medium">{answers.ip2FirstName} {answers.ip2LastName}</p></div>
              <div><span className="text-stone-400">Partner DOB</span><p className="font-medium">{answers.ip2Dob}</p></div>
              <div><span className="text-stone-400">Partner Email</span><p className="font-medium">{answers.ip2Email}</p></div>
              <div><span className="text-stone-400">Partner Phone</span><p className="font-medium">{answers.ip2Phone}</p></div>
            </>
          )}
        </div>
      </section>
      <section>
        <p className="font-semibold text-stone-700 mb-3 pb-1 border-b">Fertility Details</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          <div><span className="text-stone-400">Has RE</span><p className="font-medium">{answers.hasRE === true ? 'Yes' : answers.hasRE === false ? 'Not yet' : '—'}</p></div>
          {answers.hasRE === true && answers.reDoctorName && (
            <div><span className="text-stone-400">Doctor</span><p className="font-medium">{answers.reDoctorName}</p></div>
          )}
          <div><span className="text-stone-400">Frozen Embryos</span><p className="font-medium">{answers.hasFrozenEmbryos === true ? 'Yes' : answers.hasFrozenEmbryos === false ? 'No' : '—'}</p></div>
          {answers.hasFrozenEmbryos === true && answers.frozenEmbryoDetails && (
            <div><span className="text-stone-400">Embryo Details</span><p className="font-medium">{answers.frozenEmbryoDetails}</p></div>
          )}
          <div><span className="text-stone-400">Using Egg Donor</span><p className="font-medium">{answers.usingEggDonor === true ? 'Yes' : answers.usingEggDonor === false ? 'No' : '—'}</p></div>
          <div><span className="text-stone-400">Using Sperm Donor</span><p className="font-medium">{answers.usingSpermDonor === true ? 'Yes' : answers.usingSpermDonor === false ? 'No' : '—'}</p></div>
        </div>
      </section>
      <section>
        <p className="font-semibold text-stone-700 mb-3 pb-1 border-b">Final Details</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          <div><span className="text-stone-400">Wants Consultation</span><p className="font-medium">{answers.wantsConsultation === true ? 'Yes' : answers.wantsConsultation === false ? 'Not right now' : '—'}</p></div>
          <div className="col-span-2"><span className="text-stone-400">Heard About Us</span><p className="font-medium">{answers.hearAboutUs || '—'}</p></div>
        </div>
      </section>
    </div>
  )
}

export default function IntakeSubmissionsPage() {
  const { currentUser } = useRole()
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    fetchIntakeSubmissions()
      .then(data => setSubmissions(data || []))
      .catch(() => setSubmissions([]))
      .finally(() => setLoading(false))
  }, [])

  const filtered = submissions.filter(s => {
    const name = getApplicantName(s).toLowerCase()
    const email = getApplicantEmail(s).toLowerCase()
    const q = search.toLowerCase()
    if (q && !name.includes(q) && !email.includes(q)) return false
    if (typeFilter !== 'all' && s.type !== typeFilter) return false
    if (statusFilter !== 'all' && s.status !== statusFilter) return false
    if (sourceFilter !== 'all' && s.tracking?.resolvedSource !== sourceFilter) return false
    return true
  })

  function updateStatus(id, newStatus) {
    setSubmissions(prev => prev.map(s => s.id === id ? { ...s, status: newStatus } : s))
    if (selected?.id === id) setSelected(prev => ({ ...prev, status: newStatus }))
    updateIntakeSubmissionStatus(id, newStatus).catch(() => {})
  }

  async function markAsReviewed(id) {
    try {
      const { supabase: sb } = await import('@/lib/supabase')
      if (!sb) return
      const { data: row } = await sb.from('intake_submissions').select('answers').eq('id', id).single()
      if (row) {
        const updated = {
          ...(row.answers || {}),
          _reviewedAt: new Date().toISOString(),
          _reviewedBy: currentUser?.name || currentUser?.email || 'Admin',
        }
        await sb.from('intake_submissions').update({ answers: updated, status: 'reviewed' }).eq('id', id)
        setSubmissions(prev => prev.map(s => s.id === id ? { ...s, status: 'reviewed', answers: updated } : s))
        if (selected?.id === id) setSelected(prev => ({ ...prev, status: 'reviewed', answers: updated }))
      }
    } catch (err) { console.error('Mark reviewed failed:', err) }
  }

  const sources = [...new Set(submissions.map(s => s.tracking?.resolvedSource).filter(Boolean))]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Intake Applications"
        subtitle={`${submissions.length} total applications — ${submissions.filter(s => s.status === 'qualified' || s.status === 'approved').length} qualified`}
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <Input
            placeholder="Search name or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="gc">Surrogate (GC)</SelectItem>
            <SelectItem value="ip">Intended Parent</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending_review">Pending Review</SelectItem>
            <SelectItem value="reviewed">Reviewed</SelectItem>
            <SelectItem value="qualified">Qualified</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="disqualified">Disqualified</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            {sources.map(s => <SelectItem key={s} value={s}>{getSourceLabel(s)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-stone-200 overflow-hidden bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-stone-50 border-b border-stone-200">
              <th className="text-left py-3 px-4 font-medium text-stone-500">Applicant</th>
              <th className="text-left py-3 px-4 font-medium text-stone-500">Type</th>
              <th className="text-left py-3 px-4 font-medium text-stone-500">Submitted</th>
              <th className="text-left py-3 px-4 font-medium text-stone-500">Source</th>
              <th className="text-left py-3 px-4 font-medium text-stone-500">Status</th>
              <th className="text-left py-3 px-4 font-medium text-stone-500">DQ Reasons</th>
              <th className="py-3 px-4" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="py-12 text-center text-stone-400">No applications match your filters.</td>
              </tr>
            )}
            {filtered.map(sub => (
              <tr key={sub.id} className="border-b border-stone-100 hover:bg-stone-50 transition-colors">
                <td className="py-4 px-4">
                  <p className="font-medium text-stone-800">{getApplicantName(sub)}</p>
                  <p className="text-xs text-stone-400">{getApplicantEmail(sub)}</p>
                </td>
                <td className="py-4 px-4">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                    sub.type === 'gc'
                      ? 'bg-rose-50 text-rose-600 border-rose-200'
                      : 'bg-blue-50 text-blue-600 border-blue-200'
                  }`}>
                    {sub.type === 'gc' ? 'Surrogate' : 'Intended Parent'}
                  </span>
                </td>
                <td className="py-4 px-4 text-stone-500">{formatDate(sub.submittedAt)}</td>
                <td className="py-4 px-4">
                  <span className="text-stone-600">{getSourceLabel(sub.tracking?.resolvedSource)}</span>
                  {sub.tracking?.utm_campaign && (
                    <p className="text-xs text-stone-400">{sub.tracking?.utm_campaign}</p>
                  )}
                </td>
                <td className="py-4 px-4"><StatusBadge status={sub.status} /></td>
                <td className="py-4 px-4">
                  {sub.dqReasons?.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {sub.dqReasons.map(r => (
                        <span key={r} className="text-xs bg-red-50 text-red-600 border border-red-100 rounded px-1.5 py-0.5">
                          {DQ_REASON_LABELS[r] || r}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-stone-300 text-xs">—</span>
                  )}
                </td>
                <td className="py-4 px-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 text-stone-500 hover:text-stone-800"
                    onClick={() => setSelected(sub)}
                  >
                    <Eye className="w-4 h-4" />
                    View
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={open => !open && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <span>{getApplicantName(selected)}</span>
                  <StatusBadge status={selected.status} />
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${
                    selected.type === 'gc'
                      ? 'bg-rose-50 text-rose-600 border-rose-200'
                      : 'bg-blue-50 text-blue-600 border-blue-200'
                  }`}>
                    {selected.type === 'gc' ? 'Surrogate' : 'Intended Parent'}
                  </span>
                </DialogTitle>
                <p className="text-sm text-stone-400">
                  Submitted {formatDate(selected.submittedAt)} · via {getSourceLabel(selected.tracking?.resolvedSource)}
                  {selected.tracking?.utm_campaign && ` · ${selected.tracking?.utm_campaign}`}
                </p>
              </DialogHeader>

              {/* DQ reasons */}
              {selected.dqReasons?.length > 0 && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-4">
                  <p className="text-sm font-semibold text-red-700 mb-2">Disqualification Reasons</p>
                  <ul className="space-y-1">
                    {selected.dqReasons.map(r => (
                      <li key={r} className="text-sm text-red-600">• {DQ_REASON_LABELS[r] || r}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Answers */}
              <div className="mt-2">
                {selected.type === 'gc'
                  ? <GCAnswerDetail answers={selected.answers} />
                  : <IPAnswerDetail answers={selected.answers} />
                }
              </div>

              {/* Review info */}
              {selected.answers?._reviewedAt && (
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm">
                  <span className="text-emerald-700 font-medium">Reviewed by {selected.answers._reviewedBy}</span>
                  <span className="text-emerald-500 ml-2">{new Date(selected.answers._reviewedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                </div>
              )}

              {/* Status actions */}
              <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-stone-100 mt-4">
                {!selected.answers?._reviewedAt && (
                  <Button size="sm" className="gap-1.5" style={{ backgroundColor: '#283693' }} onClick={() => markAsReviewed(selected.id)}>
                    <CheckCircle2 className="size-3.5" /> Mark as Reviewed
                  </Button>
                )}
                <Button
                  variant={selected.status === 'qualified' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => updateStatus(selected.id, 'qualified')}
                  className={selected.status === 'qualified' ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'text-emerald-600 border-emerald-200 hover:bg-emerald-50'}
                >
                  Qualified
                </Button>
                <Button
                  variant={selected.status === 'rejected' || selected.status === 'disqualified' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => updateStatus(selected.id, 'rejected')}
                  className={selected.status === 'rejected' || selected.status === 'disqualified' ? 'bg-red-600 text-white hover:bg-red-700' : 'text-red-600 border-red-200 hover:bg-red-50'}
                >
                  Rejected
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
