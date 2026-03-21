import { useRef, useState } from 'react'
import PageHeader from '../components/ui/PageHeader'
import { useClinicianNotes } from '../hooks/useClinicianNotes'
import { useAppointments } from '../hooks/useAppointments'
import WeekChart, { CHART_VARS } from '../components/charts/WeekChart'
import type { ChartVarKey } from '../components/charts/WeekChart'
import type { ClinicianSnippet, Appointment, DayData } from '../types'

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

const APPOINTMENT_TYPES = ['Primary Care', 'Psychiatric', 'Therapy', 'Other...']

// ─── PDF View (rendered off-screen for export) ────────────────────────────────
const pdfThStyle: React.CSSProperties = { textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid #e5e7eb', fontWeight: 600, color: '#555' }
const pdfTdStyle: React.CSSProperties = { padding: '3px 8px', color: '#333' }

function AppointmentPDFView({ appointment, snippets }: { appointment: Appointment; snippets: ClinicianSnippet[] }) {
  return (
    <div style={{ background: '#fff', color: '#111', padding: 40, width: 700, fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ borderBottom: '2px solid #e5e7eb', paddingBottom: 16, marginBottom: 28 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 8px 0' }}>{formatDate(appointment.date)}</h1>
        <div style={{ fontSize: 13, color: '#555', display: 'flex', gap: 16 }}>
          {appointment.title && <span>Provider: <strong>{appointment.title}</strong></span>}
          {appointment.type && <span>Type: <strong>{appointment.type}</strong></span>}
        </div>
      </div>
      {snippets.map((s, i) => {
        const varA = s.chartMeta?.varA as ChartVarKey | undefined
        const varB = s.chartMeta?.varB as ChartVarKey | undefined
        const defA = varA ? CHART_VARS[varA] : null
        const defB = varB ? CHART_VARS[varB] : null
        const sameVar = varA === varB
        return (
          <div key={s.id} style={{ marginBottom: 36, paddingTop: i > 0 ? 28 : 0, borderTop: i > 0 ? '1px solid #e5e7eb' : 'none' }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 4px 0' }}>{s.label}</p>
            <p style={{ fontSize: 12, color: '#666', margin: '0 0 12px 0' }}>{s.capturedDate}</p>
            {s.chartMeta && varA && varB && defA && defB ? (
              <>
                <div style={{ width: '100%', height: 180, marginBottom: 16 }}>
                  <WeekChart days={s.chartMeta.days} varA={varA} varB={varB} numDays={s.chartMeta.numDays} />
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr>
                      <th style={pdfThStyle}>Date</th>
                      <th style={{ ...pdfThStyle, color: defA.color }}>{defA.label}{defA.unit ? ` (${defA.unit})` : ''}</th>
                      {!sameVar && <th style={{ ...pdfThStyle, color: defB.color }}>{defB.label}{defB.unit ? ` (${defB.unit})` : ''}</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {s.chartMeta.days.map((day, di) => (
                      <tr key={di} style={{ background: di % 2 === 0 ? '#f9fafb' : '#fff' }}>
                        <td style={pdfTdStyle}>{day.label}</td>
                        <td style={pdfTdStyle}>{(day[varA as keyof DayData] ?? '—') as React.ReactNode}</td>
                        {!sameVar && <td style={pdfTdStyle}>{(day[varB as keyof DayData] ?? '—') as React.ReactNode}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : (
              <pre style={{ fontSize: 12, whiteSpace: 'pre-wrap', fontFamily: 'monospace', color: '#222', margin: 0 }}>{s.text}</pre>
            )}
            {s.comment && (
              <p style={{ fontSize: 12, color: '#666', fontStyle: 'italic', marginTop: 10, paddingTop: 10, borderTop: '1px solid #e5e7eb' }}>{s.comment}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Create Appointment Form ──────────────────────────────────────────────────
function CreateAppointmentForm({ onSave, onCancel }: {
  onSave: (date: string, title: string, type: string) => void
  onCancel: () => void
}) {
  const [date, setDate] = useState(today)
  const [title, setTitle] = useState('')
  const [type, setType] = useState(APPOINTMENT_TYPES[0])
  const [customType, setCustomType] = useState('')

  const resolvedType = type === 'Other...' ? customType : type

  return (
    <div className="bg-[--color-surface-2] border border-[--color-border] rounded-xl p-3 flex flex-col gap-2">
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="text-xs bg-[--color-surface] border border-[--color-border] rounded-lg px-2.5 py-1.5 text-[--color-text] focus:outline-none focus:border-[--color-muted]"
      />
      <select
        value={type}
        onChange={(e) => setType(e.target.value)}
        className="text-xs bg-[--color-surface] border border-[--color-border] rounded-lg px-2.5 py-1.5 text-[--color-text] focus:outline-none focus:border-[--color-muted]"
      >
        {APPOINTMENT_TYPES.map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>
      {type === 'Other...' && (
        <input
          type="text"
          value={customType}
          onChange={(e) => setCustomType(e.target.value)}
          placeholder="Appointment type"
          className="text-xs bg-[--color-surface] border border-[--color-border] rounded-lg px-2.5 py-1.5 text-[--color-text] placeholder:text-[--color-muted] focus:outline-none focus:border-[--color-muted]"
        />
      )}
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
          className="text-xs px-3 py-1.5 rounded-lg border border-[--color-border] text-[--color-muted] hover:border-[--color-muted] hover:bg-white/[0.06] transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={() => { if (date) onSave(date, title, resolvedType) }}
          className="text-xs px-3 py-1.5 rounded-lg border border-[--color-border] hover:border-[--color-muted] hover:bg-white/[0.06] transition-colors"
        >
          Create
        </button>
      </div>
    </div>
  )
}

// ─── Appointment Card ─────────────────────────────────────────────────────────
function AppointmentCard({ appointment, snippets, onDelete, onUpdate, onAssignSnippet, onUnassignSnippet, onClick, onDownload }: {
  appointment: Appointment
  snippets: ClinicianSnippet[]
  onDelete: () => void
  onUpdate: (fields: Partial<Pick<Appointment, 'date' | 'title' | 'type'>>) => void
  onAssignSnippet: (snippetId: string) => void
  onUnassignSnippet: (snippetId: string) => void
  onClick: () => void
  onDownload: () => void
}) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  const isCustomType = appointment.type && !APPOINTMENT_TYPES.slice(0, -1).includes(appointment.type)
  const [editDate, setEditDate] = useState(appointment.date)
  const [editType, setEditType] = useState(isCustomType ? 'Other...' : (appointment.type ?? APPOINTMENT_TYPES[0]))
  const [editCustomType, setEditCustomType] = useState(isCustomType ? (appointment.type ?? '') : '')
  const [editTitle, setEditTitle] = useState(appointment.title ?? '')

  const assignedSnippets = snippets.filter((s) => appointment.snippetIds.includes(s.id))

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const snippetId = e.dataTransfer.getData('snippetId')
    if (snippetId) onAssignSnippet(snippetId)
  }

  const handleEditSave = (e: React.MouseEvent) => {
    e.stopPropagation()
    const resolvedType = editType === 'Other...' ? editCustomType : editType
    onUpdate({ date: editDate, title: editTitle, type: resolvedType })
    setIsEditing(false)
  }

  const handleEditCancel = (e: React.MouseEvent) => {
    e.stopPropagation()
    setEditDate(appointment.date)
    setEditType(isCustomType ? 'Other...' : (appointment.type ?? APPOINTMENT_TYPES[0]))
    setEditCustomType(isCustomType ? (appointment.type ?? '') : '')
    setEditTitle(appointment.title ?? '')
    setIsEditing(false)
  }

  return (
    <div
      onClick={isEditing ? undefined : onClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`rounded-xl border p-3 transition-colors ${
        isEditing
          ? 'bg-[--color-surface-2] border-[--color-border]'
          : isDragOver
          ? 'bg-[--color-surface] border-[--color-muted] cursor-pointer'
          : 'bg-[--color-surface-2] border-[--color-border] hover:border-[--color-muted] hover:bg-white/[0.06] cursor-pointer'
      }`}
    >
      {isEditing ? (
        <div className="flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
          <input
            type="date"
            value={editDate}
            onChange={(e) => setEditDate(e.target.value)}
            className="text-xs bg-[--color-surface] border border-[--color-border] rounded-lg px-2.5 py-1.5 text-[--color-text] focus:outline-none focus:border-[--color-muted]"
          />
          <select
            value={editType}
            onChange={(e) => setEditType(e.target.value)}
            className="text-xs bg-[--color-surface] border border-[--color-border] rounded-lg px-2.5 py-1.5 text-[--color-text] focus:outline-none focus:border-[--color-muted]"
          >
            {APPOINTMENT_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          {editType === 'Other...' && (
            <input
              type="text"
              value={editCustomType}
              onChange={(e) => setEditCustomType(e.target.value)}
              placeholder="Appointment type"
              className="text-xs bg-[--color-surface] border border-[--color-border] rounded-lg px-2.5 py-1.5 text-[--color-text] placeholder:text-[--color-muted] focus:outline-none focus:border-[--color-muted]"
            />
          )}
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            placeholder="e.g. Dr. Smith (optional)"
            className="text-xs bg-[--color-surface] border border-[--color-border] rounded-lg px-2.5 py-1.5 text-[--color-text] placeholder:text-[--color-muted] focus:outline-none focus:border-[--color-muted]"
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={handleEditCancel}
              className="text-xs px-3 py-1.5 rounded-lg border border-[--color-border] text-[--color-muted] hover:border-[--color-muted] hover:bg-white/[0.06] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleEditSave}
              className="text-xs px-3 py-1.5 rounded-lg border border-[--color-border] hover:border-[--color-muted] hover:bg-white/[0.06] transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-semibold text-[--color-text]">
                  {formatDate(appointment.date)}
                </p>
                {appointment.type && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-[--color-surface] border border-[--color-border] text-[--color-muted] leading-none">
                    {appointment.type}
                  </span>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); setIsEditing(true) }}
                  className="text-[--color-muted] hover:text-[--color-text] transition-colors shrink-0"
                  title="Edit appointment"
                >
                  <svg width="11" height="11" viewBox="0 0 15 15" fill="currentColor">
                    <path d="M11.854.146a.5.5 0 0 0-.707 0l-1.5 1.5 3.707 3.707 1.5-1.5a.5.5 0 0 0 0-.707l-3-3zM9.5 2.5 2 10v3h3l7.5-7.5L9.5 2.5z"/>
                  </svg>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onDownload() }}
                  className="text-[--color-muted] hover:text-[--color-text] transition-colors shrink-0"
                  title="Download as PDF"
                >
                  <svg width="11" height="11" viewBox="0 0 15 15" fill="currentColor">
                    <path d="M7.5 11L4 7.5h2.25V2h2.5v5.5H11L7.5 11z"/>
                    <path d="M2 12.5h11V14H2z"/>
                  </svg>
                </button>
              </div>
              {appointment.title && (
                <p className="text-xs text-[--color-muted] mt-0.5">{appointment.title}</p>
              )}
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete() }}
              className="text-[--color-muted] hover:text-red-400 transition-colors text-xs shrink-0"
              title="Delete appointment"
            >
              ✕
            </button>
          </div>

          {assignedSnippets.length > 0 ? (
            <div className="flex flex-col gap-1">
              {assignedSnippets.map((s) => (
                <div key={s.id} className="flex items-center gap-1.5 group">
                  <span className="w-1 h-1 rounded-full bg-[--color-muted] shrink-0" />
                  <span className="text-xs text-[--color-muted] truncate flex-1">
                    {s.label} · {s.capturedDate}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); onUnassignSnippet(s.id) }}
                    className="text-[--color-muted] hover:text-red-400 transition-colors text-xs opacity-0 group-hover:opacity-100 shrink-0"
                    title="Remove from appointment"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[--color-muted] italic">
              {isDragOver ? 'Release to add' : 'Drag items here…'}
            </p>
          )}
        </>
      )}
    </div>
  )
}

// ─── Appointment Detail Panel ─────────────────────────────────────────────────
function AppointmentDetail({ appointment, snippets, onClose, onUnassignSnippet }: {
  appointment: Appointment
  snippets: ClinicianSnippet[]
  onClose: () => void
  onUnassignSnippet: (snippetId: string) => void
}) {
  const assignedSnippets = snippets.filter((s) => appointment.snippetIds.includes(s.id))
  const panelRef = useRef<HTMLDivElement>(null)
  const [isExporting, setIsExporting] = useState(false)

  async function handleExport() {
    if (!panelRef.current || isExporting) return
    setIsExporting(true)
    try {
      const { default: html2canvas } = await import('html2canvas')
      const { jsPDF } = await import('jspdf')
      const canvas = await html2canvas(panelRef.current, { scale: 2, backgroundColor: null })
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({ unit: 'pt', format: [canvas.width / 2, canvas.height / 2] })
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width / 2, canvas.height / 2)
      const buffer = Array.from(new Uint8Array(pdf.output('arraybuffer') as ArrayBuffer))
      await window.baseline.savePdf(buffer, `appointment-${appointment.date}.pdf`)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div ref={panelRef} className="absolute inset-0 flex flex-col" style={{ background: 'var(--color-surface)' }}>
      <PageHeader
        title={
          <div className="flex flex-col items-center">
            <span className="text-sm font-semibold">{appointment.title || formatDate(appointment.date)}</span>
            {appointment.title && <span className="text-[10px] text-[--color-muted]">{formatDate(appointment.date)}</span>}
          </div>
        }
        left={
          <button onClick={onClose} className="text-[--color-muted] hover:text-white transition-colors text-lg leading-none" title="Back">←</button>
        }
        right={
          <button
            onClick={handleExport}
            disabled={isExporting}
            title="Export as PDF"
            className="text-[--color-muted] hover:text-white transition-colors disabled:opacity-40"
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor">
              <path d="M7.5 11L4 7.5h2.25V2h2.5v5.5H11L7.5 11z"/>
              <path d="M2 12.5h11V14H2z"/>
            </svg>
          </button>
        }
      />

      {/* Panel content */}
      <div className="flex-1 overflow-y-auto px-5 pt-5 pb-6 flex flex-col gap-4">
        {assignedSnippets.length === 0 ? (
          <p className="text-sm text-[--color-muted] italic">
            No items added yet. Drag items from the queue below.
          </p>
        ) : (
          assignedSnippets.map((s, i) => (
            <div key={s.id}>
              {i > 0 && <div className="border-t border-[--color-border] mb-4" />}
              <div className="flex items-start justify-between gap-2 mb-1">
                <div>
                  <p className="text-xs font-semibold text-[--color-muted] uppercase tracking-wider">
                    {s.label}
                  </p>
                  <p className="text-xs text-[--color-muted] mt-0.5">{s.capturedDate}</p>
                </div>
                <button
                  onClick={() => onUnassignSnippet(s.id)}
                  className="text-[--color-muted] hover:text-red-400 transition-colors text-xs shrink-0 mt-0.5"
                  title="Remove from appointment"
                >
                  ✕
                </button>
              </div>
              {s.chartMeta ? (
                <div className="mt-2">
                  <WeekChart
                    days={s.chartMeta.days}
                    varA={s.chartMeta.varA as ChartVarKey}
                    varB={s.chartMeta.varB as ChartVarKey}
                    numDays={s.chartMeta.numDays}
                  />
                </div>
              ) : (
                <pre className="text-xs text-[--color-text] whitespace-pre-wrap font-mono leading-relaxed">
                  {s.text}
                </pre>
              )}
              {s.comment && (
                <p className="text-xs text-[--color-muted] italic mt-2 border-t border-[--color-border] pt-2">
                  {s.comment}
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Prepare() {
  const { snippets, deleteSnippet, clearAll } = useClinicianNotes()
  const { appointments, addAppointment, updateAppointment, deleteAppointment, assignSnippet, unassignSnippet } = useAppointments()
  const [creatingAppointment, setCreatingAppointment] = useState(false)
  const [selectedApptId, setSelectedApptId] = useState<string | null>(null)
  const [downloadingApptId, setDownloadingApptId] = useState<string | null>(null)

  async function handleDownload(appointment: Appointment) {
    if (downloadingApptId) return
    setDownloadingApptId(appointment.id)
    try {
      const assignedSnippets = snippets.filter((s) => appointment.snippetIds.includes(s.id))
      const container = document.createElement('div')
      container.style.cssText = 'position:fixed;left:-9999px;top:0;width:750px;'
      document.body.appendChild(container)
      const { createRoot } = await import('react-dom/client')
      const root = createRoot(container)
      root.render(<AppointmentPDFView appointment={appointment} snippets={assignedSnippets} />)
      await new Promise((r) => setTimeout(r, 600))
      const { default: html2canvas } = await import('html2canvas')
      const { jsPDF } = await import('jspdf')
      const el = container.firstElementChild as HTMLElement
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff' })
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({ unit: 'pt', format: [canvas.width / 2, canvas.height / 2] })
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width / 2, canvas.height / 2)
      const buffer = Array.from(new Uint8Array(pdf.output('arraybuffer') as ArrayBuffer))
      await window.baseline.savePdf(buffer, `appointment-${appointment.date}.pdf`)
      root.unmount()
      document.body.removeChild(container)
    } finally {
      setDownloadingApptId(null)
    }
  }

  const selectedAppt = appointments.find((a) => a.id === selectedApptId) ?? null

  // Group snippets by capturedDate descending
  const byDate = new Map<string, ClinicianSnippet[]>()
  for (const s of snippets) {
    if (!byDate.has(s.capturedDate)) byDate.set(s.capturedDate, [])
    byDate.get(s.capturedDate)!.push(s)
  }
  const dates = [...byDate.keys()].sort((a, b) => b.localeCompare(a))

  // Which snippet IDs are assigned to any appointment
  const assignedSnippetIds = new Set(appointments.flatMap((a) => a.snippetIds))

  // Unassigned snippets shown in the queue
  const unassignedSnippets = snippets.filter((s) => !assignedSnippetIds.has(s.id))

  const handleCreateAppointment = (date: string, title: string, type: string) => {
    addAppointment(date, title, type)
    setCreatingAppointment(false)
  }

  const handleCopyAll = () => {
    navigator.clipboard.writeText(formatAllSnippets(snippets))
  }

  const handleClearAll = () => {
    if (window.confirm('Clear all saved clinician notes?')) clearAll()
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header — hidden when detail panel is open (panel has its own header) */}
      {!selectedAppt && (
        <PageHeader
          title={<span className="text-sm font-semibold">Prepare</span>}
          right={snippets.length > 0 ? (
            <div className="flex gap-2">
              <button
                onClick={handleCopyAll}
                className="text-xs px-2.5 py-1 rounded-lg border border-[--color-border] hover:border-[--color-muted] hover:bg-white/[0.06] transition-colors"
              >
                Copy all
              </button>
              <button
                onClick={handleClearAll}
                className="text-xs px-2.5 py-1 rounded-lg border border-[--color-border] text-[--color-muted] hover:text-red-400 hover:border-red-400 transition-colors"
              >
                Clear all
              </button>
            </div>
          ) : undefined}
        />
      )}

      <div className="flex-1 overflow-hidden relative">
        {/* Main scrollable content */}
        <div className="h-full overflow-y-auto px-5 pt-5 pb-6 flex flex-col gap-6">
          {/* Appointments section */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-[--color-muted] uppercase tracking-wider">
                Appointments
              </p>
              {!creatingAppointment && (
                <button
                  onClick={() => setCreatingAppointment(true)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-[--color-border] hover:border-[--color-muted] hover:bg-white/[0.06] transition-colors"
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
                onUpdate={(fields) => updateAppointment(appt.id, fields)}
                onAssignSnippet={(snippetId) => assignSnippet(appt.id, snippetId)}
                onUnassignSnippet={(snippetId) => unassignSnippet(appt.id, snippetId)}
                onClick={() => setSelectedApptId(appt.id)}
                onDownload={() => handleDownload(appt)}
              />
            ))}
          </div>

          {/* Saved snippets queue (unassigned only) */}
          {snippets.length === 0 ? (
            <div className="flex flex-1 items-center justify-center">
              <p className="text-[--color-muted] text-sm text-center leading-relaxed">
                No saved items yet.<br />
                Right-click any section to save it here.
              </p>
            </div>
          ) : unassignedSnippets.length === 0 ? (
            <p className="text-xs text-[--color-muted] italic">All items assigned to appointments.</p>
          ) : (
            <div className="flex flex-col gap-6">
              {dates.map((date) => {
                const dateSnippets = byDate.get(date)!.filter((s) => !assignedSnippetIds.has(s.id))
                if (dateSnippets.length === 0) return null
                return (
                  <div key={date}>
                    <p className="text-xs font-semibold text-[--color-muted] uppercase tracking-wider mb-2">
                      {formatDate(date)}
                    </p>
                    <div className="flex flex-col gap-2">
                      {dateSnippets.map((snippet) => (
                        <div
                          key={snippet.id}
                          draggable
                          onDragStart={(e) => e.dataTransfer.setData('snippetId', snippet.id)}
                          className="bg-[--color-surface-2] rounded-xl border border-[--color-border] p-3 cursor-grab active:cursor-grabbing"
                        >
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <span className="text-xs font-medium text-[--color-muted] truncate">{snippet.label}</span>
                            <button
                              onClick={() => deleteSnippet(snippet.id)}
                              className="text-[--color-muted] hover:text-red-400 transition-colors text-xs shrink-0"
                              title="Remove"
                            >
                              ✕
                            </button>
                          </div>
                          {snippet.chartMeta ? (
                            <div className="mt-1">
                              <WeekChart
                                days={snippet.chartMeta.days}
                                varA={snippet.chartMeta.varA as ChartVarKey}
                                varB={snippet.chartMeta.varB as ChartVarKey}
                                numDays={snippet.chartMeta.numDays}
                              />
                            </div>
                          ) : (
                            <pre className="text-xs text-[--color-text] whitespace-pre-wrap font-mono leading-relaxed">
                              {snippet.text}
                            </pre>
                          )}
                          {snippet.comment && (
                            <p className="text-xs text-[--color-muted] italic mt-2 border-t border-[--color-border] pt-2">
                              {snippet.comment}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Slide-in detail panel */}
        <div className={`absolute inset-0 transition-transform duration-200 ease-in-out ${
          selectedAppt ? 'translate-x-0' : 'translate-x-full'
        }`}>
          {selectedAppt && (
            <AppointmentDetail
              appointment={selectedAppt}
              snippets={snippets}
              onClose={() => setSelectedApptId(null)}
              onUnassignSnippet={(snippetId) => unassignSnippet(selectedAppt.id, snippetId)}
            />
          )}
        </div>
      </div>
    </div>
  )
}
