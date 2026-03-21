import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { formatCheckIn, parseCheckIn } from '../lib/checkInFormat'
import { useConfig } from '../hooks/useConfig'
import { useClinicianNotes } from '../hooks/useClinicianNotes'
import ContextMenu from '../components/ui/ContextMenu'
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

  // Weight state (only used when weightEnabled)
  const [weight, setWeight] = useState('')

  // Medication state (only used when medicationEnabled)
  const [medication, setMedication] = useState(false)

  // Menstrual flow state (only used when menstrualEnabled)
  const [menstrualFlow, setMenstrualFlow] = useState<'none' | 'light' | 'medium' | 'heavy'>('none')

  // Clinician notes
  const { addSnippet } = useClinicianNotes()
  const [menu, setMenu] = useState<{ x: number; y: number; text: string; label: string } | null>(null)

  const showMenu = (e: React.MouseEvent, text: string, label: string) => {
    e.preventDefault()
    e.stopPropagation()
    setMenu({ x: e.clientX, y: e.clientY, text, label })
  }

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
        if (ci.weight != null) setWeight(String(ci.weight))
        if (ci.medication != null) setMedication(ci.medication)
        if (ci.menstrualFlow != null) setMenstrualFlow(ci.menstrualFlow)
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

    const weightVal = config.weightEnabled && weight !== '' ? parseFloat(weight) : undefined
    const medicationVal = config.medicationEnabled ? medication : undefined
    const menstrualFlowVal = config.menstrualEnabled ? menstrualFlow : undefined

    const md = formatCheckIn({ date, mood, energy, notes, nutrition, weight: weightVal, medication: medicationVal, menstrualFlow: menstrualFlowVal, oura: ouraData })
    await window.baseline.writeCheckIn(date, md)
    setSaving(false)
    navigate('/dashboard')
  }

  return (
    <div className="flex flex-col h-full">
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onSave={(comment) => addSnippet({ capturedDate: date, source: 'check-in', label: menu.label, text: menu.text, comment: comment || undefined })}
          onClose={() => setMenu(null)}
        />
      )}

      {/* Header */}
      <div className="drag-region px-5 pt-5 pb-4">
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

      <div
        className="flex-1 overflow-y-auto px-5 flex flex-col gap-6 pb-6"
        onContextMenu={(e) => {
          const text = formatCheckIn({
            date, mood, energy, notes,
            nutrition: config.nutritionEnabled ? {
              calories: calories !== '' ? parseInt(calories) : undefined,
              protein: protein !== '' ? parseFloat(protein) : undefined,
              carbs: carbs !== '' ? parseFloat(carbs) : undefined,
              fat: fat !== '' ? parseFloat(fat) : undefined,
            } : undefined,
            weight: config.weightEnabled && weight !== '' ? parseFloat(weight) : undefined,
            medication: config.medicationEnabled ? medication : undefined,
            menstrualFlow: config.menstrualEnabled ? menstrualFlow : undefined,
          })
          showMenu(e, text, 'Full check-in')
        }}
      >
        {/* Mood */}
        <div onContextMenu={(e) => showMenu(e, `Mood: ${mood}/5`, 'Mood')}>
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
        <div onContextMenu={(e) => showMenu(e, `Energy: ${energy}/5`, 'Energy')}>
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
        <div onContextMenu={(e) => notes.trim() ? showMenu(e, `Notes: ${notes}`, 'Notes') : e.preventDefault()}>
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

        {/* Weight — only when enabled in Settings */}
        {config.weightEnabled && (
          <div onContextMenu={(e) => weight !== '' ? showMenu(e, `Weight: ${weight} lbs`, 'Weight') : e.preventDefault()}>
            <label className="text-sm font-medium text-[--color-muted] block mb-2">
              Weight <span className="font-normal">(optional)</span>
            </label>
            <div className="relative">
              <input
                type="number"
                inputMode="decimal"
                min={0}
                max={999}
                step={0.1}
                placeholder="0.0"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-[--color-surface-2] border border-[--color-border] text-sm outline-none focus:border-[--color-brand] transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-[--color-muted] pointer-events-none">lbs</span>
            </div>
          </div>
        )}

        {/* Medication — only when enabled in Settings */}
        {config.medicationEnabled && (
          <label
            className="flex items-center gap-3 cursor-pointer"
            onContextMenu={(e) => showMenu(e, `Medication: ${medication ? 'Yes' : 'No'}`, 'Medication')}
          >
            <div className="relative">
              <input
                type="checkbox"
                checked={medication}
                onChange={(e) => setMedication(e.target.checked)}
                className="sr-only"
              />
              <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-colors ${
                medication
                  ? 'bg-[--color-brand] border-[--color-brand]'
                  : 'bg-[--color-surface-2] border-[--color-border]'
              }`}>
                {medication && (
                  <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium">Took medications</p>
              <p className="text-xs text-[--color-muted] mt-0.5">Mark if you took your medications today</p>
            </div>
          </label>
        )}

        {/* Menstrual flow — only when enabled in Settings */}
        {config.menstrualEnabled && (
          <div onContextMenu={(e) => showMenu(e, `Flow: ${menstrualFlow}`, 'Menstrual Flow')}>
            <label className="text-sm font-medium text-[--color-muted] block mb-3">Flow</label>
            <div className="flex gap-2">
              {(['none', 'light', 'medium', 'heavy'] as const).map((level) => (
                <button
                  key={level}
                  onClick={() => setMenstrualFlow(level)}
                  className={`flex-1 py-2.5 rounded-xl border text-sm transition-all ${
                    menstrualFlow === level
                      ? 'border-[--color-brand] bg-indigo-500/10 text-white'
                      : 'border-[--color-border] bg-[--color-surface-2] text-[--color-muted] hover:border-[--color-muted]'
                  }`}
                >
                  {level.charAt(0).toUpperCase() + level.slice(1)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Nutrition — only when enabled in Settings */}
        {config.nutritionEnabled && (
          <div onContextMenu={(e) => showMenu(
            e,
            [
              calories !== '' ? `Calories: ${calories} kcal` : null,
              protein  !== '' ? `Protein: ${protein}g`       : null,
              carbs    !== '' ? `Carbs: ${carbs}g`           : null,
              fat      !== '' ? `Fat: ${fat}g`               : null,
            ].filter(Boolean).join(', ') || 'Nutrition: (not logged)',
            'Nutrition'
          )}>
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
