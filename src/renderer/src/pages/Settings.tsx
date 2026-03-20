import { useState, useEffect, useCallback } from 'react'
import { useConfig } from '../hooks/useConfig'

export default function Settings() {
  const { config, loading, save, reload } = useConfig()
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [connectError, setConnectError] = useState<string | null>(null)
  const [authUrl, setAuthUrl] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<'ok' | 'error' | null>(null)

  const isConnected = Boolean(config.ouraAccessToken)

  // ── Ollama state ──
  const [ollamaChecking, setOllamaChecking] = useState(false)
  const [ollamaAvailable, setOllamaAvailable] = useState<boolean | null>(null)
  const [ollamaCheckError, setOllamaCheckError] = useState<string | null>(null)
  const [ollamaModel, setOllamaModel] = useState(config.ollamaModel ?? 'llama3.2')

  // Sync model field when config loads
  useEffect(() => {
    setOllamaModel(config.ollamaModel ?? 'llama3.2')
  }, [config.ollamaModel])

  const checkOllama = useCallback(async () => {
    setOllamaChecking(true)
    setOllamaCheckError(null)
    try {
      const { available } = await window.baseline.checkOllama()
      setOllamaAvailable(available)
      if (available && !config.ollamaSummariesEnabled) {
        await save({ ollamaSummariesEnabled: true, ollamaModel: ollamaModel.trim() || 'llama3.2' })
      }
    } catch (err) {
      setOllamaCheckError(err instanceof Error ? err.message : 'Check failed — try restarting the app.')
    } finally {
      setOllamaChecking(false)
    }
  }, [config.ollamaSummariesEnabled, ollamaModel, save])

  const toggleSummaries = useCallback(async (enabled: boolean) => {
    try {
      await save({ ollamaSummariesEnabled: enabled })
    } catch (err) {
      console.error('Failed to save Ollama setting:', err)
    }
  }, [save])

  const saveModel = async () => {
    await save({ ollamaModel: ollamaModel.trim() || 'llama3.2' })
  }

  // Subscribe to OAuth result pushed from main process
  useEffect(() => {
    const unsub = window.baseline.onOuraAuthResult(async (success, error) => {
      setConnecting(false)
      setAuthUrl(null)
      if (success) {
        setConnectError(null)
        await reload()
      } else {
        setConnectError(error ?? 'Authorization failed')
      }
    })
    return unsub
  }, [reload])

  const connect = async () => {
    const id = clientId.trim()
    const secret = clientSecret.trim()
    if (!id || !secret) return
    setConnecting(true)
    setConnectError(null)
    try {
      // Opens browser; result arrives via onOuraAuthResult
      const url = await window.baseline.startOuraAuth(id, secret)
      setAuthUrl(url)
    } catch (err) {
      setConnecting(false)
      setConnectError(err instanceof Error ? err.message : 'Failed to start authorization')
    }
  }

  const disconnect = async () => {
    await window.baseline.disconnectOura()
    await reload()
    setClientId('')
    setClientSecret('')
    setSyncResult(null)
  }

  const syncNow = async () => {
    setSyncing(true)
    setSyncResult(null)
    try {
      await window.baseline.syncOura(30)
      setSyncResult('ok')
    } catch {
      setSyncResult('error')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="drag-region px-5 pt-10 pb-4">
        <div className="no-drag">
          <h1 className="text-xl font-bold">Settings</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 flex flex-col gap-6 pb-6">
        {/* Oura section */}
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold text-[--color-muted] uppercase tracking-wider">
            Oura Ring
          </h2>

          {loading ? (
            <div className="text-[--color-muted] text-sm">Loading…</div>
          ) : isConnected ? (
            /* ── Connected state ── */
            <div className="bg-[--color-surface-2] rounded-xl border border-[--color-border] p-4 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
                <span className="text-sm font-medium">Connected</span>
              </div>
              {config.ouraTokenExpiresAt && (
                <p className="text-[--color-muted] text-xs">
                  Token expires{' '}
                  {new Date(config.ouraTokenExpiresAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={syncNow}
                  disabled={syncing}
                  className="flex-1 py-2 rounded-lg bg-[--color-brand] text-white text-sm disabled:opacity-40 hover:opacity-90 transition-opacity"
                >
                  {syncing ? 'Syncing…' : 'Sync now'}
                </button>
                <button
                  onClick={disconnect}
                  className="flex-1 py-2 rounded-lg border border-[--color-border] text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  Disconnect
                </button>
              </div>
              {syncResult === 'ok' && (
                <p className="text-green-400 text-sm text-center">Synced successfully!</p>
              )}
              {syncResult === 'error' && (
                <p className="text-red-400 text-sm text-center">Sync failed — try reconnecting.</p>
              )}
            </div>
          ) : (
            /* ── Not connected state ── */
            <div className="bg-[--color-surface-2] rounded-xl border border-[--color-border] p-4 flex flex-col gap-3">
              <p className="text-[--color-muted] text-xs leading-relaxed">
                Register an OAuth app at{' '}
                <span className="text-indigo-400">cloud.ouraring.com/oauth/apps</span>, then paste
                your Client ID and Secret below.
              </p>
              <input
                type="text"
                placeholder="Client ID"
                value={clientId}
                onChange={(e) => { setClientId(e.target.value); setConnectError(null) }}
                className="w-full px-3 py-2.5 rounded-lg bg-[#111] border border-[--color-border] text-sm outline-none focus:border-[--color-brand] transition-colors"
              />
              <input
                type="password"
                placeholder="Client Secret"
                value={clientSecret}
                onChange={(e) => { setClientSecret(e.target.value); setConnectError(null) }}
                className="w-full px-3 py-2.5 rounded-lg bg-[#111] border border-[--color-border] text-sm outline-none focus:border-[--color-brand] transition-colors"
              />
              <button
                onClick={connect}
                disabled={connecting || !clientId.trim() || !clientSecret.trim()}
                className="w-full py-2.5 rounded-lg bg-[--color-brand] text-white text-sm font-medium disabled:opacity-40 hover:opacity-90 transition-opacity"
              >
                {connecting ? 'Waiting for browser…' : 'Connect Oura'}
              </button>
              {connectError && (
                <p className="text-red-400 text-xs text-center">{connectError}</p>
              )}
              {connecting && authUrl && (
                <div className="flex flex-col gap-2">
                  <p className="text-[--color-muted] text-xs text-center">
                    If your browser didn't open,{' '}
                    <a
                      href={authUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-400 underline"
                    >
                      click here to authorize
                    </a>
                    .
                  </p>
                  <p className="text-[--color-muted] text-xs text-center break-all select-all">
                    {authUrl}
                  </p>
                </div>
              )}
              {connecting && !authUrl && (
                <p className="text-[--color-muted] text-xs text-center">
                  Opening browser…
                </p>
              )}
            </div>
          )}
        </section>

        {/* Ollama summaries */}
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold text-[--color-muted] uppercase tracking-wider">
            AI Summaries
          </h2>
          <div className="bg-[--color-surface-2] rounded-xl border border-[--color-border] p-4 flex flex-col gap-4">
            {/* Toggle row */}
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Daily readiness summary</p>
                <p className="text-xs text-[--color-muted] mt-0.5">
                  Generated locally via Ollama
                </p>
              </div>
              <button
                role="switch"
                aria-checked={config.ollamaSummariesEnabled ?? false}
                disabled={!config.ollamaSummariesEnabled && ollamaAvailable !== true}
                onClick={() => toggleSummaries(!config.ollamaSummariesEnabled)}
                className={`relative shrink-0 w-11 h-6 rounded-full transition-colors ${
                  config.ollamaSummariesEnabled
                    ? 'bg-[--color-brand]'
                    : 'bg-[--color-border]'
                } disabled:opacity-40`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  config.ollamaSummariesEnabled ? 'translate-x-5' : 'translate-x-0'
                }`} />
              </button>
            </div>

            {/* Not yet detected */}
            {!config.ollamaSummariesEnabled && (
              <div className="flex flex-col gap-2">
                {ollamaAvailable === false && (
                  <p className="text-xs text-[--color-muted] leading-relaxed">
                    Ollama was not found.{' '}
                    <a
                      href="https://ollama.com"
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-400 underline"
                    >
                      Install it from ollama.com
                    </a>
                    , then check again.
                  </p>
                )}
                {ollamaAvailable === null && !ollamaCheckError && (
                  <p className="text-xs text-[--color-muted]">
                    Ollama is required to generate summaries.
                  </p>
                )}
                {ollamaCheckError && (
                  <p className="text-xs text-red-400 leading-relaxed">{ollamaCheckError}</p>
                )}
                <button
                  onClick={checkOllama}
                  disabled={ollamaChecking}
                  className="w-full py-2 rounded-lg border border-[--color-border] text-sm hover:bg-white/5 transition-colors disabled:opacity-40"
                >
                  {ollamaChecking ? 'Checking…' : 'Check for Ollama'}
                </button>
              </div>
            )}

            {/* Model picker — shown when enabled */}
            {config.ollamaSummariesEnabled && (
              <div className="flex flex-col gap-2">
                <label className="text-xs text-[--color-muted]">Model</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={ollamaModel}
                    onChange={(e) => setOllamaModel(e.target.value)}
                    onBlur={saveModel}
                    placeholder="llama3.2"
                    className="flex-1 px-3 py-2 rounded-lg bg-[#111] border border-[--color-border] text-sm outline-none focus:border-[--color-brand] transition-colors"
                  />
                </div>
                <p className="text-[10px] text-[--color-muted]">
                  Must be pulled via <span className="font-mono">ollama pull {ollamaModel || 'llama3.2'}</span>
                </p>
              </div>
            )}
          </div>
        </section>

        {/* About */}
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold text-[--color-muted] uppercase tracking-wider">
            About
          </h2>
          <div className="bg-[--color-surface-2] rounded-xl border border-[--color-border] p-4 flex flex-col gap-2">
            <div className="flex justify-between text-sm">
              <span className="text-[--color-muted]">Version</span>
              <span>0.1.0</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[--color-muted]">Storage</span>
              <span className="text-[--color-muted] text-xs text-right">Local files (Markdown + CSV)</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[--color-muted]">Cloud sync</span>
              <span className="text-[--color-muted]">None</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
