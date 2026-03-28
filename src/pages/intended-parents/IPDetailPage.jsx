import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft, Mail, Phone, MapPin, Users, Baby, Stethoscope,
  Calendar, ClipboardList, Copy, Check
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import ProfileAvatar from '@/components/shared/ProfileAvatar'
import InfoRow from '@/components/shared/InfoRow'
import EmptyState from '@/components/shared/EmptyState'
import { fetchIPsFromIntake } from '@/lib/db'

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

export default function IPDetailPage() {
  const { id } = useParams()
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
  const hasPartner = a.hasPartner === true

  return (
    <div className="space-y-6">
      <Link to="/intended-parents" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Back to Intended Parents
      </Link>

      {/* Hero */}
      <Card className="bg-gradient-to-r from-[#464DA0]/5 to-[#464DA0]/10">
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start gap-4">
            <ProfileAvatar name={ip.names} size="xl" />
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-heading font-bold">{ip.names}</h1>
                <StatusBadge status={ip.status} />
                <Badge variant="outline" className={`text-xs ${TYPE_STYLES[ip.type] || ''}`}>
                  {ip.type}
                </Badge>
              </div>
              {ip.location && (
                <p className="text-muted-foreground mt-1 flex items-center gap-1">
                  <MapPin className="size-3.5" /> {ip.location}{ip.country && ip.country !== 'United States' ? `, ${ip.country}` : ''}
                </p>
              )}
              <p className="text-xs text-stone-400 mt-1">
                Applied {new Date(ip.submittedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            </div>

            {/* Quick contact buttons */}
            <div className="flex gap-2 shrink-0">
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
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="contact">Contact</TabsTrigger>
          <TabsTrigger value="intake">Intake Answers</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* IP1 Info */}
            <Card>
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
            <Card>
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
            <Card>
              <CardHeader>
                <CardTitle>Fertility Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <InfoRow icon={Stethoscope} label="Has RE" value={ip.hasRE === true ? 'Yes' : ip.hasRE === false ? 'Not yet' : '—'} />
                {ip.hasRE === true && ip.reDoctorName && (
                  <InfoRow icon={Stethoscope} label="Doctor" value={ip.reDoctorName} />
                )}
                <InfoRow icon={Baby} label="Frozen Embryos" value={ip.hasFrozenEmbryos === true ? 'Yes' : ip.hasFrozenEmbryos === false ? 'No' : '—'} />
                {ip.hasFrozenEmbryos === true && ip.frozenEmbryoDetails && (
                  <InfoRow icon={Baby} label="Details" value={ip.frozenEmbryoDetails} />
                )}
                <InfoRow icon={Baby} label="Egg Donor" value={ip.usingEggDonor === true ? 'Yes' : ip.usingEggDonor === false ? 'No' : '—'} />
                <InfoRow icon={Baby} label="Sperm Donor" value={ip.usingSpermDonor === true ? 'Yes' : ip.usingSpermDonor === false ? 'No' : '—'} />
              </CardContent>
            </Card>

            {/* Additional Info */}
            <Card>
              <CardHeader>
                <CardTitle>Additional Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <InfoRow icon={ClipboardList} label="Wants Consultation" value={ip.wantsConsultation === true ? 'Yes' : ip.wantsConsultation === false ? 'Not right now' : '—'} />
                <InfoRow icon={ClipboardList} label="How They Heard" value={ip.hearAboutUs || '—'} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Contact Tab */}
        <TabsContent value="contact" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
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
              <Card>
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

            <Card className={hasPartner ? 'lg:col-span-2' : ''}>
              <CardHeader><CardTitle>Address</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm">{a.street}{a.street2 ? `, ${a.street2}` : ''}</p>
                <p className="text-sm">{a.city}, {a.stateProv} {a.zipCode}</p>
                {a.country && a.country !== 'United States' && <p className="text-sm">{a.country}</p>}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Intake Answers Tab */}
        <TabsContent value="intake" className="space-y-6 mt-4">
          <Card>
            <CardHeader><CardTitle>Raw Intake Answers</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                {Object.entries(a).filter(([_, v]) => v !== null && v !== '' && v !== undefined).map(([key, value]) => (
                  <div key={key}>
                    <p className="text-xs text-stone-400 uppercase tracking-wide font-semibold">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                    <p className="font-medium">{typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}</p>
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
