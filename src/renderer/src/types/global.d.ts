import type { Config, OuraRow } from './index'

declare global {
  interface Window {
    baseline: {
      getVaultPath(): Promise<string | null>
      pickFolder(): Promise<string | null>
      setupVault(vaultPath: string): Promise<void>
      readConfig(): Promise<Config>
      writeConfig(config: Config): Promise<void>
      startOuraAuth(clientId: string, clientSecret: string): Promise<string>
      disconnectOura(): Promise<void>
      onOuraAuthResult(cb: (success: boolean, error?: string) => void): () => void
      readOuraCsv(): Promise<OuraRow[]>
      syncOura(days?: number): Promise<OuraRow[]>
      readCheckIn(date: string): Promise<string | null>
      writeCheckIn(date: string, content: string): Promise<void>
      listCheckIns(): Promise<string[]>
      checkOllama(): Promise<{ available: boolean }>
      generateSummary(): Promise<string>
    }
  }
}
