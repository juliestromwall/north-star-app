import { Heart, Star, Baby, MessageCircle, Sparkles, Shield, Users, CalendarDays, Mail } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const ICONS = { Heart, Star, Baby, MessageCircle, Sparkles, Shield, Users, CalendarDays, Mail }
const ACCENT = '#1F3A3C'
const ACCENT_LIGHT = '#88C0C4'
const GOLD = '#D4A853'

function SectionShell({ section, children }) {
  const Icon = ICONS[section.icon] || Heart
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6 space-y-5">
      <div className="pb-3 border-b border-stone-100">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${ACCENT}10`, color: ACCENT }}>
            <Icon className="size-4" />
          </div>
          <h2 className="text-lg font-semibold" style={{ color: '#1A3638' }}>{section.title}</h2>
        </div>
        {section.note && (
          <p className="text-xs text-stone-500 mt-2.5 leading-relaxed pl-12">{section.note}</p>
        )}
      </div>
      <div className="space-y-5">{children}</div>
    </div>
  )
}

// ─── Edit form ───────────────────────────────────────────────────────
// `bare` skips the inner SectionShell wrapper — useful when the caller
// already wraps each section in its own Collapsible/Card.
export function NarrativeProfileEditor({ sections, narrative = {}, onChange, pregnancyHistoryNode, bare = false }) {
  const set = (id, value) => onChange({ ...narrative, [id]: value })

  const renderQuestions = (section) => section.questions.map(q => {
    if (q.type === 'pregnancyHistory') {
      return pregnancyHistoryNode ? <div key={q.id}>{pregnancyHistoryNode}</div> : null
    }
    return (
      <QuestionEditor
        key={q.id}
        question={q}
        value={narrative[q.id] ?? ''}
        detailsValue={narrative[`${q.id}_details`] ?? ''}
        onChange={v => set(q.id, v)}
        onDetailsChange={v => set(`${q.id}_details`, v)}
      />
    )
  })

  if (bare) {
    return (
      <div className="space-y-5">
        {sections.map(section => (
          <div key={section.key} className="space-y-5">
            {section.note && <p className="text-xs text-stone-500 leading-relaxed">{section.note}</p>}
            {renderQuestions(section)}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {sections.map(section => (
        <SectionShell key={section.key} section={section}>
          {renderQuestions(section)}
        </SectionShell>
      ))}
    </div>
  )
}

function QuestionEditor({ question, value, detailsValue, onChange, onDetailsChange }) {
  const { type, label, options, followUp, isLetterBody } = question

  if (type === 'textarea') {
    return (
      <div className="space-y-2">
        {!isLetterBody && <Label className="text-sm font-semibold text-[#1A3638] leading-snug">{label}</Label>}
        {isLetterBody && (
          <p className="text-xs text-stone-500 italic">
            Anything you'd like to share from the heart — this will be shown as a letter signed from you.
          </p>
        )}
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          rows={isLetterBody ? 8 : 4}
          className="w-full text-sm border-2 border-stone-200 rounded-xl px-3.5 py-3 bg-[#fdf8f3]/40 focus:outline-none focus:border-[#D4A853] focus:bg-white focus:ring-2 focus:ring-[#D4A853]/20 leading-relaxed transition-colors"
        />
      </div>
    )
  }

  if (type === 'yesno') {
    const showFollowUp = followUp && (
      (followUp.when === 'yes' && value === 'yes') ||
      (followUp.when === 'no' && value === 'no') ||
      (followUp.when === 'any' && (value === 'yes' || value === 'no'))
    )
    return (
      <div className="space-y-2">
        <Label className="text-sm font-semibold text-[#1A3638] leading-snug">{label}</Label>
        <div className="flex gap-2">
          {['yes', 'no'].map(v => (
            <button
              key={v}
              type="button"
              onClick={() => onChange(v)}
              className="flex-1 rounded-lg border-2 px-4 py-2 text-sm font-medium capitalize transition-colors"
              style={value === v
                ? { backgroundColor: `${GOLD}1f`, borderColor: GOLD, color: '#1A3638' }
                : { borderColor: '#e7e5e4', color: '#57534e' }}
            >
              {v}
            </button>
          ))}
        </div>
        {showFollowUp && (
          <div className="pt-2">
            <Label className="text-xs text-stone-500 mb-1.5 block">{followUp.label}</Label>
            <textarea
              value={detailsValue}
              onChange={e => onDetailsChange(e.target.value)}
              rows={3}
              className="w-full text-sm border-2 border-stone-200 rounded-xl px-3 py-2.5 bg-[#fdf8f3]/40 focus:outline-none focus:border-[#D4A853] focus:bg-white focus:ring-2 focus:ring-[#D4A853]/20 transition-colors"
            />
          </div>
        )}
      </div>
    )
  }

  if (type === 'select') {
    return (
      <div className="space-y-2">
        <Label className="text-sm font-semibold text-[#1A3638] leading-snug">{label}</Label>
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Select…" /></SelectTrigger>
          <SelectContent>
            {options.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {followUp && (
          <div className="pt-2">
            <Label className="text-xs text-stone-500 mb-1.5 block">{followUp.label}</Label>
            <textarea
              value={detailsValue}
              onChange={e => onDetailsChange(e.target.value)}
              rows={2}
              className="w-full text-sm border-2 border-stone-200 rounded-xl px-3 py-2.5 bg-[#fdf8f3]/40 focus:outline-none focus:border-[#D4A853] focus:bg-white focus:ring-2 focus:ring-[#D4A853]/20 transition-colors"
            />
          </div>
        )}
      </div>
    )
  }

  return null
}

// ─── Read-only view ──────────────────────────────────────────────────
export function NarrativeProfileView({ sections, narrative = {}, applicantFirstName, pregnancyHistoryNode }) {
  return (
    <div className="space-y-5">
      {sections.map(section => {
        if (section.isLetter) {
          return <LetterView key={section.key} section={section} narrative={narrative} applicantFirstName={applicantFirstName} />
        }
        return (
          <SectionShell key={section.key} section={section}>
            {section.questions.map(q => {
              if (q.type === 'pregnancyHistory') {
                return pregnancyHistoryNode ? <div key={q.id}>{pregnancyHistoryNode}</div> : null
              }
              return <AnswerView key={q.id} question={q} narrative={narrative} />
            })}
          </SectionShell>
        )
      })}
    </div>
  )
}

function AnswerView({ question, narrative }) {
  const { id, label, type, options, followUp } = question
  const value = narrative[id]
  const details = narrative[`${id}_details`]

  if (!value && !details) {
    return (
      <div>
        <p className="text-[11px] uppercase tracking-wider font-semibold text-stone-400 mb-1">{label}</p>
        <p className="text-sm italic text-stone-300">Not yet answered</p>
      </div>
    )
  }

  if (type === 'textarea') {
    return (
      <div>
        <p className="text-[11px] uppercase tracking-wider font-semibold text-stone-500 mb-1.5">{label}</p>
        <p className="text-sm text-stone-700 whitespace-pre-wrap leading-relaxed">{value}</p>
      </div>
    )
  }
  if (type === 'yesno') {
    return (
      <div>
        <p className="text-[11px] uppercase tracking-wider font-semibold text-stone-500 mb-1.5">{label}</p>
        <p className="text-sm font-semibold capitalize" style={{ color: ACCENT }}>{value}</p>
        {details && (
          <>
            <p className="text-[11px] text-stone-400 mt-2 mb-1">{followUp?.label || 'Details'}</p>
            <p className="text-sm text-stone-700 whitespace-pre-wrap leading-relaxed">{details}</p>
          </>
        )}
      </div>
    )
  }
  if (type === 'select') {
    const opt = options?.find(o => o.value === value)
    return (
      <div>
        <p className="text-[11px] uppercase tracking-wider font-semibold text-stone-500 mb-1.5">{label}</p>
        <p className="text-sm font-medium" style={{ color: ACCENT }}>{opt?.label || value}</p>
        {details && (
          <p className="text-sm text-stone-700 whitespace-pre-wrap leading-relaxed mt-2">{details}</p>
        )}
      </div>
    )
  }
  return null
}

function LetterView({ section, narrative, applicantFirstName }) {
  const letterQuestion = section.questions.find(q => q.isLetterBody)
  const body = letterQuestion ? narrative[letterQuestion.id] : ''
  if (!body) return null
  const Icon = ICONS[section.icon] || Mail
  return (
    <div className="rounded-2xl p-7 sm:p-9" style={{ background: 'linear-gradient(135deg, #F0EEEB 0%, #fafaf7 60%)', border: `1px solid ${ACCENT_LIGHT}40` }}>
      <div className="flex items-center gap-2 mb-5">
        <Icon className="size-4" style={{ color: GOLD }} />
        <span className="text-[10px] font-semibold uppercase tracking-[0.25em]" style={{ color: GOLD }}>A Letter</span>
      </div>
      <h3 className="text-2xl mb-5 font-light" style={{ color: ACCENT, fontFamily: "'Libre Franklin', sans-serif" }}>{section.title},</h3>
      <p className="text-[15px] text-stone-700 whitespace-pre-wrap leading-[1.75]">{body}</p>
      {applicantFirstName && (
        <p className="text-sm text-stone-500 italic mt-6">— {applicantFirstName}</p>
      )}
    </div>
  )
}
