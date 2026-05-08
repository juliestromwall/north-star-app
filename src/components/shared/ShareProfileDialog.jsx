import { useState, useEffect } from 'react'
import { Send, Copy, Check, Link2, Clock, Eye, ChevronLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { createProfileShare } from '@/lib/matching'
import { sendEmail } from '@/lib/google'
import { fetchSurrogatesFromIntake, fetchSurrogateProfileByEmail, fetchInsurance, listProfilePhotos } from '@/lib/db'
import { ProfilePreview } from '@/pages/profile/SurrogateProfilePage'

export default function ShareProfileDialog({ open, onOpenChange, caseId, caseType, caseName, currentUser }) {
  const [step, setStep] = useState(1) // 1 = form, 2 = preview, 3 = sent
  const [form, setForm] = useState({ email: '', name: '', message: '' })
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState(null) // { shareUrl, sent }
  const [copied, setCopied] = useState(false)
  const [confirmReviewed, setConfirmReviewed] = useState(false)

  // Preview data
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewProfile, setPreviewProfile] = useState(null)
  const [previewPhotos, setPreviewPhotos] = useState([])
  const [previewInsurance, setPreviewInsurance] = useState(null)

  // Load preview data when entering step 2
  useEffect(() => {
    if (step !== 2 || caseType !== 'gc' || !caseId) return
    let cancelled = false
    setPreviewLoading(true)
    ;(async () => {
      try {
        const all = await fetchSurrogatesFromIntake()
        const gc = all.find(s => s.id === caseId)
        if (!gc?.email) return
        const profile = await fetchSurrogateProfileByEmail(gc.email).catch(() => null)
        if (cancelled) return
        if (profile?.profile_data) setPreviewProfile(profile.profile_data)
        const uid = profile?.user_id || gc.userId || gc.user_id
        const ids = [uid, String(gc.id)].filter(Boolean)
        const uniqueIds = [...new Set(ids)]
        let allHeadshots = [], allPortraits = [], allGallery = []
        for (const id of uniqueIds) {
          // Raw mode on slot folders so ProfilePreview can render the cropped
          // banner up top and the un-cropped originals in the gallery.
          const [gallery, headshots, portraits] = await Promise.all([
            listProfilePhotos(id).catch(() => []),
            listProfilePhotos(`${id}/headshot`, { raw: true }).catch(() => []),
            listProfilePhotos(`${id}/portrait`, { raw: true }).catch(() => []),
          ])
          allHeadshots.push(...headshots)
          allPortraits.push(...portraits)
          allGallery.push(...gallery)
        }
        if (cancelled) return
        setPreviewPhotos([...allHeadshots, ...allPortraits, ...allGallery])
        const ins = await fetchInsurance(gc.id, 'surrogate').catch(() => null)
        if (cancelled) return
        if (ins) setPreviewInsurance(ins.insurance_status)
      } catch (err) { console.error('Preview load failed:', err) }
      finally { if (!cancelled) setPreviewLoading(false) }
    })()
    return () => { cancelled = true }
  }, [step, caseId, caseType])

  async function handleShare() {
    if (!form.email) return
    setSending(true)
    try {
      const share = await createProfileShare({
        caseId,
        caseType,
        sharedBy: currentUser.name,
        sharedByEmail: currentUser.email,
        sharedToEmail: form.email,
        sharedToName: form.name,
        message: form.message,
      })

      const shareUrl = `${window.location.origin}/share/${share.token}`

      try {
        const firstName = (caseName || '').split(' ')[0] || 'a surrogate'
        const profileType = caseType === 'gc' ? 'surrogate' : 'intended parent'
        const subject = `${currentUser.name} shared a ${profileType} profile with you`
        const body = `
          <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
            <div style="text-align: center; padding: 32px 24px 16px;">
              <img src="https://app.northstarsurrogacy.com/north-star-logo.png" alt="North Star Surrogacy" style="max-width: 180px;" />
            </div>
            <div style="padding: 0 32px 32px;">
              <h2 style="color: #1A3638; font-size: 20px; margin: 0 0 8px;">A Profile Has Been Shared With You</h2>
              <p style="color: #78716c; font-size: 14px; margin: 0 0 20px; line-height: 1.6;">
                Hi${form.name ? ` ${form.name.split(' ')[0]}` : ''},
              </p>
              <p style="color: #78716c; font-size: 14px; margin: 0 0 20px; line-height: 1.6;">
                <strong style="color: #1c1917;">${currentUser.name}</strong> has shared a ${profileType} profile with you for your review.
              </p>
              ${form.message ? `
              <div style="background: #f0f1fa; border-radius: 12px; padding: 16px 20px; margin: 0 0 20px;">
                <p style="margin: 0; font-size: 14px; color: #1c1917; line-height: 1.6; font-style: italic;">"${form.message}"</p>
              </div>` : ''}
              <div style="text-align: center; margin: 24px 0;">
                <a href="${shareUrl}" style="display: inline-block; background: linear-gradient(135deg, #D4A853, #1A3638); color: white; padding: 14px 36px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">View ${firstName}'s Profile</a>
              </div>
              <p style="font-size: 12px; color: #a8a29e; text-align: center; margin: 0 0 20px;">This link expires in 72 hours.</p>
              <hr style="border: none; border-top: 1px solid #e7e5e4; margin: 24px 0;" />
              <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 14px 16px; margin: 0 0 20px;">
                <p style="margin: 0; font-size: 11px; color: #92400e; line-height: 1.5;">
                  <strong>HIPAA Notice:</strong> This email may contain Protected Health Information (PHI). It is intended solely for the recipient named above. If you received this in error, please delete it immediately and notify the sender. Do not forward, copy, or distribute this message.
                </p>
              </div>
              <p style="color: #a8a29e; font-size: 11px; text-align: center;">
                North Star Surrogacy, LLC &middot; northstarsurrogacy.com
              </p>
            </div>
          </div>
        `
        await sendEmail(currentUser.id, { to: form.email, subject, body })
      } catch (emailErr) {
        console.error('Failed to send email:', emailErr)
      }

      setResult({ shareUrl, sent: true })
      setStep(3)
    } catch (err) {
      alert('Failed to create share link: ' + (err.message || 'Unknown error'))
    } finally { setSending(false) }
  }

  function handleCopy() {
    if (result?.shareUrl) {
      navigator.clipboard.writeText(result.shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  function handleClose() {
    onOpenChange(false)
    setTimeout(() => {
      setForm({ email: '', name: '', message: '' })
      setResult(null)
      setCopied(false)
      setStep(1)
      setConfirmReviewed(false)
      setPreviewProfile(null)
      setPreviewPhotos([])
      setPreviewInsurance(null)
    }, 200)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className={step === 2 ? '!max-w-[95vw] sm:!max-w-[1100px] !w-[95vw] max-h-[90vh] overflow-y-auto' : 'max-w-md'}>
        <DialogHeader>
          <DialogTitle>
            {step === 3 ? 'Profile Shared' : `Share Profile — ${caseName}`}
          </DialogTitle>
        </DialogHeader>

        {step === 3 && result ? (
          <div className="space-y-4">
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-center space-y-2">
              <Check className="size-8 text-emerald-500 mx-auto" />
              <p className="font-semibold text-emerald-700">Profile Shared!</p>
              <p className="text-xs text-emerald-600">An email has been sent to {form.email}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Share Link (expires in 72 hours)</Label>
              <div className="flex gap-2">
                <Input value={result.shareUrl} readOnly className="text-xs font-mono" />
                <Button variant="outline" size="sm" onClick={handleCopy}>
                  {copied ? <Check className="size-4 text-emerald-500" /> : <Copy className="size-4" />}
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-stone-400">
              <Clock className="size-3.5" />
              <span>Link expires in 72 hours</span>
            </div>
            <Button variant="outline" className="w-full" onClick={handleClose}>Done</Button>
          </div>
        ) : step === 2 ? (
          <div className="space-y-4">
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
              Review the profile below to confirm this is the correct one to share with <strong>{form.email}</strong>.
            </div>

            {/* Preview */}
            <div className="rounded-xl border border-stone-200 overflow-hidden bg-[#fdf8f3] max-h-[60vh] overflow-y-auto">
              {previewLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="size-6 animate-spin text-stone-400" />
                </div>
              ) : previewProfile ? (
                <ProfilePreview
                  profile={previewProfile}
                  photos={previewPhotos.filter(p => !(previewProfile?._hiddenPhotos || []).includes(p.path))}
                  insuranceStatus={previewInsurance}
                  hideFooter
                />
              ) : (
                <div className="text-center py-20 text-sm text-stone-400">No profile data available</div>
              )}
            </div>

            {/* Confirm checkbox */}
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmReviewed}
                onChange={e => setConfirmReviewed(e.target.checked)}
                className="mt-0.5 accent-[#1A3638]"
              />
              <span className="text-sm text-stone-700">I've reviewed this profile and confirm this is the correct one to share.</span>
            </label>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)} className="gap-1.5">
                <ChevronLeft className="size-4" /> Back
              </Button>
              <Button onClick={handleShare} disabled={sending || !confirmReviewed}
                className="flex-1 gap-1.5" style={{ backgroundColor: '#1A3638', color: '#fff' }}>
                <Send className="size-4" />
                {sending ? 'Sharing...' : 'Send Profile'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs">Recipient Email *</Label>
              <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="Enter email address..." />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Recipient Name</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Optional" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Personal Message</Label>
              <Textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} placeholder="Add a note..." rows={2} />
            </div>

            <div className="flex items-center gap-1.5 text-xs text-stone-400">
              <Link2 className="size-3.5" />
              <span>A secure link will be generated (expires in 72 hours)</span>
            </div>

            <Button onClick={() => setStep(2)} disabled={!form.email}
              className="w-full gap-1.5" style={{ backgroundColor: '#1A3638', color: '#fff' }}>
              <Eye className="size-4" />
              Preview Profile
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
