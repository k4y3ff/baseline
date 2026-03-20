import { useState, useEffect } from 'react'

export function useVault() {
  const [vaultPath, setVaultPath] = useState<string | null | undefined>(undefined)

  useEffect(() => {
    window.baseline.getVaultPath().then(setVaultPath)
  }, [])

  const setup = async (path: string) => {
    await window.baseline.setupVault(path)
    setVaultPath(path)
  }

  return { vaultPath, setup }
}
