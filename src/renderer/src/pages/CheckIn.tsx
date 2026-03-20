import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { formatCheckIn, parseCheckIn } from '../lib/checkInFormat'
import { useConfig } from '../hooks/useConfig'
import type { OuraRow } from '../types'

const MOOD_LABELS: string[] = ['', '😞', '😕', '😐', '🙂', '😄']
const ENERGY_LABELS = ['', '🪫', '😴', '⚡', '🔋', '🚀']

function todayStr(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function CheckIn() {
  const navigate = useNavigate()
  const { date: dateParam } = useParams<{ date?: string }>()
  const date = dateParam ?? todayStr()
  const { config } = useConfig()

  const [mood, setMood] = useState(3)
  const [energy, setEnergy] = useState(3)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [existing, setExisting] = useState(false)

  // Nutrition state (only used when nutritionEnabled)
  const [calories, setCalories] = useState('')
  const [protein, setProtein]   = useState('')
  const [carbs, setCarbs]       = useState('')
  const [fat, setFat]           = useState('')

  // Load today's oura data and any existing check-in
  useEffect(() => {
    const load = async () => {
      const md = await window.baseline.readCheckIn(date)
      if (md) {
        const ci = parseCheckIn(date, md)
        setMood(ci.mood)
        setEnergy(ci.energy)
        setNotes(ci.notes)
        if (ci.nutrition) {
          if (ci.nutrition.calories != null) setCalories(String(ci.nutrition.calories))
          if (ci.nutrition.protein  != null) setProtein(String(ci.nutrition.protein))
          if (ci.nutrition.carbs    != null) setCarbs(String(ci.nutrition.carbs))
          if (ci.nutrition.fat      != null) setFat(String(ci.nutrition.fat))
        }
        setExisting(true)
      }
    }
    load()
  }, [date])

  const handleSubmit = async () => {
    setSaving(true)

    // Fetch today's oura data to embed in the file
    let ouraData: { sleep_hours?: number; hrv_avg?: number; readiness_score?: number } | undefined
    try {
      const rows: OuraRow[] = await window.baseline.readOuraCsv()
      const row = rows.find((r) => r.date === date)
      if (row) {
        ouraData = {
          sleep_hours: row.sleep_hours ? parseFloat(row.sleep_hours) : undefined,
          hrv_avg: row.hrv_avg ? parseFloat(row.hrv_avg) : undefined,
          readiness_score: row.readiness_score ? parseInt(row.readiness_score) : undefined
        }
      }
    } catch {
      // Oura data is optional
    }

    const nutrition = config.nutritionEnabled ? {
      calories: calories !== '' ? parseInt(calories)    : undefined,
      protein:  protein  !== '' ? parseFloat(protein)   : undefined,
      carbs:    carbs    !== '' ? parseFloat(carbs)     : undefined,
      fat:      fat      !== '' ? parseFloat(fat)       : undefined,
    } : undefined

    const md = formatCheckIn({ date, mood, energy, notes, nutrition, oura: ouraData })
    await window.baseline.writeCheckIn(date, md)
    setSaving(false)
    navigate('/dashboard')
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="drag-region px-5 pt-10 pb-4">
        <div className="no-drag">
          <h1 className="text-xl font-bold">
            {existing
              ? `Edit log`
              : date === todayStr() ? 'How are you doing?' : 'Log this day'}
          </h1>
          <p className="text-[--color-muted] text-sm mt-0.5">
            {new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
              weekday: 'long', month: 'long', day: 'numeric'
            })}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 flex flex-col gap-6 pb-6">
        {/* Mood */}
        <div>
          <label className="text-sm font-medium text-[--color-muted] block mb-3">Mood</label>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((v) => (
              <button
                key={v}
                onClick={() => setMood(v)}
                className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-xl border transition-all ${
                  mood === v
                    ? 'border-[--color-brand] bg-indigo-500/10'
                    : 'border-[--color-border] bg-[--color-surface-2] hover:border-[--color-muted]'
                }`}
              >
                <span className="text-2xl">{MOOD_LABELS[v]}</span>
                <span className="text-[10px] text-[--color-muted]">{v}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Energy */}
        <div>
          <label className="text-sm font-medium text-[--color-muted] block mb-3">Energy</label>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((v) => (
              <button
                key={v}
                onClick={() => setEnergy(v)}
                className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-xl border transition-all ${
                  energy === v
                    ? 'border-[--color-brand] bg-indigo-500/10'
                    : 'border-[--color-border] bg-[--color-surface-2] hover:border-[--color-muted]'
                }`}
              >
                <span className="text-2xl">{ENERGY_LABELS[v]}</span>
                <span className="text-[10px] text-[--color-muted]">{v}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="text-sm font-medium text-[--color-muted] block mb-2">
            Notes <span className="font-normal">(optional)</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything worth noting…"
            rows={4}
            className="w-full px-4 py-3 rounded-xl bg-[--color-surface-2] border border-[--color-border] text-sm outline-none focus:border-[--color-brand] transition-colors resize-none"
          />
        </div>

        {/* Nutrition — only when enabled in Settings */}
        {config.nutritionEnabled && (
          <div>
            <label className="text-sm font-medium text-[--color-muted] block mb-3">
              Nutrition <span className="font-normal">(optional)</span>
            </label>
            <div className="flex flex-col gap-2">
              {/* Calories — full width */}
              <div className="relative">
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={9999}
                  placeholder="Calories"
                  value={calories}
                  onChange={(e) => setCalories(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-[--color-surface-2] border border-[--color-border] text-sm outline-none focus:border-[--color-brand] transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-[--color-muted] pointer-events-none">kcal</span>
              </div>
              {/* Macros — 3 columns */}
              <div className="grid grid-cols-3 gap-2">
                {([
                  { label: 'Protein', value: protein, set: setProtein },
                  { label: 'Carbs',   value: carbs,   set: setCarbs },
                  { label: 'Fat',     value: fat,     set: setFat },
                ] as const).map(({ label, value, set }) => (
                  <div key={label} className="relative">
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      max={999}
                      placeholder={label}
                      value={value}
                      onChange={(e) => set(e.target.value)}
                      className="w-full px-3 pb-3 pt-3 rounded-xl bg-[--color-surface-2] border border-[--color-border] text-sm outline-none focus:border-[--color-brand] transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[--color-muted] pointer-events-none">g</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={saving}
          className="w-full py-3.5 rounded-xl bg-[--color-brand] text-white font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
        >
          {saving ? 'Saving…' : existing ? 'Update log' : 'Save log'}
        </button>
      </div>
    </div>
  )
}
