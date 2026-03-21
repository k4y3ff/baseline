import { useEffect, useMemo, useRef, useState } from 'react'
import { useDashboard } from '../hooks/useDashboard'
import { useConfig } from '../hooks/useConfig'
import { useScreenings } from '../hooks/useScreenings'
import WeekChart, { CHART_VARS, CHART_VAR_KEYS } from '../components/charts/WeekChart'
import type { ChartVarKey } from '../components/charts/WeekChart'
import type { Config } from '../types'

function enabledVarKeysFor(config: Config): ChartVarKey[] {
  const oura = Boolean(config.ouraAccessToken)
  return CHART_VAR_KEYS.filter((k) => {
    const req = CHART_VARS[k].requires
    if (!req) return true
    if (req === 'oura')      return oura
    if (req === 'ynab')      return Boolean(config.ynabEnabled)
    if (req === 'weight')    return Boolean(config.weightEnabled)
    if (req === 'nutrition') return Boolean(config.nutritionEnabled)
    if (req === 'phq9')      return Boolean(config.screeningsEnabled?.includes('PHQ-9'))
    if (req === 'medication') return Boolean(config.medicationEnabled)
    return true
  }) as ChartVarKey[]
}
import type { ChatMessage } from '../types'

const selectCls = 'bg-[--color-surface] border border-[--color-border] rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[--color-brand] transition-colors flex-1 min-w-0'

const RANGES = [
  { label: '7 days',   days: 7   },
  { label: '1 month',  days: 30  },
  { label: '3 months', days: 90  },
  { label: '6 months', days: 180 },
  { label: '1 year',   days: 365 },
]

