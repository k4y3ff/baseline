import { app, BrowserWindow, ipcMain, dialog, shell, Tray, nativeImage, Notification } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs'
import { createServer } from 'http'
import { spawn } from 'child_process'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import Papa from 'papaparse'

// ─── Custom protocol ──────────────────────────────────────────────────────────
// Primary redirect: baseline://oauth/callback (custom URI scheme, RFC 8252 §7.1)
// Fallback redirect: http://127.0.0.1:PORT  (loopback, RFC 8252 §7.3)
app.setName('Baseline')
app.setAsDefaultProtocolClient('baseline')

// ─── Vault path persistence ───────────────────────────────────────────────────
const vaultRefPath = join(app.getPath('userData'), 'vault-path.txt')

function getVaultPath(): string | null {
  if (existsSync(vaultRefPath)) {
    return readFileSync(vaultRefPath, 'utf-8').trim()
  }
  return null
}

function setVaultPath(vaultPath: string): void {
  writeFileSync(vaultRefPath, vaultPath, 'utf-8')
}

// ─── Config ───────────────────────────────────────────────────────────────────
interface Config {
  ouraClientId?: string
  ouraClientSecret?: string
  ouraAccessToken?: string
  ouraRefreshToken?: string
  ouraTokenExpiresAt?: number // Unix ms timestamp
  summaryDate?: string        // YYYY-MM-DD of the last generated summary
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
  ynabEnabled?: boolean
  ynabPat?: string
  ynabBudgetId?: string
  ynabBudgetName?: string
  screeningsEnabled?: string[]
  screeningFrequency?: 'weekly' | 'biweekly' | 'monthly' | 'quarterly'
  remindersEnabled?: boolean
  reminderTime?: string   // "HH:MM" 24h format, e.g. "09:00"
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

function getConfigPath(vaultPath: string): string {
  return join(vaultPath, '.baseline', 'config.json')
}

function readConfig(vaultPath: string): Config {
  const configPath = getConfigPath(vaultPath)
  if (!existsSync(configPath)) return {}
  try {
    return JSON.parse(readFileSync(configPath, 'utf-8'))
  } catch {
    return {}
  }
}

function writeConfig(vaultPath: string, config: Config): void {
  const dir = join(vaultPath, '.baseline')
  mkdirSync(dir, { recursive: true })
  writeFileSync(getConfigPath(vaultPath), JSON.stringify(config, null, 2), 'utf-8')
}

// ─── Oura OAuth ───────────────────────────────────────────────────────────────
const OURA_AUTH_URL = 'https://cloud.ouraring.com/oauth/authorize'
const OURA_TOKEN_URL = 'https://api.ouraring.com/oauth/token'

// Redirect URI: http://localhost:35791/callback
// Register exactly "http://localhost:35791/callback" in the Oura OAuth app portal.
const LOOPBACK_PORT = 35791
const LOOPBACK_REDIRECT = `http://localhost:${LOOPBACK_PORT}/callback`

function buildAuthUrl(clientId: string, redirectUri: string): string {
  const state = require('crypto').randomBytes(16).toString('hex')
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'daily',
    state
  })
  return `${OURA_AUTH_URL}?${params}`
}


interface TokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
}

async function exchangeCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<TokenResponse> {
  const res = await fetch(OURA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri
    })
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Token exchange failed (${res.status}): ${body}`)
  }
  return res.json() as Promise<TokenResponse>
}

async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<TokenResponse> {
  const res = await fetch(OURA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret
    })
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Token refresh failed (${res.status}): ${body}`)
  }
  return res.json() as Promise<TokenResponse>
}

/** Returns a valid access token, refreshing if within 5 minutes of expiry. */
async function getValidAccessToken(vaultPath: string): Promise<string> {
  const config = readConfig(vaultPath)
  if (!config.ouraAccessToken) throw new Error('Oura not connected')
  if (!config.ouraRefreshToken) throw new Error('No refresh token stored')

  const expiresAt = config.ouraTokenExpiresAt ?? 0
  const fiveMinutes = 5 * 60 * 1000
  if (Date.now() < expiresAt - fiveMinutes) {
    return config.ouraAccessToken
  }

  // Refresh
  const tokens = await refreshAccessToken(
    config.ouraRefreshToken,
    config.ouraClientId!,
    config.ouraClientSecret!
  )
  const updated: Config = {
    ...config,
    ouraAccessToken: tokens.access_token,
    ouraRefreshToken: tokens.refresh_token,
    ouraTokenExpiresAt: Date.now() + tokens.expires_in * 1000
  }
  writeConfig(vaultPath, updated)
  return tokens.access_token
}

// ─── Oura CSV ─────────────────────────────────────────────────────────────────
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

function getOuraCsvPath(vaultPath: string): string {
  return join(vaultPath, 'oura', 'oura.csv')
}

function readOuraCsv(vaultPath: string): OuraRow[] {
  const csvPath = getOuraCsvPath(vaultPath)
  if (!existsSync(csvPath)) return []
  const raw = readFileSync(csvPath, 'utf-8')
  const result = Papa.parse<OuraRow>(raw, { header: true, skipEmptyLines: true })
  return result.data
}

function upsertOuraRows(vaultPath: string, newRows: OuraRow[]): void {
  const existing = readOuraCsv(vaultPath)
  const map = new Map<string, OuraRow>(existing.map((r) => [r.date, r]))
  for (const row of newRows) {
    map.set(row.date, row)
  }
  const sorted = Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date))
  const dir = join(vaultPath, 'oura')
  mkdirSync(dir, { recursive: true })
  const csv = Papa.unparse(sorted)
  writeFileSync(getOuraCsvPath(vaultPath), csv, 'utf-8')
}

// ─── Oura data sync ───────────────────────────────────────────────────────────
// Use local calendar date, not UTC — Oura keys data by the user's local date.
function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

