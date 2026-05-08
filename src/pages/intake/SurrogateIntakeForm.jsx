import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getGCDisqualifications } from '@/data/mock/intakeSubmissions'
import { checkEmailExists } from '@/lib/db'
import { useBotProtection, HoneypotField, TurnstileWidget } from '@/lib/botProtection.jsx'
import { QuizShell, ChoiceCard, YesNoGrid } from './QuizShell'
import { useIframeHeightReporter, scrollParentToIframeTop } from '@/lib/embed'

const GC_COLOR = '#D4A853'
const GC_FG = '#ffffff'

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY',
]

const MARITAL_OPTIONS = [
  { value: 'Single',               label: 'Single'               },
  { value: 'In a Relationship',    label: 'In a Relationship'    },
  { value: 'Married',              label: 'Married'              },
  { value: 'Domestic Partnership', label: 'Domestic Partnership' },
  { value: 'Divorced',             label: 'Divorced'             },
  { value: 'Widowed',              label: 'Widowed'              },
]

const COMM_OPTIONS = [
  { value: 'Text',  label: 'Text message' },
  { value: 'Email', label: 'Email'        },
  { value: 'Phone', label: 'Phone call'   },
]

function calculateBMI(ft, inches, lbs) {
  const totalIn = (parseInt(ft) || 0) * 12 + (parseInt(inches) || 0)
  if (!totalIn || !lbs) return null
  return ((lbs / (totalIn * totalIn)) * 703).toFixed(1)
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((value || '').trim())
}

function isValidUSPhone(value) {
  const digits = (value || '').replace(/\D/g, '')
  return digits.length === 10 || (digits.length === 11 && digits.startsWith('1'))
}

