/**
 * Capacitor implementation of window.baseline.
 *
 * Replaces the Electron IPC bridge when running on Android.  All file I/O
 * goes through @capacitor/filesystem (app-private storage).  HTTP calls to
 * the Oura and YNAB APIs use CapacitorHttp (native, CORS-free) which is
 * enabled globally via capacitor.config.ts → CapacitorHttp.enabled = true.
 */
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'
import { Browser } from '@capacitor/browser'
import { App as CapApp } from '@capacitor/app'
import { CapacitorHttp } from '@capacitor/core'
import Papa from 'papaparse'

import type {
  OuraRow,
  Config,
  ScreeningResult,
  ChatMessage,
  YnabBudget,
  SpendingRow
} from '../types'

// ─── Constants ────────────────────────────────────────────────────────────────

/** Root of the vault inside Directory.Data (app-private storage). */
const VAULT = 'vault'

const OURA_AUTH_URL  = 'https://cloud.ouraring.com/oauth/authorize'
const OURA_TOKEN_URL = 'https://api.ouraring.com/oauth/token'
/**
 * Deep-link redirect URI for Android OAuth.
 * Register "baseline://oura-auth" as a redirect URI in the Oura OAuth app
 * portal alongside the desktop loopback URI.
 */
const OURA_REDIRECT_URI = 'baseline://oura-auth'

const YNAB_BASE = 'https://api.ynab.com/v1'

// ─── Callback registries (push-style events) ──────────────────────────────────

const ouraAuthCallbacks: Array<(success: boolean, error?: string) => void> = []

// ─── Filesystem helpers ───────────────────────────────────────────────────────

async function fsRead(path: string): Promise<string | null> {
  try {
    const result = await Filesystem.readFile({
      path,
      directory: Directory.Data,
      encoding: Encoding.UTF8
    })
    return result.data as string
  } catch {
    return null
  }
}

async function fsWrite(path: string, data: string): Promise<void> {
  await Filesystem.writeFile({
    path,
    directory: Directory.Data,
    data,
    encoding: Encoding.UTF8,
    recursive: true   // creates intermediate directories if needed
  })
}

