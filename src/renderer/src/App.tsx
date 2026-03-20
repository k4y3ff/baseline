import { useEffect, useState } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import Setup from './pages/Setup'
import Dashboard from './pages/Dashboard'
import CheckIn from './pages/CheckIn'
import Settings from './pages/Settings'
import Nav from './components/ui/Nav'

export default function App() {
  const [vaultPath, setVaultPath] = useState<string | null | undefined>(undefined)

  useEffect(() => {
    window.baseline.getVaultPath().then(setVaultPath)
  }, [])

  // Still loading vault path
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

  return (
    <HashRouter>
      <div className="flex flex-col h-full max-w-[420px] mx-auto">
        <div className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/check-in" element={<CheckIn />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </div>
        <Nav />
      </div>
    </HashRouter>
  )
}
