import { useEffect, useRef, useState } from 'react'
import { useDashboard } from '../hooks/useDashboard'
import { useConfig } from '../hooks/useConfig'
import WeekChart from '../components/charts/WeekChart'
import type { ChatMessage } from '../types'

export default function Analyze() {
  const { days, loading } = useDashboard()
  const { config } = useConfig()

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

        {/* 7-day chart */}
        <div className="bg-[--color-surface-2] rounded-xl border border-[--color-border] p-4">
          <h2 className="text-xs font-semibold text-[--color-muted] uppercase tracking-wider mb-3">
            Last 7 Days
          </h2>
          {loading ? (
            <div className="h-[180px] flex items-center justify-center text-[--color-muted] text-sm">
              Loading…
            </div>
          ) : (
            <WeekChart days={days} />
          )}
        </div>
      </div>
    </div>
  )
}
