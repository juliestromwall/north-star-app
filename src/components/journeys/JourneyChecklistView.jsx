import { useState, useMemo, useEffect, useRef } from 'react'
import {
  Check, X, Pencil, Trash2, Plus, ChevronDown, ChevronRight, ChevronUp, CornerDownRight,
  Handshake, Syringe, HeartPulse, Brain, Hospital, Receipt, IdCard,
  Stethoscope, Scale, DollarSign, Baby, FastForward,
} from 'lucide-react'
import { CHECKLIST_STEP_STATUSES, normalizeOptions } from '@/lib/checklistStore'

/**
 * Journey checklist UI — mirrors the medical-records card pattern
 * (`src/components/surrogates/MedicalRecordsView.jsx`). Steps come in flat
 * with `parentId` references; we group them so parent steps render as
 * section headers and children render as cards. Standalone steps (no parent
 * AND no children) get their own section or fall under "Other Steps".
 *
 * Per card, the same log workflow as medical records: pick status from a
 * dropdown (custom options if the step defines them, else the default
 * CHECKLIST_STEP_STATUSES set), set date, optional note, "+ Log" appends a
 * timestamped entry. History always visible (oldest → newest), edit/delete
 * per row.
 *
 * Persistence: writes into the same `_checklistTracking[stepId]` shape the
 * legacy TrackingTable used (`status`, `history`). We ALSO write a
 * normalized `log` array for richer editing — read path merges both so
 * pre-existing data shows up.
 */

// Default status options used when a step doesn't define its own dropdown.
const DEFAULT_PILLS = CHECKLIST_STEP_STATUSES

// Statuses that count as "done" for progress bar + auto-collapse.
const TERMINAL_STATUSES = new Set(['complete', 'na', 'skipped'])

const COMPLETE_BUCKET = new Set(['complete'])
const SKIP_BUCKET     = new Set(['na', 'skipped'])

// Pick an icon for a section based on keyword match against its label.
// Order matters — earlier rules win on overlap (so "delivery" beats a generic
// pregnancy match, "legal" beats a generic "clearance" match, etc.).
// Anything not matched falls through to a generic check.
function iconForSection(label) {
  const l = String(label || '').toLowerCase()
  if (l.includes('introduction') || l.includes('background')) return Handshake
  if (l.includes('embryo transfer') || l.includes('transfer')) return Syringe
  if (l.includes('heartbeat') || l.includes('chb')) return HeartPulse
  if (l.includes('delivery')) return Hospital
  if (l.includes('final payment')) return Receipt
  if (l.includes('insurance')) return IdCard
  if (l.includes('legal') || l.includes('attorney') || l.includes('contract')) return Scale
  if (l.includes('medical') || l.includes('clinic') || l.includes('clearance')) return Stethoscope
  if (l.includes('escrow')) return DollarSign
  if (l.includes('jenny') || l.includes('check-in') || l.includes('check in') || l.includes('psych') || l.includes('therap')) return Brain
  if (l.includes('pregnan') || l.includes('birth') || l.includes('post-partum') || l.includes('postpartum')) return Baby
  return Check
}

function statusColors(status) {
  if (SKIP_BUCKET.has(status))     return { row: 'bg-stone-100/70',   badge: 'bg-stone-100/70 text-stone-400' }
  if (COMPLETE_BUCKET.has(status)) return { row: 'bg-emerald-50/70',  badge: 'bg-emerald-100 text-emerald-700' }
  if (status === 'not_started')    return { row: 'bg-white',          badge: 'bg-stone-100 text-stone-500' }
  // In progress (anything that's been started but not finalized) → blue
  return                                { row: 'bg-sky-50/70',     badge: 'bg-sky-100 text-sky-700' }
}