async function fetchOura(
  endpoint: string,
  accessToken: string,
  startDate: string,
  endDate: string
): Promise<unknown[]> {
  const url = `https://api.ouraring.com/v2/usercollection/${endpoint}?start_date=${startDate}&end_date=${endDate}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  })
  if (!res.ok) {
    throw new Error(`Oura API error ${res.status} for ${endpoint}`)
  }
  const json = (await res.json()) as { data: unknown[] }
  return json.data ?? []
}

async function syncOura(vaultPath: string, days = 14): Promise<OuraRow[]> {
  const accessToken = await getValidAccessToken(vaultPath)

  // end_date is tomorrow (local) so today's data is always within range
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const endDate = formatDate(tomorrow)
  const startDate = formatDate(new Date(Date.now() - days * 86400000))

  // daily_sleep  → sleep score only (contributors.total_sleep is a 1–100 score, NOT seconds)
  // sleep         → session-level; total_sleep_duration is actual seconds; sum "long_sleep" per day
  // daily_readiness → readiness score + hrv_balance contributor score
  // daily_activity  → activity score + steps
  type DailySleepDay = { day: string; score: number }
  type SleepSession = { day: string; total_sleep_duration: number; type: string }
  type ReadinessDay = { day: string; score: number; contributors?: { hrv_balance?: number } }
  type ActivityDay = { day: string; score: number; steps: number }

  const [dailySleepData, sleepSessionData, readinessData, activityData] = await Promise.all([
    fetchOura('daily_sleep', accessToken, startDate, endDate) as Promise<DailySleepDay[]>,
    fetchOura('sleep', accessToken, startDate, endDate) as Promise<SleepSession[]>,
    fetchOura('daily_readiness', accessToken, startDate, endDate) as Promise<ReadinessDay[]>,
    fetchOura('daily_activity', accessToken, startDate, endDate) as Promise<ActivityDay[]>
  ])

  // Sum all non-nap sleep sessions per day to get total sleep hours.
  const sleepSecByDay = new Map<string, number>()
  for (const s of sleepSessionData) {
    if (s.type === 'deleted_sleep') continue
    sleepSecByDay.set(s.day, (sleepSecByDay.get(s.day) ?? 0) + (s.total_sleep_duration ?? 0))
  }

  // Union all dates from all four sources so a day isn't dropped just because
  // one metric (e.g. readiness) isn't computed yet.
  const dailySleepMap = new Map(dailySleepData.map((d) => [d.day, d]))
  const readinessMap = new Map(readinessData.map((d) => [d.day, d]))
  const activityMap = new Map(activityData.map((d) => [d.day, d]))

  const allDays = new Set([
    ...dailySleepData.map((d) => d.day),
    ...sleepSessionData.map((d) => d.day),
    ...readinessData.map((d) => d.day),
    ...activityData.map((d) => d.day)
  ])

  const syncedAt = new Date().toISOString()
  const rows: OuraRow[] = Array.from(allDays).map((day) => {
    const sleep = dailySleepMap.get(day)
    const readiness = readinessMap.get(day)
    const activity = activityMap.get(day)
    const sleepSec = sleepSecByDay.get(day) ?? 0
    const sleepHours = sleepSec > 0 ? (sleepSec / 3600).toFixed(1) : ''
    const hrv = readiness?.contributors?.hrv_balance
    return {
      date: day,
      sleep_score: sleep?.score != null ? String(sleep.score) : '',
      sleep_hours: sleepHours,
      hrv_avg: hrv != null ? String(hrv) : '',
      readiness_score: readiness?.score != null ? String(readiness.score) : '',
      activity_score: activity?.score != null ? String(activity.score) : '',
      steps: activity?.steps != null ? String(activity.steps) : '',
      synced_at: syncedAt
    }
  })

  upsertOuraRows(vaultPath, rows)
  return rows
}

// ─── Ollama / LLM summary ─────────────────────────────────────────────────────
const OLLAMA_BASE = 'http://localhost:11434'
const OLLAMA_MODEL = 'llama3.2'

async function ollamaRunning(): Promise<boolean> {
  try {
    const res = await fetch(OLLAMA_BASE)
    return res.status < 500
  } catch {
    return false
  }
}

async function ensureOllama(): Promise<void> {
  if (await ollamaRunning()) return

  // Spawn ollama serve, but listen for errors so ENOENT (not installed) doesn't
  // become an uncaught exception that crashes the main process.
  await new Promise<void>((resolve, reject) => {
    const child = spawn('ollama', ['serve'], { detached: true, stdio: 'ignore' })

    child.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'ENOENT') {
        reject(new Error('Ollama is not installed. Download it from https://ollama.com'))
      } else {
        reject(new Error(`Failed to start Ollama: ${err.message}`))
      }
    })

    // If no error fires within 300 ms the process launched successfully
    setTimeout(() => { child.unref(); resolve() }, 300)
  })

  // Wait up to 15 s for it to respond
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 600))
    if (await ollamaRunning()) return
  }
  throw new Error('Ollama started but is not responding. Try running "ollama serve" in a terminal.')
}

function localDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

async function generateDailySummary(vaultPath: string, force = false): Promise<string> {
  const config = readConfig(vaultPath)
  const model = config.ollamaModel?.trim() || OLLAMA_MODEL

  const today = localDateStr(new Date())
  const yesterdayDate = new Date()
  yesterdayDate.setDate(yesterdayDate.getDate() - 1)
  const yesterday = localDateStr(yesterdayDate)

  // Check cache first unless the caller explicitly wants a fresh generation
  if (!force && config.summaryDate === today && config.summaryText) {
    return config.summaryText
  }

  await ensureOllama()

  // Gather context from CSV
  const rows = readOuraCsv(vaultPath)
  const rowMap = new Map(rows.map((r) => [r.date, r]))
  const yd = rowMap.get(yesterday)
  const td = rowMap.get(today)

  // Gather yesterday's check-in
  const ciPath = join(vaultPath, 'check-ins', `${yesterday}.md`)
  let ciText = ''
  if (existsSync(ciPath)) {
    ciText = readFileSync(ciPath, 'utf-8')
  }
  // Parse mood/energy/notes out of the markdown (simple regex)
  const moodMatch = ciText.match(/mood:\s*(\d)/i)
  const energyMatch = ciText.match(/energy:\s*(\d)/i)
  const notesMatch = ciText.match(/##\s*Notes\s*\n+([\s\S]*?)(?:\n##|$)/i)
  const ciMood = moodMatch ? moodMatch[1] : null
  const ciEnergy = energyMatch ? energyMatch[1] : null
  const ciNotes = notesMatch ? notesMatch[1].trim() : null

  // Gather any screenings completed today or yesterday
  const recentScreenings = listScreeningResults(vaultPath).filter(
    (r) => r.date === today || r.date === yesterday
  )

  // Build prompt
  const lines: string[] = [
    'You are a concise wellness coach. Write a 2–3 sentence readiness summary for today based on the data below.',
    'Be warm, specific, and practical. Do not use bullet points or headers. Plain prose only.',
    '',
    `Yesterday (${yesterday}):`,
  ]
  if (yd) {
    if (yd.sleep_hours) lines.push(`- Sleep: ${yd.sleep_hours}h (score ${yd.sleep_score || 'n/a'})`)
    if (yd.hrv_avg)     lines.push(`- HRV balance score: ${yd.hrv_avg}`)
    if (yd.readiness_score) lines.push(`- Readiness: ${yd.readiness_score}`)
    if (yd.activity_score)  lines.push(`- Activity: ${yd.activity_score}, Steps: ${yd.steps || 'n/a'}`)
  } else {
    lines.push('- No Oura data available for yesterday.')
  }
  if (ciMood)   lines.push(`- Mood: ${ciMood}/5, Energy: ${ciEnergy ?? 'n/a'}/5`)
  if (ciNotes)  lines.push(`- Notes: "${ciNotes}"`)

  lines.push('', `Today (${today}):`)
  if (td) {
    if (td.readiness_score) lines.push(`- Readiness: ${td.readiness_score}`)
    if (td.activity_score)  lines.push(`- Activity score: ${td.activity_score}`)
    if (td.sleep_hours)     lines.push(`- Sleep: ${td.sleep_hours}h`)
  } else {
    lines.push("- Today's data not yet synced.")
  }

  // Include any recent screening results
  if (recentScreenings.length > 0) {
    lines.push('', 'Recent screenings:')
    for (const s of recentScreenings) {
      lines.push(`- ${s.type} (${s.date}): score ${s.score} — ${s.severity}`)
    }
  }

  // Include recent spending if YNAB is enabled
  const spendingMap = new Map(readSpendingCsv(vaultPath).map((r) => [r.date, r.spending]))
  const ydSpending = spendingMap.get(yesterday)
  const tdSpending = spendingMap.get(today)
  if (ydSpending) lines.push('', `Yesterday's spending: $${parseFloat(ydSpending).toFixed(2)}`)
  if (tdSpending) lines.push(`Today's spending so far: $${parseFloat(tdSpending).toFixed(2)}`)

  lines.push('', 'Summary:')
  const prompt = lines.join('\n')

  const res = await fetch(`${OLLAMA_BASE}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, stream: false })
  })

  if (!res.ok) throw new Error(`Ollama API error ${res.status}`)
  const json = (await res.json()) as { response: string }
  const summary = json.response.trim()

  // Cache for the rest of the day
  writeConfig(vaultPath, { ...config, summaryDate: today, summaryText: summary })
  return summary
}

async function generateWarnings(vaultPath: string, force = false): Promise<string> {
  const config = readConfig(vaultPath)
  const model = config.ollamaModel?.trim() || OLLAMA_MODEL
  const today = localDateStr(new Date())

  // Return cached result if fresh
  if (!force && config.warningsDate === today && config.warningsText !== undefined) {
    return config.warningsText
  }

  await ensureOllama()

  // Build 7-day data table
  const ouraRows = readOuraCsv(vaultPath)
  const ouraMap = new Map(ouraRows.map((r) => [r.date, r]))

  const spendingMap = new Map(readSpendingCsv(vaultPath).map((r) => [r.date, parseFloat(r.spending)]))

  const rows: string[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const date = localDateStr(d)
    const o = ouraMap.get(date)
    const ciText = readCheckIn(vaultPath, date) ?? ''
    const moodMatch = ciText.match(/mood:\s*(\d)/i)
    const energyMatch = ciText.match(/energy:\s*(\d)/i)
    const notesMatch = ciText.match(/##\s*Notes\s*\n+([\s\S]*?)(?:\n##|$)/i)
    const mood = moodMatch ? moodMatch[1] : 'n/a'
    const energy = energyMatch ? energyMatch[1] : 'n/a'
    const notes = notesMatch ? notesMatch[1].trim().replace(/\n/g, ' ').slice(0, 80) : ''
    const spending = spendingMap.get(date)

    const cols = [
      date,
      o?.readiness_score || 'n/a',
      o?.sleep_hours || 'n/a',
      o?.hrv_avg || 'n/a',
      mood,
      energy,
      o?.steps || 'n/a',
      ...(config.ynabEnabled ? [spending != null ? spending.toFixed(2) : 'n/a'] : []),
    ]
    const row = cols.join(' | ')
    rows.push(notes ? `${row}  [notes: ${notes}]` : row)
  }

  const spendingCol = config.ynabEnabled ? ' | spending' : ''
  const header = `date | readiness | sleep_h | hrv | mood/5 | energy/5 | steps${spendingCol}`

  const prompt = [
    'You are a health data analyst. Review the last 7 days of wellness data below and identify any concerning outliers or multi-day trends.',
    'Return ONLY a JSON array of short warning strings (max 12 words each). If there are no concerns, return an empty array [].',
    'Do not explain, do not add prose outside the JSON.',
    '',
    `Data (${header}):`,
    ...rows,
    '',
    'JSON array:',
  ].join('\n')

  const res = await fetch(`${OLLAMA_BASE}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, stream: false })
  })

  if (!res.ok) throw new Error(`Ollama API error ${res.status}`)
  const json = (await res.json()) as { response: string }

  // Extract JSON array from response (guard against leading prose)
  const raw = json.response ?? ''
  const start = raw.indexOf('[')
  const end = raw.lastIndexOf(']')
  let warnings: string[] = []
  if (start !== -1 && end !== -1) {
    try {
      warnings = JSON.parse(raw.slice(start, end + 1))
    } catch {
      // Parse failure — don't cache, return empty
      return '[]'
    }
  }

  const warningsText = JSON.stringify(warnings)
  writeConfig(vaultPath, { ...config, warningsDate: today, warningsText })
  return warningsText
}

