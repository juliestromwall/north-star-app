import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { CheckCircle, Clock, Mail, Heart, ArrowRight, Eye, EyeOff, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import ConfettiBurst, { useConfetti } from '@/components/effects/ConfettiBurst'
import { useIframeHeightReporter, scrollParentToIframeTop } from '@/lib/embed'

const QUALIFIED_GC_STEPS = [
  { icon: Mail, label: 'Confirmation email sent', desc: 'Check your inbox for a welcome email with details about your application.' },
  { icon: Clock, label: 'Application review (1–3 business days)', desc: 'Our team will review your responses and contact you to schedule a time to chat.' },
  { icon: Heart, label: "Let's meet!", desc: "We're excited to get to know you and look forward to answering all of your questions." },
]

const QUALIFIED_IP_STEPS = [
  { icon: Mail, label: 'Confirmation email sent', desc: 'Check your inbox for a welcome email outlining next steps.' },
  { icon: Clock, label: 'Application review (3–5 business days)', desc: 'Our team will review your application and reach out to schedule a consultation.' },
  { icon: Heart, label: 'Initial consultation call', desc: 'A call with your dedicated coordinator to walk through the process and answer all your questions.' },
]

const CONFETTI_ICON_SRC = '/favicon.png'

export default function IntakeConfirmationPage() {
  const { state } = useLocation()
  const navigate  = useNavigate()
  useIframeHeightReporter()
  useEffect(() => { scrollParentToIframeTop() }, [])
  const [password, setPassword]               = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPw, setShowPw]                   = useState(false)
  const [pwSaved, setPwSaved]                 = useState(false)
  const [resetEmailSent, setResetEmailSent]   = useState(false)
  const [signupError, setSignupError]         = useState(null)
  const [signingUp, setSigningUp]             = useState(false)
  const { fire, ref: confettiRef } = useConfetti()

  const pwValid = password.length >= 8 && password === confirmPassword

  // Navigation guard — warn if leaving without setting password (GC only)
  useEffect(() => {
    if (pwSaved || !state?.qualified || state?.type === 'ip') return
    const handler = (e) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [pwSaved, state?.qualified])

  // Guard: if navigated directly without state
  if (!state) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fdf8f3]">
        <div className="text-center">
          <p className="text-stone-500 mb-4">This page requires a form submission to display.</p>
          <Button onClick={() => navigate('/surrogatequiz')} variant="outline">Go to Application</Button>
        </div>
      </div>
    )
  }

  const { qualified, type, name, email, answers } = state
  const steps = type === 'gc' ? QUALIFIED_GC_STEPS : QUALIFIED_IP_STEPS
  const typeLabel = type === 'gc' ? 'Surrogate' : 'Intended Parent'
  const isIP = type === 'ip'
  const showConfetti = qualified && type === 'gc'

  useEffect(() => {
    if (!showConfetti) return
    const timer = setTimeout(() => {
      fire({
        particleCount: 260,
        spread: 360,
        startVelocity: 55,
        gravity: 0.25,
        decay: 0.94,
        lifetime: 160,
        scalar: 14,
        iconScalar: 38,
        iconRate: 0.2,
        colors: ['#FFB3AB', '#464DA0', '#FDE047', '#F97316', '#EC4899', '#10B981', '#38BDF8'],
        origin: { x: 0.5, y: 0.45 },
      })
    }, 140)
    return () => clearTimeout(timer)
  }, [showConfetti, fire])

  async function handleCreateAccount() {
    if (!pwValid) return
    setSigningUp(true)
    setSignupError(null)
    setResetEmailSent(false)
    try {
      if (supabase) {
        // Try signUp first (normal flow)
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: name,
              role: type === 'gc' ? 'surrogate' : 'intended_parent',
            },
          },
        })
        if (error) {
          // If already registered (e.g. admin invited them), try signing in and updating password
          if (error.message.includes('already')) {
            try {
              const res = await fetch('/api/reset-password-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
              })
              const data = await res.json()
              if (data.success) {
                setResetEmailSent(true)
                setSigningUp(false)
                return
              }
            } catch {}
            setSignupError('We could not send your secure password setup email. Please use the password reset link from your email, or contact info@northstarsurrogacy.com.')
            setSigningUp(false)
            return
          }
          setSignupError(error.message)
          setSigningUp(false)
          return
        }
      }
      setPwSaved(true)
    } catch (err) {
      setSignupError('Something went wrong. Please try again.')
    }
    setSigningUp(false)
  }

  // ── IP confirmation — simple thank-you, no DQ, no account creation ──
  if (isIP) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#fdf8f3] to-white">
        <header className="flex items-center justify-center px-6 py-6 border-b border-stone-200 bg-white">
          <img src="/north-star-logo.png" alt="North Star Surrogacy" className="h-14 w-auto" />
        </header>

        <div className="max-w-lg mx-auto px-4 py-16 text-center">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-[#464DA0]/10 mx-auto mb-6">
            <Heart className="w-8 h-8 text-[#464DA0]" />
          </div>

          <h1 className="text-2xl font-bold text-stone-800 mb-4">
            Thank You{name ? `, ${name}` : ''}!
          </h1>

          <p className="text-stone-600 mb-4 leading-relaxed">
            Please be sure to check your spam folder, to not miss any emails from us.
          </p>

          <p className="text-stone-600 mb-8 leading-relaxed">
            We are currently reviewing your information, and we will be in touch within <strong>48 hours</strong> to discuss next steps and answer any questions you may have.
          </p>

          <img
            src="/buggy-rolling.gif"
            alt=""
            aria-hidden="true"
            className="block mx-auto max-w-[320px] w-full h-auto mb-8"
          />

          <div className="rounded-xl bg-[#fdf8f3] border border-stone-200 p-6 text-left mb-8">
            <p className="text-sm font-medium text-stone-700 mb-2">Questions?</p>
            <p className="text-sm text-stone-500">
              You can reach our team any time at{' '}
              <a href="mailto:info@northstarsurrogacy.com" className="text-[#464DA0] underline font-medium">
                info@northstarsurrogacy.com
              </a>
            </p>
          </div>
        </div>

        <footer className="py-6 text-center text-xs text-stone-400">
          © {new Date().getFullYear()} North Star Surrogacy · All rights reserved
        </footer>
      </div>
    )
  }

  // ── GC: DQ page ──
  if (!qualified) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#fdf8f3] to-white">
        <header className="flex items-center justify-center px-6 py-6 border-b border-stone-200 bg-white">
          <img src="/north-star-logo.png" alt="North Star Surrogacy" className="h-14 w-auto" />
        </header>

        <div className="max-w-lg mx-auto px-4 py-16 text-center">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-stone-100 mx-auto mb-6">
            <Heart className="w-8 h-8 text-stone-400" />
          </div>

          <h1 className="text-2xl font-bold text-stone-800 mb-4">
            Thank You, {name}
          </h1>

          <p className="text-stone-600 mb-4 leading-relaxed">
            We sincerely appreciate your interest in Abundant Beginnings and the thoughtfulness you put into completing this application.
          </p>

          <p className="text-stone-500 mb-6 leading-relaxed">
            Based on your responses, we're unable to move forward with your application at this time. This can be due to a variety of factors, and it doesn't reflect on your character or your motivations.
          </p>

          <p className="text-stone-500 mb-10 leading-relaxed">
            Circumstances change, and we may be in touch in the future. If you believe there may have been an error, please don't hesitate to contact us directly at{' '}
            <a href="mailto:intake@northstarsurrogacy.com" className="text-[#D4A853] underline">
              intake@northstarsurrogacy.com
            </a>.
          </p>

          <div className="rounded-xl bg-stone-50 border border-stone-200 p-6 text-left mb-8">
            <p className="text-sm font-medium text-stone-700 mb-2">We wish you all the best</p>
            <p className="text-sm text-stone-500">
              There are many paths to building a family and supporting families. We hope you find the right one for you, and we are grateful for your willingness to consider this journey.
            </p>
          </div>

          <div className="flex flex-col gap-3 items-center">
            <button onClick={() => navigate('/surrogatequiz')} className="text-xs text-stone-400 underline underline-offset-2">
              Return to Application Home
            </button>
          </div>
        </div>

        <footer className="py-6 text-center text-xs text-stone-400">
          © {new Date().getFullYear()} North Star Surrogacy · All rights reserved
        </footer>
      </div>
    )
  }

  // ── GC: Qualified page ──
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#fdf8f3] to-white">
      {showConfetti && <ConfettiBurst ref={confettiRef} iconSrc={CONFETTI_ICON_SRC} zIndex={40} />}
      <header className="flex items-center justify-center px-6 py-6 border-b border-stone-200 bg-white">
        <img src="/north-star-logo.png" alt="North Star Surrogacy" className="h-14 w-auto" />
      </header>

      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 mx-auto mb-6">
          <CheckCircle className="w-8 h-8 text-emerald-500" />
        </div>

        <h1 className="text-2xl font-bold text-stone-800 mb-2">
          Great news, {name}!
        </h1>
        <p className="text-stone-500 mb-2">
          You're a potential fit as a Surrogate
        </p>

        <p className="text-stone-600 mb-8 leading-relaxed">
          Your responses look promising! Set up your account below to access your portal and complete your profile.
        </p>

        {/* GC: account setup — PRIMARY CTA */}
        <div className={`rounded-xl border-2 p-5 text-left mb-8 transition-all ${pwSaved ? 'border-emerald-300 bg-emerald-50' : 'border-[#1A3638] bg-white shadow-lg'}`}>
          {pwSaved ? (
            <div className="text-center py-3 space-y-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-emerald-100 mx-auto">
                <CheckCircle className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <p className="font-semibold text-emerald-800 text-lg">Account created!</p>
                <p className="text-sm text-emerald-600 mt-1">You're all set. Head to your portal to complete your profile.</p>
              </div>
              <Button
                onClick={() => {
                  // If embedded in a cross-origin iframe, break out so the session is re-established
                  // at the top level (avoids Safari's third-party storage partitioning) and the portal
                  // renders full-screen rather than inside the partner's page.
                  if (typeof window !== 'undefined' && window.top !== window.self) {
                    try {
                      window.top.location.href = window.location.origin + '/dashboard'
                      return
                    } catch {
                      // Top-navigation blocked — fall through to in-iframe navigation
                    }
                  }
                  navigate('/dashboard')
                }}
                className="w-full h-12 rounded-xl text-[15px] font-semibold gap-2"
                style={{ backgroundColor: '#1A3638', color: '#fff' }}
              >
                Continue to my portal
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          ) : resetEmailSent ? (
            <div className="text-center py-3 space-y-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 mx-auto">
                <Mail className="w-6 h-6 text-[#1A3638]" />
              </div>
              <div>
                <p className="font-semibold text-stone-800 text-lg">Check your email</p>
                <p className="text-sm text-stone-600 mt-1">
                  We sent a secure password setup link to <span className="font-medium">{email}</span>. Use that link to finish creating your portal password.
                </p>
              </div>
              <Button
                onClick={() => navigate('/login')}
                variant="outline"
                className="w-full h-12 rounded-xl text-[15px] font-semibold gap-2"
              >
                Go to login
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-1">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#1A3638]/10">
                  <Lock className="w-4 h-4 text-[#1A3638]" />
                </div>
                <p className="text-sm font-semibold text-stone-800">Create your account</p>
              </div>
              <p className="text-xs text-stone-400 mb-4 ml-10">Set up your password to access the surrogate portal.</p>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-stone-500 uppercase tracking-wide font-semibold">Email</Label>
                  <Input
                    type="email"
                    value={email || ''}
                    readOnly
                    className="rounded-xl h-11 bg-stone-50 text-stone-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-stone-500 uppercase tracking-wide font-semibold">Password</Label>
                  <div className="relative">
                    <Input
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      className="rounded-xl h-11 pr-11"
                    />
                    <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-stone-500 uppercase tracking-wide font-semibold">Confirm password</Label>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Repeat your password"
                    className="rounded-xl h-11"
                  />
                  {confirmPassword && !pwValid && (
                    <p className="text-xs text-red-500">Passwords don't match or are too short</p>
                  )}
                  {confirmPassword && pwValid && (
                    <p className="text-xs text-emerald-600">Looks good!</p>
                  )}
                </div>
                {signupError && (
                  <div className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                    {signupError.includes('already registered') || signupError.includes('already been registered')
                      ? <>It looks like you already have an account. <a href="/login" className="text-[#1A3638] underline font-medium">Log in here</a></>
                      : signupError
                    }
                  </div>
                )}
                <Button
                  onClick={handleCreateAccount}
                  disabled={!pwValid || signingUp}
                  className="w-full h-11 rounded-xl text-sm font-semibold gap-2"
                  style={pwValid ? { backgroundColor: '#1A3638', color: '#fff' } : {}}
                >
                  {signingUp ? 'Creating account...' : 'Create account & continue'}
                  {!signingUp && <ArrowRight className="w-4 h-4" />}
                </Button>
              </div>
            </>
          )}
        </div>

        {/* Next steps — secondary info */}
        <div className="text-left space-y-4 mb-8">
          <p className="text-sm font-semibold text-stone-700 uppercase tracking-wide text-center mb-6">
            What Happens Next
          </p>
          {steps.map((s, i) => (
            <div key={i} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-[#D4A853]/10 shrink-0">
                  <s.icon className="w-5 h-5 text-[#D4A853]" />
                </div>
                {i < steps.length - 1 && (
                  <div className="w-px flex-1 bg-stone-200 my-1" />
                )}
              </div>
              <div className="pb-6">
                <p className="font-semibold text-stone-800 text-sm">{s.label}</p>
                <p className="text-sm text-stone-500 mt-1">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-xl bg-[#fdf8f3] border border-stone-200 p-6 text-left mb-8">
          <p className="text-sm font-medium text-stone-700 mb-2">Questions?</p>
          <p className="text-sm text-stone-500">
            You can reach our team any time at{' '}
            <a href="mailto:intake@northstarsurrogacy.com" className="text-[#D4A853] underline">
              intake@northstarsurrogacy.com
            </a>
          </p>
        </div>
      </div>

      <footer className="py-6 text-center text-xs text-stone-400">
        © {new Date().getFullYear()} North Star Surrogacy · All rights reserved
      </footer>
    </div>
  )
}
