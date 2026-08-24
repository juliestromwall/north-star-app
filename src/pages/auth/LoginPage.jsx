import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Eye, EyeOff, LogIn, ArrowRight, Mail, ArrowLeft, CheckCircle2, ShieldX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import { useRole } from '@/context/RoleContext'

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { portalBlocked, isAuthenticated, authLoading } = useRole()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [forgotMode, setForgotMode] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  async function handleForgotPassword(e) {
    e.preventDefault()
    if (!email) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/reset-password-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.debug ? `${data.error} (${data.debug})` : data.error || 'Failed to send reset email')
      setResetSent(true)
    } catch (err) {
      setError(err.message || 'Failed to send reset email')
    }
    setLoading(false)
  }

  const redirectParam = new URLSearchParams(location.search).get('redirect')
  const safeRedirect = redirectParam && /^\/[^/]/.test(redirectParam) ? redirectParam : null
  const from = location.state?.from || safeRedirect || '/dashboard'

  // If the user is already logged in (e.g. clicked an email link while a session is active),
  // skip the form and forward them to their intended destination.
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(from, { replace: true })
    }
  }, [authLoading, isAuthenticated, from, navigate])

  async function handleLogin(e) {
    e.preventDefault()
    if (!email || !password) return
    setLoading(true)
    setError(null)

    try {
      if (!supabase) {
        setError('Authentication is not configured.')
        setLoading(false)
        return
      }

      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        if (authError.message.includes('Invalid login')) {
          setError('Invalid email or password. Please try again.')
        } else if (authError.message.includes('Email not confirmed')) {
          setError('Please check your email and confirm your account first.')
        } else {
          setError(authError.message)
        }
        setLoading(false)
        return
      }

      // Successful login — navigate to intended destination
      navigate(from, { replace: true })
    } catch {
      setError('Something went wrong. Please try again.')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(160deg, #fafaf7 0%, #e8efee 25%, #c8d9d6 55%, #88C0C4 80%, #1F3A3C 100%)' }}>
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <img src="/first-star-logo.png" alt="First Star Surrogacy" className="h-40 w-auto mx-auto mb-6" />
            <h1 className="text-3xl font-heading font-bold" style={{ color: '#1A3638' }}><span style={{ color: '#D4A853' }}>Welcome</span> back</h1>
            <p className="text-stone-400 text-sm mt-2">Sign in to your portal</p>
            {new URLSearchParams(location.search).get('reason') === 'idle' && (
              <p className="text-amber-600 text-xs mt-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">You were signed out due to inactivity. Please sign in again.</p>
            )}
            {portalBlocked && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                <ShieldX className="size-8 text-red-400 mx-auto mb-2" />
                <p className="text-sm font-semibold text-red-700">Portal Access Removed</p>
                <p className="text-xs text-red-500 mt-1">Your portal access is no longer active. If you believe this is an error, please contact <a href="mailto:info@northstarsurrogacy.com" className="underline font-medium">info@northstarsurrogacy.com</a></p>
              </div>
            )}
          </div>

          {forgotMode ? (
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-stone-200/60 shadow-lg p-6 space-y-4">
              {resetSent ? (
                <div className="text-center py-4 space-y-3">
                  <CheckCircle2 className="size-12 text-emerald-500 mx-auto" />
                  <h2 className="text-lg font-semibold text-stone-800">Check your email</h2>
                  <p className="text-sm text-stone-500">We sent a password reset link to <strong>{email}</strong></p>
                  <Button variant="outline" className="mt-4" onClick={() => { setForgotMode(false); setResetSent(false) }}>
                    <ArrowLeft className="size-4 mr-1" /> Back to sign in
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div className="text-center mb-2">
                    <Mail className="size-8 text-[#1A3638] mx-auto mb-2" />
                    <h2 className="text-lg font-semibold text-stone-800">Reset your password</h2>
                    <p className="text-sm text-stone-500 mt-1">Enter your email and we'll send you a reset link</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-stone-500 uppercase tracking-wide font-semibold">Email</Label>
                    <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className="rounded-xl h-11" autoFocus />
                  </div>
                  {error && <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}
                  <Button type="submit" disabled={!email || loading} className="w-full h-11 rounded-xl text-sm font-semibold gap-2 text-white border-0" style={{ background: 'linear-gradient(135deg, #1F3A3C, #5A9EA2)' }}>
                    {loading ? 'Sending...' : 'Send Reset Link'}
                  </Button>
                  <button type="button" onClick={() => { setForgotMode(false); setError(null) }} className="w-full text-xs text-stone-500 hover:text-stone-700 flex items-center justify-center gap-1 mt-2">
                    <ArrowLeft className="size-3" /> Back to sign in
                  </button>
                </form>
              )}
            </div>
          ) : (
          <form onSubmit={handleLogin} className="bg-white/80 backdrop-blur-sm rounded-2xl border border-stone-200/60 shadow-lg p-6 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-stone-500 uppercase tracking-wide font-semibold">Email</Label>
              <Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="rounded-xl h-11"
                autoComplete="email"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-stone-500 uppercase tracking-wide font-semibold">Password</Label>
                <button
                  type="button"
                  onClick={() => { setForgotMode(true); setError(null) }}
                  className="text-xs text-[#D4A853] hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="rounded-xl h-11 pr-11"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
            )}

            <Button
              type="submit"
              disabled={!email || !password || loading}
              className="w-full h-11 rounded-xl text-sm font-semibold gap-2 text-white border-0"
              style={{ background: 'linear-gradient(135deg, #1F3A3C, #5A9EA2)' }}
            >
              {loading ? 'Signing in...' : 'Sign in'}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </Button>
          </form>
          )}

        </div>
      </div>

      <footer className="py-8 text-center text-xs text-stone-300">
        © {new Date().getFullYear()} First Star Surrogacy
      </footer>
    </div>
  )
}
