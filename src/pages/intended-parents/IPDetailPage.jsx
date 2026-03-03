import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft, Mail, Phone, Video, Briefcase, Globe, Church, Users,
  DollarSign, MessageSquare, Pencil, FileText, Baby, Target, MapPin
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import StatusBadge from '@/components/shared/StatusBadge'
import ProfileAvatar from '@/components/shared/ProfileAvatar'
import InfoRow from '@/components/shared/InfoRow'
import ScreeningStatusItem from '@/components/shared/ScreeningStatusItem'
import TimelineItem from '@/components/shared/TimelineItem'
import EmptyState from '@/components/shared/EmptyState'
import { mockIntendedParents } from '@/data/mock/intendedParents'
import { mockSurrogates } from '@/data/mock/surrogates'

const TYPE_STYLES = {
  'Same-sex couple': 'bg-violet-100 text-violet-800 border-violet-200',
  'Heterosexual couple': 'bg-sky-100 text-sky-800 border-sky-200',
  'Single parent': 'bg-amber-100 text-amber-800 border-amber-200',
}

const DOC_STATUS_STYLES = {
  received: 'bg-green-500',
  pending: 'bg-yellow-500',
  missing: 'bg-gray-300',
}

export default function IPDetailPage() {
  const { id } = useParams()
  const ip = mockIntendedParents.find(p => p.id === id)
  const [noteText, setNoteText] = useState('')

  if (!ip) {
    return (
      <div className="space-y-6">
        <Link to="/intended-parents" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Back to Intended Parents
        </Link>
        <EmptyState title="Intended Parent not found" description="This profile doesn't exist." />
      </div>
    )
  }

  const matchedSurrogate = ip.matchedWith
    ? mockSurrogates.find(s => s.id === ip.matchedWith)
    : null

  return (
    <div className="space-y-6">
      <Link to="/intended-parents" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Back to Intended Parents
      </Link>

      {/* Hero */}
      <Card className="bg-gradient-to-r from-abc-indigo/5 to-abc-coral/5">
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start gap-4">
            <ProfileAvatar name={ip.names} avatar={ip.avatar} size="xl" />
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-heading font-bold">{ip.names}</h1>
                <StatusBadge status={ip.status} />
                <Badge variant="outline" className={`text-xs ${TYPE_STYLES[ip.type] || ''}`}>
                  {ip.type}
                </Badge>
                {ip.matchStage && (
                  <Badge variant="outline" className="bg-abc-coral/20 text-abc-navy border-abc-coral/30 text-xs">
                    {ip.matchStage}
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground mt-1">{ip.location}</p>
              <p className="text-sm mt-2 max-w-2xl">{ip.bio}</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button variant="outline" size="sm" className="gap-1.5">
                <MessageSquare className="size-3.5" /> Send Message
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" disabled>
                <Pencil className="size-3.5" /> Edit Profile
              </Button>
            </div>
          </div>

          <Separator />

          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <span><span className="text-muted-foreground">Ages:</span> <strong>{ip.ages}</strong></span>
            <span><span className="text-muted-foreground">Budget:</span> <strong>{ip.budget}</strong></span>
            {matchedSurrogate && (
              <span>
                <span className="text-muted-foreground">Matched With:</span>{' '}
                <Link to={`/surrogates/${matchedSurrogate.id}`} className="font-semibold text-abc-indigo hover:underline">
                  {matchedSurrogate.name}
                </Link>
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <InfoRow icon={Mail} label="Email" value={ip.email} />
                <InfoRow icon={Phone} label="Phone" value={ip.phone} />
                <InfoRow icon={Video} label="Preferred Communication" value={ip.preferredCommunication} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Screening Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <ScreeningStatusItem label="Application" status={ip.screening.application} />
                <ScreeningStatusItem label="Financial Verification" status={ip.screening.financialVerification} />
                <ScreeningStatusItem label="Psychological" status={ip.screening.psychological} />
                <ScreeningStatusItem label="Legal Consultation" status={ip.screening.legalConsultation} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Preferences</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <InfoRow icon={Target} label="Surrogate Age Range" value={ip.preferences.surrogateAge} />
                <InfoRow icon={MapPin} label="Surrogate Location" value={ip.preferences.surrogateLocation} />
                <InfoRow icon={Users} label="Experienced Preferred" value={ip.preferences.experiencedPreferred ? 'Yes' : 'No'} />
                <InfoRow icon={Baby} label="Open to Multiples" value={ip.preferences.openToMultiples ? 'Yes' : 'No'} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Family Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <InfoRow icon={Users} label="Family Type" value={ip.type} />
                <InfoRow icon={Globe} label="Ethnicity" value={ip.ethnicity} />
                <InfoRow icon={Church} label="Religion" value={ip.religion} />
                <InfoRow icon={Briefcase} label="Occupation" value={ip.occupation} />
                <InfoRow icon={DollarSign} label="Budget" value={ip.budget} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Document</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date Received</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ip.documents.map((doc, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium flex items-center gap-2">
                        <FileText className="size-4 text-muted-foreground" />
                        {doc.name}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className={`size-2 rounded-full ${DOC_STATUS_STYLES[doc.status]}`} />
                          <span className="text-sm capitalize">{doc.status}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {doc.date
                          ? new Date(doc.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                          : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Timeline Tab */}
        <TabsContent value="timeline" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Journey Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-0">
                {[...ip.timeline].reverse().map((entry, i) => (
                  <TimelineItem
                    key={i}
                    date={entry.date}
                    event={entry.event}
                    type={entry.type}
                    isLast={i === ip.timeline.length - 1}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notes Tab */}
        <TabsContent value="notes" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">Add Note</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Note</DialogTitle>
                  </DialogHeader>
                  <Textarea
                    placeholder="Write a note..."
                    value={noteText}
                    onChange={e => setNoteText(e.target.value)}
                    rows={4}
                  />
                  <Button onClick={() => setNoteText('')} className="w-full">Save Note</Button>
                </DialogContent>
              </Dialog>

              {ip.notes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No notes yet.</p>
              ) : (
                <div className="space-y-3">
                  {ip.notes.map((note, i) => (
                    <div key={i} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{note.author}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(note.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{note.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