// ─── Check-in files ───────────────────────────────────────────────────────────
function getCheckInPath(vaultPath: string, date: string): string {
  return join(vaultPath, 'check-ins', `${date}.md`)
}

function readCheckIn(vaultPath: string, date: string): string | null {
  const p = getCheckInPath(vaultPath, date)
  if (!existsSync(p)) return null
  return readFileSync(p, 'utf-8')
}

function writeCheckIn(vaultPath: string, date: string, content: string): void {
  const dir = join(vaultPath, 'check-ins')
  mkdirSync(dir, { recursive: true })
  writeFileSync(getCheckInPath(vaultPath, date), content, 'utf-8')
}

function listCheckIns(vaultPath: string): string[] {
  const dir = join(vaultPath, 'check-ins')
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.replace('.md', ''))
    .sort()
}

// ─── Window ref (needed to push OAuth result to renderer) ─────────────────────
let mainWindow: BrowserWindow | null = null

// ─── OAuth deep-link handler ──────────────────────────────────────────────────
// Called when the custom scheme redirect fires (baseline://oauth/callback?code=...)
async function handleOAuthCallback(url: string): Promise<void> {
  try {
    const parsed = new URL(url)
    const code = parsed.searchParams.get('code')
    const error = parsed.searchParams.get('error')

    if (error || !code) {
      mainWindow?.webContents.send('oura-auth-result', false, error ?? 'No code received')
      return
    }

    const vaultPath = getVaultPath()
    if (!vaultPath) throw new Error('No vault path set')

    const config = readConfig(vaultPath)
    if (!config.ouraClientId || !config.ouraClientSecret) {
      throw new Error('Client credentials not saved — set Client ID and Secret first')
    }

    const tokens = await exchangeCode(
      code,
      config.ouraClientId,
      config.ouraClientSecret,
      LOOPBACK_REDIRECT
    )
    writeConfig(vaultPath, {
      ...config,
      ouraAccessToken: tokens.access_token,
      ouraRefreshToken: tokens.refresh_token,
      ouraTokenExpiresAt: Date.now() + tokens.expires_in * 1000
    })

    mainWindow?.webContents.send('oura-auth-result', true)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    mainWindow?.webContents.send('oura-auth-result', false, msg)
  }
}

