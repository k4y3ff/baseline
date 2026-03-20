export interface Config {
  ouraClientId?: string
  ouraClientSecret?: string
  ouraAccessToken?: string
  ouraRefreshToken?: string
  ouraTokenExpiresAt?: number // Unix ms timestamp
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
  // Oura data embedded in the file (parsed back out)
  oura?: {
    sleep_hours?: number
    hrv_avg?: number
    readiness_score?: number
  }
}

export interface DayData {
  date: string
  label: string // "Mon", "Tue" etc.
  mood: number | null
  energy: number | null
  sleep_hours: number | null
  hrv_avg: number | null
  readiness_score: number | null
  activity_score: number | null
  steps: number | null
}
