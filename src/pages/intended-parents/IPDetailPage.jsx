import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft, Mail, Phone, MapPin, Users, Baby, Stethoscope,
  Calendar, ClipboardList, Copy, Check, MessageSquare, Heart, UserCog, Egg,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select as SelectUI, SelectContent as SelectContentUI, SelectItem as SelectItemUI, SelectTrigger as SelectTriggerUI, SelectValue as SelectValueUI } from '@/components/ui/select'
import ProfileAvatar from '@/components/shared/ProfileAvatar'
import InfoRow from '@/components/shared/InfoRow'
import EmptyState from '@/components/shared/EmptyState'
import IPProfileTab from '@/components/intended-parents/IPProfileTab'
import { useRole } from '@/context/RoleContext'
import { fetchIPsFromIntake, updateIntakeSubmission, assignSurrogateToAdmin } from '@/lib/db'
import { mockUsers } from '@/data/mock/users'

const ADMIN_STAFF = mockUsers.filter(u => ['super_admin', 'master_admin', 'admin'].includes(u.role))

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = (e) => {
    e.stopPropagation()
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button onClick={handleCopy} className="text-stone-400 hover:text-stone-600 ml-1">
      {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
    </button>
  )
}

function boolLabel(val, yesText = 'Yes', noText = 'No') {
  if (val === true || val === 'yes' || val === 'Yes') return yesText
  if (val === false || val === 'no' || val === 'No') return noText
  return '—'
}

