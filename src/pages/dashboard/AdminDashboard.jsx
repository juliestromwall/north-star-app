import { useRole } from '@/context/RoleContext'
import { useAdminNotes } from '@/context/AdminNotesContext'
import PageHeader from '@/components/shared/PageHeader'
import StatCard from '@/components/shared/StatCard'
import StatusBadge from '@/components/shared/StatusBadge'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { mockSurrogates } from '@/data/mock/surrogates'
import { mockIntendedParents } from '@/data/mock/intendedParents'
import { matchPipelineCounts } from '@/data/mock/matches'
import { MATCH_STAGES } from '@/lib/constants'
import { Heart, Users, GitMerge, FileText, Plus, ArrowRight, Calendar, Clock, Megaphone, X } from 'lucide-react'
import { Link } from 'react-router-dom'

const activeSurrogates = mockSurrogates.filter(s => s.status === 'active').length
const activeIPs = mockIntendedParents.filter(ip => ip.status === 'active').length
const matchesInProgress = mockSurrogates.filter(s => s.matchedWith).length
const pendingApps = mockSurrogates.filter(s => s.status === 'pending').length + mockIntendedParents.filter(ip => ip.status === 'pending').length

const recentActivity = []
const upcomingMilestones = []

export default function AdminDashboard() {
  const { currentUser } = useRole()
  const { getActiveNotes, dismissNote } = useAdminNotes()

  const visibleNotes = getActiveNotes().filter(
    (n) => !n.dismissals?.some((d) => d.user_id === currentUser?.id)
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${currentUser.name.split(' ')[0]}`}
        subtitle="Here's what's happening at ABC Surrogacy today"
        actions={
          <Button asChild>
            <Link to="/forms"><Plus className="size-4" /> New Form</Link>
          </Button>
        }
      />

      {/* Admin Notes */}
      {visibleNotes.map((note) => (
        <div key={note.id} className="flex items-start gap-3 bg-abc-indigo/10 border border-abc-indigo/30 rounded-lg px-4 py-3">
          <Megaphone className="size-5 text-abc-indigo shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            {note.title && <p className="font-semibold text-sm">{note.title}</p>}
            <p className="text-sm text-muted-foreground">{note.message}</p>
          </div>
          <button
            onClick={() => dismissNote(note.id, currentUser?.id)}
            className="p-1 rounded hover:bg-abc-indigo/10 text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <X className="size-4" />
          </button>
        </div>
      ))}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Active Surrogates" value={activeSurrogates} icon={Heart} description="In program" />
        <StatCard title="Active IPs" value={activeIPs} icon={Users} description="In program" />
        <StatCard title="Matches in Progress" value={matchesInProgress} icon={GitMerge} description="Across all stages" />
        <StatCard title="Pending Applications" value={pendingApps} icon={FileText} description="Needs review" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Match Pipeline */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Match Pipeline</CardTitle>
            <CardDescription>Current distribution across journey stages</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {MATCH_STAGES.map(stage => {
                const count = matchPipelineCounts[stage] || 0
                const maxCount = Math.max(...Object.values(matchPipelineCounts), 1)
                const width = (count / maxCount) * 100
                return (
                  <div key={stage} className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground w-36 shrink-0 truncate">{stage}</span>
                    <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                      {count > 0 && (
                        <div
                          className="h-full bg-abc-indigo/80 rounded-full flex items-center justify-end pr-2 transition-all"
                          style={{ width: `${Math.max(width, 12)}%` }}
                        >
                          <span className="text-xs text-white font-medium">{count}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Milestones */}
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Milestones</CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingMilestones.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No upcoming milestones</p>
            ) : (
              <div className="space-y-3">
                {upcomingMilestones.map(milestone => (
                  <div key={milestone.id} className="flex items-start gap-3">
                    <div className={`size-2 rounded-full mt-2 shrink-0 ${milestone.urgency === 'high' ? 'bg-abc-coral' : 'bg-abc-indigo'}`} />
                    <div>
                      <p className="text-sm">{milestone.text}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Calendar className="size-3" />
                        {milestone.date}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No recent activity</p>
            ) : (
              <div className="space-y-3">
                {recentActivity.map(activity => (
                  <div key={activity.id} className="flex items-start gap-3">
                    <div className="size-2 rounded-full mt-2 bg-abc-indigo/40 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{activity.text}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Clock className="size-3" />
                        {activity.time}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link to="/forms">
                  <FileText className="size-4" /> Review Applications
                  <ArrowRight className="size-4 ml-auto" />
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link to="/matching">
                  <GitMerge className="size-4" /> Match Queue
                  <ArrowRight className="size-4 ml-auto" />
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link to="/surrogates">
                  <Heart className="size-4" /> View Surrogates
                  <ArrowRight className="size-4 ml-auto" />
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link to="/calendar">
                  <Calendar className="size-4" /> Calendar
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
