import { useState, useEffect, useCallback } from 'react'
import type { ClinicianSnippet } from '../types'

export function useClinicianNotes() {
  const [snippets, setSnippets] = useState<ClinicianSnippet[]>([])

  useEffect(() => {
    window.baseline.readClinicianNotes().then((notes) => setSnippets(notes as ClinicianSnippet[]))
  }, [])

  const save = useCallback((next: ClinicianSnippet[]) => {
    setSnippets(next)
    window.baseline.writeClinicianNotes(next)
  }, [])

  const addSnippet = useCallback((snippet: Omit<ClinicianSnippet, 'id' | 'savedAt'>) => {
    const full: ClinicianSnippet = {
      ...snippet,
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      savedAt: new Date().toISOString(),
    }
    setSnippets((prev) => {
      const next = [full, ...prev]
      window.baseline.writeClinicianNotes(next)
      return next
    })
  }, [])

  const deleteSnippet = useCallback((id: string) => {
    setSnippets((prev) => {
      const next = prev.filter((s) => s.id !== id)
      window.baseline.writeClinicianNotes(next)
      return next
    })
  }, [])

  const clearAll = useCallback(() => {
    save([])
  }, [save])

  return { snippets, addSnippet, deleteSnippet, clearAll }
}
