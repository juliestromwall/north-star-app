import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Search, Plus, MapPin, Calendar, ArrowRight, LayoutGrid, List, Stethoscope, Baby, Users } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import PageHeader from '@/components/shared/PageHeader'
import ProfileAvatar from '@/components/shared/ProfileAvatar'
import EmptyState from '@/components/shared/EmptyState'
import { useRole } from '@/context/RoleContext'
import { fetchIPsFromIntake, adminAddIP } from '@/lib/db'
import { fetchMatchedJourneys } from '@/lib/matching'

const US_STATES = [
  'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut',
  'Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa',
  'Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan',
  'Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada',
  'New Hampshire','New Jersey','New Mexico','New York','North Carolina',
  'North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island',
  'South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont',
  'Virginia','Washington','West Virginia','Wisconsin','Wyoming'
]

const STATUS_STYLES = {
  new:             'bg-pink-100 text-pink-700 border-pink-200',
  qualified:       'bg-emerald-100 text-emerald-700 border-emerald-200',
  approved:        'bg-blue-100 text-blue-700 border-blue-200',
  active:          'bg-blue-100 text-blue-700 border-blue-200',
  pending_review:  'bg-amber-100 text-amber-700 border-amber-200',
  reviewed:        'bg-violet-100 text-violet-700 border-violet-200',
}

const TYPE_STYLES = {
  'Couple':        'bg-sky-100 text-sky-800 border-sky-200',
  'Single parent': 'bg-amber-100 text-amber-800 border-amber-200',
}

