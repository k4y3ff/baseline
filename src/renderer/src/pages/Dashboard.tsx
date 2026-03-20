import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDashboard } from '../hooks/useDashboard'
import { useConfig } from '../hooks/useConfig'
import WeekChart from '../components/charts/WeekChart'
import type { DayData } from '../types'


const MOOD_EMOJI = ['', '😞', '😕', '😐', '🙂', '😄']

function MetricCard({ label, value, unit }: { label: string; value: string | number | null; unit?: string }) {
  return (
    <div className="flex-1 bg-[--color-surface-2] rounded-xl border border-[--color-border] p-3 flex flex-col gap-1">
      <span className="text-[--color-muted] text-xs">{label}</span>
      <span className="text-lg font-semibold">
        {value != null ? (
          <>
            {value}
            {unit && <span className="text-sm font-normal text-[--color-muted] ml-0.5">{unit}</span>}
          </>
        ) : (
          <span className="text-[--color-muted] text-sm">—</span>
        )}
      </span>
    </div>
  )
}

function DayRow({ day }: { day: DayData }) {
  const hasMood = day.mood != null
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-[--color-border] last:border-0">
      <span className="text-[--color-muted] text-xs w-8">{day.label}</span>
      <span className="text-xs text-[--color-muted] w-20">{day.date.slice(5)}</span>
      <span className="text-lg w-7">{hasMood ? MOOD_EMOJI[day.mood!] : '·'}</span>
      <div className="flex gap-3 ml-auto text-xs text-[--color-muted]">
        {day.sleep_hours != null && <span>{day.sleep_hours}h</span>}
        {day.hrv_avg != null && <span>HRV {Math.round(day.hrv_avg)}</span>}
        {day.readiness_score != null && <span>R {day.readiness_score}</span>}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { days, today, hasCheckInToday, loading, syncing, triggerSync, reload } = useDashboard()
  const { config } = useConfig()

  // Auto-sync on load if connected to Oura
  useEffect(() => {
    if (config.ouraAccessToken) {
      triggerSync()
    }
  }, [config.ouraAccessToken]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="drag-region px-5 pt-10 pb-2">
        <div className="no-drag flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Baseline</h1>
            <p className="text-[--color-muted] text-xs mt-0.5">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </div>
          {syncing && (
            <span className="text-[--color-muted] text-xs">Syncing…</span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 flex flex-col gap-5 pb-6">
        {/* Today metrics */}
        <div className="flex gap-2">
          <MetricCard label="Readiness" value={today?.readiness_score ?? null} />
          <MetricCard label="HRV" value={today?.hrv_avg != null ? Math.round(today.hrv_avg) : null} />
          <MetricCard label="Sleep" value={today?.sleep_hours ?? null} unit="h" />
        </div>

        {/* Check-in CTA */}
        {!hasCheckInToday && (
          <button
            onClick={() => navigate('/check-in')}
            className="w-full py-3.5 rounded-xl bg-[--color-brand] text-white font-medium hover:opacity-90 transition-opacity text-sm"
          >
            Log today's check-in
          </button>
        )}

        {hasCheckInToday && today && (
          <div
            onClick={() => navigate('/check-in')}
            className="w-full py-3 rounded-xl bg-[--color-surface-2] border border-[--color-border] flex items-center justify-between px-4 cursor-pointer hover:border-[--color-brand] transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{MOOD_EMOJI[today.mood!]}</span>
              <div>
                <p className="text-sm font-medium">Mood {today.mood}/5 · Energy {today.energy}/5</p>
                <p className="text-xs text-[--color-muted]">Today's log — tap to edit</p>
              </div>
            </div>
          </div>
        )}

        {/* 7-day chart */}
        <div className="bg-[--color-surface-2] rounded-xl border border-[--color-border] p-4">
          <h2 className="text-xs font-semibold text-[--color-muted] uppercase tracking-wider mb-3">
            Last 7 days
          </h2>
          {loading ? (
            <div className="h-[180px] flex items-center justify-center text-[--color-muted] text-sm">
              Loading…
            </div>
          ) : (
            <WeekChart days={days} />
          )}
        </div>

        {/* Recent days list */}
        <div className="bg-[--color-surface-2] rounded-xl border border-[--color-border] px-4">
          {days.slice().reverse().map((day) => (
            <DayRow key={day.date} day={day} />
          ))}
        </div>
      </div>
    </div>
  )
}