export default function IPDetailPage() {
  const { id } = useParams()
  const { currentUser } = useRole()
  const [ip, setIp] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchIPsFromIntake().then(all => {
      const found = all.find(item => String(item.id) === String(id))
      setIp(found || null)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [id])

  if (loading) {
    return <div className="text-center py-12 text-stone-400">Loading...</div>
  }

  if (!ip) {
    return (
      <div className="space-y-6">
        <Link to="/intended-parents" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Back to Intended Parents
        </Link>
        <EmptyState title="Intended Parent not found" description="This case doesn't exist." />
      </div>
    )
  }

  const a = ip.answers || {}
  const hasPartner = a.hasPartner === 'yes' || a.hasPartner === true

  return (
    <div className="space-y-6">
      <Link to="/intended-parents" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Back to Intended Parents
      </Link>

      {/* ─── Hero Section ─────────────────────────────────── */}
      <div className="rounded-2xl border border-stone-200/80 bg-white">
        <div className="p-6 space-y-6">
          {/* Name row */}
          <div className="flex flex-col sm:flex-row items-start gap-5">
            <ProfileAvatar name={ip.names} size="xl" className="ring-4 ring-white shadow-lg" />
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-heading font-bold text-stone-900">{ip.names}</h1>
                <Badge variant="outline" className="text-xs bg-sky-100 text-sky-800 border-sky-200">
                  {ip.type}
                </Badge>
                <span className="text-xs font-medium text-stone-400 capitalize">{ip.status?.replace(/_/g, ' ')}</span>
              </div>
              <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-stone-500">
                {ip.location && (
                  <span className="flex items-center gap-1"><MapPin className="size-3.5" /> {ip.location}{ip.country && ip.country !== 'United States' ? `, ${ip.country}` : ''}</span>
                )}
                <span className="flex items-center gap-1">
                  <Calendar className="size-3.5" />
                  Submitted {new Date(ip.submittedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
              {/* Assignment */}
              <div className="flex items-center gap-1.5 mt-2">
                <UserCog className="size-3.5 text-stone-400" />
                <span className="text-xs text-stone-400">Assigned to</span>
                <SelectUI
                  value={ip.assignedTo || '_unassigned'}
                  onValueChange={async val => {
                    const email = val === '_unassigned' ? null : val
                    await assignSurrogateToAdmin(ip.id, email).catch(() => {})
                    setIp(prev => ({ ...prev, assignedTo: email }))
                  }}
                >
                  <SelectTriggerUI className="h-7 text-xs font-semibold border-none shadow-none px-1 w-auto min-w-24 text-[#283693]">
                    <SelectValueUI />
                  </SelectTriggerUI>
                  <SelectContentUI>
                    <SelectItemUI value="_unassigned">Unassigned</SelectItemUI>
                    {ADMIN_STAFF.map(a => (
                      <SelectItemUI key={a.email} value={a.email}>{a.name}</SelectItemUI>
                    ))}
                  </SelectContentUI>
                </SelectUI>
              </div>
            </div>

            {/* Contact buttons */}
            <div className="flex gap-2 shrink-0">
              {ip.phone && (
                <Button size="sm" className="gap-1.5" asChild>
                  <a href={`sms:${ip.phone}`}><MessageSquare className="size-3.5" /> Text</a>
                </Button>
              )}
              {ip.email && (
                <Button variant="outline" size="sm" className="gap-1.5" asChild>
                  <a href={`mailto:${ip.email}`}><Mail className="size-3.5" /> Email</a>
                </Button>
              )}
              {ip.phone && (
                <Button variant="outline" size="sm" className="gap-1.5" asChild>
                  <a href={`tel:${ip.phone}`}><Phone className="size-3.5" /> Call</a>
                </Button>
              )}
            </div>
          </div>

          {/* Info tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {[
              { icon: Users, label: 'Type', value: ip.type || '—' },
              { icon: Stethoscope, label: 'RE Doctor', value: ip.hasRE ? (ip.reDoctorName || 'Yes') : '—' },
              { icon: Baby, label: 'Embryos', value: ip.hasFrozenEmbryos ? (ip.frozenEmbryoDetails || 'Yes') : boolLabel(ip.hasFrozenEmbryos) },
              { icon: Egg, label: 'Egg Donor', value: boolLabel(ip.usingEggDonor) },
              { icon: Heart, label: 'Sperm Donor', value: boolLabel(ip.usingSpermDonor) },
            ].map(tile => (
              <div key={tile.label} className="rounded-xl bg-stone-50/80 border border-stone-100 p-3 text-center">
                <tile.icon className="size-4 text-stone-300 mx-auto mb-1" />
                <p className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold">{tile.label}</p>
                <p className="text-lg font-bold mt-0.5 leading-tight text-stone-800">{tile.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Tabs ─────────────────────────────────────────── */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="contact">Contact</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="intake">Intake Answers</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* IP1 Info */}
            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle>Intended Parent 1</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <InfoRow icon={Users} label="Name" value={ip.ip1Name} />
                <InfoRow icon={Calendar} label="Date of Birth" value={a.primaryDob} />
                {ip.age && <InfoRow icon={Users} label="Age" value={`${ip.age}`} />}
                <InfoRow icon={Mail} label="Email" value={ip.email} />
                <InfoRow icon={Phone} label="Phone" value={ip.phone} />
              </CardContent>
            </Card>

            {/* IP2 Info */}
            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle>Intended Parent 2</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {hasPartner ? (
                  <>
                    <InfoRow icon={Users} label="Name" value={ip.ip2Name} />
                    <InfoRow icon={Calendar} label="Date of Birth" value={a.ip2Dob} />
                    <InfoRow icon={Mail} label="Email" value={ip.ip2Email} />
                    <InfoRow icon={Phone} label="Phone" value={ip.ip2Phone} />
                  </>
                ) : (
                  <p className="text-sm text-stone-400">No partner on this journey</p>
                )}
              </CardContent>
            </Card>

            {/* Fertility Info */}
            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle>Fertility Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <InfoRow icon={Stethoscope} label="Has RE" value={boolLabel(ip.hasRE)} />
                {ip.hasRE && ip.reDoctorName && (
                  <InfoRow icon={Stethoscope} label="RE Doctor / Clinic" value={ip.reDoctorName} />
                )}
                <InfoRow icon={Baby} label="Frozen Embryos" value={boolLabel(ip.hasFrozenEmbryos)} />
                {ip.hasFrozenEmbryos && ip.frozenEmbryoDetails && (
                  <InfoRow icon={Baby} label="Embryo Details" value={ip.frozenEmbryoDetails} />
                )}
                <InfoRow icon={Egg} label="Using Egg Donor" value={boolLabel(ip.usingEggDonor)} />
                <InfoRow icon={Heart} label="Using Sperm Donor" value={boolLabel(ip.usingSpermDonor)} />
              </CardContent>
            </Card>

            {/* Additional Info */}
            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle>Additional Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <InfoRow icon={ClipboardList} label="Wants Consultation" value={boolLabel(ip.wantsConsultation, 'Yes', 'Not right now')} />
                <InfoRow icon={ClipboardList} label="How They Heard" value={ip.hearAboutUs || '—'} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Contact Tab */}
        <TabsContent value="contact" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="rounded-2xl">
              <CardHeader><CardTitle>IP1 Contact</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-stone-400 uppercase tracking-wide font-semibold">Email</p>
                    <p className="text-sm font-medium">{ip.email}</p>
                  </div>
                  <CopyButton text={ip.email} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-stone-400 uppercase tracking-wide font-semibold">Phone</p>
                    <p className="text-sm font-medium">{ip.phone}</p>
                  </div>
                  <CopyButton text={ip.phone} />
                </div>
              </CardContent>
            </Card>

            {hasPartner && (
              <Card className="rounded-2xl">
                <CardHeader><CardTitle>IP2 Contact</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-stone-400 uppercase tracking-wide font-semibold">Email</p>
                      <p className="text-sm font-medium">{ip.ip2Email}</p>
                    </div>
                    <CopyButton text={ip.ip2Email} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-stone-400 uppercase tracking-wide font-semibold">Phone</p>
                      <p className="text-sm font-medium">{ip.ip2Phone}</p>
                    </div>
                    <CopyButton text={ip.ip2Phone} />
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className={`rounded-2xl ${hasPartner ? 'lg:col-span-2' : ''}`}>
              <CardHeader><CardTitle>Address</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm">{[a.street, a.street2].filter(Boolean).join(', ')}</p>
                <p className="text-sm">{[a.city, a.stateProv, a.zipCode].filter(Boolean).join(', ')}</p>
                {a.country && a.country !== 'United States' && <p className="text-sm">{a.country}</p>}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-6 mt-4">
          <IPProfileTab
            ip={ip}
            onUpdate={async (updatedAnswers) => {
              try {
                await updateIntakeSubmission(ip.id, { answers: updatedAnswers })
                setIp(prev => ({ ...prev, answers: updatedAnswers }))
              } catch (err) {
                console.error('Failed to save IP profile:', err)
              }
            }}
          />
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents" className="space-y-6 mt-4">
          <EmptyState title="Documents" description="Document management for intended parents coming soon." />
        </TabsContent>

        {/* Notes Tab */}
        <TabsContent value="notes" className="space-y-6 mt-4">
          <EmptyState title="Notes" description="Case notes for intended parents coming soon." />
        </TabsContent>

        {/* Intake Answers Tab */}
        <TabsContent value="intake" className="space-y-6 mt-4">
          <Card className="rounded-2xl">
            <CardHeader><CardTitle>Raw Intake Answers</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                {Object.entries(a).filter(([k, v]) => v !== null && v !== '' && v !== undefined && !k.startsWith('_')).map(([key, value]) => (
                  <div key={key}>
                    <p className="text-xs text-stone-400 uppercase tracking-wide font-semibold">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                    <p className="font-medium">{typeof value === 'boolean' ? (value ? 'Yes' : 'No') : typeof value === 'object' ? JSON.stringify(value) : String(value)}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
