import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ClipboardList, Search, Clock, CheckCircle2, FileText } from 'lucide-react'
import PageHeader from '@/components/shared/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import ProfileAvatar from '@/components/shared/ProfileAvatar'
import { fetchSurrogatesFromIntake, getRecordTrackingBatch } from '@/lib/db'
import { getAllChecklistSteps } from '@/lib/checklistStore'
import { formatDate } from '@/lib/utils'

export default function RecordsSummaryPage() {
  const [surrogates, setSurrogates] = useState([])
  const [trackingMap, setTrackingMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchSurrogatesFromIntake().then(async (gcs) => {
      setSurrogates(gcs || [])
      // Load tracking for all surrogates to find "Records Summary" = "Requested"
      if (gcs?.length > 0) {
        const ids = gcs.map(s => s.id)
        const batch = await getRecordTrackingBatch(ids, 'gc').catch(() => ({}))
        setTrackingMap(batch || {})
      }
    }).catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Find the "Records Summary" checklist step
  const screeningSteps = getAllChecklistSteps('gc', 'screening')
  const recordsSummaryStep = screeningSteps.find(s =>
    s.label?.toLowerCase().includes('records summary') || s.label?.toLowerCase().includes('record summary')
  )

  // Build rows: surrogates where Records Summary step = requested/in_progress
  const rows = surrogates.map(s => {
    const tracking = trackingMap[s.id] || {}
    const stepData = recordsSummaryStep ? tracking[recordsSummaryStep.id] : null
    const status = stepData?.status || 'not_started'
    const history = stepData?.history || []
    const requestedEntry = history.find(h => h.status === 'requested' || h.status === 'in_progress')
    return {
      ...s,
      summaryStatus: status,
      requestedDate: requestedEntry?.date || null,
      requestedBy: requestedEntry?.by || null,
    }
  }).filter(r => {
    // Show requested, in_progress, and complete
    return ['requested', 'in_progress', 'complete', 'partial_complete'].includes(r.summaryStatus)
  })

  const filtered = rows.filter(r => {
    if (!search) return true
    const q = search.toLowerCase()
    return r.name.toLowerCase().includes(q) || (r.email && r.email.toLowerCase().includes(q))
  })

  const pending = filtered.filter(r => r.summaryStatus === 'requested' || r.summaryStatus === 'in_progress')
  const completed = filtered.filter(r => r.summaryStatus === 'complete' || r.summaryStatus === 'partial_complete')

  if (loading) return <div className="p-8 text-center text-stone-400">Loading...</div>

  return (
    <div className="space-y-6">
      <PageHeader
        title="Records Summary"
        subtitle={`${pending.length} pending · ${completed.length} completed`}
      />

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
        <Input placeholder="Search surrogate..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {/* Pending */}
      {pending.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-stone-500 uppercase">Pending Review ({pending.length})</p>
          {pending.map(row => (
            <Link key={row.id} to={`/records-summary/${row.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="py-3 px-4 flex items-center gap-4">
                  <ProfileAvatar name={row.name} size="md" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-stone-800">{row.name}</p>
                    <p className="text-xs text-stone-400">{row.email}</p>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50 gap-1">
                      <Clock className="size-3" /> {row.summaryStatus === 'in_progress' ? 'In Progress' : 'Requested'}
                    </Badge>
                    {row.requestedDate && (
                      <p className="text-[10px] text-stone-400 mt-1">Requested {formatDate(row.requestedDate)}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Completed */}
      {completed.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-stone-500 uppercase">Completed ({completed.length})</p>
          {completed.map(row => (
            <Link key={row.id} to={`/records-summary/${row.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer opacity-70">
                <CardContent className="py-3 px-4 flex items-center gap-4">
                  <ProfileAvatar name={row.name} size="md" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-stone-800">{row.name}</p>
                    <p className="text-xs text-stone-400">{row.email}</p>
                  </div>
                  <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50 gap-1">
                    <CheckCircle2 className="size-3" /> Complete
                  </Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {filtered.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center">
            <FileText className="size-10 text-stone-300 mx-auto mb-3" />
            <p className="text-stone-500 font-medium">No records summary requests</p>
            <p className="text-stone-400 text-sm mt-1">Surrogates will appear here when their "Records Summary" checklist step is marked as Requested.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
