import { useState, useMemo, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Search, Plus, MapPin, Calendar, ArrowRight, CheckCircle, Clock, XCircle, Circle, LayoutGrid, List, UserCog } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import PageHeader from '@/components/shared/PageHeader'
import StatusBadge from '@/components/shared/StatusBadge'
import ProfileAvatar from '@/components/shared/ProfileAvatar'
import EmptyState from '@/components/shared/EmptyState'
import { useRole } from '@/context/RoleContext'
import { fetchSurrogatesFromIntake, assignSurrogateToAdmin, adminAddSurrogate, fetchAllSurrogateProfiles } from '@/lib/db'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { mockUsers } from '@/data/mock/users'
import { ROLES, ADMIN_ROLES, MATCH_STAGES } from '@/lib/constants'

const ADMIN_STAFF = mockUsers.filter(u => ['super_admin', 'master_admin', 'admin'].includes(u.role))

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

function getAdminName(email) {
  const user = ADMIN_STAFF.find(u => u.email === email)
  return user ? user.name : email
}

function getGravidaPara(profileData) {
  const ph = profileData?.pregnancyHistory
  if (!ph?.pregnancies || ph.pregnancies.length === 0) return null
  const pregnancies = ph.pregnancies
  const gravida = parseInt(ph.numberOfPregnancies) || pregnancies.length
  const liveBirths = pregnancies.filter(p => p.outcome === 'Live Birth').length
  const miscarriages = pregnancies.filter(p => p.outcome === 'Miscarriage').length
  const terminations = pregnancies.filter(p => p.outcome === 'Termination').length
  return { gravida, liveBirths, miscarriages, terminations }
}

function GravidaParaRow({ gp }) {
  if (!gp) return null
  return (
    <div className="flex items-center gap-3 text-xs">
      <span><span className="font-bold text-abc-indigo">{gp.gravida}</span> <span className="text-muted-foreground">G</span></span>
      <span><span className="font-bold text-emerald-600">{gp.liveBirths}</span> <span className="text-muted-foreground">P</span></span>
      {gp.miscarriages > 0 && <span><span className="font-bold text-amber-500">{gp.miscarriages}</span> <span className="text-muted-foreground">M</span></span>}
      {gp.terminations > 0 && <span><span className="font-bold text-stone-500">{gp.terminations}</span> <span className="text-muted-foreground">T</span></span>}
    </div>
  )
}

function BeBadge({ className = '' }) {
  return <img src="/be-logo.png" alt="Be Surrogacy" className={`h-8 w-auto ${className}`} title="Be Surrogacy Referral" />
}

