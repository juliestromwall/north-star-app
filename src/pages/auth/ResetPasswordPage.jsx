import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, CheckCircle2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { supabase } from '@/lib/supabase'

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [expired, setExpired] = useState(false)
  const [agreedTerms, setAgreedTerms] = useState(false)
  const [termsOpen, setTermsOpen] = useState(false)
  const [termsContent, setTermsContent] = useState('')

  // Check for error in URL hash (expired/invalid link)
  useEffect(() => {
    const hash = window.location.hash
    if (hash.includes('error=') || hash.includes('error_code=otp_expired') || hash.includes('access_denied')) {
      setExpired(true)
    }
  }, [])

  async function handleReset(e) {
    e.preventDefault()
    if (!password || password.length < 6) { setError('Password must be at least 6 characters'); return }
    if (password !== confirmPw) { setError('Passwords do not match'); return }
    setLoading(true)
    setError(null)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setSuccess(true)
      setTimeout(() => navigate('/dashboard', { replace: true }), 2000)
    } catch (err) {
      setError(err.message || 'Failed to reset password')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(160deg, #f0f1fa 0%, #fdf8f3 30%, #fef9fb 60%, #f0f1fa 100%)' }}>
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <img src="/north-star-logo.png" alt="North Star Surrogacy" className="h-16 w-auto mx-auto mb-6" />
            <h1 className="text-3xl font-heading font-bold" style={{ color: '#1A3638' }}>
              Set your <span style={{ color: '#D4A853' }}>password</span>
            </h1>
            <p className="text-stone-400 text-sm mt-2">Choose a strong password for your account</p>
          </div>

          {expired ? (
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-stone-200/60 shadow-lg p-6 text-center space-y-3">
              <AlertTriangle className="size-12 text-amber-500 mx-auto" />
              <h2 className="text-lg font-semibold text-stone-800">Link Expired</h2>
              <p className="text-sm text-stone-500">This password reset link has expired or is invalid.</p>
              <Button variant="outline" className="mt-2" onClick={() => navigate('/login')}>
                Go to Login
              </Button>
            </div>
          ) : success ? (
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-stone-200/60 shadow-lg p-6 text-center space-y-3">
              <CheckCircle2 className="size-12 text-emerald-500 mx-auto" />
              <h2 className="text-lg font-semibold text-stone-800">Password Updated</h2>
              <p className="text-sm text-stone-500">Redirecting to your dashboard...</p>
            </div>
          ) : (
            <form onSubmit={handleReset} className="bg-white/80 backdrop-blur-sm rounded-2xl border border-stone-200/60 shadow-lg p-6 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-stone-500 uppercase tracking-wide font-semibold">New Password</Label>
                <div className="relative">
                  <Input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="rounded-xl h-11 pr-11"
                    autoFocus
                  />
                  <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-stone-500 uppercase tracking-wide font-semibold">Confirm Password</Label>
                <Input
                  type={showPw ? 'text' : 'password'}
                  value={confirmPw}
                  onChange={e => setConfirmPw(e.target.value)}
                  placeholder="Re-enter your password"
                  className="rounded-xl h-11"
                />
              </div>

              {/* Terms & Conditions */}
              <div className="flex items-start gap-2.5">
                <input
                  type="checkbox"
                  id="agree-terms"
                  checked={agreedTerms}
                  onChange={e => setAgreedTerms(e.target.checked)}
                  className="mt-0.5 rounded border-stone-300"
                />
                <label htmlFor="agree-terms" className="text-xs text-stone-500 leading-relaxed">
                  I have read and agree to the{' '}
                  <button type="button" onClick={async () => {
                    if (!termsContent) {
                      try {
                        const res = await fetch('/terms-and-conditions.md')
                        const text = await res.text()
                        setTermsContent(text)
                      } catch { setTermsContent('Failed to load terms.') }
                    }
                    setTermsOpen(true)
                  }} className="text-[#1A3638] underline hover:text-[#D4A853] font-medium">
                    Terms of Use & Privacy Policy
                  </button>
                </label>
              </div>

              {error && (
                <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
              )}

              <Button
                type="submit"
                disabled={!password || !confirmPw || !agreedTerms || loading}
                className="w-full h-11 rounded-xl text-sm font-semibold text-white border-0"
                style={{ background: 'linear-gradient(135deg, #D4A853, #1A3638)' }}
              >
                {loading ? 'Updating...' : 'Update Password'}
              </Button>
            </form>
          )}
        </div>
      </div>

      <footer className="py-8 text-center text-xs text-stone-300">
        © {new Date().getFullYear()} North Star Surrogacy
      </footer>

      {/* Terms & Conditions Dialog */}
      <Dialog open={termsOpen} onOpenChange={setTermsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Terms of Use & Privacy Policy</DialogTitle>
          </DialogHeader>
          <div className="prose prose-sm prose-stone max-w-none text-sm leading-relaxed">
            {termsContent.split('\n').map((line, i) => {
              if (line.startsWith('# ')) return <h1 key={i} className="text-lg font-bold text-[#1A3638] mt-6 mb-2">{line.replace('# ', '')}</h1>
              if (line.startsWith('## ')) return <h2 key={i} className="text-base font-bold text-[#1A3638] mt-5 mb-2">{line.replace('## ', '')}</h2>
              if (line.startsWith('### ')) return <h3 key={i} className="text-sm font-bold text-stone-700 mt-4 mb-1">{line.replace('### ', '')}</h3>
              if (line.startsWith('- **')) {
                const match = line.match(/^- \*\*(.+?)\*\*:?\s*(.*)$/)
                if (match) return <p key={i} className="ml-4 text-stone-600"><strong className="text-stone-800">{match[1]}:</strong> {match[2]}</p>
              }
              if (line.startsWith('- ')) return <p key={i} className="ml-4 text-stone-600">• {line.replace('- ', '')}</p>
              if (line.startsWith('**') && line.endsWith('**')) return <p key={i} className="font-bold text-stone-800 mt-3">{line.replace(/\*\*/g, '')}</p>
              if (line.startsWith('*') && line.endsWith('*')) return <p key={i} className="italic text-stone-500 mt-4 text-center">{line.replace(/\*/g, '')}</p>
              if (line === '---') return <hr key={i} className="my-6 border-stone-200" />
              if (line.trim() === '') return <div key={i} className="h-2" />
              return <p key={i} className="text-stone-600">{line}</p>
            })}
          </div>
          <div className="flex justify-end pt-4 border-t">
            <Button size="sm" onClick={() => { setTermsOpen(false); setAgreedTerms(true) }} className="gap-1" style={{ backgroundColor: '#1A3638' }}>
              <CheckCircle2 className="size-3.5" /> I Agree
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
