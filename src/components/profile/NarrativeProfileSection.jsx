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
// Magazine-style preview. Section headers stay consistent across all
// sections; the QUESTION BODIES cycle through three layout variants so
// the page has visual rhythm:
//   cards     — each Q&A in its own white-bordered card (default)
//   editorial — no card borders; italic gold question labels with
//               flowing answer text, separated by hairline gold rules
//   grid      — compact 2-column grid of small tinted cards
export function NarrativeProfileView({ sections, narrative = {}, applicantFirstName, pregnancyHistoryNode, startNumber = 1 }) {
  return (
    <div className="space-y-7">
      {sections.map((section, idx) => {
        if (section.isLetter) {
          return <LetterView key={section.key} section={section} narrative={narrative} applicantFirstName={applicantFirstName} />
        }
        const bodyVariant = ['cards', 'editorial', 'grid'][idx % 3]
        return (
          <PreviewSection
            key={section.key}
            section={section}
            number={startNumber + idx}
            narrative={narrative}
            pregnancyHistoryNode={pregnancyHistoryNode}
            bodyVariant={bodyVariant}
          />
        )
      })}
    </div>
  )
}

function PreviewSection({ section, number, narrative, pregnancyHistoryNode, bodyVariant = 'cards' }) {
  const Icon = ICONS[section.icon] || Heart
  // pregnancyHistory widget always renders as a block at the top
  const widgetNode = section.questions.find(q => q.type === 'pregnancyHistory') && pregnancyHistoryNode

  const answerQuestions = section.questions.filter(q => q.type !== 'pregnancyHistory')

  let body
  if (bodyVariant === 'editorial') {
    body = (
      <div className="divide-y divide-[#D4A853]/20">
        {answerQuestions.map((q, i) => (
          <div key={q.id} className={i === 0 ? 'pb-4' : 'py-4'}>
            <AnswerView question={q} narrative={narrative} variant="editorial" />
          </div>
        ))}
      </div>
    )
  } else if (bodyVariant === 'grid') {
    body = (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {answerQuestions.map(q => (
          <AnswerView key={q.id} question={q} narrative={narrative} variant="grid" />
        ))}
      </div>
    )
  } else {
    body = (
      <div className="space-y-2.5">
        {answerQuestions.map(q => (
          <AnswerView key={q.id} question={q} narrative={narrative} variant="cards" />
        ))}
      </div>
    )
  }

  return (
    <div className="print:break-inside-avoid">
      {/* Magazine header: 01 + icon + title + gold underline */}
      <div className="flex items-baseline gap-4 mb-4 pb-3 border-b-2 border-[#D4A853]/25 print:break-after-avoid">
        <span className="text-4xl font-heading font-black leading-none tabular-nums" style={{ color: `${GOLD}99` }}>
          {String(number).padStart(2, '0')}
        </span>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Icon className="w-4 h-4 shrink-0" style={{ color: GOLD }} />
          <h3 className="text-xl font-heading font-black tracking-tight" style={{ color: ACCENT }}>{section.title}</h3>
        </div>
      </div>
      {section.note && (
        <p className="text-xs italic text-stone-500 mb-3 leading-relaxed">{section.note}</p>
      )}
      {widgetNode && <div className="mb-4">{widgetNode}</div>}
      {body}
    </div>
  )
}