export default function Analyze() {
  // Time range — persisted to localStorage
  const [numDays, setNumDays] = useState<number>(
    () => parseInt(localStorage.getItem('analyze-range') || '7')
  )
  const changeRange = (d: number) => { setNumDays(d); localStorage.setItem('analyze-range', String(d)) }

  const { days, loading } = useDashboard(numDays)
  const { config } = useConfig()
  const { results: screeningResults } = useScreenings()

  // Variable selection — persisted to localStorage
  const [varA, setVarA] = useState<ChartVarKey>(
    () => (localStorage.getItem('analyze-var-a') as ChartVarKey) || 'sleep_hours'
  )
  const [varB, setVarB] = useState<ChartVarKey>(
    () => (localStorage.getItem('analyze-var-b') as ChartVarKey) || 'readiness_score'
  )

  const changeVarA = (k: ChartVarKey) => { setVarA(k); localStorage.setItem('analyze-var-a', k) }
  const changeVarB = (k: ChartVarKey) => { setVarB(k); localStorage.setItem('analyze-var-b', k) }

  // Variables enabled by current config
  const enabledKeys = useMemo(() => enabledVarKeysFor(config), [config])

  // Reset selections if a chosen var becomes disabled
  useEffect(() => {
    if (enabledKeys.length === 0) return
    if (!enabledKeys.includes(varA)) changeVarA(enabledKeys[0])
    if (!enabledKeys.includes(varB)) changeVarB(enabledKeys[Math.min(1, enabledKeys.length - 1)])
  }, [enabledKeys])

  // Join PHQ-9 scores into the day data by date
  const chartDays = useMemo(() => {
    const phq9ByDate = new Map(
      screeningResults.filter((r) => r.type === 'PHQ-9').map((r) => [r.date, r.score])
    )
    return days.map((d) => ({ ...d, phq9_score: phq9ByDate.get(d.date) ?? null }))
  }, [days, screeningResults])

  // ── Chat state ──────────────────────────────────────────────────────────────
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [streamBuf, setStreamBuf] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Load persisted history when chat is enabled
  useEffect(() => {
    if (config.chatEnabled) {
      window.baseline.readChatHistory().then(setMessages)
    }
  }, [config.chatEnabled])

  // Subscribe to streaming events from main process
  useEffect(() => {
    const unToken = window.baseline.onChatToken((t) => setStreamBuf((b) => b + t))

    const unDone = window.baseline.onChatDone(() => {
      setStreamBuf((buf) => {
        if (buf) {
          setMessages((msgs) => {
            const next: ChatMessage[] = [...msgs, { role: 'assistant', content: buf }]
            window.baseline.writeChatHistory(next)
            return next
          })
        }
        return ''
      })
      setStreaming(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    })

    const unError = window.baseline.onChatError((err) => {
      setMessages((msgs) => [...msgs, { role: 'assistant', content: `⚠ ${err}` }])
      setStreamBuf('')
      setStreaming(false)
    })

    return () => { unToken(); unDone(); unError() }
  }, [])

  // Auto-scroll to bottom as tokens arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamBuf])

  const send = async () => {
    const text = input.trim()
    if (!text || streaming) return
    const userMsg: ChatMessage = { role: 'user', content: text }
    const next: ChatMessage[] = [...messages, userMsg]
    setMessages(next)
    setInput('')
    setStreaming(true)
    setStreamBuf('')
    try {
      await window.baseline.startChat(next)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send'
      setMessages((m) => [...m, { role: 'assistant', content: `⚠ ${msg}` }])
      setStreaming(false)
    }
  }

  const clearChat = async () => {
    setMessages([])
    setStreamBuf('')
    await window.baseline.writeChatHistory([])
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="drag-region px-5 pt-10 pb-2">
        <h1 className="text-xl font-bold no-drag">Analyze</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-5 flex flex-col gap-5 pb-6">
        {/* Chat panel — only when enabled in Settings */}
        {config.chatEnabled && (
          <div className="bg-[--color-surface-2] rounded-xl border border-[--color-border] flex flex-col overflow-hidden">
            {/* Messages area */}
            <div className="h-[186px] overflow-y-auto p-3 flex flex-col gap-2">
              {messages.length === 0 && !streamBuf && !streaming && (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-xs text-[--color-muted] text-center leading-relaxed">
                    Ask about your Baseline data —<br />sleep trends, HRV, mood patterns, and more.
                  </p>
                </div>
              )}

              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] px-3 py-2 rounded-xl text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-[--color-brand] text-white rounded-br-sm'
                        : 'bg-[--color-surface] text-[--color-text] rounded-bl-sm'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}

              {/* Streaming response */}
              {(streaming || streamBuf) && (
                <div className="flex justify-start">
                  <div className="max-w-[85%] px-3 py-2 rounded-xl rounded-bl-sm bg-[--color-surface] text-sm leading-relaxed">
                    {streamBuf || <span className="animate-pulse text-[--color-muted]">···</span>}
                    {streaming && streamBuf && (
                      <span className="inline-block w-0.5 h-3.5 bg-[--color-muted] ml-0.5 animate-pulse align-middle" />
                    )}
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* Input bar */}
            <div className="border-t border-[--color-border] p-2 flex gap-2 items-center">
              {messages.length > 0 && !streaming && (
                <button
                  onClick={clearChat}
                  className="shrink-0 text-[--color-muted] hover:text-[--color-text] text-xs px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
                  title="Clear chat"
                >
                  ✕
                </button>
              )}
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                disabled={streaming}
                placeholder="Ask about your data…"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-[--color-muted] disabled:opacity-50"
              />
              <button
                onClick={send}
                disabled={!input.trim() || streaming}
                className="shrink-0 w-8 h-8 rounded-lg bg-[--color-brand] text-white text-sm flex items-center justify-center disabled:opacity-40 hover:opacity-90 transition-opacity"
              >
                ↑
              </button>
            </div>
          </div>
        )}

        {/* Compare chart */}
        <div className="bg-[--color-surface-2] rounded-xl border border-[--color-border] p-4">
          {/* Header row: title + variable selectors */}
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-xs font-semibold text-[--color-muted] uppercase tracking-wider shrink-0">
              Compare
            </h2>
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <select
                value={varA}
                onChange={(e) => changeVarA(e.target.value as ChartVarKey)}
                className={selectCls}
              >
                {enabledKeys.map((k) => (
                  <option key={k} value={k}>{CHART_VARS[k].label}</option>
                ))}
              </select>
              <span className="text-[10px] text-[--color-muted] shrink-0">vs</span>
              <select
                value={varB}
                onChange={(e) => changeVarB(e.target.value as ChartVarKey)}
                className={selectCls}
              >
                {enabledKeys.map((k) => (
                  <option key={k} value={k}>{CHART_VARS[k].label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Range pills */}
          <div className="flex gap-1 mb-3">
            {RANGES.map((r) => (
              <button
                key={r.days}
                onClick={() => changeRange(r.days)}
                className={`px-2 py-0.5 rounded-full text-[10px] transition-colors ${
                  numDays === r.days
                    ? 'bg-[--color-brand] text-white'
                    : 'text-[--color-muted] hover:text-[--color-text]'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="h-[180px] flex items-center justify-center text-[--color-muted] text-sm">
              Loading…
            </div>
          ) : (
            <WeekChart days={chartDays} varA={varA} varB={varB} numDays={numDays} />
          )}
        </div>
      </div>
    </div>
  )
}
