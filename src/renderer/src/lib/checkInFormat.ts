import type { CheckIn } from '../types'

/**
 * Serialise a CheckIn to Markdown.
 *
 * # 2026-03-20
 *
 * **Mood**: 4/5
 * **Energy**: 3/5
 *
 * ## Notes
 * Felt pretty good today.
 *
 * ## Nutrition
 * **Calories**: 2100
 * **Protein**: 150
 * **Carbs**: 220
 * **Fat**: 70
 *
 * ---
 * _Oura: Sleep 7.2h | HRV 52 | Readiness 81_
 */
export function formatCheckIn(checkIn: CheckIn): string {
  const lines: string[] = [`# ${checkIn.date}`, '']

  lines.push(`**Mood**: ${checkIn.mood}/5`)
  lines.push(`**Energy**: ${checkIn.energy}/5`)

  if (checkIn.notes.trim()) {
    lines.push('')
    lines.push('## Notes')
    lines.push(checkIn.notes.trim())
  }

  const n = checkIn.nutrition
  if (n && (n.calories != null || n.protein != null || n.carbs != null || n.fat != null)) {
    lines.push('')
    lines.push('## Nutrition')
    if (n.calories != null) lines.push(`**Calories**: ${n.calories}`)
    if (n.protein  != null) lines.push(`**Protein**: ${n.protein}`)
    if (n.carbs    != null) lines.push(`**Carbs**: ${n.carbs}`)
    if (n.fat      != null) lines.push(`**Fat**: ${n.fat}`)
  }

  if (checkIn.weight != null) {
    lines.push('')
    lines.push('## Body')
    lines.push(`**Weight**: ${checkIn.weight}`)
  }

  if (checkIn.oura) {
    const { sleep_hours, hrv_avg, readiness_score } = checkIn.oura
    const parts: string[] = []
    if (sleep_hours    != null) parts.push(`Sleep ${sleep_hours.toFixed(1)}h`)
    if (hrv_avg        != null) parts.push(`HRV ${hrv_avg}`)
    if (readiness_score != null) parts.push(`Readiness ${readiness_score}`)
    if (parts.length > 0) {
      lines.push('')
      lines.push('---')
      lines.push(`_Oura: ${parts.join(' | ')}_`)
    }
  }

  return lines.join('\n') + '\n'
}

/**
 * Parse a Markdown check-in file back into a CheckIn object.
 */
export function parseCheckIn(date: string, markdown: string): CheckIn {
  const lines = markdown.split('\n')

  let mood = 3
  let energy = 3
  let notes = ''
  let inNotes = false
  let inNutrition = false
  const nutrition: NonNullable<CheckIn['nutrition']> = {}

  for (const line of lines) {
    const moodMatch = line.match(/\*\*Mood\*\*:\s*(\d)\/5/)
    if (moodMatch) { mood = parseInt(moodMatch[1]); inNotes = false; inNutrition = false }

    const energyMatch = line.match(/\*\*Energy\*\*:\s*(\d)\/5/)
    if (energyMatch) { energy = parseInt(energyMatch[1]); inNotes = false; inNutrition = false }

    if (line === '## Notes')     { inNotes = true;  inNutrition = false; continue }
    if (line === '## Nutrition') { inNutrition = true; inNotes = false; continue }
    if (line === '## Body')      { inNutrition = false; inNotes = false; continue }
    if (line === '---')          { inNotes = false; inNutrition = false; continue }

    if (inNotes && line.trim()) {
      notes += (notes ? '\n' : '') + line
    }

    if (inNutrition) {
      const cal  = line.match(/\*\*Calories\*\*:\s*(\d+)/)
      const prot = line.match(/\*\*Protein\*\*:\s*([\d.]+)/)
      const carb = line.match(/\*\*Carbs\*\*:\s*([\d.]+)/)
      const fat  = line.match(/\*\*Fat\*\*:\s*([\d.]+)/)
      if (cal)  nutrition.calories = parseInt(cal[1])
      if (prot) nutrition.protein  = parseFloat(prot[1])
      if (carb) nutrition.carbs    = parseFloat(carb[1])
      if (fat)  nutrition.fat      = parseFloat(fat[1])
    }
  }

  // Parse Oura footer
  const ouraMatch = markdown.match(/_Oura:(.*?)_/)
  let oura: CheckIn['oura']
  if (ouraMatch) {
    const parts = ouraMatch[1].split('|').map((p) => p.trim())
    oura = {}
    for (const part of parts) {
      const sleepM = part.match(/Sleep\s+([\d.]+)h/)
      if (sleepM) oura.sleep_hours = parseFloat(sleepM[1])
      const hrvM = part.match(/HRV\s+([\d.]+)/)
      if (hrvM) oura.hrv_avg = parseFloat(hrvM[1])
      const readM = part.match(/Readiness\s+(\d+)/)
      if (readM) oura.readiness_score = parseInt(readM[1])
    }
  }

  const hasNutrition = Object.keys(nutrition).length > 0

  const weightMatch = markdown.match(/\*\*Weight\*\*:\s*([\d.]+)/)
  const weight = weightMatch ? parseFloat(weightMatch[1]) : undefined

  return { date, mood, energy, notes, nutrition: hasNutrition ? nutrition : undefined, weight, oura }
}
