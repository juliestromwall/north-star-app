import { useState, useEffect } from 'react'
import { useRole } from '@/context/RoleContext'
import PageHeader from '@/components/shared/PageHeader'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import { Heart, FileText, ArrowRight, Loader2, User, Mail, Phone, MapPin, CheckCircle2, Clock, ClipboardList, ChevronDown, AlertCircle, Send, UserCheck, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { findCaseByEmail, fetchUserTasks, updateTaskStatus, fetchIntakeByEmail } from '@/lib/db'
import { countCompletion } from '@/pages/profile/IPProfilePage'
import ProfileAvatar from '@/components/shared/ProfileAvatar'
import { getAdminStaff } from '@/data/mock/users'

// ── Progress ring (matches surrogate dashboard) ──
function ProgressRing({ percent, size = 72 }) {
  const r = (size - 6) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (percent / 100) * circ
  return (
    <svg width={size} height={size} className="shrink-0">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e7e5e4" strokeWidth={5} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#D4A853" strokeWidth={5}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}
        className="transition-all duration-700"
      />
      <text x="50%" y="50%" textAnchor="middle" dy=".35em" className="text-xs font-bold fill-stone-700">{percent}%</text>
    </svg>
  )
}

// ── My Profile progress card (mirrors surrogate ProfileProgressCard) ──
function IPProfileProgressCard({ caseData }) {
  if (!caseData) return null
  const answers = caseData.answers || {}
  const profile = answers._ipProfile || {}
  const hasPartner = answers.hasPartner === 'yes' || answers.hasPartner === true
  const percent = countCompletion(profile, hasPartner)
  const isApproved = !!profile?._approved
  const isSubmitted = !isApproved && !!answers._profileSubmitted && !answers._profileReleasedAt
  const isReleased = !isApproved && !!answers._profileSubmitted && !!answers._profileReleasedAt
  const title = isApproved ? 'Profile Approved' : isSubmitted ? 'Profile Submitted' : 'My Profile'
  const ctaLabel = isApproved || isSubmitted ? 'View Profile' : percent === 0 ? 'Get Started' : 'Continue'

  // Status-based accent color
  const accent = isApproved
    ? { bg: 'bg-emerald-500', border: 'border-emerald-100', btn: '#16a34a' }
    : isSubmitted
    ? { bg: 'bg-amber-500', border: 'border-amber-100', btn: '#d97706' }
    : { bg: 'bg-[#D4A853]', border: 'border-stone-100', btn: '#D4A853' }

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-white border ${accent.border} shadow-sm hover:shadow-md transition-all`}>
      <div className={`h-1 ${accent.bg}`} />
      <div className="p-6">
        <div className="flex flex-col sm:flex-row items-center gap-5 sm:gap-6">
          <ProgressRing percent={percent} size={72} />
          <div className="flex-1 min-w-0 text-center sm:text-left">
            <div className="flex items-center gap-2 justify-center sm:justify-start">
              <p className="font-semibold text-stone-800 text-lg">{title}</p>
              {isApproved && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
              {isSubmitted && <Clock className="w-5 h-5 text-amber-500" />}
            </div>
            {isApproved ? (
              <p className="text-sm text-emerald-700 mt-1.5 leading-relaxed">
                Your profile has been approved! You can now complete the remaining portion of your application.
              </p>
            ) : isSubmitted ? (
              <p className="text-sm text-amber-700 mt-1.5 leading-relaxed">
                Your profile has been submitted and is under review. We will reach out soon for next steps!
              </p>
            ) : isReleased ? (
              <p className="text-sm text-stone-500 mt-1.5 leading-relaxed">
                Our team reopened your profile. Make any updates and re-submit when you're ready.
              </p>
            ) : (
              <p className="text-sm text-stone-500 mt-1.5 leading-relaxed">
                Complete your matching profile so surrogates can find you. It takes about 20–30 minutes — you can save your progress at any time.
              </p>
            )}
            <div className="mt-3 max-w-sm mx-auto sm:mx-0">
              <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${percent}%`, background: isApproved ? '#16a34a' : isSubmitted ? '#d97706' : 'linear-gradient(90deg, #D4A853, #1A3638)' }} />
              </div>
              <p className="text-[11px] text-stone-400 mt-1">{percent}% complete</p>
            </div>
          </div>
          <Link to="/my-profile">
            <Button className="rounded-xl gap-1.5 shrink-0 w-full sm:w-auto shadow-sm" style={{ backgroundColor: accent.btn, color: '#fff' }}>
              {ctaLabel} <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}

// ── Task components (same as surrogate dashboard) ──

