// Reconciles the journey checklist with the pregnancy tracker.
//
// Trigger model:
//   - A transfer marked unsuccessful OR with lossType (miscarriage / ectopic /
//     chemical) gets its checklist counterpart "consumed" — the next attempt
//     needs its own steps, so we duplicate the original Transfer (and CHB if
//     pregnancy was confirmed but lost) right after.
//   - droppedCycle (Cancel Cycle) does NOT trigger duplication. Admin will
//     reset the existing checklist steps manually.
//
// Result:
//   - 1 transfer step per closed transfer + 1 for the "next" / current attempt
//     (so checklist always has at least 1 Transfer step).
//   - When count > 1 the original is re-labeled "Transfer #1" and dynamic
//     copies are "Transfer #2", "#3", etc.
//   - Same for "Confirmation of Heartbeat" (only counted on lossType, since
//     unsuccessful transfers never reached heartbeat).
//   - Mirrored subtasks: each dynamic copy gets a clone of the anchor's
//     config-defined subtasks (label + logType + options preserved) so each
//     attempt can be tracked the same way.
//
// Storage:
//   - All dynamic entries live in journey_data._checklistTracking, marked
//     with _dynamicKind ('transfer' | 'chb') so we can wipe + regenerate
//     without disturbing user-added case subtasks.
//   - Anchor labels are overridden via tracking[anchorId].customLabel so
//     config never has to know about this.

const TRANSFER_LABEL_BASE = 'Transfer'
const CHB_LABEL_BASE = 'Confirmation of Heartbeat'
const PREGNANCY_LOSS_TYPES = new Set(['miscarriage', 'ectopic', 'chemical'])

function findAnchor(steps, labelMatcher) {
  // Anchor must be a child step (has parentId), so we know which section to
  // attach dynamic siblings to. If no parentId match, fall back to top-level.
  return steps.find(s => s.parentId && labelMatcher(s.label || ''))
      || steps.find(s => labelMatcher(s.label || ''))
      || null
}

function isTransferAnchor(label) {
  const l = label.toLowerCase()
  return /transfer/.test(l) && !/intro/.test(l) && !/match/.test(l)
}

function isChbAnchor(label) {
  const l = label.toLowerCase()
  return /heartbeat/.test(l) || /\bchb\b/.test(l)
}

export function syncDynamicTransferSteps(transfers, currentTracking, configSteps) {
  const tracking = { ...(currentTracking || {}) }

  // Wipe existing dynamic entries; we'll regenerate from current truth.
  for (const id of Object.keys(tracking)) {
    if (tracking[id]?._dynamicKind) delete tracking[id]
  }

  const transferAnchor = findAnchor(configSteps, isTransferAnchor)
  const chbAnchor = findAnchor(configSteps, isChbAnchor)

  const list = Array.isArray(transfers) ? transfers : []
  const transferLossCount = list.filter(t => t?.unsuccessful || t?.lossType).length
  const chbLossCount = list.filter(t => PREGNANCY_LOSS_TYPES.has(t?.lossType)).length

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
    // Cleanup: if we previously renamed but no losses now, drop customLabel
    const { customLabel, ...rest } = anchorEntry
    tracking[anchor.id] = rest
  }

  if (extras < 1) return

  // Subtasks defined in config under the anchor — mirrored verbatim under each
  // dynamic copy. Sort by their array order so the mirror order matches.
  const anchorSubtasks = configSteps.filter(s => s.parentId === anchor.id)

  for (let n = 2; n <= 1 + extras; n++) {
    const dynCardId = `_dyn_${kind}_${n}`
    tracking[dynCardId] = {
      _isCaseSubtask: true,
      _parentId: anchor.parentId || null,
      _label: `${baseLabel} #${n}`,
      _order: 1000 + (n - 1) * 0.001, // sit after config siblings, in order
      _dynamicKind: kind,
      _dynamicIndex: n,
      status: 'not_started',
    }
    anchorSubtasks.forEach((sub, j) => {
      tracking[`_dyn_${kind}_${n}_sub_${j}`] = {
        _isCaseSubtask: true,
        _parentId: dynCardId,
        _label: sub.label,
        _order: j,
        _dynamicKind: kind,
        _dynamicIndex: n,
        _logType: sub.logType || 'status',
        _options: sub.options || [],
        status: 'not_started',
      }
    })
  }
}
