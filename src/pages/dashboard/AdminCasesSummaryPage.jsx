import { useEffect, useMemo, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useRole } from '@/context/RoleContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Sparkles, Loader2, RefreshCw, ArrowLeft, AlertTriangle, CheckCircle2, Clock, MessageSquare, ListChecks, DollarSign, Baby } from 'lucide-react'
import { getAppConfig } from '@/lib/db'
import { getAuthHeaders } from '@/lib/authHeaders'
import { getAdminStaff } from '@/data/mock/users'

// ── Section header → icon + accent ──
const SECTION_META = [
  { match: /immediate attention|attention/i, Icon: AlertTriangle, accent: 'text-rose-700 bg-rose-50 border-rose-200' },
  { match: /upcoming milestones?|milestones?|pregnancy|birth/i, Icon: Baby, accent: 'text-pink-700 bg-pink-50 border-pink-200' },
  { match: /communication gaps?/i, Icon: MessageSquare, accent: 'text-amber-700 bg-amber-50 border-amber-200' },
  { match: /workflow bottlenecks?/i, Icon: ListChecks, accent: 'text-blue-700 bg-blue-50 border-blue-200' },
  { match: /expense|escrow/i, Icon: DollarSign, accent: 'text-violet-700 bg-violet-50 border-violet-200' },
  { match: /healthy/i, Icon: CheckCircle2, accent: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
]
const sectionStyle = (title) => SECTION_META.find(m => m.match.test(title)) || { Icon: ListChecks, accent: 'text-stone-700 bg-stone-50 border-stone-200' }

function formatRelative(iso) {
  if (!iso) return 'never'
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 60_000) return 'just now'
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)} min ago`
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)} hr ago`
  const days = Math.floor(ms / 86_400_000)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

