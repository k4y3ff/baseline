import { useState } from 'react'
import { useClinicianNotes } from '../hooks/useClinicianNotes'
import { useAppointments } from '../hooks/useAppointments'
import type { ClinicianSnippet, Appointment } from '../types'

const today = new Date().toISOString().split('T')[0]

function formatDate(date: string) {
  return new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric'
  })
}

function formatAllSnippets(snippets: ClinicianSnippet[]): string {
  const byDate = new Map<string, ClinicianSnippet[]>()
  for (const s of snippets) {
    if (!byDate.has(s.capturedDate)) byDate.set(s.capturedDate, [])
    byDate.get(s.capturedDate)!.push(s)
  }
  const dates = [...byDate.keys()].sort((a, b) => b.localeCompare(a))
  return dates.map((date) => {
    const items = byDate.get(date)!
    const sections = items.map((s) => {
      const note = s.comment ? `\nNote: ${s.comment}` : ''
      return `[${s.label}]\n${s.text}${note}`
    }).join('\n\n')
    return `=== ${date} ===\n\n${sections}`
  }).join('\n\n')
}

// ─── Create Appointment Form ──────────────────────────────────────────────────
function CreateAppointmentForm({ onSave, onCancel }: {
  onSave: (date: string, title: string) => void
  onCancel: () => void
}) {
  const [date, setDate] = useState(today)
  const [title, setTitle] = useState('')

  return (
    <div className="bg-[--color-surface-2] border border-[--color-border] rounded-xl p-3 flex flex-col gap-2">
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="text-xs bg-[--color-surface] border border-[--color-border] rounded-lg px-2.5 py-1.5 text-[--color-text] focus:outline-none focus:border-[--color-muted]"
      />
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="e.g. Dr. Smith (optional)"
        className="text-xs bg-[--color-surface] border border-[--color-border] rounded-lg px-2.5 py-1.5 text-[--color-text] placeholder:text-[--color-muted] focus:outline-none focus:border-[--color-muted]"
      />
      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className="text-xs px-3 py-1.5 rounded-lg border border-[--color-border] text-[--color-muted] hover:border-[--color-muted] transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={() => { if (date) onSave(date, title) }}
          className="text-xs px-3 py-1.5 rounded-lg border border-[--color-border] hover:border-[--color-muted] transition-colors"
        >
          Create
        </button>
      </div>
    </div>
  )
}

// ─── Item Picker ──────────────────────────────────────────────────────────────
function SnippetPicker({ snippets, assignedIds, onConfirm, onCancel }: {
  snippets: ClinicianSnippet[]
  assignedIds: string[]
  onConfirm: (selected: string[]) => void
  onCancel: () => void
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(assignedIds))

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <div className="bg-[--color-surface-2] border border-[--color-border] rounded-xl p-3 flex flex-col gap-2">
      <p className="text-xs font-medium text-[--color-muted]">Select items to include</p>
      {snippets.length === 0 ? (
        <p className="text-xs text-[--color-muted] italic">No saved items yet.</p>
      ) : (
        <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
          {snippets.map((s) => (
            <label key={s.id} className="flex items-start gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={selected.has(s.id)}
                onChange={() => toggle(s.id)}
                className="mt-0.5 shrink-0 accent-[--color-muted]"
              />
              <span className="text-xs text-[--color-text] leading-relaxed">
                <span className="font-medium">{s.label}</span>
                <span className="text-[--color-muted]"> · {s.capturedDate}</span>
              </span>
            </label>
          ))}
        </div>
      )}
      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className="text-xs px-3 py-1.5 rounded-lg border border-[--color-border] text-[--color-muted] hover:border-[--color-muted] transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={() => onConfirm([...selected])}
          className="text-xs px-3 py-1.5 rounded-lg border border-[--color-border] hover:border-[--color-muted] transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  )
}

