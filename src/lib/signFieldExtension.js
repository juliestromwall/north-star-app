// Tiptap extension for e-signature field placeholders
// Renders inline field tags like [Signature: GC] in the editor

import { Node, mergeAttributes } from '@tiptap/core'

export const FIELD_TYPES = [
  { type: 'signature', label: 'Signature', description: 'Signature pad (type or draw)' },
  { type: 'name', label: 'Full Name', description: 'Auto-filled or typed name' },
  { type: 'date', label: 'Date', description: 'Auto-filled with signing date' },
  { type: 'initials', label: 'Initials', description: 'Short initials field' },
  { type: 'checkbox', label: 'Checkbox', description: 'Clickable checkbox' },
  { type: 'text', label: 'Text Input', description: 'Free-text input field' },
]

export const FIELD_ROLES = [
  { value: 'gc', label: 'Surrogate (GC)' },
  { value: 'ip1', label: 'Intended Parent 1' },
  { value: 'ip2', label: 'Intended Parent 2' },
  { value: 'admin', label: 'Admin / Agency' },
]

const FIELD_COLORS = {
  gc: { bg: '#fce7f3', border: '#f9a8d4', text: '#9d174d' },
  ip1: { bg: '#dbeafe', border: '#93c5fd', text: '#1d4ed8' },
  ip2: { bg: '#e0e7ff', border: '#a5b4fc', text: '#4338ca' },
  admin: { bg: '#fef3c7', border: '#fcd34d', text: '#92400e' },
}

const TYPE_ICONS = {
  signature: '✍️',
  name: '👤',
  date: '📅',
  initials: '🔤',
  checkbox: '☑️',
  text: '📝',
}

export const SignField = Node.create({
  name: 'signField',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      fieldType: { default: 'signature' },
      role: { default: 'gc' },
      label: { default: '' },
      fieldId: { default: '' },
    }
  },

  parseHTML() {
    return [{ tag: 'sign-field' }]
  },

  renderHTML({ HTMLAttributes }) {
    const { fieldType, role, label, fieldId } = HTMLAttributes
    const colors = FIELD_COLORS[role] || FIELD_COLORS.gc
    const typeLabel = FIELD_TYPES.find(f => f.type === fieldType)?.label || fieldType
    const roleLabel = FIELD_ROLES.find(r => r.value === role)?.label || role
    const icon = TYPE_ICONS[fieldType] || '📋'
    const displayLabel = label || `${typeLabel}: ${roleLabel}`

    return [
      'sign-field',
      mergeAttributes(HTMLAttributes, {
        'data-field-type': fieldType,
        'data-role': role,
        'data-label': label,
        'data-field-id': fieldId,
        style: `
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 2px 8px;
          border-radius: 4px;
          border: 1.5px dashed ${colors.border};
          background: ${colors.bg};
          color: ${colors.text};
          font-size: 12px;
          font-weight: 600;
          font-family: system-ui, sans-serif;
          cursor: default;
          user-select: none;
          white-space: nowrap;
          vertical-align: middle;
          line-height: 1.6;
        `,
        contenteditable: 'false',
      }),
      `${icon} ${displayLabel}`,
    ]
  },

  addNodeView() {
    return ({ node, HTMLAttributes }) => {
      const dom = document.createElement('sign-field')
      const { fieldType, role, label } = node.attrs
      const colors = FIELD_COLORS[role] || FIELD_COLORS.gc
      const typeLabel = FIELD_TYPES.find(f => f.type === fieldType)?.label || fieldType
      const roleLabel = FIELD_ROLES.find(r => r.value === role)?.label || role
      const icon = TYPE_ICONS[fieldType] || '📋'
      const displayLabel = label || `${typeLabel}: ${roleLabel}`

      dom.setAttribute('data-field-type', fieldType)
      dom.setAttribute('data-role', role)
      dom.setAttribute('data-label', label || '')
      dom.setAttribute('data-field-id', node.attrs.fieldId || '')
      dom.style.cssText = `
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 2px 8px;
        border-radius: 4px;
        border: 1.5px dashed ${colors.border};
        background: ${colors.bg};
        color: ${colors.text};
        font-size: 12px;
        font-weight: 600;
        font-family: system-ui, sans-serif;
        cursor: default;
        user-select: none;
        white-space: nowrap;
        vertical-align: middle;
        line-height: 1.6;
      `
      dom.textContent = `${icon} ${displayLabel}`
      dom.contentEditable = 'false'

      return { dom }
    }
  },
})

// Helper: extract all sign fields from HTML string
export function extractSignFields(html) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const fields = []
  doc.querySelectorAll('sign-field').forEach((el, i) => {
    fields.push({
      fieldType: el.getAttribute('data-field-type') || 'signature',
      role: el.getAttribute('data-role') || 'gc',
      label: el.getAttribute('data-label') || '',
      fieldId: el.getAttribute('data-field-id') || `field_${i}`,
      index: i,
    })
  })
  return fields
}
