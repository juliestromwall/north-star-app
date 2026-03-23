import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft, Mail, Phone, Heart, Ruler, Weight, Activity,
  MessageSquare, Pencil, CheckCircle2, Clock, Circle, XCircle,
  MapPin, Calendar, ClipboardList, User
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import StatusBadge from '@/components/shared/StatusBadge'
import ProfileAvatar from '@/components/shared/ProfileAvatar'
import InfoRow from '@/components/shared/InfoRow'
import ScreeningStatusItem from '@/components/shared/ScreeningStatusItem'
import EmptyState from '@/components/shared/EmptyState'
import { fetchSurrogatesFromIntake, fetchIntakeByEmail, listProfilePhotos } from '@/lib/db'

export default function SurrogateDetailPage() {
  const { id } = useParams()
  const [surrogate, setSurrogate] = useState(null)
  const [loading, setLoading] = useState(true)
  const [quizAnswers, setQuizAnswers] = useState(null)
  const [photos, setPhotos] = useState([])
  const [noteText, setNoteText] = useState('')

  useEffect(() => {
    fetchSurrogatesFromIntake().then(all => {
      const found = all.find(s => String(s.id) === String(id))
      setSurrogate(found || null)
      if (found?.email) {
        fetchIntakeByEmail(found.email).then(setQuizAnswers).catch(() => {})
      }
      if (found?.userId) {
        listProfilePhotos(found.userId).then(setPhotos).catch(() => {})
        listProfilePhotos(`${found.userId}/headshot`).then(hs => {
          if (hs.length > 0) setPhotos(prev => [hs[0], ...prev])
        }).catch(() => {})
      }
    }).catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">Loading...</div>
  }

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

  const screening = surrogate.screening || {}
  const heightStr = surrogate.heightFt ? `${surrogate.heightFt}'${surrogate.heightIn || 0}"` : null

  return (
    <div className="space-y-6">
      <Link to="/surrogates" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Back to Surrogates
      </Link>

      {/* Hero */}
      <Card className="bg-gradient-to-r from-abc-indigo/5 to-abc-coral/5">
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start gap-4">
            <ProfileAvatar name={surrogate.name} size="xl" />
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-heading font-bold">{surrogate.name}</h1>
                <StatusBadge status={surrogate.status} />
                <Badge variant="outline" className="text-xs capitalize">
                  {surrogate.intakeStatus?.replace('_', ' ')}
                </Badge>
              </div>
              {surrogate.location && (
                <p className="text-muted-foreground mt-1 flex items-center gap-1">
                  <MapPin className="size-3.5" /> {surrogate.location}
                </p>
              )}
              <p className="text-sm text-muted-foreground mt-1">
                Submitted {new Date(surrogate.submittedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button variant="outline" size="sm" className="gap-1.5" asChild>
                <a href={`mailto:${surrogate.email}`}>
                  <Mail className="size-3.5" /> Email
                </a>
              </Button>
              {surrogate.phone && (
                <Button variant="outline" size="sm" className="gap-1.5" asChild>
                  <a href={`tel:${surrogate.phone}`}>
                    <Phone className="size-3.5" /> Call
                  </a>
                </Button>
              )}
            </div>
          </div>

          <Separator />

          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {surrogate.age && <span><span className="text-muted-foreground">Age:</span> <strong>{surrogate.age}</strong></span>}
            {surrogate.bmi && <span><span className="text-muted-foreground">BMI:</span> <strong>{surrogate.bmi}</strong></span>}
            {surrogate.maritalStatus && <span><span className="text-muted-foreground">Status:</span> <strong>{surrogate.maritalStatus}</strong></span>}
            {surrogate.preferredContact && <span><span className="text-muted-foreground">Preferred Contact:</span> <strong>{surrogate.preferredContact}</strong></span>}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="quiz">Quiz Answers</TabsTrigger>
          <TabsTrigger value="screening">Screening</TabsTrigger>
          <TabsTrigger value="photos">Photos</TabsTrigger>
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
                <InfoRow icon={Mail} label="Email" value={surrogate.email} />
                <InfoRow icon={Phone} label="Phone" value={surrogate.phone || '—'} />
                <InfoRow icon={MapPin} label="Location" value={surrogate.location || '—'} />
                <InfoRow icon={Heart} label="Marital Status" value={surrogate.maritalStatus || '—'} />
                <InfoRow icon={MessageSquare} label="Preferred Contact" value={surrogate.preferredContact || '—'} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Health Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <InfoRow icon={Ruler} label="Height" value={heightStr || '—'} />
                <InfoRow icon={Weight} label="Weight" value={surrogate.weightLbs ? `${surrogate.weightLbs} lbs` : '—'} />
                <InfoRow icon={Activity} label="BMI" value={surrogate.bmi || '—'} />
                <InfoRow icon={CheckCircle2} label="Healthy Pregnancy" value={
                  surrogate.healthyPregnancy === true ? 'Yes' :
                  surrogate.healthyPregnancy === false ? 'No' : '—'
                } />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Screening Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <ScreeningStatusItem label="Medical" status={screening.medical} />
              <ScreeningStatusItem label="Psychological" status={screening.psychological} />
              <ScreeningStatusItem label="Background Check" status={screening.background} />
              <ScreeningStatusItem label="Home Study" status={screening.homeStudy} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Profile Tab — surrogate's matching profile */}
        <TabsContent value="profile" className="space-y-6 mt-4">
          {/* Profile preview built from quiz answers + uploaded photos */}
          <Card>
            <CardHeader>
              <CardTitle>Matching Profile</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Cover photo + gallery */}
                {photos.length > 0 && (
                  <div>
                    <div className="w-full h-48 sm:h-64 rounded-xl overflow-hidden">
                      <img src={photos[0].url} alt="" className="w-full h-full object-cover" />
                    </div>
                    {photos.length > 1 && (
                      <div className="flex gap-2 mt-2">
                        {photos.slice(1, 5).map(p => (
                          <div key={p.path} className="w-16 h-16 rounded-lg overflow-hidden border">
                            <img src={p.url} alt="" className="w-full h-full object-cover" />
                          </div>
                        ))}
                        {photos.length > 5 && (
                          <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center text-xs text-gray-500 font-medium">
                            +{photos.length - 5}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Name & bio */}
                <div className="text-center">
                  <h2 className="text-xl font-heading font-bold text-abc-indigo">
                    Meet {surrogate.name.split(' ')[0]}
                  </h2>
                  {surrogate.location && (
                    <p className="text-muted-foreground text-sm mt-1">{surrogate.age ? `${surrogate.age} years old · ` : ''}{surrogate.location}</p>
                  )}
                </div>

                {/* Info grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-sm font-semibold text-abc-indigo mb-2">About</h3>
                    <div className="space-y-1.5 text-sm">
                      {surrogate.maritalStatus && <div className="flex justify-between"><span className="text-muted-foreground">Marital Status</span><span className="font-medium">{surrogate.maritalStatus}</span></div>}
                      {surrogate.preferredContact && <div className="flex justify-between"><span className="text-muted-foreground">Preferred Contact</span><span className="font-medium">{surrogate.preferredContact}</span></div>}
                      {surrogate.hearAboutUs && <div className="flex justify-between"><span className="text-muted-foreground">Referral Source</span><span className="font-medium">{surrogate.hearAboutUs}</span></div>}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-abc-indigo mb-2">Medical</h3>
                    <div className="space-y-1.5 text-sm">
                      {heightStr && <div className="flex justify-between"><span className="text-muted-foreground">Height</span><span className="font-medium">{heightStr}</span></div>}
                      {surrogate.weightLbs && <div className="flex justify-between"><span className="text-muted-foreground">Weight</span><span className="font-medium">{surrogate.weightLbs} lbs</span></div>}
                      {surrogate.bmi && <div className="flex justify-between"><span className="text-muted-foreground">BMI</span><span className="font-medium">{surrogate.bmi}</span></div>}
                      {surrogate.healthyPregnancy !== undefined && surrogate.healthyPregnancy !== null && (
                        <div className="flex justify-between"><span className="text-muted-foreground">Healthy Pregnancy</span><span className="font-medium">{surrogate.healthyPregnancy ? 'Yes' : 'No'}</span></div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="rounded-lg bg-abc-indigo/5 border border-abc-indigo/10 p-4">
                  <p className="text-sm text-muted-foreground">
                    This profile shows data from the intake quiz. Once the surrogate completes their full matching profile, additional details (personality, pregnancy history, lifestyle, preferences, etc.) will appear here.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Quiz Answers Tab */}
        <TabsContent value="quiz" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="size-4" /> Intake Quiz Answers
              </CardTitle>
            </CardHeader>
            <CardContent>
              {quizAnswers ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                  {quizAnswers.firstName && (
                    <div><span className="text-muted-foreground">Name</span><p className="font-medium">{quizAnswers.firstName} {quizAnswers.lastName}</p></div>
                  )}
                  {quizAnswers.dob && (
                    <div><span className="text-muted-foreground">Date of Birth</span><p className="font-medium">{quizAnswers.dob}</p></div>
                  )}
                  {quizAnswers.state && (
                    <div><span className="text-muted-foreground">State</span><p className="font-medium">{quizAnswers.state}</p></div>
                  )}
                  {quizAnswers.phone && (
                    <div><span className="text-muted-foreground">Phone</span><p className="font-medium">{quizAnswers.phone}</p></div>
                  )}
                  {quizAnswers.email && (
                    <div><span className="text-muted-foreground">Email</span><p className="font-medium">{quizAnswers.email}</p></div>
                  )}
                  {quizAnswers.usCitizen !== undefined && (
                    <div><span className="text-muted-foreground">US Citizen</span><p className="font-medium">{quizAnswers.usCitizen ? 'Yes' : 'No'}</p></div>
                  )}
                  {quizAnswers.maritalStatus && (
                    <div><span className="text-muted-foreground">Marital Status</span><p className="font-medium">{quizAnswers.maritalStatus}</p></div>
                  )}
                  {quizAnswers.preferredContact && (
                    <div><span className="text-muted-foreground">Preferred Contact</span><p className="font-medium">{quizAnswers.preferredContact}</p></div>
                  )}
                  {quizAnswers.heightFt && (
                    <div><span className="text-muted-foreground">Height</span><p className="font-medium">{quizAnswers.heightFt}'{quizAnswers.heightIn || 0}"</p></div>
                  )}
                  {quizAnswers.weightLbs && (
                    <div><span className="text-muted-foreground">Weight</span><p className="font-medium">{quizAnswers.weightLbs} lbs</p></div>
                  )}
                  {quizAnswers.healthyPregnancy !== undefined && (
                    <div><span className="text-muted-foreground">Healthy Pregnancy</span><p className="font-medium">{quizAnswers.healthyPregnancy ? 'Yes' : 'No'}</p></div>
                  )}
                  {quizAnswers.hearAboutUs && (
                    <div><span className="text-muted-foreground">Heard About Us</span><p className="font-medium">{quizAnswers.hearAboutUs}{quizAnswers.hearAboutUsOther ? ` — ${quizAnswers.hearAboutUsOther}` : ''}</p></div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No quiz answers found.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Screening Tab */}
        <TabsContent value="screening" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Screening Checklist</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <ScreeningStatusItem label="Medical Clearance" status={screening.medical} />
              <ScreeningStatusItem label="Psychological Evaluation" status={screening.psychological} />
              <ScreeningStatusItem label="Background Check" status={screening.background} />
              <ScreeningStatusItem label="Home Study" status={screening.homeStudy} />
              <p className="text-xs text-muted-foreground pt-4">
                Screening status updates will be managed here as the intake process progresses.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Photos Tab */}
        <TabsContent value="photos" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Photos</CardTitle>
            </CardHeader>
            <CardContent>
              {photos.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {photos.map(p => (
                    <div key={p.path} className="aspect-square rounded-xl overflow-hidden border border-gray-200">
                      <img src={p.url} alt="" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">No photos uploaded yet.</p>
              )}
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
              <p className="text-sm text-muted-foreground">No notes yet. Notes will be stored once connected to the backend.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
