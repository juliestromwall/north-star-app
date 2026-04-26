import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Heart, Users, Baby, Send, Search, ArrowRight, MapPin, Stethoscope, ChevronDown, Eye, Clock, MessageSquare, Calendar, Circle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select as SelectUI, SelectContent as SelectContentUI, SelectItem as SelectItemUI, SelectTrigger as SelectTriggerUI, SelectValue as SelectValueUI } from '@/components/ui/select'
import PageHeader from '@/components/shared/PageHeader'
import ProfileAvatar from '@/components/shared/ProfileAvatar'
import StageBadge from '@/components/shared/StageBadge'
import EmptyState from '@/components/shared/EmptyState'
import ShareProfileDialog from '@/components/shared/ShareProfileDialog'
import MatchNotesDialog, { MatchNotesPreview } from '@/components/shared/MatchNotesDialog'
import { useRole } from '@/context/RoleContext'
import { fetchSurrogatesFromIntake, fetchIPsFromIntake, getProfilePhotoUrls, fetchSurrogateProfilesByEmails, getPortraitPhotoUrl, getRecordTrackingBatch } from '@/lib/db'
import { getSurrogateStageStatus } from '@/lib/stageStatusStore'
import { getChecklistMilestones, getChecklistSteps, deriveParentStatus } from '@/lib/checklistStore'
import { createMatchedJourney, fetchMatchedJourneys, fetchSharesForCase, fetchMatchQuestions, answerMatchQuestion, isJourneyActive, linkTandemJourneys } from '@/lib/matching'

// Stages eligible to share profiles from. Order = display order.
const ELIGIBLE_MATCHING_STAGES = ['pre-qualification', 'screening', 'matching']
const STAGE_SECTION_LABEL = {
  'pre-qualification': 'Intake',
  'screening': 'Screening',
  'matching': 'Matching',
}
const STAGE_DOT_COLOR = {
  'pre-qualification': '#ed148c',
  'screening': '#c4219a',
  'matching': '#9b2ea7',
}

// Compute per-stage milestone progress for a surrogate from their record tracking.
// Mirrors the logic used for matched-journey cards on /journeys.
function getStageMilestoneProgress(stageId, tracking = {}) {
  const milestones = getChecklistMilestones('gc', stageId)
  if (!milestones.length) return null
  const baseSteps = getChecklistSteps('gc', stageId)
  const caseSubtasks = Object.entries(tracking)
    .filter(([, v]) => v?._isCaseSubtask && !v?._deleted)
    .map(([id, v]) => ({ id, parentId: v._parentId, label: v._label || id }))
  const allSteps = [...baseSteps, ...caseSubtasks]
  const getStepStatus = (stepId) => {
    const step = allSteps.find(s => s.id === stepId)
    if (!step) return null
    const children = allSteps.filter(s => s.parentId === stepId)
    if (children.length > 0) return deriveParentStatus(children, tracking) || 'not_started'
    return tracking[stepId]?.status || 'not_started'
  }
  let completed = 0
  const data = milestones.map(ms => {
    const statuses = (ms.stepIds || []).map(getStepStatus).filter(s => s !== null)
    const allComplete = statuses.length > 0 && statuses.every(s => s === 'complete' || s === 'na' || s === 'partial_complete')
    const anyStarted = statuses.some(s => s && s !== 'not_started')
    const status = allComplete ? 'complete' : anyStarted ? 'in_progress' : 'not_started'
    if (allComplete) completed++
    return { id: ms.id, label: ms.label, status }
  })
  return { data, completed, total: milestones.length }
}

