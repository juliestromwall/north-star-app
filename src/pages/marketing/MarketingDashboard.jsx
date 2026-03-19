import { useState, useMemo, useEffect } from 'react'
import { TrendingUp, Users, CheckCircle, XCircle, BarChart3, Heart } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import PageHeader from '@/components/shared/PageHeader'
import { mockIntakeSubmissions, DQ_REASON_LABELS, getSourceLabel } from '@/data/mock/intakeSubmissions'
import { fetchIntakeSubmissions } from '@/lib/db'

const DAY_OPTIONS = [
  { label: 'Last 30 days', value: 30 },
  { label: 'Last 60 days', value: 60 },
  { label: 'Last 90 days', value: 90 },
  { label: 'All time', value: 9999 },
]

const SOURCE_COLORS = {
  instagram: '#E1306C',
  tiktok: '#010101',
  facebook: '#1877F2',
  google: '#4285F4',
  referral: '#10B981',
  direct: '#6B7280',
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

function BarChart({ data, maxVal }) {
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
                {count > 0 ? Math.round(((count - dqCount) / count) * 100) : 0}% qualified
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function privacyName(sub) {
  if (sub.type === 'gc') {
    return `${sub.answers.firstName} ${sub.answers.lastName.charAt(0)}.`
  }
  return `${sub.answers.primaryFirstName} ${sub.answers.primaryLastName.charAt(0)}.`
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function MarketingDashboard() {
  const [days, setDays] = useState(90)
  const [allSubmissions, setAllSubmissions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchIntakeSubmissions()
      .then(data => setAllSubmissions(data && data.length > 0 ? data : mockIntakeSubmissions))
      .catch(() => setAllSubmissions(mockIntakeSubmissions))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    if (days === 9999) return allSubmissions
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)
    return allSubmissions.filter(s => new Date(s.submittedAt) >= cutoff)
  }, [days, allSubmissions])

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

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <PageHeader
          title="Marketing Analytics"
          subtitle="Intake form performance, source attribution, and conversion tracking"
        />
        <div className="flex gap-1 bg-stone-100 rounded-lg p-1 mt-1">
          {DAY_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setDays(opt.value)}
              className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
                days === opt.value
                  ? 'bg-white text-stone-800 shadow-sm'
                  : 'text-stone-500 hover:text-stone-700'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={BarChart3}
          label="Total Submissions"
          value={total}
          sub={`${gcCount} surrogates · ${ipCount} IPs`}
          color="stone"
        />
        <StatCard
          icon={CheckCircle}
          label="Qualified"
          value={qualified}
          sub={`${conversionRate}% conversion rate`}
          color="emerald"
        />
        <StatCard
          icon={XCircle}
          label="Disqualified"
          value={disqualified}
          sub={total > 0 ? `${Math.round((disqualified / total) * 100)}% of submissions` : ''}
          color="red"
        />
        <StatCard
          icon={TrendingUp}
          label="Conversion Rate"
          value={`${conversionRate}%`}
          sub="Qualified ÷ total submissions"
          color="blue"
        />
      </div>

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
              : <BarChart data={bySource} maxVal={maxSourceCount} />
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
                  <div
                    className="h-full bg-abc-coral rounded-full transition-all duration-500"
                    style={{ width: total > 0 ? `${(gcCount / total) * 100}%` : '0%' }}
                  />
                </div>
                <p className="text-xs text-stone-400 mt-1">
                  {total > 0 ? Math.round((gcCount / total) * 100) : 0}% of submissions ·{' '}
                  {gcCount > 0 ? Math.round((gcQualified / gcCount) * 100) : 0}% qualification rate
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
                  <div
                    className="h-full bg-[#6b8cba] rounded-full transition-all duration-500"
                    style={{ width: total > 0 ? `${(ipCount / total) * 100}%` : '0%' }}
                  />
                </div>
                <p className="text-xs text-stone-400 mt-1">
                  {total > 0 ? Math.round((ipCount / total) * 100) : 0}% of submissions ·{' '}
                  {ipCount > 0 ? Math.round((ipQualified / ipCount) * 100) : 0}% qualification rate
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

      {/* Campaign & Ad Performance */}
      {byCampaign.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Campaign & Ad Performance</CardTitle>
            <CardDescription>Submissions by campaign and ad creative</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100">
                  <th className="text-left py-3 px-6 font-medium text-stone-400">Source</th>
                  <th className="text-left py-3 px-4 font-medium text-stone-400">Campaign</th>
                  <th className="text-left py-3 px-4 font-medium text-stone-400">Ad / Content</th>
                  <th className="text-right py-3 px-4 font-medium text-stone-400">Submissions</th>
                  <th className="text-right py-3 px-6 font-medium text-stone-400">Qualified</th>
                </tr>
              </thead>
              <tbody>
                {byCampaign.map(c => {
                  const contents = Object.entries(c.contents)
                  const srcColor = SOURCE_COLORS[c.source] || '#9CA3AF'
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
                          <div className="space-y-1">
                            {contents.map(([name, data]) => (
                              <div key={name} className="flex items-center justify-between gap-3">
                                <span className="text-stone-500 truncate max-w-48">{name}</span>
                                <span className="text-xs text-stone-400 shrink-0">{data.count} / {data.qualifiedCount}q</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-stone-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-stone-800">{c.count}</td>
                      <td className="py-3 px-6 text-right">
                        <span className="text-emerald-600 font-semibold">{c.qualifiedCount}</span>
                        <span className="text-stone-400 text-xs ml-1">({c.count > 0 ? Math.round((c.qualifiedCount / c.count) * 100) : 0}%)</span>
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
