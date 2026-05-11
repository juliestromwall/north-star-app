import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { checkEmailExists } from '@/lib/db'
import { useBotProtection, HoneypotField, TurnstileWidget } from '@/lib/botProtection.jsx'
import { QuizShell, YesNoGrid, NumberStepper } from './QuizShell'
import { useIframeHeightReporter, scrollParentToIframeTop } from '@/lib/embed'

const ACCENT = '#D4A853'        // Gold — accent / yes-no selected
const ACCENT_FG = '#1A3638'      // Dark Teal — text on accent
const PRIMARY_CTA = '#1F3A3C'   // Emerald — used in QuizShell gradient

const US_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY']

function calculateBMI(ft, inches, lbs) {
  const totalIn = (parseInt(ft) || 0) * 12 + (parseInt(inches) || 0)
  if (!totalIn || !lbs) return null
  return ((parseFloat(lbs) / (totalIn * totalIn)) * 703).toFixed(1)
}
function isValidEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((v || '').trim()) }
function isValidUSPhone(v) {
  const d = (v || '').replace(/\D/g, '')
  return d.length === 10 || (d.length === 11 && d.startsWith('1'))
}
function formatUSPhone(raw) {
  const d = (raw || '').replace(/\D/g, '').slice(0, 10)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}-${d.slice(3)}`
  return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`
}

const TOTAL_STEPS = 5

