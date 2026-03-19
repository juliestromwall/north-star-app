import { createContext, useContext, useState, useCallback } from 'react'

const AdminNotesContext = createContext(null)

// Seed with one example note so the feature is visible immediately
const INITIAL_NOTES = [
  {
    id: 1,
    title: 'Welcome',
    message: 'Admin notes are live! Use Settings to publish announcements to the team.',
    target_user_ids: null,
    is_active: true,
    created_by: 'u2',
    created_at: new Date().toISOString(),
    dismissals: [],
  },
]

let nextId = 2

export function AdminNotesProvider({ children }) {
  const [notes, setNotes] = useState(INITIAL_NOTES)

  const getActiveNotes = useCallback(() => {
    return notes.filter((n) => n.is_active)
  }, [notes])

  const getAllNotes = useCallback(() => {
    return notes
  }, [notes])

  const addNote = useCallback((note) => {
    const newNote = {
      id: nextId++,
      title: note.title || null,
      message: note.message,
      target_user_ids: note.target_user_ids || null,
      is_active: true,
      created_by: note.created_by || 'u2',
      created_at: new Date().toISOString(),
      dismissals: [],
    }
    setNotes((prev) => [newNote, ...prev])
    return newNote
  }, [])

  const toggleNote = useCallback((id) => {
    setNotes((prev) => prev.map((n) => n.id === id ? { ...n, is_active: !n.is_active } : n))
  }, [])

  const removeNote = useCallback((id) => {
    setNotes((prev) => prev.filter((n) => n.id !== id))
  }, [])

  const dismissNote = useCallback((noteId, userId) => {
    setNotes((prev) => prev.map((n) =>
      n.id === noteId
        ? { ...n, dismissals: [...n.dismissals, { user_id: userId, dismissed_at: new Date().toISOString() }] }
        : n
    ))
  }, [])

  return (
    <AdminNotesContext.Provider value={{ getActiveNotes, getAllNotes, addNote, toggleNote, removeNote, dismissNote }}>
      {children}
    </AdminNotesContext.Provider>
  )
}

export function useAdminNotes() {
  const context = useContext(AdminNotesContext)
  if (!context) throw new Error('useAdminNotes must be used within AdminNotesProvider')
  return context
}
