import { createContext, useContext, useState, useCallback } from 'react'

const DraftContext = createContext(null)

let nextDraftId = 1

export function DraftProvider({ children }) {
  const [drafts, setDrafts] = useState([]) // array of draft objects

  const openDraft = useCallback(({ to, cc, bcc, subject, body, replyTo, forwardMsg, caseId } = {}) => {
    const id = nextDraftId++

    let initialSubject = subject || ''
    let initialBody = body || ''
    let initialTo = to || ''

    if (replyTo) {
      const fromEmail = replyTo.from?.match(/<([^>]+)>/)?.[1] || replyTo.from
      initialTo = fromEmail || ''
      initialSubject = replyTo.subject?.startsWith('Re:') ? replyTo.subject : `Re: ${replyTo.subject || ''}`
      const plainBody = (replyTo.bodyHtml || '').replace(/<[^>]*>/g, '').slice(0, 500)
      initialBody = `\n\n> On ${replyTo.date}, ${replyTo.from} wrote:\n> ${plainBody}`
    } else if (forwardMsg) {
      initialTo = ''
      initialSubject = `Fwd: ${forwardMsg.subject || ''}`
      const plainBody = (forwardMsg.bodyHtml || '').replace(/<[^>]*>/g, '').slice(0, 1000)
      initialBody = `\n\n---------- Forwarded message ----------\nFrom: ${forwardMsg.from}\nDate: ${forwardMsg.date}\nSubject: ${forwardMsg.subject}\n\n${plainBody}`
    }

    const draft = {
      id,
      to: initialTo,
      cc: cc || '',
      bcc: bcc || '',
      subject: initialSubject,
      body: initialBody,
      attachments: [],
      caseId: caseId || '',
      minimized: false,
      showCcBcc: false,
    }

    setDrafts(prev => [...prev, draft])
    return id
  }, [])

  const updateDraft = useCallback((id, updates) => {
    setDrafts(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d))
  }, [])

  const closeDraft = useCallback((id) => {
    setDrafts(prev => prev.filter(d => d.id !== id))
  }, [])

  const minimizeDraft = useCallback((id) => {
    setDrafts(prev => prev.map(d => d.id === id ? { ...d, minimized: true } : d))
  }, [])

  const expandDraft = useCallback((id) => {
    setDrafts(prev => prev.map(d => d.id === id ? { ...d, minimized: false } : d))
  }, [])

  return (
    <DraftContext.Provider value={{ drafts, openDraft, updateDraft, closeDraft, minimizeDraft, expandDraft }}>
      {children}
    </DraftContext.Provider>
  )
}

export function useDrafts() {
  const ctx = useContext(DraftContext)
  if (!ctx) throw new Error('useDrafts must be used within DraftProvider')
  return ctx
}
