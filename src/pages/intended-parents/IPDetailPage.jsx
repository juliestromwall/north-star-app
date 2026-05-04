import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Mail, Phone, MapPin, Users, Baby, Stethoscope, FileText,
  Calendar, ClipboardList, Copy, Check, CheckCircle2, MessageSquare, Heart, UserCog, Egg, Milestone, Circle, Printer, UserPlus, Loader2, Send, FileCheck, Plus,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select as SelectUI, SelectContent as SelectContentUI, SelectItem as SelectItemUI, SelectTrigger as SelectTriggerUI, SelectValue as SelectValueUI } from '@/components/ui/select'
import ProfileAvatar from '@/components/shared/ProfileAvatar'
import InfoRow from '@/components/shared/InfoRow'
import EmptyState from '@/components/shared/EmptyState'
import { DocumentsTab } from '@/pages/surrogates/SurrogateDetailPage'
import StageBadge from '@/components/shared/StageBadge'
import AISummaryButton from '@/components/shared/AISummaryButton'
import IPProfileTab from '@/components/intended-parents/IPProfileTab'
import IPApplicationTab from '@/components/intended-parents/IPApplicationTab'
import { useRole } from '@/context/RoleContext'
import { useDrafts } from '@/context/DraftContext'
import { getAuthHeaders } from '@/lib/authHeaders'
import { IP_STAGES, IP_STAGE_LABELS } from '@/lib/constants'
import { getSurrogateStageStatus, setSurrogateStageStatus, getStatusesForStage, getDefaultStatus } from '@/lib/stageStatusStore'
import { fetchIPsFromIntake, updateIntakeSubmission, assignSurrogateToAdmin, getPortraitPhotoUrl } from '@/lib/db'
import { getAdminStaff } from '@/data/mock/users'
import CaseEmailsTab from '@/components/shared/CaseEmailsTab'
import QuickNote from '@/components/shared/QuickNote'
import JourneyUpdateButton from '@/components/shared/JourneyUpdateButton'
import SortableTabsList from '@/components/shared/SortableTabsList'
import PreviousMatchTab from '@/components/shared/PreviousMatchTab'
import CaseTasksWidget from '@/components/shared/CaseTasksWidget'
import CaseCalendarWidget from '@/components/shared/CaseCalendarWidget'
import { findJourneyByCaseId, fetchCompletedJourneys, startNewCaseFromJourney } from '@/lib/matching'
import { inviteUser } from '@/lib/invite'
import TrackingTable from '@/components/shared/TrackingTable'
import JourneyChecklistView from '@/components/journeys/JourneyChecklistView'
import MatchNotesDialog, { MatchNotesPreview } from '@/components/shared/MatchNotesDialog'
import { getChecklistSteps, getChecklistMilestones, CHECKLIST_STEP_STATUSES } from '@/lib/checklistStore'
import { getRecordTracking, setRecordTracking as setRecordTrackingDB } from '@/lib/db'

function boolLabel(val, yesText = 'Yes', noText = 'No') {
  if (val === true || val === 'yes' || val === 'Yes') return yesText
  if (val === false || val === 'no' || val === 'No') return noText
  return '—'
}