// ─── IPC handlers ─────────────────────────────────────────────────────────────
function registerIpcHandlers(): void {
  // Remove any previously registered handlers (safe for HMR restarts)
  const channels = [
    'get-vault-path', 'pick-folder', 'setup-vault',
    'read-config', 'write-config',
    'start-oura-auth', 'disconnect-oura',
    'read-oura-csv', 'sync-oura',
    'read-check-in', 'write-check-in', 'list-check-ins',
    'check-ollama', 'generate-summary', 'generate-warnings',
    'list-screenings', 'save-screening',
    'start-chat', 'read-chat-history', 'write-chat-history',
    'connect-ynab', 'sync-ynab', 'read-ynab-csv', 'disconnect-ynab',
    'read-clinician-notes', 'write-clinician-notes',
    'read-appointments', 'write-appointments'
  ]
  for (const ch of channels) ipcMain.removeHandler(ch)

  // Vault setup
  ipcMain.handle('get-vault-path', () => getVaultPath())

  ipcMain.handle('pick-folder', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('setup-vault', (_e, vaultPath: string) => {
    setVaultPath(vaultPath)
    mkdirSync(join(vaultPath, '.baseline'), { recursive: true })
    mkdirSync(join(vaultPath, 'check-ins'), { recursive: true })
    mkdirSync(join(vaultPath, 'oura'), { recursive: true })
    mkdirSync(join(vaultPath, 'summaries'), { recursive: true })
  })

  // Config
  ipcMain.handle('read-config', () => {
    const vaultPath = getVaultPath()
    if (!vaultPath) return {}
    return readConfig(vaultPath)
  })

  ipcMain.handle('write-config', (_e, config: Config) => {
    const vaultPath = getVaultPath()
    if (!vaultPath) throw new Error('No vault path set')
    writeConfig(vaultPath, config)
    scheduleReminderFromConfig()
  })

  // Oura OAuth — fixed-port loopback server
  // Register exactly "http://localhost:35791/callback" in the Oura OAuth app portal.
  ipcMain.handle('start-oura-auth', async (_e, clientId: string, clientSecret: string) => {
    const vaultPath = getVaultPath()
    if (!vaultPath) throw new Error('No vault path set')

    const config = readConfig(vaultPath)
    writeConfig(vaultPath, { ...config, ouraClientId: clientId, ouraClientSecret: clientSecret })

    const server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', LOOPBACK_REDIRECT)
      const code = url.searchParams.get('code')
      const error = url.searchParams.get('error')

      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(
        `<html><body style="font-family:system-ui;background:#0f0f0f;color:#f0f0f0;` +
        `display:flex;align-items:center;justify-content:center;height:100vh;margin:0">` +
        `<p>${code ? 'Authorization successful — you can close this tab and return to Baseline.' : `Authorization failed: ${error ?? 'unknown error'}`}</p>` +
        `</body></html>`
      )

      server.close()

      if (code) {
        exchangeCode(code, clientId, clientSecret, LOOPBACK_REDIRECT)
          .then((tokens) => {
            const latest = readConfig(vaultPath)
            writeConfig(vaultPath, {
              ...latest,
              ouraAccessToken: tokens.access_token,
              ouraRefreshToken: tokens.refresh_token,
              ouraTokenExpiresAt: Date.now() + tokens.expires_in * 1000
            })
            mainWindow?.webContents.send('oura-auth-result', true)
          })
          .catch((err: Error) => {
            mainWindow?.webContents.send('oura-auth-result', false, err.message)
          })
      } else {
        mainWindow?.webContents.send('oura-auth-result', false, error ?? 'No code received')
      }
    })

    await new Promise<void>((resolve, reject) => {
      server.listen(LOOPBACK_PORT, 'localhost', () => resolve())
      server.on('error', reject)
    })

    const authUrl = buildAuthUrl(clientId, LOOPBACK_REDIRECT)

    // Attempt to open the browser; errors are non-fatal — the renderer
    // receives the URL and shows a manual fallback link regardless.
    shell.openExternal(authUrl).catch((err: Error) => {
      console.error('shell.openExternal failed:', err.message)
    })

    // Timeout after 5 minutes
    setTimeout(() => {
      server.close()
      mainWindow?.webContents.send('oura-auth-result', false, 'Timed out waiting for authorization')
    }, 5 * 60 * 1000)

    // Return the URL so the renderer can show a manual fallback link
    return authUrl
  })

  ipcMain.handle('disconnect-oura', () => {
    const vaultPath = getVaultPath()
    if (!vaultPath) return
    const config = readConfig(vaultPath)
    const { ouraAccessToken, ouraRefreshToken, ouraTokenExpiresAt, ...rest } = config
    void ouraAccessToken; void ouraRefreshToken; void ouraTokenExpiresAt
    writeConfig(vaultPath, rest)
  })

  // Oura CSV
  ipcMain.handle('read-oura-csv', () => {
    const vaultPath = getVaultPath()
    if (!vaultPath) return []
    return readOuraCsv(vaultPath)
  })

  // Oura sync (reads token from config automatically)
  ipcMain.handle('sync-oura', async (_e, days?: number) => {
    const vaultPath = getVaultPath()
    if (!vaultPath) throw new Error('No vault path set')
    return syncOura(vaultPath, days ?? 14)
  })

  // Check-ins
  ipcMain.handle('read-check-in', (_e, date: string) => {
    const vaultPath = getVaultPath()
    if (!vaultPath) return null
    return readCheckIn(vaultPath, date)
  })

  ipcMain.handle('write-check-in', (_e, date: string, content: string) => {
    const vaultPath = getVaultPath()
    if (!vaultPath) throw new Error('No vault path set')
    writeCheckIn(vaultPath, date, content)
  })

  ipcMain.handle('list-check-ins', () => {
    const vaultPath = getVaultPath()
    if (!vaultPath) return []
    return listCheckIns(vaultPath)
  })

  // Ollama installation check (runs `ollama --version`; does NOT start the server)
  ipcMain.handle('check-ollama', (): Promise<{ available: boolean }> => {
    return new Promise((resolve) => {
      const child = spawn('ollama', ['--version'], { stdio: 'ignore' })
      child.on('error', () => resolve({ available: false }))
      child.on('exit', (code) => resolve({ available: code === 0 }))
    })
  })

  // LLM summary
  ipcMain.handle('generate-summary', async (_e, force: boolean = false) => {
    const vaultPath = getVaultPath()
    if (!vaultPath) throw new Error('No vault path set')
    return generateDailySummary(vaultPath, force)
  })

  // AI warnings
  ipcMain.handle('generate-warnings', async (_e, force: boolean = false) => {
    const vaultPath = getVaultPath()
    if (!vaultPath) throw new Error('No vault path set')
    return generateWarnings(vaultPath, force)
  })

  // Screenings
  ipcMain.handle('list-screenings', () => {
    const vaultPath = getVaultPath()
    if (!vaultPath) return []
    return listScreeningResults(vaultPath)
  })

  ipcMain.handle('save-screening', (_e, result: ScreeningResult) => {
    const vaultPath = getVaultPath()
    if (!vaultPath) throw new Error('No vault path set')
    saveScreeningResult(vaultPath, result)
  })

  // ── Chat ──────────────────────────────────────────────────────────────────
  ipcMain.handle('start-chat', async (_e, messages: ChatMessage[]) => {
    const vaultPath = getVaultPath()
    if (!vaultPath) throw new Error('No vault path set')

    // Cancel any active stream
    if (activeChatController) {
      activeChatController.abort()
      activeChatController = null
    }

    try {
      await ensureOllama()
    } catch (err) {
      mainWindow?.webContents.send('chat-error', err instanceof Error ? err.message : 'Could not start Ollama')
      return
    }

    const config = readConfig(vaultPath)
    const model = config.ollamaModel?.trim() || OLLAMA_MODEL
    const context = buildChatContext(vaultPath)
    const systemMsg: ChatMessage = {
      role: 'system',
      content: `You are a personal wellness assistant with access to the user's health data. Answer questions helpfully and concisely based on the data below. Do not make medical diagnoses. Today is ${localDateStr(new Date())}.\n\n${context}`
    }

    activeChatController = new AbortController()
    const controller = activeChatController

    ;(async () => {
      try {
        const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, messages: [systemMsg, ...messages], stream: true }),
          signal: controller.signal
        })
        if (!res.ok) throw new Error(`Ollama error ${res.status}`)

        const reader = res.body!.getReader()
        const decoder = new TextDecoder()
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const text = decoder.decode(value, { stream: true })
          for (const line of text.split('\n')) {
            if (!line.trim()) continue
            try {
              const chunk = JSON.parse(line) as { message?: { content: string }; done: boolean }
              if (chunk.message?.content) {
                mainWindow?.webContents.send('chat-token', chunk.message.content)
              }
              if (chunk.done) {
                mainWindow?.webContents.send('chat-done')
                activeChatController = null
              }
            } catch { /* skip malformed NDJSON */ }
          }
        }
      } catch (err) {
        if ((err as { name?: string }).name === 'AbortError') return
        mainWindow?.webContents.send('chat-error', err instanceof Error ? err.message : 'Streaming error')
        activeChatController = null
      }
    })()
  })

  ipcMain.handle('read-chat-history', () => {
    const vaultPath = getVaultPath()
    if (!vaultPath) return []
    const config = readConfig(vaultPath)
    if (!config.chatHistory || config.chatHistory === 'session') return []
    const p = getChatHistoryPath(vaultPath, config.chatHistory)
    if (!existsSync(p)) return []
    try { return JSON.parse(readFileSync(p, 'utf-8')) as ChatMessage[] } catch { return [] }
  })

  ipcMain.handle('write-chat-history', (_e, messages: ChatMessage[]) => {
    const vaultPath = getVaultPath()
    if (!vaultPath) return
    const config = readConfig(vaultPath)
    if (!config.chatHistory || config.chatHistory === 'session') return
    const dir = join(vaultPath, '.baseline')
    mkdirSync(dir, { recursive: true })
    writeFileSync(getChatHistoryPath(vaultPath, config.chatHistory), JSON.stringify(messages, null, 2), 'utf-8')
  })

  // ── YNAB ────────────────────────────────────────────────────────────────────
  ipcMain.handle('connect-ynab', async (_e, pat: string) => {
    return fetchYnabBudgets(pat)
  })

  ipcMain.handle('sync-ynab', async (_e, days: number = 30) => {
    const vaultPath = getVaultPath()
    if (!vaultPath) throw new Error('No vault path set')
    return syncYnabSpending(vaultPath, days)
  })

  ipcMain.handle('read-ynab-csv', () => {
    const vaultPath = getVaultPath()
    if (!vaultPath) return []
    return readSpendingCsv(vaultPath)
  })

  ipcMain.handle('disconnect-ynab', () => {
    const vaultPath = getVaultPath()
    if (!vaultPath) return
    const { ynabPat, ynabBudgetId, ynabBudgetName, ynabEnabled, ...rest } = readConfig(vaultPath)
    void ynabPat; void ynabBudgetId; void ynabBudgetName; void ynabEnabled
    writeConfig(vaultPath, rest)
  })

  // Clinician notes
  ipcMain.handle('read-clinician-notes', () => {
    const vaultPath = getVaultPath()
    if (!vaultPath) return []
    return readClinicianNotes(vaultPath)
  })

  ipcMain.handle('write-clinician-notes', (_e, notes: ClinicianSnippet[]) => {
    const vaultPath = getVaultPath()
    if (!vaultPath) return
    writeClinicianNotes(vaultPath, notes)
  })

  // Appointments
  ipcMain.handle('read-appointments', () => {
    const vaultPath = getVaultPath()
    if (!vaultPath) return []
    return readAppointments(vaultPath)
  })

  ipcMain.handle('write-appointments', (_e, appointments: Appointment[]) => {
    const vaultPath = getVaultPath()
    if (!vaultPath) return
    writeAppointments(vaultPath, appointments)
  })

  ipcMain.handle('save-pdf', async (_e, buffer: number[], defaultName: string) => {
    const win = BrowserWindow.getFocusedWindow()
    const { canceled, filePath } = await dialog.showSaveDialog(win!, {
      defaultPath: defaultName,
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    })
    if (canceled || !filePath) return
    writeFileSync(filePath, Buffer.from(buffer))
  })
}

