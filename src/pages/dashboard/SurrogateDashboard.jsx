import { useRole } from '@/context/RoleContext'
import PageHeader from '@/components/shared/PageHeader'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MATCH_STAGES } from '@/lib/constants'
import { Heart, Calendar, FileText, MessageSquare, CheckCircle2, Circle, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'

const currentStageIndex = 8 // Active Pregnancy
const journeyData = {
  matchedWith: 'Michael & James Rivera',
  matchDate: 'August 20, 2025',
  dueDate: 'May 12, 2026',
  weeksPregnant: 38,
  nextAppointment: 'March 5, 2026 at 10:00 AM',
  coordinator: 'Sarah Mitchell',
}

const nextSteps = [
  { id: 1, text: '36-week OB checkup', done: true },
  { id: 2, text: 'Hospital pre-registration', done: true },
  { id: 3, text: 'Birth plan review with coordinator', done: false },
  { id: 4, text: 'Final legal review', done: false },
]

const recentMessages = [
  { id: 1, from: 'Sarah Mitchell', preview: 'Hi Emily! Just confirming your appointment...', time: '2h ago' },
  { id: 2, from: 'Michael Rivera', preview: "We're so excited! Thank you for everything...", time: '1 day ago' },
]

export default function SurrogateDashboard() {
  const { currentUser } = useRole()

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome, ${currentUser.name.split(' ')[0]}`}
        subtitle="Your surrogacy journey at a glance"
      />

      {/* Journey Stepper */}
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
        {/* Match Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Heart className="size-4 text-abc-coral" /> Your Match
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Matched With</p>
                <p className="font-medium">{journeyData.matchedWith}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Match Date</p>
                <p className="font-medium">{journeyData.matchDate}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Due Date</p>
                <p className="font-medium">{journeyData.dueDate}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Coordinator</p>
                <p className="font-medium">{journeyData.coordinator}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Next Steps */}
        <Card>
          <CardHeader>
            <CardTitle>Next Steps</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {nextSteps.map(step => (
                <div key={step.id} className="flex items-center gap-3">
                  {step.done ? (
                    <CheckCircle2 className="size-4 text-green-600 shrink-0" />
                  ) : (
                    <Circle className="size-4 text-muted-foreground shrink-0" />
                  )}
                  <span className={`text-sm ${step.done ? 'line-through text-muted-foreground' : ''}`}>
                    {step.text}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Links */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Links</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link to="/appointments">
                  <Calendar className="size-4" /> Appointments
                  <ArrowRight className="size-4 ml-auto" />
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link to="/forms">
                  <FileText className="size-4" /> My Forms
                  <ArrowRight className="size-4 ml-auto" />
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link to="/documents">
                  <FileText className="size-4" /> Documents
                  <ArrowRight className="size-4 ml-auto" />
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link to="/messages">
                  <MessageSquare className="size-4" /> Messages
                  <Badge variant="outline" className="ml-auto bg-abc-coral/20 text-abc-navy text-xs">2</Badge>
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Next Appointment & Recent Messages */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="size-4" /> Next Appointment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">{journeyData.nextAppointment}</p>
            <p className="text-sm text-muted-foreground mt-1">36-week OB checkup — Dr. Williams</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="size-4" /> Recent Messages
            </CardTitle>
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