function StatusBadge({ status }) {
  const label = status === 'new' ? 'New' : status === 'pending_review' ? 'Pending Review' : status.charAt(0).toUpperCase() + status.slice(1)
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLES[status] || 'bg-stone-100 text-stone-500 border-stone-200'}`}>
      {label}
    </span>
  )
}

function formatPhone(val) {
  const digits = val.replace(/\D/g, '').slice(0, 10)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

export default function IPListPage() {
  const { currentUser } = useRole()
  const [ips, setIps] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [view, setView] = useState('tile')
  const navigate = useNavigate()

  // Add IP dialog state
  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState({ firstName: '', lastName: '', email: '', phone: '', state: '', hasPartner: false, ip2FirstName: '', ip2LastName: '', ip2Email: '', ip2Phone: '' })
  const [addSaving, setAddSaving] = useState(false)
  const [addError, setAddError] = useState(null)

  async function handleAddIP() {
    if (!addForm.firstName || !addForm.email) return
    setAddSaving(true)
    setAddError(null)
    try {
      await adminAddIP({ ...addForm, assignedTo: currentUser.email })
      const data = await fetchIPsFromIntake()
      setIps(data || [])
      setAddOpen(false)
      setAddForm({ firstName: '', lastName: '', email: '', phone: '', state: '', hasPartner: false, ip2FirstName: '', ip2LastName: '', ip2Email: '', ip2Phone: '' })
    } catch (err) {
      setAddError(err.message || 'Failed to add intended parent.')
    } finally { setAddSaving(false) }
  }

  useEffect(() => {
    Promise.all([fetchIPsFromIntake(), fetchMatchedJourneys()])
      .then(([data, journeys]) => {
        const matchedIpIds = new Set((journeys || []).map(j => j.ip_case_id))
        setIps((data || []).filter(ip => !matchedIpIds.has(ip.id)))
      })
      .catch(() => setIps([]))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    return ips.filter(ip => {
      const matchesSearch = !search ||
        ip.names.toLowerCase().includes(search.toLowerCase()) ||
        ip.email.toLowerCase().includes(search.toLowerCase()) ||
        ip.location.toLowerCase().includes(search.toLowerCase())
      const matchesStatus = statusFilter === 'all' || ip.status === statusFilter
      const matchesType = typeFilter === 'all' || ip.type === typeFilter
      return matchesSearch && matchesStatus && matchesType
    })
  }, [ips, search, statusFilter, typeFilter])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Intended Parents"
        subtitle={`${ips.length} intended parent${ips.length !== 1 ? 's' : ''} in program`}
        actions={
          <Button className="gap-2" onClick={() => setAddOpen(true)}>
            <Plus className="size-4" /> Add IP
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
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="pending_review">Pending Review</SelectItem>
            <SelectItem value="reviewed">Reviewed</SelectItem>
            <SelectItem value="qualified">Qualified</SelectItem>
            <SelectItem value="active">Active</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="Couple">Couple</SelectItem>
            <SelectItem value="Single parent">Single Parent</SelectItem>
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
        <div className="text-center py-12 text-stone-400">Loading...</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No intended parents found"
          description={ips.length === 0 ? "No IP applications have been submitted yet." : "Try adjusting your search or filters."}
        />
      ) : view === 'tile' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filtered.map(ip => (
            <Link key={ip.id} to={`/intended-parents/${ip.id}`} className="group">
              <Card className="transition-shadow hover:shadow-md h-full">
                <CardContent className="space-y-4">
                  <div className="flex items-start gap-3">
                    <ProfileAvatar name={ip.names} size="lg" />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-heading font-semibold truncate">{ip.names}</h3>
                      {ip.location && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground mt-0.5">
                          <MapPin className="size-3.5" />
                          <span>{ip.location}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <StatusBadge status={ip.status} />
                        <Badge variant="outline" className={`text-[10px] ${TYPE_STYLES[ip.type] || ''}`}>
                          {ip.type}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground text-xs">Submitted</span>
                      <p className="font-medium flex items-center gap-1">
                        <Calendar className="size-3.5 text-muted-foreground" />
                        {new Date(ip.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">RE / Fertility Doctor</span>
                      <p className="font-medium flex items-center gap-1">
                        <Stethoscope className="size-3.5 text-muted-foreground" />
                        {ip.hasRE === true ? (ip.reDoctorName || 'Yes') : ip.hasRE === false ? 'Not yet' : '—'}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">Frozen Embryos</span>
                      <p className="font-medium flex items-center gap-1">
                        <Baby className="size-3.5 text-muted-foreground" />
                        {ip.hasFrozenEmbryos === true ? (ip.frozenEmbryoDetails || 'Yes') : ip.hasFrozenEmbryos === false ? 'No' : '—'}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">Consultation</span>
                      <p className="font-medium">
                        {ip.wantsConsultation === true ? 'Yes' : ip.wantsConsultation === false ? 'No' : '—'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-end pt-2 border-t">
                    <span className="text-xs text-abc-indigo font-medium flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      View Case <ArrowRight className="size-3" />
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
                <TableHead>Type</TableHead>
                <TableHead>RE</TableHead>
                <TableHead>Embryos</TableHead>
                <TableHead>Submitted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(ip => (
                <TableRow
                  key={ip.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/intended-parents/${ip.id}`)}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <ProfileAvatar name={ip.names} size="sm" />
                      <div>
                        <span className="font-medium">{ip.names}</span>
                        <p className="text-xs text-stone-400">{ip.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{ip.location}</TableCell>
                  <TableCell><StatusBadge status={ip.status} /></TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-[10px] ${TYPE_STYLES[ip.type] || ''}`}>
                      {ip.type}
                    </Badge>
                  </TableCell>
                  <TableCell>{ip.hasRE === true ? (ip.reDoctorName || 'Yes') : ip.hasRE === false ? 'Not yet' : '—'}</TableCell>
                  <TableCell>{ip.hasFrozenEmbryos === true ? 'Yes' : ip.hasFrozenEmbryos === false ? 'No' : '—'}</TableCell>
                  <TableCell className="text-stone-500">{new Date(ip.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
      {/* Add IP Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Intended Parent</DialogTitle>
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
                <Input type="tel" value={addForm.phone} onChange={e => setAddForm(f => ({ ...f, phone: formatPhone(e.target.value) }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">State</Label>
                <Select value={addForm.state} onValueChange={v => setAddForm(f => ({ ...f, state: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {US_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Has a Partner?</p>
                <p className="text-xs text-muted-foreground">Going through the journey with someone</p>
              </div>
              <Switch
                checked={addForm.hasPartner}
                onCheckedChange={v => setAddForm(f => ({ ...f, hasPartner: v }))}
              />
            </div>

            {addForm.hasPartner && (
              <div className="space-y-3 rounded-lg border p-3 bg-stone-50">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Partner Details</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">First Name</Label>
                    <Input value={addForm.ip2FirstName} onChange={e => setAddForm(f => ({ ...f, ip2FirstName: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Last Name</Label>
                    <Input value={addForm.ip2LastName} onChange={e => setAddForm(f => ({ ...f, ip2LastName: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Email</Label>
                    <Input type="email" value={addForm.ip2Email} onChange={e => setAddForm(f => ({ ...f, ip2Email: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Phone</Label>
                    <Input type="tel" value={addForm.ip2Phone} onChange={e => setAddForm(f => ({ ...f, ip2Phone: formatPhone(e.target.value) }))} />
                  </div>
                </div>
              </div>
            )}

            {addError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{addError}</p>
            )}
            <Button onClick={handleAddIP}
              disabled={addSaving || !addForm.firstName || !addForm.lastName || !addForm.email || !addForm.phone}
              className="w-full gap-1.5" style={{ backgroundColor: '#283693', color: '#fff' }}>
              {addSaving ? 'Adding...' : 'Add Intended Parent'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
