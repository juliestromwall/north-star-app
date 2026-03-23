import { useState, useMemo, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Search, Plus, MapPin, Calendar, ArrowRight, CheckCircle, Clock, XCircle, Circle, LayoutGrid, List } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import PageHeader from '@/components/shared/PageHeader'
import StatusBadge from '@/components/shared/StatusBadge'
import ProfileAvatar from '@/components/shared/ProfileAvatar'
import EmptyState from '@/components/shared/EmptyState'
import { fetchSurrogatesFromIntake } from '@/lib/db'
import { MATCH_STAGES } from '@/lib/constants'

const SCREENING_ICONS = {
  cleared: CheckCircle,
  pending: Clock,
  failed: XCircle,
  not_started: Circle,
}

const SCREENING_COLORS = {
  cleared: 'text-green-500',
  pending: 'text-yellow-500',
  failed: 'text-red-500',
  not_started: 'text-gray-300',
}

function ScreeningDots({ screening }) {
  const steps = ['medical', 'psychological', 'background', 'homeStudy']
  return (
    <div className="flex items-center gap-1.5">
      {steps.map(step => {
        const status = screening[step]
        const Icon = SCREENING_ICONS[status] || Circle
        return <Icon key={step} className={`size-3.5 ${SCREENING_COLORS[status] || 'text-gray-300'}`} />
      })}
      <span className="text-[10px] text-muted-foreground ml-1">Screening</span>
    </div>
  )
}

export default function SurrogateListPage() {
  const [surrogates, setSurrogates] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [stageFilter, setStageFilter] = useState('all')
  const [view, setView] = useState('tile')
  const navigate = useNavigate()

  useEffect(() => {
    fetchSurrogatesFromIntake()
      .then(data => setSurrogates(data || []))
      .catch(() => setSurrogates([]))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    return surrogates.filter(s => {
      const matchesSearch = !search ||
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.location.toLowerCase().includes(search.toLowerCase()) ||
        s.email.toLowerCase().includes(search.toLowerCase())
      const matchesStatus = statusFilter === 'all' || s.status === statusFilter
      const matchesStage = stageFilter === 'all' ||
        (stageFilter === 'unmatched' ? !s.matchStage : s.matchStage === stageFilter)
      return matchesSearch && matchesStatus && matchesStage
    })
  }, [surrogates, search, statusFilter, stageFilter])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Surrogates"
        subtitle={`${surrogates.length} surrogate${surrogates.length !== 1 ? 's' : ''} in program`}
        actions={
          <Button disabled className="gap-2">
            <Plus className="size-4" />
            Add Surrogate
          </Button>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or location..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="screening">Screening</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Match Stage" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stages</SelectItem>
            <SelectItem value="unmatched">Unmatched</SelectItem>
            {MATCH_STAGES.map(stage => (
              <SelectItem key={stage} value={stage}>{stage}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center border rounded-md">
          <Button
            variant={view === 'tile' ? 'default' : 'ghost'}
            size="icon"
            className="rounded-r-none"
            onClick={() => setView('tile')}
          >
            <LayoutGrid className="size-4" />
          </Button>
          <Button
            variant={view === 'list' ? 'default' : 'ghost'}
            size="icon"
            className="rounded-l-none"
            onClick={() => setView('list')}
          >
            <List className="size-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No surrogates found"
          description={surrogates.length === 0
            ? "Surrogates will appear here once they complete the intake quiz and qualify."
            : "Try adjusting your search or filters."}
        />
      ) : view === 'tile' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filtered.map(surrogate => (
            <Link key={surrogate.id} to={`/surrogates/${surrogate.id}`} className="group">
              <Card className="transition-shadow hover:shadow-md h-full">
                <CardContent className="space-y-4">
                  <div className="flex items-start gap-3">
                    <ProfileAvatar name={surrogate.name} size="lg" />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-heading font-semibold truncate">{surrogate.name}</h3>
                      {surrogate.location && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground mt-0.5">
                          <MapPin className="size-3.5" />
                          <span>{surrogate.location}</span>
                        </div>
                      )}
                      <div className="mt-1.5">
                        <StatusBadge status={surrogate.status} />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground text-xs">Age</span>
                      <p className="font-medium">{surrogate.age || '—'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">Email</span>
                      <p className="font-medium truncate text-xs">{surrogate.email}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">Intake Status</span>
                      <p className="font-medium capitalize">{surrogate.intakeStatus?.replace('_', ' ')}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">Submitted</span>
                      <p className="font-medium">
                        {surrogate.submittedAt
                          ? new Date(surrogate.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                          : '—'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t">
                    <ScreeningDots screening={surrogate.screening} />
                    <span className="text-xs text-abc-indigo font-medium flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      View Profile <ArrowRight className="size-3" />
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Age</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Email</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(surrogate => (
                <TableRow
                  key={surrogate.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/surrogates/${surrogate.id}`)}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <ProfileAvatar name={surrogate.name} size="sm" />
                      <span className="font-medium">{surrogate.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>{surrogate.location || '—'}</TableCell>
                  <TableCell><StatusBadge status={surrogate.status} /></TableCell>
                  <TableCell>{surrogate.age || '—'}</TableCell>
                  <TableCell>
                    {surrogate.submittedAt
                      ? new Date(surrogate.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      : '—'}
                  </TableCell>
                  <TableCell className="text-sm">{surrogate.email}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}
