import { useState, useEffect } from 'react'
import type { VaultMeta } from '../types'

interface UnlockProps {
  meta: VaultMeta
  onUnlocked: () => void
}

export default function Unlock({ meta, onUnlocked }: UnlockProps) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [touchIdAvailable, setTouchIdAvailable] = useState(false)

  useEffect(() => {
    window.baseline.canUseTouchId().then(setTouchIdAvailable)
    // Auto-prompt Touch ID if it's the preferred unlock method
    if (meta.touchIdEnabled) {
      tryTouchId()
    }
  }, [])

  const tryTouchId = async () => {
    setBusy(true)
    setError(null)
    const result = await window.baseline.unlockWithTouchId()
    if (result.success) {
      onUnlocked()
    } else {
      setError(result.error ?? 'Touch ID failed')
      setBusy(false)
    }
  }

  const tryPassword = async () => {
    if (!password) return
    setBusy(true)
    setError(null)
    const result = await window.baseline.unlockWithPassword(password)
    if (result.success) {
      onUnlocked()
    } else {
      setError(result.error ?? 'Incorrect password')
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full items-center justify-center bg-[--color-bg]">
      <div className="w-full max-w-xs px-6 flex flex-col gap-5">
        <div className="flex flex-col gap-1 text-center">
          <p className="text-base font-semibold">Baseline is locked</p>
          <p className="text-xs text-[--color-muted]">
            {meta.touchIdEnabled && touchIdAvailable
              ? 'Use Touch ID or enter your password to unlock'
              : 'Enter your password to unlock'}
          </p>
        </div>

        {/* Touch ID button */}
        {meta.touchIdEnabled && touchIdAvailable && (
          <button
            onClick={tryTouchId}
            disabled={busy}
            className="w-full py-2.5 rounded-xl border border-[--color-border] text-sm font-medium hover:bg-white/5 disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 1C6.48 1 2 5.48 2 11c0 2.39.85 4.58 2.26 6.3L2 21.41 6.71 19.15A9.94 9.94 0 0 0 12 21c5.52 0 10-4.48 10-10S17.52 1 12 1zm0 18c-1.59 0-3.07-.47-4.31-1.28L5 18.59l.88-2.68A7.95 7.95 0 0 1 4 11c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8zm0-14c-1.66 0-3 1.34-3 3v2c0 .55.45 1 1 1s1-.45 1-1V8c0-.55.45-1 1-1s1 .45 1 1v2c0 .55.45 1 1 1s1-.45 1-1V8c0-1.66-1.34-3-3-3zm0 8c-.55 0-1 .45-1 1v3c0 .55.45 1 1 1s1-.45 1-1v-3c0-.55-.45-1-1-1z"/>
            </svg>
            Use Touch ID
          </button>
        )}

        {/* Password form */}
        {meta.passwordEnabled && (
          <div className="flex flex-col gap-2">
            {meta.touchIdEnabled && touchIdAvailable && (
              <div className="flex items-center gap-2 text-xs text-[--color-muted]">
                <div className="flex-1 h-px bg-[--color-border]" />
                <span>or</span>
                <div className="flex-1 h-px bg-[--color-border]" />
              </div>
            )}
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') tryPassword() }}
              autoFocus={!meta.touchIdEnabled}
              className="w-full px-3 py-2.5 rounded-xl bg-[--color-surface-2] border border-[--color-border] text-sm outline-none focus:border-[--color-brand] transition-colors"
            />
            <button
              onClick={tryPassword}
              disabled={busy || !password}
              className="w-full py-2.5 rounded-xl bg-[--color-brand] text-white text-sm font-medium disabled:opacity-40 hover:opacity-90 transition-opacity"
            >
              {busy ? 'Unlocking…' : 'Unlock'}
            </button>
          </div>
        )}

        {error && <p className="text-red-400 text-xs text-center">{error}</p>}
      </div>
    </div>
  )
}
