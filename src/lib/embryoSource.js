export const EMBRYO_SOURCE_OPTIONS = ["IM's Egg", 'Donor Egg', "IF's Sperm", 'Donor Sperm', 'Embryo Adoption', 'Unknown']

const EMBRYO_SOURCE_LABEL_MIGRATION = {
  'ip egg': "IM's Egg",
  'ip eggs': "IM's Egg",
  "im's eggs": "IM's Egg",
  "im egg": "IM's Egg",
  "im eggs": "IM's Egg",
  "intended mother's egg": "IM's Egg",
  "intended mother's eggs": "IM's Egg",
  'donor eggs': 'Donor Egg',
  'donor egg': 'Donor Egg',
  'ip sperm': "IF's Sperm",
  "if's sperm": "IF's Sperm",
  'if sperm': "IF's Sperm",
  "intended father's sperm": "IF's Sperm",
  'donor sperm': 'Donor Sperm',
  'donor embryo': 'Embryo Adoption',
  'embryo adoption': 'Embryo Adoption',
  unknown: 'Unknown',
}

export function normalizeEmbryoSourceSelection(value) {
  const raw = Array.isArray(value) ? value : (value ? [value] : [])
  const flattened = raw.flatMap(item => String(item || '').split(/[,;]+/))
  const normalized = flattened
    .map(item => item.trim())
    .filter(Boolean)
    .map(item => {
      const straight = item.replace(/[’‘]/g, "'")
      return EMBRYO_SOURCE_LABEL_MIGRATION[straight.toLowerCase()] || straight
    })

  return EMBRYO_SOURCE_OPTIONS.filter(opt => normalized.includes(opt))
    .concat(normalized.filter(item => !EMBRYO_SOURCE_OPTIONS.includes(item)))
    .filter((item, idx, arr) => arr.indexOf(item) === idx)
}

export function formatEmbryoSourceSelection(value) {
  const normalized = normalizeEmbryoSourceSelection(value)
  return normalized.length ? normalized.join(', ') : null
}
