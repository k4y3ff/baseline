import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'
import type { DayData } from '../../types'

// ── Variable catalogue ────────────────────────────────────────────────────────

export interface ChartVarDef {
  label: string
  unit: string
  domain: [number, number | 'auto']
  color: string
}

export const CHART_VARS: Record<string, ChartVarDef> = {
  sleep_hours:     { label: 'Sleep',        unit: 'h',    domain: [0, 12],     color: '#818cf8' },
  sleep_score:     { label: 'Sleep Score',  unit: '',     domain: [0, 100],    color: '#6366f1' },
  hrv_avg:         { label: 'HRV Balance',  unit: '',     domain: [0, 100],    color: '#34d399' },
  readiness_score: { label: 'Readiness',    unit: '',     domain: [0, 100],    color: '#fbbf24' },
  activity_score:  { label: 'Activity',     unit: '',     domain: [0, 100],    color: '#f87171' },
  steps:           { label: 'Steps',        unit: '',     domain: [0, 'auto'], color: '#38bdf8' },
  mood:            { label: 'Mood',         unit: '/5',   domain: [0, 5],      color: '#c084fc' },
  energy:          { label: 'Energy',       unit: '/5',   domain: [0, 5],      color: '#fb923c' },
  calories:        { label: 'Calories',     unit: 'kcal', domain: [0, 'auto'], color: '#f472b6' },
  phq9_score:      { label: 'PHQ-9',        unit: '/27',  domain: [0, 27],     color: '#2dd4bf' },
}

export const CHART_VAR_KEYS = Object.keys(CHART_VARS)
export type ChartVarKey = keyof typeof CHART_VARS

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  days: DayData[]
  varA: ChartVarKey
  varB: ChartVarKey
}

export default function WeekChart({ days, varA, varB }: Props) {
  const defA = CHART_VARS[varA]
  const defB = CHART_VARS[varB]
  const sameVar = varA === varB

  const data = days.map((d) => ({
    label: d.label,
    [varA]: d[varA as keyof DayData] ?? null,
    // use a distinct key so Recharts treats them as separate series even if same field
    [`${varB}_b`]: d[varB as keyof DayData] ?? null,
  }))

  return (
    <ResponsiveContainer width="100%" height={180}>
      <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2e2e2e" />
        <XAxis
          dataKey="label"
          tick={{ fill: '#888', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />

        {/* Left Y-axis — variable A */}
        <YAxis
          yAxisId="a"
          domain={defA.domain}
          tick={{ fill: defA.color, fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          tickCount={4}
          width={32}
        />

        {/* Right Y-axis — variable B (hidden when same as A) */}
        {!sameVar && (
          <YAxis
            yAxisId="b"
            orientation="right"
            domain={defB.domain}
            tick={{ fill: defB.color, fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickCount={4}
            width={32}
          />
        )}

        <Tooltip
          contentStyle={{
            background: '#1a1a1a',
            border: '1px solid #2e2e2e',
            borderRadius: 8,
            fontSize: 12,
            color: '#f0f0f0'
          }}
          cursor={{ fill: 'rgba(255,255,255,0.04)' }}
          formatter={(value: number | null, name: string) => {
            if (value == null) return ['—', name]
            const isB = name === defB.label && !sameVar
            const def = isB ? defB : defA
            const formatted = Number.isInteger(value) ? value : value.toFixed(1)
            return [`${formatted}${def.unit}`, name]
          }}
        />

        <Legend wrapperStyle={{ fontSize: 11, color: '#888', paddingTop: 8 }} />

        <Line
          yAxisId="a"
          dataKey={varA}
          name={defA.label}
          stroke={defA.color}
          strokeWidth={2}
          dot={{ fill: defA.color, r: 3, strokeWidth: 0 }}
          activeDot={{ r: 5 }}
          connectNulls={false}
        />

        <Line
          yAxisId={sameVar ? 'a' : 'b'}
          dataKey={`${varB}_b`}
          name={sameVar ? `${defB.label} (2)` : defB.label}
          stroke={defB.color}
          strokeWidth={2}
          strokeDasharray={sameVar ? '4 2' : undefined}
          dot={{ fill: defB.color, r: 3, strokeWidth: 0 }}
          activeDot={{ r: 5 }}
          connectNulls={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