// ─── Screenings ───────────────────────────────────────────────────────────────
interface ScreeningResult {
  type: string
  date: string
  answers: number[]
  score: number
  severity: string
}

function getScreeningDir(vaultPath: string, type: string): string {
  return join(vaultPath, 'screenings', type)
}

function listScreeningResults(vaultPath: string): ScreeningResult[] {
  const screeningsDir = join(vaultPath, 'screenings')
  if (!existsSync(screeningsDir)) return []
  const results: ScreeningResult[] = []
  for (const type of readdirSync(screeningsDir)) {
    const typeDir = join(screeningsDir, type)
    try {
      for (const file of readdirSync(typeDir).filter((f) => f.endsWith('.json'))) {
        try {
          const raw = readFileSync(join(typeDir, file), 'utf-8')
          results.push(JSON.parse(raw) as ScreeningResult)
        } catch { /* skip malformed files */ }
      }
    } catch { /* skip non-directory entries */ }
  }
  return results.sort((a, b) => b.date.localeCompare(a.date))
}

function saveScreeningResult(vaultPath: string, result: ScreeningResult): void {
  const dir = getScreeningDir(vaultPath, result.type)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, `${result.date}.json`), JSON.stringify(result, null, 2), 'utf-8')
  // Invalidate the cached summary so the next load regenerates with this screening included
  const config = readConfig(vaultPath)
  if (config.summaryDate) {
    writeConfig(vaultPath, { ...config, summaryDate: undefined, summaryText: undefined })
  }
}

