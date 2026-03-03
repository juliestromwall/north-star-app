import { useRole } from '@/context/RoleContext'
import PageHeader from '@/components/shared/PageHeader'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Heart, Calendar, FileText, MessageSquare, ArrowRight, Baby, Clock } from 'lucide-react'
import { Link } from 'react-router-dom'

const journeyData = {
  surrogateName: 'Emily Carter',
  surrogateLocation: 'Austin, TX',
  matchDate: 'August 20, 2025',
  dueDate: 'May 12, 2026',
  currentStage: 'Active Pregnancy',
  weeksPregnant: 38,
  coordinator: 'Sarah Mitchell',
}

const milestones = [
  { id: 1, text: 'Application approved', date: 'Jun 2025', done: true },
  { id: 2, text: 'Matched with Emily', date: 'Aug 2025', done: true },
  { id: 3, text: 'Legal contracts signed', date: 'Sep 2025', done: true },
  { id: 4, text: 'Medical clearance', date: 'Sep 2025', done: true },
  { id: 5, text: 'Embryo transfer', date: 'Sep 2025', done: true },
  { id: 6, text: 'Pregnancy confirmed', date: 'Oct 2025', done: true },
  { id: 7, text: 'Gender reveal (if desired)', date: 'Jan 2026', done: true },
  { id: 8, text: 'Delivery', date: 'May 2026', done: false },
]

const recentMessages = [
  { id: 1, from: 'Emily Carter', preview: 'Baby is doing great! Had another checkup today...', time: '3h ago' },
  { id: 2, from: 'Sarah Mitchell', preview: 'Just a reminder about the upcoming hospital tour...', time: '1 day ago' },
]

export default function IPDashboard() {
  const { currentUser } = useRole()
  const firstName = currentUser.name.split(' ')[0]

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome, ${firstName}`}
        subtitle="Your family-building journey"
      />

      {/* Journey Status Banner */}
      <Card className="bg-abc-indigo text-white">
        <CardContent className="py-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="size-14 rounded-full bg-white/20 flex items-center justify-center">
                <Baby className="size-7" />
              </div>
              <div>
                <p className="text-lg font-heading font-bold">{journeyData.currentStage}</p>
                <p className="text-white/80">Week {journeyData.weeksPregnant} — Due {journeyData.dueDate}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm text-white/70">Your Surrogate</p>
                <p className="font-medium">{journeyData.surrogateName}</p>
                <p className="text-sm text-white/70">{journeyData.surrogateLocation}</p>
              </div>
              <div className="size-10 rounded-full bg-abc-coral flex items-center justify-center">
                <Heart className="size-5 text-abc-navy" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Milestones */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Journey Milestones</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {milestones.map(m => (
                <div key={m.id} className="flex items-center gap-3">
                  <div className={`size-3 rounded-full shrink-0 ${
                    m.done ? 'bg-abc-indigo' : 'bg-abc-coral ring-2 ring-abc-coral/30'
                  }`} />
                  <span className={`text-sm flex-1 ${m.done ? '' : 'font-medium'}`}>{m.text}</span>
                  <span className="text-xs text-muted-foreground">{m.date}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Links & Messages */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Quick Links</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Button variant="outline" className="w-full justify-start" asChild>
                  <Link to="/my-match">
                    <Heart className="size-4" /> Match Details
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
    </div>
  )
}
