import { useState, useEffect } from 'react'
import { useRole } from '@/context/RoleContext'
import PageHeader from '@/components/shared/PageHeader'
import { fetchSurrogatesFromIntake, fetchSurrogateProfilesByEmails, getRecordTrackingBatch } from '@/lib/db'
import { getSurrogateStageStatus } from '@/lib/stageStatusStore'
import { getAllChecklistSteps } from '@/lib/checklistStore'
import { SURROGATE_STAGES } from '@/lib/constants'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Circle, FileWarning, ScrollText } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

const SCREENING_STAGES = ['pre-qualification', 'screening', 'matching']

export default function CaseUpdatesPage() {
  const { currentUser } = useRole()
  const [surrogates, setSurrogates] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSurrogatesFromIntake().then(data => {
      setSurrogates(data || [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-6 text-center text-stone-400">Loading...</div>

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <PageHeader title="Case Updates" subtitle="Surrogate screening overview and case status tracking" />
      {surrogates.length > 0 && <SurrogateScreeningSheet surrogates={surrogates} />}
    </div>
  )
}

// ── Surrogate Screening Sheet (moved from AdminDashboard) ──
function SurrogateScreeningSheet({ surrogates }) {
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

  const [allProfiles, setAllProfiles] = useState({})
  useEffect(() => {
    const emails = filtered.map(s => s.email).filter(Boolean)
    if (emails.length === 0) { setAllProfiles({}); return }
    fetchSurrogateProfilesByEmails(emails).then(map => {
      const byId = {}
      for (const s of filtered) {
        if (s.email && map[s.email.trim().toLowerCase()]) {
          byId[s.id] = map[s.email.trim().toLowerCase()]
        }
      }
      setAllProfiles(byId)
    }).catch(() => {})
  }, [filtered])

  return (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold text-[#283693] mb-1">Surrogate Screening Overview</h3>
        <p className="text-sm text-stone-400 mb-4">Click a stage to filter surrogates</p>

        {/* Stage filter pills */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-6">
          {SCREENING_STAGES.map(stageId => {
            const stage = SURROGATE_STAGES.find(s => s.id === stageId)
            if (!stage) return null
            const active = stageFilter === stageId
            return (
              <button key={stageId} onClick={() => setStageFilter(stageId)}
                className={`rounded-xl border-2 py-3 text-center transition-all ${active ? 'shadow-md scale-[1.03]' : 'hover:shadow-sm hover:scale-[1.01]'}`}
                style={{ borderColor: active ? stage.color : '#e7e5e4', backgroundColor: active ? stage.color + '08' : 'transparent' }}>
                <p className="text-2xl font-bold" style={{ color: stage.color }}>{stageCounts[stageId] || 0}</p>
                <p className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold">{stage.label}</p>
              </button>
            )
          })}
        </div>

        {/* Spreadsheet */}
        {filtered.length === 0 ? (
          <p className="text-sm text-stone-400 text-center py-8">No surrogates in this stage</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
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
                          {status === 'complete' ? (
                            <span className="text-green-600 font-medium flex items-center gap-1"><CheckCircle2 className="size-3" /> Done</span>
                          ) : status === 'in_progress' ? (
                            <span className="text-amber-500 font-medium flex items-center gap-1"><Circle className="size-3" /> In Progress</span>
                          ) : status === 'na' ? (
                            <span className="text-stone-300">N/A</span>
                          ) : (
                            <span className="text-stone-300">Not Started</span>
                          )}
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