// ─── YNAB ─────────────────────────────────────────────────────────────────────

const YNAB_BASE = 'https://api.ynab.com/v1'

interface YnabBudget { id: string; name: string }
interface YnabTransaction {
  id: string; date: string; amount: number
  transfer_account_id: string | null; deleted: boolean
}

interface SpendingRow { date: string; spending: string; synced_at: string }

function getSpendingCsvPath(vaultPath: string): string {
  return join(vaultPath, 'ynab', 'spending.csv')
}

function readSpendingCsv(vaultPath: string): SpendingRow[] {
  const p = getSpendingCsvPath(vaultPath)
  if (!existsSync(p)) return []
  const result = Papa.parse<SpendingRow>(readFileSync(p, 'utf-8'), { header: true, skipEmptyLines: true })
  return result.data
}

function writeSpendingCsv(vaultPath: string, rows: SpendingRow[]): void {
  const dir = join(vaultPath, 'ynab')
  mkdirSync(dir, { recursive: true })
  writeFileSync(getSpendingCsvPath(vaultPath), Papa.unparse(rows), 'utf-8')
}

async function fetchYnabBudgets(pat: string): Promise<YnabBudget[]> {
  const res = await fetch(`${YNAB_BASE}/budgets`, {
    headers: { Authorization: `Bearer ${pat}` }
  })
  if (!res.ok) throw new Error(`YNAB error ${res.status} — check your Personal Access Token`)
  const json = await res.json() as { data: { budgets: YnabBudget[] } }
  return json.data.budgets.map((b) => ({ id: b.id, name: b.name }))
}

