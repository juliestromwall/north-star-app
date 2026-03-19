import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getGCDisqualifications } from '@/data/mock/intakeSubmissions'
import { QuizShell, ChoiceCard, YesNoGrid, NumberStepper } from './QuizShell'

const GC_COLOR = '#FFB3AB'
const GC_FG = '#2F324F'

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY',
]

const MOTIVATION_OPTIONS = [
  { value: 'help_family',    label: 'Help a family start their journey',        emoji: '\ud83d\udc68\u200d\ud83d\udc69\u200d\ud83d\udc67' },
  { value: 'love_pregnancy', label: 'I loved being pregnant',                   emoji: '\ud83d\udc9b'     },
  { value: 'financial',      label: 'Financial support for my family',          emoji: '\ud83c\udfe1'     },
  { value: 'altruistic',     label: 'It just feels like the right thing to do', emoji: '\ud83c\udf1f'     },
  { value: 'friend_story',   label: 'A friend or family story inspired me',     emoji: '\ud83d\udc65'     },
  { value: 'repeat',         label: "I've been a surrogate and loved it",        emoji: '\ud83d\udc95'     },
]

const CONTACT_OPTIONS = [
  { value: 'minimal',  label: 'Minimal',           description: 'Privacy during pregnancy',  emoji: '\ud83d\udd12' },
  { value: 'moderate', label: 'Moderate',           description: 'Monthly updates',           emoji: '\ud83d\udcec' },
  { value: 'regular',  label: 'Regular',            description: 'Calls + shared milestones', emoji: '\ud83d\udcde' },
  { value: 'close',    label: 'Close relationship', description: 'Ongoing connection',        emoji: '\ud83e\udd1d' },
  { value: 'open',     label: 'Whatever works!',    description: "I'm flexible",              emoji: '\ud83d\ude0a' },
]

function calculateBMI(ft, inches, lbs) {
  const totalIn = (parseInt(ft) || 0) * 12 + (parseInt(inches) || 0)
  if (!totalIn || !lbs) return null
  return ((lbs / (totalIn * totalIn)) * 703).toFixed(1)
}

