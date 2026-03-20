import { useState, useEffect, useCallback } from 'react'
import type { ScreeningResult } from '../types'

export function useScreenings() {
  const [results, setResults] = useState<ScreeningResult[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const data = await window.baseline.listScreenings()
    setResults(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const save = useCallback(
    async (result: ScreeningResult) => {
      await window.baseline.saveScreening(result)
      await load()
    },
    [load]
  )

  return { results, loading, save, reload: load }
}