function AnswerView({ question, narrative, variant = 'cards' }) {
  const { id, label, type, options, followUp } = question
  const value = narrative[id]
  const details = narrative[`${id}_details`]
  const hasValue = value !== undefined && value !== null && value !== ''

  // ─── EDITORIAL — no card borders, magazine prose feel ──────────────
  if (variant === 'editorial') {
    if (type === 'yesno') {
      const isYes = hasValue && (value === 'yes' || value === 'Yes')
      const isNo = hasValue && (value === 'no' || value === 'No')
      return (
        <div>
          <div className="flex items-baseline gap-3">
            <p className="text-xs uppercase tracking-[0.15em] font-semibold flex-1 leading-snug" style={{ color: GOLD }}>{label}</p>
            <span className={`text-sm font-bold uppercase tracking-wider shrink-0 ${
              isYes ? 'text-emerald-600' : isNo ? 'text-rose-500' : 'text-stone-300'
            }`}>{isYes ? 'Yes' : isNo ? 'No' : '—'}</span>
          </div>
          {hasValue && details && (
            <p className="text-[15px] text-stone-700 whitespace-pre-wrap leading-relaxed mt-2 font-serif italic">{details}</p>
          )}
        </div>
      )
    }
    if (type === 'select') {
      const opt = options?.find(o => o.value === value)
      return (
        <div>
          <p className="text-xs uppercase tracking-[0.15em] font-semibold mb-1.5 leading-snug" style={{ color: GOLD }}>{label}</p>
          <p className="text-[15px] font-medium" style={{ color: ACCENT }}>{hasValue ? (opt?.label || value) : '—'}</p>
          {hasValue && details && (
            <p className="text-[15px] text-stone-700 whitespace-pre-wrap leading-relaxed mt-2 font-serif italic">{details}</p>
          )}
        </div>
      )
    }
    // textarea
    return (
      <div>
        <p className="text-xs uppercase tracking-[0.15em] font-semibold mb-2 leading-snug" style={{ color: GOLD }}>{label}</p>
        {hasValue ? (
          <p className="text-[15px] text-stone-700 whitespace-pre-wrap leading-[1.75] font-serif">{value}</p>
        ) : (
          <p className="text-sm italic text-stone-300">Not yet answered</p>
        )}
      </div>
    )
  }

  // ─── GRID — compact 2-column tinted cards ──────────────────────────
  if (variant === 'grid') {
    if (type === 'yesno') {
      const isYes = hasValue && (value === 'yes' || value === 'Yes')
      const isNo = hasValue && (value === 'no' || value === 'No')
      const cellClass = isYes ? 'bg-emerald-50/50 border-emerald-200/60' :
                        isNo ? 'bg-rose-50/50 border-rose-200/60' :
                        'bg-[#fdf8f3]/60 border-[#D4A853]/20'
      const detailsSpansFull = hasValue && details
      return (
        <div className={detailsSpansFull ? 'sm:col-span-2 space-y-1.5' : ''}>
          <div className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 print:break-inside-avoid ${cellClass}`}>
            <span className="text-xs text-stone-700 flex-1 leading-snug">{label}</span>
            <span className={`text-[10px] font-bold uppercase tracking-wider shrink-0 ${
              isYes ? 'text-emerald-600' : isNo ? 'text-rose-500' : 'text-stone-300'
            }`}>{isYes ? 'Yes' : isNo ? 'No' : '—'}</span>
          </div>
          {detailsSpansFull && (
            <div className="rounded-lg border border-stone-200 bg-white px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider font-semibold text-stone-500 mb-1">{followUp?.label || 'Details'}</p>
              <p className="text-sm text-stone-700 whitespace-pre-wrap leading-relaxed">{details}</p>
            </div>
          )}
        </div>
      )
    }
    if (type === 'select') {
      const opt = options?.find(o => o.value === value)
      return (
        <div className={hasValue && details ? 'sm:col-span-2 space-y-1.5' : ''}>
          <div className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 ${hasValue ? 'bg-[#88C0C4]/10 border-[#88C0C4]/30' : 'bg-[#fdf8f3]/60 border-[#D4A853]/20'}`}>
            <span className="text-xs text-stone-700 flex-1 leading-snug">{label}</span>
            <span className={`text-[10px] font-bold shrink-0 ${hasValue ? 'text-[#1F3A3C]' : 'text-stone-300'}`}>{hasValue ? (opt?.label || value) : '—'}</span>
          </div>
          {hasValue && details && (
            <div className="rounded-lg border border-stone-200 bg-white px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider font-semibold text-stone-500 mb-1">{followUp?.label || 'Details'}</p>
              <p className="text-sm text-stone-700 whitespace-pre-wrap leading-relaxed">{details}</p>
            </div>
          )}
        </div>
      )
    }
    // textarea — longer answers span both columns
    const isLong = hasValue && (value?.length || 0) > 140
    return (
      <div className={`${isLong ? 'sm:col-span-2' : ''} rounded-lg border border-[#D4A853]/20 bg-[#fdf8f3]/60 px-3 py-2.5 print:break-inside-avoid`}>
        <p className="text-[10px] uppercase tracking-wider font-semibold text-stone-500 mb-1">{label}</p>
        {hasValue ? (
          <p className="text-sm text-stone-800 whitespace-pre-wrap leading-relaxed">{value}</p>
        ) : (
          <p className="text-xs italic text-stone-300">Not yet answered</p>
        )}
      </div>
    )
  }

  // ─── CARDS (default) — white bordered cards ────────────────────────
  if (type === 'yesno') {
    const isYes = hasValue && (value === 'yes' || value === 'Yes')
    const isNo = hasValue && (value === 'no' || value === 'No')
    return (
      <>
        <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 print:break-inside-avoid transition-colors ${
          isYes ? 'bg-emerald-50/60 border-emerald-200/70' :
          isNo ? 'bg-rose-50/60 border-rose-200/70' :
          'bg-stone-50/40 border-stone-200'
        }`}>
          <span className="text-sm text-stone-700 flex-1 leading-snug">{label}</span>
          <span className={`text-xs font-bold uppercase tracking-wider shrink-0 ${
            isYes ? 'text-emerald-600' :
            isNo ? 'text-rose-500' :
            'text-stone-300'
          }`}>{isYes ? 'Yes' : isNo ? 'No' : '—'}</span>
        </div>
        {hasValue && details && (
          <div className="rounded-xl border border-stone-200 bg-white px-4 py-3 -mt-1.5">
            <p className="text-[11px] uppercase tracking-wider font-semibold text-stone-500 mb-1.5">{followUp?.label || 'Details'}</p>
            <p className="text-sm text-stone-700 whitespace-pre-wrap leading-relaxed">{details}</p>
          </div>
        )}
      </>
    )
  }

  if (type === 'select') {
    const opt = options?.find(o => o.value === value)
    const display = opt?.label || value
    return (
      <>
        <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 print:break-inside-avoid ${
          hasValue ? 'bg-[#88C0C4]/10 border-[#88C0C4]/30' : 'bg-stone-50/40 border-stone-200'
        }`}>
          <span className="text-sm text-stone-700 flex-1 leading-snug">{label}</span>
          <span className={`text-xs font-bold shrink-0 ${hasValue ? 'text-[#1F3A3C]' : 'text-stone-300'}`}>
            {hasValue ? display : '—'}
          </span>
        </div>
        {hasValue && details && (
          <div className="rounded-xl border border-stone-200 bg-white px-4 py-3 -mt-1.5">
            <p className="text-[11px] uppercase tracking-wider font-semibold text-stone-500 mb-1.5">{followUp?.label || 'Details'}</p>
            <p className="text-sm text-stone-700 whitespace-pre-wrap leading-relaxed">{details}</p>
          </div>
        )}
      </>
    )
  }

  // textarea (default)
  return (
    <div className="rounded-xl border border-stone-200 bg-white px-4 py-3 print:break-inside-avoid">
      <p className="text-[11px] uppercase tracking-wider font-semibold text-stone-500 mb-1.5">{label}</p>
      {hasValue ? (
        <p className="text-[15px] text-stone-800 whitespace-pre-wrap leading-relaxed">{value}</p>
      ) : (
        <p className="text-sm italic text-stone-300">Not yet answered</p>
      )}
    </div>
  )
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
