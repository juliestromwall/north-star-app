import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getIPDisqualifications } from '@/data/mock/intakeSubmissions'
import { insertIntakeSubmission } from '@/lib/db'
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

const FAMILY_TYPES = [
  { value: 'Heterosexual couple', label: 'Couple (man and woman)' },
  { value: 'Same-sex couple',     label: 'Same-sex couple'        },
  { value: 'Single parent',       label: 'Single parent'          },
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
  useEffect(() => { window.scrollTo(0, 0) }, [step])
  const [form, setForm] = useState({
    familyType: '',
    primaryFirstName: '', primaryLastName: '', primaryDob: '', email: '', phone: '',
    country: 'United States', street: '', street2: '', city: '', stateProv: '', zipCode: '',
    ip2FirstName: '', ip2LastName: '', ip2Dob: '', ip2Email: '', ip2Phone: '',
    hasRE: null, hasFrozenEmbryos: null, usingEggDonor: null, usingSpermDonor: null,
    wantsConsultation: null, hearAboutUs: '', agreeToConsultation: false,
    ...prefill,
  })

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }))
  const isCouple = form.familyType && form.familyType !== 'Single parent'
  const primaryEmailValid = isValidEmail(form.email)
  const primaryPhoneValid = isValidInternationalPhone(form.phone)
  const postalValid = isValidPostalCode(form.country, form.zipCode)
  const partnerEmailValid = !isCouple || isValidEmail(form.ip2Email)
  const partnerPhoneValid = !isCouple || isValidInternationalPhone(form.ip2Phone)

  const step1Valid = form.familyType && form.primaryFirstName && form.primaryLastName && form.primaryDob && form.email && form.phone && primaryEmailValid && primaryPhoneValid
  const step2Valid = form.street && form.city && form.stateProv && form.zipCode && postalValid
  const step3Valid = isCouple
    ? form.ip2FirstName && form.ip2LastName && form.ip2Dob && form.ip2Email && form.ip2Phone && partnerEmailValid && partnerPhoneValid
    : true
  const step4Valid = form.hasRE !== null && form.hasFrozenEmbryos !== null && form.usingEggDonor !== null && form.usingSpermDonor !== null
  const step5Valid = form.wantsConsultation !== null && form.hearAboutUs && form.agreeToConsultation
  const stepValid  = [null, step1Valid, step2Valid, step3Valid, step4Valid, step5Valid]

  async function handleSubmit() {
    const dqReasons = getIPDisqualifications(form)
    const tracking  = JSON.parse(sessionStorage.getItem('intakeTrackingData') || '{}')
    const qualified = dqReasons.length === 0
    try {
      await insertIntakeSubmission({
        intake_type: 'ip',
        qualified,
        status: qualified ? 'qualified' : 'disqualified',
        dq_reasons: dqReasons,
        applicant_name: `${form.primaryFirstName} ${form.primaryLastName}`.trim(),
        applicant_email: form.email.trim(),
        applicant_phone: form.phone.trim(),
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
      })
    } catch {
      // Keep applicant flow moving even if persistence fails
    }
    navigate('/apply/confirmation', {
      state: { qualified, dqReasons, type: 'ip', name: form.primaryFirstName, email: form.email, tracking, answers: form },
    })
  }

  const MILESTONES = [null, null, null, 'Halfway there!', 'Almost done!', 'Last step!']
  const shell = (s) => ({
    step: s, totalSteps: 5, accentColor: IP_COLOR, accentFg: IP_FG,
    milestone: MILESTONES[s], nextDisabled: !stepValid[s],
    onBack: s === 1 ? () => navigate('/intendedparentapply') : () => setStep(s - 1),
    onNext: s === 5 ? handleSubmit : () => setStep(s + 1),
    nextLabel: s === 5 ? 'Get my next steps' : 'Continue',
  })

  // Step 1 — Primary applicant
  if (step === 1) return (
    <QuizShell {...shell(1)} title="Tell us about yourself" subtitle="A few quick details to get started.">
      <div>
        <Label className="text-xs text-stone-500 uppercase tracking-wide font-semibold block mb-2">Who is on this journey?</Label>
        <div className="space-y-2">
          {FAMILY_TYPES.map(ft => (
            <ChoiceCard key={ft.value} selected={form.familyType === ft.value} onSelect={() => set('familyType', ft.value)} label={ft.label} accentColor={IP_COLOR} accentFg={IP_FG} />
          ))}
        </div>
      </div>
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
        <Input type="date" value={form.primaryDob} onChange={e => set('primaryDob', e.target.value)} className="rounded-xl h-11" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-stone-500 uppercase tracking-wide font-semibold">Email</Label>
        <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="you@example.com" className="rounded-xl h-11" />
        {form.email && !primaryEmailValid && (
          <p className="text-xs text-red-500">Enter a valid email address</p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-stone-500 uppercase tracking-wide font-semibold">Best number to reach you</Label>
        <Input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+44 20 7946 0958" className="rounded-xl h-11" />
        {form.phone && !primaryPhoneValid && (
          <p className="text-xs text-red-500">Enter a valid phone number, including country code for international numbers</p>
        )}
      </div>
      <p className="text-xs text-stone-400 pt-1">We will only reach out to share your results. No spam, ever.</p>
    </QuizShell>
  )

  // Step 2 — Address
  if (step === 2) return (
    <QuizShell {...shell(2)} title="Where are you located?" subtitle="This helps us match you with a surrogate in a compatible state.">
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

  // Step 3 — Partner info (conditional)
  if (step === 3) return (
    <QuizShell {...shell(3)}
      title="Partner information"
      subtitle={isCouple ? 'A few quick details about your partner.' : 'No partner information needed for this step.'}
      milestone="Halfway there!"
    >
      {isCouple ? (
        <>
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
            <Input type="date" value={form.ip2Dob} onChange={e => set('ip2Dob', e.target.value)} className="rounded-xl h-11" />
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
            <Input type="tel" value={form.ip2Phone} onChange={e => set('ip2Phone', e.target.value)} placeholder="+44 20 7946 0958" className="rounded-xl h-11" />
            {form.ip2Phone && !partnerPhoneValid && (
              <p className="text-xs text-red-500">Enter a valid phone number, including country code for international numbers</p>
            )}
          </div>
        </>
      ) : (
        <div className="rounded-xl p-5 text-center" style={{ backgroundColor: '#f0f1fa' }}>
          <p className="text-sm text-stone-600">No partner information is required. Tap <strong>Continue</strong> to proceed.</p>
        </div>
      )}
    </QuizShell>
  )

  // Step 4 — Fertility details
  if (step === 4) return (
    <QuizShell {...shell(4)} title="Your fertility journey" subtitle="A few questions to help us understand where you are in the process." milestone="Almost done!">
      <div>
        <p className="text-sm font-medium text-stone-800 mb-2">Do you have a Reproductive Endocrinologist (Fertility Doctor)?</p>
        <YesNoGrid value={form.hasRE} onChange={v => set('hasRE', v)} yesLabel="Yes" noLabel="Not yet" accentColor={IP_COLOR} accentFg={IP_FG} />
      </div>
      <div>
        <p className="text-sm font-medium text-stone-800 mb-2">Do you have frozen embryos?</p>
        <YesNoGrid value={form.hasFrozenEmbryos} onChange={v => set('hasFrozenEmbryos', v)} yesLabel="Yes, we do" noLabel="Not yet" accentColor={IP_COLOR} accentFg={IP_FG} />
      </div>
      <div>
        <p className="text-sm font-medium text-stone-800 mb-2">Are you using an egg donor?</p>
        <YesNoGrid value={form.usingEggDonor} onChange={v => set('usingEggDonor', v)} yesLabel="Yes" noLabel="No" accentColor={IP_COLOR} accentFg={IP_FG} />
      </div>
      <div>
        <p className="text-sm font-medium text-stone-800 mb-2">Are you using a sperm donor?</p>
        <YesNoGrid value={form.usingSpermDonor} onChange={v => set('usingSpermDonor', v)} yesLabel="Yes" noLabel="No" accentColor={IP_COLOR} accentFg={IP_FG} />
      </div>
    </QuizShell>
  )

  // Step 5 — Final
  if (step === 5) return (
    <QuizShell {...shell(5)} title="Final step" subtitle="You're almost done. We'll review your responses and be in touch shortly." milestone="Last step!">
      <div>
        <p className="text-sm font-medium text-stone-800 mb-2">Would you like to schedule a consultation?</p>
        <YesNoGrid value={form.wantsConsultation} onChange={v => set('wantsConsultation', v)} yesLabel="Yes, please" noLabel="Not right now" accentColor={IP_COLOR} accentFg={IP_FG} />
      </div>
      <div>
        <p className="text-sm font-medium text-stone-800 mb-2">How did you hear about Abundant Beginnings Co.?</p>
        <div className="space-y-2">
          {[
            { value: 'Instagram',        label: 'Instagram'        },
            { value: 'TikTok',           label: 'TikTok'           },
            { value: 'Facebook',         label: 'Facebook'         },
            { value: 'Google search',    label: 'Google'           },
            { value: 'Friend or family', label: 'Friend or family' },
            { value: 'Doctor or clinic', label: 'Doctor or clinic' },
            { value: 'Podcast or blog',  label: 'Podcast or blog'  },
            { value: 'Other',            label: 'Other'            },
          ].map(opt => (
            <ChoiceCard key={opt.value} selected={form.hearAboutUs === opt.value} onSelect={() => set('hearAboutUs', opt.value)} label={opt.label} accentColor={IP_COLOR} accentFg={IP_FG} />
          ))}
        </div>
      </div>
      <div
        className="flex items-start gap-3 rounded-xl border-2 p-4 cursor-pointer transition-all"
        style={form.agreeToConsultation ? { borderColor: IP_COLOR, backgroundColor: '#464DA010' } : { borderColor: '#e7e5e4' }}
        onClick={() => set('agreeToConsultation', !form.agreeToConsultation)}
      >
        <Checkbox id="agree-consult" checked={form.agreeToConsultation} onCheckedChange={v => set('agreeToConsultation', v === true)} className="mt-0.5 shrink-0" />
        <label htmlFor="agree-consult" className="text-sm text-stone-600 leading-relaxed cursor-pointer select-none">
          I am open to being contacted by an Abundant Beginnings coordinator.
        </label>
      </div>
    </QuizShell>
  )

  return null
}