export default function SurrogateIntakeForm() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phone: '',
    dob: '', city: '', state: '', maritalStatus: '', partnerName: '',
    heightFt: '', heightIn: '', weightLbs: '',
    tobaccoUse: null, drugUse: null, seriousMedicalCondition: null, currentlyPregnant: null,
    biologicalChildren: '0', totalPregnancies: '0', vaginalDeliveries: '0',
    cSections: '0', majorComplications: '',
    motivationTags: [], previousSurrogacy: null,
    willingToCarryMultiples: null, contactPreferenceWithIPs: '', supportSystemConfirmed: null,
    govtAssistance: null, preferredContact: '', hearAboutUs: '', agreeBackgroundCheck: false,
  })

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }))
  const toggleTag = (field, val) =>
    set(field, form[field].includes(val)
      ? form[field].filter(t => t !== val)
      : [...form[field], val])

  const bmi = calculateBMI(form.heightFt, form.heightIn, form.weightLbs)
  const bmiVal = parseFloat(bmi)
  const bmiOk = bmi && bmiVal >= 19 && bmiVal <= 33

  const step1Valid = form.firstName && form.lastName && form.email && form.phone
  const step2Valid = form.dob && form.city && form.state && form.maritalStatus
  const step3Valid =
    form.heightFt && form.heightIn && form.weightLbs &&
    form.tobaccoUse !== null && form.drugUse !== null &&
    form.seriousMedicalCondition !== null && form.currentlyPregnant !== null
  const step4Valid =
    form.biologicalChildren !== '' && form.totalPregnancies !== '' &&
    form.vaginalDeliveries !== '' && form.cSections !== ''
  const step5Valid =
    form.motivationTags.length > 0 && form.previousSurrogacy !== null &&
    form.willingToCarryMultiples !== null &&
    form.contactPreferenceWithIPs && form.supportSystemConfirmed !== null
  const step6Valid =
    form.govtAssistance !== null && form.preferredContact &&
    form.hearAboutUs && form.agreeBackgroundCheck
  const stepValid = [null, step1Valid, step2Valid, step3Valid, step4Valid, step5Valid, step6Valid]

  function handleSubmit() {
    const motivation = form.motivationTags
      .map(t => MOTIVATION_OPTIONS.find(o => o.value === t)?.label || t)
      .join(', ')
    const answers = {
      ...form, motivation,
      bmi: parseFloat(bmi),
      biologicalChildren: parseInt(form.biologicalChildren),
      totalPregnancies: parseInt(form.totalPregnancies),
      vaginalDeliveries: parseInt(form.vaginalDeliveries),
      cSections: parseInt(form.cSections),
    }
    const dqReasons = getGCDisqualifications(answers)
    const tracking = JSON.parse(sessionStorage.getItem('intakeTrackingData') || '{}')
    navigate('/apply/confirmation', {
      state: {
        qualified: dqReasons.length === 0,
        dqReasons, type: 'gc',
        name: form.firstName, email: form.email, tracking,
      },
    })
  }

  const MILESTONES = [null, null, null, null, 'Halfway there!', 'Almost done!', 'Last step!']
  const shell = (s) => ({
    step: s, totalSteps: 6,
    accentColor: GC_COLOR, accentFg: GC_FG,
    milestone: MILESTONES[s],
    nextDisabled: !stepValid[s],
    onBack: s === 1 ? () => navigate('/apply') : () => setStep(s - 1),
    onNext: s === 6 ? handleSubmit : () => setStep(s + 1),
    nextLabel: s === 6 ? 'See if I qualify' : 'Continue',
  })

  // Step 1
  if (step === 1) return (
    <QuizShell {...shell(1)} emoji="👋" title="Let's get acquainted" subtitle="Just a few quick details to get started — takes about 5 minutes.">
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
        <Label className="text-xs text-stone-500 uppercase tracking-wide font-semibold">Email</Label>
        <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="jane@example.com" className="rounded-xl h-11" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-stone-500 uppercase tracking-wide font-semibold">Phone</Label>
        <Input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="(555) 555-0100" className="rounded-xl h-11" />
      </div>
      <p className="text-xs text-stone-400 pt-1">We will only reach out to share your results. No spam, ever.</p>
    </QuizShell>
  )

  // Step 2
  if (step === 2) return (
    <QuizShell {...shell(2)} emoji="🌸" title="A little about you" subtitle="Tell us a bit about where you are in life right now.">
      <div className="space-y-1.5">
        <Label className="text-xs text-stone-500 uppercase tracking-wide font-semibold">Date of birth</Label>
        <Input type="date" value={form.dob} onChange={e => set('dob', e.target.value)} className="rounded-xl h-11" />
        <p className="text-xs text-stone-400">Surrogates are typically between 21 and 40 years old.</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-stone-500 uppercase tracking-wide font-semibold">City</Label>
          <Input value={form.city} onChange={e => set('city', e.target.value)} placeholder="Austin" className="rounded-xl h-11" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-stone-500 uppercase tracking-wide font-semibold">State</Label>
          <Select value={form.state} onValueChange={v => set('state', v)}>
            <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="State" /></SelectTrigger>
            <SelectContent>{US_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label className="text-xs text-stone-500 uppercase tracking-wide font-semibold">Relationship status</Label>
        {['Single', 'Married', 'Domestic Partnership', 'Divorced', 'Widowed'].map(s => (
          <ChoiceCard key={s} selected={form.maritalStatus === s} onSelect={() => set('maritalStatus', s)} label={s} accentColor={GC_COLOR} accentFg={GC_FG} />
        ))}
      </div>
      {(form.maritalStatus === 'Married' || form.maritalStatus === 'Domestic Partnership') && (
        <div className="space-y-1.5">
          <Label className="text-xs text-stone-500 uppercase tracking-wide font-semibold">Partner's name <span className="normal-case font-normal text-stone-400">(optional)</span></Label>
          <Input value={form.partnerName} onChange={e => set('partnerName', e.target.value)} placeholder="Full name" className="rounded-xl h-11" />
        </div>
      )}
    </QuizShell>
  )

  // Step 3
  if (step === 3) return (
    <QuizShell {...shell(3)} emoji="💪" title="Quick health check" subtitle="Agencies have a few health guidelines — let's see where you stand.">
      <div>
        <Label className="text-xs text-stone-500 uppercase tracking-wide font-semibold block mb-2">Your height and weight</Label>
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <Label className="text-xs text-stone-400">Feet</Label>
            <Input type="number" min="4" max="7" value={form.heightFt} onChange={e => set('heightFt', e.target.value)} placeholder="5" className="rounded-xl h-11 text-center" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-stone-400">Inches</Label>
            <Input type="number" min="0" max="11" value={form.heightIn} onChange={e => set('heightIn', e.target.value)} placeholder="6" className="rounded-xl h-11 text-center" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-stone-400">Lbs</Label>
            <Input type="number" min="90" max="400" value={form.weightLbs} onChange={e => set('weightLbs', e.target.value)} placeholder="145" className="rounded-xl h-11 text-center" />
          </div>
        </div>
        {bmi && (
          <div className={`mt-2 text-sm px-3 py-2 rounded-lg font-medium ${bmiOk ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
            BMI: {bmi} {bmiOk ? 'Looks great!' : 'may be outside the typical range (19-33)'}
          </div>
        )}
      </div>
      <div>
        <p className="text-sm font-medium text-stone-800 mb-2">Are you currently tobacco-free?</p>
        <YesNoGrid value={form.tobaccoUse === null ? null : !form.tobaccoUse} onChange={v => set('tobaccoUse', !v)} yesLabel="Yes, tobacco-free" noLabel="No, I use tobacco" yesEmoji="🚭" noEmoji="🚬" accentColor={GC_COLOR} accentFg={GC_FG} />
      </div>
      <div>
        <p className="text-sm font-medium text-stone-800 mb-2">Are you currently drug-free?</p>
        <YesNoGrid value={form.drugUse === null ? null : !form.drugUse} onChange={v => set('drugUse', !v)} yesLabel="Yes, drug-free" noLabel="No, I use recreational drugs" yesEmoji="✅" noEmoji="❌" accentColor={GC_COLOR} accentFg={GC_FG} />
      </div>
      <div>
        <p className="text-sm font-medium text-stone-800 mb-1">Any serious active medical conditions?</p>
        <p className="text-xs text-stone-400 mb-2">e.g. cancer, HIV, uncontrolled diabetes, autoimmune disorders</p>
        <YesNoGrid value={form.seriousMedicalCondition} onChange={v => set('seriousMedicalCondition', v)} yesLabel="Yes, I have one" noLabel="No serious conditions" yesEmoji="🏥" noEmoji="💚" accentColor={GC_COLOR} accentFg={GC_FG} />
      </div>
      <div>
        <p className="text-sm font-medium text-stone-800 mb-2">Are you currently pregnant?</p>
        <YesNoGrid value={form.currentlyPregnant} onChange={v => set('currentlyPregnant', v)} yesLabel="Yes, I am" noLabel="No, I'm not" yesEmoji="🤰" noEmoji="👍" accentColor={GC_COLOR} accentFg={GC_FG} />
      </div>
    </QuizShell>
  )

  // Step 4
  if (step === 4) return (
    <QuizShell {...shell(4)} emoji="👶" title="Your pregnancy journey" subtitle="This helps us understand your experience and find the best match." milestone="Halfway there!">
      <NumberStepper label="How many biological children do you have?" note="Surrogates need at least one biological child of their own." value={form.biologicalChildren} onChange={v => set('biologicalChildren', v)} min={0} max={8} />
      <NumberStepper label="Total pregnancies" value={form.totalPregnancies} onChange={v => set('totalPregnancies', v)} min={0} max={10} />
      <NumberStepper label="Vaginal deliveries" value={form.vaginalDeliveries} onChange={v => set('vaginalDeliveries', v)} min={0} max={10} />
      <NumberStepper label="C-sections" value={form.cSections} onChange={v => set('cSections', v)} min={0} max={6} />
      {parseInt(form.cSections) > 3 && (
        <p className="text-xs text-amber-600">More than 3 C-sections may affect eligibility — we will discuss this during your interview.</p>
      )}
      <div className="space-y-1.5">
        <Label className="text-xs text-stone-500 uppercase tracking-wide font-semibold">Major complications? <span className="normal-case font-normal text-stone-400">(optional)</span></Label>
        <Input value={form.majorComplications} onChange={e => set('majorComplications', e.target.value)} placeholder="e.g. preeclampsia — or leave blank" className="rounded-xl h-11" />
      </div>
    </QuizShell>
  )

  // Step 5
  if (step === 5) return (
    <QuizShell {...shell(5)} emoji="💛" title="Your heart's why" subtitle="What draws you to surrogacy? Pick everything that resonates." milestone="Almost done!">
      <div className="space-y-2">
        {MOTIVATION_OPTIONS.map(opt => (
          <ChoiceCard key={opt.value} selected={form.motivationTags.includes(opt.value)} onSelect={() => toggleTag('motivationTags', opt.value)} label={opt.label} emoji={opt.emoji} accentColor={GC_COLOR} accentFg={GC_FG} />
        ))}
      </div>
      <div>
        <p className="text-sm font-medium text-stone-800 mb-2">Have you been a surrogate before?</p>
        <YesNoGrid value={form.previousSurrogacy} onChange={v => set('previousSurrogacy', v)} yesLabel="Yes, I have" noLabel="First time for me" yesEmoji="🔄" noEmoji="🌱" accentColor={GC_COLOR} accentFg={GC_FG} />
      </div>
      <div>
        <p className="text-sm font-medium text-stone-800 mb-2">Open to carrying twins or multiples?</p>
        <YesNoGrid value={form.willingToCarryMultiples} onChange={v => set('willingToCarryMultiples', v)} yesLabel="Yes, open to it" noLabel="Singleton only" yesEmoji="👯" noEmoji="1️⃣" accentColor={GC_COLOR} accentFg={GC_FG} />
      </div>
      <div>
        <p className="text-sm font-medium text-stone-800 mb-2">How much contact do you prefer with intended parents?</p>
        <div className="space-y-2">
          {CONTACT_OPTIONS.map(opt => (
            <ChoiceCard key={opt.value} selected={form.contactPreferenceWithIPs === opt.value} onSelect={() => set('contactPreferenceWithIPs', opt.value)} label={opt.label} description={opt.description} emoji={opt.emoji} accentColor={GC_COLOR} accentFg={GC_FG} />
          ))}
        </div>
      </div>
      <div>
        <p className="text-sm font-medium text-stone-800 mb-1">Does your support system know and support this?</p>
        <p className="text-xs text-stone-400 mb-2">Partner, family, close friends — this matters a lot for a smooth journey.</p>
        <YesNoGrid value={form.supportSystemConfirmed} onChange={v => set('supportSystemConfirmed', v)} yesLabel="Yes, fully on board" noLabel="Still figuring it out" yesEmoji="🙌" noEmoji="💭" accentColor={GC_COLOR} accentFg={GC_FG} />
      </div>
    </QuizShell>
  )

  // Step 6
  if (step === 6) return (
    <QuizShell {...shell(6)} emoji="🙏" title="One last thing!" subtitle="Almost there — you are doing amazing." milestone="Last step!">
      <div>
        <p className="text-sm font-medium text-stone-800 mb-1">Are you currently receiving government financial assistance?</p>
        <p className="text-xs text-stone-400 mb-2">e.g. Medicaid, SNAP, housing assistance. Surrogate income may affect these programs.</p>
        <YesNoGrid value={form.govtAssistance} onChange={v => set('govtAssistance', v)} yesLabel="Yes, I am" noLabel="No, I'm not" yesEmoji="ℹ️" noEmoji="✅" accentColor={GC_COLOR} accentFg={GC_FG} />
      </div>
      <div>
        <p className="text-sm font-medium text-stone-800 mb-2">Best way to reach you?</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { value: 'Text', emoji: '💬', label: 'Text' },
            { value: 'Email', emoji: '📧', label: 'Email' },
            { value: 'Phone', emoji: '📞', label: 'Phone call' },
            { value: 'Video Call', emoji: '🎥', label: 'Video call' },
          ].map(opt => (
            <ChoiceCard key={opt.value} selected={form.preferredContact === opt.value} onSelect={() => set('preferredContact', opt.value)} label={opt.label} emoji={opt.emoji} accentColor={GC_COLOR} accentFg={GC_FG} />
          ))}
        </div>
      </div>
      <div>
        <p className="text-sm font-medium text-stone-800 mb-2">How did you find us?</p>
        <div className="space-y-2">
          {[
            { value: 'Instagram ad', emoji: '📸', label: 'Instagram' },
            { value: 'TikTok ad', emoji: '🎵', label: 'TikTok' },
            { value: 'Facebook ad', emoji: '👤', label: 'Facebook' },
            { value: 'Google search', emoji: '🔍', label: 'Google' },
            { value: 'Friend referral', emoji: '👫', label: 'Friend or family' },
            { value: 'Doctor referral', emoji: '👩‍⚕️', label: 'Doctor or clinic' },
            { value: 'Podcast / Blog', emoji: '🎙️', label: 'Podcast or blog' },
            { value: 'Other', emoji: '💡', label: 'Other' },
          ].map(opt => (
            <ChoiceCard key={opt.value} selected={form.hearAboutUs === opt.value} onSelect={() => set('hearAboutUs', opt.value)} label={opt.label} emoji={opt.emoji} accentColor={GC_COLOR} accentFg={GC_FG} />
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
