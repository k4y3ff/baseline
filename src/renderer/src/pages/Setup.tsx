import { useState, useEffect } from 'react'

interface Props {
  onComplete: (vaultPath: string) => void
}

export default function Setup({ onComplete }: Props) {
  const [step, setStep] = useState<'folder' | 'oura'>('folder')
  const [vaultPath, setVaultPath] = useState<string | null>(null)
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [connected, setConnected] = useState(false)
  const [connectError, setConnectError] = useState<string | null>(null)
  const [authUrl, setAuthUrl] = useState<string | null>(null)

  // Listen for OAuth result from main process
  useEffect(() => {
    const unsub = window.baseline.onOuraAuthResult((success, error) => {
      setConnecting(false)
      setAuthUrl(null)
      if (success) {
        setConnected(true)
        setConnectError(null)
      } else {
        setConnectError(error ?? 'Authorization failed')
      }
    })
    return unsub
  }, [])

  const pickFolder = async () => {
    const path = await window.baseline.pickFolder()
    if (path) setVaultPath(path)
  }

  const confirmFolder = async () => {
    if (!vaultPath) return
    await window.baseline.setupVault(vaultPath)
    setStep('oura')
  }

  const connectOura = async () => {
    const id = clientId.trim()
    const secret = clientSecret.trim()
    if (!id || !secret) return
    setConnecting(true)
    setConnectError(null)
    try {
      // Opens browser — result arrives via onOuraAuthResult
      const url = await window.baseline.startOuraAuth(id, secret)
      setAuthUrl(url)
    } catch (err) {
      setConnecting(false)
      setConnectError(err instanceof Error ? err.message : 'Failed to start authorization')
    }
  }

  const finish = () => {
    onComplete(vaultPath!)
  }

  return (
    <div className="flex flex-col h-full items-center justify-center p-6 gap-8">
      {/* Logo */}
      <div className="text-center">
        <div className="text-4xl font-bold tracking-tight text-[--color-text]">Baseline</div>
        <div className="text-[--color-muted] text-sm mt-1">Your local wellness dashboard</div>
      </div>

      {step === 'folder' && (
        <div className="w-full flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-center">Choose a vault folder</h2>
          <p className="text-[--color-muted] text-sm text-center">
            Baseline stores your data as plain Markdown and CSV files in a folder you control. Back
            it up however you like.
          </p>

          <button
            onClick={pickFolder}
            className="w-full py-3 rounded-xl border border-[--color-border] bg-[--color-surface-2] hover:bg-[--color-surface] transition-colors text-sm"
          >
            {vaultPath ? (
              <span className="text-[--color-text] break-all">{vaultPath}</span>
            ) : (
              <span className="text-[--color-muted]">Choose folder…</span>
            )}
          </button>

          <button
            onClick={confirmFolder}
            disabled={!vaultPath}
            className="w-full py-3 rounded-xl bg-[--color-brand] text-white font-medium disabled:opacity-40 hover:opacity-90 transition-opacity"
          >
            Continue
          </button>
        </div>
      )}

      {step === 'oura' && (
        <div className="w-full flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-center">Connect Oura (optional)</h2>

          {connected ? (
            <>
              <div className="flex items-center justify-center gap-2 py-4">
                <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
                <span className="text-sm font-medium text-green-400">Oura connected!</span>
              </div>
              <button
                onClick={finish}
                className="w-full py-3 rounded-xl bg-[--color-brand] text-white font-medium hover:opacity-90 transition-opacity"
              >
                Get started
              </button>
            </>
          ) : (
            <>
              <p className="text-[--color-muted] text-sm text-center">
                Register an OAuth app at{' '}
                <span className="text-indigo-400">cloud.ouraring.com/oauth/apps</span> to get your
                Client ID and Secret. You can skip this and connect later in Settings.
              </p>

              <input
                type="text"
                placeholder="Client ID"
                value={clientId}
                onChange={(e) => { setClientId(e.target.value); setConnectError(null) }}
                className="w-full px-4 py-3 rounded-xl bg-[--color-surface-2] border border-[--color-border] text-sm outline-none focus:border-[--color-brand] transition-colors"
              />
              <input
                type="password"
                placeholder="Client Secret"
                value={clientSecret}
                onChange={(e) => { setClientSecret(e.target.value); setConnectError(null) }}
                className="w-full px-4 py-3 rounded-xl bg-[--color-surface-2] border border-[--color-border] text-sm outline-none focus:border-[--color-brand] transition-colors"
              />

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
                <p className="text-[--color-muted] text-xs text-center">Opening browser…</p>
              )}
              {connectError && (
                <p className="text-red-400 text-xs text-center">{connectError}</p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={finish}
                  className="flex-1 py-3 rounded-xl border border-[--color-border] text-sm hover:bg-[--color-surface-2] transition-colors"
                >
                  Skip
                </button>
                <button
                  onClick={connectOura}
                  disabled={connecting || !clientId.trim() || !clientSecret.trim()}
                  className="flex-1 py-3 rounded-xl bg-[--color-brand] text-white font-medium disabled:opacity-40 hover:opacity-90 transition-opacity text-sm"
                >
                  {connecting ? 'Waiting…' : 'Connect Oura'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
