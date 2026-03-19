import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getIPDisqualifications } from '@/data/mock/intakeSubmissions'
import { QuizShell, ChoiceCard, YesNoGrid } from './QuizShell'

const IP_COLOR = '#464DA0'
const IP_FG = '#FFFFFF'

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY',
]

const FAMILY_TYPES = [
  { value: 'Heterosexual couple', emoji: '💑', label: 'Couple (man and woman)' },
  { value: 'Same-sex couple',     emoji: '🌈', label: 'Same-sex couple'        },
  { value: 'Single parent',       emoji: '🧡', label: 'Single parent'          },
]

const REASON_OPTIONS = [
  { value: 'medical',       label: 'Medical reasons',              emoji: '🏥' },
  { value: 'fertility',     label: 'Fertility challenges',          emoji: '💫' },
  { value: 'same_sex',      label: 'Same-sex relationship',         emoji: '🌈' },
  { value: 'single_parent', label: 'Pursuing single parenthood',    emoji: '🧡' },
  { value: 'age_related',   label: 'Age-related reasons',           emoji: '⏳' },
  { value: 'other',         label: 'Other personal reasons',        emoji: '💙' },
]

const INVOLVEMENT_OPTIONS = [
  { value: 'minimal',      label: 'Minimal',       description: 'Periodic updates only',              emoji: '📩' },
  { value: 'moderate',     label: 'Moderate',      description: 'Monthly communication',              emoji: '📅' },
  { value: 'involved',     label: 'Involved',      description: 'Attend appointments + check-ins',    emoji: '👐' },
  { value: 'very_involved',label: 'Very involved', description: 'As connected as surrogate allows',   emoji: '💞' },
  { value: 'open',         label: 'Whatever works',description: "Open to surrogate's preference",     emoji: '😊' },
]

