import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getGCDisqualifications } from '@/data/mock/intakeSubmissions'
import { QuizShell, ChoiceCard, YesNoGrid } from './QuizShell'

const GC_COLOR = '#FFB3AB'
const GC_FG = '#2F324F'

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY',
]

const MARITAL_OPTIONS = [
  { value: 'Single',               label: 'Single'               },
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

export default function SurrogateIntakeForm() {
  const navigate = useNavigate()
  const { state: navState } = useLocation()
  const prefill = navState?.prefill || {}
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    firstName: '', lastName: '', dob: '', email: '', phone: '', state: '',
    maritalStatus: '', preferredContact: '',
    heightFt: '', heightIn: '', weightLbs: '',
    healthyPregnancy: null,
    hearAboutUs: '', agreeBackgroundCheck: false,
    ...prefill,
  })

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }))
  const bmi = calculateBMI(form.heightFt, form.heightIn, form.weightLbs)
  const bmiVal = parseFloat(bmi)
  const bmiOk = bmi && bmiVal >= 19 && bmiVal <= 33

  const step1Valid = form.firstName && form.lastName && form.dob && form.email && form.phone && form.state
  const step2Valid = form.maritalStatus && form.preferredContact
  const step3Valid = form.heightFt && form.heightIn && form.weightLbs
  const step4Valid = form.healthyPregnancy !== null
  const step5Valid = form.hearAboutUs && form.agreeBackgroundCheck
  const stepValid = [null, step1Valid, step2Valid, step3Valid, step4Valid, step5Valid]

  function handleSubmit() {
    const answers = { ...form, bmi: parseFloat(bmi) }
    const dqReasons = getGCDisqualifications(answers)
    const tracking = JSON.parse(sessionStorage.getItem('intakeTrackingData') || '{}')
    navigate('/apply/confirmation', {
      state: {
        qualified: dqReasons.length === 0,
        dqReasons, type: 'gc',
        name: form.firstName, email: form.email, tracking,
        answers: form,
      },
    })
  }

  const MILESTONES = [null, null, null, 'Halfway there!', 'Almost done!', 'Last step!']
  const shell = (s) => ({
    step: s, totalSteps: 5,
    accentColor: GC_COLOR, accentFg: GC_FG,
    milestone: MILESTONES[s],
    nextDisabled: !stepValid[s],
    onBack: s === 1 ? () => navigate('/apply') : () => setStep(s - 1),
    onNext: s === 5 ? handleSubmit : () => setStep(s + 1),
    nextLabel: s === 5 ? 'See if I qualify' : 'Continue',
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
        <Input type="date" value={form.dob} onChange={e => set('dob', e.target.value)} className="rounded-xl h-11" />
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
        <Input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="(555) 555-0100" className="rounded-xl h-11" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-stone-500 uppercase tracking-wide font-semibold">Email</Label>
        <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="jane@example.com" className="rounded-xl h-11" />
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
      <div>
        <p className="text-sm font-medium text-stone-800 mb-1">Have you had a healthy pregnancy?</p>
        <p className="text-xs text-stone-400 mb-3">No more than 5 vaginal deliveries or 2 C-sections.</p>
        <YesNoGrid
          value={form.healthyPregnancy}
          onChange={v => set('healthyPregnancy', v)}
          yesLabel="Yes, I have"
          noLabel="Not yet"
          accentColor={GC_COLOR}
          accentFg={GC_FG}
        />
      </div>
    </QuizShell>
  )

  // Step 5 — Final
  if (step === 5) return (
    <QuizShell {...shell(5)} title="Final step" subtitle="You're almost done. We'll review your responses and be in touch shortly." milestone="Last step!">
      <div>
        <p className="text-sm font-medium text-stone-800 mb-2">How did you hear about Abundant Beginnings Co.?</p>
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
      </div>
      <div
        className="flex items-start gap-3 rounded-xl border-2 p-4 cursor-pointer transition-all"
        style={form.agreeBackgroundCheck ? { borderColor: GC_COLOR, backgroundColor: '#FFB3AB18' } : { borderColor: '#e7e5e4' }}
        onClick={() => set('agreeBackgroundCheck', !form.agreeBackgroundCheck)}
      >
        <Checkbox id="bg-check" checked={form.agreeBackgroundCheck} onCheckedChange={v => set('agreeBackgroundCheck', v === true)} className="mt-0.5 shrink-0" />
        <label htmlFor="bg-check" className="text-sm text-stone-600 leading-relaxed cursor-pointer select-none">
          I understand that if approved, a background check is part of the standard screening process.
        </label>
      </div>
    </QuizShell>
  )

  return null
}
