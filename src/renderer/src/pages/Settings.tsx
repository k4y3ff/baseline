import { useState, useEffect, useCallback } from 'react'
import { useConfig } from '../hooks/useConfig'
import { ALL_SCREENINGS, FREQUENCY_LABELS } from '../lib/screenings'
import type { ScreeningFrequency } from '../lib/screenings'
import type { Config, YnabBudget } from '../types'

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

  // Ollama is considered verified if the user clicked "Check for Ollama" this session,
  // OR if any AI feature is already enabled (meaning it was verified in a prior session).
  const ollamaVerified = ollamaAvailable === true || config.ollamaSummariesEnabled === true || config.chatEnabled === true

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

  // ── YNAB state ──
  const [ynabPat, setYnabPat] = useState('')
  const [ynabConnecting, setYnabConnecting] = useState(false)
  const [ynabConnectError, setYnabConnectError] = useState<string | null>(null)
  const [ynabBudgets, setYnabBudgets] = useState<YnabBudget[]>([])
  const [ynabSyncing, setYnabSyncing] = useState(false)
  const [ynabSyncResult, setYnabSyncResult] = useState<'ok' | 'error' | null>(null)

  const isYnabConnected = Boolean(config.ynabPat)

  const connectYnab = async () => {
    const pat = ynabPat.trim()
    if (!pat) return
    setYnabConnecting(true)
    setYnabConnectError(null)
    try {
      const budgets = await window.baseline.connectYnab(pat)
      setYnabBudgets(budgets)
      // Auto-select first budget if only one
      if (budgets.length === 1) {
        await save({ ynabPat: pat, ynabBudgetId: budgets[0].id, ynabBudgetName: budgets[0].name, ynabEnabled: true })
      } else {
        await save({ ynabPat: pat, ynabEnabled: true })
      }
      setYnabPat('')
      await reload()
    } catch (err) {
      setYnabConnectError(err instanceof Error ? err.message : 'Failed to connect to YNAB')
    } finally {
      setYnabConnecting(false)
    }
  }

  const disconnectYnab = async () => {
    await window.baseline.disconnectYnab()
    await reload()
    setYnabBudgets([])
    setYnabSyncResult(null)
  }

  const syncYnabNow = async () => {
    setYnabSyncing(true)
    setYnabSyncResult(null)
    try {
      await window.baseline.syncYnab(30)
      setYnabSyncResult('ok')
    } catch {
      setYnabSyncResult('error')
    } finally {
      setYnabSyncing(false)
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

        {/* AI section */}
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold text-[--color-muted] uppercase tracking-wider">
            AI
          </h2>
          <div className="bg-[--color-surface-2] rounded-xl border border-[--color-border] p-4 flex flex-col gap-4">

            {/* Daily readiness summary toggle */}
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Daily readiness summary</p>
                <p className="text-xs text-[--color-muted] mt-0.5">Shown on the Today tab</p>
              </div>
              <button
                role="switch"
                aria-checked={config.ollamaSummariesEnabled ?? false}
                disabled={!config.ollamaSummariesEnabled && !ollamaVerified}
                onClick={() => toggleSummaries(!config.ollamaSummariesEnabled)}
                className={`relative shrink-0 w-11 h-6 rounded-full transition-colors ${
                  config.ollamaSummariesEnabled ? 'bg-[--color-brand]' : 'bg-[--color-border]'
                } disabled:opacity-40`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  config.ollamaSummariesEnabled ? 'translate-x-5' : 'translate-x-0'
                }`} />
              </button>
            </div>

            {/* Chat toggle */}
            <div className="flex flex-col gap-3 pt-1 border-t border-[--color-border]">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Data chat</p>
                  <p className="text-xs text-[--color-muted] mt-0.5">Ask questions on the Analyze tab</p>
                </div>
                <button
                  role="switch"
                  aria-checked={config.chatEnabled ?? false}
                  disabled={!config.chatEnabled && !ollamaVerified}
                  onClick={() => save({ chatEnabled: !config.chatEnabled })}
                  className={`relative shrink-0 w-11 h-6 rounded-full transition-colors ${
                    config.chatEnabled ? 'bg-[--color-brand]' : 'bg-[--color-border]'
                  } disabled:opacity-40`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    config.chatEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              {/* Chat history setting */}
              {config.chatEnabled && (
                <div className="flex items-center justify-between gap-4">
                  <label className="text-sm text-[--color-muted]">Chat history</label>
                  <select
                    value={config.chatHistory ?? 'session'}
                    onChange={(e) => save({ chatHistory: e.target.value as Config['chatHistory'] })}
                    className="bg-[--color-surface] border border-[--color-border] rounded-lg px-3 py-1.5 text-sm outline-none focus:border-[--color-brand] transition-colors"
                  >
                    <option value="session">Session only</option>
                    <option value="daily">Per day</option>
                    <option value="persistent">Persistent</option>
                  </select>
                </div>
              )}
            </div>

            {/* Ollama detection — shown when Ollama hasn't been verified yet */}
            {!ollamaVerified && (
              <div className="flex flex-col gap-2 pt-1 border-t border-[--color-border]">
                {ollamaAvailable === false && (
                  <p className="text-xs text-[--color-muted] leading-relaxed">
                    Ollama was not found.{' '}
                    <a href="https://ollama.com" target="_blank" rel="noreferrer" className="text-indigo-400 underline">
                      Install it from ollama.com
                    </a>
                    , then check again.
                  </p>
                )}
                {ollamaAvailable === null && !ollamaCheckError && (
                  <p className="text-xs text-[--color-muted]">Ollama is required for AI features.</p>
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

            {/* Model picker — shown when any AI feature is enabled */}
            {(config.ollamaSummariesEnabled || config.chatEnabled) && (
              <div className="flex flex-col gap-2 pt-1 border-t border-[--color-border]">
                <label className="text-xs text-[--color-muted]">Model</label>
                <input
                  type="text"
                  value={ollamaModel}
                  onChange={(e) => setOllamaModel(e.target.value)}
                  onBlur={saveModel}
                  placeholder="llama3.2"
                  className="flex-1 px-3 py-2 rounded-lg bg-[#111] border border-[--color-border] text-sm outline-none focus:border-[--color-brand] transition-colors"
                />
                <p className="text-[10px] text-[--color-muted]">
                  Must be pulled via <span className="font-mono">ollama pull {ollamaModel || 'llama3.2'}</span>
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Logging Fields */}
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold text-[--color-muted] uppercase tracking-wider">
            Logging Fields
          </h2>
          <div className="bg-[--color-surface-2] rounded-xl border border-[--color-border] p-4 flex flex-col gap-4">

            {/* Nutrition */}
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Calorie &amp; macro tracking</p>
                <p className="text-xs text-[--color-muted] mt-0.5">
                  Log calories, protein, carbs, and fat
                </p>
              </div>
              <button
                role="switch"
                aria-checked={config.nutritionEnabled ?? false}
                onClick={() => save({ nutritionEnabled: !config.nutritionEnabled })}
                className={`relative shrink-0 w-11 h-6 rounded-full transition-colors ${
                  config.nutritionEnabled ? 'bg-[--color-brand]' : 'bg-[--color-border]'
                }`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  config.nutritionEnabled ? 'translate-x-5' : 'translate-x-0'
                }`} />
              </button>
            </div>

            {/* Weight */}
            <div className="flex items-center justify-between gap-4 pt-3 border-t border-[--color-border]">
              <div>
                <p className="text-sm font-medium">Weight tracking</p>
                <p className="text-xs text-[--color-muted] mt-0.5">
                  Log your weight in each daily check-in
                </p>
              </div>
              <button
                role="switch"
                aria-checked={config.weightEnabled ?? false}
                onClick={() => save({ weightEnabled: !config.weightEnabled })}
                className={`relative shrink-0 w-11 h-6 rounded-full transition-colors ${
                  config.weightEnabled ? 'bg-[--color-brand]' : 'bg-[--color-border]'
                }`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  config.weightEnabled ? 'translate-x-5' : 'translate-x-0'
                }`} />
              </button>
            </div>

          </div>
        </section>

        {/* Screenings */}
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold text-[--color-muted] uppercase tracking-wider">
            Screenings
          </h2>
          <div className="bg-[--color-surface-2] rounded-xl border border-[--color-border] p-4 flex flex-col gap-4">
            <p className="text-xs text-[--color-muted] leading-relaxed">
              Periodic self-assessments. You'll be reminded on the Today tab when one is due.
            </p>

            {/* Screening checkboxes */}
            <div className="flex flex-col gap-3">
              {ALL_SCREENINGS.map((s) => {
                const enabled = (config.screeningsEnabled ?? []).includes(s.id)
                return (
                  <label key={s.id} className="flex items-start gap-3 cursor-pointer">
                    <div className="relative mt-0.5">
                      <input
                        type="checkbox"
                        checked={enabled}
                        onChange={async (e) => {
                          const current = config.screeningsEnabled ?? []
                          const next = e.target.checked
                            ? [...current, s.id]
                            : current.filter((id) => id !== s.id)
                          await save({ screeningsEnabled: next })
                        }}
                        className="sr-only"
                      />
                      <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                        enabled
                          ? 'bg-[--color-brand] border-[--color-brand]'
                          : 'bg-transparent border-[--color-border]'
                      }`}>
                        {enabled && <span className="text-white text-xs leading-none">✓</span>}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium">{s.id}</p>
                      <p className="text-xs text-[--color-muted] mt-0.5">{s.fullName}</p>
                    </div>
                  </label>
                )
              })}
            </div>

            {/* Frequency — only shown when at least one screening is enabled */}
            {(config.screeningsEnabled ?? []).length > 0 && (
              <div className="flex items-center justify-between gap-4 pt-1 border-t border-[--color-border]">
                <label className="text-sm text-[--color-muted]">Frequency</label>
                <select
                  value={config.screeningFrequency ?? 'weekly'}
                  onChange={async (e) => {
                    await save({ screeningFrequency: e.target.value as ScreeningFrequency })
                  }}
                  className="bg-[--color-surface] border border-[--color-border] rounded-lg px-3 py-1.5 text-sm outline-none focus:border-[--color-brand] transition-colors"
                >
                  {(Object.keys(FREQUENCY_LABELS) as ScreeningFrequency[]).map((key) => (
                    <option key={key} value={key}>{FREQUENCY_LABELS[key]}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </section>

        {/* YNAB */}
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold text-[--color-muted] uppercase tracking-wider">
            YNAB
          </h2>

          {loading ? (
            <div className="text-[--color-muted] text-sm">Loading…</div>
          ) : isYnabConnected ? (
            /* ── Connected state ── */
            <div className="bg-[--color-surface-2] rounded-xl border border-[--color-border] p-4 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
                <span className="text-sm font-medium">Connected</span>
              </div>
              {config.ynabBudgetName && (
                <p className="text-[--color-muted] text-xs">Budget: {config.ynabBudgetName}</p>
              )}
              {/* Budget selector — shown when PAT is set but no budget chosen yet, or when budgets list is available */}
              {ynabBudgets.length > 1 && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-[--color-muted]">Select budget</label>
                  <select
                    value={config.ynabBudgetId ?? ''}
                    onChange={async (e) => {
                      const chosen = ynabBudgets.find((b) => b.id === e.target.value)
                      if (chosen) await save({ ynabBudgetId: chosen.id, ynabBudgetName: chosen.name })
                    }}
                    className="bg-[--color-surface] border border-[--color-border] rounded-lg px-3 py-1.5 text-sm outline-none focus:border-[--color-brand] transition-colors"
                  >
                    <option value="">— choose —</option>
                    {ynabBudgets.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={syncYnabNow}
                  disabled={ynabSyncing || !config.ynabBudgetId}
                  className="flex-1 py-2 rounded-lg bg-[--color-brand] text-white text-sm disabled:opacity-40 hover:opacity-90 transition-opacity"
                >
                  {ynabSyncing ? 'Syncing…' : 'Sync now'}
                </button>
                <button
                  onClick={disconnectYnab}
                  className="flex-1 py-2 rounded-lg border border-[--color-border] text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  Disconnect
                </button>
              </div>
              {ynabSyncResult === 'ok' && (
                <p className="text-green-400 text-sm text-center">Synced successfully!</p>
              )}
              {ynabSyncResult === 'error' && (
                <p className="text-red-400 text-sm text-center">Sync failed — check your connection.</p>
              )}
            </div>
          ) : (
            /* ── Not connected state ── */
            <div className="bg-[--color-surface-2] rounded-xl border border-[--color-border] p-4 flex flex-col gap-3">
              <p className="text-[--color-muted] text-xs leading-relaxed">
                Generate a Personal Access Token at{' '}
                <span className="text-indigo-400">app.ynab.com/settings/developer</span> and paste it
                below. Daily spending totals will be synced to your vault.
              </p>
              <input
                type="password"
                placeholder="YNAB Personal Access Token"
                value={ynabPat}
                onChange={(e) => { setYnabPat(e.target.value); setYnabConnectError(null) }}
                className="w-full px-3 py-2.5 rounded-lg bg-[#111] border border-[--color-border] text-sm outline-none focus:border-[--color-brand] transition-colors"
              />
              <button
                onClick={connectYnab}
                disabled={ynabConnecting || !ynabPat.trim()}
                className="w-full py-2.5 rounded-lg bg-[--color-brand] text-white text-sm font-medium disabled:opacity-40 hover:opacity-90 transition-opacity"
              >
                {ynabConnecting ? 'Connecting…' : 'Connect YNAB'}
              </button>
              {ynabConnectError && (
                <p className="text-red-400 text-xs text-center">{ynabConnectError}</p>
              )}
            </div>
          )}
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
