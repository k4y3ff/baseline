import type { DayData } from '../../types'

export const MOOD_EMOJI = ['', '😞', '😕', '😐', '🙂', '😄']

export default function DayRow({ day, onClick }: { day: DayData; onClick: () => void }) {
  const hasMood = day.mood != null
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 py-2.5 border-b border-[--color-border] last:border-0 hover:bg-white/5 active:opacity-70 transition-colors text-left -mx-4 px-4"
    >
      <span className="text-[--color-muted] text-xs w-8">{day.label}</span>
      <span className="text-xs text-[--color-muted] w-20">{day.date.slice(5)}</span>
      <span className="text-lg w-7">{hasMood ? MOOD_EMOJI[day.mood!] : '·'}</span>
      <div className="flex gap-3 ml-auto text-xs text-[--color-muted]">
        {day.sleep_hours != null && <span>{day.sleep_hours}h</span>}
        {day.hrv_avg != null && <span>HRV {Math.round(day.hrv_avg)}</span>}
        {day.readiness_score != null && <span>R {day.readiness_score}</span>}
        <span className="text-[--color-border]">›</span>
      </div>
    </button>
  )
}
