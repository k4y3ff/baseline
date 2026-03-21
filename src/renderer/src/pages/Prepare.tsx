import { useClinicianNotes } from '../hooks/useClinicianNotes'
import type { ClinicianSnippet } from '../types'

function formatAllSnippets(snippets: ClinicianSnippet[]): string {
  // Group by capturedDate descending
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

export default function Prepare() {
  const { snippets, deleteSnippet, clearAll } = useClinicianNotes()

  // Group by capturedDate, dates sorted descending
  const byDate = new Map<string, ClinicianSnippet[]>()
  for (const s of snippets) {
    if (!byDate.has(s.capturedDate)) byDate.set(s.capturedDate, [])
    byDate.get(s.capturedDate)!.push(s)
  }
  const dates = [...byDate.keys()].sort((a, b) => b.localeCompare(a))

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

      <div className="flex-1 overflow-y-auto px-5 pb-6">
        {snippets.length === 0 ? (
          <div className="flex h-full items-center justify-center">
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
                  {new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
                    weekday: 'long', month: 'long', day: 'numeric'
                  })}
                </p>
                <div className="flex flex-col gap-2">
                  {byDate.get(date)!.map((snippet) => (
                    <div
                      key={snippet.id}
                      className="bg-[--color-surface-2] rounded-xl border border-[--color-border] p-3"
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <span className="text-xs font-medium text-[--color-muted]">{snippet.label}</span>
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