function TaskCard({ task, onStatusChange }) {
  const isPending = task.status === 'pending'
  const isInProgress = task.status === 'in_progress'

  return (
    <div className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
      isPending ? 'border-[#1A3638]/30 bg-[#1A3638]/5' : 'border-stone-200 bg-white'
    }`}>
      <div className={`flex items-center justify-center w-10 h-10 rounded-xl shrink-0 ${
        isPending ? 'bg-[#1A3638]/10' : 'bg-stone-100'
      }`}>
        <ClipboardList className={`w-5 h-5 ${isPending ? 'text-[#1A3638]' : 'text-stone-500'}`} />
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
        <Button size="sm" className="rounded-lg text-xs gap-1.5 shrink-0" style={{ backgroundColor: '#1A3638', color: '#fff' }}
          onClick={() => onStatusChange(task.id, 'in_progress')}>
          Start <ArrowRight className="w-3.5 h-3.5" />
        </Button>
      )}
      {isInProgress && (
        <Button size="sm" className="rounded-lg text-xs gap-1.5 shrink-0" style={{ backgroundColor: '#1A3638', color: '#fff' }}
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
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1A3638]">Welcome, {firstName}!</h1>
      </div>

      {/* ── Complete Application card (when admin has released the app) ── */}
      {caseData?.answers?._applicationAvailable && (
        <Link to="/my-application" className="block">
          <div className="relative overflow-hidden rounded-2xl bg-white border border-stone-100 shadow-sm hover:shadow-md transition-all">
            <div className={`h-1 ${caseData?.answers?._applicationSubmitted ? 'bg-emerald-500' : 'bg-[#1A3638]'}`} />
            <div className="p-6">
              <div className="flex items-center gap-5">
                <div className={`flex items-center justify-center w-12 h-12 rounded-xl shrink-0 ${
                  caseData?.answers?._applicationSubmitted ? 'bg-emerald-50' : 'bg-[#1A3638]/8'
                }`}>
                  {caseData?.answers?._applicationSubmitted
                    ? <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                    : <ClipboardList className="w-6 h-6 text-[#1A3638]" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`font-semibold text-base ${caseData?.answers?._applicationSubmitted ? 'text-emerald-700' : 'text-[#1A3638]'}`}>
                    {caseData?.answers?._applicationSubmitted ? 'Application Submitted' : 'You can now complete the remaining Application'}
                  </p>
                  <p className="text-sm text-stone-500 mt-1 leading-relaxed">
                    {caseData?.answers?._applicationSubmitted
                      ? `Submitted on ${new Date(caseData.answers._applicationSubmittedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}. We will review and reach out for next steps!`
                      : 'The information on these forms is for internal use only and will not be shared with any potential surrogate.'
                    }
                  </p>
                </div>
                {!caseData?.answers?._applicationSubmitted && (
                  <Button className="rounded-xl gap-1.5 shrink-0 shadow-sm" style={{ backgroundColor: '#1A3638', color: '#fff' }}>
                    Complete Application <ArrowRight className="w-4 h-4" />
                  </Button>
                )}
                {caseData?.answers?._applicationSubmitted && (
                  <ArrowRight className="w-5 h-5 shrink-0 text-emerald-400" />
                )}
              </div>
            </div>
          </div>
        </Link>
      )}

      {/* ── Welcome intro card (pre-submit) ── */}
      {!caseData?.answers?._profileSubmitted && (
        <div className="relative overflow-hidden rounded-2xl bg-white border border-stone-100 shadow-sm">
          <div className="h-1 bg-gradient-to-r from-[#1A3638] to-[#D4A853]" />
          <div className="p-6">
            <div className="flex items-start gap-5">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-[#1A3638]/8 shrink-0">
                <Sparkles className="w-6 h-6 text-[#1A3638]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[#1A3638] text-base">Welcome to Your User Portal</p>
                <p className="text-sm text-stone-500 mt-1.5 leading-relaxed">
                  We would love if you could complete your Intended Parent Profile. This is the profile that may be shared with prospective surrogates. Please be sure to include photos of you, and some photos with your family, loved ones or pets.
                </p>
                <p className="text-sm text-stone-500 mt-2 leading-relaxed">
                  If there are two Intended Parents, both of you will have information to complete in some sections. Once you are done, please Submit your profile for review.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── My Profile progress card (mirrors surrogate ProfileProgressCard) ── */}
      <IPProfileProgressCard caseData={caseData} />


      {/* Action banner — pending tasks */}
      {pendingCount > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-[#1A3638]/10 border border-[#1A3638]/20">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#1A3638] text-white text-sm font-bold shrink-0">
            {pendingCount}
          </div>
          <p className="text-sm font-medium text-stone-800">
            {pendingCount === 1 ? '1 item needs your attention' : `${pendingCount} items need your attention`}
          </p>
        </div>
      )}

      {/* Intake Answers card — hidden from IPs per Julie: they shouldn't
          be re-reading the quiz they already filled. Admin still sees the
          full intake answers on the IP case page. */}
      {false && intakeAnswers && (
        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={handleIntakeClick}>
          <CardContent className="py-4 flex items-center gap-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#1A3638]/10 shrink-0">
              <ClipboardList className="w-5 h-5 text-[#1A3638]" />
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
      {caseData?.assigned_to && (() => {
        const admin = getAdminStaff().find(a => a.email === caseData.assigned_to)
        const displayName = admin?.name || caseData.assigned_to.split('@')[0]
        return (
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-4">
                <ProfileAvatar name={displayName} avatar={admin?.avatarUrl} size="md" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-stone-400">Your Coordinator</p>
                  <p className="font-semibold text-stone-700 text-sm">{displayName}</p>
                  {admin?.email && <p className="text-xs text-stone-400">{admin.email}</p>}
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })()}

      {/* To Do section */}
      {activeTasks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              To Do
              {pendingCount > 0 && (
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#1A3638] text-white text-[11px] font-bold">{pendingCount}</span>
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
              <a href="mailto:info@northstarsurrogacy.com" className="text-[#1A3638] underline font-medium">
                info@northstarsurrogacy.com
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
