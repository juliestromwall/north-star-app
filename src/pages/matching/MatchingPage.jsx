import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Heart, Users, Baby, Send, Search, ArrowRight, MapPin, Stethoscope, ChevronDown, Eye, Clock, MessageSquare, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select as SelectUI, SelectContent as SelectContentUI, SelectItem as SelectItemUI, SelectTrigger as SelectTriggerUI, SelectValue as SelectValueUI } from '@/components/ui/select'
import PageHeader from '@/components/shared/PageHeader'
import ProfileAvatar from '@/components/shared/ProfileAvatar'
import StageBadge from '@/components/shared/StageBadge'
import EmptyState from '@/components/shared/EmptyState'
import ShareProfileDialog from '@/components/shared/ShareProfileDialog'
import { useRole } from '@/context/RoleContext'
import { fetchSurrogatesFromIntake, fetchIPsFromIntake, getProfilePhotoUrls, fetchSurrogateProfilesByEmails } from '@/lib/db'
import { getSurrogateStageStatus } from '@/lib/stageStatusStore'
import { createMatchedJourney, fetchMatchedJourneys, fetchSharesForCase, fetchMatchQuestions } from '@/lib/matching'

function getGTPAL(profileData) {
  if (!profileData?.pregnancyHistory) return null
  const pregs = profileData.pregnancyHistory.pregnancies || []
  const numPreg = parseInt(profileData.pregnancyHistory.numberOfPregnancies) || 0
  if (numPreg === 0 && pregs.length === 0) return null
  let g = Math.max(numPreg, pregs.length), t = 0, p = 0, a = 0, l = 0
  pregs.forEach(pr => {
    if (pr.outcome === 'Live Birth') { if (parseInt(pr.gestationWeeks) >= 37) t++; else p++; l++ }
    else if (['Miscarriage', 'Ectopic Pregnancy', 'Termination', 'Stillborn'].includes(pr.outcome)) a++
  })
  return { g, t, p, a, l, display: `G${g}P${t}${p}${a}${l}` }
}

function timeAgo(date) {
  const diff = Date.now() - new Date(date).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'today'
  if (days === 1) return '1d ago'
  if (days < 30) return `${days}d ago`
  return `${Math.floor(days / 30)}mo ago`
}

