import { useState, useCallback } from 'react'
import { useRole } from '@/context/RoleContext'
import { Sparkles, Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { fetchCaseEmails, fetchCaseTasks, fetchCaseNotes, fetchInsurance, fetchInsurancePayments, fetchJourneyExpenses } from '@/lib/db'

function fmtDate(d) {
  if (!d) return ''
  const dt = new Date(d + (d.includes('T') ? '' : 'T00:00:00'))
  return dt.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
}

export default function AISummaryButton({ caseId, caseName, caseType, stage, status, checklistSteps, tracking, journeyData, className }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState(null)
  const { currentUser } = useRole()

  const generateSummary = useCallback(async () => {
    setLoading(true)
    setError(null)
    setSummary(null)

    try {
      const [emails, tasks, notes, insurance, payments, expenses] = await Promise.all([
        fetchCaseEmails(caseId).catch(() => []),
        fetchCaseTasks(caseId).catch(() => []),
        fetchCaseNotes(caseId).catch(() => []),
        fetchInsurance(caseId, caseType === 'journey' ? 'journey' : 'surrogate').catch(() => null),
        fetchInsurancePayments(caseId).catch(() => []),
        caseType === 'journey' ? fetchJourneyExpenses(caseId).catch(() => []) : Promise.resolve([]),
      ])

      // Build checklist summary WITH log history
      let checklist = null
      if (checklistSteps?.length > 0 && tracking) {
        checklist = checklistSteps.map(s => {
          const t = tracking[s.id] || {}
          const history = (t.history || []).slice(-3) // last 3 log entries
          return {
            label: t.customLabel || s.label,
            status: t.status || 'not_started',
            lastDate: history.length > 0 ? fmtDate(history[history.length - 1].date) : null,
            logs: history.map(h => `${fmtDate(h.date)}: ${h.status?.replace(/_/g, ' ')}${h.note ? ' — ' + h.note : ''}`),
          }
        })
      }

      // Calendar events — split into past and upcoming
      let pastAppointments = [], upcomingAppointments = []
      const today = new Date().toISOString().split('T')[0]
      try {
        const { listCaseEvents, listCalendars } = await import('@/lib/google')
        const primary = await listCaseEvents(currentUser.id, caseId, caseType).catch(() => ({ items: [] }))
        let apptCal = null
        try {
          const cals = await listCalendars(currentUser.id)
          apptCal = (cals || []).find(c => c.summary?.toLowerCase() === 'appointments')
        } catch {}
        const apptEvents = apptCal ? await listCaseEvents(currentUser.id, caseId, caseType, { calendarId: apptCal.id }).catch(() => ({ items: [] })) : { items: [] }
        const allEvents = [...(primary.items || []), ...(apptEvents.items || [])]
        const seen = new Set()
        const deduped = allEvents.filter(e => { if (seen.has(e.id)) return false; seen.add(e.id); return true })
        for (const e of deduped) {
          const eventDate = e.start?.date || e.start?.dateTime?.split('T')[0] || ''
          const item = {
            date: fmtDate(eventDate),
            time: e.start?.dateTime ? new Date(e.start.dateTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : null,
            title: e.summary || '',
          }
          if (eventDate >= today) upcomingAppointments.push(item)
          else pastAppointments.push(item)
        }
      } catch {}

      // Pregnancy / delivery / transfers from journey data
      const jd = journeyData || {}
      let pregnancy = null
      if (jd.dueDate || jd.delivered) {
        pregnancy = {
          isPregnant: jd.pregnant === 'yes',
          delivered: !!jd.delivered,
          dueDate: jd.dueDate ? fmtDate(jd.dueDate) : null,
          deliveryDate: jd.deliveryDate ? fmtDate(jd.deliveryDate) : null,
          deliveryType: jd.deliveryType || null,
          deliveryNotes: jd.deliveryNotes || null,
          babies: jd.babies,
          babySexes: jd.babySexes,
          babyNames: jd.babyNames,
          babyWeights: jd.babyWeights,
          babyLengths: jd.babyLengths,
        }
        if (!jd.delivered && jd.dueDate) {
          const due = new Date(jd.dueDate)
          const conception = new Date(due.getTime() - 280 * 24 * 60 * 60 * 1000)
          const diffMs = new Date() - conception
          const weeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000))
          const days = Math.floor((diffMs % (7 * 24 * 60 * 60 * 1000)) / (24 * 60 * 60 * 1000))
          if (weeks >= 0 && weeks <= 42) pregnancy.gestationalAge = `${weeks}w ${days}d`
        }
      }

      let transfers = (jd._transfers || []).map(t => ({
        date: t.date ? fmtDate(t.date) : null,
        embryoCount: t.embryoCount || null,
        betaResult: t.betaValue || null,
        heartbeat: !!t.heartbeatDate,
        unsuccessful: !!t.unsuccessful,
        dropped: !!t.dropped,
        lossType: t.lossType || null,
        lossDate: t.lossDate ? fmtDate(t.lossDate) : null,
      }))

      let escrow = null
      if (jd.escrowBalance || jd.escrowMin) escrow = { balance: jd.escrowBalance, minimum: jd.escrowMin }

      const res = await fetch('/api/ai/case-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseName, caseType, status,
          emails: emails.slice(0, 15).map(e => ({ direction: e.direction, date: e.date ? fmtDate(e.date) : '', subject: e.subject, from: e.from_email, tags: e.tags, snippet: (e.body_text || e.snippet || '').slice(0, 200) })),
          tasks: tasks.map(t => ({ status: t.status, title: t.title, priority: t.priority, due_date: t.due_date ? fmtDate(t.due_date) : null, notes: t.notes })),
          notes: notes.slice(0, 10).map(n => ({ created_at: n.created_at ? fmtDate(n.created_at) : '', content: n.content })),
          checklist,
          pastAppointments: pastAppointments.length > 0 ? pastAppointments : undefined,
          upcomingAppointments: upcomingAppointments.length > 0 ? upcomingAppointments : undefined,
          transfers: transfers.length > 0 ? transfers : undefined,
          insurance: insurance || undefined,
          expenses: expenses.length > 0 ? expenses.slice(0, 10).map(e => ({ date: e.expense_date ? fmtDate(e.expense_date) : '', amount: e.amount, paidTo: e.paid_to, escrow: e.is_escrow, reconciled: e.is_reconciled, notes: e.notes })) : undefined,
          pregnancy: pregnancy || undefined,
          escrow: escrow || undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to generate summary')
      setSummary(data.summary)
    } catch (err) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [caseId, caseName, caseType, stage, status, checklistSteps, tracking, journeyData, currentUser])

  return (
    <>
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); generateSummary() }}
        className={className || 'inline-flex items-center gap-1 text-[10px] text-violet-500 hover:text-violet-700 transition-colors'}
        title="Case Summary"
      >
        <Sparkles className="size-3" />
        <span>Summary</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Sparkles className="size-4 text-violet-500" />
              {caseName}
            </DialogTitle>
            {status && <p className="text-xs text-stone-400 mt-0.5">{status}</p>}
          </DialogHeader>

          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="relative">
                <Sparkles className="size-8 text-violet-300 animate-pulse" />
                <Loader2 className="size-4 animate-spin text-violet-500 absolute -bottom-1 -right-1" />
              </div>
              <span className="text-sm text-stone-400">Gathering case data...</span>
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-600">
              {error}
              <button onClick={generateSummary} className="ml-2 underline hover:no-underline">Retry</button>
            </div>
          )}

          {summary && (
            <div className="space-y-3 text-sm">
              {summary.split(/\n(?=\*\*)/).map((section, i) => {
                const headerMatch = section.match(/^\*\*(.+?)\*\*\s*\n?([\s\S]*)$/)
                if (headerMatch) {
                  const title = headerMatch[1].trim()
                  const body = headerMatch[2].trim()
                  return (
                    <div key={i} className="rounded-lg border border-stone-100 bg-stone-50/50 px-3 py-2.5">
                      <p className="text-xs font-semibold text-stone-700 mb-1.5">{title}</p>
                      <div className="text-stone-600 text-xs leading-relaxed space-y-0.5">
                        {body.split('\n').map((line, j) => {
                          const trimmed = line.replace(/^[-•]\s*/, '').trim()
                          if (!trimmed) return null
                          const isWarning = /overdue|below|missing|stalled|concern|urgent|⚠|critical/i.test(trimmed)
                          return (
                            <p key={j} className={`flex items-start gap-1.5 ${isWarning ? 'text-amber-700 font-medium' : ''}`}>
                              <span className="text-stone-300 mt-0.5 shrink-0">•</span>
                              <span>{trimmed}</span>
                            </p>
                          )
                        })}
                      </div>
                    </div>
                  )
                }
                const trimmed = section.trim()
                if (!trimmed) return null
                return <p key={i} className="text-stone-600 text-xs">{trimmed}</p>
              })}
            </div>
          )}

          {summary && (
            <div className="flex items-center justify-between border-t pt-2 mt-1">
              <p className="text-[10px] text-stone-300">AI-generated — verify before acting</p>
              <button onClick={generateSummary} className="text-[10px] text-violet-400 hover:text-violet-600 flex items-center gap-1">
                <Sparkles className="size-2.5" /> Regenerate
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
