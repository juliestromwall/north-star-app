import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { CheckCircle, Clock, Mail, Heart, ArrowLeft, Eye, EyeOff, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import ConfettiBurst, { useConfetti } from '@/components/effects/ConfettiBurst'

const QUALIFIED_GC_STEPS = [
  { icon: Mail, label: 'Confirmation email sent', desc: 'Check your inbox for a welcome email with details about your application.' },
  { icon: Clock, label: 'Application review (3–5 business days)', desc: 'Our team will carefully review your responses and contact you to schedule a phone interview.' },
  { icon: Heart, label: 'Phone interview', desc: 'A 30–45 minute call with one of our coordinators to get to know you and answer your questions.' },
]

const QUALIFIED_IP_STEPS = [
  { icon: Mail, label: 'Confirmation email sent', desc: 'Check your inbox for a welcome email outlining next steps.' },
  { icon: Clock, label: 'Application review (3–5 business days)', desc: 'Our team will review your application and reach out to schedule a consultation.' },
  { icon: Heart, label: 'Initial consultation call', desc: 'A call with your dedicated coordinator to walk through the process and answer all your questions.' },
]

const CONFETTI_ICON_SRC = '/abc-favicon.png'

export default function IntakeConfirmationPage() {
  const { state } = useLocation()
  const navigate  = useNavigate()
  const [password, setPassword]               = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPw, setShowPw]                   = useState(false)
  const [pwSaved, setPwSaved]                 = useState(false)
  const { fire, ref: confettiRef } = useConfetti()

  const pwValid = password.length >= 8 && password === confirmPassword

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

  const { qualified, type, name, answers } = state
  const editPath = type === 'gc' ? '/apply/surrogate' : '/apply/ip'
  const steps = type === 'gc' ? QUALIFIED_GC_STEPS : QUALIFIED_IP_STEPS
  const typeLabel = type === 'gc' ? 'Surrogate' : 'Intended Parent'
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

  if (!qualified) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#fdf8f3] to-white">
        <header className="flex items-center justify-center px-6 py-6 border-b border-stone-200 bg-white">
          <img src="/abc-logo.png" alt="Abundant Beginnings Co." className="h-16 w-auto" />
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
            <a href="mailto:info@abcsurrogacy.com" className="text-abc-coral underline">
              info@abcsurrogacy.com
            </a>.
          </p>

          <div className="rounded-xl bg-stone-50 border border-stone-200 p-6 text-left mb-8">
            <p className="text-sm font-medium text-stone-700 mb-2">We wish you all the best</p>
            <p className="text-sm text-stone-500">
              There are many paths to building a family and supporting families. We hope you find the right one for you, and we are grateful for your willingness to consider this journey.
            </p>
          </div>

          <div className="flex flex-col gap-3 items-center">
            <Button variant="outline" onClick={() => navigate(editPath, { state: { prefill: answers } })} className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Edit my answers
            </Button>
            <button onClick={() => navigate('/surrogatequiz')} className="text-xs text-stone-400 underline underline-offset-2">
              Return to Application Home
            </button>
          </div>
        </div>

        <footer className="py-6 text-center text-xs text-stone-400">
          © {new Date().getFullYear()} Abundant Beginnings Co. · All rights reserved
        </footer>
      </div>
    )
  }

  // Qualified page
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#fdf8f3] to-white">
      {showConfetti && <ConfettiBurst ref={confettiRef} iconSrc={CONFETTI_ICON_SRC} zIndex={40} />}
      <header className="flex items-center justify-center px-6 py-6 border-b border-stone-200 bg-white">
        <img src="/abc-logo.png" alt="Abundant Beginnings Co." className="h-16 w-auto" />
      </header>

      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 mx-auto mb-6">
          <CheckCircle className="w-8 h-8 text-emerald-500" />
        </div>

        <h1 className="text-2xl font-bold text-stone-800 mb-2">
          Great news, {name}!
        </h1>
        <p className="text-stone-500 mb-2">
          You're a potential fit as a{typeLabel === 'Surrogate' ? '' : 'n'} {typeLabel}
        </p>

        <p className="text-stone-600 mb-10 leading-relaxed">
          Your responses look promising! Our team will be in touch shortly — a confirmation has been sent to your email. We're excited to connect with you.
        </p>

        {/* Next steps */}
        <div className="text-left space-y-4 mb-10">
          <p className="text-sm font-semibold text-stone-700 uppercase tracking-wide text-center mb-6">
            What Happens Next
          </p>
          {steps.map((s, i) => (
            <div key={i} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-abc-coral/10 shrink-0">
                  <s.icon className="w-5 h-5 text-abc-coral" />
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

        {/* Portal password setup */}
        <div className="rounded-xl border-2 border-stone-200 p-5 text-left mb-6" style={{ backgroundColor: '#fdf8f3' }}>
          <p className="text-sm font-semibold text-stone-800 mb-0.5 flex items-center gap-1.5"><Lock className="w-3.5 h-3.5 text-stone-500" /> Set up your portal access</p>
          <p className="text-xs text-stone-400 mb-4">Create a password so you can log in and track your application.</p>
          {pwSaved ? (
            <div className="flex items-center gap-2 text-emerald-600 text-sm font-medium py-2">
              <CheckCircle className="w-4 h-4" /> Password saved — you're all set!
            </div>
          ) : (
            <div className="space-y-3">
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
                  <p className="text-xs text-emerald-600">✓ Looks good!</p>
                )}
              </div>
              <Button
                onClick={() => pwValid && setPwSaved(true)}
                disabled={!pwValid}
                className="w-full h-10 rounded-xl text-sm font-semibold"
                style={pwValid ? { backgroundColor: '#464DA0', color: '#fff' } : {}}
              >
                Save password
              </Button>
            </div>
          )}
        </div>

        <button
          onClick={() => navigate(editPath, { state: { prefill: answers } })}
          className="text-sm text-stone-400 underline underline-offset-2 mb-6 hover:text-stone-600 transition-colors"
        >
          ← Edit my answers
        </button>

        <div className="rounded-xl bg-[#fdf8f3] border border-stone-200 p-6 text-left mb-8">
          <p className="text-sm font-medium text-stone-700 mb-2">Questions?</p>
          <p className="text-sm text-stone-500">
            You can reach our team any time at{' '}
            <a href="mailto:info@abcsurrogacy.com" className="text-abc-coral underline">
              info@abcsurrogacy.com
            </a>{' '}
            or call us at (800) 555-0100.
          </p>
        </div>
      </div>

      <footer className="py-6 text-center text-xs text-stone-400">
        © {new Date().getFullYear()} Abundant Beginnings Co. · All rights reserved
      </footer>
    </div>
  )
}
