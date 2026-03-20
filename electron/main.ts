import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs'
import { createServer } from 'http'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import Papa from 'papaparse'

// ─── Custom protocol ──────────────────────────────────────────────────────────
// Primary redirect: baseline://oauth/callback (custom URI scheme, RFC 8252 §7.1)
// Fallback redirect: http://127.0.0.1:PORT  (loopback, RFC 8252 §7.3)
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

// Two redirect URI strategies (RFC 8252 for native apps):
//   1. Custom scheme — register "baseline://oauth/callback" in the Oura portal
//   2. Loopback      — register "http://127.0.0.1" in the Oura portal (any port accepted)
const CUSTOM_SCHEME_REDIRECT = 'baseline://oauth/callback'

function buildAuthUrl(clientId: string, redirectUri: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'daily'
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
function formatDate(d: Date): string {
  return d.toISOString().split('T')[0]
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

  const endDate = formatDate(new Date())
  const startDate = formatDate(new Date(Date.now() - days * 86400000))

  type SleepDay = { day: string; score: number; contributors?: { total_sleep?: number } }
  type ReadinessDay = { day: string; score: number; contributors?: { hrv_balance?: number } }
  type ActivityDay = { day: string; score: number; steps: number }

  const [sleepData, readinessData, activityData] = await Promise.all([
    fetchOura('daily_sleep', accessToken, startDate, endDate) as Promise<SleepDay[]>,
    fetchOura('daily_readiness', accessToken, startDate, endDate) as Promise<ReadinessDay[]>,
    fetchOura('daily_activity', accessToken, startDate, endDate) as Promise<ActivityDay[]>
  ])

  const sleepMap = new Map(sleepData.map((d) => [d.day, d]))
  const activityMap = new Map(activityData.map((d) => [d.day, d]))

  const rows: OuraRow[] = readinessData.map((r) => {
    const sleep = sleepMap.get(r.day)
    const activity = activityMap.get(r.day)
    const sleepSec = sleep?.contributors?.total_sleep ?? 0
    const sleepHours = sleepSec > 0 ? (sleepSec / 3600).toFixed(1) : ''
    const hrv = r.contributors?.hrv_balance ?? ''
    return {
      date: r.day,
      sleep_score: sleep?.score != null ? String(sleep.score) : '',
      sleep_hours: sleepHours,
      hrv_avg: hrv !== '' ? String(hrv) : '',
      readiness_score: r.score != null ? String(r.score) : '',
      activity_score: activity?.score != null ? String(activity.score) : '',
      steps: activity?.steps != null ? String(activity.steps) : '',
      synced_at: new Date().toISOString()
    }
  })

  upsertOuraRows(vaultPath, rows)
  return rows
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
      CUSTOM_SCHEME_REDIRECT
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
  })

  // Oura OAuth — loopback server (RFC 8252 §7.3)
  // Register "http://127.0.0.1" as the redirect URI in the Oura portal.
  // A temporary HTTP server starts on a random port; Oura will redirect to it
  // after the user approves. No custom URI scheme or hosted server required.
  ipcMain.handle('start-oura-auth', async (_e, clientId: string, clientSecret: string) => {
    const vaultPath = getVaultPath()
    if (!vaultPath) throw new Error('No vault path set')

    const config = readConfig(vaultPath)
    writeConfig(vaultPath, { ...config, ouraClientId: clientId, ouraClientSecret: clientSecret })

    // Start loopback server and open browser
    const port = await new Promise<number>((resolve, reject) => {
      const srv = createServer().listen(0, '127.0.0.1', () => {
        const p = (srv.address() as { port: number }).port
        srv.close(() => resolve(p))
      })
      srv.on('error', reject)
    })

    const redirectUri = `http://127.0.0.1:${port}`

    // Open auth URL in the user's browser
    shell.openExternal(buildAuthUrl(clientId, redirectUri))

    // Now start the real server on that port to catch the redirect
    createServer((req, res) => {
      const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`)
      const code = url.searchParams.get('code')
      const error = url.searchParams.get('error')

      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(
        `<html><body style="font-family:system-ui;background:#0f0f0f;color:#f0f0f0;` +
        `display:flex;align-items:center;justify-content:center;height:100vh;margin:0">` +
        `<p>${code ? 'Authorization successful — you can close this tab and return to Baseline.' : `Authorization failed: ${error ?? 'unknown error'}`}</p>` +
        `</body></html>`
      )

      if (code) {
        exchangeCode(code, clientId, clientSecret, redirectUri)
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
          .catch((err) => {
            mainWindow?.webContents.send('oura-auth-result', false, err.message)
          })
      } else {
        mainWindow?.webContents.send('oura-auth-result', false, error ?? 'No code received')
      }
    })
      .listen(port, '127.0.0.1')
      .on('error', (err) => {
        mainWindow?.webContents.send('oura-auth-result', false, err.message)
      })

    // Timeout after 5 minutes
    setTimeout(() => {
      mainWindow?.webContents.send('oura-auth-result', false, 'Timed out waiting for authorization')
    }, 5 * 60 * 1000)
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
}

// ─── Window ───────────────────────────────────────────────────────────────────
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 820,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0f0f0f',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())
  mainWindow.on('closed', () => { mainWindow = null })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.baseline.app')
  app.on('browser-window-created', (_, win) => optimizer.watchWindowShortcuts(win))
  registerIpcHandlers()
  createWindow()
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
