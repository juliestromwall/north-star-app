import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, CheckCircle2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
            <img src="/abc-logo.png" alt="Abundant Beginnings Co." className="h-16 w-auto mx-auto mb-6" />
            <h1 className="text-3xl font-heading font-bold" style={{ color: '#283693' }}>
              Set your <span style={{ color: '#ed148c' }}>password</span>
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

              {error && (
                <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
              )}

              <Button
                type="submit"
                disabled={!password || !confirmPw || loading}
                className="w-full h-11 rounded-xl text-sm font-semibold text-white border-0"
                style={{ background: 'linear-gradient(135deg, #ed148c, #283693)' }}
              >
                {loading ? 'Updating...' : 'Update Password'}
              </Button>
            </form>
          )}
        </div>
      </div>

      <footer className="py-8 text-center text-xs text-stone-300">
        © {new Date().getFullYear()} Abundant Beginnings Co.
      </footer>
    </div>
  )
}
