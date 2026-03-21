export interface Config {
  ouraClientId?: string
  ouraClientSecret?: string
  ouraAccessToken?: string
  ouraRefreshToken?: string
  ouraTokenExpiresAt?: number // Unix ms timestamp
  summaryDate?: string        // YYYY-MM-DD of last generated summary
  summaryText?: string        // cached summary text
  warningsEnabled?: boolean
  warningsDate?: string       // YYYY-MM-DD of last generated warnings
  warningsText?: string       // JSON-serialised string[] or "[]" for no warnings
  ollamaSummariesEnabled?: boolean
  ollamaModel?: string        // defaults to 'llama3.2'
  chatEnabled?: boolean
  chatHistory?: 'session' | 'daily' | 'persistent'
  nutritionEnabled?: boolean
  weightEnabled?: boolean
  medicationEnabled?: boolean
  menstrualEnabled?: boolean
  ynabEnabled?: boolean
  ynabPat?: string
  ynabBudgetId?: string
  ynabBudgetName?: string
  screeningsEnabled?: string[]
  screeningFrequency?: 'weekly' | 'biweekly' | 'monthly' | 'quarterly'
  remindersEnabled?: boolean
  reminderTime?: string   // "HH:MM" 24h format, e.g. "09:00"
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface YnabBudget {
  id: string
  name: string
}

export interface SpendingRow {
  date: string
  spending: string   // decimal string, e.g. "45.23"
  synced_at: string
}

export interface ScreeningResult {
  type: string       // e.g. 'PHQ-9'
  date: string       // YYYY-MM-DD
  answers: number[]
  score: number
  severity: string
}

export interface OuraRow {
  date: string
  sleep_score: string
  sleep_hours: string
  hrv_avg: string
  readiness_score: string
  activity_score: string
  steps: string
  synced_at: string
}

export interface CheckIn {
  date: string
  mood: number
  energy: number
  notes: string
  nutrition?: {
    calories?: number
    protein?: number
    carbs?: number
    fat?: number
  }
  weight?: number
  medication?: boolean
  menstrualFlow?: 'none' | 'light' | 'medium' | 'heavy'
  // Oura data embedded in the file (parsed back out)
  oura?: {
    sleep_hours?: number
    hrv_avg?: number
    readiness_score?: number
  }
}

export interface ClinicianSnippetChartMeta {
  varA: string
  varB: string
  days: DayData[]
  numDays: number
}

export interface ClinicianSnippet {
  id: string
  savedAt: string      // ISO timestamp
  capturedDate: string // YYYY-MM-DD — date the data refers to
  source: 'check-in' | 'analyze'
  label: string
  text: string
  comment?: string
  chartMeta?: ClinicianSnippetChartMeta
}

export interface Appointment {
  id: string
  date: string         // YYYY-MM-DD
  title?: string
  createdAt: string    // ISO timestamp
  snippetIds: string[]
}

export interface DayData {
  date: string
  label: string // "Mon", "Tue" etc.
  mood: number | null
  energy: number | null
  sleep_hours: number | null
  sleep_score: number | null
  hrv_avg: number | null
  readiness_score: number | null
  activity_score: number | null
  steps: number | null
  calories: number | null
  weight: number | null
  medication: number | null  // 1 = took, 0 = didn't take, null = not logged
  spending: number | null
  phq9_score: number | null
  menstrual_flow: number | null  // 0=none, 1=light, 2=medium, 3=heavy
}
