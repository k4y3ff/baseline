import { useState, useEffect, useCallback } from 'react'
import type { DayData, OuraRow } from '../types'
import { parseCheckIn } from '../lib/checkInFormat'

function todayStr(): string {
  return new Date().toISOString().split('T')[0]
}

function last7Days(): string[] {
  const days: string[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000)
    days.push(d.toISOString().split('T')[0])
  }
  return days
}

function dayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short' })
}

function num(s: string | undefined): number | null {
  if (!s) return null
  const n = parseFloat(s)
  return isNaN(n) ? null : n
}

export function useDashboard() {
  const [days, setDays] = useState<DayData[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const dates = last7Days()
    const [ouraRows, checkInDates] = await Promise.all([
      window.baseline.readOuraCsv(),
      window.baseline.listCheckIns()
    ])

    const ouraMap = new Map<string, OuraRow>(ouraRows.map((r) => [r.date, r]))
    const checkInSet = new Set(checkInDates)

    // Fetch check-ins for the 7 days we care about
    const checkIns = await Promise.all(
      dates.map(async (date) => {
        if (!checkInSet.has(date)) return null
        const md = await window.baseline.readCheckIn(date)
        if (!md) return null
        return parseCheckIn(date, md)
      })
    )

    const result: DayData[] = dates.map((date, i) => {
      const oura = ouraMap.get(date)
      const ci = checkIns[i]
      return {
        date,
        label: dayLabel(date),
        mood: ci?.mood ?? null,
        energy: ci?.energy ?? null,
        sleep_hours: num(oura?.sleep_hours),
        hrv_avg: num(oura?.hrv_avg),
        readiness_score: num(oura?.readiness_score),
        activity_score: num(oura?.activity_score),
        steps: num(oura?.steps)
      }
    })

    setDays(result)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const triggerSync = useCallback(async () => {
    setSyncing(true)
    setSyncError(null)
    try {
      await window.baseline.syncOura()
      await load()
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }, [load])

  const today = days.find((d) => d.date === todayStr()) ?? null
  const hasCheckInToday = today?.mood != null

  return { days, today, hasCheckInToday, loading, syncing, syncError, reload: load, triggerSync }
}
