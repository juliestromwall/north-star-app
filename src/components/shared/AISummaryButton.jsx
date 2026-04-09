import { useState, useCallback } from 'react'
import { useRole } from '@/context/RoleContext'
import { Sparkles, Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { fetchCaseEmails, fetchCaseTasks, fetchCaseNotes, fetchInsurance, fetchInsurancePayments, fetchJourneyExpenses } from '@/lib/db'

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

      // Build checklist summary
      let checklist = null
      if (checklistSteps?.length > 0 && tracking) {
        checklist = checklistSteps.map(s => ({
          label: s.label,
          status: tracking[s.id]?.status || 'not_started',
        }))
      }

      // Calendar events
      let appointments = []
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
        appointments = allEvents.filter(e => { if (seen.has(e.id)) return false; seen.add(e.id); return true }).map(e => ({
          date: e.start?.date || e.start?.dateTime?.split('T')[0] || '',
          time: e.start?.dateTime ? new Date(e.start.dateTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : null,
          title: e.summary || '',
        }))
      } catch {}

      // Pregnancy / transfers from journey data
      let pregnancy = null, transfers = [], escrow = null
      const jd = journeyData || {}
      if (jd.dueDate) {
        const due = new Date(jd.dueDate)
        const conception = new Date(due.getTime() - 280 * 24 * 60 * 60 * 1000)
        const diffMs = new Date() - conception
        const weeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000))
        const days = Math.floor((diffMs % (7 * 24 * 60 * 60 * 1000)) / (24 * 60 * 60 * 1000))
        if (weeks >= 0 && weeks <= 42) pregnancy = { weeks, days, dueDate: jd.dueDate, babySex: jd.babySex, babyNames: jd.babyNames }
      }
      if (jd.escrowBalance || jd.escrowMin) escrow = { balance: jd.escrowBalance, minimum: jd.escrowMin }

      const res = await fetch('/api/ai/case-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseName, caseType, stage, status,
          emails: emails.slice(0, 15).map(e => ({ direction: e.direction, date: e.date, subject: e.subject, from: e.from_email, tags: e.tags })),
          tasks: tasks.map(t => ({ status: t.status, title: t.title, priority: t.priority, due_date: t.due_date, notes: t.notes })),
          notes: notes.slice(0, 10).map(n => ({ created_at: n.created_at, content: n.content })),
          checklist,
          appointments,
          transfers: transfers.length > 0 ? transfers : undefined,
          insurance: insurance || undefined,
          expenses: expenses.length > 0 ? expenses : undefined,
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
            <p className="text-xs text-stone-400 mt-0.5">{stage}{status ? ` · ${status}` : ''}</p>
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
                          const isWarning = /overdue|below|missing|stalled|concern|urgent|⚠/i.test(trimmed)
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