export default function SurrogateListPage() {
  const { currentUser, isAdmin, isSuperAdmin, isMasterAdmin } = useRole()
  const [surrogates, setSurrogates] = useState([])
  const [profiles, setProfiles] = useState({})
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState({ firstName: '', lastName: '', email: '', phone: '', state: '', dob: '', referralPartner: false })
  const [addSaving, setAddSaving] = useState(false)
  const [addError, setAddError] = useState(null)
  const [addSuccess, setAddSuccess] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [ownerFilter, setOwnerFilter] = useState('mine')
  const [view, setView] = useState('tile')
  const navigate = useNavigate()

  const canSeeAll = isSuperAdmin || isMasterAdmin

  useEffect(() => {
    Promise.all([fetchSurrogatesFromIntake(), fetchAllSurrogateProfiles()])
      .then(([data, profileList]) => {
        setSurrogates(data || [])
        const map = {}
        for (const p of (profileList || [])) { map[p.email] = p.profile_data }
        setProfiles(map)
      })
      .catch(() => setSurrogates([]))
      .finally(() => setLoading(false))
  }, [])


  const filtered = useMemo(() => {
    return surrogates.filter(s => {
      // Owner filter
      if (ownerFilter === 'mine') {
        if (s.assignedTo !== currentUser.email) return false
      } else if (ownerFilter === 'unassigned') {
        if (s.assignedTo) return false
      } else if (ownerFilter !== 'all') {
        // Specific admin email
        if (s.assignedTo !== ownerFilter) return false
      }

      const matchesSearch = !search ||
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.location.toLowerCase().includes(search.toLowerCase()) ||
        s.email.toLowerCase().includes(search.toLowerCase())
      const matchesStatus = statusFilter === 'all' || s.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [surrogates, search, statusFilter, ownerFilter, currentUser.email])

  const myCaseCount = surrogates.filter(s => s.assignedTo === currentUser.email).length
  const unassignedCount = surrogates.filter(s => !s.assignedTo).length

  async function handleAddSurrogate() {
    if (!addForm.firstName || !addForm.email) return
    setAddSaving(true)
    setAddError(null)
    try {
      await adminAddSurrogate({
        ...addForm,
        assignedTo: currentUser.email,
        referralPartner: addForm.referralPartner ? 'be_surrogacy' : null,
      })
      // Refresh list
      const data = await fetchSurrogatesFromIntake()
      setSurrogates(data || [])
      setAddOpen(false)
      setAddForm({ firstName: '', lastName: '', email: '', phone: '', state: '', dob: '', referralPartner: false })
      setAddSuccess(true)
      setTimeout(() => setAddSuccess(false), 3000)
    } catch (err) {
      setAddError(err.message || 'Failed to add surrogate. Please try again.')
    } finally { setAddSaving(false) }
  }

  async function handleAssign(surrogateId, adminEmail) {
    try {
      await assignSurrogateToAdmin(surrogateId, adminEmail)
      setSurrogates(prev => prev.map(s => s.id === surrogateId ? { ...s, assignedTo: adminEmail } : s))
    } catch {}
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Surrogates"
        subtitle={`${filtered.length} of ${surrogates.length} surrogate${surrogates.length !== 1 ? 's' : ''} shown`}
        actions={
          <Button className="gap-2" onClick={() => setAddOpen(true)}>
            <Plus className="size-4" />
            Add Surrogate
          </Button>
        }
      />

      {addSuccess && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm font-medium">
          <CheckCircle className="size-4" /> Surrogate added successfully and assigned to you.
        </div>
      )}

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

        {/* Owner filter */}
        <Select value={ownerFilter} onValueChange={setOwnerFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="mine">My Cases ({myCaseCount})</SelectItem>
            {canSeeAll && <SelectItem value="all">All Cases ({surrogates.length})</SelectItem>}
            <SelectItem value="unassigned">Unassigned ({unassignedCount})</SelectItem>
            {canSeeAll && ADMIN_STAFF.map(admin => (
              <SelectItem key={admin.email} value={admin.email}>
                {admin.name} ({surrogates.filter(s => s.assignedTo === admin.email).length})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

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
          description={
            ownerFilter === 'mine' && myCaseCount === 0
              ? "You don't have any cases assigned to you yet."
              : surrogates.length === 0
              ? "Surrogates will appear here once they complete the intake quiz and qualify."
              : "Try adjusting your search or filters."
          }
        />
      ) : view === 'tile' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filtered.map(surrogate => (
            <Card key={surrogate.id} className="transition-shadow hover:shadow-md h-full">
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <Link to={`/surrogates/${surrogate.id}`}>
                    <ProfileAvatar name={surrogate.name} size="lg" />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link to={`/surrogates/${surrogate.id}`} className="hover:underline">
                      <h3 className="font-heading font-semibold truncate">{surrogate.name}</h3>
                    </Link>
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
                  {surrogate.referralPartner === 'be_surrogacy' && <BeBadge />}
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground text-xs">Age</span>
                    <p className="font-medium">{surrogate.age || '—'}</p>
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

                {/* Gravida/Para */}
                {(() => { const gp = getGravidaPara(profiles[surrogate.email]); return gp ? <GravidaParaRow gp={gp} /> : null })()}

                {/* Assignment */}
                <div className="pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <UserCog className="size-3.5 text-muted-foreground" />
                      <Select
                        value={surrogate.assignedTo || '_unassigned'}
                        onValueChange={val => handleAssign(surrogate.id, val === '_unassigned' ? null : val)}
                      >
                        <SelectTrigger className="h-7 text-xs border-none shadow-none px-1 w-auto min-w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_unassigned">
                            <span className="text-muted-foreground">Unassigned</span>
                          </SelectItem>
                          {ADMIN_STAFF.map(admin => (
                            <SelectItem key={admin.email} value={admin.email}>
                              {admin.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Link to={`/surrogates/${surrogate.id}`}
                      className="text-xs text-abc-indigo font-medium flex items-center gap-1 hover:underline">
                      View <ArrowRight className="size-3" />
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
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
                <TableHead>Assigned To</TableHead>
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
                      {surrogate.referralPartner === 'be_surrogacy' && <img src="/be-logo.png" alt="BE" className="h-5 w-auto" />}
                    </div>
                  </TableCell>
                  <TableCell>{surrogate.location || '—'}</TableCell>
                  <TableCell><StatusBadge status={surrogate.status} /></TableCell>
                  <TableCell>
                    <span className={`text-sm ${surrogate.assignedTo ? '' : 'text-muted-foreground'}`}>
                      {surrogate.assignedTo ? getAdminName(surrogate.assignedTo) : 'Unassigned'}
                    </span>
                  </TableCell>
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

      {/* Add Surrogate Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Surrogate</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">First Name *</Label>
                <Input value={addForm.firstName} onChange={e => setAddForm(f => ({ ...f, firstName: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Last Name *</Label>
                <Input value={addForm.lastName} onChange={e => setAddForm(f => ({ ...f, lastName: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Email *</Label>
              <Input type="email" value={addForm.email} onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Phone *</Label>
                <Input type="tel" value={addForm.phone} onChange={e => setAddForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">State *</Label>
                <Input value={addForm.state} onChange={e => setAddForm(f => ({ ...f, state: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Date of Birth *</Label>
              <Input type="date" value={addForm.dob} onChange={e => setAddForm(f => ({ ...f, dob: e.target.value }))} />
            </div>

            {/* Be Surrogacy toggle */}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-3">
                <img src="/be-logo.png" alt="Be Surrogacy" className="h-7 w-auto" />
                <div>
                  <p className="text-sm font-medium">Referral</p>
                </div>
              </div>
              <Switch
                checked={addForm.referralPartner}
                onCheckedChange={v => setAddForm(f => ({ ...f, referralPartner: v }))}
              />
            </div>

            {addError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{addError}</p>
            )}
            <Button onClick={handleAddSurrogate}
              disabled={addSaving || !addForm.firstName || !addForm.lastName || !addForm.email || !addForm.phone || !addForm.state || !addForm.dob}
              className="w-full gap-1.5" style={{ backgroundColor: '#283693', color: '#fff' }}>
              {addSaving ? 'Adding...' : 'Add Surrogate'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
