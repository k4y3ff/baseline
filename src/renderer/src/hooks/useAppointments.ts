import { useState, useEffect, useCallback } from 'react'
import type { Appointment } from '../types'

export function useAppointments() {
  const [appointments, setAppointments] = useState<Appointment[]>([])

  useEffect(() => {
    window.baseline.readAppointments().then((appts) => setAppointments(appts as Appointment[]))
  }, [])

  const persist = useCallback((next: Appointment[]) => {
    setAppointments(next)
    window.baseline.writeAppointments(next)
  }, [])

  const addAppointment = useCallback((date: string, title?: string) => {
    const appt: Appointment = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      date,
      title: title || undefined,
      createdAt: new Date().toISOString(),
      snippetIds: [],
    }
    setAppointments((prev) => {
      const next = [appt, ...prev]
      window.baseline.writeAppointments(next)
      return next
    })
  }, [])

  const deleteAppointment = useCallback((id: string) => {
    setAppointments((prev) => {
      const next = prev.filter((a) => a.id !== id)
      window.baseline.writeAppointments(next)
      return next
    })
  }, [])

  const assignSnippet = useCallback((appointmentId: string, snippetId: string) => {
    setAppointments((prev) => {
      const next = prev.map((a) =>
        a.id === appointmentId && !a.snippetIds.includes(snippetId)
          ? { ...a, snippetIds: [...a.snippetIds, snippetId] }
          : a
      )
      window.baseline.writeAppointments(next)
      return next
    })
  }, [])

  const unassignSnippet = useCallback((appointmentId: string, snippetId: string) => {
    setAppointments((prev) => {
      const next = prev.map((a) =>
        a.id === appointmentId
          ? { ...a, snippetIds: a.snippetIds.filter((id) => id !== snippetId) }
          : a
      )
      window.baseline.writeAppointments(next)
      return next
    })
  }, [])

  return { appointments, addAppointment, deleteAppointment, assignSnippet, unassignSnippet }
}