function todayIsoDate() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function isoDatePart(iso) {
  if (!iso) return ''
  const m = String(iso).match(/^(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : ''
}

function formatLogDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`
}

function initialsOf(name) {
  if (!name) return '—'
  const parts = String(name).trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// Resolve the display label for a status id. For dropdown steps, the saved
// status is the underlying lifecycle value (e.g. 'in_progress') while we want
// to show the option's display label (e.g. "Joint Psych Completed by Clinic").
// Tracking entries can carry `_optionLabel` to remember which option was picked.
function statusLabel(id, optionLabel) {
  if (optionLabel) return optionLabel
  // 'na' is reused as the underlying status for the Skip action, so reframe
  // the pill label as "Skipped" in this UI (the data id stays 'na').
  if (id === 'na') return 'Skipped'
  return DEFAULT_PILLS.find(p => p.id === id)?.label || (id || '').replace(/_/g, ' ')
}

export default function JourneyChecklistView({ steps, tracking = {}, onUpdate, onStatusLog, currentUserName, stageLabel = 'Journey Checklist' }) {
  // Build sections from config + index of case-specific subtasks per parent.
  // Subtasks are stored in tracking with _isCaseSubtask=true (matches the
  // legacy TrackingTable shape so historical data still loads). Each subtask
  // also carries an `_order` field used for stable sort + reorder.
  const { sections, subtasksByParent } = useMemo(() => {
    const base = buildSections(steps)
    const byParent = {}
    // Dynamic sections (case subtasks marked _dynamicIsSection) get rendered
    // as their own top-level sections, inserted right after their anchor.
    const dynamicSections = []
    for (const [key, val] of Object.entries(tracking || {})) {
      if (!val?._isCaseSubtask || val?._deleted) continue
      if (val._dynamicIsSection) {
        dynamicSections.push({ id: key, val })
        continue
      }
      const pid = val._parentId
      if (!byParent[pid]) byParent[pid] = []
      byParent[pid].push({
        id: key,
        label: val._label || key,
        _isCaseSubtask: true,
        _parentId: pid,
        _order: typeof val._order === 'number' ? val._order : 0,
        // Honor logType + options stored on the tracking entry so dynamic
        // mirrors of config steps preserve custom-dropdown behavior.
        logType: val._logType,
        options: val._options,
      })
    }
    for (const list of Object.values(byParent)) {
      list.sort((a, b) => a._order - b._order || String(a.id).localeCompare(String(b.id)))
    }
    // Layout dynamic sections interleaved by index: for each attempt N,
    // emit Transfer #N then CHB #N as a pair, after the LAST relevant
    // anchor in base. Result becomes:
    //   Transfer #1 → CHB #1 → Transfer #2 → CHB #2 → Transfer #3 → CHB #3
    if (dynamicSections.length > 0) {
      const wrapped = dynamicSections.map(({ id, val }) => ({
        id,
        label: val._label || id,
        cards: [],
        _isDynamicSection: true,
        _dynamicIndex: val._dynamicIndex || 0,
        _dynamicKind: val._dynamicKind,
        _dynamicAnchorId: val._dynamicAnchorId,
      }))
      // Group by index (2, 3, ...) and within each index put transfer first.
      const byIndex = {}
      for (const sec of wrapped) {
        if (!byIndex[sec._dynamicIndex]) byIndex[sec._dynamicIndex] = []
        byIndex[sec._dynamicIndex].push(sec)
      }
      const indices = Object.keys(byIndex).map(Number).sort((a, b) => a - b)
      const orderedDynamic = []
      for (const n of indices) {
        const group = byIndex[n].sort((a, b) => {
          if (a._dynamicKind === b._dynamicKind) return 0
          return a._dynamicKind === 'transfer' ? -1 : 1
        })
        orderedDynamic.push(...group)
      }
      // Insert at the position right after the LAST anchor that exists in base.
      const anchorIds = new Set(wrapped.map(s => s._dynamicAnchorId).filter(Boolean))
      let insertAfter = -1
      base.forEach((sec, i) => { if (anchorIds.has(sec.id)) insertAfter = i })
      const result = insertAfter >= 0
        ? [...base.slice(0, insertAfter + 1), ...orderedDynamic, ...base.slice(insertAfter + 1)]
        : [...base, ...orderedDynamic]
      return { sections: result, subtasksByParent: byParent }
    }
    return { sections: base, subtasksByParent: byParent }
  }, [steps, tracking])

  const allCardSteps = useMemo(() => sections.flatMap(s => [
    ...s.cards,
    ...s.cards.flatMap(c => subtasksByParent[c.id] || []),
  ]), [sections, subtasksByParent])

  const counts = useMemo(() => ({
    total: allCardSteps.length,
    complete: allCardSteps.filter(s => TERMINAL_STATUSES.has(tracking[s.id]?.status || 'not_started')).length,
  }), [allCardSteps, tracking])

  // The first not-fully-complete section is the "default" — expanded by default.
  // Recomputed every render so when a section becomes fully complete, the next
  // not-fully-complete section takes over (the just-completed one collapses,
  // the next one expands). Mirrors the per-step auto-progression but at the
  // section level.
  const defaultExpandedSectionId = useMemo(() => {
    for (const sec of sections) {
      const sectionAllSteps = [...sec.cards, ...(subtasksByParent[sec.id] || [])]
      const allComplete = sectionAllSteps.length > 0 && sectionAllSteps.every(c =>
        TERMINAL_STATUSES.has(tracking[c.id]?.status || 'not_started')
      )
      if (!allComplete) return sec.id
    }
    return null
  }, [sections, subtasksByParent, tracking])

  if (allCardSteps.length === 0) {
    return <p className="text-sm text-stone-400 text-center py-8">No checklist steps configured for this stage.</p>
  }

  return (
    <div className="space-y-4">
      {/* Header — clean, no card. Title in serif (matches profile aesthetic) +
          progress bar below. */}
      <div className="px-1">
        <div className="flex items-baseline justify-between gap-4 mb-2">
          <h2 className="font-heading font-black text-2xl text-[#283693] tracking-tight">
            {stageLabel}
          </h2>
          <p className="text-sm font-bold text-stone-600 tabular-nums shrink-0">
            {counts.complete} <span className="text-stone-400 font-medium">/ {counts.total} complete</span>
          </p>
        </div>
        <div className="h-1.5 rounded-full bg-stone-100 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${counts.total > 0 ? (counts.complete / counts.total) * 100 : 0}%`,
              background: counts.complete === counts.total ? '#10b981' : 'linear-gradient(90deg, #283693, #ed148c)',
            }}
          />
        </div>
      </div>

      <div className="space-y-3">
        {sections.map((section, sectionIdx) => (
          <ChecklistSection
            key={section.id}
            section={section}
            sectionNumber={sectionIdx + 1}
            subtasksByParent={subtasksByParent}
            tracking={tracking}
            onUpdate={onUpdate}
            onStatusLog={onStatusLog}
            currentUserName={currentUserName}
            isDefaultExpanded={section.id === defaultExpandedSectionId}
          />
        ))}
      </div>
    </div>
  )
}

