import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts'
import type { DayData } from '../../types'

interface Props {
  days: DayData[]
}

export default function WeekChart({ days }: Props) {
  const data = days.map((d) => ({
    label: d.label,
    sleep: d.sleep_hours,
    mood: d.mood
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
        <YAxis
          yAxisId="sleep"
          domain={[0, 10]}
          tick={{ fill: '#888', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          tickCount={3}
        />
        <YAxis
          yAxisId="mood"
          orientation="right"
          domain={[0, 5]}
          tick={{ fill: '#888', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          tickCount={3}
        />
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
            if (name === 'Sleep') return [`${value}h`, name]
            return [value, name]
          }}
        />
        <Legend
          wrapperStyle={{ fontSize: 11, color: '#888', paddingTop: 8 }}
        />
        <Bar
          yAxisId="sleep"
          dataKey="sleep"
          name="Sleep"
          fill="#374151"
          radius={[3, 3, 0, 0]}
          maxBarSize={28}
        />
        <Line
          yAxisId="mood"
          dataKey="mood"
          name="Mood"
          stroke="#6366f1"
          strokeWidth={2}
          dot={{ fill: '#6366f1', r: 3, strokeWidth: 0 }}
          connectNulls={false}
          activeDot={{ r: 5 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
