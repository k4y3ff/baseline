import { useState, useEffect, useCallback } from 'react'
import type { Config } from '../types'

export function useConfig() {
  const [config, setConfig] = useState<Config>({})
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    setLoading(true)
    const c = await window.baseline.readConfig()
    setConfig(c)
    setLoading(false)
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  const save = async (updates: Partial<Config>) => {
    const next = { ...config, ...updates }
    await window.baseline.writeConfig(next)
    setConfig(next)
  }

  return { config, loading, save, reload }
}
