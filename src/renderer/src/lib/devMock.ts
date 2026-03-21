/**
 * In-browser mock of window.baseline for dev preview (non-Electron).
 * Provides realistic stub data so the UI can be previewed without Electron.
 */

import type { OuraRow, Config, ScreeningResult, ChatMessage, YnabBudget, SpendingRow, ClinicianSnippet, Appointment } from '../types'

const today = new Date().toISOString().split('T')[0]

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86400000).toISOString().split('T')[0]
}

const mockOuraRows: OuraRow[] = [
  { date: daysAgo(6), sleep_score: '72', sleep_hours: '6.1', hrv_avg: '38', readiness_score: '68', activity_score: '71', steps: '7200', synced_at: today },
  { date: daysAgo(5), sleep_score: '85', sleep_hours: '7.8', hrv_avg: '52', readiness_score: '82', activity_score: '88', steps: '9500', synced_at: today },
  { date: daysAgo(4), sleep_score: '61', sleep_hours: '5.4', hrv_avg: '29', readiness_score: '55', activity_score: '60', steps: '4100', synced_at: today },
  { date: daysAgo(3), sleep_score: '78', sleep_hours: '7.2', hrv_avg: '45', readiness_score: '74', activity_score: '79', steps: '8300', synced_at: today },
  { date: daysAgo(2), sleep_score: '88', sleep_hours: '8.1', hrv_avg: '58', readiness_score: '87', activity_score: '90', steps: '10200', synced_at: today },
  { date: daysAgo(1), sleep_score: '70', sleep_hours: '6.3', hrv_avg: '41', readiness_score: '71', activity_score: '75', steps: '7800', synced_at: today },
  { date: today, sleep_score: '82', sleep_hours: '7.5', hrv_avg: '50', readiness_score: '79', activity_score: '83', steps: '5100', synced_at: today },
]

const mockCheckIns: Record<string, string> = {
  [daysAgo(6)]: `# ${daysAgo(6)}\n\n**Mood**: 2/5\n**Energy**: 2/5\n\n## Notes\nRough night, felt flat all day.\n\n---\n_Oura: Sleep 6.1h | HRV 38 | Readiness 68_\n`,
  [daysAgo(5)]: `# ${daysAgo(5)}\n\n**Mood**: 4/5\n**Energy**: 4/5\n\n## Notes\nGood energy, felt on top of things.\n\n---\n_Oura: Sleep 7.8h | HRV 52 | Readiness 82_\n`,
  [daysAgo(3)]: `# ${daysAgo(3)}\n\n**Mood**: 3/5\n**Energy**: 3/5\n\n---\n_Oura: Sleep 7.2h | HRV 45 | Readiness 74_\n`,
  [daysAgo(2)]: `# ${daysAgo(2)}\n\n**Mood**: 5/5\n**Energy**: 5/5\n\n## Notes\nBest day in a while. Went for a long run.\n\n---\n_Oura: Sleep 8.1h | HRV 58 | Readiness 87_\n`,
}

let mockConfig: Config = {
  ouraClientId: undefined,
  ouraAccessToken: undefined
}

const mockScreenings: ScreeningResult[] = [
  { type: 'PHQ-9', date: daysAgo(14), answers: [1,1,0,1,0,0,1,0,0], score: 4, severity: 'Minimal' },
  { type: 'PHQ-9', date: daysAgo(7),  answers: [2,2,1,2,1,1,1,0,0], score: 10, severity: 'Moderate' },
]

