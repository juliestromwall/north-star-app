import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { checkEmailExists } from '@/lib/db'
import { useBotProtection, HoneypotField, TurnstileWidget } from '@/lib/botProtection.jsx'
import { QuizShell, YesNoGrid } from './QuizShell'
import { useIframeHeightReporter, scrollParentToIframeTop } from '@/lib/embed'

const ACCENT = '#D4A853'
const ACCENT_FG = '#1A3638'

const US_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY']

// Country list with dial codes. US first (default), then a few common
// English-speaking markets, then alphabetical. Add to this list if North
// Star starts working with families from countries not yet listed.
const COUNTRIES = [
  { name: 'United States of America', dial: '+1' },
  { name: 'Canada',                   dial: '+1' },
  { name: 'United Kingdom',           dial: '+44' },
  { name: 'Australia',                dial: '+61' },
  { name: 'Argentina',                dial: '+54' },
  { name: 'Austria',                  dial: '+43' },
  { name: 'Belgium',                  dial: '+32' },
  { name: 'Brazil',                   dial: '+55' },
  { name: 'Chile',                    dial: '+56' },
  { name: 'China',                    dial: '+86' },
  { name: 'Colombia',                 dial: '+57' },
  { name: 'Costa Rica',               dial: '+506' },
  { name: 'Czech Republic',           dial: '+420' },
  { name: 'Denmark',                  dial: '+45' },
  { name: 'Egypt',                    dial: '+20' },
  { name: 'Finland',                  dial: '+358' },
  { name: 'France',                   dial: '+33' },
  { name: 'Germany',                  dial: '+49' },
  { name: 'Greece',                   dial: '+30' },
  { name: 'Hong Kong',                dial: '+852' },
  { name: 'India',                    dial: '+91' },
  { name: 'Indonesia',                dial: '+62' },
  { name: 'Ireland',                  dial: '+353' },
  { name: 'Israel',                   dial: '+972' },
  { name: 'Italy',                    dial: '+39' },
  { name: 'Japan',                    dial: '+81' },
  { name: 'Jordan',                   dial: '+962' },
  { name: 'Kenya',                    dial: '+254' },
  { name: 'Kuwait',                   dial: '+965' },
  { name: 'Lebanon',                  dial: '+961' },
  { name: 'Malaysia',                 dial: '+60' },
  { name: 'Mexico',                   dial: '+52' },
  { name: 'Netherlands',              dial: '+31' },
  { name: 'New Zealand',              dial: '+64' },
  { name: 'Nigeria',                  dial: '+234' },
  { name: 'Norway',                   dial: '+47' },
  { name: 'Oman',                     dial: '+968' },
  { name: 'Pakistan',                 dial: '+92' },
  { name: 'Panama',                   dial: '+507' },
  { name: 'Peru',                     dial: '+51' },
  { name: 'Philippines',              dial: '+63' },
  { name: 'Poland',                   dial: '+48' },
  { name: 'Portugal',                 dial: '+351' },
  { name: 'Qatar',                    dial: '+974' },
  { name: 'Romania',                  dial: '+40' },
  { name: 'Russia',                   dial: '+7' },
  { name: 'Saudi Arabia',             dial: '+966' },
  { name: 'Singapore',                dial: '+65' },
  { name: 'South Africa',             dial: '+27' },
  { name: 'South Korea',              dial: '+82' },
  { name: 'Spain',                    dial: '+34' },
  { name: 'Sweden',                   dial: '+46' },
  { name: 'Switzerland',              dial: '+41' },
  { name: 'Taiwan',                   dial: '+886' },
  { name: 'Thailand',                 dial: '+66' },
  { name: 'Turkey',                   dial: '+90' },
  { name: 'United Arab Emirates',     dial: '+971' },
  { name: 'Vietnam',                  dial: '+84' },
]

const RELATIONSHIP_OPTIONS = ['Single', 'Married', 'Domestic Partnership', 'In a Relationship', 'Other']
const STAGE_OPTIONS = [
  'Just starting to explore — gathering information',
  'Have decided to pursue surrogacy, choosing an agency',
  'Working with a clinic / preparing embryos',
  'Have embryos, ready to match with a surrogate',
  'Currently matched with a surrogate',
]

function isValidEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((v || '').trim()) }
function isPartnered(rel) { return rel === 'Married' || rel === 'Domestic Partnership' }

const TOTAL_STEPS = 4

