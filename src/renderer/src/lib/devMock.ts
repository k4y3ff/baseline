/**
 * In-browser mock of window.baseline for dev preview (non-Electron).
 * Provides realistic stub data so the UI can be previewed without Electron.
 */

import type { OuraRow, Config } from '../types'

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

const mockAuthCallbacks: Array<(success: boolean, error?: string) => void> = []

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

    listCheckIns: async () => Object.keys(mockCheckIns)
  }
}