export default function MatchingPage() {
  const { currentUser } = useRole()
  const [surrogates, setSurrogates] = useState([])
  const [ips, setIps] = useState([])
  const [journeys, setJourneys] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [avatarUrls, setAvatarUrls] = useState({})
  const [profileMap, setProfileMap] = useState({})
  const [shareHistory, setShareHistory] = useState({}) // { caseId: [shares] }

  const [shareTarget, setShareTarget] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState({ gcId: '', ipId: '' })
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    Promise.all([fetchSurrogatesFromIntake(), fetchIPsFromIntake(), fetchMatchedJourneys()])
      .then(async ([gcs, allIps, js]) => {
        setSurrogates(gcs)
        setIps(allIps)
        setJourneys(js)

        // Load profile photos
        const userIds = gcs.filter(g => g.userId).map(g => g.userId)
        if (userIds.length > 0) {
          getProfilePhotoUrls(userIds).then(setAvatarUrls).catch(() => {})
        }

        // Load profile data for GCs (for GTPAL/BMI)
        const emails = gcs.map(g => g.email).filter(Boolean)
        if (emails.length > 0) {
          fetchSurrogateProfilesByEmails(emails).then(map => {
            const byId = {}
            for (const g of gcs) {
              if (g.email && map[g.email.trim().toLowerCase()]) byId[g.id] = map[g.email.trim().toLowerCase()]
            }
            setProfileMap(byId)
          }).catch(() => {})
        }

        // Load share history for matching GCs
        const matchingGcs = gcs.filter(g => getSurrogateStageStatus(g.id).stage === 'matching')
        const sharePromises = matchingGcs.map(g => fetchSharesForCase(g.id).then(shares => [g.id, shares]))
        Promise.all(sharePromises).then(results => {
          const map = {}
          results.forEach(([id, shares]) => { if (shares.length > 0) map[id] = shares })
          setShareHistory(map)
        }).catch(() => {})
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const matchingGCs = useMemo(() => {
    return surrogates.filter(s => getSurrogateStageStatus(s.id).stage === 'matching')
  }, [surrogates])

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
      alert('Failed: ' + (err.message || 'Unknown error'))
    } finally { setCreating(false) }
  }

  if (loading) return <div className="text-center py-12 text-stone-400">Loading...</div>

  return (
    <div className="space-y-6">
      <PageHeader
        title="Matching Pipeline"
        subtitle={`${matchingGCs.length} surrogates ready · ${ips.length} intended parents · ${journeys.length} matched`}
        actions={<Button className="gap-1.5" onClick={() => setShowCreate(true)}><Plus className="size-4" /> Create Match</Button>}
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="rounded-2xl"><CardContent className="p-4 flex items-center gap-3">
          <div className="size-10 rounded-xl bg-pink-100 flex items-center justify-center"><Heart className="size-5 text-pink-600" /></div>
          <div><p className="text-2xl font-bold">{journeys.length}</p><p className="text-xs text-stone-500">Matched Journeys</p></div>
        </CardContent></Card>
        <Card className="rounded-2xl"><CardContent className="p-4 flex items-center gap-3">
          <div className="size-10 rounded-xl bg-emerald-100 flex items-center justify-center"><Users className="size-5 text-emerald-600" /></div>
          <div><p className="text-2xl font-bold">{matchingGCs.length}</p><p className="text-xs text-stone-500">GCs Ready to Match</p></div>
        </CardContent></Card>
        <Card className="rounded-2xl"><CardContent className="p-4 flex items-center gap-3">
          <div className="size-10 rounded-xl bg-sky-100 flex items-center justify-center"><Baby className="size-5 text-sky-600" /></div>
          <div><p className="text-2xl font-bold">{ips.length}</p><p className="text-xs text-stone-500">Intended Parents</p></div>
        </CardContent></Card>
      </div>

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
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Surrogates in Matching */}
      <div>
        <h3 className="text-sm font-semibold text-stone-500 uppercase tracking-wider mb-3 flex items-center gap-2">
          <span className="size-2 rounded-full bg-pink-500" /> Surrogates in Matching Stage ({filteredGCs.length})
        </h3>
        {filteredGCs.length === 0 ? (
          <p className="text-sm text-stone-400">No surrogates currently in the Matching stage.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredGCs.map(gc => {
              const ss = getSurrogateStageStatus(gc.id)
              const profile = profileMap[gc.id]
              const gtpal = getGTPAL(profile)
              const avatarUrl = gc.userId ? avatarUrls[gc.userId] : null
              const heightStr = gc.heightFt ? `${gc.heightFt}'${gc.heightIn || 0}"` : null
              const shares = shareHistory[gc.id] || []

              return (
                <Card key={gc.id} className="rounded-2xl hover:shadow-md transition-shadow">
                  <CardContent className="p-4 space-y-3">
                    {/* Name + avatar */}
                    <div className="flex items-center gap-3">
                      <ProfileAvatar name={gc.name} avatar={avatarUrl || profile?.personal?.profilePhotoUrl} size="lg" className="ring-2 ring-white shadow" />
                      <div className="flex-1 min-w-0">
                        <Link to={`/surrogates/${gc.id}`} className="text-sm font-bold hover:text-[#283693] truncate block">{gc.name}</Link>
                        {gc.location && <p className="text-xs text-stone-500 flex items-center gap-1"><MapPin className="size-3" />{gc.location}</p>}
                        <div className="flex items-center gap-1.5 mt-1">
                          <StageBadge stage={ss.stage} status={ss.status} />
                          <span className="text-[10px] text-stone-400">{timeAgo(gc.submittedAt)}</span>
                        </div>
                      </div>
                      {matchedGcIds.has(gc.id) && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">MATCHED</span>}
                    </div>

                    {/* Stats: Age, Height, BMI */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-lg bg-stone-50 border border-stone-100 p-2 text-center">
                        <p className="text-[9px] text-stone-400 uppercase font-semibold">Age</p>
                        <p className="text-base font-bold">{gc.age || '—'}</p>
                      </div>
                      <div className="rounded-lg bg-stone-50 border border-stone-100 p-2 text-center">
                        <p className="text-[9px] text-stone-400 uppercase font-semibold">Height</p>
                        <p className="text-base font-bold">{heightStr || '—'}</p>
                      </div>
                      <div className="rounded-lg bg-stone-50 border border-stone-100 p-2 text-center">
                        <p className="text-[9px] text-stone-400 uppercase font-semibold">BMI</p>
                        <p className="text-base font-bold">{gc.bmi || '—'}</p>
                      </div>
                    </div>

                    {/* GTPAL */}
                    {gtpal && (
                      <div className="rounded-lg bg-pink-50/50 border border-pink-100 p-2">
                        <p className="text-[9px] text-stone-400 uppercase font-semibold flex items-center gap-1"><Baby className="size-3" /> Pregnancy History</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-sm font-bold text-pink-700">{gtpal.display}</span>
                          <span className="text-[10px] text-stone-500">{gtpal.g} preg</span>
                          <span className="text-[10px] text-stone-400">|</span>
                          <span className="text-[10px] text-stone-500">{gtpal.t} term</span>
                          <span className="text-[10px] text-stone-400">|</span>
                          <span className="text-[10px] text-stone-500">{gtpal.l} living</span>
                        </div>
                      </div>
                    )}

                    {/* Marital status */}
                    <div className="flex items-center gap-3 text-xs text-stone-500">
                      <span className="flex items-center gap-1"><Heart className="size-3" />{profile?.personal?.maritalStatus || gc.maritalStatus || '—'}</span>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button size="sm" className="gap-1 text-xs flex-1" style={{ backgroundColor: '#283693', color: '#fff' }}
                        onClick={() => setShareTarget({ id: gc.id, type: 'gc', name: gc.name })}>
                        <Send className="size-3" /> Share Profile
                      </Button>
                      <Button variant="outline" size="sm" className="text-xs" asChild>
                        <Link to={`/surrogates/${gc.id}`}>View</Link>
                      </Button>
                    </div>

                    {/* Match History (expandable) */}
                    {shares.length > 0 && (
                      <Collapsible>
                        <CollapsibleTrigger asChild>
                          <button className="w-full flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-600 pt-1">
                            <Clock className="size-3" />
                            <span>Match History ({shares.length})</span>
                            <ChevronDown className="size-3 ml-auto" />
                          </button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="space-y-2 mt-2 pt-2 border-t">
                            {shares.map(s => (
                              <div key={s.id} className="text-[11px] text-stone-500 space-y-0.5">
                                <div className="flex items-center gap-1.5">
                                  <Send className="size-2.5 text-stone-400" />
                                  <span>Sent to <span className="font-medium text-stone-700">{s.shared_to_email}</span></span>
                                </div>
                                <div className="flex items-center gap-3 pl-4 text-stone-400">
                                  <span>by {s.shared_by}</span>
                                  <span>{new Date(s.created_at).toLocaleDateString()}</span>
                                  {s.viewed_at && <span className="flex items-center gap-0.5 text-emerald-600"><Eye className="size-2.5" /> Viewed</span>}
                                  {new Date(s.expires_at) < new Date() && !s.viewed_at && <span className="text-red-400">Expired</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    )}
                  </CardContent>
                </Card>
              )
            })}
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
                      <p className="text-xs text-stone-500">{ip.type}{ip.location ? ` · ${ip.location}` : ''}</p>
                      {ip.reDoctorName && <p className="text-xs text-stone-400 flex items-center gap-1"><Stethoscope className="size-3" />{ip.reDoctorName}</p>}
                    </div>
                    {matchedIpIds.has(ip.id) && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">MATCHED</span>}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" className="gap-1 text-xs flex-1" style={{ backgroundColor: '#283693', color: '#fff' }}
                      onClick={() => setShareTarget({ id: ip.id, type: 'ip', name: ip.names })}>
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

      {/* Share Dialog */}
      {shareTarget && (
        <ShareProfileDialog open={!!shareTarget} onOpenChange={() => setShareTarget(null)}
          caseId={shareTarget.id} caseType={shareTarget.type} caseName={shareTarget.name} currentUser={currentUser} />
      )}

      {/* Create Match Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Create Match</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs">Surrogate (GC)</Label>
              <SelectUI value={createForm.gcId ? String(createForm.gcId) : ''} onValueChange={v => setCreateForm(f => ({ ...f, gcId: v }))}>
                <SelectTriggerUI><SelectValueUI placeholder="Select surrogate..." /></SelectTriggerUI>
                <SelectContentUI>{surrogates.map(s => <SelectItemUI key={s.id} value={String(s.id)}>{s.name}</SelectItemUI>)}</SelectContentUI>
              </SelectUI>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Intended Parent (IP)</Label>
              <SelectUI value={createForm.ipId ? String(createForm.ipId) : ''} onValueChange={v => setCreateForm(f => ({ ...f, ipId: v }))}>
                <SelectTriggerUI><SelectValueUI placeholder="Select intended parent..." /></SelectTriggerUI>
                <SelectContentUI>{ips.map(i => <SelectItemUI key={i.id} value={String(i.id)}>{i.names}</SelectItemUI>)}</SelectContentUI>
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
