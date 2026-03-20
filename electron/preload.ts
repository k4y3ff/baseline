import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

export interface Config {
  ouraClientId?: string
  ouraClientSecret?: string
  ouraAccessToken?: string
  ouraRefreshToken?: string
  ouraTokenExpiresAt?: number
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
  listCheckIns: (): Promise<string[]> => ipcRenderer.invoke('list-check-ins')
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
