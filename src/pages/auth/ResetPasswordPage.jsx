import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Lock, CheckCircle2 } from 'lucide-react'
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
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#faf8f5' }}>
      <header className="flex items-center justify-center px-6 py-6 bg-white border-b border-stone-100">
        <img src="/abc-logo.png" alt="Abundant Beginnings Co." className="h-14 w-auto" />
      </header>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-[#283693]/10 mx-auto mb-4">
              <Lock className="w-6 h-6 text-[#283693]" />
            </div>
            <h1 className="text-2xl font-bold text-stone-800">Set New Password</h1>
            <p className="text-stone-500 text-sm mt-1">Choose a strong password for your account</p>
          </div>

          {success ? (
            <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 text-center space-y-3">
              <CheckCircle2 className="size-12 text-emerald-500 mx-auto" />
              <h2 className="text-lg font-semibold text-stone-800">Password Updated</h2>
              <p className="text-sm text-stone-500">Redirecting to your dashboard...</p>
            </div>
          ) : (
            <form onSubmit={handleReset} className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 space-y-4">
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
                className="w-full h-11 rounded-xl text-sm font-semibold"
                style={{ backgroundColor: '#283693', color: '#fff' }}
              >
                {loading ? 'Updating...' : 'Update Password'}
              </Button>
            </form>
          )}
        </div>
      </div>

      <footer className="py-6 text-center text-xs text-stone-400">
        © {new Date().getFullYear()} Abundant Beginnings Co. · All rights reserved
      </footer>
    </div>
  )
}
