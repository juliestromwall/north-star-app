import { useState, useEffect, useMemo } from 'react'
import { useRole } from '@/context/RoleContext'
import PageHeader from '@/components/shared/PageHeader'
import { fetchSurrogatesFromIntake, fetchIPsFromIntake, fetchSurrogateProfilesByEmails, getRecordTrackingBatch } from '@/lib/db'
import { fetchMatchedJourneys } from '@/lib/matching'
import { getSurrogateStageStatus } from '@/lib/stageStatusStore'
import { getAllChecklistSteps, getChecklistMilestones } from '@/lib/checklistStore'
import { SURROGATE_STAGES } from '@/lib/constants'
import { Link } from 'react-router-dom'
import { CheckCircle2, Circle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { formatDate } from '@/lib/utils'
import StageBadge from '@/components/shared/StageBadge'
import ProfileAvatar from '@/components/shared/ProfileAvatar'

const SCREENING_STAGES = ['pre-qualification', 'screening', 'matching']
const JOURNEY_STAGE_IDS = ['journey-oversight', 'journey-ending', 'journey-closed']

export default function CaseUpdatesPage() {
  const [surrogates, setSurrogates] = useState([])
  const [ips, setIps] = useState([])
  const [journeys, setJourneys] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([fetchSurrogatesFromIntake(), fetchIPsFromIntake(), fetchMatchedJourneys()])
      .then(([gcs, allIps, js]) => {
        setSurrogates(gcs || [])
        setIps(allIps || [])
        setJourneys(js || [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-6 text-center text-stone-400">Loading...</div>

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <PageHeader title="Case Updates" subtitle="Track screening progress and case status across all case types" />

      <Tabs defaultValue="surrogates">
        <TabsList>
          <TabsTrigger value="surrogates">Surrogates</TabsTrigger>
          <TabsTrigger value="ips">Intended Parents</TabsTrigger>
          <TabsTrigger value="journeys">Matched Journeys</TabsTrigger>
        </TabsList>

        <TabsContent value="surrogates" className="mt-4">
          <SurrogateUpdatesSheet surrogates={surrogates} />
        </TabsContent>

        <TabsContent value="ips" className="mt-4">
          <IPUpdatesSheet ips={ips} />
        </TabsContent>

        <TabsContent value="journeys" className="mt-4">
          <JourneyUpdatesSheet journeys={journeys} surrogates={surrogates} ips={ips} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ── Surrogate Updates ──
function SurrogateUpdatesSheet({ surrogates }) {
  const [stageFilter, setStageFilter] = useState('pre-qualification')
  const sheetRows = useMemo(() => getAllChecklistSteps('gc').filter(s => s.stageId === stageFilter), [stageFilter])

  const allStageStatuses = useMemo(() => {
    const map = {}
    for (const s of surrogates) map[s.id] = getSurrogateStageStatus(s.id)
    return map
  }, [surrogates])

  const stageCounts = useMemo(() => {
    const counts = {}
    for (const stage of SURROGATE_STAGES) counts[stage.id] = 0
    for (const s of surrogates) {
      const stageId = allStageStatuses[s.id]?.stage || 'pre-qualification'
      if (counts[stageId] !== undefined) counts[stageId]++
    }
    return counts
  }, [surrogates, allStageStatuses])

  const filtered = useMemo(() => {
    return surrogates.filter(s => (allStageStatuses[s.id]?.stage || 'pre-qualification') === stageFilter)
  }, [surrogates, stageFilter, allStageStatuses])

  const [allTracking, setAllTracking] = useState({})
  useEffect(() => {
    const ids = filtered.map(s => s.id)
    if (ids.length === 0) { setAllTracking({}); return }
    getRecordTrackingBatch(ids).then(setAllTracking).catch(() => setAllTracking({}))
  }, [filtered])

  return (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold text-[#283693] mb-1">Surrogate Updates</h3>
        <p className="text-sm text-stone-400 mb-4">Click a stage to filter surrogates</p>

        <div className="flex flex-wrap gap-2 mb-6">
          {SCREENING_STAGES.map(stageId => {
            const stage = SURROGATE_STAGES.find(s => s.id === stageId)
            if (!stage) return null
            const active = stageFilter === stageId
            return (
              <button key={stageId} onClick={() => setStageFilter(stageId)}
                className={`rounded-xl border-2 py-3 px-6 text-center transition-all ${active ? 'shadow-md scale-[1.03]' : 'hover:shadow-sm hover:scale-[1.01]'}`}
                style={{ borderColor: active ? stage.color : '#e7e5e4', backgroundColor: active ? stage.color + '08' : 'transparent' }}>
                <p className="text-2xl font-bold" style={{ color: stage.color }}>{stageCounts[stageId] || 0}</p>
                <p className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold">{stage.label}</p>
              </button>
            )
          })}
        </div>

        {filtered.length === 0 ? (
          <p className="text-sm text-stone-400 py-8">No surrogates in this stage</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="text-xs border-collapse">
              <thead>
                <tr className="border-b border-stone-200">
                  <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider sticky left-0 bg-white z-10 min-w-[120px]">
                    Screening Step
                  </th>
                  {filtered.map(s => (
                    <th key={s.id} className="text-left px-3 py-2.5 min-w-[130px]">
                      <Link to={`/surrogates/${s.id}`} className="text-[#283693] hover:underline font-semibold text-xs">{s.name}</Link>
                      <p className="text-[9px] text-stone-400 font-normal">
                        {s.location ? `◎ ${s.location.split(', ').pop()}` : ''}
                        {s.age ? ` · ${s.age}y` : ''}
                      </p>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sheetRows.map(step => (
                  <tr key={step.id} className="border-b border-stone-50 hover:bg-stone-50/50">
                    <td className="px-3 py-2.5 font-medium text-stone-700 sticky left-0 bg-white z-10">{step.label}</td>
                    {filtered.map(s => {
                      const rt = allTracking[s.id] || {}
                      const d = rt[step.id] || {}
                      const status = d.status || 'not_started'
                      return (
                        <td key={s.id} className="px-3 py-2.5">
                          <StatusCell status={status} />
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── IP Updates ──
function IPUpdatesSheet({ ips }) {
  const [stageFilter, setStageFilter] = useState('pre-qualification')
  const sheetRows = useMemo(() => getAllChecklistSteps('ip').filter(s => s.stageId === stageFilter), [stageFilter])

  const allStageStatuses = useMemo(() => {
    const map = {}
    for (const ip of ips) map[ip.id] = getSurrogateStageStatus(ip.id)
    return map
  }, [ips])

  const stageCounts = useMemo(() => {
    const counts = {}
    for (const stage of SURROGATE_STAGES) counts[stage.id] = 0
    for (const ip of ips) {
      const stageId = allStageStatuses[ip.id]?.stage || 'pre-qualification'
      if (counts[stageId] !== undefined) counts[stageId]++
    }
    return counts
  }, [ips, allStageStatuses])

  const filtered = useMemo(() => {
    return ips.filter(ip => (allStageStatuses[ip.id]?.stage || 'pre-qualification') === stageFilter)
  }, [ips, stageFilter, allStageStatuses])

  const [allTracking, setAllTracking] = useState({})
  useEffect(() => {
    const ids = filtered.map(ip => ip.id)
    if (ids.length === 0) { setAllTracking({}); return }
    getRecordTrackingBatch(ids).then(setAllTracking).catch(() => setAllTracking({}))
  }, [filtered])

  return (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold text-[#283693] mb-1">Intended Parent Updates</h3>
        <p className="text-sm text-stone-400 mb-4">Click a stage to filter intended parents</p>

        <div className="flex flex-wrap gap-2 mb-6">
          {SCREENING_STAGES.map(stageId => {
            const stage = SURROGATE_STAGES.find(s => s.id === stageId)
            if (!stage) return null
            const active = stageFilter === stageId
            return (
              <button key={stageId} onClick={() => setStageFilter(stageId)}
                className={`rounded-xl border-2 py-3 px-6 text-center transition-all ${active ? 'shadow-md scale-[1.03]' : 'hover:shadow-sm hover:scale-[1.01]'}`}
                style={{ borderColor: active ? stage.color : '#e7e5e4', backgroundColor: active ? stage.color + '08' : 'transparent' }}>
                <p className="text-2xl font-bold" style={{ color: stage.color }}>{stageCounts[stageId] || 0}</p>
                <p className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold">{stage.label}</p>
              </button>
            )
          })}
        </div>

        {filtered.length === 0 ? (
          <p className="text-sm text-stone-400 py-8">No intended parents in this stage</p>
        ) : sheetRows.length === 0 ? (
          <p className="text-sm text-stone-400 py-8">No checklist steps configured for this stage. Set them up in Settings → Checklists → Intended Parent (IP).</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="text-xs border-collapse">
              <thead>
                <tr className="border-b border-stone-200">
                  <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider sticky left-0 bg-white z-10 min-w-[120px]">
                    Checklist Step
                  </th>
                  {filtered.map(ip => (
                    <th key={ip.id} className="text-left px-3 py-2.5 min-w-[130px]">
                      <Link to={`/intended-parents/${ip.id}`} className="text-[#283693] hover:underline font-semibold text-xs">{ip.names}</Link>
                      <p className="text-[9px] text-stone-400 font-normal">{ip.location || ''}</p>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sheetRows.map(step => (
                  <tr key={step.id} className="border-b border-stone-50 hover:bg-stone-50/50">
                    <td className="px-3 py-2.5 font-medium text-stone-700 sticky left-0 bg-white z-10">{step.label}</td>
                    {filtered.map(ip => {
                      const rt = allTracking[ip.id] || {}
                      const d = rt[step.id] || {}
                      const status = d.status || 'not_started'
                      return (
                        <td key={ip.id} className="px-3 py-2.5">
                          <StatusCell status={status} />
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Journey Updates ──
function JourneyUpdatesSheet({ journeys, surrogates, ips }) {
  const [stageFilter, setStageFilter] = useState('journey-oversight')
  // Journey checklist steps are stored under 'gc' type with journey stage IDs
  const sheetRows = useMemo(() => getAllChecklistSteps('gc').filter(s => s.stageId === stageFilter), [stageFilter])

  const stageCounts = useMemo(() => {
    const counts = {}
    for (const id of JOURNEY_STAGE_IDS) counts[id] = 0
    for (const j of journeys) { if (counts[j.stage] !== undefined) counts[j.stage]++ }
    return counts
  }, [journeys])

  const filtered = useMemo(() => {
    return journeys.filter(j => j.stage === stageFilter)
  }, [journeys, stageFilter])

  // Load checklist tracking from journey_data for each journey
  const allTracking = useMemo(() => {
    const map = {}
    for (const j of filtered) {
      map[j.id] = j.journey_data?._checklistTracking || {}
    }
    return map
  }, [filtered])

  return (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold text-[#283693] mb-1">Matched Journey Updates</h3>
        <p className="text-sm text-stone-400 mb-4">Click a stage to filter journeys</p>

        <div className="flex flex-wrap gap-2 mb-6">
          {JOURNEY_STAGE_IDS.map(stageId => {
            const stage = SURROGATE_STAGES.find(s => s.id === stageId)
            if (!stage) return null
            const active = stageFilter === stageId
            return (
              <button key={stageId} onClick={() => setStageFilter(stageId)}
                className={`rounded-xl border-2 py-3 px-6 text-center transition-all ${active ? 'shadow-md scale-[1.03]' : 'hover:shadow-sm hover:scale-[1.01]'}`}
                style={{ borderColor: active ? stage.color : '#e7e5e4', backgroundColor: active ? stage.color + '08' : 'transparent' }}>
                <p className="text-2xl font-bold" style={{ color: stage.color }}>{stageCounts[stageId] || 0}</p>
                <p className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold">{stage.label}</p>
              </button>
            )
          })}
        </div>

        {filtered.length === 0 ? (
          <p className="text-sm text-stone-400 py-8">No journeys in this stage</p>
        ) : sheetRows.length === 0 ? (
          <p className="text-sm text-stone-400 py-8">No checklist steps configured for this stage. Set them up in Settings → Checklists → Matched Journeys.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="text-xs border-collapse">
              <thead>
                <tr className="border-b border-stone-200">
                  <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider sticky left-0 bg-white z-10 min-w-[150px]">
                    Checklist Step
                  </th>
                  {filtered.map(j => {
                    const ip = ips.find(i => i.id === j.ip_case_id)
                    const gc = surrogates.find(s => s.id === j.gc_case_id)
                    return (
                      <th key={j.id} className="text-left px-3 py-2.5 min-w-[150px]">
                        <Link to={`/journeys/${j.id}`} className="hover:underline">
                          <p className="text-xs font-semibold text-[#283693]">{ip?.names || 'IP'}</p>
                          <p className="text-[9px] text-stone-400 font-normal">+ {gc?.name || 'GC'}</p>
                        </Link>
                        <p className="text-[9px] text-stone-400 font-normal mt-0.5">{j.status || ''}</p>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {sheetRows.map(step => (
                  <tr key={step.id} className="border-b border-stone-50 hover:bg-stone-50/50">
                    <td className="px-3 py-2.5 font-medium text-stone-700 sticky left-0 bg-white z-10">{step.label}</td>
                    {filtered.map(j => {
                      const rt = allTracking[j.id] || {}
                      const d = rt[step.id] || {}
                      const status = d.status || 'not_started'
                      return (
                        <td key={j.id} className="px-3 py-2.5">
                          <StatusCell status={status} />
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Shared Status Cell ──
function StatusCell({ status }) {
  if (status === 'complete') return <span className="text-green-600 font-medium flex items-center gap-1"><CheckCircle2 className="size-3" /> Done</span>
  if (status === 'in_progress') return <span className="text-amber-500 font-medium flex items-center gap-1"><Circle className="size-3" /> In Progress</span>
  if (status === 'na') return <span className="text-stone-300">N/A</span>
  return <span className="text-stone-300">Not Started</span>
}