const mockAuthCallbacks: Array<(success: boolean, error?: string) => void> = []
const chatTokenCbs: Array<(token: string) => void> = []
const chatDoneCbs: Array<() => void> = []
const chatErrorCbs: Array<(err: string) => void> = []
let mockChatHistory: ChatMessage[] = []
let mockClinicianNotes: ClinicianSnippet[] = [
  {
    id: 'mock-snippet-1',
    savedAt: new Date().toISOString(),
    capturedDate: daysAgo(1),
    source: 'analyze',
    label: 'Sleep vs Readiness',
    text: 'Sleep vs Readiness (7 days)\n\nDate        | Sleep | Readiness\n            | ----- | ---------',
    chartMeta: {
      varA: 'sleep_hours',
      varB: 'readiness_score',
      numDays: 7,
      days: [
        { date: daysAgo(6), label: 'Mon', mood: 2, energy: 2, sleep_hours: 6.1, sleep_score: 72, hrv_avg: 38, readiness_score: 68, activity_score: 71, steps: 7200, calories: null, weight: null, medication: null, spending: null, phq9_score: null, menstrual_flow: null },
        { date: daysAgo(5), label: 'Tue', mood: 4, energy: 4, sleep_hours: 7.8, sleep_score: 85, hrv_avg: 52, readiness_score: 82, activity_score: 88, steps: 9500, calories: null, weight: null, medication: null, spending: null, phq9_score: null, menstrual_flow: null },
        { date: daysAgo(4), label: 'Wed', mood: 2, energy: 2, sleep_hours: 5.4, sleep_score: 61, hrv_avg: 29, readiness_score: 55, activity_score: 60, steps: 4100, calories: null, weight: null, medication: null, spending: null, phq9_score: null, menstrual_flow: null },
        { date: daysAgo(3), label: 'Thu', mood: 3, energy: 3, sleep_hours: 7.2, sleep_score: 78, hrv_avg: 45, readiness_score: 74, activity_score: 79, steps: 8300, calories: null, weight: null, medication: null, spending: null, phq9_score: null, menstrual_flow: null },
        { date: daysAgo(2), label: 'Fri', mood: 5, energy: 5, sleep_hours: 8.1, sleep_score: 88, hrv_avg: 58, readiness_score: 87, activity_score: 90, steps: 10200, calories: null, weight: null, medication: null, spending: null, phq9_score: null, menstrual_flow: null },
        { date: daysAgo(1), label: 'Sat', mood: 3, energy: 3, sleep_hours: 6.3, sleep_score: 70, hrv_avg: 41, readiness_score: 71, activity_score: 75, steps: 7800, calories: null, weight: null, medication: null, spending: null, phq9_score: null, menstrual_flow: null },
        { date: today,     label: 'Sun', mood: null, energy: null, sleep_hours: 7.5, sleep_score: 82, hrv_avg: 50, readiness_score: 79, activity_score: 83, steps: 5100, calories: null, weight: null, medication: null, spending: null, phq9_score: null, menstrual_flow: null },
      ],
    },
  },
]
let mockAppointments: Appointment[] = [
  {
    id: 'mock-appt-1',
    date: daysAgo(0),
    title: 'Dr. Smith',
    createdAt: new Date().toISOString(),
    snippetIds: ['mock-snippet-1'],
  },
]

const mockYnabBudgets: YnabBudget[] = [
  { id: 'budget-1', name: 'My Budget' }
]

const mockSpendingRows: SpendingRow[] = [
  { date: daysAgo(6), spending: '42.50', synced_at: today },
  { date: daysAgo(5), spending: '18.75', synced_at: today },
  { date: daysAgo(4), spending: '97.20', synced_at: today },
  { date: daysAgo(3), spending: '31.00', synced_at: today },
  { date: daysAgo(2), spending: '55.40', synced_at: today },
  { date: daysAgo(1), spending: '24.90', synced_at: today },
  { date: today,      spending: '12.30', synced_at: today },
]

