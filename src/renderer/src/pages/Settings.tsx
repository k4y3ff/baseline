import { useState, useEffect } from 'react'
import { useConfig } from '../hooks/useConfig'

export default function Settings() {
  const { config, loading, save, reload } = useConfig()
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [connectError, setConnectError] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<'ok' | 'error' | null>(null)

  const isConnected = Boolean(config.ouraAccessToken)

  // Subscribe to OAuth result pushed from main process
  useEffect(() => {
    const unsub = window.baseline.onOuraAuthResult(async (success, error) => {
      setConnecting(false)
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
    // Opens browser; result arrives via onOuraAuthResult
    await window.baseline.startOuraAuth(id, secret)
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
              {connecting && (
                <p className="text-[--color-muted] text-xs text-center">
                  Authorize in your browser, then return here.
                </p>
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
