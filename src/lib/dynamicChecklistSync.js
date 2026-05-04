// Reconciles the journey checklist with the pregnancy tracker.
//
// Trigger model:
//   - Mark Unsuccessful (transfers[i].unsuccessful=true) → +1 Transfer section.
//     Auto, no prompt.
//   - Pregnancy loss (lossType in miscarriage/ectopic/chemical) → +1 Transfer
//     section AND +1 Confirmation of Heartbeat section, but ONLY when the
//     admin explicitly opts in via _addNextTransferToChecklist=true on the
//     transfer entry. The Pregnancy Loss dialog asks them.
//   - Cancel Cycle (droppedCycle=true) → no duplication. Admin will reset
//     existing checklist steps manually.
//
// Layout:
//   The anchor "Transfer" / "Confirmation of Heartbeat" steps are SECTIONS
//   (top-level config steps with their own children). Dynamic copies are
//   stored as case subtasks marked _dynamicIsSection=true and rendered as
//   their own top-level sections by JourneyChecklistView. Each dynamic
//   section's children mirror the anchor's config children verbatim
//   (label + logType + options).

const TRANSFER_LABEL_BASE = 'Transfer'
const CHB_LABEL_BASE = 'Confirmation of Heartbeat'
const PREGNANCY_LOSS_TYPES = new Set(['miscarriage', 'ectopic', 'chemical'])

function isTransferSection(label) {
  const l = label.toLowerCase()
  return /transfer/.test(l) && !/intro/.test(l) && !/match/.test(l)
}

function isChbSection(label) {
  const l = label.toLowerCase()
  return /heartbeat/.test(l) || /\bchb\b/.test(l)
}

// Find the section (top-level config step that has child cards) whose label
// matches the predicate. Falls back to a child step if no top-level match.
function findSectionAnchor(configSteps, matcher) {
  const topLevel = configSteps.filter(s => !s.parentId)
  const childCount = id => configSteps.filter(s => s.parentId === id).length
  return (
    topLevel.find(s => matcher(s.label || '') && childCount(s.id) > 0)
      || topLevel.find(s => matcher(s.label || ''))
      || configSteps.find(s => matcher(s.label || ''))
      || null
  )
}

export function syncDynamicTransferSteps(transfers, currentTracking, configSteps) {
  const tracking = { ...(currentTracking || {}) }

  // Wipe existing dynamic entries; we regenerate from current truth so edits/
  // deletes/reverts in the pregnancy tracker propagate cleanly.
  for (const id of Object.keys(tracking)) {
    if (tracking[id]?._dynamicKind) delete tracking[id]
  }

  const transferAnchor = findSectionAnchor(configSteps, isTransferSection)
  const chbAnchor = findSectionAnchor(configSteps, isChbSection)

  const list = Array.isArray(transfers) ? transfers : []
  const transferLossCount = list.filter(t => (
    t?.unsuccessful || (t?.lossType && t?._addNextTransferToChecklist === true)
  )).length
  const chbLossCount = list.filter(t => (
    PREGNANCY_LOSS_TYPES.has(t?.lossType) && t?._addNextTransferToChecklist === true
  )).length

  applyAnchor(tracking, configSteps, transferAnchor, 'transfer', TRANSFER_LABEL_BASE, transferLossCount)
  applyAnchor(tracking, configSteps, chbAnchor, 'chb', CHB_LABEL_BASE, chbLossCount)

  return tracking
}

function applyAnchor(tracking, configSteps, anchor, kind, baseLabel, extras) {
  if (!anchor) return

  const anchorEntry = tracking[anchor.id] || {}
  if (extras > 0) {
    tracking[anchor.id] = { ...anchorEntry, customLabel: `${baseLabel} #1` }
  } else if (anchorEntry.customLabel === `${baseLabel} #1`) {
    const { customLabel, ...rest } = anchorEntry
    tracking[anchor.id] = rest
  }

  if (extras < 1) return

  // Children of the anchor section in config — these get mirrored as subtasks
  // under each dynamic section copy.
  const anchorChildren = configSteps.filter(s => s.parentId === anchor.id)

  for (let n = 2; n <= 1 + extras; n++) {
    const dynSectionId = `_dyn_${kind}_${n}`
    tracking[dynSectionId] = {
      _isCaseSubtask: true,
      _parentId: null,            // top-level
      _dynamicIsSection: true,
      _dynamicKind: kind,
      _dynamicIndex: n,
      _dynamicAnchorId: anchor.id, // used to position right after the anchor section
      _label: `${baseLabel} #${n}`,
      status: 'not_started',
    }
    anchorChildren.forEach((child, j) => {
      tracking[`${dynSectionId}_card_${j}`] = {
        _isCaseSubtask: true,
        _parentId: dynSectionId,
        _dynamicKind: kind,
        _dynamicIndex: n,
        _label: child.label,
        _order: j,
        _logType: child.logType || 'status',
        _options: child.options || [],
        status: 'not_started',
      }
    })
  }
}
