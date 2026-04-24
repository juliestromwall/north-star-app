import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getIPDisqualifications } from '@/data/mock/intakeSubmissions'
import { checkEmailExists } from '@/lib/db'
import { useBotProtection, HoneypotField, TurnstileWidget } from '@/lib/botProtection.jsx'
import { useIframeHeightReporter, scrollParentToIframeTop } from '@/lib/embed'
import { QuizShell, ChoiceCard, YesNoGrid } from './QuizShell'

const IP_COLOR = '#464DA0'
const IP_FG   = '#FFFFFF'

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY',
]

const COUNTRIES = [
  'United States','Canada','United Kingdom','Australia','Germany','France',
  'Israel','Japan','China','India','Mexico','Brazil','Other',
]

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((value || '').trim())
}

function isValidInternationalPhone(value) {
  const trimmed = (value || '').trim()
  if (!/^[+\d\s\-()./]+$/.test(trimmed)) return false
  const digits = trimmed.replace(/\D/g, '')
  return digits.length >= 7 && digits.length <= 15
}

const COUNTRY_CODES = [
  { code: '+1', flag: '🇺🇸', label: 'US +1' },
  { code: '+1', flag: '🇨🇦', label: 'CA +1' },
  { code: '+44', flag: '🇬🇧', label: 'UK +44' },
  { code: '+61', flag: '🇦🇺', label: 'AU +61' },
  { code: '+49', flag: '🇩🇪', label: 'DE +49' },
  { code: '+33', flag: '🇫🇷', label: 'FR +33' },
  { code: '+34', flag: '🇪🇸', label: 'ES +34' },
  { code: '+39', flag: '🇮🇹', label: 'IT +39' },
  { code: '+81', flag: '🇯🇵', label: 'JP +81' },
  { code: '+86', flag: '🇨🇳', label: 'CN +86' },
  { code: '+91', flag: '🇮🇳', label: 'IN +91' },
  { code: '+52', flag: '🇲🇽', label: 'MX +52' },
  { code: '+55', flag: '🇧🇷', label: 'BR +55' },
  { code: '+972', flag: '🇮🇱', label: 'IL +972' },
  { code: '+971', flag: '🇦🇪', label: 'AE +971' },
]

function formatPhoneForCountry(value, countryCode) {
  const digits = value.replace(/\D/g, '').slice(0, countryCode === '+1' ? 10 : 12)
  if (countryCode === '+1') {
    if (digits.length > 6) return `${digits.slice(0,3)}-${digits.slice(3,6)}-${digits.slice(6)}`
    if (digits.length > 3) return `${digits.slice(0,3)}-${digits.slice(3)}`
    return digits
  }
  return digits.replace(/(\d{3,4})(?=\d)/g, '$1-').replace(/-$/, '')
}

function PhoneWithCountryCode({ value, onChange, countryCode, onCountryChange, placeholder }) {
  return (
    <div className="flex gap-1.5">
      <select
        value={countryCode}
        onChange={e => onCountryChange(e.target.value)}
        className="rounded-xl h-11 border border-stone-200 bg-white px-2 text-sm min-w-[90px] outline-none focus:border-[#283693]"
      >
        {COUNTRY_CODES.map(c => (
          <option key={c.label} value={c.code}>{c.flag} {c.code}</option>
        ))}
      </select>
      <Input
        type="tel"
        value={value}
        onChange={e => onChange(formatPhoneForCountry(e.target.value, countryCode))}
        placeholder={placeholder || (countryCode === '+1' ? '555-555-0100' : '123-456-7890')}
        className="rounded-xl h-11 flex-1"
        maxLength={countryCode === '+1' ? 12 : 15}
      />
    </div>
  )
}

function isValidPostalCode(country, value) {
  const trimmed = (value || '').trim()
  if (!trimmed) return false
  if (country === 'United States') return /^\d{5}(?:-\d{4})?$/.test(trimmed)
  return /^[A-Za-z0-9\s-]{3,12}$/.test(trimmed)
}