// Section wraps a parent step's children with a collapsible header. Header
// turns green when every child is in a terminal state, otherwise it stays
// in the lighter pink. Right side shows the most recent log timestamp
// across all child steps so admins can scan section-level activity.
function ChecklistSection({ section, sectionNumber = 1, subtasksByParent = {}, tracking, onUpdate, onStatusLog, currentUserName, isDefaultExpanded = false }) {
  // Unified ordered list of config-defined steps + admin-added section-level
  // steps. Each item has an `_sortKey`:
  //   - config step at config index N → _sortKey = N
  //   - admin-added step → _sortKey = its `_order` field (bumped to be just
  //     after the last config step on first add, fractional when interleaved)
  // Admin steps can be reordered freely within this combined list — including
  // moving them above config-defined steps. Config steps stay put relative
  // to each other (their virtual indices never change).
  const adminSteps = subtasksByParent[section.id] || []
  const orderedSteps = useMemo(() => {
    const items = []
    section.cards.forEach((card, idx) => {
      items.push({ ...card, _sortKey: idx, _isConfig: true })
    })
    const lastConfigIdx = section.cards.length - 1
    adminSteps.forEach(sub => {
      // Default _order for unmigrated admin steps: place them at the end of
      // the section (greater than any config index). Once the user reorders,
      // their _order becomes a fractional number relative to config indices.
      const order = typeof sub._order === 'number' && sub._order < lastConfigIdx + 1000
        ? sub._order
        : (lastConfigIdx + 1 + (sub._order || 0) / 1e15)
      items.push({ ...sub, _sortKey: order, _isConfig: false })
    })
    items.sort((a, b) => a._sortKey - b._sortKey)
    return items
  }, [section.cards, adminSteps])

  const allComplete = orderedSteps.length > 0 && orderedSteps.every(c => TERMINAL_STATUSES.has(tracking[c.id]?.status || 'not_started'))
  // Per-section "next to do" step. Includes the section's own cards plus any
  // legacy per-step subtasks (so completing a subtask advances to the next
  // subtask within this section). Recomputed on every render so completing
  // a step naturally advances the in-section flow — but does NOT affect the
  // OTHER sections (each section computes its own slot, independently).
  const sectionDefaultStepId = useMemo(() => {
    // Walk the merged ordered list (config + admin), and within each config
    // step check its legacy per-step subtasks too.
    for (const item of orderedSteps) {
      const st = tracking[item.id]?.status || 'not_started'
      if (!TERMINAL_STATUSES.has(st)) return item.id
      if (item._isConfig) {
        for (const sub of (subtasksByParent[item.id] || [])) {
          const subSt = tracking[sub.id]?.status || 'not_started'
          if (!TERMINAL_STATUSES.has(subSt)) return sub.id
        }
      }
    }
    return null
  }, [orderedSteps, subtasksByParent, tracking])
  const [addingStep, setAddingStep] = useState(false)
  const [stepLabel, setStepLabel] = useState('')
  function commitNewStep() {
    const trimmed = stepLabel.trim()
    if (!trimmed) { setAddingStep(false); return }
    const subId = `csub_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    onUpdate(subId, {
      status: 'not_started',
      _isCaseSubtask: true,
      _parentId: section.id,
      _label: trimmed,
      _order: Date.now(), // sorts to bottom; reorder controls let admins shuffle
    })
    setStepLabel('')
    setAddingStep(false)
  }
  // Reorder an admin-added section-level step within the merged ordered list
  // (which interleaves config + admin steps). The neighbor in the sort order
  // could be either a config step or another admin step:
  //   - neighbor is admin: swap their _order values
  //   - neighbor is config: set the admin step's _order to the config step's
  //     virtual index ± 0.5 to slot it just before/after that config step.
  // Per-step legacy subtasks (parentId = some child step id) reorder among
  // their step-level siblings only — they don't interleave with config.
  function reorderSubtask(subtaskId, direction) {
    // Section-level admin step path
    const inSection = orderedSteps.findIndex(s => s.id === subtaskId)
    if (inSection !== -1) {
      const targetIdx = direction === 'up' ? inSection - 1 : inSection + 1
      if (targetIdx < 0 || targetIdx >= orderedSteps.length) return
      const me = orderedSteps[inSection]
      const neighbor = orderedSteps[targetIdx]
      if (neighbor._isConfig) {
        // Slot just before/after the config step: fractional offset
        const newOrder = direction === 'up' ? neighbor._sortKey - 0.5 : neighbor._sortKey + 0.5
        onUpdate(me.id, { ...(tracking[me.id] || {}), _order: newOrder })
      } else {
        // Both admin — swap _order values
        const meOrder = me._sortKey
        const neighborOrder = neighbor._sortKey
        onUpdate(me.id, { ...(tracking[me.id] || {}), _order: neighborOrder })
        onUpdate(neighbor.id, { ...(tracking[neighbor.id] || {}), _order: meOrder })
      }
      return
    }
    // Legacy per-step subtask path (parentId = child step id)
    const allOtherSubs = Object.values(subtasksByParent).flat().find(s => s.id === subtaskId)
    if (!allOtherSubs) return
    const siblings = subtasksByParent[allOtherSubs._parentId] || []
    const idx = siblings.findIndex(s => s.id === subtaskId)
    if (idx === -1) return
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= siblings.length) return
    const neighbor = siblings[targetIdx]
    onUpdate(allOtherSubs.id, { ...(tracking[allOtherSubs.id] || {}), _order: neighbor._order })
    onUpdate(neighbor.id, { ...(tracking[neighbor.id] || {}), _order: allOtherSubs._order })
  }
  const lastLogIso = useMemo(() => {
    let latest = ''
    for (const card of section.cards) {
      const entry = tracking[card.id] || {}
      const logs = Array.isArray(entry.log) ? entry.log : []
      const history = Array.isArray(entry.history) ? entry.history : []
      for (const l of logs) {
        const v = l.changed_at || ''
        if (v > latest) latest = v
      }
      for (const h of history) {
        const v = h.date || h.changed_at || ''
        if (v > latest) latest = v
      }
    }
    return latest
  }, [section.cards, tracking])

  // Section default expansion: only the FIRST not-fully-complete section is
  // expanded by default. When a section transitions to fully complete, drop
  // the manual override so it collapses and the next section's
  // isDefaultExpanded flips true → it expands. Same auto-progression pattern
  // as StepRow within a section. User clicks always win.
  const [manualExpanded, setManualExpanded] = useState(null)
  const expanded = manualExpanded === null ? isDefaultExpanded : manualExpanded
  const wasAllCompleteRef = useRef(allComplete)
  useEffect(() => {
    if (!wasAllCompleteRef.current && allComplete) {
      setManualExpanded(null)
    }
    wasAllCompleteRef.current = allComplete
  }, [allComplete])

  const headerColor = allComplete
    ? 'text-emerald-600'
    : 'text-[#283693]'

  return (
    <section>
      {/* Magazine-style header: big pink number + icon + serif title + pink
          accent underline. Mirrors the profile sections the user loves. The
          underline is only drawn on non-complete sections so completed
          sections sit visually together with the next-up one below. */}
      <div className={`flex items-baseline gap-3 mb-2 ${allComplete ? 'pb-1' : 'pb-2 border-b-2 border-[#ed148c]/20'} group`}>
        <span className={`text-3xl font-heading font-black leading-none tabular-nums shrink-0 inline-block w-10 text-center ${allComplete ? 'text-emerald-500/70' : 'text-[#ed148c]/60'}`}>
          {sectionNumber}
        </span>
        {(() => { const Icon = iconForSection(section.label); return <Icon className={`size-4 shrink-0 ${allComplete ? 'text-emerald-500' : 'text-[#ed148c]'}`} /> })()}
        <div className="flex-1 min-w-0 flex items-baseline gap-2 flex-wrap">
          <h3
            className={`text-xl font-heading font-black tracking-tight cursor-pointer hover:opacity-80 transition-opacity ${headerColor}`}
            onClick={() => setManualExpanded(!expanded)}
          >
            {section.label}
            {allComplete && <Check className="size-4 inline ml-1.5 -mt-0.5" strokeWidth={3} />}
          </h3>
          {allComplete && lastLogIso && (
            <span className="text-[11px] font-semibold text-emerald-600">
              completed {formatLogDate(lastLogIso)}
            </span>
          )}
        </div>
        {/* + Add Step — sits right next to the section header */}
        {addingStep ? (
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              autoFocus
              value={stepLabel}
              onChange={e => setStepLabel(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') commitNewStep(); if (e.key === 'Escape') { setAddingStep(false); setStepLabel('') } }}
              placeholder="Step label…"
              className="text-xs rounded border border-[#283693]/30 bg-white px-2 py-0.5 outline-none focus:border-[#283693] min-w-[180px]"
            />
            <button onClick={() => { setAddingStep(false); setStepLabel('') }} className="text-[10px] text-stone-500 hover:text-stone-700">Cancel</button>
            <button onClick={commitNewStep} disabled={!stepLabel.trim()} className="text-[10px] font-semibold text-white bg-[#283693] hover:bg-[#1f2a73] disabled:bg-stone-300 rounded px-2 py-0.5">Add</button>
          </div>
        ) : (
          <button
            onClick={() => setAddingStep(true)}
            className="text-stone-300 hover:text-[#283693] font-semibold shrink-0"
            title="Add a step to this section"
          >
            <Plus className="size-4" />
          </button>
        )}
      </div>
      {expanded && (
        <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden divide-y divide-stone-100">
          {orderedSteps.map((step, i) => {
            const isAdmin = !step._isConfig
            // Admin (case-added or dynamic) steps can host subtasks too — needed
            // so dynamic "Transfer #2" displays its mirrored subtasks.
            const subs = subtasksByParent[step.id] || []
            return (
              <div key={step.id} className="divide-y divide-stone-100">
                <StepRow
                  step={step}
                  tracking={tracking}
                  onUpdate={onUpdate}
                  onStatusLog={onStatusLog}
                  currentUserName={currentUserName}
                  isDefaultExpanded={step.id === sectionDefaultStepId}
                  childStepIds={subs.map(s => s.id)}
                  // Reorder is only allowed on admin-added steps. Up/down move
                  // the admin step within the merged config+admin list — they
                  // can interleave with config steps.
                  onMoveUp={isAdmin && i > 0 ? () => reorderSubtask(step.id, 'up') : null}
                  onMoveDown={isAdmin && i < orderedSteps.length - 1 ? () => reorderSubtask(step.id, 'down') : null}
                />
                {/* Legacy per-step subtasks: render under their config parent
                    step (still indented + reorderable among siblings). */}
                {subs.map((sub, j) => (
                  <StepRow
                    key={sub.id}
                    step={sub}
                    tracking={tracking}
                    onUpdate={onUpdate}
                    onStatusLog={onStatusLog}
                    currentUserName={currentUserName}
                    isDefaultExpanded={sub.id === sectionDefaultStepId}
                    indented
                    onMoveUp={j > 0 ? () => reorderSubtask(sub.id, 'up') : null}
                    onMoveDown={j < subs.length - 1 ? () => reorderSubtask(sub.id, 'down') : null}
                  />
                ))}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

// Group flat steps into rendering sections.
//   - Parent steps (have children OR are explicitly type=section): become a
//     section header. Their children become cards inside.
//   - Standalone steps (no parentId, no children): grouped under "Other Steps".
function buildSections(steps) {
  const childrenByParent = {}
  for (const s of steps) {
    if (s.parentId) {
      if (!childrenByParent[s.parentId]) childrenByParent[s.parentId] = []
      childrenByParent[s.parentId].push(s)
    }
  }
  const sections = []
  const orphans = []
  const seenChildren = new Set()
  for (const s of steps) {
    if (s.parentId) continue // children rendered under their parent
    const children = childrenByParent[s.id] || []
    if (children.length > 0) {
      sections.push({ id: s.id, label: s.label, cards: children })
      for (const c of children) seenChildren.add(c.id)
    } else {
      orphans.push(s)
    }
  }
  // Sweep up any children whose parent is missing (defensive)
  for (const s of steps) {
    if (s.parentId && !seenChildren.has(s.id)) {
      const parentExists = steps.some(p => p.id === s.parentId)
      if (!parentExists) orphans.push(s)
    }
  }
  if (orphans.length > 0) {
    sections.push({ id: '_other', label: 'Other Steps', cards: orphans })
  }
  return sections
}

function StepRow({ step, tracking, onUpdate, onStatusLog, currentUserName, isDefaultExpanded, onMoveUp, onMoveDown, indented = false, childStepIds = [] }) {
  const entry = tracking[step.id] || {}
  const status = entry.status || 'not_started'
  const colors = statusColors(status)
  const isComplete = TERMINAL_STATUSES.has(status)
  // `_isCaseSubtask` flags admin-added steps — drives delete/reorder eligibility.
  // `indented` is purely visual: true only for legacy per-step subtasks rendered
  // under their parent step; false for section-level admin "steps" which sit at
  // the same hierarchy as config-defined steps.
  const isSubtask = step._isCaseSubtask === true

  // Default-expand only the FIRST non-terminal step in the whole checklist.
  // Everything else collapsed so the view is tidy on first render. Manual
  // toggle still wins — except when the step transitions to a terminal
  // state, in which case we drop the manual override so it collapses and
  // the next non-terminal step naturally takes over the "default expanded"
  // slot (since defaultExpandedStepId in the parent advances).
  const [manualExpanded, setManualExpanded] = useState(null)
  const expanded = manualExpanded === null ? isDefaultExpanded : manualExpanded
  const wasCompleteRef = useRef(isComplete)
  useEffect(() => {
    if (!wasCompleteRef.current && isComplete) {
      setManualExpanded(null)
    }
    wasCompleteRef.current = isComplete
  }, [isComplete])

  // Subtask delete (only relevant on subtask rows)
  function deleteSubtaskSelf() {
    // Soft-delete to preserve any prior tracking history; matches TrackingTable behavior.
    onUpdate(step.id, { ...entry, _deleted: true })
  }

  // Inline rename
  const [editingLabel, setEditingLabel] = useState(false)
  const [labelDraft, setLabelDraft] = useState(entry.customLabel || step.label)

  // Log inputs (always-visible inline row, except for completed steps where
  // it's gated behind a "+ Add log" affordance to keep the row tidy)
  const [newLogStatus, setNewLogStatus] = useState('')
  const [newLogDate, setNewLogDate] = useState(todayIsoDate())
  const [newLogNote, setNewLogNote] = useState('')
  const [showLogRow, setShowLogRow] = useState(false)
  const logRowVisible = !isComplete || showLogRow

  // History edit state
  const [editingLogId, setEditingLogId] = useState(null)
  const [editLogDate, setEditLogDate] = useState('')
  const [editLogNote, setEditLogNote] = useState('')
  const [pendingDeleteId, setPendingDeleteId] = useState(null)

  // Pill options: custom dropdown options if defined, else default lifecycle pills.
  const pillOptions = useMemo(() => {
    if (step.logType === 'dropdown' && step.options?.length > 0) {
      return normalizeOptions(step.options).map((o, i) => ({
        id: `__opt_${i}_${o.label}`,
        label: o.label,
        mapsTo: o.mapsTo || 'in_progress',
      }))
    }
    return DEFAULT_PILLS
  }, [step.logType, step.options])

  // Read path: merge legacy entry.history with new entry.log so pre-revamp
  // checklist data renders correctly. Write paths clear entry.history when
  // writing entry.log to avoid double-counting.
  const log = useMemo(() => {
    const newLog = Array.isArray(entry.log) ? entry.log : []
    const legacyHistory = Array.isArray(entry.history) ? entry.history : []
    if (newLog.length === 0 && legacyHistory.length === 0) return []
    const normalizedLegacy = legacyHistory
      .filter(h => h && !h._deactivate)
      .map((h, i) => ({
        id: h.id || `_legacy_${i}`,
        status: h.status,
        optionLabel: h.optionLabel || h._optionLabel || '',
        from: '',
        changed_at: h.date || h.changed_at || '',
        changed_by: h.by || h.changed_by || '',
        note: h.note || '',
      }))
    const merged = [...normalizedLegacy, ...newLog]
    merged.sort((a, b) => String(a.changed_at).localeCompare(String(b.changed_at)))
    return merged
  }, [entry.log, entry.history])

  function commitLabel() {
    const trimmed = (labelDraft || '').trim()
    const current = entry.customLabel || step.label
    if (trimmed && trimmed !== current) {
      onUpdate(step.id, { ...entry, customLabel: trimmed })
    }
    setEditingLabel(false)
  }

  function addNewLog() {
    if (!newLogStatus) return
    const isoFromDate = `${newLogDate}T${new Date().toTimeString().slice(0, 8)}Z`
    // newLogStatus might be a real lifecycle id (from DEFAULT_PILLS) or a
    // synthesized __opt_* id from a custom dropdown — resolve the real status
    // and remember the picked option's display label.
    let resolvedStatus = newLogStatus
    let optionLabel = ''
    const opt = pillOptions.find(p => p.id === newLogStatus)
    if (opt && opt.id.startsWith('__opt_')) {
      resolvedStatus = opt.mapsTo || 'in_progress'
      optionLabel = opt.label
    }
    const newLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      status: resolvedStatus,
      optionLabel,
      from: status,
      changed_at: isoFromDate,
      changed_by: currentUserName,
      note: newLogNote || '',
    }
    onUpdate(step.id, {
      ...entry,
      status: resolvedStatus,
      _optionLabel: optionLabel || undefined,
      log: [...log, newLog],
      history: [],
    })
    if (onStatusLog) onStatusLog({ stepLabel: entry.customLabel || step.label, status: resolvedStatus, optionLabel, date: newLogDate })
    setNewLogStatus('')
    setNewLogDate(todayIsoDate())
    setNewLogNote('')
  }

  // Skip — fast-forward icon click. Marks this step as N/A (and cascades to
  // any children for parent steps) so it disappears from "to do" without
  // being treated as complete. Children that are already terminal are left
  // alone (don't overwrite a completed subtask just because we skipped the
  // parent).
  function skipStep() {
    if (status === 'na' || status === 'complete') return
    const today = todayIsoDate()
    const isoFromDate = `${today}T${new Date().toTimeString().slice(0, 8)}Z`
    const writeSkip = (sid, sentry) => {
      const sLog = Array.isArray(sentry.log) ? sentry.log : []
      const skipLog = {
        id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        status: 'na',
        optionLabel: '',
        from: sentry.status || 'not_started',
        changed_at: isoFromDate,
        changed_by: currentUserName,
        note: 'Skipped',
      }
      onUpdate(sid, { ...sentry, status: 'na', log: [...sLog, skipLog], history: [] })
    }
    writeSkip(step.id, entry)
    // Cascade to children — but never demote a completed/skipped child.
    for (const cid of childStepIds) {
      const ce = tracking[cid] || {}
      if (ce.status === 'complete' || ce.status === 'na') continue
      writeSkip(cid, ce)
    }
    if (onStatusLog) onStatusLog({ stepLabel: entry.customLabel || step.label, status: 'na', optionLabel: '', date: today })
  }

  function startEditLog(logEntry) {
    setEditingLogId(logEntry.id || logEntry._idx)
    // Preserve the original date — never silently fall back to today on edit.
    setEditLogDate(isoDatePart(logEntry.changed_at) || '')
    setEditLogNote(logEntry.note || '')
  }
  function saveEditLog() {
    if (!editingLogId) return
    const newList = log.map((l, idx) => {
      const id = l.id || `_idx_${idx}`
      if (id !== editingLogId) return l
      // Only rewrite changed_at if the user actually edited the date. Otherwise
      // preserve the original timestamp so editing a note doesn't bump the
      // entry to "today".
      const originalDatePart = isoDatePart(l.changed_at)
      const userEditedDate = editLogDate && editLogDate !== originalDatePart
      const next = { ...l, note: editLogNote }
      if (userEditedDate) {
        next.changed_at = `${editLogDate}T${new Date().toTimeString().slice(0, 8)}Z`
      }
      return next
    })
    onUpdate(step.id, { ...entry, log: newList, history: [] })
    setEditingLogId(null)
  }
  function cancelEditLog() { setEditingLogId(null) }

  function deleteLog(logEntry) {
    const id = logEntry.id || logEntry._idx
    const newList = log.filter((l, idx) => (l.id || `_idx_${idx}`) !== id)
    let newStatus = entry.status
    let newOptionLabel = entry._optionLabel
    if (newList.length !== log.length) {
      const last = newList[newList.length - 1]
      newStatus = last?.status || 'not_started'
      newOptionLabel = last?.optionLabel || undefined
    }
    onUpdate(step.id, { ...entry, status: newStatus, _optionLabel: newOptionLabel, log: newList, history: [] })
  }

  return (
    <div className={`${colors.row} transition-colors group/row`}>
      {/* HEADER ROW — clicking the row toggles expand. No chevron — the whole
          row is the affordance. Subtask rows render with a left indent + small
          arrow icon so the parent/child hierarchy is obvious. */}
      <div
        className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:brightness-[0.98] transition ${indented ? 'pl-10' : ''}`}
        onClick={(e) => {
          if (e.target.closest('input, button, a, select, textarea')) return
          setManualExpanded(!expanded)
        }}
      >
        {indented && <CornerDownRight className="size-3.5 text-stone-400 shrink-0 -ml-2" />}
        {/* Title (auto width) followed immediately by status pill — they sit
            together on the left, no awkward stretched empty space in between.
            Hover affordances drift to the far right via ml-auto. */}
        {editingLabel ? (
          <InlineEditInput
            value={labelDraft}
            onChange={setLabelDraft}
            onCommit={commitLabel}
            onCancel={() => { setEditingLabel(false); setLabelDraft(entry.customLabel || step.label) }}
            className={`${indented ? 'text-xs' : 'text-sm'} font-semibold text-stone-500`}
            autoFocus
          />
        ) : (
          <h4
            className={`${indented ? 'text-xs' : 'text-sm'} font-semibold text-stone-500 leading-tight cursor-text hover:underline decoration-dotted decoration-stone-300 underline-offset-4 truncate`}
            title={step.locked ? '' : 'Click to rename'}
            onClick={(e) => { e.stopPropagation(); if (!step.locked) { setEditingLabel(true); setLabelDraft(entry.customLabel || step.label) } }}
          >
            {entry.customLabel || step.label}
          </h4>
        )}
        {/* Status pill — sits right after the title (any state, including
            "Not Started", so the row's status is unambiguous). */}
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0 inline-flex items-center gap-1.5 ${colors.badge}`}>
          <span>{status === 'not_started' ? 'Not Started' : statusLabel(status, entry._optionLabel)}</span>
          {log.length > 0 && (
            <span className="opacity-70 font-medium normal-case tracking-normal">
              · {formatLogDate(log[log.length - 1].changed_at)}
            </span>
          )}
        </span>
        {/* Right-side row actions. Skip is shown on every row that's not
            already terminal. Subtask rows additionally get reorder + delete. */}
        <span className="ml-auto flex items-center gap-0.5 shrink-0">
          {status !== 'na' && status !== 'complete' && (
            <button
              onClick={(e) => { e.stopPropagation(); skipStep() }}
              className="p-0.5 text-stone-200 hover:text-stone-700 hover:bg-stone-100 rounded transition-colors"
              title="Skip (mark N/A)"
            >
              <FastForward className="size-3.5" />
            </button>
          )}
          {isSubtask && (
            <span className="flex items-center gap-0.5 opacity-70 group-hover/row:opacity-100 transition-opacity">
              <button
                onClick={(e) => { e.stopPropagation(); onMoveUp && onMoveUp() }}
                disabled={!onMoveUp}
                className="p-0.5 text-stone-500 hover:text-[#283693] hover:bg-[#283693]/5 rounded disabled:text-stone-200 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                title={onMoveUp ? 'Move up' : 'Already at top'}
              >
                <ChevronUp className="size-3.5" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onMoveDown && onMoveDown() }}
                disabled={!onMoveDown}
                className="p-0.5 text-stone-500 hover:text-[#283693] hover:bg-[#283693]/5 rounded disabled:text-stone-200 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                title={onMoveDown ? 'Move down' : 'Already at bottom'}
              >
                <ChevronDown className="size-3.5" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); deleteSubtaskSelf() }}
                className="p-0.5 text-stone-500 hover:text-red-500 hover:bg-red-50 rounded ml-1"
                title="Delete"
              >
                <Trash2 className="size-3" />
              </button>
            </span>
          )}
        </span>
      </div>

      {/* EXPANDED BODY — log row at TOP, history below */}
      {expanded && (
        <div className="px-4 pb-3 space-y-2">
          {/* New log row — primary action, sits at the top.
              When the step is already complete we hide it behind a "+ Add log"
              link to keep the layout tidy (admins rarely add new logs to a
              done step, but they should still be able to). */}
          {logRowVisible ? (
            <div className="flex flex-col sm:flex-row gap-1.5 sm:items-center rounded-lg border border-stone-200 bg-stone-50/40 p-1.5 focus-within:border-[#283693] focus-within:bg-white">
              <select
                value={newLogStatus}
                onChange={e => setNewLogStatus(e.target.value)}
                className="text-xs rounded border border-stone-200 bg-white px-2 py-1.5 outline-none focus:border-[#283693] min-w-[160px]"
              >
                <option value="">Choose status…</option>
                {pillOptions.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
              <input
                type="date"
                value={newLogDate}
                onChange={e => setNewLogDate(e.target.value)}
                className="text-xs rounded border border-stone-200 bg-white px-2 py-1.5 outline-none focus:border-[#283693]"
                title="Log date"
              />
              <input
                type="text"
                value={newLogNote}
                onChange={e => setNewLogNote(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && newLogStatus) addNewLog() }}
                placeholder="Optional note…"
                className="flex-1 text-xs rounded border border-stone-200 bg-white px-2 py-1.5 outline-none focus:border-[#283693]"
              />
              <button
                onClick={addNewLog}
                disabled={!newLogStatus}
                className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-[#283693] hover:bg-[#1f2a73] disabled:bg-stone-300 disabled:cursor-not-allowed rounded-lg px-3 py-1.5 transition-colors shrink-0"
              >
                <Plus className="size-3.5" /> Log
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowLogRow(true)}
              className="inline-flex items-center gap-1 text-[11px] text-stone-400 hover:text-[#283693] font-medium px-1"
            >
              <Plus className="size-3" /> Add log
            </button>
          )}

          {/* History — compact list under the log row */}
          {log.length > 0 && (
            <ul className="space-y-1 border-l-2 border-stone-200 pl-2.5">
              {log.map((l, idx) => {
                const stableId = l.id || `_idx_${idx}`
                const withIdx = { ...l, _idx: stableId }
                const isEditing = editingLogId === stableId
                if (isEditing) {
                  return (
                    <li key={stableId} className="rounded-lg border border-[#283693]/30 bg-[#283693]/5 p-2 space-y-1.5">
                      <p className="text-[10px] font-bold text-[#283693] uppercase tracking-wider">Editing · {statusLabel(l.status, l.optionLabel)}</p>
                      <div className="flex flex-col sm:flex-row gap-1.5 sm:items-center">
                        <input type="date" value={editLogDate} onChange={e => setEditLogDate(e.target.value)} className="text-xs rounded border border-stone-200 bg-white px-2 py-1 outline-none focus:border-[#283693]" />
                        <input type="text" value={editLogNote} onChange={e => setEditLogNote(e.target.value)} placeholder="Note…" className="flex-1 text-xs rounded border border-stone-200 bg-white px-2 py-1 outline-none focus:border-[#283693]" />
                        <div className="flex gap-1">
                          <button onClick={cancelEditLog} className="text-[11px] text-stone-500 hover:text-stone-700 px-2 py-1">Cancel</button>
                          <button onClick={saveEditLog} className="text-[11px] font-semibold text-white bg-[#283693] rounded px-2.5 py-1">Save</button>
                        </div>
                      </div>
                    </li>
                  )
                }
                return (
                  <li key={stableId} className="group flex items-start gap-2 text-[11px]">
                    <span className="flex-1 min-w-0">
                      <span className="font-semibold text-stone-700">{statusLabel(l.status, l.optionLabel)}</span>
                      <span className="ml-1.5 text-stone-400">
                        {formatLogDate(l.changed_at)}
                        {' · '}<span title={l.changed_by || 'Unknown'}>{initialsOf(l.changed_by)}</span>
                      </span>
                      {l.note && <span className="ml-2 font-medium text-[#283693]">{l.note}</span>}
                    </span>
                    <span className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      {pendingDeleteId === stableId ? (
                        <>
                          <span className="text-[10px] text-red-500 font-semibold mr-1">Delete?</span>
                          <button onClick={() => { deleteLog(withIdx); setPendingDeleteId(null) }} className="text-[10px] font-bold text-red-500 hover:bg-red-50 px-1.5 py-0.5 rounded">Yes</button>
                          <button onClick={() => setPendingDeleteId(null)} className="text-[10px] text-stone-500 hover:bg-stone-100 px-1.5 py-0.5 rounded">No</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEditLog(withIdx)} className="p-0.5 text-stone-400 hover:text-[#283693] hover:bg-[#283693]/5 rounded" title="Edit log">
                            <Pencil className="size-3" />
                          </button>
                          <button onClick={() => setPendingDeleteId(stableId)} className="p-0.5 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded" title="Delete log">
                            <Trash2 className="size-3" />
                          </button>
                        </>
                      )}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

function InlineEditInput({ value, onChange, onCommit, onCancel, className, autoFocus, placeholder }) {
  return (
    <div className="flex items-center gap-1">
      <input
        autoFocus={autoFocus}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') onCommit(); if (e.key === 'Escape') onCancel() }}
        placeholder={placeholder}
        className={`flex-1 rounded-lg border-2 border-[#283693]/30 px-2 py-0.5 bg-white focus:border-[#283693] focus:ring-1 focus:ring-[#283693]/20 outline-none ${className}`}
      />
      <button onClick={onCommit} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"><Check className="size-3.5" /></button>
      <button onClick={onCancel} className="p-1 text-stone-400 hover:bg-stone-100 rounded"><X className="size-3.5" /></button>
    </div>
  )
}
