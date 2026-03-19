import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getIPDisqualifications } from '@/data/mock/intakeSubmissions'
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
  { value: 'Heterosexual couple', emoji: '💑', label: 'Couple (man and woman)' },
  { value: 'Same-sex couple',     emoji: '🌈', label: 'Same-sex couple'        },
  { value: 'Single parent',       emoji: '🧡', label: 'Single parent'          },
]

export default function IPIntakeForm() {
  const navigate   = useNavigate()
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    familyType: '',
    primaryFirstName: '', primaryLastName: '', primaryDob: '', email: '', phone: '',
    country: 'United States', street: '', street2: '', city: '', stateProv: '', zipCode: '',
    ip2FirstName: '', ip2LastName: '', ip2Dob: '', ip2Email: '', ip2Phone: '',
    hasRE: null, hasFrozenEmbryos: null, usingEggDonor: null, usingSpermDonor: null,
    wantsConsultation: null, hearAboutUs: '', agreeToConsultation: false,
  })

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }))
  const isCouple = form.familyType && form.familyType !== 'Single parent'

  const step1Valid = form.familyType && form.primaryFirstName && form.primaryLastName && form.primaryDob && form.email && form.phone
  const step2Valid = form.street && form.city && form.stateProv && form.zipCode
  const step3Valid = isCouple
    ? form.ip2FirstName && form.ip2LastName && form.ip2Dob && form.ip2Email && form.ip2Phone
    : true
  const step4Valid = form.hasRE !== null && form.hasFrozenEmbryos !== null && form.usingEggDonor !== null && form.usingSpermDonor !== null
  const step5Valid = form.wantsConsultation !== null && form.hearAboutUs && form.agreeToConsultation
  const stepValid  = [null, step1Valid, step2Valid, step3Valid, step4Valid, step5Valid]

  function handleSubmit() {
    const dqReasons = getIPDisqualifications(form)
    const tracking  = JSON.parse(sessionStorage.getItem('intakeTrackingData') || '{}')
    navigate('/apply/confirmation', {
      state: { qualified: dqReasons.length === 0, dqReasons, type: 'ip', name: form.primaryFirstName, email: form.email, tracking },
    })
  }

  const MILESTONES = [null, null, null, 'Halfway there!', 'Almost done!', 'Last step!']
  const shell = (s) => ({
    step: s, totalSteps: 5, accentColor: IP_COLOR, accentFg: IP_FG,
    milestone: MILESTONES[s], nextDisabled: !stepValid[s],
    onBack: s === 1 ? () => navigate('/apply') : () => setStep(s - 1),
    onNext: s === 5 ? handleSubmit : () => setStep(s + 1),
    nextLabel: s === 5 ? 'Get my next steps' : 'Continue',
  })

  // Step 1 — Primary applicant
  if (step === 1) return (
    <QuizShell {...shell(1)} emoji="👋" title="Nice to meet you!" subtitle="Let's start with a bit about who you are.">
      <div>
        <Label className="text-xs text-stone-500 uppercase tracking-wide font-semibold block mb-2">Who is on this journey?</Label>
        <div className="space-y-2">
          {FAMILY_TYPES.map(ft => (
            <ChoiceCard key={ft.value} selected={form.familyType === ft.value} onSelect={() => set('familyType', ft.value)} label={ft.label} emoji={ft.emoji} accentColor={IP_COLOR} accentFg={IP_FG} />
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
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-stone-500 uppercase tracking-wide font-semibold">Best number to reach you</Label>
        <Input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="(555) 555-0100" className="rounded-xl h-11" />
      </div>
      <p className="text-xs text-stone-400 pt-1">We will only reach out to share your results. No spam, ever.</p>
    </QuizShell>
  )

  // Step 2 — Address
  if (step === 2) return (
    <QuizShell {...shell(2)} emoji="🏠" title="Where are you located?" subtitle="This helps us match you with a surrogate in a compatible state.">
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
        </div>
      </div>
    </QuizShell>
  )

  // Step 3 — Partner info (conditional)
  if (step === 3) return (
    <QuizShell {...shell(3)}
      emoji="💑"
      title="Your partner's info"
      subtitle={isCouple ? 'Just a few quick details about your partner.' : "Looks like you're applying solo — you're all set for this step!"}
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
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-stone-500 uppercase tracking-wide font-semibold">Best number to reach partner</Label>
            <Input type="tel" value={form.ip2Phone} onChange={e => set('ip2Phone', e.target.value)} placeholder="(555) 555-0100" className="rounded-xl h-11" />
          </div>
        </>
      ) : (
        <div className="rounded-xl p-6 text-center" style={{ backgroundColor: '#f0f1fa' }}>
          <p className="text-3xl mb-2">🙋</p>
          <p className="text-sm text-stone-600">No partner info needed — tap <strong>Continue</strong> to move on.</p>
        </div>
      )}
    </QuizShell>
  )

  // Step 4 — Fertility details
  if (step === 4) return (
    <QuizShell {...shell(4)} emoji="💫" title="Your fertility journey" subtitle="A few quick questions to help us understand where you are." milestone="Almost done!">
      <div>
        <p className="text-sm font-medium text-stone-800 mb-2">Do you have a Reproductive Endocrinologist (Fertility Doctor)?</p>
        <YesNoGrid value={form.hasRE} onChange={v => set('hasRE', v)} yesLabel="Yes" noLabel="Not yet" yesEmoji="👩‍⚕️" noEmoji="🔍" accentColor={IP_COLOR} accentFg={IP_FG} />
      </div>
      <div>
        <p className="text-sm font-medium text-stone-800 mb-2">Do you have frozen embryos?</p>
        <YesNoGrid value={form.hasFrozenEmbryos} onChange={v => set('hasFrozenEmbryos', v)} yesLabel="Yes, we do" noLabel="Not yet" yesEmoji="✅" noEmoji="⏳" accentColor={IP_COLOR} accentFg={IP_FG} />
      </div>
      <div>
        <p className="text-sm font-medium text-stone-800 mb-2">Are you using an egg donor?</p>
        <YesNoGrid value={form.usingEggDonor} onChange={v => set('usingEggDonor', v)} yesLabel="Yes" noLabel="No" yesEmoji="🥚" noEmoji="🙅" accentColor={IP_COLOR} accentFg={IP_FG} />
      </div>
      <div>
        <p className="text-sm font-medium text-stone-800 mb-2">Are you using a sperm donor?</p>
        <YesNoGrid value={form.usingSpermDonor} onChange={v => set('usingSpermDonor', v)} yesLabel="Yes" noLabel="No" yesEmoji="🔬" noEmoji="🙅" accentColor={IP_COLOR} accentFg={IP_FG} />
      </div>
    </QuizShell>
  )

  // Step 5 — Final
  if (step === 5) return (
    <QuizShell {...shell(5)} emoji="💙" title="One last thing!" subtitle="You're almost done — you're doing great." milestone="Last step!">
      <div>
        <p className="text-sm font-medium text-stone-800 mb-2">Would you like to schedule a consultation?</p>
        <YesNoGrid value={form.wantsConsultation} onChange={v => set('wantsConsultation', v)} yesLabel="Yes, please!" noLabel="Not right now" yesEmoji="📅" noEmoji="🤔" accentColor={IP_COLOR} accentFg={IP_FG} />
      </div>
      <div>
        <p className="text-sm font-medium text-stone-800 mb-2">How did you hear about Abundant Beginnings Co.?</p>
        <div className="space-y-2">
          {[
            { value: 'Instagram',        emoji: '📸', label: 'Instagram'        },
            { value: 'TikTok',           emoji: '🎵', label: 'TikTok'           },
            { value: 'Facebook',         emoji: '👤', label: 'Facebook'         },
            { value: 'Google search',    emoji: '🔍', label: 'Google'           },
            { value: 'Friend or family', emoji: '👫', label: 'Friend or family' },
            { value: 'Doctor or clinic', emoji: '👩‍⚕️', label: 'Doctor or clinic' },
            { value: 'Podcast or blog',  emoji: '🎧', label: 'Podcast or blog'  },
            { value: 'Other',            emoji: '💡', label: 'Other'            },
          ].map(opt => (
            <ChoiceCard key={opt.value} selected={form.hearAboutUs === opt.value} onSelect={() => set('hearAboutUs', opt.value)} label={opt.label} emoji={opt.emoji} accentColor={IP_COLOR} accentFg={IP_FG} />
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
