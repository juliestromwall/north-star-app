import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Clock, Shield, Send, MessageSquare, CheckCircle2, XCircle } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import ProfileAvatar from '@/components/shared/ProfileAvatar'
import { getProfileShare, markShareViewed, createMatchQuestion, fetchMatchQuestions } from '@/lib/matching'
import { fetchSurrogatesFromIntake, fetchIPsFromIntake, fetchSurrogateProfileByEmail } from '@/lib/db'
import { ProfilePreview } from '@/pages/profile/SurrogateProfilePage'
import { listProfilePhotos } from '@/lib/db'

export default function SharedProfilePage() {
  const { token } = useParams()
  const [share, setShare] = useState(null)
  const [loading, setLoading] = useState(true)
  const [expired, setExpired] = useState(false)
  const [caseData, setCaseData] = useState(null)
  const [profileData, setProfileData] = useState(null)
  const [photos, setPhotos] = useState([])
  const [questions, setQuestions] = useState([])
  const [askForm, setAskForm] = useState({ name: '', email: '', question: '' })
  const [asking, setAsking] = useState(false)
  const [asked, setAsked] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const shareData = await getProfileShare(token)
        if (!shareData) { setLoading(false); return }
        setShare(shareData)

        // Check expiry
        if (new Date(shareData.expires_at) < new Date()) {
          setExpired(true)
          setLoading(false)
          return
        }

        // Mark as viewed
        await markShareViewed(token)

        // Load case data
        if (shareData.case_type === 'gc') {
          const all = await fetchSurrogatesFromIntake()
          const gc = all.find(s => s.id === shareData.case_id)
          setCaseData(gc)
          if (gc?.email) {
            const profile = await fetchSurrogateProfileByEmail(gc.email).catch(() => null)
            if (profile?.profile_data) setProfileData(profile.profile_data)
          }
          if (gc?.userId) {
            const ps = await Promise.all([
              listProfilePhotos(gc.userId).catch(() => []),
              listProfilePhotos(`${gc.userId}/headshot`).catch(() => []),
              listProfilePhotos(`${gc.userId}/portrait`).catch(() => []),
            ])
            setPhotos([...ps[2], ...ps[1], ...ps[0]])
          }
        } else {
          const all = await fetchIPsFromIntake()
          const ip = all.find(i => i.id === shareData.case_id)
          setCaseData(ip)
        }

        // Load questions
        const qs = await fetchMatchQuestions({ shareId: shareData.id })
        setQuestions(qs)
      } catch (err) {
        console.error('Failed to load shared profile:', err)
      }
      setLoading(false)
    }
    load()
  }, [token])

  async function handleAskQuestion() {
    if (!askForm.question.trim() || !share) return
    setAsking(true)
    try {
      const q = await createMatchQuestion({
        shareId: share.id,
        caseId: share.case_id,
        caseType: share.case_type,
        askerName: askForm.name,
        askerEmail: askForm.email,
        question: askForm.question,
      })
      setQuestions(prev => [q, ...prev])
      setAskForm({ name: '', email: '', question: '' })
      setAsked(true)
    } catch {} finally { setAsking(false) }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fdf8f3] flex items-center justify-center">
        <div className="animate-pulse text-stone-400">Loading profile...</div>
      </div>
    )
  }

  if (!share) {
    return (
      <div className="min-h-screen bg-[#fdf8f3] flex items-center justify-center">
        <Card className="max-w-md rounded-2xl">
          <CardContent className="py-12 text-center">
            <XCircle className="size-12 text-red-400 mx-auto mb-3" />
            <h2 className="text-lg font-bold">Link Not Found</h2>
            <p className="text-sm text-stone-500 mt-2">This profile link is invalid or has been removed.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (expired) {
    return (
      <div className="min-h-screen bg-[#fdf8f3] flex items-center justify-center">
        <Card className="max-w-md rounded-2xl">
          <CardContent className="py-12 text-center">
            <Clock className="size-12 text-amber-400 mx-auto mb-3" />
            <h2 className="text-lg font-bold">Link Expired</h2>
            <p className="text-sm text-stone-500 mt-2">This profile link has expired. Please contact the agency for a new link.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const hoursLeft = Math.max(0, Math.round((new Date(share.expires_at) - new Date()) / (60 * 60 * 1000)))
  const isGC = share.case_type === 'gc'
  const adminFirstName = share.shared_by ? share.shared_by.split(' ')[0] : 'the agency'

  return (
    <div className="min-h-screen bg-[#fdf8f3]">
      {/* Header bar */}
      <div className="bg-white border-b px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/abc-logo.png" alt="ABC Surrogacy" className="h-10 w-auto" />
          <div>
            <p className="text-sm font-semibold text-[#283693]">Abundant Beginnings Co.</p>
            <p className="text-[10px] text-stone-400">Shared Profile</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-stone-400">
          <Shield className="size-3.5" />
          <span>Secure & Confidential</span>
          <span className="ml-2 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
            <Clock className="size-3 inline mr-1" />Expires in {hoursLeft}h
          </span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Shared by notice */}
        <div className="rounded-xl bg-[#283693]/5 border border-[#283693]/20 p-4 flex items-center gap-3">
          <div className="size-10 rounded-full bg-[#283693]/10 flex items-center justify-center">
            <Send className="size-5 text-[#283693]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#283693]">{share.shared_by} shared this {isGC ? 'surrogate' : 'intended parent'} profile with you</p>
            {share.message && <p className="text-xs text-stone-500 mt-0.5">"{share.message}"</p>}
          </div>
        </div>

        {/* Profile Content */}
        {isGC && profileData ? (
          <div className="rounded-2xl border bg-white overflow-hidden">
            <div className="flex items-center justify-center py-4 border-b bg-white">
              <img src="/abc-logo.png" alt="ABC Surrogacy" className="h-14 w-auto" />
            </div>
            <ProfilePreview profile={profileData} photos={photos} hideFooter />
          </div>
        ) : caseData ? (
          <Card className="rounded-2xl">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-4">
                <ProfileAvatar name={isGC ? caseData.name : caseData.names} size="xl" />
                <div>
                  <h2 className="text-2xl font-heading font-bold">{isGC ? caseData.name : caseData.names}</h2>
                  {caseData.location && <p className="text-sm text-stone-500">{caseData.location}</p>}
                  {!isGC && <p className="text-sm text-stone-500">{caseData.type}</p>}
                </div>
              </div>
              {!isGC && (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {caseData.hasRE && caseData.reDoctorName && (
                    <div><p className="text-xs text-stone-400 uppercase">RE Doctor</p><p className="font-medium">{caseData.reDoctorName}</p></div>
                  )}
                  {caseData.hasFrozenEmbryos && (
                    <div><p className="text-xs text-stone-400 uppercase">Embryos</p><p className="font-medium">{caseData.frozenEmbryoDetails || 'Yes'}</p></div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="rounded-2xl">
            <CardContent className="py-12 text-center">
              <p className="text-stone-400">Profile data not available.</p>
            </CardContent>
          </Card>
        )}

        {/* Questions Section */}
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="size-5" /> Questions About This Match
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Existing questions */}
            {questions.length > 0 && (
              <div className="space-y-3">
                {questions.map(q => (
                  <div key={q.id} className="rounded-lg border p-3">
                    <div className="flex items-center gap-2 text-xs text-stone-400 mb-1">
                      <span className="font-semibold text-stone-600">{q.asker_name || 'Anonymous'}</span>
                      <span>{new Date(q.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="text-sm">{q.question}</p>
                    {q.answer && (
                      <div className="mt-2 pl-3 border-l-2 border-[#283693]/30">
                        <p className="text-xs text-stone-400 font-semibold">{q.answered_by || 'Agency'}</p>
                        <p className="text-sm text-stone-600">{q.answer}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Ask a question */}
            {asked ? (
              <div className="flex items-center gap-2 text-sm text-emerald-600 py-3">
                <CheckCircle2 className="size-4" /> Your question has been sent to {adminFirstName}. They'll get back to you soon.
              </div>
            ) : (
              <div className="space-y-3 pt-2 border-t">
                <p className="text-xs text-stone-500 font-medium">Have a question? Ask {adminFirstName} below:</p>
                <div className="grid grid-cols-2 gap-2">
                  <Input value={askForm.name} onChange={e => setAskForm(f => ({ ...f, name: e.target.value }))} placeholder="Your name" className="text-sm" />
                  <Input type="email" value={askForm.email} onChange={e => setAskForm(f => ({ ...f, email: e.target.value }))} placeholder="Your email" className="text-sm" />
                </div>
                <Textarea value={askForm.question} onChange={e => setAskForm(f => ({ ...f, question: e.target.value }))} placeholder="Type your question..." rows={2} className="text-sm" />
                <Button onClick={handleAskQuestion} disabled={asking || !askForm.question.trim()} size="sm" className="gap-1.5" style={{ backgroundColor: '#283693', color: '#fff' }}>
                  {asking ? 'Sending...' : 'Send Question'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-xs text-stone-400 pt-4">
          <p>This profile is shared confidentially by Abundant Beginnings Co.</p>
          <p>Do not forward or share this link. It expires in {hoursLeft} hours.</p>
        </div>
      </div>
    </div>
  )
}
