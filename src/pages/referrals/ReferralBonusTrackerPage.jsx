import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Search, Check, Gift, DollarSign, ArrowUpDown } from 'lucide-react'
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
        return {
          id: s.id,
          key: `ref_${s.id}`,
          name: s.name,
          email: s.email,
          dateApplied: s.submittedAt,
          referredBy: s.answers?.referralName || '—',
          amountDue: td.amountDue || 1000,
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

  // ── Sign-on bonus data ──
  const bonusRows = useMemo(() => {
    return surrogates.map(s => {
      const journey = findJourneyForSurrogate(s.id, journeys)
      const medicalDate = journey ? getChecklistDate(journey.journey_data, 'medical clearance') : null
      const legalDate = journey ? getChecklistDate(journey.journey_data, 'legal clearance') : null
      const td = trackerData[`bonus_${s.id}`] || {}
      return {
        id: s.id,
        key: `bonus_${s.id}`,
        name: s.name,
        email: s.email,
        dateApplied: s.submittedAt,
        amountDue: td.amountDue || 1000,
        medicalClearanceDate: medicalDate,
        halfPaidDate: td.halfPaidDate || null,
        legalClearanceDate: legalDate,
        fullyPaid: !!td.fullyPaidDate,
        fullyPaidDate: td.fullyPaidDate || null,
        journeyId: journey?.id,
        journeyPath: journey ? `/journeys/${journey.id}` : `/surrogates/${s.id}`,
      }
    })
  }, [surrogates, journeys, trackerData])

  const unpaidBonuses = bonusRows.filter(r => !r.fullyPaid)
  const paidBonuses = bonusRows.filter(r => r.fullyPaid)

  // ── Actions ──
  function markReferralPaid(row) {
    setConfirmDialog({
      title: 'Mark Referral as Paid',
      message: `Mark the $${row.amountDue.toLocaleString()} referral for ${row.name} (referred by ${row.referredBy}) as paid?`,
      onConfirm: async () => {
        const updated = { ...trackerData, [row.key]: { ...trackerData[row.key], paidDate: new Date().toISOString().split('T')[0], amountDue: row.amountDue } }
        await saveTracker(updated)
        setConfirmDialog(null)
      },
    })
  }

  function markHalfPaid(row) {
    setConfirmDialog({
      title: 'Mark Half Bonus Paid',
      message: `Mark the first half ($${(row.amountDue / 2).toLocaleString()}) of ${row.name}'s sign-on bonus as paid?`,
      onConfirm: async () => {
        const updated = { ...trackerData, [row.key]: { ...trackerData[row.key], halfPaidDate: new Date().toISOString().split('T')[0], amountDue: row.amountDue } }
        await saveTracker(updated)
        setConfirmDialog(null)
      },
    })
  }

  function markFullyPaid(row) {
    setConfirmDialog({
      title: 'Mark Bonus Fully Paid',
      message: `Mark ${row.name}'s full $${row.amountDue.toLocaleString()} sign-on bonus as completely paid?`,
      onConfirm: async () => {
        const updated = { ...trackerData, [row.key]: { ...trackerData[row.key], fullyPaidDate: new Date().toISOString().split('T')[0], amountDue: row.amountDue } }
        await saveTracker(updated)
        setConfirmDialog(null)
      },
    })
  }

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
        title="Referral & Bonus Tracker"
        subtitle={`${unpaidReferrals.length} unpaid referrals · ${unpaidBonuses.length} unpaid bonuses`}
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
            <span className="text-[10px] bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded-full ml-1">{unpaidReferrals.length}</span>
          </TabsTrigger>
          <TabsTrigger value="bonuses" className="gap-1">
            Sign-On Bonuses
            <span className="text-[10px] bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded-full ml-1">{unpaidBonuses.length}</span>
          </TabsTrigger>
          <TabsTrigger value="paid-referrals" className="gap-1">
            Paid Referrals
            <span className="text-[10px] bg-green-100 text-green-600 px-1.5 py-0.5 rounded-full ml-1">{paidReferrals.length}</span>
          </TabsTrigger>
          <TabsTrigger value="paid-bonuses" className="gap-1">
            Paid Bonuses
            <span className="text-[10px] bg-green-100 text-green-600 px-1.5 py-0.5 rounded-full ml-1">{paidBonuses.length}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="referrals" className="mt-4">
          <ReferralTable rows={filterRows(unpaidReferrals)} onMarkPaid={markReferralPaid} showPaidCol={false} />
        </TabsContent>

        <TabsContent value="bonuses" className="mt-4">
          <BonusTable rows={filterRows(unpaidBonuses)} onMarkHalfPaid={markHalfPaid} onMarkFullyPaid={markFullyPaid} showPaidCol={false} />
        </TabsContent>

        <TabsContent value="paid-referrals" className="mt-4">
          <ReferralTable rows={filterRows(paidReferrals)} showPaidCol={true} />
        </TabsContent>

        <TabsContent value="paid-bonuses" className="mt-4">
          <BonusTable rows={filterRows(paidBonuses)} showPaidCol={true} />
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
    </div>
  )
}

