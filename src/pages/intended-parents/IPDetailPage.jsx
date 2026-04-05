import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Mail, Phone, MapPin, Users, Baby, Stethoscope, FileText,
  Calendar, ClipboardList, Copy, Check, MessageSquare, Heart, UserCog, Egg, Milestone, Circle, Printer, UserPlus, Loader2,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select as SelectUI, SelectContent as SelectContentUI, SelectItem as SelectItemUI, SelectTrigger as SelectTriggerUI, SelectValue as SelectValueUI } from '@/components/ui/select'
import ProfileAvatar from '@/components/shared/ProfileAvatar'
import InfoRow from '@/components/shared/InfoRow'
import EmptyState from '@/components/shared/EmptyState'
import { DocumentsTab } from '@/pages/surrogates/SurrogateDetailPage'
import StageBadge from '@/components/shared/StageBadge'
import IPProfileTab from '@/components/intended-parents/IPProfileTab'
import IPApplicationTab from '@/components/intended-parents/IPApplicationTab'
import { useRole } from '@/context/RoleContext'
import { useDrafts } from '@/context/DraftContext'
import { SURROGATE_STAGES, IP_STAGE_LABELS } from '@/lib/constants'
import { getSurrogateStageStatus, setSurrogateStageStatus, getStatusesForStage, getDefaultStatus } from '@/lib/stageStatusStore'
import { fetchIPsFromIntake, updateIntakeSubmission, assignSurrogateToAdmin } from '@/lib/db'
import { mockUsers } from '@/data/mock/users'
import CaseEmailsTab from '@/components/shared/CaseEmailsTab'
import SortableTabsList from '@/components/shared/SortableTabsList'
import PreviousMatchTab from '@/components/shared/PreviousMatchTab'
import CaseTasksWidget from '@/components/shared/CaseTasksWidget'
import CaseCalendarWidget from '@/components/shared/CaseCalendarWidget'
import { findJourneyByCaseId } from '@/lib/matching'
import { inviteUser } from '@/lib/invite'
import TrackingTable from '@/components/shared/TrackingTable'
import MatchNotesDialog, { MatchNotesPreview } from '@/components/shared/MatchNotesDialog'
import { getChecklistSteps, CHECKLIST_STEP_STATUSES } from '@/lib/checklistStore'
import { getRecordTracking, setRecordTracking as setRecordTrackingDB } from '@/lib/db'