async function syncYnabSpending(vaultPath: string, days = 30): Promise<SpendingRow[]> {
  const config = readConfig(vaultPath)
  if (!config.ynabPat || !config.ynabBudgetId) throw new Error('YNAB is not configured')

  const since = new Date()
  since.setDate(since.getDate() - days)
  const sinceStr = localDateStr(since)

  const res = await fetch(
    `${YNAB_BASE}/budgets/${config.ynabBudgetId}/transactions?since_date=${sinceStr}`,
    { headers: { Authorization: `Bearer ${config.ynabPat}` } }
  )
  if (!res.ok) throw new Error(`YNAB sync failed: ${res.status}`)
  const json = await res.json() as { data: { transactions: YnabTransaction[] } }

  // Aggregate outflow by date; skip transfers and deleted entries
  const byDate = new Map<string, number>()
  for (const t of json.data.transactions) {
    if (t.deleted || t.transfer_account_id || t.amount >= 0) continue
    byDate.set(t.date, (byDate.get(t.date) ?? 0) + Math.abs(t.amount))
  }

  const now = new Date().toISOString()
  // Merge with existing rows (upsert by date)
  const existing = new Map(readSpendingCsv(vaultPath).map((r) => [r.date, r]))
  for (const [date, milliunits] of byDate) {
    existing.set(date, { date, spending: (milliunits / 1000).toFixed(2), synced_at: now })
  }
  const merged = [...existing.values()].sort((a, b) => a.date.localeCompare(b.date))
  writeSpendingCsv(vaultPath, merged)
  return merged
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

function buildChatContext(vaultPath: string): string {
  const sections: string[] = [`Today is ${localDateStr(new Date())}.`]

  const rows = readOuraCsv(vaultPath)
  if (rows.length > 0) {
    const lines = rows.map((r) => {
      const parts: string[] = [r.date]
      if (r.sleep_hours)     parts.push(`sleep ${r.sleep_hours}h`)
      if (r.sleep_score)     parts.push(`sleep_score ${r.sleep_score}`)
      if (r.hrv_avg)         parts.push(`hrv ${r.hrv_avg}`)
      if (r.readiness_score) parts.push(`readiness ${r.readiness_score}`)
      if (r.activity_score)  parts.push(`activity ${r.activity_score}`)
      if (r.steps)           parts.push(`steps ${r.steps}`)
      return parts.join(', ')
    })
    sections.push(`=== OURA DATA ===\n${lines.join('\n')}`)
  }

  const checkInDir = join(vaultPath, 'check-ins')
  if (existsSync(checkInDir)) {
    const files = readdirSync(checkInDir).filter((f) => f.endsWith('.md')).sort()
    if (files.length > 0) {
      const lines = files.map((file) => {
        const date = file.replace('.md', '')
        const content = readFileSync(join(checkInDir, file), 'utf-8')
        const moodMatch    = content.match(/mood:\s*(\d)/i)
        const energyMatch  = content.match(/energy:\s*(\d)/i)
        const notesMatch   = content.match(/##\s*Notes\s*\n+([\s\S]*?)(?:\n##|$)/i)
        const parts: string[] = [date]
        if (moodMatch)  parts.push(`mood ${moodMatch[1]}/5`)
        if (energyMatch) parts.push(`energy ${energyMatch[1]}/5`)
        const notes = notesMatch?.[1]?.trim()
        if (notes) parts.push(`notes: "${notes.substring(0, 200)}"`)
        return parts.join(', ')
      })
      sections.push(`=== CHECK-INS ===\n${lines.join('\n')}`)
    }
  }

  const screenings = listScreeningResults(vaultPath)
  if (screenings.length > 0) {
    const lines = screenings.map((s) => `${s.date}: ${s.type} score ${s.score} (${s.severity})`)
    sections.push(`=== SCREENINGS ===\n${lines.join('\n')}`)
  }

  const spendingRows = readSpendingCsv(vaultPath)
  if (spendingRows.length > 0) {
    const lines = spendingRows.map((r) => `${r.date}: $${parseFloat(r.spending).toFixed(2)}`)
    sections.push(`=== DAILY SPENDING (USD) ===\n${lines.join('\n')}`)
  }

  return sections.join('\n\n')
}

// ─── Clinician notes ──────────────────────────────────────────────────────────
interface ClinicianSnippet {
  id: string
  savedAt: string
  capturedDate: string
  source: 'check-in' | 'analyze'
  label: string
  text: string
}

function getClinicianNotesPath(vaultPath: string): string {
  return join(vaultPath, '.baseline', 'clinician-notes.json')
}

function readClinicianNotes(vaultPath: string): ClinicianSnippet[] {
  const p = getClinicianNotesPath(vaultPath)
  if (!existsSync(p)) return []
  try { return JSON.parse(readFileSync(p, 'utf-8')) } catch { return [] }
}

function writeClinicianNotes(vaultPath: string, notes: ClinicianSnippet[]): void {
  const dir = join(vaultPath, '.baseline')
  mkdirSync(dir, { recursive: true })
  writeFileSync(getClinicianNotesPath(vaultPath), JSON.stringify(notes, null, 2), 'utf-8')
}

// ─── Appointments ─────────────────────────────────────────────────────────────
interface Appointment {
  id: string
  date: string
  title?: string
  createdAt: string
  snippetIds: string[]
}

function getAppointmentsPath(vaultPath: string): string {
  return join(vaultPath, '.baseline', 'appointments.json')
}

function readAppointments(vaultPath: string): Appointment[] {
  const p = getAppointmentsPath(vaultPath)
  if (!existsSync(p)) return []
  try { return JSON.parse(readFileSync(p, 'utf-8')) } catch { return [] }
}

function writeAppointments(vaultPath: string, appointments: Appointment[]): void {
  const dir = join(vaultPath, '.baseline')
  mkdirSync(dir, { recursive: true })
  writeFileSync(getAppointmentsPath(vaultPath), JSON.stringify(appointments, null, 2), 'utf-8')
}

function getChatHistoryPath(vaultPath: string, mode: 'daily' | 'persistent'): string {
  const dir = join(vaultPath, '.baseline')
  return mode === 'daily'
    ? join(dir, `chat-${localDateStr(new Date())}.json`)
    : join(dir, 'chat.json')
}

let activeChatController: AbortController | null = null

// ─── Tray ─────────────────────────────────────────────────────────────────────
let tray: Tray | null = null

const resourcesPath = is.dev
  ? join(app.getAppPath(), 'resources')
  : join(process.resourcesPath, 'resources')

function createTray(): void {
  const icon = nativeImage.createFromPath(join(resourcesPath, 'trayTemplate.png'))
  tray = new Tray(icon)
  tray.setToolTip('Baseline')
  tray.on('click', () => {
    if (!mainWindow) {
      createWindow()
      return
    }
    if (mainWindow.isVisible() && mainWindow.isFocused()) {
      mainWindow.hide()
    } else {
      mainWindow.show()
      mainWindow.focus()
      clearNotificationState()
    }
  })
}

// ─── Reminders ────────────────────────────────────────────────────────────────
let reminderTimeout: NodeJS.Timeout | null = null
let notificationPending = false

function msUntilNext(h: number, m: number): number {
  const now = new Date()
  const next = new Date(now)
  next.setHours(h, m, 0, 0)
  if (next <= now) next.setDate(next.getDate() + 1)
  return next.getTime() - now.getTime()
}

function scheduleReminder(hhmm: string): void {
  cancelScheduledReminder()
  const [hStr, mStr] = hhmm.split(':')
  const h = parseInt(hStr, 10)
  const m = parseInt(mStr, 10)
  if (isNaN(h) || isNaN(m)) return

  function fire(): void {
    new Notification({
      title: 'Baseline',
      body: 'Time to fill out your daily log.'
    }).show()
    if (process.platform === 'darwin') app.dock.setBadge('1')
    notificationPending = true
    reminderTimeout = setTimeout(fire, msUntilNext(h, m))
  }

  reminderTimeout = setTimeout(fire, msUntilNext(h, m))
}

function cancelScheduledReminder(): void {
  if (reminderTimeout !== null) {
    clearTimeout(reminderTimeout)
    reminderTimeout = null
  }
}

function scheduleReminderFromConfig(): void {
  const vaultPath = getVaultPath()
  if (!vaultPath) return
  const config = readConfig(vaultPath)
  if (config.remindersEnabled && config.reminderTime) {
    scheduleReminder(config.reminderTime)
  } else {
    cancelScheduledReminder()
  }
}

function clearNotificationState(): void {
  if (!notificationPending) return
  notificationPending = false
  if (process.platform === 'darwin') app.dock.setBadge('')
}

// ─── Window ───────────────────────────────────────────────────────────────────
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 820,
    resizable: true,
    minWidth: 420,
    minHeight: 680,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 14, y: 14 },
    backgroundColor: '#1c1c1e',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())
  mainWindow.on('closed', () => { mainWindow = null })
  mainWindow.on('focus', () => clearNotificationState())

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.baseline.app')
  app.on('browser-window-created', (_, win) => optimizer.watchWindowShortcuts(win))
  if (is.dev && process.platform === 'darwin') {
    app.dock.setIcon(nativeImage.createFromPath(join(app.getAppPath(), 'build/icon.iconset/icon_512x512.png')))
  }
  registerIpcHandlers()
  createWindow()
  createTray()
  scheduleReminderFromConfig()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// macOS: handle deep link when app is already running
app.on('open-url', (event, url) => {
  event.preventDefault()
  if (url.startsWith('baseline://oauth/callback')) {
    handleOAuthCallback(url)
  }
})

// Windows/Linux: deep link arrives as a second-instance argv
app.on('second-instance', (_event, argv) => {
  const url = argv.find((arg) => arg.startsWith('baseline://oauth/callback'))
  if (url) handleOAuthCallback(url)
  // Focus the existing window
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
