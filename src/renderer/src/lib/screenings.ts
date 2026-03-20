export type ScreeningFrequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly'

export const FREQUENCY_LABELS: Record<ScreeningFrequency, string> = {
  weekly: 'Weekly',
  biweekly: 'Every 2 weeks',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
}

export const FREQUENCY_DAYS: Record<ScreeningFrequency, number> = {
  weekly: 7,
  biweekly: 14,
  monthly: 30,
  quarterly: 90,
}

export interface ScreeningDef {
  id: string
  fullName: string
  subtitle: string
  questions: string[]
  responseOptions: string[] // labels for values 0, 1, 2, …
  score(answers: number[]): { score: number; severity: string }
}

export const PHQ9: ScreeningDef = {
  id: 'PHQ-9',
  fullName: 'Patient Health Questionnaire (PHQ-9)',
  subtitle:
    'Over the last 2 weeks, how often have you been bothered by any of the following problems?',
  questions: [
    'Little interest or pleasure in doing things',
    'Feeling down, depressed, or hopeless',
    'Trouble falling or staying asleep, or sleeping too much',
    'Feeling tired or having little energy',
    'Poor appetite or overeating',
    'Feeling bad about yourself — or that you are a failure or have let yourself or your family down',
    'Trouble concentrating on things, such as reading the newspaper or watching television',
    'Moving or speaking so slowly that other people could have noticed? Or the opposite — being so fidgety or restless that you have been moving around a lot more than usual',
    'Thoughts that you would be better off dead, or of hurting yourself in some way',
  ],
  responseOptions: ['Not at all', 'Several days', 'More than half the days', 'Nearly every day'],
  score(answers) {
    const total = answers.reduce((sum, a) => sum + a, 0)
    let severity: string
    if (total >= 20) severity = 'Severe'
    else if (total >= 15) severity = 'Moderately severe'
    else if (total >= 10) severity = 'Moderate'
    else if (total >= 5) severity = 'Mild'
    else severity = 'Minimal'
    return { score: total, severity }
  },
}

export const ALL_SCREENINGS: ScreeningDef[] = [PHQ9]
export const SCREENING_MAP: Record<string, ScreeningDef> = Object.fromEntries(
  ALL_SCREENINGS.map((s) => [s.id, s])
)

/** Returns true if the screening is due based on last completion date. */
export function isDue(lastDate: string | null | undefined, frequency: ScreeningFrequency): boolean {
  if (!lastDate) return true
  const daysSince =
    (Date.now() - new Date(lastDate + 'T12:00:00').getTime()) / 86_400_000
  return daysSince >= FREQUENCY_DAYS[frequency]
}

/** Severity colour for display. */
export function severityColor(severity: string): string {
  switch (severity) {
    case 'Minimal': return 'text-green-400'
    case 'Mild': return 'text-yellow-400'
    case 'Moderate': return 'text-orange-400'
    case 'Moderately severe': return 'text-red-400'
    case 'Severe': return 'text-red-500'
    default: return 'text-[--color-muted]'
  }
}