const ADMIN_STAFF = mockUsers.filter(u => ['super_admin', 'master_admin', 'admin'].includes(u.role))

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
  const [loading, setLoading] = useState(true)
  const [emailMenuOpen, setEmailMenuOpen] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [inviteResult, setInviteResult] = useState(null)
  const [stageStatus, setStageStatus] = useState({ stage: 'pre-qualification', status: 'New' })
  const [stageOpen, setStageOpen] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const [matchNotesOpen, setMatchNotesOpen] = useState(false)
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
      if (found) setStageStatus(getSurrogateStageStatus(found.id))
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [id])

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
            <ProfileAvatar name={ip.names} size="xl" className="ring-4 ring-white shadow-lg" />
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-heading font-bold text-stone-900">{ip.names}</h1>
                <StageBadge stage={stageStatus.stage} status={stageStatus.status} />
                <Badge variant="outline" className="text-xs bg-sky-100 text-sky-800 border-sky-200">
                  {ip.type}
                </Badge>
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
                    {ADMIN_STAFF.map(s => (
                      <SelectItemUI key={s.email} value={s.email}>{s.name}</SelectItemUI>
                    ))}
                  </SelectContentUI>
                </SelectUI>
              </div>
            </div>

            {/* Contact buttons */}
            <div className="flex gap-2 shrink-0">
              {ip.phone && (
                <Button size="sm" className="gap-1.5" asChild>
                  <a href={`sms:${ip.phone}`}><MessageSquare className="size-3.5" /> Text</a>
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
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEmailMenuOpen(!emailMenuOpen)}>
                      <Mail className="size-3.5" /> Email
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
                <Button variant="outline" size="sm" className="gap-1.5" asChild>
                  <a href={`tel:${ip.phone}`}><Phone className="size-3.5" /> Call</a>
                </Button>
              )}
              <Button variant="outline" size="sm" className="gap-1.5" disabled={inviting}
                onClick={async () => {
                  if (!ip.email) return
                  setInviting(true); setInviteResult(null)
                  try {
                    await inviteUser(currentUser.id, { email: ip.email, name: ip.names, role: 'intended_parent', portalType: 'intended_parent' })
                    setInviteResult('sent')
                    try {
                      const { updateIntakeSubmission } = await import('@/lib/db')
                      await updateIntakeSubmission(ip.id, { answers: { ...ip.answers, _lastInvitedAt: new Date().toISOString(), _invitedBy: currentUser.name } })
                      setIp(prev => ({ ...prev, answers: { ...prev.answers, _lastInvitedAt: new Date().toISOString(), _invitedBy: currentUser.name } }))
                    } catch {}
                  } catch (err) {
                    setInviteResult(err.message?.includes('already') ? 'exists' : 'error')
                  }
                  setInviting(false)
                  setTimeout(() => setInviteResult(null), 4000)
                }}>
                {inviting ? <Loader2 className="size-3.5 animate-spin" /> : <UserPlus className="size-3.5" />}
                {inviting ? 'Inviting...' : inviteResult === 'sent' ? 'Invited!' : inviteResult === 'exists' ? 'Already has account' : 'Invite to Portal'}
              </Button>
              {ip.answers?._lastInvitedAt && (
                <span className="text-[10px] text-stone-400">Invited {new Date(ip.answers._lastInvitedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
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
              { icon: Users, label: 'Type', value: ip.type || '—' },
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
              const currentStageObj = SURROGATE_STAGES.find(s => s.id === stageStatus.stage) || SURROGATE_STAGES[0]
              const caseStages = SURROGATE_STAGES.filter(s => ['pre-qualification', 'screening', 'matching'].includes(s.id))
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
                            const newStatus = getDefaultStatus(stage.id, 'ip')
                            setSurrogateStageStatus(ip.id, stage.id, newStatus)
                            setStageStatus({ stage: stage.id, status: newStatus })
                            setStageOpen(false)
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
              const currentStageObj = SURROGATE_STAGES.find(s => s.id === stageStatus.stage) || SURROGATE_STAGES[0]
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

      {/* ─── Tabs ─────────────────────────────────────────── */}
      <Tabs defaultValue="overview">
        <SortableTabsList configKey={`ip_${ip.id}`} tabs={[
          { value: 'overview', label: 'Overview' },
          { value: 'application', label: 'Application' },
          { value: 'profile', label: 'Profile' },
          { value: 'checklist', label: 'Checklist' },
          { value: 'documents', label: 'Documents' },
          { value: 'texts', label: 'Texts' },
          { value: 'emails', label: 'Emails' },
          { value: 'notes', label: 'Notes' },
          ...(ip?.answers?._matchHistory?.length ? [{ value: 'previous-match', label: 'Previous Match' }] : []),
        ]} />

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="rounded-2xl">
              <CardHeader><CardTitle>Intended Parent 1</CardTitle></CardHeader>
              <CardContent className="space-y-1">
                <InfoRow icon={Users} label="Name" value={ip.ip1Name} />
                <InfoRow icon={Calendar} label="Date of Birth" value={a.primaryDob} />
                {ip.age && <InfoRow icon={Users} label="Age" value={`${ip.age}`} />}
                <InfoRow icon={Mail} label="Email" value={ip.email} />
                <InfoRow icon={Phone} label="Phone" value={ip.phone} />
              </CardContent>
            </Card>

            <Card className="rounded-2xl">
              <CardHeader><CardTitle>Intended Parent 2</CardTitle></CardHeader>
              <CardContent className="space-y-1">
                {hasPartner ? (
                  <>
                    <InfoRow icon={Users} label="Name" value={ip.ip2Name} />
                    <InfoRow icon={Calendar} label="Date of Birth" value={a.ip2Dob} />
                    <InfoRow icon={Mail} label="Email" value={ip.ip2Email} />
                    <InfoRow icon={Phone} label="Phone" value={ip.ip2Phone} />
                  </>
                ) : (
                  <p className="text-sm text-stone-400">No partner on this journey</p>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-2xl">
              <CardHeader><CardTitle>Fertility Details</CardTitle></CardHeader>
              <CardContent className="space-y-1">
                <InfoRow icon={Stethoscope} label="Has RE" value={boolLabel(ip.hasRE)} />
                {ip.hasRE && ip.reDoctorName && <InfoRow icon={Stethoscope} label="RE Doctor / Clinic" value={ip.reDoctorName} />}
                <InfoRow icon={Baby} label="Frozen Embryos" value={boolLabel(ip.hasFrozenEmbryos)} />
                {ip.hasFrozenEmbryos && ip.frozenEmbryoDetails && <InfoRow icon={Baby} label="Embryo Details" value={ip.frozenEmbryoDetails} />}
                <InfoRow icon={Egg} label="Using Egg Donor" value={boolLabel(ip.usingEggDonor)} />
                <InfoRow icon={Heart} label="Using Sperm Donor" value={boolLabel(ip.usingSpermDonor)} />
              </CardContent>
            </Card>

            <Card className="rounded-2xl">
              <CardHeader><CardTitle>Additional Details</CardTitle></CardHeader>
              <CardContent className="space-y-1">
                <InfoRow icon={ClipboardList} label="Wants Consultation" value={boolLabel(ip.wantsConsultation, 'Yes', 'Not right now')} />
                <InfoRow icon={ClipboardList} label="How They Heard" value={ip.hearAboutUs || '—'} />
              </CardContent>
            </Card>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <CaseCalendarWidget caseId={ip.id} caseType="ip" caseName={ip.names} />
            <CaseTasksWidget caseId={ip.id} caseType="ip" caseName={ip.names} />
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

        {/* Checklist Tab */}
        <TabsContent value="checklist" className="mt-4 space-y-6">
          {(() => {
            const currentStageId = stageStatus?.stage || 'pre-qualification'
            const currentStageLabel = SURROGATE_STAGES.find(s => s.id === currentStageId)?.label || 'Pre-Qualification'
            const allSteps = getChecklistSteps('ip', currentStageId)
            return (
              <TrackingTable
                title={`${currentStageLabel} Checklist`}
                steps={allSteps}
                statuses={CHECKLIST_STEP_STATUSES}
                tracking={recordTracking}
                onUpdate={updateRecord}
                currentUserName={currentUser.name}
              />
            )
          })()}
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents" className="space-y-6 mt-4">
          <div className="flex justify-end gap-2">
            <Button className="gap-1.5" style={{ backgroundColor: '#283693', color: '#fff' }}
              onClick={() => window.open(`/e-signature?caseType=ip&caseId=${id}`, '_blank')}>
              <FileText className="size-4" /> Send for Signature
            </Button>
            <Button variant="outline" className="gap-1.5"
              onClick={() => window.open(`/fax?caseType=ip&caseId=${id}`, '_blank')}>
              <Printer className="size-4" /> Send Fax
            </Button>
          </div>
          <DocumentsTab surrogateId={ip?.id} />
        </TabsContent>

        {/* Texts Tab */}
        <TabsContent value="texts" className="space-y-6 mt-4">
          <EmptyState title="Text Messages" description="SMS messaging for intended parents coming soon." />
        </TabsContent>

        {/* Emails Tab */}
        <TabsContent value="emails" className="space-y-6 mt-4">
          <CaseEmailsTab caseId={ip?.id} />
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
    </div>
  )
}
