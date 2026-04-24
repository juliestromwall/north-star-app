import { useEffect, useMemo, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useRole } from '@/context/RoleContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Sparkles, Loader2, RefreshCw, ArrowLeft, AlertTriangle, CheckCircle2, Clock, MessageSquare, ListChecks, DollarSign, Baby } from 'lucide-react'
import { getAppConfig } from '@/lib/db'
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

  // Two modes:
  //   ?team=1                    → master/super team summary across all
  //                                non-intake admins (Desiree, Emily, Stacie,
  //                                + the requesting master admin)
  //   ?admin=<email> | (default) → single-admin summary
  const isTeam = searchParams.get('team') === '1'
  const targetEmail = (searchParams.get('admin') || currentUser?.email || '').toLowerCase()
  const targetName = useMemo(() => {
    if (isTeam) return 'Team'
    const staff = getAdminStaff().find(a => a.email?.toLowerCase() === targetEmail)
    return staff?.name || (targetEmail === currentUser?.email?.toLowerCase() ? currentUser?.name : targetEmail)
  }, [targetEmail, isTeam, currentUser])

  // For team mode: the list of admin emails to summarize. Skips the requesting
  // master admin's own email (the endpoint adds it back automatically) and
  // skips Jennifer Rose (intake-only).
  const teamEmails = useMemo(() => {
    if (!isTeam) return null
    return getAdminStaff()
      .filter(a => a.email !== 'intake@abcsurrogacy.com')
      .filter(a => a.email !== currentUser?.email)
      .map(a => a.email)
  }, [isTeam, currentUser])

  // Lookup so the endpoint can label each case with its assignee's name.
  const adminNameByEmail = useMemo(() => {
    const m = {}
    for (const a of getAdminStaff()) m[a.email.toLowerCase()] = a.name
    return m
  }, [])

  const [summary, setSummary] = useState(null)
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
    const cacheKey = isTeam
      ? `admin_summary_team_${(currentUser?.email || '').toLowerCase()}`
      : `admin_summary_${targetEmail}`
    getAppConfig(cacheKey).then(cached => {
      if (cancelled) return
      if (cached?.summary) {
        setSummary(cached.summary)
        setGeneratedAt(cached.generatedAt)
        setCaseCount(cached.caseCount ?? null)
      }
      setLoading(false)
    }).catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [targetEmail, isTeam, currentUser?.email])

  async function regenerate() {
    setGenerating(true); setError(null)
    try {
      const res = await fetch('/api/ai/admin-cases-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminEmail: currentUser?.email || targetEmail,
          adminName: currentUser?.name || targetName,
          teamEmails: isTeam ? teamEmails : undefined,
          adminNameByEmail,
          // For single-admin mode pointing at someone else, override the
          // primary email so the endpoint targets that admin's cases.
          ...(isTeam ? {} : { adminEmail: targetEmail, adminName: targetName }),
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to generate summary')
      setSummary(data.summary)
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
            <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-[#283693]">
              <ArrowLeft className="size-4" /> Back to dashboard
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#283693] mt-2 flex items-center gap-2">
              <Sparkles className="size-7 text-[#ed148c]" />
              {isTeam ? 'Team workload summary' : 'Workload summary'}
            </h1>
            <p className="text-sm text-stone-500 mt-1">
              {isTeam
                ? <>For <span className="font-semibold text-stone-700">{(teamEmails?.length || 0) + 1} admins</span> ({currentUser?.name?.split(' ')[0]} + team)</>
                : <>For <span className="font-semibold text-stone-700">{targetName || targetEmail}</span></>}
              {caseCount !== null && <span> · {caseCount} active case{caseCount === 1 ? '' : 's'}</span>}
              {generatedAt && <span> · generated {formatRelative(generatedAt)}</span>}
            </p>
          </div>
          <Button onClick={regenerate} disabled={generating} className="gap-1.5" style={{ backgroundColor: '#283693', color: '#fff' }}>
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

        {!loading && !summary && !error && (
          <Card className="rounded-2xl">
            <CardContent className="py-16 text-center">
              <Sparkles className="size-10 text-stone-300 mx-auto" />
              <p className="text-sm text-stone-500 mt-3">No summary yet for this admin. Click <strong>Generate Summary</strong> above to create one.</p>
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

        {!loading && summary && (
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
                        // containing `#283693`, so we must NOT run a generic /#\d+/
                        // regex afterwards — it would match the color literal inside
                        // the class string and corrupt the HTML.
                        const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                        const html = escape(trimmed)
                          .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                          .replace(/\[([^\]]+)\]\((\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="font-semibold text-[#283693] underline decoration-[#283693]/30 hover:decoration-[#283693]">$1</a>')
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
