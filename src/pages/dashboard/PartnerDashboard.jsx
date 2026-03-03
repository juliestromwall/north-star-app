import { useRole } from '@/context/RoleContext'
import PageHeader from '@/components/shared/PageHeader'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MATCH_STAGES } from '@/lib/constants'
import { Heart, Calendar, FileText, MessageSquare, CheckCircle2, Eye, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'

const currentStageIndex = 8

const partnerData = {
  surrogateName: 'Emily Carter',
  matchedWith: 'Michael & James Rivera',
  dueDate: 'May 12, 2026',
  currentStage: 'Active Pregnancy',
  nextAppointment: 'March 5, 2026 at 10:00 AM',
}

export default function PartnerDashboard() {
  const { currentUser } = useRole()

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome, ${currentUser.name.split(' ')[0]}`}
        subtitle="Supporting your partner's surrogacy journey"
      />

      <Card className="border-abc-coral/30 bg-abc-coral/5">
        <CardContent className="py-4">
          <div className="flex items-center gap-2 text-sm text-abc-navy">
            <Eye className="size-4" />
            <span>You have <strong>read-only access</strong> to your partner's journey information.</span>
          </div>
        </CardContent>
      </Card>

      {/* Journey Stepper (read-only) */}
      <Card>
        <CardHeader>
          <CardTitle>Journey Progress</CardTitle>
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
              <Heart className="size-4 text-abc-coral" /> Match Info
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Your Partner</p>
                <p className="font-medium">{partnerData.surrogateName}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Matched With</p>
                <p className="font-medium">{partnerData.matchedWith}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Current Stage</p>
                <p className="font-medium">{partnerData.currentStage}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Due Date</p>
                <p className="font-medium">{partnerData.dueDate}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="size-4" /> Next Appointment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">{partnerData.nextAppointment}</p>
            <p className="text-sm text-muted-foreground mt-1">36-week OB checkup</p>
          </CardContent>
        </Card>

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
                <Link to="/documents">
                  <FileText className="size-4" /> Documents
                  <ArrowRight className="size-4 ml-auto" />
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link to="/messages">
                  <MessageSquare className="size-4" /> Messages
                  <ArrowRight className="size-4 ml-auto" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
