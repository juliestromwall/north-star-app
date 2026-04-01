import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Heart, Users, Baby, Send, Search, ArrowRight, MapPin, Stethoscope, LinkIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select as SelectUI, SelectContent as SelectContentUI, SelectItem as SelectItemUI, SelectTrigger as SelectTriggerUI, SelectValue as SelectValueUI } from '@/components/ui/select'
import PageHeader from '@/components/shared/PageHeader'
import ProfileAvatar from '@/components/shared/ProfileAvatar'
import EmptyState from '@/components/shared/EmptyState'
import ShareProfileDialog from '@/components/shared/ShareProfileDialog'
import { useRole } from '@/context/RoleContext'
import { fetchSurrogatesFromIntake, fetchIPsFromIntake } from '@/lib/db'
import { getSurrogateStageStatus } from '@/lib/stageStatusStore'
import { createMatchedJourney, fetchMatchedJourneys } from '@/lib/matching'

export default function MatchingPage() {
  const { currentUser } = useRole()
  const [surrogates, setSurrogates] = useState([])
  const [ips, setIps] = useState([])
  const [journeys, setJourneys] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Share dialog
  const [shareTarget, setShareTarget] = useState(null) // { id, type, name }

  // Create match dialog
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState({ gcId: '', ipId: '' })
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    Promise.all([fetchSurrogatesFromIntake(), fetchIPsFromIntake(), fetchMatchedJourneys()])
      .then(([gcs, ips, js]) => {
        setSurrogates(gcs)
        setIps(ips)
        setJourneys(js)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Get GCs in matching stage
  const matchingGCs = useMemo(() => {
    return surrogates.filter(s => {
      const ss = getSurrogateStageStatus(s.id)
      return ss.stage === 'matching'
    })
  }, [surrogates])

  // All GCs and IPs for the create match dialog
  const matchedGcIds = new Set(journeys.map(j => j.gc_case_id))
  const matchedIpIds = new Set(journeys.map(j => j.ip_case_id))

  const filteredGCs = matchingGCs.filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase()))
  const filteredIPs = ips.filter(i => !search || (i.names || '').toLowerCase().includes(search.toLowerCase()))

  async function handleCreateMatch() {
    if (!createForm.gcId || !createForm.ipId) return
    setCreating(true)
    try {
      const journey = await createMatchedJourney({
        gcCaseId: Number(createForm.gcId),
        ipCaseId: Number(createForm.ipId),
        assignedTo: currentUser.email,
        createdBy: currentUser.name,
      })
      setJourneys(prev => [journey, ...prev])
      setShowCreate(false)
      setCreateForm({ gcId: '', ipId: '' })
    } catch (err) {
      alert('Failed to create match: ' + (err.message || 'Unknown error'))
    } finally { setCreating(false) }
  }

  if (loading) return <div className="text-center py-12 text-stone-400">Loading...</div>

  return (
    <div className="space-y-6">
      <PageHeader
        title="Matching Pipeline"
        subtitle={`${matchingGCs.length} surrogates ready · ${ips.length} intended parents · ${journeys.length} matched journeys`}
        actions={
          <Button className="gap-1.5" onClick={() => setShowCreate(true)}>
            <Plus className="size-4" /> Create Match
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="rounded-2xl">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="size-10 rounded-xl bg-pink-100 flex items-center justify-center"><Heart className="size-5 text-pink-600" /></div>
            <div><p className="text-2xl font-bold">{journeys.length}</p><p className="text-xs text-stone-500">Matched Journeys</p></div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="size-10 rounded-xl bg-emerald-100 flex items-center justify-center"><Users className="size-5 text-emerald-600" /></div>
            <div><p className="text-2xl font-bold">{matchingGCs.length}</p><p className="text-xs text-stone-500">GCs Ready to Match</p></div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="size-10 rounded-xl bg-sky-100 flex items-center justify-center"><Baby className="size-5 text-sky-600" /></div>
            <div><p className="text-2xl font-bold">{ips.length}</p><p className="text-xs text-stone-500">Intended Parents</p></div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search surrogates or intended parents..." className="pl-9" />
      </div>

      {/* Matched Journeys */}
      {journeys.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-stone-500 uppercase tracking-wider mb-3">Matched Journeys</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {journeys.map(j => {
              const gc = surrogates.find(s => s.id === j.gc_case_id)
              const ip = ips.find(i => i.id === j.ip_case_id)
              return (
                <Link key={j.id} to={`/journeys/${j.id}`}>
                  <Card className="rounded-2xl hover:shadow-md transition-shadow cursor-pointer group">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <Heart className="size-4 text-pink-500" />
                        <span className="text-xs font-medium text-stone-500">{j.stage?.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} · {j.status}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-pink-100 text-pink-700">GC</span>
                            <span className="text-sm font-semibold truncate">{gc?.name || '—'}</span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-sky-100 text-sky-700">IP</span>
                            <span className="text-sm font-semibold truncate">{ip?.names || '—'}</span>
                          </div>
                        </div>
                        <ArrowRight className="size-4 text-stone-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <p className="text-[10px] text-stone-400">Created {new Date(j.created_at).toLocaleDateString()}</p>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Surrogates Ready to Match */}
      <div>
        <h3 className="text-sm font-semibold text-stone-500 uppercase tracking-wider mb-3 flex items-center gap-2">
          <span className="size-2 rounded-full bg-pink-500" /> Surrogates in Matching Stage ({filteredGCs.length})
        </h3>
        {filteredGCs.length === 0 ? (
          <p className="text-sm text-stone-400">No surrogates currently in the Matching stage.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredGCs.map(gc => (
              <Card key={gc.id} className="rounded-2xl hover:shadow-md transition-shadow">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <ProfileAvatar name={gc.name} size="md" />
                    <div className="flex-1 min-w-0">
                      <Link to={`/surrogates/${gc.id}`} className="text-sm font-semibold hover:text-[#283693] truncate block">{gc.name}</Link>
                      <p className="text-xs text-stone-500">{gc.location} {gc.age ? `· Age ${gc.age}` : ''}</p>
                    </div>
                    {matchedGcIds.has(gc.id) && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">MATCHED</span>}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="gap-1 text-xs flex-1" onClick={() => setShareTarget({ id: gc.id, type: 'gc', name: gc.name })}>
                      <Send className="size-3" /> Share Profile
                    </Button>
                    <Button variant="outline" size="sm" className="text-xs" asChild>
                      <Link to={`/surrogates/${gc.id}`}>View</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Intended Parents */}
      <div>
        <h3 className="text-sm font-semibold text-stone-500 uppercase tracking-wider mb-3 flex items-center gap-2">
          <span className="size-2 rounded-full bg-sky-500" /> Intended Parents ({filteredIPs.length})
        </h3>
        {filteredIPs.length === 0 ? (
          <p className="text-sm text-stone-400">No intended parents in the system.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredIPs.map(ip => (
              <Card key={ip.id} className="rounded-2xl hover:shadow-md transition-shadow">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <ProfileAvatar name={ip.names} size="md" />
                    <div className="flex-1 min-w-0">
                      <Link to={`/intended-parents/${ip.id}`} className="text-sm font-semibold hover:text-[#283693] truncate block">{ip.names}</Link>
                      <p className="text-xs text-stone-500">
                        {ip.type}{ip.location ? ` · ${ip.location}` : ''}
                        {ip.reDoctorName ? ` · ${ip.reDoctorName}` : ''}
                      </p>
                    </div>
                    {matchedIpIds.has(ip.id) && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">MATCHED</span>}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="gap-1 text-xs flex-1" onClick={() => setShareTarget({ id: ip.id, type: 'ip', name: ip.names })}>
                      <Send className="size-3" /> Share Profile
                    </Button>
                    <Button variant="outline" size="sm" className="text-xs" asChild>
                      <Link to={`/intended-parents/${ip.id}`}>View</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Share Profile Dialog */}
      {shareTarget && (
        <ShareProfileDialog
          open={!!shareTarget}
          onOpenChange={() => setShareTarget(null)}
          caseId={shareTarget.id}
          caseType={shareTarget.type}
          caseName={shareTarget.name}
          currentUser={currentUser}
        />
      )}

      {/* Create Match Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Match</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs">Surrogate (GC)</Label>
              <SelectUI value={createForm.gcId ? String(createForm.gcId) : ''} onValueChange={v => setCreateForm(f => ({ ...f, gcId: v }))}>
                <SelectTriggerUI><SelectValueUI placeholder="Select surrogate..." /></SelectTriggerUI>
                <SelectContentUI>
                  {surrogates.map(s => <SelectItemUI key={s.id} value={String(s.id)}>{s.name} {matchedGcIds.has(s.id) ? '(matched)' : ''}</SelectItemUI>)}
                </SelectContentUI>
              </SelectUI>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Intended Parent (IP)</Label>
              <SelectUI value={createForm.ipId ? String(createForm.ipId) : ''} onValueChange={v => setCreateForm(f => ({ ...f, ipId: v }))}>
                <SelectTriggerUI><SelectValueUI placeholder="Select intended parent..." /></SelectTriggerUI>
                <SelectContentUI>
                  {ips.map(i => <SelectItemUI key={i.id} value={String(i.id)}>{i.names} {matchedIpIds.has(i.id) ? '(matched)' : ''}</SelectItemUI>)}
                </SelectContentUI>
              </SelectUI>
            </div>
            <Button onClick={handleCreateMatch} disabled={creating || !createForm.gcId || !createForm.ipId}
              className="w-full gap-1.5" style={{ backgroundColor: '#283693', color: '#fff' }}>
              {creating ? 'Creating...' : 'Create Match'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