export default function IPIntakeForm() {
  const navigate   = useNavigate()
  const { state: navState } = useLocation()
  const prefill = navState?.prefill || {}
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
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
    primaryFirstName: '', primaryLastName: '', primaryDob: '', email: '', phone: '', phoneCountry: '+1',
    primaryUsCitizen: null, primaryCitizenshipCountry: '',
    primaryCriminalHistory: null, primaryCriminalHistoryDetails: '',
    country: 'United States', street: '', street2: '', city: '', stateProv: '', zipCode: '',
    hasPartner: null,
    ip2FirstName: '', ip2LastName: '', ip2Dob: '', ip2Email: '', ip2Phone: '', ip2PhoneCountry: '+1',
    ip2UsCitizen: null, ip2CitizenshipCountry: '',
    ip2CriminalHistory: null, ip2CriminalHistoryDetails: '',
    hasRE: null, reDoctorName: '', reClinicName: '',
    hasFrozenEmbryos: null, frozenEmbryoDetails: '',
    usingEggDonor: null, usingSpermDonor: null,
    wantsConsultation: null, hearAboutUs: '',
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
  const isCouple = form.hasPartner === true
  const primaryEmailValid = isValidEmail(form.email)
  const primaryPhoneValid = isValidInternationalPhone(form.phone)
  const postalValid = isValidPostalCode(form.country, form.zipCode)
  const partnerEmailValid = !isCouple || isValidEmail(form.ip2Email)
  const partnerPhoneValid = !isCouple || isValidInternationalPhone(form.ip2Phone)

  const primaryCitizenshipValid = form.primaryUsCitizen === true || (form.primaryUsCitizen === false && form.primaryCitizenshipCountry.trim())
  const primaryCriminalValid = form.primaryCriminalHistory === false || (form.primaryCriminalHistory === true && form.primaryCriminalHistoryDetails.trim())
  const partnerCitizenshipValid = !isCouple || form.ip2UsCitizen === true || (form.ip2UsCitizen === false && form.ip2CitizenshipCountry.trim())
  const partnerCriminalValid = !isCouple || form.ip2CriminalHistory === false || (form.ip2CriminalHistory === true && form.ip2CriminalHistoryDetails.trim())
  const step1Valid = form.primaryFirstName && form.primaryLastName && form.primaryDob && form.email && form.phone && primaryEmailValid && primaryPhoneValid
    && form.primaryUsCitizen !== null && primaryCitizenshipValid
  const step2Valid = form.street && form.city && form.stateProv && form.zipCode && postalValid
  const step3Valid = form.hasPartner !== null && (
    !isCouple || (form.ip2FirstName && form.ip2LastName && form.ip2Dob && form.ip2Email && form.ip2Phone && partnerEmailValid && partnerPhoneValid
      && form.ip2UsCitizen !== null && partnerCitizenshipValid)
  )
  const step4Valid = form.hasRE !== null && (form.hasRE !== true || (form.reDoctorName.trim() && form.reClinicName.trim())) && form.hasFrozenEmbryos !== null && form.usingEggDonor !== null && form.usingSpermDonor !== null
    && form.primaryCriminalHistory !== null && primaryCriminalValid
    && (!isCouple || (form.ip2CriminalHistory !== null && partnerCriminalValid))
  const step5Valid = form.wantsConsultation !== null && form.hearAboutUs.trim().length > 0
  const stepValid  = [null, step1Valid, step2Valid, step3Valid, step4Valid, step5Valid]
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
    const botCheck = validateSubmission()
    if (!botCheck.ok) {
      navigate('/apply/confirmation', {
        state: { qualified: false, dqReasons: [], type: 'ip', name: form.primaryFirstName, email: form.email, tracking: {}, answers: form },
      })
      return
    }

    const dqReasons = [] // IPs don't disqualify
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
        intake_type: 'ip',
        qualified,
        status: qualified ? 'qualified' : 'disqualified',
        dq_reasons: dqReasons,
        applicant_name: `${form.primaryFirstName} ${form.primaryLastName}`.trim(),
        applicant_email: form.email.trim(),
        applicant_phone: `${form.phoneCountry} ${form.phone}`.trim(),
        country: form.country || null,
        state_region: form.stateProv || null,
        city: form.city || null,
        zip_postal_code: form.zipCode || null,
        answers: form,
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
        navigate('/apply/confirmation', {
          state: { qualified: false, dqReasons: [], type: 'ip', name: form.primaryFirstName, email: form.email, tracking: {}, answers: form },
        })
        return
      }
    } catch {
      // Keep applicant flow moving even if persistence fails
    }
    // Send welcome email to IP(s)
    fetch('/api/ip-welcome-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: form.email.trim(),
        firstName: form.primaryFirstName.trim(),
        partnerEmail: form.ip2Email?.trim() || null,
        partnerFirstName: form.ip2FirstName?.trim() || null,
      }),
    }).catch(() => {})

    // Notify admin of new IP application (send all answers)
    fetch('/api/notify-ip-application', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        answers: form,
      }),
    }).catch(() => {})

    navigate('/apply/confirmation', {
      state: { qualified, dqReasons, type: 'ip', name: form.primaryFirstName, email: form.email, tracking, answers: form },
    })
  }

  const MILESTONES = [null, null, null, 'Halfway there!', 'Almost done!', 'Last step!']
  const shell = (s) => ({
    step: s, totalSteps: 5, accentColor: IP_COLOR, accentFg: IP_FG,
    milestone: MILESTONES[s], nextDisabled: !stepValid[s] || (s === 1 && checking),
    onBack: s === 1 ? undefined : () => setStep(s - 1),
    onNext: s === 5 ? handleSubmit : s === 1 ? handleStep1Next : () => setStep(s + 1),
    nextLabel: s === 1 && checking ? 'Checking...' : s === 5 ? 'Submit application' : 'Continue',
  })

  // Step 1 — Primary applicant
  if (step === 1) return (
    <QuizShell {...shell(1)} title="Tell us about yourself" subtitle="A few quick details to get started.">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-stone-500 uppercase tracking-wide font-semibold">First name</Label>
          <Input value={form.primaryFirstName} onChange={e => set('primaryFirstName', e.target.value)} placeholder="First name" className="rounded-xl h-11" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-stone-500 uppercase tracking-wide font-semibold">Last name</Label>
          <Input value={form.primaryLastName} onChange={e => set('primaryLastName', e.target.value)} placeholder="Last name" className="rounded-xl h-11" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-stone-500 uppercase tracking-wide font-semibold">Date of birth</Label>
        <Input type="date" value={form.primaryDob} onChange={e => set('primaryDob', e.target.value)} max="2010-12-31" min="1940-01-01" className="rounded-xl h-11" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-stone-500 uppercase tracking-wide font-semibold">Email</Label>
        <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="you@example.com" className="rounded-xl h-11" />
        {form.email && !primaryEmailValid && (
          <p className="text-xs text-red-500">Enter a valid email address</p>
        )}
        {emailError && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-1">
            {emailError}{' '}
            <a href="/login" className="text-[#283693] underline font-medium">Log in here</a>
          </div>
        )}
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-stone-500 uppercase tracking-wide font-semibold">Best number to reach you</Label>
        <PhoneWithCountryCode
          value={form.phone}
          onChange={v => set('phone', v)}
          countryCode={form.phoneCountry}
          onCountryChange={v => set('phoneCountry', v)}
        />
        {form.phone && !primaryPhoneValid && (
          <p className="text-xs text-red-500">Enter a valid phone number</p>
        )}
      </div>
      <div className="space-y-1.5 pt-2">
        <Label className="text-xs text-stone-500 uppercase tracking-wide font-semibold">Are you a U.S. Citizen?</Label>
        <YesNoGrid value={form.primaryUsCitizen} onChange={v => set('primaryUsCitizen', v)} yesLabel="Yes" noLabel="No" accentColor={IP_COLOR} accentFg={IP_FG} />
        {form.primaryUsCitizen === false && (
          <div className="pt-2">
            <Label className="text-xs text-stone-500 uppercase tracking-wide font-semibold">What is your country of citizenship?</Label>
            <Input value={form.primaryCitizenshipCountry} onChange={e => set('primaryCitizenshipCountry', e.target.value)} placeholder="e.g. Canada" className="rounded-xl h-11 mt-1.5" />
          </div>
        )}
      </div>
      <p className="text-xs text-stone-400 pt-1">We will only reach out to share your results. No spam, ever.</p>
    </QuizShell>
  )

  // Step 2 — Address
  if (step === 2) return (
    <QuizShell {...shell(2)} title="Where are you located?" subtitle="This helps us understand your situation and any state-specific considerations.">
      <div className="space-y-1.5">
        <Label className="text-xs text-stone-500 uppercase tracking-wide font-semibold">Country</Label>
        <Select value={form.country} onValueChange={v => set('country', v)}>
          <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Select country" /></SelectTrigger>
          <SelectContent>{COUNTRIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-stone-500 uppercase tracking-wide font-semibold">Street address</Label>
        <Input value={form.street} onChange={e => set('street', e.target.value)} placeholder="123 Main St" className="rounded-xl h-11" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-stone-500 uppercase tracking-wide font-semibold">
          Address line 2 <span className="normal-case font-normal text-stone-400">(optional)</span>
        </Label>
        <Input value={form.street2} onChange={e => set('street2', e.target.value)} placeholder="Apt, suite, unit…" className="rounded-xl h-11" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-stone-500 uppercase tracking-wide font-semibold">City</Label>
        <Input value={form.city} onChange={e => set('city', e.target.value)} placeholder="New York" className="rounded-xl h-11" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-stone-500 uppercase tracking-wide font-semibold">State / Province</Label>
          {form.country === 'United States' ? (
            <Select value={form.stateProv} onValueChange={v => set('stateProv', v)}>
              <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="State" /></SelectTrigger>
              <SelectContent>{US_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          ) : (
            <Input value={form.stateProv} onChange={e => set('stateProv', e.target.value)} placeholder="State / Province" className="rounded-xl h-11" />
          )}
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-stone-500 uppercase tracking-wide font-semibold">Zip / Postal code</Label>
          <Input value={form.zipCode} onChange={e => set('zipCode', e.target.value)} placeholder="10001" className="rounded-xl h-11" />
          {form.zipCode && !postalValid && (
            <p className="text-xs text-red-500">
              {form.country === 'United States' ? 'Enter a valid US ZIP code (e.g., 10001 or 10001-1234)' : 'Enter a valid postal code'}
            </p>
          )}
        </div>
      </div>
    </QuizShell>
  )

  // Step 3 — Partner info
  if (step === 3) return (
    <QuizShell {...shell(3)} title="Your partner" subtitle="Let us know if you're going through this journey together." milestone="Halfway there!">
      <div>
        <p className="text-sm font-medium text-stone-800 mb-2">Are you going through this journey with a partner?</p>
        <YesNoGrid value={form.hasPartner} onChange={v => set('hasPartner', v)} yesLabel="Yes" noLabel="No" accentColor={IP_COLOR} accentFg={IP_FG} />
      </div>
      {isCouple && (
        <>
          <div className="border-t border-stone-200 pt-4 mt-2" />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-stone-500 uppercase tracking-wide font-semibold">Partner first name</Label>
              <Input value={form.ip2FirstName} onChange={e => set('ip2FirstName', e.target.value)} placeholder="First name" className="rounded-xl h-11" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-stone-500 uppercase tracking-wide font-semibold">Partner last name</Label>
              <Input value={form.ip2LastName} onChange={e => set('ip2LastName', e.target.value)} placeholder="Last name" className="rounded-xl h-11" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-stone-500 uppercase tracking-wide font-semibold">Partner date of birth</Label>
            <Input type="date" value={form.ip2Dob} onChange={e => set('ip2Dob', e.target.value)} max="2010-12-31" min="1940-01-01" className="rounded-xl h-11" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-stone-500 uppercase tracking-wide font-semibold">Partner email</Label>
            <Input type="email" value={form.ip2Email} onChange={e => set('ip2Email', e.target.value)} placeholder="partner@example.com" className="rounded-xl h-11" />
            {form.ip2Email && !partnerEmailValid && (
              <p className="text-xs text-red-500">Enter a valid email address</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-stone-500 uppercase tracking-wide font-semibold">Best number to reach partner</Label>
            <PhoneWithCountryCode
              value={form.ip2Phone}
              onChange={v => set('ip2Phone', v)}
              countryCode={form.ip2PhoneCountry}
              onCountryChange={v => set('ip2PhoneCountry', v)}
            />
            {form.ip2Phone && !partnerPhoneValid && (
              <p className="text-xs text-red-500">Enter a valid phone number</p>
            )}
          </div>
          <div className="space-y-1.5 pt-2">
            <Label className="text-xs text-stone-500 uppercase tracking-wide font-semibold">Is your spouse/partner a U.S. Citizen?</Label>
            <YesNoGrid value={form.ip2UsCitizen} onChange={v => set('ip2UsCitizen', v)} yesLabel="Yes" noLabel="No" accentColor={IP_COLOR} accentFg={IP_FG} />
            {form.ip2UsCitizen === false && (
              <div className="pt-2">
                <Label className="text-xs text-stone-500 uppercase tracking-wide font-semibold">Country of citizenship</Label>
                <Input value={form.ip2CitizenshipCountry} onChange={e => set('ip2CitizenshipCountry', e.target.value)} placeholder="e.g. Canada" className="rounded-xl h-11 mt-1.5" />
              </div>
            )}
          </div>
        </>
      )}
      {form.hasPartner === false && (
        <div className="rounded-xl p-5 text-center" style={{ backgroundColor: '#f0f1fa' }}>
          <p className="text-sm text-stone-600">No partner information needed. Tap <strong>Continue</strong> to proceed.</p>
        </div>
      )}
    </QuizShell>
  )

  // Step 4 — Fertility details
  if (step === 4) return (
    <QuizShell {...shell(4)} title="Additional information" subtitle="A few questions to help us understand where you are in the process." milestone="Almost done!">
      <div>
        <p className="text-sm font-medium text-stone-800 mb-2">Do you have a Reproductive Endocrinologist (Fertility Doctor)?</p>
        <YesNoGrid value={form.hasRE} onChange={v => set('hasRE', v)} yesLabel="Yes" noLabel="Not yet" accentColor={IP_COLOR} accentFg={IP_FG} />
      </div>
      {form.hasRE === true && (
        <>
        <div className="space-y-1.5">
          <Label className="text-xs text-stone-500 uppercase tracking-wide font-semibold">What is your doctor's name? *</Label>
          <Input value={form.reDoctorName} onChange={e => set('reDoctorName', e.target.value)} placeholder="Dr. Smith" className="rounded-xl h-11" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-stone-500 uppercase tracking-wide font-semibold">Clinic Name *</Label>
          <Input value={form.reClinicName} onChange={e => set('reClinicName', e.target.value)} placeholder="e.g. Pacific Fertility Center" className="rounded-xl h-11" />
        </div>
        </>
      )}
      <div>
        <p className="text-sm font-medium text-stone-800 mb-2">Do you have frozen embryos?</p>
        <YesNoGrid value={form.hasFrozenEmbryos} onChange={v => set('hasFrozenEmbryos', v)} yesLabel="Yes" noLabel="No" accentColor={IP_COLOR} accentFg={IP_FG} />
      </div>
      {form.hasFrozenEmbryos === true && (
        <div className="space-y-1.5">
          <Label className="text-xs text-stone-500 uppercase tracking-wide font-semibold">How many frozen embryos do you have?</Label>
          <Input value={form.frozenEmbryoDetails} onChange={e => set('frozenEmbryoDetails', e.target.value)} placeholder="e.g., 3 embryos" className="rounded-xl h-11" />
        </div>
      )}
      <div>
        <p className="text-sm font-medium text-stone-800 mb-2">Are you using an egg donor?</p>
        <YesNoGrid value={form.usingEggDonor} onChange={v => set('usingEggDonor', v)} yesLabel="Yes" noLabel="No" accentColor={IP_COLOR} accentFg={IP_FG} />
      </div>
      <div>
        <p className="text-sm font-medium text-stone-800 mb-2">Are you using a sperm donor?</p>
        <YesNoGrid value={form.usingSpermDonor} onChange={v => set('usingSpermDonor', v)} yesLabel="Yes" noLabel="No" accentColor={IP_COLOR} accentFg={IP_FG} />
      </div>
      <div className="border-t border-stone-200 pt-4 mt-2" />
      <div>
        <p className="text-sm font-medium text-stone-800 mb-2">Have you ever been arrested or convicted of a crime?</p>
        <YesNoGrid value={form.primaryCriminalHistory} onChange={v => set('primaryCriminalHistory', v)} yesLabel="Yes" noLabel="No" accentColor={IP_COLOR} accentFg={IP_FG} />
        {form.primaryCriminalHistory === true && (
          <div className="space-y-1.5 pt-3">
            <p className="text-sm font-medium text-stone-800">Please describe</p>
            <textarea value={form.primaryCriminalHistoryDetails} onChange={e => set('primaryCriminalHistoryDetails', e.target.value)} rows={3} className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm" />
          </div>
        )}
      </div>
      {isCouple && (
        <div>
          <p className="text-sm font-medium text-stone-800 mb-2">Has your spouse/partner ever been arrested or convicted of a crime?</p>
          <YesNoGrid value={form.ip2CriminalHistory} onChange={v => set('ip2CriminalHistory', v)} yesLabel="Yes" noLabel="No" accentColor={IP_COLOR} accentFg={IP_FG} />
          {form.ip2CriminalHistory === true && (
            <div className="space-y-1.5 pt-3">
              <p className="text-sm font-medium text-stone-800">Please describe</p>
              <textarea value={form.ip2CriminalHistoryDetails} onChange={e => set('ip2CriminalHistoryDetails', e.target.value)} rows={3} className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm" />
            </div>
          )}
        </div>
      )}
    </QuizShell>
  )

  // Step 5 — Final
  if (step === 5) return (
    <QuizShell {...shell(5)} title="Almost there!" subtitle="Just a couple more things and you're done." milestone="Last step!">
      <div>
        <p className="text-sm font-medium text-stone-800 mb-2">Would you like to schedule a consultation?</p>
        <YesNoGrid value={form.wantsConsultation} onChange={v => set('wantsConsultation', v)} yesLabel="Yes, please" noLabel="Not right now" accentColor={IP_COLOR} accentFg={IP_FG} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-stone-500 uppercase tracking-wide font-semibold">How did you hear about Abundant Beginnings Co.?</Label>
        <Textarea
          value={form.hearAboutUs}
          onChange={e => set('hearAboutUs', e.target.value)}
          placeholder="e.g., Friend, Google, my clinic, Instagram..."
          className="rounded-xl min-h-[80px] resize-none"
        />
      </div>
      <TurnstileWidget onToken={setTurnstileToken} />
      <HoneypotField value={honeypotValue} onChange={setHoneypotValue} />
    </QuizShell>
  )

  return null
}
