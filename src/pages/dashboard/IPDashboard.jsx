import { useState, useEffect } from 'react'
import { useRole } from '@/context/RoleContext'
import PageHeader from '@/components/shared/PageHeader'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import { Heart, FileText, ArrowRight, Loader2, User, Mail, Phone, MapPin, CheckCircle2, Clock, ClipboardList, ChevronDown, AlertCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { findCaseByEmail, fetchUserTasks, updateTaskStatus, fetchIntakeByEmail } from '@/lib/db'

// ── Task components (same as surrogate dashboard) ──

function TaskCard({ task, onStatusChange }) {
  const isPending = task.status === 'pending'
  const isInProgress = task.status === 'in_progress'

  return (
    <div className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
      isPending ? 'border-[#283693]/30 bg-[#283693]/5' : 'border-stone-200 bg-white'
    }`}>
      <div className={`flex items-center justify-center w-10 h-10 rounded-xl shrink-0 ${
        isPending ? 'bg-[#283693]/10' : 'bg-stone-100'
      }`}>
        <ClipboardList className={`w-5 h-5 ${isPending ? 'text-[#283693]' : 'text-stone-500'}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-stone-800 text-sm">{task.title}</p>
        {task.description && <p className="text-xs text-stone-500 mt-0.5">{task.description}</p>}
        {task.due_date && (
          <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
            <Clock className="w-3 h-3" /> Due {new Date(task.due_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </p>
        )}
      </div>
      {isPending && (
        <Button size="sm" className="rounded-lg text-xs gap-1.5 shrink-0" style={{ backgroundColor: '#283693', color: '#fff' }}
          onClick={() => onStatusChange(task.id, 'in_progress')}>
          Start <ArrowRight className="w-3.5 h-3.5" />
        </Button>
      )}
      {isInProgress && (
        <Button size="sm" className="rounded-lg text-xs gap-1.5 shrink-0" style={{ backgroundColor: '#283693', color: '#fff' }}
          onClick={() => onStatusChange(task.id, 'completed')}>
          <CheckCircle2 className="w-3.5 h-3.5" /> Mark Done
        </Button>
      )}
    </div>
  )
}

function CompletedTaskRow({ task }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
      <span className="text-sm text-stone-500 line-through">{task.title}</span>
      {task.completed_at && (
        <span className="text-xs text-stone-400 ml-auto shrink-0">
          {new Date(task.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </span>
      )}
    </div>
  )
}

// ── Intake answer display ──

function QuizAnswerRow({ label, value }) {
  if (value === undefined || value === null || value === '') return null
  return (
    <div>
      <span className="text-stone-400">{label}</span>
      <p className="font-medium">{typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value}</p>
    </div>
  )
}

function IPAnswerDetail({ answers }) {
  const a = answers || {}
  const hasPartner = a.hasPartner === 'yes' || a.hasPartner === true
  const yn = (v) => v === true || v === 'yes' ? 'Yes' : v === false || v === 'no' ? 'No' : '—'

  return (
    <div className="space-y-6 text-sm">
      <section>
        <p className="font-semibold text-stone-700 mb-3 pb-1 border-b">Intended Parent 1</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          <QuizAnswerRow label="Name" value={[a.primaryFirstName, a.primaryLastName].filter(Boolean).join(' ')} />
          <QuizAnswerRow label="Date of Birth" value={a.primaryDob} />
          <QuizAnswerRow label="Email" value={a.email} />
          <QuizAnswerRow label="Phone" value={a.phone} />
        </div>
      </section>
      <section>
        <p className="font-semibold text-stone-700 mb-3 pb-1 border-b">Address</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          <QuizAnswerRow label="Street" value={[a.street, a.street2].filter(Boolean).join(', ')} />
          <QuizAnswerRow label="City" value={a.city} />
          <QuizAnswerRow label="State/Province" value={a.stateProv} />
          <QuizAnswerRow label="Zip" value={a.zipCode} />
          <QuizAnswerRow label="Country" value={a.country} />
        </div>
      </section>
      {hasPartner && (
        <section>
          <p className="font-semibold text-stone-700 mb-3 pb-1 border-b">Intended Parent 2</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2">
            <QuizAnswerRow label="Name" value={[a.ip2FirstName, a.ip2LastName].filter(Boolean).join(' ')} />
            <QuizAnswerRow label="Date of Birth" value={a.ip2Dob} />
            <QuizAnswerRow label="Email" value={a.ip2Email} />
            <QuizAnswerRow label="Phone" value={a.ip2Phone} />
          </div>
        </section>
      )}
      <section>
        <p className="font-semibold text-stone-700 mb-3 pb-1 border-b">Fertility Details</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          <QuizAnswerRow label="Has RE Doctor" value={yn(a.hasRE)} />
          {a.hasRE && <QuizAnswerRow label="RE Doctor" value={a.reDoctorName} />}
          <QuizAnswerRow label="Frozen Embryos" value={yn(a.hasFrozenEmbryos)} />
          {a.frozenEmbryoDetails && <QuizAnswerRow label="Embryo Details" value={a.frozenEmbryoDetails} />}
          <QuizAnswerRow label="Using Egg Donor" value={yn(a.usingEggDonor)} />
          <QuizAnswerRow label="Using Sperm Donor" value={yn(a.usingSpermDonor)} />
        </div>
      </section>
      <section>
        <p className="font-semibold text-stone-700 mb-3 pb-1 border-b">Other</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          <QuizAnswerRow label="Wants Consultation" value={yn(a.wantsConsultation)} />
          <QuizAnswerRow label="How did you hear about us?" value={a.hearAboutUs} />
        </div>
      </section>
    </div>
  )
}

// ── Main IP Dashboard ──

export default function IPDashboard() {
  const { currentUser, isAuthenticated } = useRole()
  const [caseData, setCaseData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tasks, setTasks] = useState([])
  const [completedOpen, setCompletedOpen] = useState(false)
  const [intakeOpen, setIntakeOpen] = useState(false)
  const [intakeAnswers, setIntakeAnswers] = useState(null)
  const [intakeLoading, setIntakeLoading] = useState(false)

  const firstName = currentUser?.name?.split(' ')[0] || 'there'
  const userId = currentUser?.id

  useEffect(() => {
    if (!currentUser?.email) { setLoading(false); return }
    Promise.all([
      findCaseByEmail(currentUser.email).catch(() => null),
      userId ? fetchUserTasks(userId).catch(() => []) : Promise.resolve([]),
      fetchIntakeByEmail(currentUser.email).catch(() => null),
    ]).then(([caseResult, userTasks, answers]) => {
      if (caseResult) setCaseData(caseResult)
      setTasks(userTasks || [])
      if (answers) setIntakeAnswers(answers)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [currentUser?.email, userId])

  const activeTasks = tasks.filter(t => ['pending', 'in_progress'].includes(t.status))
  const completedTasks = tasks.filter(t => t.status === 'completed')
  const pendingCount = tasks.filter(t => t.status === 'pending').length

  async function handleIntakeClick() {
    if (intakeAnswers) { setIntakeOpen(true); return }
    setIntakeLoading(true)
    setIntakeOpen(true)
    try {
      const answers = await fetchIntakeByEmail(currentUser.email)
      setIntakeAnswers(answers)
    } catch {
      setIntakeAnswers(null)
    } finally {
      setIntakeLoading(false)
    }
  }

  async function handleStatusChange(taskId, newStatus) {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus, completed_at: newStatus === 'completed' ? new Date().toISOString() : t.completed_at } : t))
    try { await updateTaskStatus(taskId, newStatus) } catch {}
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-stone-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#283693]">Welcome, {firstName}!</h1>
      </div>

      {/* Status Banner */}
      {!loading && activeTasks.length === 0 && completedTasks.length === 0 && (
        <Card className="border-[#283693]/20" style={{ backgroundColor: '#f0f1fa' }}>
          <CardContent className="py-6">
            <div className="flex items-start gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-[#283693]/10 shrink-0">
                <Heart className="w-6 h-6 text-[#283693]" />
              </div>
              <div>
                <p className="font-semibold text-[#283693] text-lg">Welcome to Your Portal</p>
                <p className="text-sm text-stone-600 mt-1 leading-relaxed">
                  We're here to support you every step of the way. Our team will be in touch shortly to discuss next steps in your journey.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action banner — pending tasks */}
      {pendingCount > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-[#283693]/10 border border-[#283693]/20">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#283693] text-white text-sm font-bold shrink-0">
            {pendingCount}
          </div>
          <p className="text-sm font-medium text-stone-800">
            {pendingCount === 1 ? '1 item needs your attention' : `${pendingCount} items need your attention`}
          </p>
        </div>
      )}

      {/* Intake Answers card */}
      {intakeAnswers && (
        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={handleIntakeClick}>
          <CardContent className="py-4 flex items-center gap-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#283693]/10 shrink-0">
              <ClipboardList className="w-5 h-5 text-[#283693]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-stone-700 text-sm">My Intake Answers</p>
              <p className="text-xs text-stone-400 mt-0.5">View the information you submitted</p>
            </div>
            <ArrowRight className="w-4 h-4 text-stone-400 shrink-0" />
          </CardContent>
        </Card>
      )}

      {/* Coordinator */}
      {caseData?.assigned_to && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-50 shrink-0">
                <User className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-stone-400">Your Coordinator</p>
                <p className="font-semibold text-stone-700 text-sm">{caseData.assigned_to}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* To Do section */}
      {activeTasks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              To Do
              {pendingCount > 0 && (
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#283693] text-white text-[11px] font-bold">{pendingCount}</span>
              )}
            </CardTitle>
            <CardDescription>Items that need your attention</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activeTasks.map(task => (
                <TaskCard key={task.id} task={task} onStatusChange={handleStatusChange} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Completed section */}
      {completedTasks.length > 0 && (
        <Collapsible open={completedOpen} onOpenChange={setCompletedOpen}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer">
                <CardTitle className="flex items-center gap-2 text-base">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Completed
                  <span className="text-xs font-normal text-stone-400 ml-1">({completedTasks.length})</span>
                </CardTitle>
                <div className="ml-auto">
                  <ChevronDown className={`w-4 h-4 text-stone-400 transition-transform ${completedOpen ? 'rotate-180' : ''}`} />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <div className="divide-y divide-stone-100">
                  {completedTasks.map(task => (
                    <CompletedTaskRow key={task.id} task={task} />
                  ))}
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Contact */}
      <Card>
        <CardContent className="py-5">
          <div className="text-center">
            <p className="text-sm text-stone-600">
              Questions? Reach us at{' '}
              <a href="mailto:info@abcsurrogacy.com" className="text-[#283693] underline font-medium">
                info@abcsurrogacy.com
              </a>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Intake Answers Dialog */}
      <Dialog open={intakeOpen} onOpenChange={setIntakeOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Your Intake Answers</DialogTitle>
          </DialogHeader>
          {intakeLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-stone-400" />
            </div>
          )}
          {!intakeLoading && intakeAnswers && <IPAnswerDetail answers={intakeAnswers} />}
          {!intakeLoading && !intakeAnswers && (
            <p className="text-sm text-stone-500 py-8 text-center">
              No intake answers found. Our team may still be processing your submission.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
