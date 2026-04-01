import { useState } from 'react'
import { Send, Copy, Check, Link2, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { createProfileShare } from '@/lib/matching'
import { sendEmail } from '@/lib/google'

export default function ShareProfileDialog({ open, onOpenChange, caseId, caseType, caseName, currentUser }) {
  const [form, setForm] = useState({ email: '', name: '', message: '' })
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState(null) // { shareUrl, sent }
  const [copied, setCopied] = useState(false)

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

      // Send email via Gmail API
      try {
        const subject = `${currentUser.name} shared a ${caseType === 'gc' ? 'surrogate' : 'intended parent'} profile with you`
        const body = `
          <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #283693; color: white; padding: 20px 24px; border-radius: 12px 12px 0 0;">
              <h2 style="margin: 0; font-size: 18px;">Abundant Beginnings Co.</h2>
              <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.8;">Profile Shared With You</p>
            </div>
            <div style="background: white; padding: 24px; border: 1px solid #e5e5e5; border-top: 0; border-radius: 0 0 12px 12px;">
              <p style="font-size: 15px; color: #333;">Hi${form.name ? ` ${form.name}` : ''},</p>
              <p style="font-size: 14px; color: #555; line-height: 1.6;">
                ${currentUser.name} has shared a ${caseType === 'gc' ? 'surrogate' : 'intended parent'} profile with you for your review.
              </p>
              ${form.message ? `<p style="font-size: 14px; color: #555; font-style: italic; background: #f9f9f9; padding: 12px; border-radius: 8px;">"${form.message}"</p>` : ''}
              <div style="text-align: center; margin: 24px 0;">
                <a href="${shareUrl}" style="display: inline-block; background: #283693; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">View Profile</a>
              </div>
              <p style="font-size: 12px; color: #999; text-align: center;">This link expires in 72 hours. Please do not forward this email.</p>
            </div>
          </div>
        `
        await sendEmail(currentUser.id, { to: form.email, subject, htmlBody: body })
      } catch (emailErr) {
        console.error('Failed to send email:', emailErr)
      }

      setResult({ shareUrl, sent: true })
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
    }, 200)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Share Profile — {caseName}</DialogTitle>
        </DialogHeader>

        {result ? (
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

            <Button onClick={handleShare} disabled={sending || !form.email}
              className="w-full gap-1.5" style={{ backgroundColor: '#283693', color: '#fff' }}>
              <Send className="size-4" />
              {sending ? 'Sharing...' : 'Share Profile'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
