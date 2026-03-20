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

  if (checkIn.oura) {
    const { sleep_hours, hrv_avg, readiness_score } = checkIn.oura
    const parts: string[] = []
    if (sleep_hours != null) parts.push(`Sleep ${sleep_hours.toFixed(1)}h`)
    if (hrv_avg != null) parts.push(`HRV ${hrv_avg}`)
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

  for (const line of lines) {
    const moodMatch = line.match(/\*\*Mood\*\*:\s*(\d)\/5/)
    if (moodMatch) {
      mood = parseInt(moodMatch[1])
      inNotes = false
    }
    const energyMatch = line.match(/\*\*Energy\*\*:\s*(\d)\/5/)
    if (energyMatch) {
      energy = parseInt(energyMatch[1])
      inNotes = false
    }
    if (line === '## Notes') {
      inNotes = true
      continue
    }
    if (line === '---') {
      inNotes = false
      continue
    }
    if (inNotes && line.trim()) {
      notes += (notes ? '\n' : '') + line
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

  return { date, mood, energy, notes, oura }
}