// Inline milestone strip — shared by cards on the matching page
function MilestoneStrip({ stageId, tracking }) {
  const progress = getStageMilestoneProgress(stageId, tracking || {})
  if (!progress || progress.total === 0) return null
  const { data, completed, total } = progress
  const pct = (completed / total) * 100
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[9px] text-stone-400 uppercase tracking-wider font-semibold">
        <span>Milestones</span>
        <span>{completed}/{total}</span>
      </div>
      <div className="h-1.5 rounded-full bg-stone-100 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #283693, #ed148c)' }} />
      </div>
      <div className="flex flex-wrap gap-x-2.5 gap-y-0.5">
        {data.map(ms => (
          <div key={ms.id} className="flex items-center gap-0.5">
            <Circle className={`size-2.5 shrink-0 ${ms.status === 'complete' ? 'text-emerald-500 fill-emerald-500' : ms.status === 'in_progress' ? 'text-amber-500 fill-amber-500' : 'text-stone-300'}`} />
            <span className={`text-[9px] whitespace-nowrap ${ms.status === 'complete' ? 'text-emerald-600' : ms.status === 'in_progress' ? 'text-amber-600' : 'text-stone-400'}`}>{ms.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Searchable Picker (used for Create Match dialog) ──
function SearchablePicker({ label, placeholder, value, options, onSelect }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const selected = options.find(o => String(o.id) === String(value))
  const filtered = query.trim()
    ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()) || (o.sub || '').toLowerCase().includes(query.toLowerCase()))
    : options
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {selected ? (
        <div className="flex items-center justify-between rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
          <div className="text-sm">
            <span className="font-medium text-stone-800">{selected.label}</span>
            {selected.sub && <span className="text-xs text-stone-400 ml-2">{selected.sub}</span>}
          </div>
          <button type="button" onClick={() => { onSelect(''); setQuery(''); setOpen(false) }} className="text-xs text-stone-400 hover:text-red-500">Change</button>
        </div>
      ) : (
        <div className="relative">
          <Input
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
          />
          {open && (
            <div className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto rounded-lg border border-stone-200 bg-white shadow-lg">
              {filtered.length === 0 ? (
                <p className="text-xs text-stone-400 px-3 py-2">No matches</p>
              ) : (
                filtered.map(o => (
                  <button key={o.id} type="button" onClick={() => { onSelect(o.id); setQuery(''); setOpen(false) }}
                    className="w-full text-left px-3 py-2 hover:bg-stone-50 border-b border-stone-100 last:border-0">
                    <div className="text-sm font-medium text-stone-800">{o.label}</div>
                    {o.sub && <div className="text-xs text-stone-400">{o.sub}</div>}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function getGTPAL(profileData) {
  if (!profileData?.pregnancyHistory) return null
  const pregs = profileData.pregnancyHistory.pregnancies || []
  const numPreg = parseInt(profileData.pregnancyHistory.numberOfPregnancies) || 0
  if (numPreg === 0 && pregs.length === 0) return null
  let g = Math.max(numPreg, pregs.length), t = 0, p = 0, a = 0, l = 0
  pregs.forEach(pr => {
    if (pr.outcome === 'Live Birth') { if (parseInt(pr.gestationWeeks) >= 37) t++; else p++; l++ }
    else if (['Miscarriage', 'Ectopic Pregnancy', 'Termination', 'Stillborn'].includes(pr.outcome)) a++
  })
  return { g, t, p, a, l, display: `G${g}P${t}${p}${a}${l}` }
}

function timeAgo(date) {
  const diff = Date.now() - new Date(date).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'today'
  if (days === 1) return '1d ago'
  if (days < 30) return `${days}d ago`
  return `${Math.floor(days / 30)}mo ago`
}

export default function MatchingPage() {
  const { currentUser } = useRole()
  const navigate = useNavigate()
  const [surrogates, setSurrogates] = useState([])
  const [ips, setIps] = useState([])
  const [journeys, setJourneys] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [avatarUrls, setAvatarUrls] = useState({})
  const [ipAvatars, setIpAvatars] = useState({})
  const [profileMap, setProfileMap] = useState({})
  const [shareHistory, setShareHistory] = useState({}) // { caseId: [shares] }
  const [questionHistory, setQuestionHistory] = useState({}) // { caseId: [questions] }
  const [trackingMap, setTrackingMap] = useState({}) // { caseId: _recordTracking }

  const [shareTarget, setShareTarget] = useState(null)
  const [matchNotesTarget, setMatchNotesTarget] = useState(null) // { id, answers }
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState({ gcId: '', ipId: '' })
  const [creating, setCreating] = useState(false)
  // Tandem Surrogacy: pick an IP whose existing journey gets a second
  // surrogate paired in. Only IPs with exactly one active journey AND no
  // tandem partner yet are eligible.
  const [showTandem, setShowTandem] = useState(false)
  const [tandemForm, setTandemForm] = useState({ ipId: '', gcId: '' })
  const [creatingTandem, setCreatingTandem] = useState(false)

  useEffect(() => {
    Promise.all([fetchSurrogatesFromIntake(), fetchIPsFromIntake(), fetchMatchedJourneys()])
      .then(async ([gcs, allIps, js]) => {
        setSurrogates(gcs)
        setIps(allIps)
        setJourneys(js)

        // Load profile photos
        const userIds = gcs.filter(g => g.userId).map(g => g.userId)
        if (userIds.length > 0) {
          getProfilePhotoUrls(userIds).then(setAvatarUrls).catch(() => {})
        }

        // Load IP avatars
        const ipIds = allIps.map(ip => ip.id)
        if (ipIds.length > 0) {
          Promise.all(ipIds.map(id => getPortraitPhotoUrl(`ip-${id}`).catch(() => null)))
            .then(urls => {
              const map = {}
              ipIds.forEach((id, i) => { if (urls[i]) map[id] = urls[i] })
              setIpAvatars(map)
            })
        }

        // Load profile data for GCs (for GTPAL/BMI)
        const emails = gcs.map(g => g.email).filter(Boolean)
        if (emails.length > 0) {
          fetchSurrogateProfilesByEmails(emails).then(map => {
            const byId = {}
            for (const g of gcs) {
              if (g.email && map[g.email.trim().toLowerCase()]) byId[g.id] = map[g.email.trim().toLowerCase()]
            }
            setProfileMap(byId)
          }).catch(() => {})
        }

        // Load share history + questions for ALL eligible GCs (intake, screening,
        // matching). Profiles can be shared from any of these stages now.
        const eligibleGcs = gcs.filter(g => ELIGIBLE_MATCHING_STAGES.includes(getSurrogateStageStatus(g.id).stage))

        // Load per-surrogate checklist tracking for milestone display on cards
        if (eligibleGcs.length) {
          getRecordTrackingBatch(eligibleGcs.map(g => g.id)).then(map => {
            if (map) setTrackingMap(map)
          }).catch(() => {})
        }

        const sharePromises = eligibleGcs.map(g => fetchSharesForCase(g.id).then(shares => [g.id, shares]))
        Promise.all(sharePromises).then(results => {
          const map = {}
          results.forEach(([id, shares]) => { if (shares.length > 0) map[id] = shares })
          setShareHistory(map)
        }).catch(() => {})
        const qPromises = eligibleGcs.map(g => fetchMatchQuestions({ caseId: g.id }).then(qs => [g.id, qs]))
        Promise.all(qPromises).then(results => {
          const map = {}
          results.forEach(([id, qs]) => { if (qs.length > 0) map[id] = qs })
          setQuestionHistory(map)
        }).catch(() => {})
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const eligibleGCs = useMemo(() => {
    return surrogates.filter(s => ELIGIBLE_MATCHING_STAGES.includes(getSurrogateStageStatus(s.id).stage))
  }, [surrogates])

  // Only active (non-archived) journeys block cases from the matching pipeline
  const activeJourneysForFilter = journeys.filter(isJourneyActive)
  const matchedGcIds = new Set(activeJourneysForFilter.map(j => j.gc_case_id))
  const matchedIpIds = new Set(activeJourneysForFilter.map(j => j.ip_case_id))
  const unmatchedGCs = eligibleGCs.filter(s => !matchedGcIds.has(s.id))
  const unmatchedIPs = ips.filter(i => !matchedIpIds.has(i.id))
  const filteredGCs = unmatchedGCs.filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase()))
  const filteredIPs = unmatchedIPs.filter(i => !search || (i.names || '').toLowerCase().includes(search.toLowerCase()))

  // Group GCs by stage so each stage gets its own section header
  const gcsByStage = useMemo(() => {
    const groups = { 'pre-qualification': [], 'screening': [], 'matching': [] }
    for (const s of filteredGCs) {
      const stage = getSurrogateStageStatus(s.id).stage
      if (groups[stage]) groups[stage].push(s)
    }
    return groups
  }, [filteredGCs])

  async function handleCreateMatch() {
    if (!createForm.gcId || !createForm.ipId) return
    setCreating(true)
    try {
      const journey = await createMatchedJourney({
        gcCaseId: Number(createForm.gcId),
        ipCaseId: Number(createForm.ipId),
        assignedTo: currentUser.email,
        createdBy: currentUser.name,
      })
      setShowCreate(false)
      setCreateForm({ gcId: '', ipId: '' })
      navigate(`/journeys/${journey.id}`)
    } catch (err) {
      alert('Failed: ' + (err.message || 'Unknown error'))
    } finally { setCreating(false) }
  }

  // IPs eligible for a tandem add-on: exactly one active, non-archived journey
  // and that journey has no tandem partner yet. (We don't allow >2 surrogates
  // per IP.)
  const tandemEligibleIpIds = useMemo(() => {
    const counts = new Map()
    const sample = new Map() // ipId -> the journey row, used for tandem-partner check
    for (const j of activeJourneysForFilter) {
      counts.set(j.ip_case_id, (counts.get(j.ip_case_id) || 0) + 1)
      if (!sample.has(j.ip_case_id)) sample.set(j.ip_case_id, j)
    }
    const eligible = new Set()
    for (const [ipId, count] of counts) {
      if (count === 1 && !sample.get(ipId)?.tandem_partner_journey_id) eligible.add(ipId)
    }
    return eligible
  }, [activeJourneysForFilter])

  async function handleCreateTandem() {
    if (!tandemForm.gcId || !tandemForm.ipId) return
    const existingJourney = activeJourneysForFilter.find(j => j.ip_case_id === Number(tandemForm.ipId))
    if (!existingJourney) {
      alert('Could not find the IP\'s existing active journey. Refresh and try again.')
      return
    }
    setCreatingTandem(true)
    try {
      // 1) Create the second journey (same IP, second surrogate)
      const newJourney = await createMatchedJourney({
        gcCaseId: Number(tandemForm.gcId),
        ipCaseId: Number(tandemForm.ipId),
        assignedTo: currentUser.email,
        createdBy: currentUser.name,
      })
      // 2) Link it as tandem partner of the existing journey
      await linkTandemJourneys(newJourney.id, existingJourney.id)
      setShowTandem(false)
      setTandemForm({ ipId: '', gcId: '' })
      navigate(`/journeys/${newJourney.id}`)
    } catch (err) {
      alert('Failed: ' + (err.message || 'Unknown error'))
    } finally { setCreatingTandem(false) }
  }

  if (loading) return <div className="text-center py-12 text-stone-400">Loading...</div>

  return (
    <div className="space-y-6">
      <PageHeader
        title="Matching Pipeline"
        subtitle={`${unmatchedGCs.length} surrogates ready · ${unmatchedIPs.length} intended parents`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" className="gap-1.5" onClick={() => setShowTandem(true)} disabled={tandemEligibleIpIds.size === 0}
              title={tandemEligibleIpIds.size === 0 ? 'No matched IPs available for tandem (need an IP with one active journey and no tandem partner yet)' : 'Add a second surrogate to an already-matched IP'}>
              <Users className="size-4" /> Tandem Surrogacy
            </Button>
            <Button className="gap-1.5" onClick={() => setShowCreate(true)}><Plus className="size-4" /> Create Match</Button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="rounded-2xl"><CardContent className="p-4 flex items-center gap-3">
          <div className="size-10 rounded-xl bg-pink-100 flex items-center justify-center"><Users className="size-5 text-pink-600" /></div>
          <div><p className="text-2xl font-bold">{unmatchedGCs.length}</p><p className="text-xs text-stone-500">GCs Ready to Match</p></div>
        </CardContent></Card>
        <Card className="rounded-2xl"><CardContent className="p-4 flex items-center gap-3">
          <div className="size-10 rounded-xl bg-purple-100 flex items-center justify-center"><Baby className="size-5 text-purple-600" /></div>
          <div><p className="text-2xl font-bold">{unmatchedIPs.length}</p><p className="text-xs text-stone-500">Intended Parents</p></div>
        </CardContent></Card>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search for profile to share — type to find Intake surrogates too..." className="pl-9" />
      </div>

      {/* Default view = Screening + Matching only. Intake surrogates are hidden
          until the admin types in the search box (so they're discoverable but
          don't clutter the default queue). */}
      {(!search.trim() && (gcsByStage.screening.length + gcsByStage.matching.length) === 0) && (
        <p className="text-sm text-stone-400">No surrogates in Screening or Matching. Type a name above to search Intake too.</p>
      )}

      {/* Intake — only shown when actively searching */}
      {search.trim() && gcsByStage['pre-qualification'].length > 0 && (() => {
        const stageKey = 'pre-qualification'
        const list = gcsByStage[stageKey]
        if (false) return null
        return (
          <div key={stageKey}>
            <h3 className="text-sm font-semibold text-stone-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <span className="size-2 rounded-full" style={{ backgroundColor: STAGE_DOT_COLOR[stageKey] }} />
              Surrogates in {STAGE_SECTION_LABEL[stageKey]} ({list.length}) <span className="text-[10px] font-normal text-stone-400 normal-case tracking-normal">— search results</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {list.map(gc => {
                const ss = getSurrogateStageStatus(gc.id)
                const profile = profileMap[gc.id]
                const avatarUrl = gc.userId ? avatarUrls[gc.userId] : null
                return (
                  <Card key={gc.id} className="rounded-xl hover:shadow-md transition-shadow">
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <ProfileAvatar name={gc.name} avatar={avatarUrl || profile?.personal?.profilePhotoUrl} size="md" className="ring-2 ring-white shadow-sm" />
                        <div className="flex-1 min-w-0">
                          <Link to={`/surrogates/${gc.id}`} className="text-xs font-bold hover:text-[#283693] truncate block">{gc.name}</Link>
                          {gc.location && <p className="text-[10px] text-stone-500 flex items-center gap-1 truncate"><MapPin className="size-2.5" />{gc.location}</p>}
                          <div className="mt-0.5"><StageBadge stage={ss.stage} status={ss.status} /></div>
                        </div>
                      </div>
                      {(gc.age || gc.bmi) && (
                        <div className="flex items-center gap-2 text-[10px] text-stone-500">
                          {gc.age && <span>Age {gc.age}</span>}
                          {gc.bmi && <span>BMI {gc.bmi}</span>}
                        </div>
                      )}
                      <div className="flex gap-1.5 pt-1">
                        <Button size="sm" className="gap-1 text-[11px] flex-1 h-7 px-2" style={{ backgroundColor: '#283693', color: '#fff' }}
                          onClick={() => setShareTarget({ id: gc.id, type: 'gc', name: gc.name })}>
                          <Send className="size-3" /> Share
                        </Button>
                        <Button variant="outline" size="sm" className="text-[11px] h-7 px-2" asChild>
                          <Link to={`/surrogates/${gc.id}`}>View</Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* Screening (compact card with milestones) */}
      {['screening'].map(stageKey => {
        const list = gcsByStage[stageKey]
        if (!list?.length) return null
        return (
          <div key={stageKey}>
            <h3 className="text-sm font-semibold text-stone-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <span className="size-2 rounded-full" style={{ backgroundColor: STAGE_DOT_COLOR[stageKey] }} />
              Surrogates in {STAGE_SECTION_LABEL[stageKey]} ({list.length})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {list.map(gc => {
                const ss = getSurrogateStageStatus(gc.id)
                const profile = profileMap[gc.id]
                const avatarUrl = gc.userId ? avatarUrls[gc.userId] : null
                return (
                  <Card key={gc.id} className="rounded-xl hover:shadow-md transition-shadow">
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <ProfileAvatar name={gc.name} avatar={avatarUrl || profile?.personal?.profilePhotoUrl} size="md" className="ring-2 ring-white shadow-sm" />
                        <div className="flex-1 min-w-0">
                          <Link to={`/surrogates/${gc.id}`} className="text-xs font-bold hover:text-[#283693] truncate block">{gc.name}</Link>
                          {gc.location && <p className="text-[10px] text-stone-500 flex items-center gap-1 truncate"><MapPin className="size-2.5" />{gc.location}</p>}
                          <div className="mt-0.5"><StageBadge stage={ss.stage} status={ss.status} /></div>
                        </div>
                      </div>
                      {(gc.age || gc.bmi) && (
                        <div className="flex items-center gap-2 text-[10px] text-stone-500">
                          {gc.age && <span>Age {gc.age}</span>}
                          {gc.bmi && <span>BMI {gc.bmi}</span>}
                        </div>
                      )}
                      <MilestoneStrip stageId={ss.stage} tracking={trackingMap[gc.id]} />
                      <div className="flex gap-1.5 pt-1">
                        <Button size="sm" className="gap-1 text-[11px] flex-1 h-7 px-2" style={{ backgroundColor: '#283693', color: '#fff' }}
                          onClick={() => setShareTarget({ id: gc.id, type: 'gc', name: gc.name })}>
                          <Send className="size-3" /> Share
                        </Button>
                        <Button variant="outline" size="sm" className="text-[11px] h-7 px-2" asChild>
                          <Link to={`/surrogates/${gc.id}`}>View</Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Surrogates in Matching (full card, unchanged) */}
      <div>
        <h3 className="text-sm font-semibold text-stone-500 uppercase tracking-wider mb-3 flex items-center gap-2">
          <span className="size-2 rounded-full bg-pink-500" /> Surrogates in Matching Stage ({gcsByStage.matching.length})
        </h3>
        {gcsByStage.matching.length === 0 ? (
          <p className="text-sm text-stone-400">No surrogates currently in the Matching stage.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {gcsByStage.matching.map(gc => {
              const ss = getSurrogateStageStatus(gc.id)
              const profile = profileMap[gc.id]
              const gtpal = getGTPAL(profile)
              const avatarUrl = gc.userId ? avatarUrls[gc.userId] : null
              const heightStr = gc.heightFt ? `${gc.heightFt}'${gc.heightIn || 0}"` : null
              const shares = shareHistory[gc.id] || []
              const questions = questionHistory[gc.id] || []

              return (
                <Card key={gc.id} className="rounded-2xl hover:shadow-md transition-shadow">
                  <CardContent className="p-4 space-y-3">
                    {/* Name + avatar */}
                    <div className="flex items-center gap-3">
                      <ProfileAvatar name={gc.name} avatar={avatarUrl || profile?.personal?.profilePhotoUrl} size="lg" className="ring-2 ring-white shadow" />
                      <div className="flex-1 min-w-0">
                        <Link to={`/surrogates/${gc.id}`} className="text-sm font-bold hover:text-[#283693] truncate block">{gc.name}</Link>
                        {gc.location && <p className="text-xs text-stone-500 flex items-center gap-1"><MapPin className="size-3" />{gc.location}</p>}
                        <div className="flex items-center gap-1.5 mt-1">
                          <StageBadge stage={ss.stage} status={ss.status} />
                          <span className="text-[10px] text-stone-400">{timeAgo(gc.submittedAt)}</span>
                        </div>
                      </div>
                      </div>

                    {/* Stats: Age, Height, BMI */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-lg bg-stone-50 border border-stone-100 p-2 text-center">
                        <p className="text-[9px] text-stone-400 uppercase font-semibold">Age</p>
                        <p className="text-base font-bold">{gc.age || '—'}</p>
                      </div>
                      <div className="rounded-lg bg-stone-50 border border-stone-100 p-2 text-center">
                        <p className="text-[9px] text-stone-400 uppercase font-semibold">Height</p>
                        <p className="text-base font-bold">{heightStr || '—'}</p>
                      </div>
                      <div className="rounded-lg bg-stone-50 border border-stone-100 p-2 text-center">
                        <p className="text-[9px] text-stone-400 uppercase font-semibold">BMI</p>
                        <p className="text-base font-bold">{gc.bmi || '—'}</p>
                      </div>
                    </div>

                    {/* GTPAL */}
                    {gtpal && (
                      <div className="rounded-lg bg-pink-50/50 border border-pink-100 p-2">
                        <p className="text-[9px] text-stone-400 uppercase font-semibold flex items-center gap-1"><Baby className="size-3" /> Pregnancy History</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-sm font-bold text-pink-700">{gtpal.display}</span>
                          <span className="text-[10px] text-stone-500">{gtpal.g} preg</span>
                          <span className="text-[10px] text-stone-400">|</span>
                          <span className="text-[10px] text-stone-500">{gtpal.t} term</span>
                          <span className="text-[10px] text-stone-400">|</span>
                          <span className="text-[10px] text-stone-500">{gtpal.l} living</span>
                        </div>
                      </div>
                    )}

                    {/* Marital status */}
                    <div className="flex items-center gap-3 text-xs text-stone-500">
                      <span className="flex items-center gap-1"><Heart className="size-3" />{profile?.personal?.maritalStatus || gc.maritalStatus || '—'}</span>
                    </div>

                    {/* Milestones — at-a-glance progress through the matching stage */}
                    <MilestoneStrip stageId={ss.stage} tracking={trackingMap[gc.id]} />

                    {/* Match Notes */}
                    <MatchNotesPreview
                      notes={gc.matchNotes}
                      onClick={() => setMatchNotesTarget({ id: gc.id, answers: { _matchNotes: gc.matchNotes } })}
                    />

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button size="sm" className="gap-1 text-xs flex-1" style={{ backgroundColor: '#283693', color: '#fff' }}
                        onClick={() => setShareTarget({ id: gc.id, type: 'gc', name: gc.name })}>
                        <Send className="size-3" /> Share Profile
                      </Button>
                      <Button variant="outline" size="sm" className="text-xs" asChild>
                        <Link to={`/surrogates/${gc.id}`}>View</Link>
                      </Button>
                    </div>

                    {/* Match History (expandable) */}
                    {(shares.length > 0 || questions.length > 0) && (
                      <Collapsible>
                        <CollapsibleTrigger asChild>
                          <button className="w-full flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-600 pt-1">
                            <Clock className="size-3" />
                            <span>Match History ({shares.length + questions.length})</span>
                            <ChevronDown className="size-3 ml-auto" />
                          </button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="space-y-2 mt-2 pt-2 border-t">
                            {shares.map(s => (
                              <div key={s.id} className="text-[11px] text-stone-500 space-y-0.5">
                                <div className="flex items-center gap-1.5">
                                  <Send className="size-2.5 text-stone-400" />
                                  <span>Sent to <span className="font-medium text-stone-700">{s.shared_to_email}</span></span>
                                </div>
                                <div className="flex items-center gap-3 pl-4 text-stone-400">
                                  <span>by {s.shared_by}</span>
                                  <span>{new Date(s.created_at).toLocaleDateString()}</span>
                                  {s.viewed_at && <span className="flex items-center gap-0.5 text-emerald-600"><Eye className="size-2.5" /> Viewed</span>}
                                  {new Date(s.expires_at) < new Date() && !s.viewed_at && <span className="text-red-400">Expired</span>}
                                </div>
                              </div>
                            ))}
                            {questions.map(q => (
                              <div key={`q-${q.id}`} className="text-[11px] text-stone-500 space-y-0.5">
                                <div className="flex items-center gap-1.5">
                                  <MessageSquare className="size-2.5 text-violet-400" />
                                  <span>Question from <span className="font-medium text-stone-700">{q.asker_name || q.asker_email || 'Anonymous'}</span></span>
                                </div>
                                <p className="pl-4 text-[10px] text-stone-400 italic truncate">"{q.question}"</p>
                                <div className="flex items-center gap-3 pl-4 text-stone-400">
                                  <span>{new Date(q.created_at).toLocaleDateString()}</span>
                                  {q.answer ? (
                                    <span className="text-emerald-600 flex items-center gap-0.5"><Eye className="size-2.5" /> Answered</span>
                                  ) : (
                                    <button
                                      className="text-amber-500 hover:text-emerald-600 hover:underline cursor-pointer"
                                      onClick={async () => {
                                        try {
                                          await answerMatchQuestion(q.id, 'Responded', currentUser.name)
                                          setQuestionHistory(prev => ({
                                            ...prev,
                                            [gc.id]: (prev[gc.id] || []).map(qq => qq.id === q.id ? { ...qq, answer: 'Responded', answered_by: currentUser.name } : qq)
                                          }))
                                        } catch {}
                                      }}
                                    >
                                      Pending — click to mark answered
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Intended Parents */}
      <div>
        <h3 className="text-sm font-semibold text-stone-500 uppercase tracking-wider mb-3 flex items-center gap-2">
          <span className="size-2 rounded-full bg-sky-500" /> Intended Parents ({filteredIPs.length})
        </h3>
        {filteredIPs.length === 0 ? (
          <p className="text-sm text-stone-400">No intended parents in the system.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredIPs.map(ip => (
              <Card key={ip.id} className="rounded-2xl hover:shadow-md transition-shadow">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <ProfileAvatar name={ip.names} avatar={ipAvatars[ip.id]} size="md" />
                    <div className="flex-1 min-w-0">
                      <Link to={`/intended-parents/${ip.id}`} className="text-sm font-semibold hover:text-[#283693] truncate block">{ip.names}</Link>
                      <p className="text-xs text-stone-500">{ip.type}{ip.location ? ` · ${ip.location}` : ''}</p>
                      {ip.reDoctorName && <p className="text-xs text-stone-400 flex items-center gap-1"><Stethoscope className="size-3" />{ip.reDoctorName}</p>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" className="gap-1 text-xs flex-1" style={{ backgroundColor: '#283693', color: '#fff' }}
                      onClick={() => setShareTarget({ id: ip.id, type: 'ip', name: ip.names })}>
                      <Send className="size-3" /> Share Profile
                    </Button>
                    <Button variant="outline" size="sm" className="text-xs" asChild>
                      <Link to={`/intended-parents/${ip.id}`}>View</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Share Dialog */}
      {shareTarget && (
        <ShareProfileDialog open={!!shareTarget} onOpenChange={() => setShareTarget(null)}
          caseId={shareTarget.id} caseType={shareTarget.type} caseName={shareTarget.name} currentUser={currentUser} />
      )}

      {/* Match Notes Dialog */}
      {matchNotesTarget && (
        <MatchNotesDialog
          open={!!matchNotesTarget}
          onOpenChange={() => setMatchNotesTarget(null)}
          caseId={matchNotesTarget.id}
          answers={matchNotesTarget.answers}
          currentUser={currentUser}
          onSaved={(updated) => {
            // Update local state so card refreshes
            setSurrogates(prev => prev.map(s => s.id === matchNotesTarget.id ? { ...s, matchNotes: updated._matchNotes } : s))
            setMatchNotesTarget(null)
          }}
        />
      )}

      {/* Create Match Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Create Match</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <SearchablePicker
              label="Surrogate (GC)"
              placeholder="Search surrogates..."
              value={createForm.gcId}
              options={surrogates.filter(s => !matchedGcIds.has(s.id)).map(s => ({ id: s.id, label: s.name, sub: s.location || '' }))}
              onSelect={(id) => setCreateForm(f => ({ ...f, gcId: id }))}
            />
            <SearchablePicker
              label="Intended Parent (IP)"
              placeholder="Search intended parents..."
              value={createForm.ipId}
              options={ips.filter(i => !matchedIpIds.has(i.id)).map(i => ({ id: i.id, label: i.names, sub: i.location || '' }))}
              onSelect={(id) => setCreateForm(f => ({ ...f, ipId: id }))}
            />
            <Button onClick={handleCreateMatch} disabled={creating || !createForm.gcId || !createForm.ipId}
              className="w-full gap-1.5" style={{ backgroundColor: '#283693', color: '#fff' }}>
              {creating ? 'Creating...' : 'Create Match'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Tandem Surrogacy Dialog — pick an already-matched IP, then add a
          second surrogate to them. Creates a new journey and pairs it as the
          tandem partner of the IP's existing journey. */}
      <Dialog open={showTandem} onOpenChange={(v) => !creatingTandem && setShowTandem(v)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="size-5 text-violet-600" /> Tandem Surrogacy
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-violet-50 border border-violet-200 p-3 text-xs text-stone-600">
              Pick an IP who is <strong>already matched</strong> with one surrogate, then add a second surrogate. This creates a new journey and pairs it with the IP's existing journey as a tandem. Surrogates won't see the link — admin-only.
            </div>
            <SearchablePicker
              label="Intended Parent (already matched)"
              placeholder="Search matched IPs..."
              value={tandemForm.ipId}
              options={ips.filter(i => tandemEligibleIpIds.has(i.id)).map(i => ({ id: i.id, label: i.names, sub: i.location || '' }))}
              onSelect={(id) => setTandemForm(f => ({ ...f, ipId: id }))}
            />
            <SearchablePicker
              label="Second Surrogate"
              placeholder="Search unmatched surrogates..."
              value={tandemForm.gcId}
              options={surrogates.filter(s => !matchedGcIds.has(s.id)).map(s => ({ id: s.id, label: s.name, sub: s.location || '' }))}
              onSelect={(id) => setTandemForm(f => ({ ...f, gcId: id }))}
            />
            <Button onClick={handleCreateTandem} disabled={creatingTandem || !tandemForm.gcId || !tandemForm.ipId}
              className="w-full gap-1.5" style={{ backgroundColor: '#283693', color: '#fff' }}>
              {creatingTandem ? 'Creating tandem...' : 'Create Tandem Match'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
