import { useDashboard } from '../hooks/useDashboard'
import WeekChart from '../components/charts/WeekChart'

export default function Analyze() {
  const { days, loading } = useDashboard()

  return (
    <div className="flex flex-col h-full">
      <div className="drag-region px-5 pt-10 pb-2">
        <h1 className="text-xl font-bold no-drag">Analyze</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-5 flex flex-col gap-5 pb-6">
        <div className="bg-[--color-surface-2] rounded-xl border border-[--color-border] p-4">
          <h2 className="text-xs font-semibold text-[--color-muted] uppercase tracking-wider mb-3">
            Last 7 Days
          </h2>
          {loading ? (
            <div className="h-[180px] flex items-center justify-center text-[--color-muted] text-sm">
              Loading…
            </div>
          ) : (
            <WeekChart days={days} />
          )}
        </div>
      </div>
    </div>
  )
}
