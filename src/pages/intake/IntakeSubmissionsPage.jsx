import { useState, useEffect } from 'react'
import { Search, Filter, Eye, ExternalLink } from 'lucide-react'
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
  if (sub.type === 'gc') return `${sub.answers.firstName} ${sub.answers.lastName}`
  return `${sub.answers.primaryFirstName} ${sub.answers.primaryLastName}`
}

function getApplicantEmail(sub) {
  return sub.answers.email
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function GCAnswerDetail({ answers }) {
  return (
    <div className="space-y-6 text-sm">
      <section>
        <p className="font-semibold text-stone-700 mb-3 pb-1 border-b">About You</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          <div><span className="text-stone-400">Name</span><p className="font-medium">{answers.firstName} {answers.lastName}</p></div>
          <div><span className="text-stone-400">Date of Birth</span><p className="font-medium">{answers.dob}</p></div>
          <div><span className="text-stone-400">Email</span><p className="font-medium">{answers.email}</p></div>
          <div><span className="text-stone-400">Phone</span><p className="font-medium">{answers.phone}</p></div>
          <div><span className="text-stone-400">Location</span><p className="font-medium">{answers.city}, {answers.state}</p></div>
          <div><span className="text-stone-400">Marital Status</span><p className="font-medium">{answers.maritalStatus}</p></div>
          {answers.partnerName && <div><span className="text-stone-400">Partner</span><p className="font-medium">{answers.partnerName}</p></div>}
        </div>
      </section>
      <section>
        <p className="font-semibold text-stone-700 mb-3 pb-1 border-b">Health & Lifestyle</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          <div><span className="text-stone-400">Height</span><p className="font-medium">{answers.heightFt}'{answers.heightIn}"</p></div>
          <div><span className="text-stone-400">Weight</span><p className="font-medium">{answers.weightLbs} lbs</p></div>
          <div><span className="text-stone-400">BMI</span><p className={`font-medium ${answers.bmi > 33 || answers.bmi < 19 ? 'text-red-600' : 'text-emerald-600'}`}>{answers.bmi}</p></div>
          <div><span className="text-stone-400">Tobacco Use</span><p className={`font-medium ${answers.tobaccoUse ? 'text-red-600' : ''}`}>{answers.tobaccoUse ? 'Yes' : 'No'}</p></div>
          <div><span className="text-stone-400">Drug Use</span><p className={`font-medium ${answers.drugUse ? 'text-red-600' : ''}`}>{answers.drugUse ? 'Yes' : 'No'}</p></div>
          <div><span className="text-stone-400">Medical Condition</span><p className={`font-medium ${answers.seriousMedicalCondition ? 'text-red-600' : ''}`}>{answers.seriousMedicalCondition ? 'Yes' : 'No'}</p></div>
          <div><span className="text-stone-400">Currently Pregnant</span><p className={`font-medium ${answers.currentlyPregnant ? 'text-red-600' : ''}`}>{answers.currentlyPregnant ? 'Yes' : 'No'}</p></div>
        </div>
      </section>
      <section>
        <p className="font-semibold text-stone-700 mb-3 pb-1 border-b">Pregnancy History</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          <div><span className="text-stone-400">Biological Children</span><p className={`font-medium ${answers.biologicalChildren === 0 ? 'text-red-600' : ''}`}>{answers.biologicalChildren}</p></div>
          <div><span className="text-stone-400">Total Pregnancies</span><p className="font-medium">{answers.totalPregnancies}</p></div>
          <div><span className="text-stone-400">Vaginal Deliveries</span><p className="font-medium">{answers.vaginalDeliveries}</p></div>
          <div><span className="text-stone-400">C-Sections</span><p className={`font-medium ${answers.cSections > 3 ? 'text-red-600' : ''}`}>{answers.cSections}</p></div>
          {answers.majorComplications && <div className="col-span-2"><span className="text-stone-400">Complications</span><p className="font-medium">{answers.majorComplications}</p></div>}
        </div>
      </section>
      <section>
        <p className="font-semibold text-stone-700 mb-3 pb-1 border-b">Surrogacy Readiness</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          <div><span className="text-stone-400">Previous Surrogate</span><p className="font-medium">{answers.previousSurrogacy ? 'Yes' : 'No'}</p></div>
          <div><span className="text-stone-400">Carry Multiples</span><p className="font-medium">{answers.willingToCarryMultiples ? 'Yes' : 'No'}</p></div>
          <div><span className="text-stone-400">IP Contact Pref.</span><p className="font-medium">{answers.contactPreferenceWithIPs}</p></div>
          <div><span className="text-stone-400">Support System</span><p className="font-medium">{answers.supportSystemConfirmed ? 'Confirmed' : 'Not yet'}</p></div>
        </div>
        <div className="mt-2"><span className="text-stone-400">Motivation</span><p className="mt-1 text-stone-600 leading-relaxed">{answers.motivation}</p></div>
      </section>
      <section>
        <p className="font-semibold text-stone-700 mb-3 pb-1 border-b">Final Details</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          <div><span className="text-stone-400">Govt. Assistance</span><p className={`font-medium ${answers.govtAssistance ? 'text-red-600' : ''}`}>{answers.govtAssistance ? 'Yes' : 'No'}</p></div>
          <div><span className="text-stone-400">Preferred Contact</span><p className="font-medium">{answers.preferredContact}</p></div>
          <div><span className="text-stone-400">Heard Via</span><p className="font-medium">{answers.hearAboutUs}</p></div>
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
    if (sourceFilter !== 'all' && s.tracking.resolvedSource !== sourceFilter) return false
    return true
  })

  function updateStatus(id, newStatus) {
    setSubmissions(prev => prev.map(s => s.id === id ? { ...s, status: newStatus } : s))
    if (selected?.id === id) setSelected(prev => ({ ...prev, status: newStatus }))
    updateIntakeSubmissionStatus(id, newStatus).catch(() => {})
  }

  const sources = [...new Set(submissions.map(s => s.tracking.resolvedSource).filter(Boolean))]

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
                  <span className="text-stone-600">{getSourceLabel(sub.tracking.resolvedSource)}</span>
                  {sub.tracking.utm_campaign && (
                    <p className="text-xs text-stone-400">{sub.tracking.utm_campaign}</p>
                  )}
                </td>
                <td className="py-4 px-4"><StatusBadge status={sub.status} /></td>
                <td className="py-4 px-4">
                  {sub.dqReasons.length > 0 ? (
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
                  Submitted {formatDate(selected.submittedAt)} · via {getSourceLabel(selected.tracking.resolvedSource)}
                  {selected.tracking.utm_campaign && ` · ${selected.tracking.utm_campaign}`}
                </p>
              </DialogHeader>

              {/* DQ reasons */}
              {selected.dqReasons.length > 0 && (
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

              {/* Status actions */}
              <div className="flex flex-wrap gap-2 pt-4 border-t border-stone-100 mt-4">
                <p className="text-xs text-stone-400 w-full mb-1">Update Status:</p>
                {['pending_review', 'reviewed', 'qualified', 'approved', 'rejected'].map(s => (
                  <Button
                    key={s}
                    variant={selected.status === s ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => updateStatus(selected.id, s)}
                    className={selected.status === s ? 'bg-stone-800 text-white' : ''}
                  >
                    {STATUS_CONFIG[s]?.label || s}
                  </Button>
                ))}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