async function fsReaddir(path: string): Promise<string[]> {
  try {
    const result = await Filesystem.readdir({ path, directory: Directory.Data })
    return result.files.map((f) => f.name)
  } catch {
    return []
  }
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

async function readConfigFromVault(): Promise<Config> {
  const raw = await fsRead(`${VAULT}/.baseline/config.json`)
  if (!raw) return {}
  try { return JSON.parse(raw) as Config } catch { return {} }
}

async function writeConfigToVault(config: Config): Promise<void> {
  await fsWrite(`${VAULT}/.baseline/config.json`, JSON.stringify(config, null, 2))
}

/** Returns a valid Oura access token, refreshing if within 5 minutes of expiry. */
async function getValidAccessToken(config: Config): Promise<string> {
  if (!config.ouraAccessToken) throw new Error('Oura not connected')
  if (!config.ouraRefreshToken) throw new Error('No refresh token stored')

  const expiresAt = config.ouraTokenExpiresAt ?? 0
  if (Date.now() < expiresAt - 5 * 60 * 1000) {
    return config.ouraAccessToken
  }

  // Token needs refresh
  const res = await CapacitorHttp.post({
    url: OURA_TOKEN_URL,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    data: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: config.ouraRefreshToken,
      client_id: config.ouraClientId!,
      client_secret: config.ouraClientSecret!
    }).toString()
  })
  if (res.status !== 200) throw new Error(`Token refresh failed (${res.status})`)

  const tokens = res.data as { access_token: string; refresh_token: string; expires_in: number }
  const updated: Config = {
    ...config,
    ouraAccessToken: tokens.access_token,
    ouraRefreshToken: tokens.refresh_token,
    ouraTokenExpiresAt: Date.now() + tokens.expires_in * 1000
  }
  await writeConfigToVault(updated)
  return tokens.access_token
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createCapacitorBaseline(): typeof window.baseline {
  return {
    // ── Vault ──────────────────────────────────────────────────────────────

    getVaultPath: async () => {
      // Vault is set up when the .baseline directory exists
      try {
        await Filesystem.readdir({ path: `${VAULT}/.baseline`, directory: Directory.Data })
        return VAULT
      } catch {
        return null
      }
    },

    pickFolder: async () => {
      // No folder picker on Android; the vault lives in app-private storage
      return VAULT
    },

    setupVault: async (_vaultPath: string) => {
      const dirs = [
        `${VAULT}/.baseline`,
        `${VAULT}/check-ins`,
        `${VAULT}/oura`,
        `${VAULT}/ynab`,
        `${VAULT}/summaries`,
        `${VAULT}/screenings`
      ]
      for (const dir of dirs) {
        try {
          await Filesystem.mkdir({ path: dir, directory: Directory.Data, recursive: true })
        } catch {
          // Already exists — ignore
        }
      }
    },

    // ── Config ─────────────────────────────────────────────────────────────

    readConfig: readConfigFromVault,

    writeConfig: writeConfigToVault,

    // ── Oura OAuth ─────────────────────────────────────────────────────────

    startOuraAuth: async (clientId: string, clientSecret: string) => {
      // Save credentials before opening browser so the callback can read them
      const config = await readConfigFromVault()
      await writeConfigToVault({ ...config, ouraClientId: clientId, ouraClientSecret: clientSecret })

      const state = Math.random().toString(36).substring(2, 18)
      const params = new URLSearchParams({
        response_type: 'code',
        client_id: clientId,
        redirect_uri: OURA_REDIRECT_URI,
        scope: 'daily',
        state
      })
      const authUrl = `${OURA_AUTH_URL}?${params}`

      // Register a one-shot deep-link listener before opening the browser
      let listenerHandle: Awaited<ReturnType<typeof CapApp.addListener>> | null = null

      listenerHandle = await CapApp.addListener('appUrlOpen', async (event) => {
        if (!event.url.startsWith('baseline://oura-auth')) return
        await listenerHandle?.remove()
        listenerHandle = null

        try {
          const url = new URL(event.url)
          const code  = url.searchParams.get('code')
          const error = url.searchParams.get('error')

          if (error || !code) {
            ouraAuthCallbacks.forEach((cb) => cb(false, error ?? 'No code received'))
            return
          }

          const res = await CapacitorHttp.post({
            url: OURA_TOKEN_URL,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            data: new URLSearchParams({
              grant_type: 'authorization_code',
              code,
              client_id: clientId,
              client_secret: clientSecret,
              redirect_uri: OURA_REDIRECT_URI
            }).toString()
          })
          if (res.status !== 200) throw new Error(`Token exchange failed (${res.status})`)

          const tokens = res.data as {
            access_token: string
            refresh_token: string
            expires_in: number
          }
          const latest = await readConfigFromVault()
          await writeConfigToVault({
            ...latest,
            ouraAccessToken: tokens.access_token,
            ouraRefreshToken: tokens.refresh_token,
            ouraTokenExpiresAt: Date.now() + tokens.expires_in * 1000
          })

          await Browser.close()
          ouraAuthCallbacks.forEach((cb) => cb(true))
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Auth failed'
          ouraAuthCallbacks.forEach((cb) => cb(false, msg))
        }
      })

      await Browser.open({ url: authUrl })
      return authUrl
    },

    disconnectOura: async () => {
      const config = await readConfigFromVault()
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { ouraAccessToken, ouraRefreshToken, ouraTokenExpiresAt, ...rest } = config
      await writeConfigToVault(rest)
    },

    onOuraAuthResult: (cb: (success: boolean, error?: string) => void) => {
      ouraAuthCallbacks.push(cb)
      return () => {
        const idx = ouraAuthCallbacks.indexOf(cb)
        if (idx !== -1) ouraAuthCallbacks.splice(idx, 1)
      }
    },

    // ── Oura data ──────────────────────────────────────────────────────────

    readOuraCsv: async () => {
      const raw = await fsRead(`${VAULT}/oura/oura.csv`)
      if (!raw) return []
      return Papa.parse<OuraRow>(raw, { header: true, skipEmptyLines: true }).data
    },

    syncOura: async (days = 14) => {
      const config = await readConfigFromVault()
      const accessToken = await getValidAccessToken(config)

      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const endDate   = formatDate(tomorrow)
      const startDate = formatDate(new Date(Date.now() - days * 86400000))

      async function fetchOura(endpoint: string): Promise<unknown[]> {
        const res = await CapacitorHttp.get({
          url: `https://api.ouraring.com/v2/usercollection/${endpoint}?start_date=${startDate}&end_date=${endDate}`,
          headers: { Authorization: `Bearer ${accessToken}` }
        })
        if (res.status !== 200) throw new Error(`Oura API error ${res.status} for ${endpoint}`)
        return ((res.data as { data: unknown[] }).data) ?? []
      }

      type DailySleepDay = { day: string; score: number }
      type SleepSession  = { day: string; total_sleep_duration: number; type: string }
      type ReadinessDay  = { day: string; score: number; contributors?: { hrv_balance?: number } }
      type ActivityDay   = { day: string; score: number; steps: number }

      const [dailySleepData, sleepSessionData, readinessData, activityData] = await Promise.all([
        fetchOura('daily_sleep')     as Promise<DailySleepDay[]>,
        fetchOura('sleep')           as Promise<SleepSession[]>,
        fetchOura('daily_readiness') as Promise<ReadinessDay[]>,
        fetchOura('daily_activity')  as Promise<ActivityDay[]>
      ])

      // Sum non-deleted sleep sessions per day to get total sleep hours
      const sleepSecByDay = new Map<string, number>()
      for (const s of sleepSessionData) {
        if (s.type === 'deleted_sleep') continue
        sleepSecByDay.set(s.day, (sleepSecByDay.get(s.day) ?? 0) + (s.total_sleep_duration ?? 0))
      }

      const dailySleepMap = new Map(dailySleepData.map((d) => [d.day, d]))
      const readinessMap  = new Map(readinessData.map((d) => [d.day, d]))
      const activityMap   = new Map(activityData.map((d) => [d.day, d]))

      const allDays = new Set([
        ...dailySleepData.map((d) => d.day),
        ...sleepSessionData.map((d) => d.day),
        ...readinessData.map((d) => d.day),
        ...activityData.map((d) => d.day)
      ])

      const syncedAt = new Date().toISOString()
      const newRows: OuraRow[] = Array.from(allDays).map((day) => {
        const sleep     = dailySleepMap.get(day)
        const readiness = readinessMap.get(day)
        const activity  = activityMap.get(day)
        const sleepSec  = sleepSecByDay.get(day) ?? 0
        const sleepHours = sleepSec > 0 ? (sleepSec / 3600).toFixed(1) : ''
        const hrv = readiness?.contributors?.hrv_balance
        return {
          date:             day,
          sleep_score:      sleep?.score       != null ? String(sleep.score)       : '',
          sleep_hours:      sleepHours,
          hrv_avg:          hrv                != null ? String(hrv)               : '',
          readiness_score:  readiness?.score   != null ? String(readiness.score)   : '',
          activity_score:   activity?.score    != null ? String(activity.score)    : '',
          steps:            activity?.steps    != null ? String(activity.steps)    : '',
          synced_at:        syncedAt
        }
      })

      // Upsert: merge new rows into existing CSV
      const existingRaw = await fsRead(`${VAULT}/oura/oura.csv`)
      const existing = existingRaw
        ? Papa.parse<OuraRow>(existingRaw, { header: true, skipEmptyLines: true }).data
        : []
      const rowMap = new Map<string, OuraRow>(existing.map((r) => [r.date, r]))
      for (const row of newRows) rowMap.set(row.date, row)
      const sorted = Array.from(rowMap.values()).sort((a, b) => a.date.localeCompare(b.date))
      await fsWrite(`${VAULT}/oura/oura.csv`, Papa.unparse(sorted))
      return sorted
    },

    // ── Check-ins ──────────────────────────────────────────────────────────

    readCheckIn: async (date: string) => fsRead(`${VAULT}/check-ins/${date}.md`),

    writeCheckIn: async (date: string, content: string) => {
      await fsWrite(`${VAULT}/check-ins/${date}.md`, content)
    },

    listCheckIns: async () => {
      const files = await fsReaddir(`${VAULT}/check-ins`)
      return files
        .filter((f) => f.endsWith('.md'))
        .map((f) => f.replace('.md', ''))
        .sort()
    },

    // ── Screenings ─────────────────────────────────────────────────────────

    listScreenings: async () => {
      const types = await fsReaddir(`${VAULT}/screenings`)
      const results: ScreeningResult[] = []
      for (const type of types) {
        const files = await fsReaddir(`${VAULT}/screenings/${type}`)
        for (const file of files.filter((f) => f.endsWith('.json'))) {
          const raw = await fsRead(`${VAULT}/screenings/${type}/${file}`)
          if (raw) {
            try { results.push(JSON.parse(raw) as ScreeningResult) } catch { /* skip */ }
          }
        }
      }
      return results.sort((a, b) => b.date.localeCompare(a.date))
    },

    saveScreening: async (result: ScreeningResult) => {
      await fsWrite(
        `${VAULT}/screenings/${result.type}/${result.date}.json`,
        JSON.stringify(result, null, 2)
      )
    },

    // ── Ollama / chat — not supported on Android ───────────────────────────

    checkOllama:     async () => ({ available: false }),
    generateSummary: async () => '',
    startChat:       async (_messages: ChatMessage[]) => { /* no-op */ },
    onChatToken:     (_cb: (token: string) => void)  => () => {},
    onChatDone:      (_cb: () => void)               => () => {},
    onChatError:     (_cb: (err: string) => void)    => () => {},
    readChatHistory:  async () => [] as ChatMessage[],
    writeChatHistory: async (_messages: ChatMessage[]) => { /* no-op */ },

    // ── YNAB ───────────────────────────────────────────────────────────────

    connectYnab: async (pat: string) => {
      const res = await CapacitorHttp.get({
        url: `${YNAB_BASE}/budgets`,
        headers: { Authorization: `Bearer ${pat}` }
      })
      if (res.status !== 200) {
        throw new Error(`YNAB error ${res.status} — check your Personal Access Token`)
      }
      const json = res.data as { data: { budgets: YnabBudget[] } }
      return json.data.budgets.map((b) => ({ id: b.id, name: b.name }))
    },

    syncYnab: async (days = 30) => {
      const config = await readConfigFromVault()
      if (!config.ynabPat || !config.ynabBudgetId) throw new Error('YNAB is not configured')

      const since = new Date()
      since.setDate(since.getDate() - days)
      const sinceStr = formatDate(since)

      const res = await CapacitorHttp.get({
        url: `${YNAB_BASE}/budgets/${config.ynabBudgetId}/transactions?since_date=${sinceStr}`,
        headers: { Authorization: `Bearer ${config.ynabPat}` }
      })
      if (res.status !== 200) throw new Error(`YNAB sync failed: ${res.status}`)

      interface YnabTransaction {
        id: string
        date: string
        amount: number
        transfer_account_id: string | null
        deleted: boolean
      }
      const json = res.data as { data: { transactions: YnabTransaction[] } }

      // Aggregate outflow by date; skip transfers and deleted entries
      const byDate = new Map<string, number>()
      for (const t of json.data.transactions) {
        if (t.deleted || t.transfer_account_id || t.amount >= 0) continue
        byDate.set(t.date, (byDate.get(t.date) ?? 0) + Math.abs(t.amount))
      }

      const now = new Date().toISOString()
      const existingRaw = await fsRead(`${VAULT}/ynab/spending.csv`)
      const existing = new Map(
        existingRaw
          ? Papa.parse<SpendingRow>(existingRaw, { header: true, skipEmptyLines: true })
              .data.map((r) => [r.date, r])
          : []
      )
      for (const [date, milliunits] of byDate) {
        existing.set(date, { date, spending: (milliunits / 1000).toFixed(2), synced_at: now })
      }
      const merged = [...existing.values()].sort((a, b) => a.date.localeCompare(b.date))
      await fsWrite(`${VAULT}/ynab/spending.csv`, Papa.unparse(merged))
      return merged
    },

    readYnabCsv: async () => {
      const raw = await fsRead(`${VAULT}/ynab/spending.csv`)
      if (!raw) return []
      return Papa.parse<SpendingRow>(raw, { header: true, skipEmptyLines: true }).data
    },

    disconnectYnab: async () => {
      const config = await readConfigFromVault()
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { ynabPat, ynabBudgetId, ynabBudgetName, ynabEnabled, ...rest } = config
      await writeConfigToVault(rest)
    }
  }
}