export default function AdminCasesSummaryPage() {
  const { currentUser } = useRole()
  const [searchParams] = useSearchParams()

  // Three modes:
  //   ?journeyManager=<name>     → all matched journeys where journey_data
  //                                .journeyManager ilike's the name (e.g.
  //                                "julie", "nicole"). Grouped by assigned
  //                                admin in the dashboard view.
  //   ?team=1                    → legacy team summary (kept for back-compat)
  //   ?admin=<email> | (default) → single-admin summary
  const journeyManagerName = (searchParams.get('journeyManager') || '').toLowerCase().trim()
  const isJourneyManagerMode = !!journeyManagerName
  const isTeam = searchParams.get('team') === '1' || isJourneyManagerMode
  const targetEmail = (searchParams.get('admin') || currentUser?.email || '').toLowerCase()
  const targetName = useMemo(() => {
    if (isJourneyManagerMode) {
      // Capitalize first letter for display ("Nicole's Journeys")
      return journeyManagerName.replace(/^./, c => c.toUpperCase()) + "'s Journeys"
    }
    if (isTeam) return 'Team'
    const staff = getAdminStaff().find(a => a.email?.toLowerCase() === targetEmail)
    return staff?.name || (targetEmail === currentUser?.email?.toLowerCase() ? currentUser?.name : targetEmail)
  }, [targetEmail, isTeam, isJourneyManagerMode, journeyManagerName, currentUser])

  // For team mode: the list of admin emails to summarize. Skips:
  //   - Jennifer Rose (intake@northstarsurrogacy.com) — intake-only, not on team
  //   - The requesting admin's own email (endpoint auto-adds it back)
  //   - OTHER master admins — Julie shouldn't see Nicole's cases in her team
  //     summary and vice versa. Master admins are peers, not reports, so they
  //     don't belong in each other's "team performance" view.
  const teamEmails = useMemo(() => {
    if (!isTeam) return null
    const myEmail = currentUser?.email?.toLowerCase()
    const myRole = currentUser?.role
    return getAdminStaff()
      .filter(a => a.email !== 'intake@northstarsurrogacy.com')
      .filter(a => a.email?.toLowerCase() !== myEmail)
      .filter(a => {
        // If the requester is a master admin, drop other master admins.
        // Super admins keep full visibility (they oversee everyone).
        if (myRole === 'master_admin' && a.role === 'master_admin') return false
        return true
      })
      .map(a => a.email)
  }, [isTeam, currentUser])

  // Lookup so the endpoint can label each case with its assignee's name.
  const adminNameByEmail = useMemo(() => {
    const m = {}
    for (const a of getAdminStaff()) m[a.email.toLowerCase()] = a.name
    return m
  }, [])

  const [summary, setSummary] = useState(null)
  const [dashboard, setDashboard] = useState(null)
  const [generatedAt, setGeneratedAt] = useState(null)
  const [caseCount, setCaseCount] = useState(null)
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState(null)

  // Load cached summary on mount
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    const cacheKey = isJourneyManagerMode
      ? `admin_summary_journeys_${journeyManagerName}`
      : isTeam
        ? `admin_summary_team_${(currentUser?.email || '').toLowerCase()}`
        : `admin_summary_${targetEmail}`
    getAppConfig(cacheKey).then(cached => {
      if (cancelled) return
      if (cached?.dashboard) setDashboard(cached.dashboard)
      if (cached?.summary) setSummary(cached.summary)
      if (cached?.generatedAt) setGeneratedAt(cached.generatedAt)
      if (cached?.caseCount != null) setCaseCount(cached.caseCount)
      setLoading(false)
    }).catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [targetEmail, isTeam, isJourneyManagerMode, journeyManagerName, currentUser?.email])

  async function regenerate() {
    setGenerating(true); setError(null)
    try {
      const payload = isJourneyManagerMode
        ? {
            adminEmail: currentUser?.email || '',
            adminName: currentUser?.name || '',
            journeyManager: journeyManagerName,
            adminNameByEmail,
          }
        : isTeam
          ? {
              adminEmail: currentUser?.email || targetEmail,
              adminName: currentUser?.name || targetName,
              teamEmails,
              adminNameByEmail,
            }
          : {
              adminEmail: targetEmail,
              adminName: targetName,
              adminNameByEmail,
            }
      const res = await fetch('/api/ai/admin-cases-summary', {
        method: 'POST',
        headers: await getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to generate summary')
      setSummary(data.summary || null)
      setDashboard(data.dashboard || null)
      setGeneratedAt(data.generatedAt)
      setCaseCount(data.caseCount ?? null)
      setStats(data.stats || null)
    } catch (err) {
      setError(err.message || 'Failed to generate summary')
    } finally {
      setGenerating(false)
    }
  }

  // Parse markdown sections (split on **Header** lines, same shape as
  // AISummaryButton dialog so warning keywords get auto-highlighted).
  const sections = useMemo(() => {
    if (!summary) return []
    return summary
      .split(/\n(?=\*\*)/)
      .map(s => {
        const m = s.match(/^\*\*(.+?)\*\*\s*\n?([\s\S]*)$/)
        if (!m) return null
        return { title: m[1].trim(), body: m[2].trim() }
      })
      .filter(Boolean)
  }, [summary])

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-[#1A3638]">
              <ArrowLeft className="size-4" /> Back to dashboard
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#1A3638] mt-2 flex items-center gap-2">
              <Sparkles className="size-7 text-[#D4A853]" />
              {isJourneyManagerMode ? targetName : isTeam ? 'Team workload summary' : 'Workload summary'}
            </h1>
            <p className="text-sm text-stone-500 mt-1">
              {isJourneyManagerMode
                ? <>Matched journeys managed by <span className="font-semibold text-stone-700">{journeyManagerName.replace(/^./, c => c.toUpperCase())}</span>, grouped by case admin</>
                : isTeam
                  ? <>For <span className="font-semibold text-stone-700">{(teamEmails?.length || 0) + 1} admins</span> ({currentUser?.name?.split(' ')[0]} + team)</>
                  : <>For <span className="font-semibold text-stone-700">{targetName || targetEmail}</span></>}
              {caseCount !== null && <span> · {caseCount} active case{caseCount === 1 ? '' : 's'}</span>}
              {generatedAt && <span> · generated {formatRelative(generatedAt)}</span>}
            </p>
          </div>
          <Button onClick={regenerate} disabled={generating} className="gap-1.5" style={{ backgroundColor: '#1A3638', color: '#fff' }}>
            {generating ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            {generating ? 'Generating…' : summary ? 'Regenerate' : 'Generate Summary'}
          </Button>
        </div>

        {/* Stats strip */}
        {stats && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            <Card className="rounded-xl border-stone-100">
              <CardContent className="py-4 flex items-center gap-3">
                <Clock className="size-5 text-amber-500 shrink-0" />
                <div>
                  <p className="text-2xl font-bold text-stone-800">{stats.stalled}</p>
                  <p className="text-[11px] text-stone-500 uppercase tracking-wider">Stalled</p>
                </div>
              </CardContent>
            </Card>
            <Card className="rounded-xl border-stone-100">
              <CardContent className="py-4 flex items-center gap-3">
                <AlertTriangle className="size-5 text-rose-500 shrink-0" />
                <div>
                  <p className="text-2xl font-bold text-stone-800">{stats.overdueTasks}</p>
                  <p className="text-[11px] text-stone-500 uppercase tracking-wider">Overdue tasks</p>
                </div>
              </CardContent>
            </Card>
            <Card className="rounded-xl border-stone-100">
              <CardContent className="py-4 flex items-center gap-3">
                <ListChecks className="size-5 text-blue-500 shrink-0" />
                <div>
                  <p className="text-2xl font-bold text-stone-800">{stats.flagged}</p>
                  <p className="text-[11px] text-stone-500 uppercase tracking-wider">Workflow flags</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Loading / Empty / Error / Content states */}
        {loading && (
          <Card className="rounded-2xl">
            <CardContent className="py-16 text-center">
              <Loader2 className="size-6 animate-spin text-stone-400 mx-auto" />
              <p className="text-sm text-stone-500 mt-3">Loading…</p>
            </CardContent>
          </Card>
        )}

        {!loading && !summary && !dashboard && !error && (
          <Card className="rounded-2xl">
            <CardContent className="py-16 text-center">
              <Sparkles className="size-10 text-stone-300 mx-auto" />
              <p className="text-sm text-stone-500 mt-3">No summary yet. Click <strong>Generate Summary</strong> above to create one.</p>
            </CardContent>
          </Card>
        )}

        {error && (
          <Card className="rounded-2xl border-rose-200 bg-rose-50/40">
            <CardContent className="py-6">
              <p className="text-sm text-rose-700"><strong>Error:</strong> {error}</p>
            </CardContent>
          </Card>
        )}

        {/* Dashboard view (team mode) — urgent panel + per-admin cards */}
        {!loading && dashboard && (
          <DashboardView dashboard={dashboard} />
        )}

        {!loading && !dashboard && summary && (
          <div className="space-y-4">
            {sections.length > 0 ? sections.map((sec, i) => {
              const { Icon, accent } = sectionStyle(sec.title)
              return (
                <Card key={i} className={`rounded-2xl border ${accent.split(' ').filter(c => c.startsWith('border-')).join(' ')}`}>
                  <CardContent className="py-5">
                    <div className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full ${accent} mb-3`}>
                      <Icon className="size-4" />
                      <span className="text-xs font-bold uppercase tracking-wider">{sec.title}</span>
                    </div>
                    <div className="space-y-1.5 text-sm text-stone-700 leading-relaxed">
                      {sec.body.split('\n').map((line, j) => {
                        const trimmed = line.replace(/^[-•*]\s*/, '').trim()
                        if (!trimmed) return null
                        const isWarning = /overdue|stalled|missing|urgent|critical|⚠|🚨/i.test(trimmed)
                        // Escape HTML, then turn markdown into safe HTML.
                        // Important: the link replacement injects a class attribute
                        // containing `#1A3638`, so we must NOT run a generic /#\d+/
                        // regex afterwards — it would match the color literal inside
                        // the class string and corrupt the HTML.
                        const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                        const html = escape(trimmed)
                          .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                          .replace(/\[([^\]]+)\]\((\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="font-semibold text-[#1A3638] underline decoration-[#1A3638]/30 hover:decoration-[#1A3638]">$1</a>')
                          // _italic_ sub-headings used for team-mode admin grouping
                          .replace(/(^|[\s>])_([^_]+)_(?=[\s.,!?:;)\]]|$)/g, '$1<em class="text-stone-500 font-semibold not-italic uppercase tracking-wider text-xs">$2</em>')
                        return (
                          <p key={j} className={`flex items-start gap-2 ${isWarning ? 'text-amber-800 font-medium' : ''}`}>
                            <span className="text-stone-300 mt-1 shrink-0">•</span>
                            <span dangerouslySetInnerHTML={{ __html: html }} />
                          </p>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              )
            }) : (
              // Fallback: render whole summary as plain text if section parsing finds nothing
              <Card className="rounded-2xl">
                <CardContent className="py-5">
                  <pre className="whitespace-pre-wrap text-sm text-stone-700 font-sans">{summary}</pre>
                </CardContent>
              </Card>
            )}

            <p className="text-xs text-stone-400 text-center pt-4">
              Summaries are generated by AI based on case activity signals. Always verify before acting.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Team-mode dashboard view ────────────────────────────────
//
// dashboard shape (from the AI):
//   { urgent: [{ name, url, owner, reason }],
//     byAdmin: [{ adminName, totals, milestones, communication, workflow, expenses }] }

function CaseLine({ name, url, note, owner, ownerHidden }) {
  return (
    <div className="flex items-start gap-2 text-sm leading-relaxed">
      <span className="text-stone-300 mt-0.5 shrink-0">•</span>
      <div className="min-w-0">
        <a href={url} target="_blank" rel="noopener noreferrer"
          className="font-semibold text-[#1A3638] underline decoration-[#1A3638]/30 hover:decoration-[#1A3638]">
          {name}
        </a>
        {owner && !ownerHidden && <span className="text-stone-400 text-xs ml-1.5">({owner})</span>}
        {note && <span className="text-stone-600"> — {note}</span>}
      </div>
    </div>
  )
}

const CATEGORY_META = {
  milestones:    { label: 'Upcoming Milestones', Icon: Baby,        color: 'text-pink-700' },
  communication: { label: 'Communication Gaps',  Icon: MessageSquare, color: 'text-amber-700' },
  workflow:      { label: 'Workflow Bottlenecks', Icon: ListChecks,  color: 'text-blue-700' },
  expenses:      { label: 'Expense / Escrow',    Icon: DollarSign,   color: 'text-violet-700' },
}

function AdminCard({ admin }) {
  const totals = admin.totals || {}
  const cats = ['milestones', 'communication', 'workflow', 'expenses']
    .map(k => ({ key: k, items: Array.isArray(admin[k]) ? admin[k] : [] }))
    .filter(c => c.items.length > 0)

  return (
    <Card className="rounded-2xl border-stone-100">
      <CardContent className="py-5 space-y-4">
        <div className="flex items-baseline justify-between border-b border-stone-100 pb-2">
          <h3 className="text-base font-bold text-[#1A3638]">{admin.adminName}</h3>
          <div className="text-xs text-stone-500 flex items-center gap-3 shrink-0">
            {totals.cases != null && <span><strong className="text-stone-700">{totals.cases}</strong> cases</span>}
            {totals.overdueTasks > 0 && <span className="text-rose-600"><strong>{totals.overdueTasks}</strong> overdue</span>}
            {totals.healthy > 0 && <span className="text-emerald-600">{totals.healthy} healthy</span>}
          </div>
        </div>

        {cats.length === 0 ? (
          <p className="text-sm text-emerald-700 flex items-center gap-1.5">
            <CheckCircle2 className="size-4" /> Nothing flagged — caseload is healthy.
          </p>
        ) : (
          <div className="space-y-3">
            {cats.map(({ key, items }) => {
              const meta = CATEGORY_META[key]
              const Icon = meta.Icon
              return (
                <div key={key}>
                  <div className={`flex items-center gap-1.5 mb-1.5 ${meta.color}`}>
                    <Icon className="size-3.5" />
                    <span className="text-[11px] font-bold uppercase tracking-wider">{meta.label}</span>
                  </div>
                  <div className="space-y-1 pl-1">
                    {items.map((it, i) => (
                      <CaseLine key={i} name={it.name} url={it.url} note={it.note} ownerHidden />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function DashboardView({ dashboard }) {
  const urgent = Array.isArray(dashboard.urgent) ? dashboard.urgent : []
  const admins = Array.isArray(dashboard.byAdmin) ? dashboard.byAdmin : []

  return (
    <div className="space-y-6">
      {/* Urgent panel — cross-team alerts at the top */}
      {urgent.length > 0 && (
        <Card className="rounded-2xl border-2 border-rose-200 bg-rose-50/40">
          <CardContent className="py-5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-100 text-rose-800 mb-3">
              <AlertTriangle className="size-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Needs Immediate Attention</span>
            </div>
            <div className="space-y-2">
              {urgent.map((u, i) => (
                <CaseLine key={i} name={u.name} url={u.url} note={u.reason} owner={u.owner} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Per-admin breakouts */}
      {admins.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {admins.map((a, i) => <AdminCard key={i} admin={a} />)}
        </div>
      )}

      {urgent.length === 0 && admins.length === 0 && (
        <Card className="rounded-2xl">
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="size-10 text-emerald-300 mx-auto" />
            <p className="text-sm text-stone-500 mt-3">All quiet — nothing flagged across the team right now.</p>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-stone-400 text-center pt-2">
        Generated by AI from case activity signals. Always verify before acting.
      </p>
    </div>
  )
}
