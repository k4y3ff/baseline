import { useNavigate } from 'react-router-dom'
import { useDashboard } from '../hooks/useDashboard'
import { useScreenings } from '../hooks/useScreenings'
import DayRow from '../components/ui/DayRow'
import { severityColor } from '../lib/screenings'

export default function History() {
  const navigate = useNavigate()
  const { days, loading } = useDashboard()
  const { results: screeningResults, loading: screeningsLoading } = useScreenings()

  return (
    <div className="flex flex-col h-full">
      <div className="drag-region px-5 pt-5 pb-4">
        <div className="no-drag">
          <h1 className="text-xl font-bold">History</h1>
          <p className="text-[--color-muted] text-xs mt-0.5">Last 14 days</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-6 flex flex-col gap-5">
        {/* Screening results */}
        {!screeningsLoading && screeningResults.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className="text-xs font-semibold text-[--color-muted] uppercase tracking-wider">
              Screenings
            </h2>
            <div className="bg-[--color-surface-2] rounded-xl border border-[--color-border] px-4">
              {screeningResults.map((r) => (
                <button
                  key={`${r.type}-${r.date}`}
                  onClick={() => navigate(`/screening/${r.type}/${r.date}`)}
                  className="w-full flex items-center gap-3 py-2.5 border-b border-[--color-border] last:border-0 hover:bg-white/5 active:opacity-70 transition-colors text-left -mx-4 px-4"
                >
                  <span className="text-xs font-medium w-14 shrink-0">{r.type}</span>
                  <span className="text-xs text-[--color-muted]">
                    {new Date(r.date + 'T12:00:00').toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric',
                    })}
                  </span>
                  <span className="ml-auto text-lg font-bold">{r.score}</span>
                  <span className={`text-xs w-28 text-right shrink-0 ${severityColor(r.severity)}`}>
                    {r.severity}
                  </span>
                  <span className="text-[--color-border]">›</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Daily log rows */}
        <section className="flex flex-col gap-2">
          {screeningResults.length > 0 && (
            <h2 className="text-xs font-semibold text-[--color-muted] uppercase tracking-wider">
              Daily logs
            </h2>
          )}
          {loading ? (
            <div className="flex items-center justify-center h-32 text-[--color-muted] text-sm">
              Loading…
            </div>
          ) : (
            <div className="bg-[--color-surface-2] rounded-xl border border-[--color-border] px-4">
              {days.slice().reverse().map((day) => (
                <DayRow
                  key={day.date}
                  day={day}
                  onClick={() => navigate(`/check-in/${day.date}`)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
