import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { SCREENING_MAP, severityColor } from '../lib/screenings'
import { useScreenings } from '../hooks/useScreenings'
import type { ScreeningResult } from '../types'

function localDateStr(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function Screening() {
  const navigate = useNavigate()
  const { type, date: dateParam } = useParams<{ type: string; date?: string }>()
  const isReadOnly = Boolean(dateParam)
  const def = type ? SCREENING_MAP[type] : undefined

  const { results, save } = useScreenings()

  // For read-only mode, find the existing result
  const existingResult = isReadOnly
    ? results.find((r) => r.type === type && r.date === dateParam)
    : undefined

  const [answers, setAnswers] = useState<number[]>(
    def ? def.questions.map(() => -1) : []
  )
  const [saving, setSaving] = useState(false)

  // Load answers for read-only mode once results arrive
  useEffect(() => {
    if (existingResult) {
      setAnswers(existingResult.answers)
    }
  }, [existingResult])

  if (!def) {
    return (
      <div className="flex h-full items-center justify-center text-[--color-muted] text-sm">
        Unknown screening type.
      </div>
    )
  }

  const allAnswered = answers.every((a) => a >= 0)
  const { score, severity } = allAnswered ? def.score(answers) : { score: null, severity: null }

  const handleSubmit = async () => {
    if (!allAnswered || saving) return
    setSaving(true)
    const { score: s, severity: sev } = def.score(answers)
    const result: ScreeningResult = {
      type: def.id,
      date: localDateStr(),
      answers,
      score: s,
      severity: sev,
    }
    await save(result)
    setSaving(false)
    navigate(-1)
  }

  const displayDate = dateParam ?? localDateStr()

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 pt-5 pb-3">
        <div className="no-drag flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold">{def.id}</h1>
            <p className="text-[--color-muted] text-xs mt-0.5">
              {isReadOnly
                ? new Date(displayDate + 'T12:00:00').toLocaleDateString('en-US', {
                    weekday: 'long', month: 'long', day: 'numeric',
                  })
                : def.fullName}
            </p>
          </div>
          {isReadOnly && existingResult && (
            <div className="text-right shrink-0">
              <p className="text-2xl font-bold">{existingResult.score}</p>
              <p className={`text-xs font-medium ${severityColor(existingResult.severity)}`}>
                {existingResult.severity}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 flex flex-col gap-5 pb-6">
        {/* Instructions */}
        {!isReadOnly && (
          <p className="text-sm text-[--color-muted] leading-relaxed">{def.subtitle}</p>
        )}

        {/* Questions */}
        {def.questions.map((question, qi) => (
          <div key={qi} className="flex flex-col gap-2">
            <p className="text-sm font-medium leading-snug">
              <span className="text-[--color-muted] mr-1">{qi + 1}.</span>
              {question}
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {def.responseOptions.map((label, vi) => {
                const selected = answers[qi] === vi
                return (
                  <button
                    key={vi}
                    disabled={isReadOnly}
                    onClick={() => {
                      if (isReadOnly) return
                      const next = [...answers]
                      next[qi] = vi
                      setAnswers(next)
                    }}
                    className={`py-2 px-3 rounded-lg border text-xs text-left transition-all ${
                      selected
                        ? 'border-[--color-brand] bg-indigo-500/15 text-white'
                        : 'border-[--color-border] bg-[--color-surface-2] text-[--color-muted]'
                    } disabled:cursor-default`}
                  >
                    <span className="font-semibold mr-1">{vi}</span>
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
        ))}

        {/* Score preview (live, while filling out) */}
        {!isReadOnly && allAnswered && score !== null && (
          <div className="bg-[--color-surface-2] rounded-xl border border-[--color-border] p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-[--color-muted]">Score</p>
              <p className="text-2xl font-bold mt-0.5">{score} / 27</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-[--color-muted]">Severity</p>
              <p className={`text-base font-semibold mt-0.5 ${severityColor(severity!)}`}>
                {severity}
              </p>
            </div>
          </div>
        )}

        {/* Submit / Back */}
        {isReadOnly ? (
          <button
            onClick={() => navigate(-1)}
            className="w-full py-3.5 rounded-xl border border-[--color-border] text-sm hover:bg-white/5 transition-colors"
          >
            Back
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!allAnswered || saving}
            className="w-full py-3.5 rounded-xl bg-[--color-brand] text-white font-medium disabled:opacity-40 hover:opacity-90 transition-opacity text-sm"
          >
            {saving ? 'Saving…' : 'Save results'}
          </button>
        )}
      </div>
    </div>
  )
}
