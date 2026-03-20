import { useNavigate } from 'react-router-dom'
import { useDashboard } from '../hooks/useDashboard'
import DayRow from '../components/ui/DayRow'

export default function History() {
  const navigate = useNavigate()
  const { days, loading } = useDashboard()

  return (
    <div className="flex flex-col h-full">
      <div className="drag-region px-5 pt-10 pb-4">
        <div className="no-drag">
          <h1 className="text-xl font-bold">History</h1>
          <p className="text-[--color-muted] text-xs mt-0.5">Last 14 days</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-6">
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
      </div>
    </div>
  )
}
