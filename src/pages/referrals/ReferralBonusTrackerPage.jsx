import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Search, Check, Gift, DollarSign, ArrowUpDown, Plus, Eye } from 'lucide-react'
import PageHeader from '@/components/shared/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { fetchSurrogatesFromIntake } from '@/lib/db'
import { fetchMatchedJourneys } from '@/lib/matching'
import { getAllChecklistSteps } from '@/lib/checklistStore'
import { getAppConfig, setAppConfig } from '@/lib/db'
import { formatDate } from '@/lib/utils'

const CONFIG_KEY = 'referral_bonus_tracker'

// ── Inline editable date cell ──
function EditableDateCell({ value, canEdit, onSave, placeholder = 'Pending' }) {
  const [editing, setEditing] = useState(false)

  if (value && !editing) {
    return (
      <span
        className={`text-emerald-600 font-medium ${canEdit ? 'cursor-pointer hover:underline' : ''}`}
        onClick={() => canEdit && setEditing(true)}
        title={canEdit ? 'Click to edit' : undefined}
      >
        {formatDate(value)}
      </span>
    )
  }

  if (canEdit && !value) {
    return editing ? (
      <input
        type="date"
        autoFocus
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

  if (canEdit && editing) {
    return (
      <input
        type="date"
        autoFocus
        defaultValue={value}
        className="text-xs border border-stone-300 rounded px-1.5 py-1 w-[130px]"
        onBlur={(e) => { if (e.target.value) onSave(e.target.value); setEditing(false) }}
        onKeyDown={(e) => { if (e.key === 'Enter' && e.target.value) { onSave(e.target.value); setEditing(false) } if (e.key === 'Escape') setEditing(false) }}
      />
    )
  }

  return <span className="text-stone-300">{placeholder}</span>
}

// ── Helpers ──

function getChecklistDate(journeyData, stepLabel) {
  const tracking = journeyData?._checklistTracking || {}
  // Search all steps for a label match
  for (const [, val] of Object.entries(tracking)) {
    // Step IDs are opaque — we match by checking history or customLabel
    if (val.customLabel?.toLowerCase().includes(stepLabel.toLowerCase())) {
      const completeEntry = [...(val.history || [])].reverse().find(h => h.status === 'complete')
      return completeEntry?.date || null
    }
  }
  // Also try matching against configured checklist steps
  const allSteps = getAllChecklistSteps('gc')
  for (const step of allSteps) {
    if (step.label?.toLowerCase().includes(stepLabel.toLowerCase())) {
      const val = tracking[step.id]
      if (val) {
        const completeEntry = [...(val.history || [])].reverse().find(h => h.status === 'complete')
        return completeEntry?.date || null
      }
    }
  }
  return null
}

function findJourneyForSurrogate(surrogateId, journeys) {
  return journeys.find(j => j.gc_case_id === surrogateId)
}

export default function ReferralBonusTrackerPage() {
  const [surrogates, setSurrogates] = useState([])
  const [journeys, setJourneys] = useState([])
  const [trackerData, setTrackerData] = useState({})
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('referrals')
  const [search, setSearch] = useState('')
  const [confirmDialog, setConfirmDialog] = useState(null)

  useEffect(() => {
    Promise.all([
      fetchSurrogatesFromIntake(),
      fetchMatchedJourneys(),
      getAppConfig(CONFIG_KEY),
    ]).then(([gcs, js, saved]) => {
      setSurrogates(gcs || [])
      setJourneys(js || [])
      setTrackerData(saved || {})
    }).catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function saveTracker(updated) {
    setTrackerData(updated)
    await setAppConfig(CONFIG_KEY, updated).catch(() => {})
  }

  // ── Referral data ──
  const referralRows = useMemo(() => {
    return surrogates
      .filter(s => {
        const source = s.answers?.hearAboutUs || s.hearAboutUs || ''
        return source.toLowerCase().includes('friend') || source.toLowerCase().includes('family')
      })
      .map(s => {
        const journey = findJourneyForSurrogate(s.id, journeys)
        const legalDate = journey ? getChecklistDate(journey.journey_data, 'legal clearance') : null
        const td = trackerData[`ref_${s.id}`] || {}
        const medicalDate = journey ? getChecklistDate(journey.journey_data, 'medical clearance') : null
        return {
          id: s.id,
          key: `ref_${s.id}`,
          name: s.name,
          email: s.email,
          dateApplied: s.submittedAt,
          referredBy: s.answers?.referralName || '—',
          amountDue: td.amountDue || 4000,
          medicalClearanceDate: medicalDate,
          halfPaidDate: td.halfPaidDate || null,
          legalClearanceDate: legalDate,
          paid: !!td.paidDate,
          paidDate: td.paidDate || null,
          journeyId: journey?.id,
          journeyPath: journey ? `/journeys/${journey.id}` : `/surrogates/${s.id}`,
        }
      })
  }, [surrogates, journeys, trackerData])

  const unpaidReferrals = referralRows.filter(r => !r.paid)
  const paidReferrals = referralRows.filter(r => r.paid)

  // ── Incentive payment data — ALL surrogates are eligible ──
  const bonusRows = useMemo(() => {
    return surrogates.map(s => {
      const journey = findJourneyForSurrogate(s.id, journeys)
      const medicalDate = journey ? getChecklistDate(journey.journey_data, 'medical clearance') : null
      const legalDate = journey ? getChecklistDate(journey.journey_data, 'legal clearance') : null
      const td = trackerData[`bonus_${s.id}`] || {}
      const payPref = s.answers?._paymentPreference || {}
      return {
        id: s.id,
        key: `bonus_${s.id}`,
        name: s.name,
        email: s.email,
        dateApplied: s.submittedAt,
        amountDue: td.amountDue || 4000,
        medicalClearanceDate: medicalDate,
        halfPaidDate: td.halfPaidDate || null,
        legalClearanceDate: legalDate,
        fullyPaid: !!td.fullyPaidDate,
        fullyPaidDate: td.fullyPaidDate || null,
        journeyId: journey?.id,
        journeyPath: journey ? `/journeys/${journey.id}` : `/surrogates/${s.id}`,
        paymentMethod: payPref.method || null,
        paymentInfo: payPref.method === 'Venmo' ? payPref.venmoUsername : payPref.method === 'Zelle' ? payPref.zelleInfo : null,
        paymentScreenshot: payPref.screenshotUrl || null,
      }
    })
  }, [surrogates, journeys, trackerData])

  const unpaidBonuses = bonusRows.filter(r => !r.fullyPaid)
  const paidBonuses = bonusRows.filter(r => r.fullyPaid)

  // ── Actions ──
  function markReferralHalfPaid(row) {
    const today = new Date().toISOString().split('T')[0]
    setConfirmDialog({
      title: 'Mark $2,000 Paid (Medical Clearance)',
      message: `Mark the first $2,000 of the $${row.amountDue.toLocaleString()} referral for ${row.name} (referred by ${row.referredBy}) as paid at medical clearance?`,
      onConfirm: async () => {
        setTrackerData(prev => {
          const updated = { ...prev, [row.key]: { ...(prev[row.key] || {}), halfPaidDate: today, amountDue: row.amountDue } }
          setAppConfig(CONFIG_KEY, updated).catch(() => {})
          return updated
        })
        setConfirmDialog(null)
      },
    })
  }

  function markReferralPaid(row) {
    setConfirmDialog({
      title: 'Mark $2,000 Paid (Legal Clearance)',
      message: `Mark the remaining $2,000 of the $${row.amountDue.toLocaleString()} referral for ${row.name} (referred by ${row.referredBy}) as fully paid at legal clearance?`,
      onConfirm: async () => {
        const updated = { ...trackerData, [row.key]: { ...trackerData[row.key], paidDate: new Date().toISOString().split('T')[0], amountDue: row.amountDue } }
        await saveTracker(updated)
        setConfirmDialog(null)
      },
    })
  }

  function markHalfPaid(row) {
    setConfirmDialog({
      title: 'Mark $1,000 Paid (Medical Clearance)',
      message: `Mark $1,000 of ${row.name}'s $${row.amountDue.toLocaleString()} sign-on bonus as paid at medical clearance?`,
      onConfirm: async () => {
        const updated = { ...trackerData, [row.key]: { ...trackerData[row.key], halfPaidDate: new Date().toISOString().split('T')[0], amountDue: row.amountDue } }
        await saveTracker(updated)
        setConfirmDialog(null)
      },
    })
  }

  function markFullyPaid(row) {
    setConfirmDialog({
      title: 'Mark $3,000 Paid (Legal Clearance)',
      message: `Mark the remaining $3,000 of ${row.name}'s $${row.amountDue.toLocaleString()} sign-on bonus as paid at legal clearance?`,
      onConfirm: async () => {
        const updated = { ...trackerData, [row.key]: { ...trackerData[row.key], fullyPaidDate: new Date().toISOString().split('T')[0], amountDue: row.amountDue } }
        await saveTracker(updated)
        setConfirmDialog(null)
      },
    })
  }

  // ── Save date on a manual row ──
  async function saveDate(key, field, value) {
    const updated = { ...trackerData, [key]: { ...trackerData[key], [field]: value } }
    await saveTracker(updated)
  }

  // ── Manual add ──
  const [addReferralOpen, setAddReferralOpen] = useState(false)
  const [addBonusOpen, setAddBonusOpen] = useState(false)
  const [manualForm, setManualForm] = useState({ name: '', email: '', referredBy: '', amount: '4000', dateApplied: new Date().toISOString().split('T')[0] })

  function resetManualForm() {
    setManualForm({ name: '', email: '', referredBy: '', amount: '4000', dateApplied: new Date().toISOString().split('T')[0] })
  }

  async function saveManualReferral() {
    if (!manualForm.name.trim()) return
    const id = `manual_${Date.now()}`
    const entry = {
      manual: true,
      name: manualForm.name.trim(),
      email: manualForm.email.trim(),
      referredBy: manualForm.referredBy.trim() || '—',
      amountDue: parseFloat(manualForm.amount) || 1000,
      dateApplied: manualForm.dateApplied,
    }
    const updated = { ...trackerData, [`ref_${id}`]: entry }
    await saveTracker(updated)
    setAddReferralOpen(false)
    resetManualForm()
  }

  async function saveManualBonus() {
    if (!manualForm.name.trim()) return
    const id = `manual_${Date.now()}`
    const entry = {
      manual: true,
      name: manualForm.name.trim(),
      email: manualForm.email.trim(),
      amountDue: parseFloat(manualForm.amount) || 1000,
      dateApplied: manualForm.dateApplied,
    }
    const updated = { ...trackerData, [`bonus_${id}`]: entry }
    await saveTracker(updated)
    setAddBonusOpen(false)
    resetManualForm()
  }

  // ── Build manual rows from trackerData ──
  const manualReferralRows = useMemo(() => {
    return Object.entries(trackerData)
      .filter(([key, val]) => key.startsWith('ref_manual_') && val.manual)
      .map(([key, val]) => ({
        id: key.replace('ref_', ''),
        key,
        name: val.name,
        email: val.email || '',
        dateApplied: val.dateApplied,
        referredBy: val.referredBy || '—',
        amountDue: val.amountDue || 1000,
        legalClearanceDate: val.legalClearanceDate || null,
        paid: !!val.paidDate,
        paidDate: val.paidDate || null,
        journeyPath: null,
        manual: true,
      }))
  }, [trackerData])

  const manualBonusRows = useMemo(() => {
    return Object.entries(trackerData)
      .filter(([key, val]) => key.startsWith('bonus_manual_') && val.manual)
      .map(([key, val]) => ({
        id: key.replace('bonus_', ''),
        key,
        name: val.name,
        email: val.email || '',
        dateApplied: val.dateApplied,
        amountDue: val.amountDue || 1000,
        medicalClearanceDate: val.medicalClearanceDate || null,
        halfPaidDate: val.halfPaidDate || null,
        legalClearanceDate: val.legalClearanceDate || null,
        fullyPaid: !!val.fullyPaidDate,
        fullyPaidDate: val.fullyPaidDate || null,
        journeyPath: null,
        manual: true,
      }))
  }, [trackerData])

  // Combine auto + manual rows
  const allUnpaidReferrals = [...unpaidReferrals, ...manualReferralRows.filter(r => !r.paid)]
  const allPaidReferrals = [...paidReferrals, ...manualReferralRows.filter(r => r.paid)]
  const allUnpaidBonuses = [...unpaidBonuses, ...manualBonusRows.filter(r => !r.fullyPaid)]
  const allPaidBonuses = [...paidBonuses, ...manualBonusRows.filter(r => r.fullyPaid)]

  // ── Filter ──
  function filterRows(rows) {
    if (!search) return rows
    const q = search.toLowerCase()
    return rows.filter(r =>
      r.name.toLowerCase().includes(q) ||
      (r.referredBy && r.referredBy.toLowerCase().includes(q)) ||
      (r.email && r.email.toLowerCase().includes(q))
    )
  }

  if (loading) return <div className="p-8 text-center text-stone-400 text-sm">Loading...</div>

  return (
    <div className="space-y-6">
      <PageHeader
        title="Referrals & Incentives"
        subtitle={`${allUnpaidReferrals.length} unpaid referrals · ${allUnpaidBonuses.length} unpaid incentives`}
      />

      {/* Search */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <Input placeholder="Search name or referrer..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="referrals" className="gap-1">
            Referrals
            <span className="text-[10px] bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded-full ml-1">{allUnpaidReferrals.length}</span>
          </TabsTrigger>
          <TabsTrigger value="bonuses" className="gap-1">
            Incentive Payment
            <span className="text-[10px] bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded-full ml-1">{allUnpaidBonuses.length}</span>
          </TabsTrigger>
          <TabsTrigger value="paid-referrals" className="gap-1">
            Paid Referrals
            <span className="text-[10px] bg-green-100 text-green-600 px-1.5 py-0.5 rounded-full ml-1">{allPaidReferrals.length}</span>
          </TabsTrigger>
          <TabsTrigger value="paid-bonuses" className="gap-1">
            Paid Incentives
            <span className="text-[10px] bg-green-100 text-green-600 px-1.5 py-0.5 rounded-full ml-1">{allPaidBonuses.length}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="referrals" className="mt-4">
          <div className="flex justify-end mb-3">
            <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => { resetManualForm(); setAddReferralOpen(true) }}>
              <Plus className="size-3.5" /> Add Referral
            </Button>
          </div>
          <ReferralTable rows={filterRows(allUnpaidReferrals)} onMarkHalfPaid={markReferralHalfPaid} onMarkPaid={markReferralPaid} onDateChange={saveDate} showPaidCol={false} />
        </TabsContent>

        <TabsContent value="bonuses" className="mt-4">
          <div className="flex justify-end mb-3">
            <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => { resetManualForm(); setAddBonusOpen(true) }}>
              <Plus className="size-3.5" /> Add Incentive
            </Button>
          </div>
          <BonusTable rows={filterRows(allUnpaidBonuses)} onMarkHalfPaid={markHalfPaid} onMarkFullyPaid={markFullyPaid} onDateChange={saveDate} showPaidCol={false} />
        </TabsContent>

        <TabsContent value="paid-referrals" className="mt-4">
          <ReferralTable rows={filterRows(allPaidReferrals)} onDateChange={saveDate} showPaidCol={true} />
        </TabsContent>

        <TabsContent value="paid-bonuses" className="mt-4">
          <BonusTable rows={filterRows(allPaidBonuses)} onDateChange={saveDate} showPaidCol={true} />
        </TabsContent>
      </Tabs>

      {/* Confirm Dialog */}
      <Dialog open={!!confirmDialog} onOpenChange={open => !open && setConfirmDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{confirmDialog?.title}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-stone-600">{confirmDialog?.message}</p>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" size="sm">Cancel</Button></DialogClose>
            <Button size="sm" onClick={confirmDialog?.onConfirm} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1">
              <Check className="size-3.5" /> Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Referral Dialog */}
      <Dialog open={addReferralOpen} onOpenChange={setAddReferralOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Referral</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-stone-600">Applicant Name *</label>
              <Input value={manualForm.name} onChange={e => setManualForm(f => ({ ...f, name: e.target.value }))} placeholder="First Last" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-stone-600">Email</label>
              <Input value={manualForm.email} onChange={e => setManualForm(f => ({ ...f, email: e.target.value }))} placeholder="email@example.com" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-stone-600">Referred By *</label>
              <Input value={manualForm.referredBy} onChange={e => setManualForm(f => ({ ...f, referredBy: e.target.value }))} placeholder="Name of referrer" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-stone-600">Amount Due</label>
                <Input type="number" value={manualForm.amount} onChange={e => setManualForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-stone-600">Date Applied</label>
                <Input type="date" value={manualForm.dateApplied} onChange={e => setManualForm(f => ({ ...f, dateApplied: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" size="sm">Cancel</Button></DialogClose>
            <Button size="sm" onClick={saveManualReferral} disabled={!manualForm.name.trim()} className="bg-[#ed148c] hover:bg-[#d4127d] text-white gap-1">
              <Plus className="size-3.5" /> Add Referral
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Sign-On Bonus Dialog */}
      <Dialog open={addBonusOpen} onOpenChange={setAddBonusOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Sign-On Bonus</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-stone-600">Surrogate Name *</label>
              <Input value={manualForm.name} onChange={e => setManualForm(f => ({ ...f, name: e.target.value }))} placeholder="First Last" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-stone-600">Email</label>
              <Input value={manualForm.email} onChange={e => setManualForm(f => ({ ...f, email: e.target.value }))} placeholder="email@example.com" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-stone-600">Amount Due</label>
                <Input type="number" value={manualForm.amount} onChange={e => setManualForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-stone-600">Date Applied</label>
                <Input type="date" value={manualForm.dateApplied} onChange={e => setManualForm(f => ({ ...f, dateApplied: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" size="sm">Cancel</Button></DialogClose>
            <Button size="sm" onClick={saveManualBonus} disabled={!manualForm.name.trim()} className="bg-[#ed148c] hover:bg-[#d4127d] text-white gap-1">
              <Plus className="size-3.5" /> Add Bonus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Referral Table ──
function ReferralTable({ rows, onMarkHalfPaid, onMarkPaid, onDateChange, showPaidCol }) {
  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="p-0">
          <div className="px-6 py-16 text-center text-stone-400">
            <Gift className="size-8 mx-auto mb-2 text-stone-300" />
            <p className="text-sm">{showPaidCol ? 'No paid referrals yet.' : 'No unpaid referrals found.'}</p>
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
                <th className="text-left px-5 py-3.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider sticky left-0 bg-stone-50 z-20 min-w-[200px] border-r border-stone-200">
                  Referred Applicant
                </th>
                <th className="text-left px-4 py-3.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider whitespace-nowrap border-r border-stone-100">Date Applied</th>
                <th className="text-left px-4 py-3.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider whitespace-nowrap border-r border-stone-100">Referred By</th>
                <th className="text-left px-4 py-3.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider whitespace-nowrap border-r border-stone-100">Amount Due</th>
                <th className="text-left px-4 py-3.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider whitespace-nowrap border-r border-stone-100">Medical Clearance</th>
                <th className="text-left px-4 py-3.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider whitespace-nowrap border-r border-stone-100">$2,000 Paid</th>
                <th className="text-left px-4 py-3.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider whitespace-nowrap border-r border-stone-100">Legal Clearance</th>
                <th className="text-left px-4 py-3.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider whitespace-nowrap">
                  {showPaidCol ? '$2,000 Paid' : '$2,000 Paid'}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id} className="border-b border-stone-100 hover:bg-stone-50/50">
                  <td className="px-5 py-3.5 sticky left-0 bg-white z-20 border-r border-stone-200">
                    {row.journeyPath ? (
                      <Link to={row.journeyPath} className="text-[#ed148c] hover:underline font-semibold text-xs">{row.name}</Link>
                    ) : (
                      <span className="font-semibold text-xs text-stone-800">{row.name}</span>
                    )}
                    <p className="text-[10px] text-stone-400">{row.email}{row.manual ? <span className="ml-1 text-violet-400">(manual)</span> : ''}</p>
                  </td>
                  <td className="px-4 py-3 border-r border-stone-100 text-stone-600">{row.dateApplied ? formatDate(row.dateApplied) : '—'}</td>
                  <td className="px-4 py-3 border-r border-stone-100 font-medium text-stone-700">{row.referredBy}</td>
                  <td className="px-4 py-3 border-r border-stone-100 font-semibold text-stone-800">${row.amountDue.toLocaleString()}</td>
                  <td className="px-4 py-3 border-r border-stone-100">
                    <EditableDateCell
                      value={row.medicalClearanceDate}
                      canEdit={!!row.manual}
                      onSave={(date) => onDateChange?.(row.key, 'medicalClearanceDate', date)}
                    />
                  </td>
                  <td className="px-4 py-3 border-r border-stone-100">
                    {row.halfPaidDate ? (
                      <span className="text-amber-600 font-medium">{formatDate(row.halfPaidDate)}</span>
                    ) : showPaidCol ? (
                      <span className="text-stone-300">—</span>
                    ) : (
                      <Button size="sm" variant="outline" className="text-xs h-7 gap-1 text-amber-700 border-amber-300 bg-amber-50 hover:bg-amber-100 hover:text-amber-800" onClick={() => onMarkHalfPaid?.(row)}>
                        <DollarSign className="size-3" /> 2,000
                      </Button>
                    )}
                  </td>
                  <td className="px-4 py-3 border-r border-stone-100">
                    <EditableDateCell
                      value={row.legalClearanceDate}
                      canEdit={!!row.manual}
                      onSave={(date) => onDateChange?.(row.key, 'legalClearanceDate', date)}
                    />
                  </td>
                  <td className="px-4 py-3">
                    {showPaidCol || row.paidDate ? (
                      <span className="text-emerald-600 font-medium">{row.paidDate ? formatDate(row.paidDate) : '—'}</span>
                    ) : (
                      <Button size="sm" variant="outline" className="text-xs h-7 gap-1 text-emerald-700 border-emerald-300 bg-emerald-50 hover:bg-emerald-100 hover:text-emerald-800" onClick={() => onMarkPaid(row)}>
                        <DollarSign className="size-3" /> 2,000
                      </Button>
                    )}
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

// ── Bonus Table ──
function BonusTable({ rows, onMarkHalfPaid, onMarkFullyPaid, onDateChange, showPaidCol }) {
  const [previewUrl, setPreviewUrl] = useState(null)

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="p-0">
          <div className="px-6 py-16 text-center text-stone-400">
            <Gift className="size-8 mx-auto mb-2 text-stone-300" />
            <p className="text-sm">{showPaidCol ? 'No paid bonuses yet.' : 'No unpaid bonuses found.'}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200">
                <th className="text-left px-5 py-3.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider sticky left-0 bg-stone-50 z-20 min-w-[200px] border-r border-stone-200">
                  Surrogate
                </th>
                <th className="text-left px-4 py-3.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider whitespace-nowrap border-r border-stone-100">Date Applied</th>
                <th className="text-left px-4 py-3.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider whitespace-nowrap border-r border-stone-100">Pay Via</th>
                <th className="text-left px-4 py-3.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider whitespace-nowrap border-r border-stone-100">Amount Due</th>
                <th className="text-left px-4 py-3.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider whitespace-nowrap border-r border-stone-100">Medical Clearance</th>
                <th className="text-left px-4 py-3.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider whitespace-nowrap border-r border-stone-100">$1,000 Paid</th>
                <th className="text-left px-4 py-3.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider whitespace-nowrap border-r border-stone-100">Legal Clearance</th>
                <th className="text-left px-4 py-3.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider whitespace-nowrap">$3,000 Paid</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id} className="border-b border-stone-100 hover:bg-stone-50/50">
                  <td className="px-5 py-3.5 sticky left-0 bg-white z-20 border-r border-stone-200">
                    {row.journeyPath ? (
                      <Link to={row.journeyPath} className="text-[#ed148c] hover:underline font-semibold text-xs">{row.name}</Link>
                    ) : (
                      <span className="font-semibold text-xs text-stone-800">{row.name}</span>
                    )}
                    <p className="text-[10px] text-stone-400">{row.email}{row.manual ? <span className="ml-1 text-violet-400">(manual)</span> : ''}</p>
                  </td>
                  <td className="px-4 py-3 border-r border-stone-100 text-stone-600">{row.dateApplied ? formatDate(row.dateApplied) : '—'}</td>
                  <td className="px-4 py-3 border-r border-stone-100">
                    {row.paymentMethod ? (
                      <div className="flex items-center gap-1.5">
                        <div>
                          <span className="font-semibold text-stone-800">{row.paymentMethod}</span>
                          {row.paymentInfo && <p className="text-[10px] text-stone-500">{row.paymentInfo}</p>}
                        </div>
                        {row.paymentScreenshot && (
                          <button onClick={() => setPreviewUrl(row.paymentScreenshot)} className="p-1 text-stone-300 hover:text-[#283693] hover:bg-[#283693]/5 rounded transition-colors shrink-0" title="View screenshot">
                            <Eye className="size-3.5" />
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="text-stone-300 text-[10px]">Not set</span>
                    )}
                  </td>
                  <td className="px-4 py-3 border-r border-stone-100 font-semibold text-stone-800">${row.amountDue.toLocaleString()}</td>
                  <td className="px-4 py-3 border-r border-stone-100">
                    <EditableDateCell
                      value={row.medicalClearanceDate}
                      canEdit={!!row.manual}
                      onSave={(date) => onDateChange?.(row.key, 'medicalClearanceDate', date)}
                    />
                  </td>
                  <td className="px-4 py-3 border-r border-stone-100">
                    {row.halfPaidDate ? (
                      <span className="text-amber-600 font-medium">{formatDate(row.halfPaidDate)}</span>
                    ) : showPaidCol ? (
                      <span className="text-stone-300">—</span>
                    ) : (
                      <Button size="sm" variant="outline" className="text-xs h-7 gap-1 text-amber-700 border-amber-300 bg-amber-50 hover:bg-amber-100 hover:text-amber-800" onClick={() => onMarkHalfPaid(row)}>
                        <DollarSign className="size-3" /> 1,000
                      </Button>
                    )}
                  </td>
                  <td className="px-4 py-3 border-r border-stone-100">
                    <EditableDateCell
                      value={row.legalClearanceDate}
                      canEdit={!!row.manual}
                      onSave={(date) => onDateChange?.(row.key, 'legalClearanceDate', date)}
                    />
                  </td>
                  <td className="px-4 py-3">
                    {showPaidCol ? (
                      <span className="text-emerald-600 font-medium">{row.fullyPaidDate ? formatDate(row.fullyPaidDate) : '—'}</span>
                    ) : (
                      <Button size="sm" variant="outline" className="text-xs h-7 gap-1 text-emerald-700 border-emerald-300 bg-emerald-50 hover:bg-emerald-100 hover:text-emerald-800" onClick={() => onMarkFullyPaid(row)}>
                        <DollarSign className="size-3" /> 3,000
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>

    {/* Screenshot Preview */}
    <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Payment Screenshot</DialogTitle></DialogHeader>
        {previewUrl && <img src={previewUrl} alt="Payment screenshot" className="w-full rounded-lg" />}
      </DialogContent>
    </Dialog>
    </>
  )
}
