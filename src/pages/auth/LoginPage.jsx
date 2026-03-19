import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Eye, EyeOff, LogIn, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const from = location.state?.from || '/'

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
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#faf8f5' }}>
      <header className="flex items-center justify-center px-6 py-6 bg-white border-b border-stone-100">
        <img src="/abc-logo.png" alt="Abundant Beginnings Co." className="h-14 w-auto" />
      </header>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-[#283693]/10 mx-auto mb-4">
              <LogIn className="w-6 h-6 text-[#283693]" />
            </div>
            <h1 className="text-2xl font-bold text-stone-800">Welcome back</h1>
            <p className="text-stone-500 text-sm mt-1">Sign in to your portal</p>
          </div>

          <form onSubmit={handleLogin} className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 space-y-4">
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
                  onClick={() => {/* TODO: forgot password flow */}}
                  className="text-xs text-[#283693] hover:underline"
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
              className="w-full h-11 rounded-xl text-sm font-semibold gap-2"
              style={{ backgroundColor: '#283693', color: '#fff' }}
            >
              {loading ? 'Signing in...' : 'Sign in'}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </Button>
          </form>

          <p className="text-center text-xs text-stone-400 mt-6">
            Want to become a surrogate?{' '}
            <button onClick={() => navigate('/surrogatequiz')} className="text-[#283693] hover:underline font-medium">
              Take the quiz
            </button>
          </p>
        </div>
      </div>

      <footer className="py-6 text-center text-xs text-stone-400">
        © {new Date().getFullYear()} Abundant Beginnings Co. · All rights reserved
      </footer>
    </div>
  )
}
