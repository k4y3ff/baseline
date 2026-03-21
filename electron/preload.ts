import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

export interface Config {
  ouraClientId?: string
  ouraClientSecret?: string
  ouraAccessToken?: string
  ouraRefreshToken?: string
  ouraTokenExpiresAt?: number
  warningsEnabled?: boolean
  warningsDate?: string
  warningsText?: string
  remindersEnabled?: boolean
  reminderTime?: string
}

export interface VaultMeta {
  encryptionEnabled: boolean
  passwordEnabled: boolean
  touchIdEnabled: boolean
  passwordSalt?: string
  wrappedKey?: string
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

export interface ScreeningResult {
  type: string
  date: string
  answers: number[]
  score: number
  severity: string
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
  spending: string
  synced_at: string
}

const baseline = {
  // Vault setup
  getVaultPath: (): Promise<string | null> => ipcRenderer.invoke('get-vault-path'),
  pickFolder: (): Promise<string | null> => ipcRenderer.invoke('pick-folder'),
  setupVault: (vaultPath: string): Promise<void> => ipcRenderer.invoke('setup-vault', vaultPath),

  // Config
  readConfig: (): Promise<Config> => ipcRenderer.invoke('read-config'),
  writeConfig: (config: Config): Promise<void> => ipcRenderer.invoke('write-config', config),

  // Oura OAuth
  startOuraAuth: (clientId: string, clientSecret: string): Promise<string> =>
    ipcRenderer.invoke('start-oura-auth', clientId, clientSecret),

  disconnectOura: (): Promise<void> => ipcRenderer.invoke('disconnect-oura'),

  /** Subscribe to the OAuth result pushed by the main process. Returns an unsubscribe fn. */
  onOuraAuthResult: (cb: (success: boolean, error?: string) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, success: boolean, error?: string) =>
      cb(success, error)
    ipcRenderer.on('oura-auth-result', handler)
    return () => ipcRenderer.removeListener('oura-auth-result', handler)
  },

  // Oura data
  readOuraCsv: (): Promise<OuraRow[]> => ipcRenderer.invoke('read-oura-csv'),
  syncOura: (days?: number): Promise<OuraRow[]> => ipcRenderer.invoke('sync-oura', days),

  // Check-ins
  readCheckIn: (date: string): Promise<string | null> => ipcRenderer.invoke('read-check-in', date),
  writeCheckIn: (date: string, content: string): Promise<void> =>
    ipcRenderer.invoke('write-check-in', date, content),
  listCheckIns: (): Promise<string[]> => ipcRenderer.invoke('list-check-ins'),

  // Ollama
  checkOllama: (): Promise<{ available: boolean }> => ipcRenderer.invoke('check-ollama'),
  generateSummary: (force?: boolean): Promise<string> => ipcRenderer.invoke('generate-summary', force ?? false),
  generateWarnings: (force?: boolean): Promise<string> => ipcRenderer.invoke('generate-warnings', force ?? false),

  // Screenings
  listScreenings: (): Promise<ScreeningResult[]> => ipcRenderer.invoke('list-screenings'),
  saveScreening: (result: ScreeningResult): Promise<void> =>
    ipcRenderer.invoke('save-screening', result),

  // Chat
  startChat: (messages: ChatMessage[]): Promise<void> =>
    ipcRenderer.invoke('start-chat', messages),
  onChatToken: (cb: (token: string) => void): (() => void) => {
    const h = (_: Electron.IpcRendererEvent, token: string) => cb(token)
    ipcRenderer.on('chat-token', h)
    return () => ipcRenderer.removeListener('chat-token', h)
  },
  onChatDone: (cb: () => void): (() => void) => {
    const h = () => cb()
    ipcRenderer.on('chat-done', h)
    return () => ipcRenderer.removeListener('chat-done', h)
  },
  onChatError: (cb: (err: string) => void): (() => void) => {
    const h = (_: Electron.IpcRendererEvent, err: string) => cb(err)
    ipcRenderer.on('chat-error', h)
    return () => ipcRenderer.removeListener('chat-error', h)
  },
  readChatHistory: (): Promise<ChatMessage[]> => ipcRenderer.invoke('read-chat-history'),
  writeChatHistory: (messages: ChatMessage[]): Promise<void> =>
    ipcRenderer.invoke('write-chat-history', messages),

  // YNAB
  connectYnab: (pat: string): Promise<YnabBudget[]> => ipcRenderer.invoke('connect-ynab', pat),
  syncYnab: (days?: number): Promise<SpendingRow[]> => ipcRenderer.invoke('sync-ynab', days ?? 30),
  readYnabCsv: (): Promise<SpendingRow[]> => ipcRenderer.invoke('read-ynab-csv'),
  disconnectYnab: (): Promise<void> => ipcRenderer.invoke('disconnect-ynab'),

  // Clinician notes
  readClinicianNotes: (): Promise<unknown[]> => ipcRenderer.invoke('read-clinician-notes'),
  writeClinicianNotes: (notes: unknown[]): Promise<void> => ipcRenderer.invoke('write-clinician-notes', notes),

  // Appointments
  readAppointments: (): Promise<unknown[]> => ipcRenderer.invoke('read-appointments'),
  writeAppointments: (appointments: unknown[]): Promise<void> => ipcRenderer.invoke('write-appointments', appointments),

  // Export
  savePdf: (buffer: number[], filename: string): Promise<void> => ipcRenderer.invoke('save-pdf', buffer, filename),

  // Encryption
  readVaultMeta: (): Promise<VaultMeta> => ipcRenderer.invoke('get-vault-meta'),
  isVaultUnlocked: (): Promise<boolean> => ipcRenderer.invoke('is-vault-unlocked'),
  canUseTouchId: (): Promise<boolean> => ipcRenderer.invoke('can-use-touchid'),
  unlockWithPassword: (password: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('unlock-with-password', password),
  unlockWithTouchId: (): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('unlock-with-touchid'),
  enableEncryption: (): Promise<void> => ipcRenderer.invoke('enable-encryption'),
  disableEncryption: (): Promise<void> => ipcRenderer.invoke('disable-encryption'),
  setEncryptionPassword: (password: string): Promise<void> =>
    ipcRenderer.invoke('set-encryption-password', password),
  removeEncryptionPassword: (currentPassword: string): Promise<void> =>
    ipcRenderer.invoke('remove-encryption-password', currentPassword),
  enableTouchIdBackup: (): Promise<void> => ipcRenderer.invoke('enable-touchid-backup'),
  disableTouchIdBackup: (): Promise<void> => ipcRenderer.invoke('disable-touchid-backup'),
  exportVaultPlaintext: (): Promise<void> => ipcRenderer.invoke('export-vault-plaintext')
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('baseline', baseline)
  } catch (e) {
    console.error(e)
  }
} else {
  // @ts-ignore
  window.electron = electronAPI
  // @ts-ignore
  window.baseline = baseline
}