// ── Referral Table ──
function ReferralTable({ rows, onMarkPaid, showPaidCol }) {
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
                <th className="text-left px-4 py-3.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider whitespace-nowrap border-r border-stone-100">Legal Clearance</th>
                <th className="text-left px-4 py-3.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider whitespace-nowrap">
                  {showPaidCol ? 'Date Paid' : 'Action'}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id} className="border-b border-stone-100 hover:bg-stone-50/50">
                  <td className="px-5 py-3.5 sticky left-0 bg-white z-20 border-r border-stone-200">
                    <Link to={row.journeyPath} className="text-[#ed148c] hover:underline font-semibold text-xs">{row.name}</Link>
                    <p className="text-[10px] text-stone-400">{row.email}</p>
                  </td>
                  <td className="px-4 py-3 border-r border-stone-100 text-stone-600">{row.dateApplied ? formatDate(row.dateApplied) : '—'}</td>
                  <td className="px-4 py-3 border-r border-stone-100 font-medium text-stone-700">{row.referredBy}</td>
                  <td className="px-4 py-3 border-r border-stone-100 font-semibold text-stone-800">${row.amountDue.toLocaleString()}</td>
                  <td className="px-4 py-3 border-r border-stone-100">
                    {row.legalClearanceDate ? (
                      <span className="text-emerald-600 font-medium">{formatDate(row.legalClearanceDate)}</span>
                    ) : (
                      <span className="text-stone-300">Pending</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {showPaidCol ? (
                      <span className="text-emerald-600 font-medium">{row.paidDate ? formatDate(row.paidDate) : '—'}</span>
                    ) : (
                      <Button size="sm" variant="outline" className="text-xs h-7 gap-1 text-emerald-700 border-emerald-300 bg-emerald-50 hover:bg-emerald-100 hover:text-emerald-800" onClick={() => onMarkPaid(row)}>
                        <DollarSign className="size-3" /> Mark Paid
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
function BonusTable({ rows, onMarkHalfPaid, onMarkFullyPaid, showPaidCol }) {
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
                <th className="text-left px-4 py-3.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider whitespace-nowrap border-r border-stone-100">Amount Due</th>
                <th className="text-left px-4 py-3.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider whitespace-nowrap border-r border-stone-100">Medical Clearance</th>
                <th className="text-left px-4 py-3.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider whitespace-nowrap border-r border-stone-100">
                  {showPaidCol ? 'Half Paid' : 'Half Paid'}
                </th>
                <th className="text-left px-4 py-3.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider whitespace-nowrap border-r border-stone-100">Legal Clearance</th>
                <th className="text-left px-4 py-3.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider whitespace-nowrap">
                  {showPaidCol ? 'Date Paid' : 'Fully Paid'}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id} className="border-b border-stone-100 hover:bg-stone-50/50">
                  <td className="px-5 py-3.5 sticky left-0 bg-white z-20 border-r border-stone-200">
                    <Link to={row.journeyPath} className="text-[#ed148c] hover:underline font-semibold text-xs">{row.name}</Link>
                    <p className="text-[10px] text-stone-400">{row.email}</p>
                  </td>
                  <td className="px-4 py-3 border-r border-stone-100 text-stone-600">{row.dateApplied ? formatDate(row.dateApplied) : '—'}</td>
                  <td className="px-4 py-3 border-r border-stone-100 font-semibold text-stone-800">${row.amountDue.toLocaleString()}</td>
                  <td className="px-4 py-3 border-r border-stone-100">
                    {row.medicalClearanceDate ? (
                      <span className="text-emerald-600 font-medium">{formatDate(row.medicalClearanceDate)}</span>
                    ) : (
                      <span className="text-stone-300">Pending</span>
                    )}
                  </td>
                  <td className="px-4 py-3 border-r border-stone-100">
                    {row.halfPaidDate ? (
                      <span className="text-amber-600 font-medium">{formatDate(row.halfPaidDate)}</span>
                    ) : showPaidCol ? (
                      <span className="text-stone-300">—</span>
                    ) : (
                      <Button size="sm" variant="outline" className="text-xs h-7 gap-1 text-amber-700 border-amber-300 bg-amber-50 hover:bg-amber-100 hover:text-amber-800" onClick={() => onMarkHalfPaid(row)}>
                        <DollarSign className="size-3" /> Half
                      </Button>
                    )}
                  </td>
                  <td className="px-4 py-3 border-r border-stone-100">
                    {row.legalClearanceDate ? (
                      <span className="text-emerald-600 font-medium">{formatDate(row.legalClearanceDate)}</span>
                    ) : (
                      <span className="text-stone-300">Pending</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {showPaidCol ? (
                      <span className="text-emerald-600 font-medium">{row.fullyPaidDate ? formatDate(row.fullyPaidDate) : '—'}</span>
                    ) : (
                      <Button size="sm" variant="outline" className="text-xs h-7 gap-1 text-emerald-700 border-emerald-300 bg-emerald-50 hover:bg-emerald-100 hover:text-emerald-800" onClick={() => onMarkFullyPaid(row)}>
                        <Check className="size-3" /> Fully Paid
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