export default function SurrogateIntakeForm() {
  const navigate = useNavigate()
  const { state: navState } = useLocation()
  const prefill = navState?.prefill || {}
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const startTimeRef = useRef(Date.now())
  useIframeHeightReporter()
  useEffect(() => { window.scrollTo(0, 0); scrollParentToIframeTop() }, [step])

  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phone: '',
    street: '', street2: '', city: '', state: '', zip: '',
    usCitizen: null, permanentResident: null,
    dob: '',
    heightFt: '', heightIn: '', weightLbs: '',
    hasSpouseOrPartner: null,
    numPregnancies: '', numChildren: '', lastDeliveryDate: '',
    allHealthy: null, numCsections: '',
    takesPrescriptions: null, prescriptionList: '',
    hasInsurance: null, publicAssistance: null,
    previousSurrogate: null,
    levelInterestTimeline: '',
    hearAbout: '',
    ...prefill,
  })

  const { honeypotValue, setHoneypotValue, trackFieldChange, validateSubmission, setTurnstileToken, getBotCheckPayload } = useBotProtection(startTimeRef)
  const set = (field, value) => { trackFieldChange(); setForm(prev => ({ ...prev, [field]: value })) }

  const bmi = calculateBMI(form.heightFt, form.heightIn, form.weightLbs)
  const emailValid = isValidEmail(form.email)
  const phoneValid = isValidUSPhone(form.phone)

  const step1Valid = form.firstName && form.lastName && emailValid && phoneValid && form.street && form.city && form.state && /^\d{5}$/.test(form.zip) && form.usCitizen !== null && (form.usCitizen === true || form.permanentResident !== null)
  const step2Valid = form.dob && form.heightFt && form.heightIn && form.weightLbs && form.hasSpouseOrPartner !== null
  const step3Valid = form.numPregnancies !== '' && form.numChildren !== '' && form.lastDeliveryDate && form.allHealthy !== null && form.numCsections !== '' && form.previousSurrogate !== null
  const step4Valid = form.takesPrescriptions !== null && (form.takesPrescriptions === false || form.prescriptionList.trim()) && form.hasInsurance !== null && form.publicAssistance !== null
  const step5Valid = form.levelInterestTimeline.trim() && form.hearAbout.trim()

  const stepValid = [null, step1Valid, step2Valid, step3Valid, step4Valid, step5Valid]
  const [emailError, setEmailError] = useState(null)
  const [checkingEmail, setCheckingEmail] = useState(false)

  async function handleStep1Next() {
    setCheckingEmail(true); setEmailError(null)
    try {
      const exists = await checkEmailExists(form.email)
      if (exists) {
        setEmailError('We already have an application from this email. Please reach out to us if you need help with your existing application.')
        setCheckingEmail(false); return
      }
    } catch {}
    setCheckingEmail(false); setStep(2)
  }

  // Compute disqualifications silently (admin sees them; applicant does not get bounced)
  function computeDqReasons() {
    const reasons = []
    if (form.usCitizen === false && form.permanentResident === false) reasons.push('not_us_citizen_or_pr')
    const bmiNum = parseFloat(bmi)
    if (!isNaN(bmiNum) && (bmiNum < 20 || bmiNum > 35)) reasons.push(`bmi_out_of_range:${bmi}`)
    const preg = parseInt(form.numPregnancies)
    if (!isNaN(preg) && preg === 0) reasons.push('no_prior_pregnancies')
    const kids = parseInt(form.numChildren)
    if (!isNaN(kids) && (kids < 1 || kids > 6)) reasons.push(`num_children_out_of_range:${kids}`)
    if (form.publicAssistance === true) reasons.push('public_assistance')
    return reasons
  }

  async function handleSubmit() {
    setSubmitting(true); setSubmitError(null)
    const bot = getBotCheckPayload()
    if (!validateSubmission()) {
      setSubmitting(false); setSubmitError('Please complete the security verification.'); return
    }
    const tracking = (() => { try { return JSON.parse(sessionStorage.getItem('intakeTrackingData') || '{}') } catch { return {} } })()
    const dq_reasons = computeDqReasons()
    const submission = {
      intake_type: 'gc',
      applicant_email: form.email.trim().toLowerCase(),
      applicant_name: `${form.firstName} ${form.lastName}`.trim(),
      applicant_phone: form.phone,
      country: 'United States',
      state_region: form.state,
      city: form.city,
      zip_postal_code: form.zip,
      qualified: dq_reasons.length === 0,
      dq_reasons,
      answers: {
        ...form,
        bmi,
        _tracking: tracking,
      },
    }
    try {
      const res = await fetch('/api/intake-submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submission, bot }),
      })
      const data = await res.json()
      if (!data.ok) { setSubmitError(data.error || 'Submission failed. Please try again.'); setSubmitting(false); return }
      if (data.accepted === false) {
        // Bot/duplicate rejection — still navigate to confirmation so user doesn't see error
      }
      navigate('/getstarted/confirmation', { state: { intakeType: 'gc', firstName: form.firstName, qualified: submission.qualified } })
    } catch (err) {
      setSubmitError(err.message || 'Submission failed.'); setSubmitting(false)
    }
  }

  // ─────────── Step renderers ───────────
  if (step === 1) {
    return (
      <QuizShell
        step={1} totalSteps={TOTAL_STEPS}
        title="Tell us about you"
        subtitle="We'd love to get to know you. This will take about 5 minutes."
        onNext={handleStep1Next}
        nextLabel={checkingEmail ? 'Checking…' : 'Continue'}
        nextDisabled={!step1Valid || checkingEmail}
        accentColor={ACCENT} accentFg={ACCENT_FG}
      >
        <HoneypotField value={honeypotValue} onChange={setHoneypotValue} />
        <div className="grid grid-cols-2 gap-3">
          <FieldText label="First Name" value={form.firstName} onChange={v => set('firstName', v)} />
          <FieldText label="Last Name" value={form.lastName} onChange={v => set('lastName', v)} />
        </div>
        <FieldText label="Email" type="email" value={form.email} onChange={v => set('email', v)} error={emailError} />
        <FieldText label="Phone" type="tel" value={form.phone} onChange={v => set('phone', formatUSPhone(v))} placeholder="555-555-5555" />
        <FieldText label="Street Address" value={form.street} onChange={v => set('street', v)} />
        <FieldText label="Street Address Line 2 (optional)" value={form.street2} onChange={v => set('street2', v)} />
        <div className="grid grid-cols-2 gap-3">
          <FieldText label="City" value={form.city} onChange={v => set('city', v)} />
          <FieldSelect label="State" value={form.state} onChange={v => set('state', v)} options={US_STATES} />
        </div>
        <FieldText label="ZIP Code" value={form.zip} onChange={v => set('zip', v.replace(/\D/g, '').slice(0, 5))} placeholder="12345" />

        <div className="pt-2">
          <Label className="text-sm font-medium text-stone-800">Are you a U.S. citizen?</Label>
          <div className="mt-2"><YesNoGrid value={form.usCitizen} onChange={v => set('usCitizen', v)} accentColor={ACCENT} accentFg={ACCENT_FG} /></div>
        </div>
        {form.usCitizen === false && (
          <div className="pt-2">
            <Label className="text-sm font-medium text-stone-800">Are you a permanent resident?</Label>
            <div className="mt-2"><YesNoGrid value={form.permanentResident} onChange={v => set('permanentResident', v)} accentColor={ACCENT} accentFg={ACCENT_FG} /></div>
          </div>
        )}
      </QuizShell>
    )
  }

  if (step === 2) {
    return (
      <QuizShell
        step={2} totalSteps={TOTAL_STEPS}
        title="A few quick details"
        subtitle="Date of birth, height, weight — the basics."
        onBack={() => setStep(1)} onNext={() => setStep(3)} nextDisabled={!step2Valid}
        accentColor={ACCENT} accentFg={ACCENT_FG}
      >
        <FieldText label="Date of Birth" type="date" value={form.dob} onChange={v => set('dob', v)} />
        <div className="grid grid-cols-3 gap-3">
          <FieldText label="Height (ft)" type="number" value={form.heightFt} onChange={v => set('heightFt', v)} />
          <FieldText label="Height (in)" type="number" value={form.heightIn} onChange={v => set('heightIn', v)} />
          <FieldText label="Weight (lbs)" type="number" value={form.weightLbs} onChange={v => set('weightLbs', v)} />
        </div>
        {bmi && (
          <p className="text-xs text-stone-500">Your BMI is approximately <strong className="text-stone-700">{bmi}</strong>.</p>
        )}
        <div className="pt-2">
          <Label className="text-sm font-medium text-stone-800">Do you have a spouse or partner?</Label>
          <div className="mt-2"><YesNoGrid value={form.hasSpouseOrPartner} onChange={v => set('hasSpouseOrPartner', v)} accentColor={ACCENT} accentFg={ACCENT_FG} /></div>
        </div>
      </QuizShell>
    )
  }

  if (step === 3) {
    return (
      <QuizShell
        step={3} totalSteps={TOTAL_STEPS}
        title="Your pregnancy history"
        subtitle="Be as accurate as you can — we'll go over everything together later."
        onBack={() => setStep(2)} onNext={() => setStep(4)} nextDisabled={!step3Valid}
        accentColor={ACCENT} accentFg={ACCENT_FG}
      >
        <NumberStepperField label="How many pregnancies have you had?" note="Include all deliveries, miscarriages, and terminations." value={form.numPregnancies} onChange={v => set('numPregnancies', v)} min={0} max={10} />
        <NumberStepperField label="How many children have you given birth to?" value={form.numChildren} onChange={v => set('numChildren', v)} min={0} max={10} />
        <FieldText label="Most recent pregnancy delivery date" type="date" value={form.lastDeliveryDate} onChange={v => set('lastDeliveryDate', v)} />
        <div className="pt-2">
          <Label className="text-sm font-medium text-stone-800">Have all your pregnancies been healthy?</Label>
          <div className="mt-2"><YesNoGrid value={form.allHealthy} onChange={v => set('allHealthy', v)} accentColor={ACCENT} accentFg={ACCENT_FG} /></div>
        </div>
        <NumberStepperField label="How many C-sections have you had?" value={form.numCsections} onChange={v => set('numCsections', v)} min={0} max={6} />
        <div className="pt-2">
          <Label className="text-sm font-medium text-stone-800">Have you previously been a surrogate?</Label>
          <div className="mt-2"><YesNoGrid value={form.previousSurrogate} onChange={v => set('previousSurrogate', v)} accentColor={ACCENT} accentFg={ACCENT_FG} /></div>
        </div>
      </QuizShell>
    )
  }

  if (step === 4) {
    return (
      <QuizShell
        step={4} totalSteps={TOTAL_STEPS}
        title="Health & insurance"
        subtitle="A few last questions about your health and coverage."
        onBack={() => setStep(3)} onNext={() => setStep(5)} nextDisabled={!step4Valid}
        accentColor={ACCENT} accentFg={ACCENT_FG}
      >
        <div>
          <Label className="text-sm font-medium text-stone-800">Do you currently take any prescription medications?</Label>
          <div className="mt-2"><YesNoGrid value={form.takesPrescriptions} onChange={v => set('takesPrescriptions', v)} accentColor={ACCENT} accentFg={ACCENT_FG} /></div>
        </div>
        {form.takesPrescriptions === true && (
          <FieldText label="Please list your current prescription medications" value={form.prescriptionList} onChange={v => set('prescriptionList', v)} multiline />
        )}
        <div className="pt-2">
          <Label className="text-sm font-medium text-stone-800">Do you have health insurance?</Label>
          <div className="mt-2"><YesNoGrid value={form.hasInsurance} onChange={v => set('hasInsurance', v)} accentColor={ACCENT} accentFg={ACCENT_FG} /></div>
        </div>
        <div className="pt-2">
          <Label className="text-sm font-medium text-stone-800">Do you receive any type of public assistance or state insurance?</Label>
          <div className="mt-2"><YesNoGrid value={form.publicAssistance} onChange={v => set('publicAssistance', v)} accentColor={ACCENT} accentFg={ACCENT_FG} /></div>
        </div>
      </QuizShell>
    )
  }

  // Step 5 — final
  return (
    <QuizShell
      step={5} totalSteps={TOTAL_STEPS}
      title="Almost there"
      subtitle="One last thing before you submit."
      milestone="🎉 Final step"
      onBack={() => setStep(4)} onNext={handleSubmit}
      nextLabel={submitting ? 'Submitting…' : 'Submit my application'}
      nextDisabled={!step5Valid || submitting}
      accentColor={ACCENT} accentFg={ACCENT_FG}
    >
      <FieldText
        label="What is your level of interest and what is your timeline for starting this process?"
        value={form.levelInterestTimeline} onChange={v => set('levelInterestTimeline', v)}
        multiline placeholder="Tell us a bit about where you're at and when you'd like to get started…"
      />
      <FieldText
        label="How did you hear about us?"
        value={form.hearAbout} onChange={v => set('hearAbout', v)}
        placeholder="Friend, Instagram, Google search, etc."
      />
      <TurnstileWidget onVerify={setTurnstileToken} />
      {submitError && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{submitError}</p>}
    </QuizShell>
  )
}

// ─── Helpers ───
function FieldText({ label, value, onChange, type = 'text', placeholder, error, multiline }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-stone-600 uppercase tracking-wide">{label}</Label>
      {multiline ? (
        <textarea
          value={value} onChange={e => onChange(e.target.value)} rows={3} placeholder={placeholder}
          className="w-full text-sm border border-stone-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:border-[#1F3A3C] focus:ring-1 focus:ring-[#1F3A3C]/30"
        />
      ) : (
        <Input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="h-11 rounded-xl" />
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
function FieldSelect({ label, value, onChange, options }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-stone-600 uppercase tracking-wide">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Select…" /></SelectTrigger>
        <SelectContent>{options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  )
}
function NumberStepperField({ label, note, value, onChange, min, max }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white px-4 py-3.5">
      <NumberStepper label={label} note={note} value={value} onChange={onChange} min={min} max={max} />
    </div>
  )
}
