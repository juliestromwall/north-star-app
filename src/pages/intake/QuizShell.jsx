import { ArrowLeft, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

// ── ChoiceCard ────────────────────────────────────────────────────────────────
// Large tap-target card for single or multi-select questions
export function ChoiceCard({
  selected,
  onSelect,
  label,
  description,
  emoji,
  accentColor = '#D4A853',
  accentFg = '#2F324F',
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full text-left rounded-xl border-2 px-4 py-3.5 flex items-center gap-3 cursor-pointer transition-all duration-150 select-none hover:shadow-sm"
      style={
        selected
          ? { borderColor: accentColor, backgroundColor: `${accentColor}1e` }
          : { borderColor: '#e7e5e4', backgroundColor: '#ffffff' }
      }
    >
      {emoji && (
        <span className="text-xl leading-none shrink-0" aria-hidden>
          {emoji}
        </span>
      )}
      <div className="flex-1 min-w-0">
        <p
          className="font-medium text-sm leading-snug"
          style={{ color: selected ? '#1c1917' : '#57534e' }}
        >
          {label}
        </p>
        {description && (
          <p className="text-xs text-stone-400 mt-0.5 leading-snug">{description}</p>
        )}
      </div>
      <span
        className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all"
        style={
          selected
            ? { backgroundColor: accentColor, borderColor: accentColor }
            : { borderColor: '#c4bfba' }
        }
      >
        {selected && (
          <svg viewBox="0 0 10 8" className="w-2.5 h-2.5" fill="none">
            <path
              d="M1 4L3.8 7L9 1"
              stroke={accentFg}
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
    </button>
  )
}

// ── YesNoGrid ─────────────────────────────────────────────────────────────────
// Two side-by-side ChoiceCards for boolean questions
export function YesNoGrid({
  value,
  onChange,
  yesLabel = 'Yes',
  noLabel = 'No',
  yesEmoji,
  noEmoji,
  accentColor,
  accentFg,
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <ChoiceCard
        selected={value === true}
        onSelect={() => onChange(true)}
        label={yesLabel}
        emoji={yesEmoji}
        accentColor={accentColor}
        accentFg={accentFg}
      />
      <ChoiceCard
        selected={value === false}
        onSelect={() => onChange(false)}
        label={noLabel}
        emoji={noEmoji}
        accentColor={accentColor}
        accentFg={accentFg}
      />
    </div>
  )
}

// ── NumberStepper ─────────────────────────────────────────────────────────────
// +/− stepper — much more mobile-friendly than a text input for small integers.
// Starts in an "unanswered" state showing — instead of 0, so an applicant who
// hasn't interacted with the field isn't mistaken for one who answered 0.
// First + click jumps from blank to 1; minus from 1 lands on 0 (a valid answer).
export function NumberStepper({ value, onChange, min = 0, max = 10, label, note }) {
  const isEmpty = value === '' || value === null || value === undefined
  const num = parseInt(value) || 0
  return (
    <div className="space-y-2">
      {label && <p className="text-sm font-medium text-stone-800">{label}</p>}
      {note && <p className="text-xs text-stone-400">{note}</p>}
      <div className="flex items-center gap-5">
        <button
          type="button"
          onClick={() => { if (!isEmpty) onChange(String(Math.max(min, num - 1))) }}
          disabled={isEmpty || num <= min}
          className="w-11 h-11 rounded-full border-2 border-stone-200 flex items-center justify-center text-stone-600 text-xl font-bold hover:border-stone-400 disabled:opacity-30 transition-colors"
        >
          −
        </button>
        <span className="text-3xl font-bold text-stone-900 w-10 text-center tabular-nums">
          {isEmpty ? '—' : (num >= max ? `${max}+` : num)}
        </span>
        <button
          type="button"
          onClick={() => onChange(String(isEmpty ? 1 : Math.min(max, num + 1)))}
          disabled={!isEmpty && num >= max}
          className="w-11 h-11 rounded-full border-2 border-stone-200 flex items-center justify-center text-stone-600 text-xl font-bold hover:border-stone-400 disabled:opacity-30 transition-colors"
        >
          +
        </button>
      </div>
    </div>
  )
}

// ── QuizShell ─────────────────────────────────────────────────────────────────
// Page wrapper: sticky header, thin progress bar, question area, CTA button
export function QuizShell({
  step,
  totalSteps,
  title,
  emoji,
  subtitle,
  milestone,
  onBack,
  onNext,
  nextLabel = 'Continue',
  nextDisabled = false,
  accentColor = '#D4A853',
  accentFg = '#2F324F',
  children,
}) {
  const progress = (step / totalSteps) * 100

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#faf8f5' }}>
      {/* Sticky top bar */}
      <header className="flex items-center justify-between px-4 py-5 bg-white border-b border-stone-100 sticky top-0 z-10">
        <button
          type="button"
          onClick={onBack}
          aria-label="Go back"
          className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-stone-100 transition-colors"
          style={onBack ? undefined : { visibility: 'hidden' }}
          disabled={!onBack}
        >
          <ArrowLeft className="w-4 h-4 text-stone-500" />
        </button>
        <img src="/north-star-logo.png" alt="North Star Surrogacy" className="h-32 sm:h-40 w-auto" />
        <div className="w-9" aria-hidden />
      </header>

      {/* Scrollable body */}
      <div className="flex-1 max-w-lg mx-auto w-full px-4 py-8 pb-24">
        {/* Progress indicator */}
        <div className="flex flex-col items-center gap-2 mb-7">
          <span className="text-xs text-stone-400 font-medium tracking-wide">Step {step} of {totalSteps}</span>
          <div className="w-full max-w-xs h-8 rounded-full overflow-hidden shadow-sm"
            style={{ background: '#e7e5e4' }}>
            <div className="h-full rounded-full transition-all duration-500 ease-out flex items-center justify-center"
              style={{ width: `${Math.max(progress, 20)}%`, background: 'linear-gradient(135deg, #1F3A3C, #5A9EA2)' }}>
              {milestone && (
                <span className="text-[11px] font-semibold text-white whitespace-nowrap">{milestone}</span>
              )}
            </div>
          </div>
        </div>

        {/* Question header */}
        <div className="mb-7">
          <h2 className="text-[1.65rem] font-bold text-stone-900 leading-tight">{title}</h2>
          {subtitle && (
            <p className="text-stone-500 text-sm mt-2 leading-relaxed">{subtitle}</p>
          )}
        </div>

        {/* Form fields */}
        <div className="space-y-4">{children}</div>

        {/* CTA */}
        <div className="mt-9 space-y-2.5">
          <Button
            type="button"
            onClick={onNext}
            disabled={nextDisabled}
            className="w-full h-12 text-[15px] font-semibold rounded-xl gap-2 transition-opacity"
            style={
              !nextDisabled
                ? { backgroundColor: accentColor, color: accentFg }
                : {}
            }
          >
            {nextLabel}
            <ArrowRight className="w-4 h-4" />
          </Button>
          <p className="text-center text-[11px] text-stone-400">
            Private &amp; confidential · No commitment required
          </p>
        </div>
      </div>
    </div>
  )
}