export default function IPIntakeForm() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    familyType: '',
    primaryFirstName: '', primaryLastName: '', secondaryName: '',
    email: '', phone: '', primaryDob: '', city: '', state: '',
    surrogacyReasonTags: [],
    yearsOnJourney: '', hasEmbryos: null, needsEggDonor: null,
    surrogateAgeRange: '', locationPreference: '',
    openToFirstTimeSurrogate: null, openToMultiples: null, desiredInvolvement: '',
    budgetAcknowledged: false, financingConfirmed: null, desiredTimeline: '',
    hearAboutUs: '', preferredContact: '', additionalNotes: '', agreeToConsultation: false,
  })

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }))
  const toggleTag = (field, val) =>
    set(field, form[field].includes(val)
      ? form[field].filter(t => t !== val)
      : [...form[field], val])

  const step1Valid =
    form.familyType && form.primaryFirstName && form.primaryLastName &&
    form.email && form.phone && form.primaryDob && form.city && form.state
  const step2Valid =
    form.surrogacyReasonTags.length > 0 && form.yearsOnJourney &&
    form.hasEmbryos !== null && form.needsEggDonor !== null
  const step3Valid =
    form.surrogateAgeRange && form.locationPreference &&
    form.openToFirstTimeSurrogate !== null && form.openToMultiples !== null &&
    form.desiredInvolvement
  const step4Valid =
    form.budgetAcknowledged && form.financingConfirmed !== null && form.desiredTimeline
  const step5Valid =
    form.hearAboutUs && form.preferredContact && form.agreeToConsultation
  const stepValid = [null, step1Valid, step2Valid, step3Valid, step4Valid, step5Valid]

  function handleSubmit() {
    const surrogacyReason = form.surrogacyReasonTags
      .map(t => REASON_OPTIONS.find(o => o.value === t)?.label || t)
      .join(', ')
    const dqReasons = getIPDisqualifications({ ...form, surrogacyReason })
    const tracking = JSON.parse(sessionStorage.getItem('intakeTrackingData') || '{}')
    navigate('/apply/confirmation', {
      state: {
        qualified: dqReasons.length === 0,
        dqReasons, type: 'ip',
        name: form.primaryFirstName, email: form.email, tracking,
      },
    })
  }

  const MILESTONES = [null, null, null, 'Halfway there!', 'Almost done!', 'Last step!']
  const shell = (s) => ({
    step: s, totalSteps: 5,
    accentColor: IP_COLOR, accentFg: IP_FG,
    milestone: MILESTONES[s],
    nextDisabled: !stepValid[s],
    onBack: s === 1 ? () => navigate('/apply') : () => setStep(s - 1),
    onNext: s === 5 ? handleSubmit : () => setStep(s + 1),
    nextLabel: s === 5 ? 'Get my next steps' : 'Continue',
  })

  // Step 1 — Who is on this journey?
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
          <Label className="text-xs text-stone-500 uppercase tracking-wide font-semibold">{form.familyType === 'Single parent' ? 'First name' : 'Your first name'}</Label>
          <Input value={form.primaryFirstName} onChange={e => set('primaryFirstName', e.target.value)} placeholder="First name" className="rounded-xl h-11" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-stone-500 uppercase tracking-wide font-semibold">Last name</Label>
          <Input value={form.primaryLastName} onChange={e => set('primaryLastName', e.target.value)} placeholder="Last name" className="rounded-xl h-11" />
        </div>
      </div>
      {form.familyType && form.familyType !== 'Single parent' && (
        <div className="space-y-1.5">
          <Label className="text-xs text-stone-500 uppercase tracking-wide font-semibold">Partner's full name <span className="normal-case font-normal text-stone-400">(optional)</span></Label>
          <Input value={form.secondaryName} onChange={e => set('secondaryName', e.target.value)} placeholder="Partner's full name" className="rounded-xl h-11" />
        </div>
      )}
      <div className="space-y-1.5">
        <Label className="text-xs text-stone-500 uppercase tracking-wide font-semibold">Email</Label>
        <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="you@example.com" className="rounded-xl h-11" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-stone-500 uppercase tracking-wide font-semibold">Phone</Label>
        <Input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="(555) 555-0100" className="rounded-xl h-11" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-stone-500 uppercase tracking-wide font-semibold">{form.familyType === 'Single parent' ? 'Date of birth' : 'Your date of birth'}</Label>
          <Input type="date" value={form.primaryDob} onChange={e => set('primaryDob', e.target.value)} className="rounded-xl h-11" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-stone-500 uppercase tracking-wide font-semibold">State</Label>
          <Select value={form.state} onValueChange={v => set('state', v)}>
            <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="State" /></SelectTrigger>
            <SelectContent>{US_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-stone-500 uppercase tracking-wide font-semibold">City</Label>
        <Input value={form.city} onChange={e => set('city', e.target.value)} placeholder="New York" className="rounded-xl h-11" />
      </div>
    </QuizShell>
  )

  // Step 2 — Your journey
  if (step === 2) return (
    <QuizShell {...shell(2)} emoji="💙" title="Your journey" subtitle="We would love to understand where you are on this path.">
      <div>
        <p className="text-sm font-medium text-stone-800 mb-2">Why are you pursuing surrogacy? Pick all that apply.</p>
        <div className="space-y-2">
          {REASON_OPTIONS.map(opt => (
            <ChoiceCard key={opt.value} selected={form.surrogacyReasonTags.includes(opt.value)} onSelect={() => toggleTag('surrogacyReasonTags', opt.value)} label={opt.label} emoji={opt.emoji} accentColor={IP_COLOR} accentFg={IP_FG} />
          ))}
        </div>
      </div>
      <div>
        <p className="text-sm font-medium text-stone-800 mb-2">How long have you been on this path?</p>
        <div className="space-y-2">
          {[
            { value: 'Just starting',    label: 'Just starting — surrogacy is our first step', emoji: '🌱' },
            { value: 'Less than 1 year', label: 'Less than 1 year of fertility treatment',       emoji: '📅' },
            { value: '1 year',           label: 'About 1 year',                                  emoji: '🕐' },
            { value: '2 years',          label: 'About 2 years',                                 emoji: '🕑' },
            { value: '3+ years',         label: '3 or more years',                               emoji: '🕒' },
            { value: '5+ years',         label: '5 or more years',                               emoji: '💪' },
          ].map(opt => (
            <ChoiceCard key={opt.value} selected={form.yearsOnJourney === opt.value} onSelect={() => set('yearsOnJourney', opt.value)} label={opt.label} emoji={opt.emoji} accentColor={IP_COLOR} accentFg={IP_FG} />
          ))}
        </div>
      </div>
      <div>
        <p className="text-sm font-medium text-stone-800 mb-2">Do you have frozen embryos ready?</p>
        <YesNoGrid value={form.hasEmbryos} onChange={v => set('hasEmbryos', v)} yesLabel="Yes, we do" noLabel="Not yet" yesEmoji="✅" noEmoji="⏳" accentColor={IP_COLOR} accentFg={IP_FG} />
      </div>
      <div>
        <p className="text-sm font-medium text-stone-800 mb-2">Will you need an egg donor?</p>
        <YesNoGrid value={form.needsEggDonor} onChange={v => set('needsEggDonor', v)} yesLabel="Yes" noLabel="No" yesEmoji="💊" noEmoji="🤝" accentColor={IP_COLOR} accentFg={IP_FG} />
      </div>
    </QuizShell>
  )

  // Step 3 — Your ideal match
  if (step === 3) return (
    <QuizShell {...shell(3)} emoji="✨" title="Your ideal match" subtitle="Tell us about the surrogate relationship you are hoping for." milestone="Halfway there!">
      <div>
        <p className="text-sm font-medium text-stone-800 mb-2">Preferred surrogate age range</p>
        <div className="space-y-2">
          {[
            { value: '21-30', label: '21 to 30 years old',      emoji: '🌸' },
            { value: '25-35', label: '25 to 35 years old',      emoji: '💛' },
            { value: '28-38', label: '28 to 38 years old',      emoji: '🌟' },
            { value: '30-40', label: '30 to 40 years old',      emoji: '💙' },
            { value: 'Open',  label: 'No preference — open to all', emoji: '😊' },
          ].map(opt => (
            <ChoiceCard key={opt.value} selected={form.surrogateAgeRange === opt.value} onSelect={() => set('surrogateAgeRange', opt.value)} label={opt.label} emoji={opt.emoji} accentColor={IP_COLOR} accentFg={IP_FG} />
          ))}
        </div>
      </div>
      <div>
        <p className="text-sm font-medium text-stone-800 mb-2">Surrogate location preference</p>
        <div className="space-y-2">
          {[
            { value: 'Any US state',             label: 'Any US state',  emoji: '🗺️' },
            { value: 'East Coast preferred',      label: 'East Coast',    emoji: '🌆' },
            { value: 'West Coast preferred',      label: 'West Coast',    emoji: '🌅' },
            { value: 'Midwest preferred',         label: 'Midwest',       emoji: '🌾' },
            { value: 'Southeast US',              label: 'Southeast',     emoji: '🌴' },
            { value: 'Southwest US',              label: 'Southwest',     emoji: '🏜️' },
          ].map(opt => (
            <ChoiceCard key={opt.value} selected={form.locationPreference === opt.value} onSelect={() => set('locationPreference', opt.value)} label={opt.label} emoji={opt.emoji} accentColor={IP_COLOR} accentFg={IP_FG} />
          ))}
        </div>
      </div>
      <div>
        <p className="text-sm font-medium text-stone-800 mb-2">Open to a first-time surrogate?</p>
        <YesNoGrid value={form.openToFirstTimeSurrogate} onChange={v => set('openToFirstTimeSurrogate', v)} yesLabel="Yes, open to it" noLabel="Prefer experienced" yesEmoji="🌱" noEmoji="🔄" accentColor={IP_COLOR} accentFg={IP_FG} />
      </div>
      <div>
        <p className="text-sm font-medium text-stone-800 mb-2">Open to a twin pregnancy?</p>
        <YesNoGrid value={form.openToMultiples} onChange={v => set('openToMultiples', v)} yesLabel="Yes, open to twins" noLabel="Singleton only" yesEmoji="👯" noEmoji="1️⃣" accentColor={IP_COLOR} accentFg={IP_FG} />
      </div>
      <div>
        <p className="text-sm font-medium text-stone-800 mb-2">How involved do you want to be during pregnancy?</p>
        <div className="space-y-2">
          {INVOLVEMENT_OPTIONS.map(opt => (
            <ChoiceCard key={opt.value} selected={form.desiredInvolvement === opt.value} onSelect={() => set('desiredInvolvement', opt.value)} label={opt.label} description={opt.description} emoji={opt.emoji} accentColor={IP_COLOR} accentFg={IP_FG} />
          ))}
        </div>
      </div>
    </QuizShell>
  )

  // Step 4 — Planning and finances
  if (step === 4) return (
    <QuizShell {...shell(4)} emoji="📋" title="Planning and finances" subtitle="Surrogacy is a meaningful investment — let's make sure you feel ready." milestone="Almost done!">
      <div className="rounded-xl p-4 space-y-1.5" style={{ backgroundColor: '#f0f1fa', border: '1px solid #464DA020' }}>
        <p className="text-sm font-semibold" style={{ color: IP_COLOR }}>What to expect</p>
        <p className="text-sm text-stone-600 leading-relaxed">
          Most families invest between <strong>$80,000 and $150,000+</strong> total — covering surrogate compensation, medical, legal, and agency fees. We will walk you through a detailed breakdown in your free consultation.
        </p>
      </div>
      <div
        className="flex items-start gap-3 rounded-xl border-2 p-4 cursor-pointer transition-all"
        style={form.budgetAcknowledged ? { borderColor: IP_COLOR, backgroundColor: '#464DA010' } : { borderColor: '#e7e5e4' }}
        onClick={() => set('budgetAcknowledged', !form.budgetAcknowledged)}
      >
        <Checkbox id="budget-ack" checked={form.budgetAcknowledged} onCheckedChange={v => set('budgetAcknowledged', v === true)} className="mt-0.5 shrink-0" />
        <label htmlFor="budget-ack" className="text-sm text-stone-600 leading-relaxed cursor-pointer select-none">
          I understand and acknowledge the estimated cost range.
        </label>
      </div>
      <div>
        <p className="text-sm font-medium text-stone-800 mb-1">Do you have a financial plan in place?</p>
        <p className="text-xs text-stone-400 mb-2">Savings, financing, loans — or a combination. We can connect you with options in your consultation.</p>
        <div className="space-y-2">
          <ChoiceCard selected={form.financingConfirmed === true} onSelect={() => set('financingConfirmed', true)} label="Yes — I have funds or a plan ready" emoji="✅" description="Ready to move forward" accentColor={IP_COLOR} accentFg={IP_FG} />
          <ChoiceCard selected={form.financingConfirmed === false} onSelect={() => set('financingConfirmed', false)} label="Still exploring my options" emoji="🔍" description="We can help connect you with resources" accentColor={IP_COLOR} accentFg={IP_FG} />
        </div>
      </div>
      <div>
        <p className="text-sm font-medium text-stone-800 mb-2">What is your desired timeline to begin?</p>
        <div className="space-y-2">
          {[
            { value: 'As soon as possible', label: 'As soon as possible',  emoji: '🚀' },
            { value: 'Within 3 months',     label: 'Within 3 months',      emoji: '📆' },
            { value: 'Within 3-6 months',   label: 'Within 3 to 6 months', emoji: '🗓️' },
            { value: 'Within 6-12 months',  label: 'Within 6 to 12 months',emoji: '📅' },
            { value: 'Flexible',            label: 'Flexible — no rush',   emoji: '😌' },
          ].map(opt => (
            <ChoiceCard key={opt.value} selected={form.desiredTimeline === opt.value} onSelect={() => set('desiredTimeline', opt.value)} label={opt.label} emoji={opt.emoji} accentColor={IP_COLOR} accentFg={IP_FG} />
          ))}
        </div>
      </div>
    </QuizShell>
  )

  // Step 5 — Let's connect
  if (step === 5) return (
    <QuizShell {...shell(5)} emoji="💙" title="Let's connect!" subtitle="One last step — you are almost there." milestone="Last step!">
      <div>
        <p className="text-sm font-medium text-stone-800 mb-2">How did you find us?</p>
        <div className="space-y-2">
          {[
            { value: 'Instagram ad',           emoji: '📸',  label: 'Instagram'        },
            { value: 'TikTok ad',              emoji: '🎵',  label: 'TikTok'           },
            { value: 'Facebook ad',            emoji: '👤',  label: 'Facebook'         },
            { value: 'Google search',          emoji: '🔍',  label: 'Google'           },
            { value: 'Friend referral',        emoji: '👫',  label: 'Friend or family' },
            { value: 'Doctor / Clinic referral', emoji: '👩‍⚕️', label: 'Doctor or clinic' },
            { value: 'Podcast / Blog',         emoji: '🎙️',  label: 'Podcast or blog'  },
            { value: 'Other',                  emoji: '💡',  label: 'Other'            },
          ].map(opt => (
            <ChoiceCard key={opt.value} selected={form.hearAboutUs === opt.value} onSelect={() => set('hearAboutUs', opt.value)} label={opt.label} emoji={opt.emoji} accentColor={IP_COLOR} accentFg={IP_FG} />
          ))}
        </div>
      </div>
      <div>
        <p className="text-sm font-medium text-stone-800 mb-2">Best way to reach you?</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { value: 'Email',      emoji: '📧', label: 'Email'      },
            { value: 'Phone',      emoji: '📞', label: 'Phone call' },
            { value: 'Text',       emoji: '💬', label: 'Text'       },
            { value: 'Video Call', emoji: '🎥', label: 'Video call' },
          ].map(opt => (
            <ChoiceCard key={opt.value} selected={form.preferredContact === opt.value} onSelect={() => set('preferredContact', opt.value)} label={opt.label} emoji={opt.emoji} accentColor={IP_COLOR} accentFg={IP_FG} />
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-stone-500 uppercase tracking-wide font-semibold">Anything else on your mind? <span className="normal-case font-normal text-stone-400">(optional)</span></Label>
        <Textarea value={form.additionalNotes} onChange={e => set('additionalNotes', e.target.value)} placeholder="Questions, context, or anything you'd like us to know..." rows={3} className="rounded-xl resize-none" />
      </div>
      <div
        className="flex items-start gap-3 rounded-xl border-2 p-4 cursor-pointer transition-all"
        style={form.agreeToConsultation ? { borderColor: IP_COLOR, backgroundColor: '#464DA010' } : { borderColor: '#e7e5e4' }}
        onClick={() => set('agreeToConsultation', !form.agreeToConsultation)}
      >
        <Checkbox id="agree-consult" checked={form.agreeToConsultation} onCheckedChange={v => set('agreeToConsultation', v === true)} className="mt-0.5 shrink-0" />
        <label htmlFor="agree-consult" className="text-sm text-stone-600 leading-relaxed cursor-pointer select-none">
          I am open to being contacted by an Abundant Beginnings coordinator to schedule a free consultation call.
        </label>
      </div>
    </QuizShell>
  )

  return null
}
