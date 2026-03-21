import type { Config, OuraRow, ScreeningResult, ChatMessage, YnabBudget, SpendingRow } from './index'

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
      generateSummary(force?: boolean): Promise<string>
      generateWarnings(force?: boolean): Promise<string>
      listScreenings(): Promise<ScreeningResult[]>
      saveScreening(result: ScreeningResult): Promise<void>
      startChat(messages: ChatMessage[]): Promise<void>
      onChatToken(cb: (token: string) => void): () => void
      onChatDone(cb: () => void): () => void
      onChatError(cb: (err: string) => void): () => void
      readChatHistory(): Promise<ChatMessage[]>
      writeChatHistory(messages: ChatMessage[]): Promise<void>
      connectYnab(pat: string): Promise<YnabBudget[]>
      syncYnab(days?: number): Promise<SpendingRow[]>
      readYnabCsv(): Promise<SpendingRow[]>
      disconnectYnab(): Promise<void>
    }
  }
}
