import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft, Mail, Phone, GraduationCap, Briefcase, Heart, Users, Church,
  Globe, Shield, Baby, Ruler, Weight, Droplets, Activity, MessageSquare,
  Pencil, FileText, CheckCircle2, Clock, AlertCircle, User, ExternalLink
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
import PhotoGallery from '@/components/shared/PhotoGallery'
import AddPhotosDialog from '@/components/shared/AddPhotosDialog'
import ProfileDashboardTab from '@/components/shared/ProfileDashboardTab'
import { mockSurrogates } from '@/data/mock/surrogates'
import { mockIntendedParents } from '@/data/mock/intendedParents'

const DOC_STATUS_STYLES = {
  received: 'bg-green-500',
  pending: 'bg-yellow-500',
  missing: 'bg-gray-300',
}

export default function SurrogateDetailPage() {
  const { id } = useParams()
  const surrogate = mockSurrogates.find(s => s.id === id)
  const [noteText, setNoteText] = useState('')

  if (!surrogate) {
    return (
      <div className="space-y-6">
        <Link to="/surrogates" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Back to Surrogates
        </Link>
        <EmptyState title="Surrogate not found" description="This profile doesn't exist." />
      </div>
    )
  }

  const matchedIP = surrogate.matchedWith
    ? mockIntendedParents.find(ip => ip.id === surrogate.matchedWith)
    : null

  return (
    <div className="space-y-6">
      <Link to="/surrogates" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Back to Surrogates
      </Link>

      {/* Hero */}
      <Card className="bg-gradient-to-r from-abc-indigo/5 to-abc-coral/5">
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start gap-4">
            <ProfileAvatar name={surrogate.name} avatar={surrogate.avatar} size="xl" />
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-heading font-bold">{surrogate.name}</h1>
                <StatusBadge status={surrogate.status} />
                {surrogate.matchStage && (
                  <Badge variant="outline" className="bg-abc-coral/20 text-abc-navy border-abc-coral/30 text-xs">
                    {surrogate.matchStage}
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground mt-1">{surrogate.location}</p>
              <p className="text-sm mt-2 max-w-2xl">{surrogate.bio}</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button variant="outline" size="sm" className="gap-1.5">
                <MessageSquare className="size-3.5" /> Send Message
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" disabled>
                <Pencil className="size-3.5" /> Edit Profile
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => window.open(`/surrogates/${surrogate.id}/share`, '_blank')}
              >
                <ExternalLink className="size-3.5" /> Share Profile
              </Button>
            </div>
          </div>

          <Separator />

          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <span><span className="text-muted-foreground">Age:</span> <strong>{surrogate.age}</strong></span>
            <span><span className="text-muted-foreground">BMI:</span> <strong>{surrogate.bmi}</strong></span>
            <span><span className="text-muted-foreground">Blood Type:</span> <strong>{surrogate.bloodType}</strong></span>
            <span><span className="text-muted-foreground">Prev. Journeys:</span> <strong>{surrogate.previousJourneys}</strong></span>
            {matchedIP && (
              <span>
                <span className="text-muted-foreground">Matched With:</span>{' '}
                <Link to={`/intended-parents/${matchedIP.id}`} className="font-semibold text-abc-indigo hover:underline">
                  {matchedIP.names}
                </Link>
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="dashboard">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="medical">Medical</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard">
          <ProfileDashboardTab
            profileId={surrogate.id}
            profileType="surrogate"
            notes={surrogate.notes}
            matchStage={surrogate.matchStage}
          />
        </TabsContent>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6 mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Photos</CardTitle>
              <AddPhotosDialog />
            </CardHeader>
            <CardContent>
              <PhotoGallery photos={surrogate.photos} mode="grid" />
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <InfoRow icon={Mail} label="Email" value={surrogate.email} />
                <InfoRow icon={Phone} label="Phone" value={surrogate.phone} />
                <InfoRow icon={GraduationCap} label="Education" value={surrogate.education} />
                <InfoRow icon={Briefcase} label="Occupation" value={surrogate.occupation} />
                <InfoRow icon={Heart} label="Marital Status" value={surrogate.maritalStatus} />
                <InfoRow icon={Globe} label="Ethnicity" value={surrogate.ethnicity} />
                <InfoRow icon={Church} label="Religion" value={surrogate.religion} />
                <InfoRow
                  icon={Baby}
                  label="Children"
                  value={surrogate.children.map(c => `${c.gender}, ${c.age}`).join(' | ')}
                />
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Screening Status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <ScreeningStatusItem label="Medical" status={surrogate.screening.medical} />
                  <ScreeningStatusItem label="Psychological" status={surrogate.screening.psychological} />
                  <ScreeningStatusItem label="Background Check" status={surrogate.screening.background} />
                  <ScreeningStatusItem label="Home Study" status={surrogate.screening.homeStudy} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Insurance</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  <InfoRow icon={Shield} label="Provider" value={surrogate.insurance.provider} />
                  <InfoRow
                    icon={CheckCircle2}
                    label="Surrogacy Coverage"
                    value={surrogate.insurance.hasSurrogacyCoverage ? 'Yes' : 'No'}
                  />
                </CardContent>
              </Card>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Preferences</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
                <InfoRow icon={Users} label="Carry Multiples" value={surrogate.preferences.willingToCarryMultiples ? 'Yes' : 'No'} />
                <InfoRow icon={AlertCircle} label="Willing to Terminate" value={surrogate.preferences.willingToTerminate ? 'Yes' : 'No'} />
                <InfoRow icon={Globe} label="Max Distance" value={surrogate.preferences.maxDistance} />
                <InfoRow icon={Mail} label="Preferred Contact" value={surrogate.preferences.preferredContact} />
                <InfoRow icon={Users} label="Open to Same-Sex" value={surrogate.preferences.openToSameSex ? 'Yes' : 'No'} />
                <InfoRow icon={User} label="Open to Single Parent" value={surrogate.preferences.openToSingleParent ? 'Yes' : 'No'} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Medical Tab */}
        <TabsContent value="medical" className="space-y-6 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Vitals</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
                <InfoRow icon={Ruler} label="Height" value={surrogate.height} />
                <InfoRow icon={Weight} label="Weight" value={surrogate.weight} />
                <InfoRow icon={Activity} label="BMI" value={surrogate.bmi} />
                <InfoRow icon={Droplets} label="Blood Type" value={surrogate.bloodType} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Medical History</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Detailed medical records will be displayed here in a future update.</p>
            </CardContent>
          </Card>
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
                  {surrogate.documents.map((doc, i) => (
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
                {[...surrogate.timeline].reverse().map((entry, i) => (
                  <TimelineItem
                    key={i}
                    date={entry.date}
                    event={entry.event}
                    type={entry.type}
                    isLast={i === surrogate.timeline.length - 1}
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

              {surrogate.notes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No notes yet.</p>
              ) : (
                <div className="space-y-3">
                  {surrogate.notes.map((note, i) => (
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