export function installDevMock(): void {
  if (typeof window === 'undefined') return
  // Already injected by Electron preload
  if ((window as Window & { baseline?: unknown }).baseline) return

  ;(window as Window & { baseline: typeof window.baseline }).baseline = {
    getVaultPath: async () => null, // Forces Setup screen — change to '/mock/vault' to skip

    pickFolder: async () => '/Users/demo/Documents/Baseline',

    setupVault: async (_path: string) => {
      ;(window as Window & { baseline: typeof window.baseline }).baseline.getVaultPath =
        async () => '/mock/vault'
    },

    readConfig: async () => ({ ...mockConfig }),

    writeConfig: async (config: Config) => {
      mockConfig = { ...config }
    },

    // OAuth stubs — simulate a successful connect after 1.5s
    startOuraAuth: async (clientId: string, _clientSecret: string) => {
      mockConfig = {
        ...mockConfig,
        ouraClientId: clientId,
        ouraClientSecret: 'mock-secret',
        ouraAccessToken: 'mock-access-token',
        ouraRefreshToken: 'mock-refresh-token',
        ouraTokenExpiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000
      }
      setTimeout(() => {
        mockAuthCallbacks.forEach((cb) => cb(true))
      }, 1500)
    },

    disconnectOura: async () => {
      const { ouraAccessToken, ouraRefreshToken, ouraTokenExpiresAt, ...rest } = mockConfig
      void ouraAccessToken; void ouraRefreshToken; void ouraTokenExpiresAt
      mockConfig = rest
    },

    onOuraAuthResult: (cb: (success: boolean, error?: string) => void) => {
      mockAuthCallbacks.push(cb)
      return () => {
        const idx = mockAuthCallbacks.indexOf(cb)
        if (idx !== -1) mockAuthCallbacks.splice(idx, 1)
      }
    },

    readOuraCsv: async () => [...mockOuraRows],

    syncOura: async (_days?: number) => {
      await new Promise((r) => setTimeout(r, 1200))
      return [...mockOuraRows]
    },

    readCheckIn: async (date: string) => mockCheckIns[date] ?? null,

    writeCheckIn: async (date: string, content: string) => {
      mockCheckIns[date] = content
    },

    listCheckIns: async () => Object.keys(mockCheckIns),

    listScreenings: async () => [...mockScreenings],

    saveScreening: async (result: ScreeningResult) => {
      const idx = mockScreenings.findIndex(r => r.type === result.type && r.date === result.date)
      if (idx >= 0) mockScreenings[idx] = result
      else mockScreenings.unshift(result)
    },

    checkOllama: async () => {
      await new Promise((r) => setTimeout(r, 600))
      return { available: true }
    },

    generateSummary: async () => {
      await new Promise((r) => setTimeout(r, 1800))
      return "Yesterday's solid 8.1h of sleep and high HRV of 58 have set you up well — your readiness is strong today. Your energy and mood were both at their peak yesterday, which is a great sign heading into today. Focus on keeping your activity level up and you should feel great."
    },

    generateWarnings: async () => {
      await new Promise((r) => setTimeout(r, 1400))
      return JSON.stringify([
        'HRV dropped to 29 four days ago — well below your recent range',
        'Sleep under 6h on two of the last seven nights',
      ])
    },

    // Chat
    startChat: async (messages: ChatMessage[]) => {
      const last = messages[messages.length - 1]?.content ?? ''
      const reply = `(Preview) You asked: "${last}". In the real app, your Oura data, check-ins, and screenings are sent to your local Ollama model for analysis.`
      let i = 0
      const tick = () => {
        if (i < reply.length) {
          chatTokenCbs.forEach((cb) => cb(reply[i]))
          i++
          setTimeout(tick, 18)
        } else {
          chatDoneCbs.forEach((cb) => cb())
        }
      }
      setTimeout(tick, 300)
    },
    onChatToken: (cb: (token: string) => void) => {
      chatTokenCbs.push(cb)
      return () => { const idx = chatTokenCbs.indexOf(cb); if (idx !== -1) chatTokenCbs.splice(idx, 1) }
    },
    onChatDone: (cb: () => void) => {
      chatDoneCbs.push(cb)
      return () => { const idx = chatDoneCbs.indexOf(cb); if (idx !== -1) chatDoneCbs.splice(idx, 1) }
    },
    onChatError: (cb: (err: string) => void) => {
      chatErrorCbs.push(cb)
      return () => { const idx = chatErrorCbs.indexOf(cb); if (idx !== -1) chatErrorCbs.splice(idx, 1) }
    },
    readChatHistory: async () => [...mockChatHistory],
    writeChatHistory: async (messages: ChatMessage[]) => { mockChatHistory = [...messages] },

    // YNAB
    connectYnab: async (_pat: string) => {
      await new Promise((r) => setTimeout(r, 800))
      mockConfig = { ...mockConfig, ynabPat: _pat, ynabBudgetId: mockYnabBudgets[0].id, ynabBudgetName: mockYnabBudgets[0].name, ynabEnabled: true }
      return [...mockYnabBudgets]
    },
    syncYnab: async (_days?: number) => {
      await new Promise((r) => setTimeout(r, 1000))
      return [...mockSpendingRows]
    },
    readYnabCsv: async () => [...mockSpendingRows],
    disconnectYnab: async () => {
      const { ynabPat, ynabBudgetId, ynabBudgetName, ynabEnabled, ...rest } = mockConfig
      void ynabPat; void ynabBudgetId; void ynabBudgetName; void ynabEnabled
      mockConfig = rest
    },

    // Clinician notes
    readClinicianNotes: async () => [...mockClinicianNotes],
    writeClinicianNotes: async (notes: ClinicianSnippet[]) => { mockClinicianNotes = [...notes] },

    // Appointments
    readAppointments: async () => [...mockAppointments],
    writeAppointments: async (appointments: Appointment[]) => { mockAppointments = [...appointments] },

    // Export
    savePdf: async (_buffer: number[], filename: string) => {
      console.log(`[dev mock] savePdf called for "${filename}" (${_buffer.length} bytes) — no-op in browser preview`)
    },
  }
}