export default function SurrogateIntakeForm() {
  const navigate = useNavigate()
  const { state: navState } = useLocation()
  const prefill = navState?.prefill || {}
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const startTimeRef = useRef(Date.now())
  const maxStepRef = useRef(1)
  useIframeHeightReporter()
  useEffect(() => {
    window.scrollTo(0, 0)
    scrollParentToIframeTop()
  }, [step])
  useEffect(() => {
    if (step > maxStepRef.current) maxStepRef.current = step
  }, [step])
  const [form, setForm] = useState({
    firstName: '', lastName: '', dob: '', email: '', phone: '', state: '',
    usCitizen: null,
    maritalStatus: '', preferredContact: '',
    heightFt: '', heightIn: '', weightLbs: '',
    healthyPregnancy: null,
    sixOrMoreDeliveries: null,
    moreThanTwoCsections: null,
    hearAboutUs: '', agreeBackgroundCheck: false,
    ...prefill,
  })

  const {
    honeypotValue, setHoneypotValue, trackFieldChange,
    validateSubmission, setTurnstileToken, getBotCheckPayload,
  } = useBotProtection(startTimeRef)

  const set = (field, value) => {
    trackFieldChange()
    setForm(prev => ({ ...prev, [field]: value }))
  }
  const bmi = calculateBMI(form.heightFt, form.heightIn, form.weightLbs)
  const bmiVal = parseFloat(bmi)
  const bmiOk = bmi && bmiVal >= 19 && bmiVal <= 33
  const emailValid = isValidEmail(form.email)
  const phoneValid = isValidUSPhone(form.phone)

  const step1Valid = form.firstName && form.lastName && form.dob && form.email && form.phone && form.state && form.usCitizen !== null && emailValid && phoneValid
  const step2Valid = form.maritalStatus && form.preferredContact
  const step3Valid = form.heightFt && form.heightIn && form.weightLbs
  const step4Valid = form.healthyPregnancy !== null && form.sixOrMoreDeliveries !== null && form.moreThanTwoCsections !== null && form.experiencedSurrogate !== null
  const step5Valid = form.hearAboutUs && form.agreeBackgroundCheck && (form.hearAboutUs !== 'Friend or family' || form.referralName?.trim())
  const stepValid = [null, step1Valid, step2Valid, step3Valid, step4Valid, step5Valid]
  const [emailError, setEmailError] = useState(null)
  const [checking, setChecking] = useState(false)

  async function handleStep1Next() {
    setChecking(true)
    setEmailError(null)
    try {
      const exists = await checkEmailExists(form.email)
      if (exists) {
        setEmailError('This email has already been used to apply. Please log in to your existing account instead.')
        setChecking(false)
        return
      }
    } catch {}
    setChecking(false)
    setStep(2)
  }

  async function handleSubmit() {
    if (submitting) return
    setSubmitting(true)
    setSubmitError(null)

    const botCheck = validateSubmission()
    if (!botCheck.ok) {
      if (['turnstile_required', 'too_few_interactions'].includes(botCheck.reason)) {
        setSubmitError('Please review the form and submit again.')
        setSubmitting(false)
        return
      }
      navigate('/apply/confirmation', {
        state: { qualified: false, dqReasons: [], type: 'gc', name: form.firstName, email: form.email, tracking: {}, answers: form },
      })
      setSubmitting(false)
      return
    }

    const answers = { ...form, bmi: parseFloat(bmi) }
    const dqReasons = getGCDisqualifications(answers)
    const rawTracking = JSON.parse(sessionStorage.getItem('intakeTrackingData') || '{}')
    const timeToCompleteSeconds = Math.round((Date.now() - startTimeRef.current) / 1000)
    const tracking = {
      ...rawTracking,
      quizStartedAt: new Date(startTimeRef.current).toISOString(),
      quizCompletedAt: new Date().toISOString(),
      timeToCompleteSeconds,
      maxStepReached: 5,
      totalSteps: 5,
      completed: true,
    }
    const qualified = dqReasons.length === 0
    try {
      const res = await fetch('/api/intake-submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bot: getBotCheckPayload(),
          submission: {
        intake_type: 'gc',
        qualified,
        status: qualified ? 'qualified' : 'disqualified',
        dq_reasons: dqReasons,
        applicant_name: `${form.firstName} ${form.lastName}`.trim(),
        applicant_email: form.email.trim(),
        applicant_phone: form.phone.trim(),
        assigned_to: qualified ? 'intake@northstarsurrogacy.com' : null,
        country: 'United States',
        state_region: form.state || null,
        city: null,
        zip_postal_code: null,
        answers,
        tracking,
        utm_source: tracking.utm_source || null,
        utm_medium: tracking.utm_medium || null,
        utm_campaign: tracking.utm_campaign || null,
        utm_content: tracking.utm_content || null,
        utm_term: tracking.utm_term || null,
        fbclid: tracking.fbclid || null,
        ttclid: tracking.ttclid || null,
        resolved_source: tracking.resolvedSource || null,
        referrer: document.referrer || null,
        user_agent: navigator.userAgent || null,
          },
        }),
      })
      const result = await res.json().catch(() => ({}))
      if (result.accepted === false) {
        if (['turnstile_failed', 'rate_limited_ip', 'duplicate_email_recent', 'too_few_interactions'].includes(result.reason)) {
          setSubmitError('We could not verify the submission. Please try again in a moment.')
          setSubmitting(false)
          return
        }
        navigate('/apply/confirmation', {
          state: { qualified: false, dqReasons: [], type: 'gc', name: form.firstName, email: form.email, tracking: {}, answers: form },
        })
        setSubmitting(false)
        return
      }
    } catch {
      // Keep applicant flow moving even if persistence fails
    }

    // Auto-send welcome email + create portal for qualified surrogates
    if (qualified) {
      fetch('/api/welcome-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email.trim(), firstName: form.firstName.trim(), lastName: form.lastName.trim() }),
      }).catch(() => {}) // non-blocking
    }

    // Notify admin of new application
    fetch('/api/notify-new-application', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        applicantName: `${form.firstName} ${form.lastName}`.trim(),
        applicantEmail: form.email.trim(),
        applicantPhone: form.phone.trim(),
        state: form.state || '',
        qualified,
        dqReasons,
        hearAboutUs: form.hearAboutUs || '',
        referralName: form.referralName || '',
        hearAboutUsOther: form.hearAboutUsOther || '',
      }),
    }).catch(() => {})

    navigate('/apply/confirmation', {
      state: {
        qualified,
        dqReasons, type: 'gc',
        name: form.firstName, email: form.email, tracking,
        answers: form,
      },
    })
    setSubmitting(false)
  }

  const MILESTONES = [null, null, null, 'Halfway there!', 'Almost done!', 'Last step!']
  const shell = (s) => ({
    step: s, totalSteps: 5,
    accentColor: GC_COLOR, accentFg: GC_FG,
    milestone: MILESTONES[s],
    nextDisabled: !stepValid[s] || (s === 1 && checking),
    onBack: s === 1 ? () => navigate('/surrogatequiz') : () => setStep(s - 1),
    onNext: s === 5 ? handleSubmit : s === 1 ? handleStep1Next : () => setStep(s + 1),
    nextLabel: s === 1 && checking ? 'Checking...' : s === 5 ? (submitting ? 'Submitting...' : 'See if I qualify') : 'Continue',
  })

  // Step 1 — Contact info
  if (step === 1) return (
    <QuizShell {...shell(1)} title="Let's get acquainted" subtitle="A few quick details to get started — takes about 5 minutes.">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-stone-500 uppercase tracking-wide font-semibold">First name</Label>
          <Input value={form.firstName} onChange={e => set('firstName', e.target.value)} placeholder="Jane" className="rounded-xl h-11" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-stone-500 uppercase tracking-wide font-semibold">Last name</Label>
          <Input value={form.lastName} onChange={e => set('lastName', e.target.value)} placeholder="Smith" className="rounded-xl h-11" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-stone-500 uppercase tracking-wide font-semibold">Date of birth</Label>
        <Input type="date" value={form.dob} onChange={e => set('dob', e.target.value)} max="2010-12-31" min="1960-01-01" className="rounded-xl h-11" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-stone-500 uppercase tracking-wide font-semibold">State</Label>
        <Select value={form.state} onValueChange={v => set('state', v)}>
          <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Select your state" /></SelectTrigger>
          <SelectContent>{US_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-stone-500 uppercase tracking-wide font-semibold">Phone number</Label>
        <Input type="tel" value={form.phone} onChange={e => {
          const digits = e.target.value.replace(/\D/g, '').slice(0, 10)
          let formatted = digits
          if (digits.length > 6) formatted = `${digits.slice(0,3)}-${digits.slice(3,6)}-${digits.slice(6)}`
          else if (digits.length > 3) formatted = `${digits.slice(0,3)}-${digits.slice(3)}`
          set('phone', formatted)
        }} placeholder="555-555-0100" className="rounded-xl h-11" maxLength={12} />
        {form.phone && !phoneValid && (
          <p className="text-xs text-red-500">Enter a valid US phone number</p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-stone-500 uppercase tracking-wide font-semibold">Email</Label>
        <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="jane@example.com" className="rounded-xl h-11" />
        {form.email && !emailValid && (
          <p className="text-xs text-red-500">Enter a valid email address</p>
        )}
        {emailError && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-1">
            {emailError}{' '}
            <a href="/login" className="text-[#1A3638] underline font-medium">Log in here</a>
          </div>
        )}
      </div>
      <div>
        <p className="text-sm font-medium text-stone-800 mb-1">Are you a US Citizen or Legal Resident?</p>
        <YesNoGrid
          value={form.usCitizen}
          onChange={v => set('usCitizen', v)}
          yesLabel="Yes"
          noLabel="No"
          accentColor={GC_COLOR}
          accentFg={GC_FG}
        />
      </div>
      <p className="text-xs text-stone-400 pt-1">We will only reach out to share your results. No spam, ever.</p>
    </QuizShell>
  )

  // Step 2 — About you
  if (step === 2) return (
    <QuizShell {...shell(2)} title="A little about you" subtitle="Tell us a bit about where you are in life right now.">
      <div className="space-y-2">
        <Label className="text-xs text-stone-500 uppercase tracking-wide font-semibold block">I am</Label>
        {MARITAL_OPTIONS.map(opt => (
          <ChoiceCard key={opt.value} selected={form.maritalStatus === opt.value} onSelect={() => set('maritalStatus', opt.value)} label={opt.label} accentColor={GC_COLOR} accentFg={GC_FG} />
        ))}
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium text-stone-800">Best way to reach you?</p>
        <p className="text-xs text-stone-400">Communication is key — we aim to respond within 24–48 hours.</p>
        {COMM_OPTIONS.map(opt => (
          <ChoiceCard key={opt.value} selected={form.preferredContact === opt.value} onSelect={() => set('preferredContact', opt.value)} label={opt.label} accentColor={GC_COLOR} accentFg={GC_FG} />
        ))}
      </div>
    </QuizShell>
  )

  // Step 3 — Health
  if (step === 3) return (
    <QuizShell {...shell(3)} title="Health information" subtitle="Surrogacy agencies have a few standard health guidelines — this helps us assess your eligibility." milestone="Halfway there!">
      <div>
        <Label className="text-xs text-stone-500 uppercase tracking-wide font-semibold block mb-3">Height</Label>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-stone-400">Feet</Label>
            <Input type="number" min="4" max="7" value={form.heightFt} onChange={e => set('heightFt', e.target.value)} placeholder="5" className="rounded-xl h-11 text-center" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-stone-400">Inches</Label>
            <Input type="number" min="0" max="11" value={form.heightIn} onChange={e => set('heightIn', e.target.value)} placeholder="6" className="rounded-xl h-11 text-center" />
          </div>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-stone-500 uppercase tracking-wide font-semibold">Weight</Label>
        <div className="flex items-center gap-2">
          <Input type="number" min="90" max="400" value={form.weightLbs} onChange={e => set('weightLbs', e.target.value)} placeholder="145" className="rounded-xl h-11 text-center w-32" />
          <span className="text-sm text-stone-400">lbs</span>
        </div>
      </div>
      {bmi && (
        <div className={`text-sm px-3 py-2 rounded-lg font-medium ${bmiOk ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
          BMI: {bmi} {bmiOk ? '— looks great!' : '— may be outside the typical range (19–33)'}
        </div>
      )}
    </QuizShell>
  )

  // Step 4 — Pregnancy
  if (step === 4) return (
    <QuizShell {...shell(4)} title="Your pregnancy history" subtitle="This helps us understand your experience and eligibility." milestone="Almost done!">
      <div className="space-y-6">
        <div>
          <p className="text-sm font-medium text-stone-800 mb-1">Have you had a healthy pregnancy?</p>
          <p className="text-xs text-stone-400 mb-3">At least one successful pregnancy carried to term.</p>
          <YesNoGrid
            value={form.healthyPregnancy}
            onChange={v => set('healthyPregnancy', v)}
            yesLabel="Yes, I have"
            noLabel="Not yet"
            accentColor={GC_COLOR}
            accentFg={GC_FG}
          />
        </div>
        <div>
          <p className="text-sm font-medium text-stone-800 mb-3">Have you had 6 or more deliveries?</p>
          <YesNoGrid
            value={form.sixOrMoreDeliveries}
            onChange={v => set('sixOrMoreDeliveries', v)}
            yesLabel="Yes"
            noLabel="No"
            accentColor={GC_COLOR}
            accentFg={GC_FG}
          />
        </div>
        <div>
          <p className="text-sm font-medium text-stone-800 mb-3">Have you had more than 2 C-sections?</p>
          <YesNoGrid
            value={form.moreThanTwoCsections}
            onChange={v => set('moreThanTwoCsections', v)}
            yesLabel="Yes"
            noLabel="No"
            accentColor={GC_COLOR}
            accentFg={GC_FG}
          />
        </div>
        <div>
          <p className="text-sm font-medium text-stone-800 mb-3">Are you an experienced surrogate?</p>
          <YesNoGrid
            value={form.experiencedSurrogate}
            onChange={v => set('experiencedSurrogate', v)}
            yesLabel="Yes"
            noLabel="No"
            accentColor={GC_COLOR}
            accentFg={GC_FG}
          />
        </div>
      </div>
    </QuizShell>
  )

  // Step 5 — Final
  if (step === 5) return (
    <QuizShell {...shell(5)} title="Final step" subtitle="You're almost done. We'll review your responses and be in touch shortly." milestone="Last step!">
      <div>
        <p className="text-sm font-medium text-stone-800 mb-2">How did you hear about North Star Surrogacy?</p>
        <div className="space-y-2">
          {[
            { value: 'Instagram',              label: 'Instagram'        },
            { value: 'TikTok',                 label: 'TikTok'           },
            { value: 'Facebook',               label: 'Facebook'         },
            { value: 'Google search',          label: 'Google'           },
            { value: 'Friend or family',       label: 'Friend or family' },
            { value: 'Doctor or clinic',       label: 'Doctor or clinic' },
            { value: 'Podcast or blog',        label: 'Podcast or blog'  },
            { value: 'Other',                  label: 'Other'            },
          ].map(opt => (
            <ChoiceCard key={opt.value} selected={form.hearAboutUs === opt.value} onSelect={() => set('hearAboutUs', opt.value)} label={opt.label} accentColor={GC_COLOR} accentFg={GC_FG} />
          ))}
        </div>
        {form.hearAboutUs === 'Other' && (
          <div className="mt-3 space-y-1.5">
            <Label className="text-xs text-stone-500 uppercase tracking-wide font-semibold">Please specify</Label>
            <Input value={form.hearAboutUsOther || ''} onChange={e => set('hearAboutUsOther', e.target.value)} placeholder="How did you find us?" className="rounded-xl h-11" />
          </div>
        )}
        {form.hearAboutUs === 'Friend or family' && (
          <div className="mt-3 space-y-1.5">
            <Label className="text-xs text-stone-500 uppercase tracking-wide font-semibold">Who referred you?</Label>
            <Input value={form.referralName || ''} onChange={e => set('referralName', e.target.value)} placeholder="Their name" className="rounded-xl h-11" />
          </div>
        )}
      </div>
      <div
        className="flex items-start gap-3 rounded-xl border-2 p-4 cursor-pointer transition-all"
        style={form.agreeBackgroundCheck ? { borderColor: GC_COLOR, backgroundColor: '#D4A85318' } : { borderColor: '#e7e5e4' }}
        onClick={() => set('agreeBackgroundCheck', !form.agreeBackgroundCheck)}
      >
        <Checkbox id="bg-check" checked={form.agreeBackgroundCheck} onCheckedChange={v => set('agreeBackgroundCheck', v === true)} className="mt-0.5 shrink-0" />
        <label htmlFor="bg-check" className="text-sm text-stone-600 leading-relaxed cursor-pointer select-none">
          I understand that if approved, a background check is part of the standard screening process.
        </label>
      </div>
      {submitError ? <p className="text-sm text-red-600">{submitError}</p> : null}
      <TurnstileWidget onToken={setTurnstileToken} />
      <HoneypotField value={honeypotValue} onChange={setHoneypotValue} />
    </QuizShell>
  )

  return null
}
