import { useEffect, useState } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import Setup from './pages/Setup'
import Unlock from './pages/Unlock'
import Dashboard from './pages/Dashboard'
import Analyze from './pages/Analyze'
import CheckIn from './pages/CheckIn'
import History from './pages/History'
import Prepare from './pages/Prepare'
import Screening from './pages/Screening'
import Settings from './pages/Settings'
import Nav from './components/ui/Nav'
import type { VaultMeta } from './types'

export default function App() {
  const [vaultPath, setVaultPath] = useState<string | null | undefined>(undefined)
  const [vaultMeta, setVaultMeta] = useState<VaultMeta | null>(null)
  const [unlocked, setUnlocked] = useState(false)

  useEffect(() => {
    async function init() {
      const path = await window.baseline.getVaultPath()
      if (path) {
        const meta = await window.baseline.readVaultMeta()
        setVaultMeta(meta)
        if (!meta.encryptionEnabled) setUnlocked(true)
        else {
          const already = await window.baseline.isVaultUnlocked()
          setUnlocked(already)
        }
      }
      // Set path last — keeps the loading spinner until all checks are done
      setVaultPath(path)
    }
    init()
  }, [])

  // Still loading
  if (vaultPath === undefined) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-[--color-muted] text-sm">Loading…</div>
      </div>
    )
  }

  // First run
  if (vaultPath === null) {
    return (
      <Setup
        onComplete={(path) => setVaultPath(path)}
      />
    )
  }

  // Locked vault — needs unlock
  if (vaultMeta?.encryptionEnabled && !unlocked) {
    return (
      <Unlock
        meta={vaultMeta}
        onUnlocked={() => setUnlocked(true)}
      />
    )
  }

  return (
    <HashRouter>
      <div className="flex h-full">
        <Nav />
        <div className="flex-1 overflow-y-auto min-w-0">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/analyze" element={<Analyze />} />
            <Route path="/prepare" element={<Prepare />} />
            <Route path="/check-in" element={<CheckIn />} />
            <Route path="/check-in/:date" element={<CheckIn />} />
            <Route path="/history" element={<History />} />
            <Route path="/screening/:type" element={<Screening />} />
            <Route path="/screening/:type/:date" element={<Screening />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </div>
      </div>
    </HashRouter>
  )
}
