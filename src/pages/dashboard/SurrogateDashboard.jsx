import { useState, useEffect, useMemo } from 'react'
import { useRole } from '@/context/RoleContext'
import PageHeader from '@/components/shared/PageHeader'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { MATCH_STAGES } from '@/lib/constants'
import { Heart, Calendar, FileText, MessageSquare, CheckCircle2, Circle, ArrowRight, UserCircle, ClipboardList, Upload, Sparkles, AlertCircle, Clock, ChevronDown, Loader2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import { fetchUserTasks, updateTaskStatus, fetchIntakeByEmail } from '@/lib/db'

// ─── Profile completion (mirrors SurrogateProfilePage logic) ───
const PROFILE_REQUIRED = {
  about: ['firstName', 'city', 'state', 'heightFt', 'weight', 'personality'],
  family: ['maritalStatus', 'whoLivesWithYou', 'planMoreChildren'],
  pregnancyHistory: ['numberOfPregnancies'],
  fertility: ['sameBioFather', 'contraceptiveMethod', 'cycleLength'],
  health: ['mentalHealthDiagnosis', 'bloodType', 'rhFactor', 'openToVaccinations'],
  lifestyle: ['smokeVape', 'alcoholDrugs', 'typicalDiet', 'exerciseFrequency', 'sleepHours', 'reliableVehicle'],
  employment: ['currentlyEmployed', 'healthInsurance'],
  preferences: ['previousSurrogate', 'reasonForSurrogacy', 'whenReadyToBegin', 'desiredCompensation'],
}

function getProfileData(userId) {
  try {
    const raw = localStorage.getItem(`abc-surrogate-profile-${userId || 'anonymous'}`)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function getProfileCompletion(userId) {
  const data = getProfileData(userId)
  if (!data) return 0
  let total = 0, filled = 0
  for (const [section, fields] of Object.entries(PROFILE_REQUIRED)) {
    total += fields.length
    for (const f of fields) {
      const val = data?.[section]?.[f]
      if (val !== undefined && val !== '' && val !== null) filled++
    }
  }
  return total > 0 ? Math.round((filled / total) * 100) : 0
}

function getFirstIncompleteSection(userId) {
  const data = getProfileData(userId)
  for (const [section, fields] of Object.entries(PROFILE_REQUIRED)) {
    for (const f of fields) {
      const val = data?.[section]?.[f]
      if (val === undefined || val === '' || val === null) return section
    }
  }
  return 'about'
}

function ProgressRing({ percent, size = 56 }) {
  const r = (size - 6) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (percent / 100) * circ
  return (
    <svg width={size} height={size} className="shrink-0">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e7e5e4" strokeWidth={5} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#ed148c" strokeWidth={5}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}
        className="transition-all duration-700"
      />
      <text x="50%" y="50%" textAnchor="middle" dy=".35em" className="text-xs font-bold fill-stone-700">{percent}%</text>
    </svg>
  )
}

// A new surrogate who just signed up via the quiz has no journey data yet.
// We detect this by checking if they're an auth user (real signup) vs a mock user.


export default function SurrogateDashboard() {
  const { currentUser, isAuthenticated } = useRole()

  const firstName = currentUser.name.split(' ')[0]

  // Real auth users see the onboarding/empty state
  // Mock users (dev role switcher) see the demo journey
  if (isAuthenticated) {
    return <OnboardingDashboard name={firstName} currentUser={currentUser} />
  }

  return <DemoJourneyDashboard name={firstName} />
}

function ProfileProgressCard({ userId }) {
  const [percent, setPercent] = useState(0)
  const [nextSection, setNextSection] = useState('about')
  useEffect(() => {
    setPercent(getProfileCompletion(userId))
    setNextSection(getFirstIncompleteSection(userId))
  }, [userId])

  const ctaLabel = percent === 0 ? 'Get Started' : 'Continue'
  const profileLink = percent === 100 ? '/my-profile' : `/my-profile#${nextSection}`

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="py-6">
        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
          <ProgressRing percent={percent} size={72} />
          <div className="flex-1 min-w-0 text-center sm:text-left">
            <p className="font-semibold text-stone-800 text-lg">My Profile</p>
            <p className="text-sm text-stone-500 mt-1">
              Complete your matching profile so intended parents can find you. It takes about 20–30 minutes — you can save your progress at any time.
            </p>
            <div className="mt-3 max-w-sm mx-auto sm:mx-0">
              <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${percent}%`, background: 'linear-gradient(90deg, #ed148c, #283693)' }} />
              </div>
              <p className="text-xs text-stone-400 mt-1">{percent}% complete</p>
            </div>
          </div>
          <Link to={profileLink}>
            <Button className="rounded-lg gap-1.5 shrink-0 w-full sm:w-auto" style={{ backgroundColor: '#ed148c', color: '#fff' }}>
              {ctaLabel} <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}

function QuizAnswerRow({ label, value }) {
  if (value === undefined || value === null || value === '') return null
  return (
    <div>
      <span className="text-stone-400">{label}</span>
      <p className="font-medium">{typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value}</p>
    </div>
  )
}

function GCAnswerDetail({ answers }) {
  const bmi = answers.heightFt && answers.weightLbs
    ? ((answers.weightLbs / ((answers.heightFt * 12 + (parseInt(answers.heightIn) || 0)) ** 2)) * 703).toFixed(1)
    : null

  return (
    <div className="space-y-6 text-sm">
      {/* Step 1 — Contact info */}
      <section>
        <p className="font-semibold text-stone-700 mb-3 pb-1 border-b">Contact Info</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          <QuizAnswerRow label="Name" value={answers.firstName && `${answers.firstName} ${answers.lastName || ''}`} />
          <QuizAnswerRow label="Date of Birth" value={answers.dob} />
          <QuizAnswerRow label="State" value={answers.state} />
          <QuizAnswerRow label="Phone" value={answers.phone} />
          <QuizAnswerRow label="Email" value={answers.email} />
          <QuizAnswerRow label="US Citizen" value={answers.usCitizen} />
        </div>
      </section>

      {/* Step 2 — About you */}
      <section>
        <p className="font-semibold text-stone-700 mb-3 pb-1 border-b">About You</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          <QuizAnswerRow label="Marital Status" value={answers.maritalStatus} />
          <QuizAnswerRow label="Preferred Contact" value={answers.preferredContact} />
        </div>
      </section>

      {/* Step 3 — Health */}
      <section>
        <p className="font-semibold text-stone-700 mb-3 pb-1 border-b">Health</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          <QuizAnswerRow label="Height" value={answers.heightFt && `${answers.heightFt}'${answers.heightIn || 0}"`} />
          <QuizAnswerRow label="Weight" value={answers.weightLbs && `${answers.weightLbs} lbs`} />
          {bmi && (
            <div>
              <span className="text-stone-400">BMI</span>
              <p className={`font-medium ${bmi > 33 || bmi < 19 ? 'text-amber-600' : 'text-emerald-600'}`}>{bmi}</p>
            </div>
          )}
        </div>
      </section>

      {/* Step 4 — Pregnancy */}
      <section>
        <p className="font-semibold text-stone-700 mb-3 pb-1 border-b">Pregnancy History</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          <QuizAnswerRow label="Healthy Pregnancy" value={answers.healthyPregnancy} />
        </div>
      </section>

      {/* Step 5 — Final */}
      <section>
        <p className="font-semibold text-stone-700 mb-3 pb-1 border-b">Final Details</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          <QuizAnswerRow label="Heard About Us" value={answers.hearAboutUs} />
        </div>
      </section>
    </div>
  )
}

const TASK_ICONS = {
  form: ClipboardList,
  document: Upload,
  action: AlertCircle,
}

function TaskCard({ task, onStatusChange }) {
  const Icon = TASK_ICONS[task.type] || ClipboardList
  const isPending = task.status === 'pending'
  const isInProgress = task.status === 'in_progress'

  return (
    <div className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
      isPending ? 'border-[#ed148c]/30 bg-[#ed148c]/5' : 'border-stone-200 bg-white'
    }`}>
      <div className={`flex items-center justify-center w-10 h-10 rounded-xl shrink-0 ${
        isPending ? 'bg-[#ed148c]/10' : 'bg-[#283693]/10'
      }`}>
        <Icon className={`w-5 h-5 ${isPending ? 'text-[#ed148c]' : 'text-[#283693]'}`} />
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
        <Button size="sm" className="rounded-lg text-xs gap-1.5 shrink-0" style={{ backgroundColor: '#ed148c', color: '#fff' }}
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

function OnboardingDashboard({ name, currentUser }) {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [completedOpen, setCompletedOpen] = useState(false)
  const [quizOpen, setQuizOpen] = useState(false)
  const [quizAnswers, setQuizAnswers] = useState(null)
  const [quizLoading, setQuizLoading] = useState(false)

  const userId = currentUser?.id

  useEffect(() => {
    if (!userId) { setLoading(false); return }
    fetchUserTasks(userId)
      .then(data => setTasks(data || []))
      .catch(() => setTasks([]))
      .finally(() => setLoading(false))
  }, [userId])

  const activeTasks = tasks.filter(t => ['pending', 'in_progress'].includes(t.status))
  const completedTasks = tasks.filter(t => t.status === 'completed')
  const skippedTasks = tasks.filter(t => t.status === 'skip')
  const pendingCount = tasks.filter(t => t.status === 'pending').length

  async function handleQuizClick() {
    if (quizAnswers) { setQuizOpen(true); return }
    setQuizLoading(true)
    setQuizOpen(true)
    try {
      const answers = await fetchIntakeByEmail(currentUser.email)
      setQuizAnswers(answers)
    } catch {
      setQuizAnswers(null)
    } finally {
      setQuizLoading(false)
    }
  }

  async function handleStatusChange(taskId, newStatus) {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus, completed_at: newStatus === 'completed' ? new Date().toISOString() : t.completed_at } : t))
    try { await updateTaskStatus(taskId, newStatus) } catch {}
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome, ${name}!`}
        subtitle="We're so glad you're here. Take a look around — this is your portal."
      />

      {/* All caught up — show at top when no tasks */}
      {!loading && activeTasks.length === 0 && completedTasks.length === 0 && (
        <Card className="border-[#283693]/20" style={{ backgroundColor: '#f0f1fa' }}>
          <CardContent className="py-6">
            <div className="flex items-start gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-[#283693]/10 shrink-0">
                <Sparkles className="w-6 h-6 text-[#283693]" />
              </div>
              <div>
                <p className="font-semibold text-[#283693] text-lg">You're all caught up!</p>
                <p className="text-sm text-stone-600 mt-1 leading-relaxed">
                  Our team is reviewing your quiz results and will be in touch soon. In the meantime, feel free to get a head start on your matching profile — it takes about 20–30 minutes and you can save your progress at any time.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action banner — only show when there are pending tasks */}
      {pendingCount > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-[#ed148c]/10 border border-[#ed148c]/20">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#ed148c] text-white text-sm font-bold shrink-0">
            {pendingCount}
          </div>
          <p className="text-sm font-medium text-stone-800">
            {pendingCount === 1 ? '1 item needs your attention' : `${pendingCount} items need your attention`}
          </p>
        </div>
      )}

      {/* Profile card — full width, prominent */}
      <ProfileProgressCard userId={userId || currentUser?.email} />

      {/* Quiz Results card */}
      <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={handleQuizClick}>
        <CardContent className="py-4 flex items-center gap-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-50 shrink-0">
            <ClipboardList className="w-5 h-5 text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-stone-700 text-sm">Quiz Results</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <p className="text-xs text-amber-600">Under Review</p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-stone-400 shrink-0" />
        </CardContent>
      </Card>

      {/* To Do section */}
      {activeTasks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              To Do
              {pendingCount > 0 && (
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#ed148c] text-white text-[11px] font-bold">{pendingCount}</span>
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

      {/* Completed section — collapsible */}
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
              <a href="mailto:intake@abcsurrogacy.com" className="text-[#283693] underline font-medium">
                intake@abcsurrogacy.com
              </a>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Quiz Results Dialog */}
      <Dialog open={quizOpen} onOpenChange={setQuizOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Your Quiz Answers</DialogTitle>
          </DialogHeader>
          {quizLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-stone-400" />
            </div>
          )}
          {!quizLoading && quizAnswers && <GCAnswerDetail answers={quizAnswers} />}
          {!quizLoading && !quizAnswers && (
            <p className="text-sm text-stone-500 py-8 text-center">
              No quiz answers found. Our team may still be processing your submission.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Original demo dashboard for the dev role switcher
function DemoJourneyDashboard({ name }) {
  const currentStageIndex = 8
  const journeyData = {
    matchedWith: 'Michael & James Rivera',
    matchDate: 'August 20, 2025',
    dueDate: 'May 12, 2026',
    weeksPregnant: 38,
    nextAppointment: 'March 5, 2026 at 10:00 AM',
    coordinator: 'Emily Rotter',
  }

  const nextSteps = [
    { id: 1, text: '36-week OB checkup', done: true },
    { id: 2, text: 'Hospital pre-registration', done: true },
    { id: 3, text: 'Birth plan review with coordinator', done: false },
    { id: 4, text: 'Final legal review', done: false },
  ]

  const recentMessages = [
    { id: 1, from: 'Emily Rotter', preview: 'Hi Emily! Just confirming your appointment...', time: '2h ago' },
    { id: 2, from: 'Michael Rivera', preview: "We're so excited! Thank you for everything...", time: '1 day ago' },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome, ${name}`}
        subtitle="Your surrogacy journey at a glance"
      />

      <Card>
        <CardHeader>
          <CardTitle>Your Journey</CardTitle>
          <CardDescription>Stage {currentStageIndex + 1} of {MATCH_STAGES.length}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-1 overflow-x-auto pb-2">
            {MATCH_STAGES.map((stage, i) => (
              <div key={stage} className="flex items-center shrink-0">
                <div className="flex flex-col items-center">
                  <div
                    className={`size-8 rounded-full flex items-center justify-center text-xs font-medium ${
                      i < currentStageIndex
                        ? 'bg-abc-indigo text-white'
                        : i === currentStageIndex
                        ? 'bg-abc-coral text-abc-navy ring-2 ring-abc-coral/30'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {i < currentStageIndex ? <CheckCircle2 className="size-4" /> : i + 1}
                  </div>
                  <span className={`text-[10px] mt-1 text-center w-16 leading-tight ${
                    i === currentStageIndex ? 'font-semibold text-abc-navy' : 'text-muted-foreground'
                  }`}>
                    {stage}
                  </span>
                </div>
                {i < MATCH_STAGES.length - 1 && (
                  <div className={`w-4 h-0.5 mx-0.5 mt-[-16px] ${
                    i < currentStageIndex ? 'bg-abc-indigo' : 'bg-muted'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Heart className="size-4 text-abc-coral" /> Your Match
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div><p className="text-sm text-muted-foreground">Matched With</p><p className="font-medium">{journeyData.matchedWith}</p></div>
              <div><p className="text-sm text-muted-foreground">Match Date</p><p className="font-medium">{journeyData.matchDate}</p></div>
              <div><p className="text-sm text-muted-foreground">Due Date</p><p className="font-medium">{journeyData.dueDate}</p></div>
              <div><p className="text-sm text-muted-foreground">Coordinator</p><p className="font-medium">{journeyData.coordinator}</p></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Next Steps</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {nextSteps.map(step => (
                <div key={step.id} className="flex items-center gap-3">
                  {step.done ? <CheckCircle2 className="size-4 text-green-600 shrink-0" /> : <Circle className="size-4 text-muted-foreground shrink-0" />}
                  <span className={`text-sm ${step.done ? 'line-through text-muted-foreground' : ''}`}>{step.text}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Quick Links</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link to="/appointments"><Calendar className="size-4" /> Appointments <ArrowRight className="size-4 ml-auto" /></Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link to="/forms"><FileText className="size-4" /> My Forms <ArrowRight className="size-4 ml-auto" /></Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link to="/documents"><FileText className="size-4" /> Documents <ArrowRight className="size-4 ml-auto" /></Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link to="/messages"><MessageSquare className="size-4" /> Messages <Badge variant="outline" className="ml-auto bg-abc-coral/20 text-abc-navy text-xs">2</Badge></Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Calendar className="size-4" /> Next Appointment</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">{journeyData.nextAppointment}</p>
            <p className="text-sm text-muted-foreground mt-1">36-week OB checkup — Dr. Williams</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><MessageSquare className="size-4" /> Recent Messages</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentMessages.map(msg => (
                <div key={msg.id} className="flex items-start gap-3">
                  <div className="size-8 rounded-full bg-abc-indigo/10 flex items-center justify-center shrink-0">
                    <span className="text-xs font-medium text-abc-indigo">{msg.from[0]}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{msg.from}</p>
                    <p className="text-xs text-muted-foreground truncate">{msg.preview}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{msg.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