// ─── Appointment Card ─────────────────────────────────────────────────────────
function AppointmentCard({ appointment, snippets, onDelete, onUpdateSnippets }: {
  appointment: Appointment
  snippets: ClinicianSnippet[]
  onDelete: () => void
  onUpdateSnippets: (ids: string[]) => void
}) {
  const [pickingItems, setPickingItems] = useState(false)

  const assignedSnippets = snippets.filter((s) => appointment.snippetIds.includes(s.id))

  const handleConfirm = (selected: string[]) => {
    onUpdateSnippets(selected)
    setPickingItems(false)
  }

  return (
    <div className="bg-[--color-surface-2] border border-[--color-border] rounded-xl p-3">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <p className="text-xs font-semibold text-[--color-text]">
            {formatDate(appointment.date)}
          </p>
          {appointment.title && (
            <p className="text-xs text-[--color-muted] mt-0.5">{appointment.title}</p>
          )}
        </div>
        <button
          onClick={onDelete}
          className="text-[--color-muted] hover:text-red-400 transition-colors text-xs shrink-0"
          title="Delete appointment"
        >
          ✕
        </button>
      </div>

      {assignedSnippets.length > 0 && (
        <div className="flex flex-col gap-1 mb-2">
          {assignedSnippets.map((s) => (
            <div key={s.id} className="flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-[--color-muted] shrink-0" />
              <span className="text-xs text-[--color-muted] truncate">
                {s.label} · {s.capturedDate}
              </span>
            </div>
          ))}
        </div>
      )}

      {pickingItems ? (
        <SnippetPicker
          snippets={snippets}
          assignedIds={appointment.snippetIds}
          onConfirm={handleConfirm}
          onCancel={() => setPickingItems(false)}
        />
      ) : (
        <button
          onClick={() => setPickingItems(true)}
          className="text-xs px-3 py-1.5 rounded-lg border border-[--color-border] text-[--color-muted] hover:border-[--color-muted] hover:text-[--color-text] transition-colors w-full text-left"
        >
          {assignedSnippets.length === 0 ? 'Add items…' : 'Edit items…'}
        </button>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Prepare() {
  const { snippets, deleteSnippet, clearAll } = useClinicianNotes()
  const { appointments, addAppointment, deleteAppointment, assignSnippet, unassignSnippet } = useAppointments()
  const [creatingAppointment, setCreatingAppointment] = useState(false)

  // Group snippets by capturedDate descending
  const byDate = new Map<string, ClinicianSnippet[]>()
  for (const s of snippets) {
    if (!byDate.has(s.capturedDate)) byDate.set(s.capturedDate, [])
    byDate.get(s.capturedDate)!.push(s)
  }
  const dates = [...byDate.keys()].sort((a, b) => b.localeCompare(a))

  // Which snippet IDs are assigned to any appointment
  const assignedSnippetIds = new Set(appointments.flatMap((a) => a.snippetIds))

  const handleCreateAppointment = (date: string, title: string) => {
    addAppointment(date, title)
    setCreatingAppointment(false)
  }

  const handleUpdateAppointmentSnippets = (appointment: Appointment, selectedIds: string[]) => {
    const prev = new Set(appointment.snippetIds)
    const next = new Set(selectedIds)
    // Assign newly selected
    for (const id of next) {
      if (!prev.has(id)) assignSnippet(appointment.id, id)
    }
    // Unassign deselected
    for (const id of prev) {
      if (!next.has(id)) unassignSnippet(appointment.id, id)
    }
  }

  const handleCopyAll = () => {
    navigator.clipboard.writeText(formatAllSnippets(snippets))
  }

  const handleClearAll = () => {
    if (window.confirm('Clear all saved clinician notes?')) clearAll()
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="drag-region px-5 pt-10 pb-4">
        <div className="no-drag flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Prepare</h1>
            <p className="text-[--color-muted] text-sm mt-0.5">Saved for your clinician</p>
          </div>
          {snippets.length > 0 && (
            <div className="flex gap-2">
              <button
                onClick={handleCopyAll}
                className="text-xs px-3 py-1.5 rounded-lg border border-[--color-border] hover:border-[--color-muted] transition-colors"
              >
                Copy all
              </button>
              <button
                onClick={handleClearAll}
                className="text-xs px-3 py-1.5 rounded-lg border border-[--color-border] text-[--color-muted] hover:text-red-400 hover:border-red-400 transition-colors"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-6 flex flex-col gap-6">
        {/* Appointments section */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-[--color-muted] uppercase tracking-wider">
              Appointments
            </p>
            {!creatingAppointment && (
              <button
                onClick={() => setCreatingAppointment(true)}
                className="text-xs px-3 py-1.5 rounded-lg border border-[--color-border] hover:border-[--color-muted] transition-colors"
              >
                Add Appointment
              </button>
            )}
          </div>

          {creatingAppointment && (
            <CreateAppointmentForm
              onSave={handleCreateAppointment}
              onCancel={() => setCreatingAppointment(false)}
            />
          )}

          {appointments.length === 0 && !creatingAppointment && (
            <p className="text-xs text-[--color-muted] italic">No appointments yet.</p>
          )}

          {appointments.map((appt) => (
            <AppointmentCard
              key={appt.id}
              appointment={appt}
              snippets={snippets}
              onDelete={() => deleteAppointment(appt.id)}
              onUpdateSnippets={(ids) => handleUpdateAppointmentSnippets(appt, ids)}
            />
          ))}
        </div>

        {/* Saved snippets */}
        {snippets.length === 0 ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-[--color-muted] text-sm text-center leading-relaxed">
              No saved items yet.<br />
              Right-click any section to save it here.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {dates.map((date) => (
              <div key={date}>
                <p className="text-xs font-semibold text-[--color-muted] uppercase tracking-wider mb-2">
                  {formatDate(date)}
                </p>
                <div className="flex flex-col gap-2">
                  {byDate.get(date)!.map((snippet) => (
                    <div
                      key={snippet.id}
                      className="bg-[--color-surface-2] rounded-xl border border-[--color-border] p-3"
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs font-medium text-[--color-muted] truncate">{snippet.label}</span>
                          {assignedSnippetIds.has(snippet.id) && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[--color-surface] border border-[--color-border] text-[--color-muted] shrink-0">
                              In agenda
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => deleteSnippet(snippet.id)}
                          className="text-[--color-muted] hover:text-red-400 transition-colors text-xs shrink-0"
                          title="Remove"
                        >
                          ✕
                        </button>
                      </div>
                      <pre className="text-xs text-[--color-text] whitespace-pre-wrap font-mono leading-relaxed">
                        {snippet.text}
                      </pre>
                      {snippet.comment && (
                        <p className="text-xs text-[--color-muted] italic mt-2 border-t border-[--color-border] pt-2">
                          {snippet.comment}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
