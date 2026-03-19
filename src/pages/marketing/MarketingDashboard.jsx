import { useState, useMemo, useEffect } from 'react'
import { TrendingUp, Users, CheckCircle, XCircle, BarChart3, Heart, Download, Filter } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import PageHeader from '@/components/shared/PageHeader'
import { mockIntakeSubmissions, DQ_REASON_LABELS, getSourceLabel } from '@/data/mock/intakeSubmissions'
import { fetchIntakeSubmissions } from '@/lib/db'

const SOURCE_COLORS = {
  instagram: '#E1306C',
  tiktok: '#010101',
  facebook: '#1877F2',
  google: '#4285F4',
  referral: '#10B981',
  direct: '#6B7280',
}

function defaultStart() {
  return '2026-01-01'
}

function StatCard({ icon: Icon, label, value, sub, color = 'stone' }) {
  const colorMap = {
    stone: 'text-stone-600 bg-stone-100',
    emerald: 'text-emerald-600 bg-emerald-100',
    red: 'text-red-500 bg-red-100',
    blue: 'text-blue-600 bg-blue-100',
    coral: 'text-white bg-abc-coral',
  }
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardDescription>{label}</CardDescription>
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colorMap[color]}`}>
            <Icon className="w-4 h-4" />
          </div>
        </div>
        <CardTitle className="text-3xl font-bold">{value}</CardTitle>
      </CardHeader>
      {sub && <CardContent className="pt-0"><p className="text-xs text-stone-400">{sub}</p></CardContent>}
    </Card>
  )
}

function SourceBarChart({ data, maxVal }) {
  return (
    <div className="space-y-3">
      {data.map(({ source, count, dqCount }) => {
        const pct = maxVal > 0 ? (count / maxVal) * 100 : 0
        const color = SOURCE_COLORS[source] || '#9CA3AF'
        return (
          <div key={source}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-stone-700">{getSourceLabel(source)}</span>
              <span className="text-sm text-stone-500">{count} submission{count !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-5 bg-stone-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, backgroundColor: color }}
                />
              </div>
              <span className="text-xs text-stone-400 w-16 text-right">
                {count > 0 ? Math.round(((count - dqCount) / count) * 100) : 0}% qual
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function VolumeChart({ data }) {
  if (data.length === 0) return <p className="text-sm text-stone-400 py-4 text-center">No submissions in this period.</p>

  const maxVal = Math.max(...data.map(d => d.count), 1)
  const chartH = 160
  const barW = Math.max(16, Math.min(40, 600 / data.length))
  const gap = Math.max(2, Math.min(6, 200 / data.length))
  const svgW = data.length * (barW + gap)

  return (
    <div className="overflow-x-auto">
      <svg width={Math.max(svgW, 300)} height={chartH + 40} className="w-full" viewBox={`0 0 ${Math.max(svgW, 300)} ${chartH + 40}`} preserveAspectRatio="xMinYEnd meet">
        {data.map((d, i) => {
          const h = (d.count / maxVal) * chartH
          const x = i * (barW + gap) + gap
          const y = chartH - h
          const qualH = d.qualifiedCount > 0 ? (d.qualifiedCount / maxVal) * chartH : 0
          return (
            <g key={d.label}>
              {/* DQ portion (full bar) */}
              <rect x={x} y={y} width={barW} height={h} rx={3} fill="#e7e5e4" />
              {/* Qualified portion (overlaid from bottom) */}
              <rect x={x} y={chartH - qualH} width={barW} height={qualH} rx={3} fill="#283693" opacity={0.8} />
              <title>{d.label}: {d.count} submissions, {d.qualifiedCount} qualified</title>
              {/* Count label above bar */}
              {d.count > 0 && (
                <text x={x + barW / 2} y={y - 4} textAnchor="middle" className="text-[10px] fill-stone-500">{d.count}</text>
              )}
              {/* Date label */}
              {(data.length <= 14 || i % Math.ceil(data.length / 14) === 0) && (
                <text x={x + barW / 2} y={chartH + 16} textAnchor="middle" className="text-[9px] fill-stone-400">
                  {d.shortLabel}
                </text>
              )}
            </g>
          )
        })}
        {/* Baseline */}
        <line x1={0} y1={chartH} x2={Math.max(svgW, 300)} y2={chartH} stroke="#e7e5e4" strokeWidth={1} />
      </svg>
      <div className="flex items-center gap-4 mt-2 justify-end">
        <span className="flex items-center gap-1.5 text-[10px] text-stone-400"><span className="w-2.5 h-2.5 rounded-sm bg-[#283693] opacity-80" /> Qualified</span>
        <span className="flex items-center gap-1.5 text-[10px] text-stone-400"><span className="w-2.5 h-2.5 rounded-sm bg-stone-300" /> Disqualified</span>
      </div>
    </div>
  )
}

function privacyName(sub) {
  if (sub.type === 'gc') {
    return `${sub.answers.firstName} ${sub.answers.lastName?.charAt(0) || ''}.`
  }
  return `${sub.answers.primaryFirstName} ${sub.answers.primaryLastName?.charAt(0) || ''}.`
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function MarketingDashboard() {
  const [startDate, setStartDate] = useState(defaultStart)
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [allSubmissions, setAllSubmissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [campSourceFilter, setCampSourceFilter] = useState('all')
  const [campCampaignFilter, setCampCampaignFilter] = useState('all')
  const [campContentFilter, setCampContentFilter] = useState('all')

  useEffect(() => {
    fetchIntakeSubmissions()
      .then(data => setAllSubmissions(data || []))
      .catch(() => setAllSubmissions([]))
      .finally(() => setLoading(false))
  }, [])

  function setPreset(days) {
    const end = new Date()
    setEndDate(end.toISOString().slice(0, 10))
    if (days === 9999) {
      setStartDate('2020-01-01')
    } else {
      const start = new Date()
      start.setDate(start.getDate() - days)
      setStartDate(start.toISOString().slice(0, 10))
    }
  }

  const filtered = useMemo(() => {
    const start = new Date(startDate + 'T00:00:00')
    const end = new Date(endDate + 'T23:59:59')
    return allSubmissions.filter(s => {
      const d = new Date(s.submittedAt)
      return d >= start && d <= end
    })
  }, [startDate, endDate, allSubmissions])

  const total = filtered.length
  const qualified = filtered.filter(s => ['qualified', 'approved'].includes(s.status)).length
  const disqualified = filtered.filter(s => s.status === 'disqualified').length
  const conversionRate = total > 0 ? Math.round((qualified / total) * 100) : 0
  const gcCount = filtered.filter(s => s.type === 'gc').length
  const ipCount = filtered.filter(s => s.type === 'ip').length

  // By source
  const sourceMap = {}
  filtered.forEach(s => {
    const src = s.tracking.resolvedSource || 'direct'
    if (!sourceMap[src]) sourceMap[src] = { source: src, count: 0, dqCount: 0 }
    sourceMap[src].count++
    if (s.status === 'disqualified') sourceMap[src].dqCount++
  })
  const bySource = Object.values(sourceMap).sort((a, b) => b.count - a.count)
  const maxSourceCount = bySource.length > 0 ? bySource[0].count : 1

  // By campaign
  const campaignMap = {}
  filtered.forEach(s => {
    const campaign = s.tracking.utm_campaign || '(no campaign)'
    const src = s.tracking.resolvedSource || 'direct'
    const content = s.tracking.utm_content || null
    const key = `${src}::${campaign}`
    if (!campaignMap[key]) campaignMap[key] = { source: src, campaign, contents: {}, count: 0, qualifiedCount: 0 }
    campaignMap[key].count++
    if (['qualified', 'approved'].includes(s.status)) campaignMap[key].qualifiedCount++
    if (content) {
      if (!campaignMap[key].contents[content]) campaignMap[key].contents[content] = { count: 0, qualifiedCount: 0 }
      campaignMap[key].contents[content].count++
      if (['qualified', 'approved'].includes(s.status)) campaignMap[key].contents[content].qualifiedCount++
    }
  })
  const byCampaign = Object.values(campaignMap).sort((a, b) => b.count - a.count)

  // Unique values for campaign filters
  const campSources = [...new Set(byCampaign.map(c => c.source))]
  const campCampaigns = [...new Set(byCampaign.map(c => c.campaign))]
  const campContents = [...new Set(byCampaign.flatMap(c => Object.keys(c.contents)))].filter(Boolean)

  // Filtered campaigns
  const filteredCampaigns = byCampaign.filter(c => {
    if (campSourceFilter !== 'all' && c.source !== campSourceFilter) return false
    if (campCampaignFilter !== 'all' && c.campaign !== campCampaignFilter) return false
    if (campContentFilter !== 'all' && !c.contents[campContentFilter]) return false
    return true
  })

  // Volume over time
  const volumeData = useMemo(() => {
    const start = new Date(startDate)
    const end = new Date(endDate)
    const rangeDays = Math.round((end - start) / 86400000)
    const byWeek = rangeDays > 60

    const buckets = {}
    filtered.forEach(s => {
      const d = new Date(s.submittedAt)
      let key
      if (byWeek) {
        const day = new Date(d)
        day.setDate(day.getDate() - ((day.getDay() + 6) % 7))
        key = day.toISOString().slice(0, 10)
      } else {
        key = d.toISOString().slice(0, 10)
      }
      if (!buckets[key]) buckets[key] = { count: 0, qualifiedCount: 0 }
      buckets[key].count++
      if (['qualified', 'approved'].includes(s.status)) buckets[key].qualifiedCount++
    })

    return Object.entries(buckets)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, data]) => ({
        label: date,
        shortLabel: new Date(date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        count: data.count,
        qualifiedCount: data.qualifiedCount,
      }))
  }, [filtered, startDate, endDate])

  // Device / browser / OS breakdown
  const deviceMap = {}
  const browserMap = {}
  const osMap = {}
  const timezoneMap = {}
  const completionTimes = []
  filtered.forEach(s => {
    const t = s.tracking || {}
    if (t.device) deviceMap[t.device] = (deviceMap[t.device] || 0) + 1
    if (t.browser) browserMap[t.browser] = (browserMap[t.browser] || 0) + 1
    if (t.os) osMap[t.os] = (osMap[t.os] || 0) + 1
    if (t.timezone) timezoneMap[t.timezone] = (timezoneMap[t.timezone] || 0) + 1
    if (t.timeToCompleteSeconds && t.timeToCompleteSeconds > 0) completionTimes.push(t.timeToCompleteSeconds)
  })
  const byDevice = Object.entries(deviceMap).sort((a, b) => b[1] - a[1])
  const byBrowser = Object.entries(browserMap).sort((a, b) => b[1] - a[1])
  const byOS = Object.entries(osMap).sort((a, b) => b[1] - a[1])
  const byTimezone = Object.entries(timezoneMap).sort((a, b) => b[1] - a[1])
  const avgCompletionTime = completionTimes.length > 0 ? Math.round(completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length) : 0
  const medianCompletionTime = completionTimes.length > 0 ? completionTimes.sort((a, b) => a - b)[Math.floor(completionTimes.length / 2)] : 0

  // State breakdown
  const stateMap = {}
  filtered.forEach(s => {
    const st = s.stateRegion || s.answers?.state || s.answers?.stateProv || null
    if (st) {
      stateMap[st] = (stateMap[st] || { count: 0, qualifiedCount: 0 })
      stateMap[st].count++
      if (['qualified', 'approved'].includes(s.status)) stateMap[st].qualifiedCount++
    }
  })
  const byState = Object.entries(stateMap).sort((a, b) => b[1].count - a[1].count)

  // DQ reason breakdown
  const dqMap = {}
  filtered.forEach(s => {
    s.dqReasons.forEach(r => {
      dqMap[r] = (dqMap[r] || 0) + 1
    })
  })
  const dqBreakdown = Object.entries(dqMap).sort((a, b) => b[1] - a[1])

  // GC vs IP qualified
  const gcQualified = filtered.filter(s => s.type === 'gc' && ['qualified', 'approved'].includes(s.status)).length
  const ipQualified = filtered.filter(s => s.type === 'ip' && ['qualified', 'approved'].includes(s.status)).length

  // Recent submissions (privacy-safe)
  const recent = [...filtered]
    .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))
    .slice(0, 10)

  // CSV export
  function handleExportCSV() {
    const headers = ['ID', 'Type', 'Date', 'Status', 'Source', 'Campaign', 'Ad Content', 'Qualified', 'DQ Reasons', 'Conv. Rate']
    const rows = filtered.map(s => [
      s.id,
      s.type === 'gc' ? 'Surrogate' : 'Intended Parent',
      s.submittedAt,
      s.status,
      s.tracking.resolvedSource || 'direct',
      s.tracking.utm_campaign || '',
      s.tracking.utm_content || '',
      ['qualified', 'approved'].includes(s.status) ? 'Yes' : 'No',
      s.dqReasons.join('; '),
      '',
    ])
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `abc-submissions-${startDate}-to-${endDate}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Header with date range + export */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <PageHeader
          title="Marketing Analytics"
          subtitle="Intake form performance, source attribution, and conversion tracking"
        />
        <div className="flex flex-col items-end gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="h-8 text-xs w-36"
            />
            <span className="text-xs text-stone-400">to</span>
            <Input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="h-8 text-xs w-36"
            />
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={handleExportCSV}>
              <Download className="w-3.5 h-3.5" />
              Export
            </Button>
          </div>
          <div className="flex gap-1">
            {[
              { label: '30d', days: 30 },
              { label: '60d', days: 60 },
              { label: '90d', days: 90 },
              { label: 'All', days: 9999 },
            ].map(opt => (
              <button
                key={opt.days}
                onClick={() => setPreset(opt.days)}
                className="text-[11px] px-2 py-1 rounded font-medium text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors"
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={BarChart3} label="Total Submissions" value={total} sub={`${gcCount} surrogates · ${ipCount} IPs`} color="stone" />
        <StatCard icon={CheckCircle} label="Qualified" value={qualified} sub={`${conversionRate}% conversion rate`} color="emerald" />
        <StatCard icon={XCircle} label="Disqualified" value={disqualified} sub={total > 0 ? `${Math.round((disqualified / total) * 100)}% of submissions` : ''} color="red" />
        <StatCard icon={TrendingUp} label="Conversion Rate" value={`${conversionRate}%`} sub="Qualified ÷ total submissions" color="blue" />
      </div>

      {/* Submission volume over time */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Submission Volume</CardTitle>
          <CardDescription>Submissions over time — hover bars for details</CardDescription>
        </CardHeader>
        <CardContent>
          <VolumeChart data={volumeData} />
        </CardContent>
      </Card>

      {/* Device, Browser, Audience & Completion Time */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Device */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Device</CardTitle>
          </CardHeader>
          <CardContent>
            {byDevice.length === 0 ? <p className="text-xs text-stone-400">No data yet</p> : (
              <div className="space-y-2">
                {byDevice.map(([name, count]) => (
                  <div key={name} className="flex items-center justify-between">
                    <span className="text-sm text-stone-600">{name}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 bg-stone-100 rounded-full overflow-hidden">
                        <div className="h-full bg-[#283693] rounded-full" style={{ width: `${total > 0 ? (count / total) * 100 : 0}%` }} />
                      </div>
                      <span className="text-xs text-stone-500 w-8 text-right">{total > 0 ? Math.round((count / total) * 100) : 0}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Browser */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Browser</CardTitle>
          </CardHeader>
          <CardContent>
            {byBrowser.length === 0 ? <p className="text-xs text-stone-400">No data yet</p> : (
              <div className="space-y-2">
                {byBrowser.map(([name, count]) => (
                  <div key={name} className="flex items-center justify-between">
                    <span className="text-sm text-stone-600">{name}</span>
                    <span className="text-xs text-stone-500">{count} ({total > 0 ? Math.round((count / total) * 100) : 0}%)</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* OS */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Operating System</CardTitle>
          </CardHeader>
          <CardContent>
            {byOS.length === 0 ? <p className="text-xs text-stone-400">No data yet</p> : (
              <div className="space-y-2">
                {byOS.map(([name, count]) => (
                  <div key={name} className="flex items-center justify-between">
                    <span className="text-sm text-stone-600">{name}</span>
                    <span className="text-xs text-stone-500">{count} ({total > 0 ? Math.round((count / total) * 100) : 0}%)</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Completion Time */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Quiz Completion Time</CardTitle>
          </CardHeader>
          <CardContent>
            {completionTimes.length === 0 ? <p className="text-xs text-stone-400">No data yet</p> : (
              <div className="space-y-3">
                <div>
                  <p className="text-2xl font-bold text-stone-800">{Math.floor(avgCompletionTime / 60)}m {avgCompletionTime % 60}s</p>
                  <p className="text-xs text-stone-400">Average time</p>
                </div>
                <div>
                  <p className="text-lg font-semibold text-stone-600">{Math.floor(medianCompletionTime / 60)}m {medianCompletionTime % 60}s</p>
                  <p className="text-xs text-stone-400">Median time</p>
                </div>
                <p className="text-xs text-stone-400">{completionTimes.length} completed quizzes</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* State & Location Insights */}
      {(byState.length > 0 || byTimezone.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {byState.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Submissions by State</CardTitle>
                <CardDescription>Where applicants are located</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {byState.map(([state, data]) => {
                    const pct = total > 0 ? (data.count / total) * 100 : 0
                    const convRate = data.count > 0 ? Math.round((data.qualifiedCount / data.count) * 100) : 0
                    return (
                      <div key={state} className="flex items-center gap-3">
                        <span className="text-sm font-medium text-stone-700 w-8 shrink-0">{state}</span>
                        <div className="flex-1 h-4 bg-stone-100 rounded-full overflow-hidden">
                          <div className="h-full bg-[#283693] rounded-full transition-all" style={{ width: `${pct}%`, minWidth: data.count > 0 ? '8px' : '0' }} />
                        </div>
                        <span className="text-xs text-stone-500 w-20 text-right shrink-0">{data.count} · {convRate}%</span>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}
          {byTimezone.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Timezones</CardTitle>
                <CardDescription>Applicant timezone distribution</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  {byTimezone.slice(0, 8).map(([tz, count]) => (
                    <div key={tz} className="flex items-center justify-between p-2.5 rounded-lg bg-stone-50 border border-stone-100">
                      <span className="text-xs text-stone-600 truncate mr-2">{tz.replace(/_/g, ' ').replace('America/', '')}</span>
                      <span className="text-xs font-semibold text-stone-700 shrink-0">{count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Submissions by source */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Submissions by Source</CardTitle>
            <CardDescription>Where applicants found us</CardDescription>
          </CardHeader>
          <CardContent>
            {bySource.length === 0
              ? <p className="text-sm text-stone-400">No data for this period.</p>
              : <SourceBarChart data={bySource} maxVal={maxSourceCount} />
            }
          </CardContent>
        </Card>

        {/* GC vs IP split */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Application Type Split</CardTitle>
            <CardDescription>Surrogate vs. Intended Parent applications</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Heart className="w-3.5 h-3.5 text-abc-coral" />
                    Surrogates (GC)
                  </span>
                  <span className="text-stone-500">{gcCount} total · {gcQualified} qualified</span>
                </div>
                <div className="h-4 bg-stone-100 rounded-full overflow-hidden">
                  <div className="h-full bg-abc-coral rounded-full transition-all duration-500" style={{ width: total > 0 ? `${(gcCount / total) * 100}%` : '0%' }} />
                </div>
                <p className="text-xs text-stone-400 mt-1">
                  {total > 0 ? Math.round((gcCount / total) * 100) : 0}% of submissions · {gcCount > 0 ? Math.round((gcQualified / gcCount) * 100) : 0}% qualification rate
                </p>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Users className="w-3.5 h-3.5 text-[#6b8cba]" />
                    Intended Parents (IP)
                  </span>
                  <span className="text-stone-500">{ipCount} total · {ipQualified} qualified</span>
                </div>
                <div className="h-4 bg-stone-100 rounded-full overflow-hidden">
                  <div className="h-full bg-[#6b8cba] rounded-full transition-all duration-500" style={{ width: total > 0 ? `${(ipCount / total) * 100}%` : '0%' }} />
                </div>
                <p className="text-xs text-stone-400 mt-1">
                  {total > 0 ? Math.round((ipCount / total) * 100) : 0}% of submissions · {ipCount > 0 ? Math.round((ipQualified / ipCount) * 100) : 0}% qualification rate
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* DQ breakdown */}
      {dqBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Disqualification Reasons</CardTitle>
            <CardDescription>Most common reasons applications didn't advance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {dqBreakdown.map(([reason, count]) => (
                <div key={reason} className="flex items-center justify-between p-3 rounded-lg bg-red-50 border border-red-100">
                  <span className="text-sm text-red-700">{DQ_REASON_LABELS[reason] || reason}</span>
                  <span className="text-sm font-bold text-red-600 ml-2">{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Campaign & Ad Performance with conversion rates */}
      {byCampaign.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">Campaign & Ad Performance</CardTitle>
                <CardDescription>Submissions, conversions, and per-ad performance</CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Select value={campSourceFilter} onValueChange={v => { setCampSourceFilter(v); setCampContentFilter('all') }}>
                  <SelectTrigger className="h-8 text-xs w-32"><SelectValue placeholder="Source" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sources</SelectItem>
                    {campSources.map(s => <SelectItem key={s} value={s} className="text-xs">{getSourceLabel(s)}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={campCampaignFilter} onValueChange={v => { setCampCampaignFilter(v); setCampContentFilter('all') }}>
                  <SelectTrigger className="h-8 text-xs w-40"><SelectValue placeholder="Campaign" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Campaigns</SelectItem>
                    {campCampaigns.map(c => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}
                  </SelectContent>
                </Select>
                {campContents.length > 0 && (
                  <Select value={campContentFilter} onValueChange={setCampContentFilter}>
                    <SelectTrigger className="h-8 text-xs w-40"><SelectValue placeholder="Ad Content" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Ads</SelectItem>
                      {campContents.map(c => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => {
                  const headers = ['Source', 'Campaign', 'Ad Content', 'Submissions', 'Qualified', 'Conv. Rate']
                  const rows = filteredCampaigns.flatMap(c => {
                    const contents = Object.entries(c.contents)
                    if (contents.length === 0) {
                      return [[getSourceLabel(c.source), c.campaign, '', c.count, c.qualifiedCount, c.count > 0 ? Math.round((c.qualifiedCount / c.count) * 100) + '%' : '0%']]
                    }
                    return contents.map(([name, data]) => [
                      getSourceLabel(c.source), c.campaign, name, data.count, data.qualifiedCount,
                      data.count > 0 ? Math.round((data.qualifiedCount / data.count) * 100) + '%' : '0%'
                    ])
                  })
                  const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
                  const blob = new Blob([csv], { type: 'text/csv' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `campaign-performance-${startDate}-to-${endDate}.csv`
                  a.click()
                  URL.revokeObjectURL(url)
                }}>
                  <Download className="w-3.5 h-3.5" />
                  Export
                </Button>
                {(campSourceFilter !== 'all' || campCampaignFilter !== 'all' || campContentFilter !== 'all') && (
                  <Button variant="ghost" size="sm" className="h-8 text-xs text-stone-400" onClick={() => { setCampSourceFilter('all'); setCampCampaignFilter('all'); setCampContentFilter('all') }}>
                    Clear
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100">
                  <th className="text-left py-3 px-6 font-medium text-stone-400">Source</th>
                  <th className="text-left py-3 px-4 font-medium text-stone-400">Campaign</th>
                  <th className="text-left py-3 px-4 font-medium text-stone-400">Ad / Content</th>
                  <th className="text-right py-3 px-4 font-medium text-stone-400">Subs</th>
                  <th className="text-right py-3 px-4 font-medium text-stone-400">Qualified</th>
                  <th className="text-right py-3 px-6 font-medium text-stone-400">Conv. Rate</th>
                </tr>
              </thead>
              <tbody>
                {filteredCampaigns.length === 0 && (
                  <tr><td colSpan={6} className="py-8 text-center text-stone-400 text-sm">No campaigns match your filters.</td></tr>
                )}
                {filteredCampaigns.map(c => {
                  const contents = Object.entries(c.contents)
                  const srcColor = SOURCE_COLORS[c.source] || '#9CA3AF'
                  const convRate = c.count > 0 ? Math.round((c.qualifiedCount / c.count) * 100) : 0
                  return (
                    <tr key={`${c.source}::${c.campaign}`} className="border-b border-stone-50 last:border-0 align-top">
                      <td className="py-3 px-6">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: srcColor }} />
                          <span className="font-medium text-stone-700">{getSourceLabel(c.source)}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-stone-600">{c.campaign}</td>
                      <td className="py-3 px-4">
                        {contents.length > 0 ? (
                          <div className="space-y-1.5">
                            {contents.map(([name, data]) => {
                              const adConv = data.count > 0 ? Math.round((data.qualifiedCount / data.count) * 100) : 0
                              return (
                                <div key={name} className="flex items-center justify-between gap-3">
                                  <span className="text-stone-500 truncate max-w-40 text-xs">{name}</span>
                                  <span className="text-xs shrink-0">
                                    <span className="text-stone-500">{data.count} subs</span>
                                    <span className="mx-1 text-stone-300">·</span>
                                    <span className={adConv >= 50 ? 'text-emerald-600 font-medium' : 'text-stone-400'}>{adConv}% conv</span>
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        ) : (
                          <span className="text-stone-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-stone-800">{c.count}</td>
                      <td className="py-3 px-4 text-right">
                        <span className="text-emerald-600 font-semibold">{c.qualifiedCount}</span>
                      </td>
                      <td className="py-3 px-6 text-right">
                        <span className={`font-semibold ${convRate >= 50 ? 'text-emerald-600' : convRate >= 25 ? 'text-amber-600' : 'text-red-500'}`}>
                          {convRate}%
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Recent submissions (privacy-safe) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Submissions</CardTitle>
          <CardDescription>Latest {recent.length} applications (name privacy protected)</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100">
                <th className="text-left py-3 px-6 font-medium text-stone-400">Applicant</th>
                <th className="text-left py-3 px-4 font-medium text-stone-400">Type</th>
                <th className="text-left py-3 px-4 font-medium text-stone-400">Date</th>
                <th className="text-left py-3 px-4 font-medium text-stone-400">Source</th>
                <th className="text-left py-3 px-4 font-medium text-stone-400">Campaign / Ad</th>
                <th className="text-left py-3 px-4 font-medium text-stone-400">Status</th>
              </tr>
            </thead>
            <tbody>
              {recent.map(sub => (
                <tr key={sub.id} className="border-b border-stone-50 last:border-0">
                  <td className="py-3 px-6 font-medium text-stone-700">{privacyName(sub)}</td>
                  <td className="py-3 px-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${
                      sub.type === 'gc'
                        ? 'bg-rose-50 text-rose-600 border-rose-200'
                        : 'bg-blue-50 text-blue-600 border-blue-200'
                    }`}>
                      {sub.type === 'gc' ? 'GC' : 'IP'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-stone-400">{formatDate(sub.submittedAt)}</td>
                  <td className="py-3 px-4 text-stone-600">{getSourceLabel(sub.tracking.resolvedSource)}</td>
                  <td className="py-3 px-4">
                    {sub.tracking.utm_campaign ? (
                      <div>
                        <span className="text-stone-600 text-xs">{sub.tracking.utm_campaign}</span>
                        {sub.tracking.utm_content && (
                          <p className="text-stone-400 text-xs truncate max-w-36">{sub.tracking.utm_content}</p>
                        )}
                      </div>
                    ) : (
                      <span className="text-stone-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${
                      sub.status === 'qualified' || sub.status === 'approved'
                        ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                        : sub.status === 'disqualified'
                        ? 'bg-red-100 text-red-600 border-red-200'
                        : 'bg-amber-100 text-amber-600 border-amber-200'
                    }`}>
                      {sub.status === 'pending_review' ? 'Pending' : sub.status.charAt(0).toUpperCase() + sub.status.slice(1)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