export default function IPIntakeForm() {
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
    firstName: '', lastName: '', email: '',
    country: 'United States of America',
    city: '', state: '', stateRegion: '',
    phone: '+1 ',
    occupation: '',
    relationshipStatus: '',
    spouseFirstName: '', spouseLastName: '', spouseEmail: '', spouseOccupation: '',
    aboutYourselfFamily: '',
    whatLedYou: '',
    journeyStage: '',
    workingWithClinic: null,
    hasEmbryos: null, embryoCount: '',
    timeline: '',
    questionsConcerns: '',
    anythingElse: '',
    ...prefill,
  })

  const { honeypotValue, setHoneypotValue, trackFieldChange, validateSubmission, setTurnstileToken, getBotCheckPayload } = useBotProtection(startTimeRef)
  const set = (field, value) => { trackFieldChange(); setForm(prev => ({ ...prev, [field]: value })) }

  const emailValid = isValidEmail(form.email)
  const partnered = isPartnered(form.relationshipStatus)
  const spouseEmailValid = !partnered || isValidEmail(form.spouseEmail)
  const isUS = form.country === 'United States of America'

  // When country changes, swap the phone's dial-code prefix to that country's
  // code. Preserves anything the user already typed after the previous prefix.
  function handleCountryChange(countryName) {
    const country = COUNTRIES.find(c => c.name === countryName)
    if (!country) { set('country', countryName); return }
    trackFieldChange()
    setForm(prev => {
      // Strip the previous dial code prefix from the phone, keep the rest
      let phoneTail = (prev.phone || '').trim()
      const prevMatch = phoneTail.match(/^\+\d+\s*/)
      if (prevMatch) phoneTail = phoneTail.slice(prevMatch[0].length)
      return { ...prev, country: countryName, phone: `${country.dial} ${phoneTail}`.trim() + (phoneTail ? '' : ' ') }
    })
  }

  const step1Valid = form.firstName && form.lastName && emailValid && form.country && form.city && (isUS ? form.state : form.stateRegion.trim()) && form.phone.trim().replace(/\D/g, '').length >= 7 && form.occupation.trim()
  const step2Valid = form.relationshipStatus && (!partnered || (form.spouseFirstName && form.spouseLastName && spouseEmailValid && form.spouseOccupation.trim()))
  const step3Valid = form.aboutYourselfFamily.trim() && form.whatLedYou.trim() && form.journeyStage && form.workingWithClinic !== null && form.hasEmbryos !== null && (form.hasEmbryos === false || form.embryoCount.trim()) && form.timeline.trim()
  const step4Valid = form.questionsConcerns.trim() && form.anythingElse.trim()

  const [emailError, setEmailError] = useState(null)
  const [checkingEmail, setCheckingEmail] = useState(false)

  async function handleStep1Next() {
    setCheckingEmail(true); setEmailError(null)
    try {
      const exists = await checkEmailExists(form.email)
      if (exists) {
        setEmailError('We already have an application from this email. Please reach out for help with your existing application.')
        setCheckingEmail(false); return
      }
    } catch {}
    setCheckingEmail(false); setStep(2)
  }

  async function handleSubmit() {
    setSubmitting(true); setSubmitError(null)
    const bot = getBotCheckPayload()
    if (!validateSubmission()) {
      setSubmitting(false); setSubmitError('Please complete the security verification.'); return
    }
    const tracking = (() => { try { return JSON.parse(sessionStorage.getItem('intakeTrackingData') || '{}') } catch { return {} } })()
    const submission = {
      intake_type: 'ip',
      applicant_email: form.email.trim().toLowerCase(),
      applicant_name: `${form.firstName} ${form.lastName}`.trim(),
      applicant_phone: form.phone.trim(),
      city: form.city, state_region: isUS ? form.state : form.stateRegion, country: form.country,
      qualified: true, dq_reasons: [],
      answers: { ...form, _tracking: tracking },
    }
    try {
      const res = await fetch('/api/intake-submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submission, bot }),
      })
      const data = await res.json()
      if (!data.ok) { setSubmitError(data.error || 'Submission failed.'); setSubmitting(false); return }
      navigate('/apply/confirmation', { state: { intakeType: 'ip', firstName: form.firstName, qualified: true } })
    } catch (err) {
      setSubmitError(err.message || 'Submission failed.'); setSubmitting(false)
    }
  }

  if (step === 1) {
    return (
      <QuizShell
        step={1} totalSteps={TOTAL_STEPS}
        title="Let's start with you"
        subtitle="A few details to introduce yourself. This will take about 5 minutes."
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
        <FieldSelect
          label="Country"
          value={form.country}
          onChange={handleCountryChange}
          options={COUNTRIES.map(c => c.name)}
        />
        <div className="grid grid-cols-2 gap-3">
          <FieldText label="City" value={form.city} onChange={v => set('city', v)} />
          {isUS ? (
            <FieldSelect label="State" value={form.state} onChange={v => set('state', v)} options={US_STATES} />
          ) : (
            <FieldText label="State / Region" value={form.stateRegion} onChange={v => set('stateRegion', v)} />
          )}
        </div>
        <FieldText
          label="Phone"
          type="tel"
          value={form.phone}
          onChange={v => set('phone', v)}
          placeholder={`${COUNTRIES.find(c => c.name === form.country)?.dial || ''} 555 555 5555`}
        />
        <FieldText label="Occupation" value={form.occupation} onChange={v => set('occupation', v)} />
      </QuizShell>
    )
  }

  if (step === 2) {
    return (
      <QuizShell
        step={2} totalSteps={TOTAL_STEPS}
        title="Your family"
        subtitle="Are you starting this journey on your own, or with a partner?"
        onBack={() => setStep(1)} onNext={() => setStep(3)} nextDisabled={!step2Valid}
        accentColor={ACCENT} accentFg={ACCENT_FG}
      >
        <FieldSelect label="Relationship Status" value={form.relationshipStatus} onChange={v => set('relationshipStatus', v)} options={RELATIONSHIP_OPTIONS} />
        {partnered && (
          <div className="space-y-3 pt-2 pl-3 border-l-2" style={{ borderColor: '#D4A853' }}>
            <p className="text-xs uppercase tracking-wider font-semibold" style={{ color: '#1F3A3C' }}>About your spouse / partner</p>
            <div className="grid grid-cols-2 gap-3">
              <FieldText label="First Name" value={form.spouseFirstName} onChange={v => set('spouseFirstName', v)} />
              <FieldText label="Last Name" value={form.spouseLastName} onChange={v => set('spouseLastName', v)} />
            </div>
            <FieldText label="Email" type="email" value={form.spouseEmail} onChange={v => set('spouseEmail', v)} />
            <FieldText label="Occupation" value={form.spouseOccupation} onChange={v => set('spouseOccupation', v)} />
          </div>
        )}
      </QuizShell>
    )
  }

  if (step === 3) {
    return (
      <QuizShell
        step={3} totalSteps={TOTAL_STEPS}
        title="Your story"
        subtitle="We'd love to learn a little about your journey so far."
        onBack={() => setStep(2)} onNext={() => setStep(4)} nextDisabled={!step3Valid}
        accentColor={ACCENT} accentFg={ACCENT_FG}
      >
        <FieldText label="Tell us a little about yourself and your family." value={form.aboutYourselfFamily} onChange={v => set('aboutYourselfFamily', v)} multiline />
        <FieldText label="What led you to explore surrogacy?" value={form.whatLedYou} onChange={v => set('whatLedYou', v)} multiline />
        <FieldSelect label="What stage of the journey are you currently in?" value={form.journeyStage} onChange={v => set('journeyStage', v)} options={STAGE_OPTIONS} />
        <div className="pt-1">
          <Label className="text-sm font-medium text-stone-800">Are you currently working with a clinic?</Label>
          <div className="mt-2"><YesNoGrid value={form.workingWithClinic} onChange={v => set('workingWithClinic', v)} accentColor={ACCENT} accentFg={ACCENT_FG} /></div>
        </div>
        <div className="pt-1">
          <Label className="text-sm font-medium text-stone-800">Do you have embryos?</Label>
          <div className="mt-2"><YesNoGrid value={form.hasEmbryos} onChange={v => set('hasEmbryos', v)} accentColor={ACCENT} accentFg={ACCENT_FG} /></div>
        </div>
        {form.hasEmbryos === true && (
          <FieldText label="How many embryos do you have?" value={form.embryoCount} onChange={v => set('embryoCount', v)} placeholder="e.g. 3 PGT-tested" />
        )}
        <FieldText label="What is your timeline for moving forward?" value={form.timeline} onChange={v => set('timeline', v)} placeholder="e.g. Hoping to match within 3 months" />
      </QuizShell>
    )
  }

  return (
    <QuizShell
      step={4} totalSteps={TOTAL_STEPS}
      title="Anything else?"
      subtitle="Final thoughts and questions you'd like us to know."
      milestone="🎉 Final step"
      onBack={() => setStep(3)} onNext={handleSubmit}
      nextLabel={submitting ? 'Submitting…' : 'Submit my application'}
      nextDisabled={!step4Valid || submitting}
      accentColor={ACCENT} accentFg={ACCENT_FG}
    >
      <FieldText label="What questions or concerns do you currently have?" value={form.questionsConcerns} onChange={v => set('questionsConcerns', v)} multiline />
      <FieldText label="Is there anything else you'd like us to know?" value={form.anythingElse} onChange={v => set('anythingElse', v)} multiline />
      <TurnstileWidget onVerify={setTurnstileToken} />
      {submitError && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{submitError}</p>}
    </QuizShell>
  )
}

function FieldText({ label, value, onChange, type = 'text', placeholder, error, multiline }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-stone-600 uppercase tracking-wide">{label}</Label>
      {multiline ? (
        <textarea
          value={value} onChange={e => onChange(e.target.value)} rows={4} placeholder={placeholder}
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