// ── Main Page ───────────────────────────────────────────
export default function IPDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { currentUser } = useRole()
  const { openDraft } = useDrafts()
  const [ip, setIp] = useState(null)
  const [ipPortraitUrl, setIpPortraitUrl] = useState(null)
  const [loading, setLoading] = useState(true)
  const [emailMenuOpen, setEmailMenuOpen] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [inviteResult, setInviteResult] = useState(null)
  const [portalStatus, setPortalStatus] = useState(null)
  const [invitingPartner, setInvitingPartner] = useState(false)
  const [partnerInviteResult, setPartnerInviteResult] = useState(null)
  const [releasingApp, setReleasingApp] = useState(false)
  const [showReleaseModal, setShowReleaseModal] = useState(false)
  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false)
  const [portalStatus2, setPortalStatus2] = useState(null)
  const [stageStatus, setStageStatus] = useState({ stage: 'pre-qualification', status: 'New' })
  const [unreadEmailCount, setUnreadEmailCount] = useState(0)
  const [taskAttentionCount, setTaskAttentionCount] = useState(0)
  const [apptAttentionCount, setApptAttentionCount] = useState(0)
  const tasksApptsAttention = taskAttentionCount + apptAttentionCount
  const [stageOpen, setStageOpen] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const [matchNotesOpen, setMatchNotesOpen] = useState(false)
  const [sillyGooseOpen, setSillyGooseOpen] = useState(false)
  // Latest completed journey for this IP — drives the "Start Sibling Journey"
  // button. Only the most recent one matters; older completions keep their
  // own previous-match history.
  const [completedJourney, setCompletedJourney] = useState(null)
  const [startingSibling, setStartingSibling] = useState(false)

  // Don't let the admin invite an IP to the portal until a case owner
  // is assigned — otherwise the IP's dashboard has no coordinator to
  // display. Returns true if assignment is present, false if blocked.
  function ensureAssignedBeforeInvite() {
    if (ip?.assignedTo) return true
    setSillyGooseOpen(true)
    return false
  }
  const [recordTracking, setRecordTracking] = useState(() => {
    try {
      const saved = localStorage.getItem(`abc_records_${id}`)
      return saved ? JSON.parse(saved) : {}
    } catch { return {} }
  })

  useEffect(() => {
    // Check if this case is matched — redirect to journey
    findJourneyByCaseId(Number(id)).then(journeyId => {
      if (journeyId) { navigate(`/journeys/${journeyId}`, { replace: true }); return }
    }).catch(() => {})

    fetchIPsFromIntake().then(all => {
      const found = all.find(item => String(item.id) === String(id))
      setIp(found || null)
      if (found) {
        setStageStatus(getSurrogateStageStatus(found.id))
        // Load portrait photo (stored at ip-{caseId}/portrait/)
        getPortraitPhotoUrl(`ip-${found.id}`).then(url => { if (url) setIpPortraitUrl(url) }).catch(() => {})
      }
      setLoading(false)
    }).catch(() => setLoading(false))

    // Look up any completed journey this IP has had — enables the
    // "Start Sibling Journey" action below.
    fetchCompletedJourneys().then(list => {
      const mine = (list || []).find(j => String(j.ip_case_id) === String(id))
      if (mine) setCompletedJourney(mine)
    }).catch(() => {})
  }, [id])

  async function handleStartSiblingJourney() {
    if (!completedJourney) return
    setStartingSibling(true)
    try {
      const newCase = await startNewCaseFromJourney({
        fromCaseId: ip.id,
        journeyId: completedJourney.id,
        createdBy: currentUser.name,
      })
      if (newCase?.id) {
        window.location.href = `/intended-parents/${newCase.id}`
      } else {
        setStartingSibling(false)
      }
    } catch (err) {
      alert('Failed to start sibling journey: ' + (err.message || ''))
      setStartingSibling(false)
    }
  }

  // Check portal status
  useEffect(() => {
    if (ip?.email) {
      getAuthHeaders({ 'Content-Type': 'application/json' })
        .then(headers => fetch('/api/user-status', { method: 'POST', headers, body: JSON.stringify({ email: ip.email }) }))
        .then(r => r.json()).then(setPortalStatus).catch(() => {})
    }
    if (ip?.ip2Email) {
      getAuthHeaders({ 'Content-Type': 'application/json' })
        .then(headers => fetch('/api/user-status', { method: 'POST', headers, body: JSON.stringify({ email: ip.ip2Email }) }))
        .then(r => r.json()).then(setPortalStatus2).catch(() => {})
    }
  }, [ip?.email, ip?.ip2Email])

  // Load tracking from Supabase on mount
  useEffect(() => {
    getRecordTracking(id).then(data => {
      if (data && Object.keys(data).length > 0) setRecordTracking(data)
    }).catch(() => {})
  }, [id])

  // Persist record tracking
  useEffect(() => {
    if (Object.keys(recordTracking).length > 0) {
      localStorage.setItem(`abc_records_${id}`, JSON.stringify(recordTracking))
      setRecordTrackingDB(id, recordTracking).catch(() => {})
    }
  }, [recordTracking, id])

  function updateRecord(recordId, updates) {
    setRecordTracking(prev => ({
      ...prev,
      [recordId]: { ...(prev[recordId] || {}), ...updates }
    }))
  }

  if (loading) {
    return <div className="text-center py-12 text-stone-400">Loading...</div>
  }

  if (!ip) {
    return (
      <div className="space-y-6">
        <Link to="/intended-parents" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Back to Intended Parents
        </Link>
        <EmptyState title="Intended Parent not found" description="This case doesn't exist." />
      </div>
    )
  }

  const a = ip.answers || {}
  const hasPartner = a.hasPartner === 'yes' || a.hasPartner === true

  return (
    <div className="space-y-6">
      <Link to="/intended-parents" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Back to Intended Parents
      </Link>

      {/* ─── Hero Section ─────────────────────────────────── */}
      <div className="rounded-2xl border border-stone-200/80 bg-white">
        <div className="p-6 space-y-6">
          {/* Name row */}
          <div className="flex flex-col sm:flex-row items-start gap-5">
            <ProfileAvatar name={ip.names} avatar={ipPortraitUrl} size="xl" className="ring-4 ring-white shadow-lg" />
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-heading font-bold text-stone-900">{ip.names}</h1>
                <StageBadge stage={stageStatus.stage} status={stageStatus.status} caseType="ip" />
                {completedJourney && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Completed Journey
                  </span>
                )}
                <AISummaryButton caseId={ip.id} caseName={ip.names || ip.name} caseType="ip" stage={stageStatus.stage} status={stageStatus.status} />
                {completedJourney && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                    disabled={startingSibling}
                    onClick={handleStartSiblingJourney}
                    title="Create a new IP case prefilled from this one — for a sibling journey"
                  >
                    {startingSibling ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
                    {startingSibling ? 'Creating...' : 'Start Sibling Journey'}
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-stone-500">
                {ip.location && (
                  <span className="flex items-center gap-1"><MapPin className="size-3.5" /> {ip.location}{ip.country && ip.country !== 'United States' ? `, ${ip.country}` : ''}</span>
                )}
                <span className="flex items-center gap-1">
                  <Calendar className="size-3.5" />
                  Submitted {new Date(ip.submittedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
              {/* Assignment */}
              <div className="flex items-center gap-1.5 mt-2">
                <UserCog className="size-3.5 text-stone-400" />
                <span className="text-xs text-stone-400">Assigned to</span>
                <SelectUI
                  value={ip.assignedTo || '_unassigned'}
                  onValueChange={async val => {
                    const email = val === '_unassigned' ? null : val
                    await assignSurrogateToAdmin(ip.id, email).catch(() => {})
                    setIp(prev => ({ ...prev, assignedTo: email }))
                  }}
                >
                  <SelectTriggerUI className="h-7 text-xs font-semibold border-none shadow-none px-1 w-auto min-w-24 text-[#283693]">
                    <SelectValueUI />
                  </SelectTriggerUI>
                  <SelectContentUI>
                    <SelectItemUI value="_unassigned">Unassigned</SelectItemUI>
                    {getAdminStaff().map(s => (
                      <SelectItemUI key={s.email} value={s.email}>{s.name}</SelectItemUI>
                    ))}
                  </SelectContentUI>
                </SelectUI>
              </div>
            </div>

            {/* Contact buttons */}
            <div className="flex gap-1.5 shrink-0">
              {ip.phone && (
                <Button size="icon" title="Text" className="size-8 rounded-full" asChild>
                  <a href={`sms:${ip.phone}`}><MessageSquare className="size-3.5" /></a>
                </Button>
              )}
              {ip.email && (() => {
                const allEmails = [ip.email, ip.ip2Email].filter(Boolean).join(', ')
                const a = ip.answers || {}
                const ip1Name = `${a.primaryFirstName || ''} ${a.primaryLastName || ''}`.trim()
                const ip2Name = (a.hasPartner === true || a.hasPartner === 'yes') ? `${a.ip2FirstName || ''} ${a.ip2LastName || ''}`.trim() : ''
                const emailLabel = ip2Name ? `Email ${ip1Name} & ${ip2Name}` : `Email ${ip1Name || 'IP'}`
                return (
                  <div className="relative">
                    <Button size="icon" title="Email" className="size-8 rounded-full bg-white border border-stone-200 text-stone-600 hover:bg-stone-50" onClick={() => setEmailMenuOpen(!emailMenuOpen)}>
                      <Mail className="size-3.5" />
                    </Button>
                    {emailMenuOpen && (
                      <div className="absolute z-20 top-full right-0 mt-1 w-64 bg-white rounded-xl shadow-xl border py-1.5">
                        <button className="w-full text-left px-3 py-2 text-sm hover:bg-stone-50 flex items-center gap-2"
                          onClick={() => { openDraft({ to: allEmails, userId: currentUser.id, caseId: ip.id, caseType: 'ip' }); setEmailMenuOpen(false) }}>
                          <Mail className="size-3.5 text-[#283693]" /> {emailLabel}
                        </button>
                        <button className="w-full text-left px-3 py-2 text-sm hover:bg-stone-50 flex items-center gap-2"
                          onClick={() => { navigator.clipboard.writeText(allEmails); setEmailMenuOpen(false) }}>
                          <Copy className="size-3.5 text-stone-400" /> Copy Email Address{ip.ip2Email ? 'es' : ''}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })()}
              {ip.phone && (
                <Button size="icon" title="Call" className="size-8 rounded-full bg-white border border-stone-200 text-stone-600 hover:bg-stone-50" asChild>
                  <a href={`tel:${ip.phone}`}><Phone className="size-3.5" /></a>
                </Button>
              )}
              <JourneyUpdateButton caseId={ip.id} caseType="ip" caseName={ip.names} />
              {/* Profile submission / approval / application-release status */}
              {(() => {
                const a = ip.answers || {}
                const isApproved = !!a._ipProfile?._approved
                const appSubmitted = !!a._applicationSubmitted
                const appReleased = !!a._applicationAvailable
                const profileSubmittedLocked = a._profileSubmitted && !a._profileReleasedAt && !isApproved
                const profileReopened = a._profileSubmitted && a._profileReleasedAt && !isApproved

                // Approved + app not yet released → show Release Application action button
                if (isApproved && !appReleased) {
                  return (
                    <div className="flex flex-col items-center gap-0.5">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                        disabled={releasingApp}
                        onClick={() => setShowReleaseModal(true)}>
                        {releasingApp ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                        {releasingApp ? 'Releasing...' : 'Release Application'}
                      </Button>
                      <span className="text-[10px] text-stone-400">Approved {a._ipProfile?._approvedAt ? new Date(a._ipProfile._approvedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}</span>
                    </div>
                  )
                }
                // App submitted → emerald status
                if (appSubmitted) {
                  return (
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-1">
                        <FileCheck className="size-3" /> Application Submitted
                      </span>
                      {a._applicationSubmittedAt && (
                        <span className="text-[10px] text-stone-400">Submitted {new Date(a._applicationSubmittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                      )}
                    </div>
                  )
                }
                // App released, awaiting submission
                if (appReleased && !appSubmitted) {
                  return (
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-[10px] text-blue-600 font-medium flex items-center gap-1">
                        <Send className="size-3" /> Application Released
                      </span>
                      {a._applicationReleasedAt && (
                        <span className="text-[10px] text-stone-400">Released {new Date(a._applicationReleasedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                      )}
                    </div>
                  )
                }
                // Profile submitted, waiting for admin review
                if (profileSubmittedLocked) {
                  return (
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-[10px] text-blue-600 font-medium flex items-center gap-1">
                        <Send className="size-3" /> Profile Submitted
                      </span>
                      {a._profileSubmittedAt && (
                        <span className="text-[10px] text-stone-400">Submitted {new Date(a._profileSubmittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                      )}
                    </div>
                  )
                }
                // Profile reopened
                if (profileReopened) {
                  return (
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-[10px] text-amber-600 font-medium">Profile reopened for edits</span>
                      <span className="text-[10px] text-stone-400">Released {new Date(a._profileReleasedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    </div>
                  )
                }
                return null
              })()}
              {/* Invite / Portal status — primary IP */}
              {portalStatus?.exists && portalStatus?.lastSignIn ? (
                <div className="flex flex-col items-center">
                  <span className="text-[10px] text-emerald-600 font-medium">Portal Active</span>
                  <span className="text-[10px] text-stone-400">Last login {new Date(portalStatus.lastSignIn).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                </div>
              ) : portalStatus?.exists && !portalStatus?.lastSignIn ? (
                <div className="flex flex-col items-center gap-0.5">
                  <Button variant="outline" size="sm" className="gap-1.5 text-amber-600 border-amber-200 hover:bg-amber-50" disabled={inviting}
                    onClick={async () => {
                      if (!ip.email) return
                      if (!ensureAssignedBeforeInvite()) return
                      setInviting(true); setInviteResult(null)
                      try {
                        const res = await fetch('/api/ip-invite', {
                          method: 'POST', headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ email: ip.email, name: ip.names, firstName: a.primaryFirstName || '' }),
                        })
                        const data = await res.json()
                        setInviteResult(res.ok && data.emailSent ? 'sent' : 'error')
                        if (res.ok) {
                          try {
                            const { supabase } = await import('@/lib/supabase')
                            if (supabase) {
                              const { data: row } = await supabase.from('intake_submissions').select('answers').eq('id', ip.id).single()
                              if (row) {
                                await supabase.from('intake_submissions').update({ answers: { ...(row.answers || {}), _lastInvitedAt: new Date().toISOString(), _invitedBy: currentUser.name } }).eq('id', ip.id)
                              }
                            }
                            setIp(prev => ({ ...prev, answers: { ...prev.answers, _lastInvitedAt: new Date().toISOString(), _invitedBy: currentUser.name } }))
                          } catch {}
                        }
                      } catch { setInviteResult('error') }
                      setInviting(false)
                      setTimeout(() => setInviteResult(null), 4000)
                    }}>
                    {inviting ? <Loader2 className="size-3.5 animate-spin" /> : <UserPlus className="size-3.5" />}
                    {inviting ? 'Sending...' : inviteResult === 'sent' ? 'Sent!' : inviteResult === 'error' ? 'Send failed' : 'Resend Invite'}
                  </Button>
                  <span className="text-[10px] text-amber-500">Hasn't logged in yet</span>
                  {ip.answers?._lastInvitedAt && (
                    <span className="text-[10px] text-stone-400">Invited {new Date(ip.answers._lastInvitedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-0.5">
                  <Button variant="outline" size="sm" className="gap-1.5" disabled={inviting}
                    onClick={async () => {
                      if (!ip.email) return
                      if (!ensureAssignedBeforeInvite()) return
                      setInviting(true); setInviteResult(null)
                      try {
                        const res = await fetch('/api/ip-invite', {
                          method: 'POST', headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ email: ip.email, name: ip.names, firstName: a.primaryFirstName || '' }),
                        })
                        const data = await res.json()
                        if (!res.ok) throw new Error(data.error || 'Invite failed')
                        setInviteResult(data.emailSent ? 'sent' : 'error')
                        try {
                          const { supabase } = await import('@/lib/supabase')
                          if (supabase) {
                            const { data: row } = await supabase.from('intake_submissions').select('answers').eq('id', ip.id).single()
                            if (row) {
                              await supabase.from('intake_submissions').update({ answers: { ...(row.answers || {}), _lastInvitedAt: new Date().toISOString(), _invitedBy: currentUser.name } }).eq('id', ip.id)
                            }
                          }
                          setIp(prev => ({ ...prev, answers: { ...prev.answers, _lastInvitedAt: new Date().toISOString(), _invitedBy: currentUser.name } }))
                        } catch {}
                      } catch { setInviteResult('error') }
                      setInviting(false)
                      setTimeout(() => setInviteResult(null), 4000)
                    }}>
                    {inviting ? <Loader2 className="size-3.5 animate-spin" /> : <UserPlus className="size-3.5" />}
                    {inviting ? 'Inviting...' : inviteResult === 'sent' ? 'Invited!' : inviteResult === 'error' ? 'Send failed' : 'Invite to Portal'}
                  </Button>
                  {ip.answers?._lastInvitedAt && (
                    <span className="text-[10px] text-stone-400">Invited {new Date(ip.answers._lastInvitedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  )}
                </div>
              )}
              {/* Partner invite */}
              {hasPartner && ip.ip2Email && (
                <div className="flex flex-col items-center gap-0.5 ml-2 pl-2 border-l border-stone-200">
                  {portalStatus2?.exists && portalStatus2?.lastSignIn ? (
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-1">Partner Portal Active</span>
                      <span className="text-[10px] text-stone-400">Last login {new Date(portalStatus2.lastSignIn).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                  ) : portalStatus2?.exists && !portalStatus2?.lastSignIn ? (
                    <>
                      <Button variant="outline" size="sm" className="gap-1.5 text-[10px] h-7 text-amber-600 border-amber-200 hover:bg-amber-50" disabled={invitingPartner}
                        onClick={async () => {
                          if (!ip.ip2Email) return
                          if (!ensureAssignedBeforeInvite()) return
                          setInvitingPartner(true); setPartnerInviteResult(null)
                          try {
                            const res = await fetch('/api/ip-invite', {
                              method: 'POST', headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ email: ip.ip2Email, name: ip.ip2Name, firstName: a.ip2FirstName || '' }),
                            })
                            const data = await res.json()
                            setPartnerInviteResult(res.ok && data.emailSent ? 'sent' : 'error')
                            if (res.ok) {
                              try {
                                const { supabase } = await import('@/lib/supabase')
                                if (supabase) {
                                  const { data: row } = await supabase.from('intake_submissions').select('answers').eq('id', ip.id).single()
                                  if (row) {
                                    await supabase.from('intake_submissions').update({ answers: { ...(row.answers || {}), _partnerInvitedAt: new Date().toISOString() } }).eq('id', ip.id)
                                  }
                                }
                              } catch {}
                            }
                          } catch { setPartnerInviteResult('error') }
                          setInvitingPartner(false)
                          setTimeout(() => setPartnerInviteResult(null), 4000)
                        }}>
                        {invitingPartner ? <Loader2 className="size-3.5 animate-spin" /> : <UserPlus className="size-3.5" />}
                        {invitingPartner ? 'Sending...' : partnerInviteResult === 'sent' ? 'Sent!' : partnerInviteResult === 'error' ? 'Send failed' : 'Resend Invite'}
                      </Button>
                      <span className="text-[10px] text-amber-500">Hasn't logged in yet</span>
                      {ip.answers?._partnerInvitedAt && (
                        <span className="text-[10px] text-stone-400">Invited {new Date(ip.answers._partnerInvitedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      )}
                    </>
                  ) : (
                    <Button variant="outline" size="sm" className="gap-1.5 text-[10px] h-7" disabled={invitingPartner}
                      onClick={async () => {
                        if (!ensureAssignedBeforeInvite()) return
                        setInvitingPartner(true); setPartnerInviteResult(null)
                        try {
                          const res = await fetch('/api/ip-invite', {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ email: ip.ip2Email, name: ip.ip2Name, firstName: a.ip2FirstName || '' }),
                          })
                          const data = await res.json()
                          if (!res.ok) throw new Error(data.error || 'Invite failed')
                          setPartnerInviteResult(data.emailSent ? 'sent' : 'error')
                          try {
                            const { supabase } = await import('@/lib/supabase')
                            if (supabase) {
                              const { data: row } = await supabase.from('intake_submissions').select('answers').eq('id', ip.id).single()
                              if (row) {
                                await supabase.from('intake_submissions').update({ answers: { ...(row.answers || {}), _partnerInvitedAt: new Date().toISOString() } }).eq('id', ip.id)
                              }
                            }
                          } catch {}
                        } catch { setPartnerInviteResult('error') }
                        setInvitingPartner(false)
                        setTimeout(() => setPartnerInviteResult(null), 4000)
                      }}>
                      {invitingPartner ? <Loader2 className="size-3.5 animate-spin" /> : <UserPlus className="size-3.5" />}
                      {invitingPartner ? 'Sending...' : partnerInviteResult === 'sent' ? 'Sent!' : partnerInviteResult === 'error' ? 'Send failed' : 'Invite Partner'}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Info tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
            {(() => {
              const calcAge = (dob) => { if (!dob) return null; const d = new Date(dob); return Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 60 * 60 * 1000)) }
              const age1 = calcAge(a.primaryDob)
              const age2 = hasPartner ? calcAge(a.ip2Dob) : null
              const ageDisplay = age1 && age2 ? `${age1} / ${age2}` : age1 ? `${age1}` : '—'
              return [
              { icon: Calendar, label: hasPartner ? 'Ages' : 'Age', value: ageDisplay },
              { icon: Heart, label: 'Relationship', value: a.maritalStatus || '—' },
              { icon: Stethoscope, label: 'RE Doctor', value: ip.hasRE ? (ip.reDoctorName || 'Yes') : '—' },
              { icon: Baby, label: 'Embryos', value: ip.hasFrozenEmbryos ? (ip.frozenEmbryoDetails || 'Yes') : boolLabel(ip.hasFrozenEmbryos) },
            ].map(tile => (
              <div key={tile.label} className="rounded-xl bg-stone-50/80 border border-stone-100 p-3 text-center">
                <tile.icon className="size-4 text-stone-300 mx-auto mb-1" />
                <p className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold">{tile.label}</p>
                <p className="text-lg font-bold mt-0.5 leading-tight text-stone-800">{tile.value}</p>
              </div>
            ))
            })()}

            {/* Stage — clickable selector */}
            {(() => {
              const currentStageObj = IP_STAGES.find(s => s.id === stageStatus.stage) || IP_STAGES[0]
              const caseStages = IP_STAGES.filter(s => !s.hidden)
              return (
                <div className="relative">
                  <div
                    className="rounded-xl bg-stone-50/80 border border-stone-100 p-3 text-center cursor-pointer hover:border-stone-300 hover:shadow-sm transition-all"
                    onClick={() => { setStageOpen(!stageOpen); setStatusOpen(false) }}
                  >
                    <Milestone className="size-4 text-stone-300 mx-auto mb-1" />
                    <p className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold">Stage</p>
                    <p className="text-lg font-bold mt-0.5 leading-tight" style={{ color: currentStageObj.color }}>
                      {IP_STAGE_LABELS[stageStatus.stage] || currentStageObj.label}
                    </p>
                  </div>
                  {stageOpen && (
                    <div className="absolute z-30 top-full left-0 mt-1 w-56 bg-white rounded-xl shadow-xl border border-stone-200 py-2" onClick={e => e.stopPropagation()}>
                      {caseStages.map((stage, i) => (
                        <button
                          key={stage.id}
                          className={`w-full text-left px-4 py-2 text-sm hover:bg-stone-50 flex items-center gap-2 ${stageStatus.stage === stage.id ? 'font-bold' : ''}`}
                          style={stageStatus.stage === stage.id ? { color: stage.color, backgroundColor: stage.color + '10' } : {}}
                          onClick={e => {
                            e.stopPropagation()
                            setStageOpen(false)
                            // Withdrawn revokes portal access — confirm with admin first.
                            if (stage.id === 'withdrawn' && stageStatus.stage !== 'withdrawn') {
                              setShowWithdrawConfirm(true)
                              return
                            }
                            const newStatus = getDefaultStatus(stage.id, 'ip')
                            setSurrogateStageStatus(ip.id, stage.id, newStatus)
                            setStageStatus({ stage: stage.id, status: newStatus })
                          }}
                        >
                          <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ backgroundColor: stage.color }}>{i + 1}</span>
                          {IP_STAGE_LABELS[stage.id] || stage.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })()}

            {/* Status — clickable selector */}
            {(() => {
              const currentStageObj = IP_STAGES.find(s => s.id === stageStatus.stage) || IP_STAGES[0]
              const availableStatuses = getStatusesForStage(stageStatus.stage, 'ip')
              return (
                <div className="relative">
                  <div
                    className="rounded-xl bg-stone-50/80 border border-stone-100 p-3 text-center cursor-pointer hover:border-stone-300 hover:shadow-sm transition-all"
                    onClick={() => { setStatusOpen(!statusOpen); setStageOpen(false) }}
                  >
                    {stageStatus.status === 'New' ? (
                      <span className="relative flex size-4 mx-auto mb-1">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75" />
                        <span className="relative inline-flex rounded-full size-4 bg-pink-500" />
                      </span>
                    ) : (
                      <Circle className="size-4 text-stone-300 mx-auto mb-1" />
                    )}
                    <p className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold">Status</p>
                    <p className="text-lg font-bold mt-0.5 leading-tight text-stone-800">{stageStatus.status}</p>
                  </div>
                  {statusOpen && (
                    <div className="absolute z-30 top-full right-0 mt-1 w-56 bg-white rounded-xl shadow-xl border border-stone-200 py-2 max-h-64 overflow-y-auto" onClick={e => e.stopPropagation()}>
                      {availableStatuses.map(status => (
                        <button
                          key={status}
                          className={`w-full text-left px-4 py-2 text-sm hover:bg-stone-50 flex items-center gap-2 ${stageStatus.status === status ? 'font-bold' : ''}`}
                          onClick={e => {
                            e.stopPropagation()
                            setSurrogateStageStatus(ip.id, stageStatus.stage, status)
                            setStageStatus(prev => ({ ...prev, status }))
                            setStatusOpen(false)
                          }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: currentStageObj.color }} />
                          {status}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })()}
          </div>

          {/* Match Notes */}
          <MatchNotesPreview
            notes={a._matchNotes}
            onClick={() => setMatchNotesOpen(true)}
          />
        </div>
      </div>

      {/* Match Notes Dialog */}
      <MatchNotesDialog
        open={matchNotesOpen}
        onOpenChange={setMatchNotesOpen}
        caseId={ip.id}
        answers={a}
        currentUser={currentUser}
        onSaved={(updated) => setIp(prev => ({ ...prev, answers: updated }))}
      />

      {/* Quick Note */}
      <QuickNote caseId={ip.id} caseType="ip" />

      {/* ─── Tabs ─────────────────────────────────────────── */}
      <Tabs defaultValue="overview">
        <SortableTabsList configKey={`ip_${ip.id}`} tabs={[
          { value: 'overview', label: 'Checklist' },
          { value: 'tasks-appts', label: <span className="flex items-center gap-1.5">Tasks / Appts{tasksApptsAttention > 0 && <span className="relative flex size-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75" /><span className="relative inline-flex rounded-full size-2 bg-pink-500" /></span>}</span> },
          { value: 'application', label: 'Application' },
          { value: 'profile', label: 'Profile' },
          { value: 'documents', label: 'Documents' },
          { value: 'texts', label: 'Texts' },
          { value: 'emails', label: <span className="flex items-center gap-1.5">Emails{unreadEmailCount > 0 && <span className="relative flex size-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75" /><span className="relative inline-flex rounded-full size-2 bg-pink-500" /></span>}</span> },
          { value: 'notes', label: 'Notes' },
          ...(ip?.answers?._matchHistory?.length ? [{ value: 'previous-match', label: 'Previous Match' }] : []),
        ]} />

        {/* Checklist Tab (was "Overview") — milestone timeline removed in favor
            of the new card-based JourneyChecklistView; per-step status + history
            are now inline on each card. */}
        <TabsContent value="overview" className="space-y-6 mt-4">
          {(() => {
            const currentStageId = stageStatus?.stage || 'pre-qualification'
            const currentStageLabel = IP_STAGES.find(s => s.id === currentStageId)?.label || 'Consultation'
            const allSteps = getChecklistSteps('ip', currentStageId)
            return (
              <JourneyChecklistView
                steps={allSteps}
                tracking={recordTracking}
                onUpdate={updateRecord}
                currentUserName={currentUser.name}
                stageLabel={`${currentStageLabel} Checklist`}
              />
            )
          })()}
        </TabsContent>

        {/* Tasks / Appts — split out from the old Overview. Force-mounted so
            the widgets fetch on page load and the tab attention dot is
            populated even before the user clicks in. */}
        <TabsContent value="tasks-appts" className="mt-4 data-[state=inactive]:hidden" forceMount>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <CaseCalendarWidget
              caseId={ip.id}
              caseType="ip"
              caseName={ip.names}
              onAttentionCountChange={setApptAttentionCount}
            />
            <CaseTasksWidget
              caseId={ip.id}
              caseType="ip"
              caseName={ip.names}
              onAttentionCountChange={setTaskAttentionCount}
            />
          </div>
        </TabsContent>

        {/* Application Tab */}
        <TabsContent value="application" className="space-y-6 mt-4">
          <IPApplicationTab ip={ip} setIp={setIp} />
        </TabsContent>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-6 mt-4">
          <IPProfileTab
            ip={ip}
            onUpdate={async (updatedAnswers) => {
              try {
                await updateIntakeSubmission(ip.id, { answers: updatedAnswers })
                setIp(prev => ({ ...prev, answers: updatedAnswers }))
              } catch (err) {
                console.error('Failed to save IP profile:', err)
              }
            }}
          />
        </TabsContent>

        {/* Checklist tab removed — now in Overview */}

        {/* Documents Tab */}
        <TabsContent value="documents" className="space-y-6 mt-4">
          <DocumentsTab surrogateId={ip?.id} caseType="ip" />
        </TabsContent>

        {/* Texts Tab */}
        <TabsContent value="texts" className="space-y-6 mt-4">
          <EmptyState title="Text Messages" description="SMS messaging for intended parents coming soon." />
        </TabsContent>

        {/* Emails Tab */}
        <TabsContent value="emails" className="space-y-6 mt-4">
          <CaseEmailsTab caseId={ip?.id} caseType="ip" caseName={ip?.names} caseEmail={ip?.email} caseManagerName={getAdminStaff().find(a => a.email === ip?.assignedTo)?.name} contactEmails={[ip?.email, ip?.ip2Email].filter(Boolean)} onUnreadCount={setUnreadEmailCount} />
        </TabsContent>

        {/* Notes Tab */}
        <TabsContent value="notes" className="space-y-6 mt-4">
          <EmptyState title="Notes" description="Case notes for intended parents coming soon." />
        </TabsContent>

        {/* Previous Match Tab */}
        {ip?.answers?._matchHistory?.length > 0 && (
          <TabsContent value="previous-match" className="mt-4">
            <PreviousMatchTab matchHistory={ip.answers._matchHistory} />
          </TabsContent>
        )}
      </Tabs>

      {/* Silly goose: block invite flow when no admin is assigned */}
      <Dialog open={sillyGooseOpen} onOpenChange={setSillyGooseOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center text-[#283693]">Silly goose! 🪿</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1 text-center">
            <img
              src="https://media.tenor.com/Ym4iH4Mr7McAAAAM/silly-goose-silly-goose-moment.gif"
              alt="Silly goose moment"
              className="w-full max-w-[240px] mx-auto rounded-lg"
            />
            <p className="text-sm text-stone-700 leading-relaxed font-medium">
              You must first assign this case to an Admin before inviting the IP to the portal.
            </p>
            <p className="text-xs text-stone-500">
              Use the "Assigned To" dropdown on this case, then try the invite again.
            </p>
            <div className="flex justify-center pt-1">
              <Button size="sm" style={{ backgroundColor: '#283693', color: '#fff' }} onClick={() => setSillyGooseOpen(false)}>
                Got it
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Release Application confirmation modal */}
      <Dialog open={showReleaseModal} onOpenChange={(v) => !releasingApp && setShowReleaseModal(v)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="size-5 text-[#283693]" />
              Release application to {(() => {
                const a = ip?.answers || {}
                const n1 = a.primaryFirstName || ''
                const n2 = a.ip2FirstName || ''
                return n2 ? `${n1} & ${n2}` : (n1 || ip?.names || 'this IP')
              })()}?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <p className="text-sm text-stone-600 leading-relaxed">
              They'll get an email with a link to log in and complete the remaining application forms. You can reopen their profile for edits separately from the Profile tab if needed.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowReleaseModal(false)} disabled={releasingApp}>Cancel</Button>
              <Button
                size="sm"
                style={{ backgroundColor: '#283693', color: '#fff' }}
                className="gap-1.5"
                disabled={releasingApp}
                onClick={async () => {
                  const a = ip?.answers || {}
                  const ip1FirstName = a.primaryFirstName || ''
                  const ip2FirstName = a.ip2FirstName || ''
                  setReleasingApp(true)
                  const adminName = currentUser?.name || currentUser?.email || ''
                  try {
                    const { supabase } = await import('@/lib/supabase')
                    if (!supabase) throw new Error('No DB connection')
                    const updatedAnswers = {
                      ...a,
                      _applicationAvailable: true,
                      _applicationReleasedAt: new Date().toISOString(),
                      _applicationReleasedBy: adminName,
                    }
                    const { error } = await supabase
                      .from('intake_submissions')
                      .update({ answers: updatedAnswers })
                      .eq('id', ip.id)
                    if (error) throw error
                    setIp(prev => ({ ...prev, answers: updatedAnswers }))
                    try {
                      await fetch('/api/notify-ip-app-released', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          ip1Email: ip.email || a.email || '',
                          ip1FirstName,
                          ip2Email: a.ip2Email || '',
                          ip2FirstName,
                          adminName,
                        }),
                      })
                    } catch (err) { console.error('IP app-released email failed:', err) }
                    setShowReleaseModal(false)
                  } catch (err) {
                    alert(`Release failed: ${err.message || 'Unknown error'}`)
                  } finally { setReleasingApp(false) }
                }}>
                {releasingApp ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                {releasingApp ? 'Sending...' : 'Release & Send Email'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Withdraw stage confirmation — revokes portal access */}
      <Dialog open={showWithdrawConfirm} onOpenChange={setShowWithdrawConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700">
              <Milestone className="size-5" />
              Move {ip?.names || 'this IP'} to Withdrawn?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <p className="text-sm text-stone-600 leading-relaxed">
              Withdrawn IPs <strong>will lose access to the portal immediately on their next login attempt.</strong> Both the primary IP{ip?.ip2Email ? ' and the partner' : ''} will be blocked from signing in.
            </p>
            <p className="text-sm text-stone-500 leading-relaxed">
              You can move them back to an active stage at any time to restore access.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowWithdrawConfirm(false)}>Cancel</Button>
              <Button
                size="sm"
                className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
                onClick={() => {
                  const newStatus = getDefaultStatus('withdrawn', 'ip')
                  setSurrogateStageStatus(ip.id, 'withdrawn', newStatus)
                  setStageStatus({ stage: 'withdrawn', status: newStatus })
                  setShowWithdrawConfirm(false)
                }}>
                <Milestone className="size-3.5" /> Move to Withdrawn
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
