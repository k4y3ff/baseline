import { useState, useEffect, useCallback } from 'react'
import type { DayData, OuraRow } from '../types'
import { parseCheckIn } from '../lib/checkInFormat'

// Use local calendar date to match Oura's date keys.
function localDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function todayStr(): string {
  return localDateStr(new Date())
}

function lastNDays(n: number): string[] {
  const days: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    days.push(localDateStr(d))
  }
  return days
}

function dayLabel(dateStr: string, numDays: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  if (numDays <= 7) return d.toLocaleDateString('en-US', { weekday: 'short' })
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function num(s: string | undefined): number | null {
  if (!s) return null
  const n = parseFloat(s)
  return isNaN(n) ? null : n
}

export function useDashboard(numDays = 14) {
  const [days, setDays] = useState<DayData[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const dates = lastNDays(numDays)
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
        label: dayLabel(date, numDays),
        mood: ci?.mood ?? null,
        energy: ci?.energy ?? null,
        sleep_hours: num(oura?.sleep_hours),
        sleep_score: num(oura?.sleep_score),
        hrv_avg: num(oura?.hrv_avg),
        readiness_score: num(oura?.readiness_score),
        activity_score: num(oura?.activity_score),
        steps: num(oura?.steps),
        calories: ci?.nutrition?.calories ?? null,
        phq9_score: null // joined in Analyze from screening results
      }
    })

    setDays(result)
    setLoading(false)
  }, [numDays])

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
