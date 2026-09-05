'use client'
import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import SalaryTicker from '@/components/session/SalaryTicker'
import ProofHeartbeatTimeline from '@/components/session/ProofHeartbeatTimeline'
import AgentWorkTimeline from '@/components/session/AgentWorkTimeline'
import StreamStatusBadge from '@/components/session/StreamStatusBadge'
import CostBreakdown from '@/components/session/CostBreakdown'
import MagiConsensusEngine from '@/components/session/MagiConsensusEngine'

interface ChatMessage {
  role: 'user' | 'model'
  text: string
}

interface AgentStep {
  kind: string
  title: string
  body: string
  ts: string
}

interface ProofEvent {
  seq: number
  proofHash: string
  txHash?: string
  ts: string
}

export default function SessionPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [status, setStatus] = useState<'active' | 'paused' | 'stopped'>('active')
  const [steps, setSteps] = useState<AgentStep[]>([])
  const [proofs, setProofs] = useState<ProofEvent[]>([])
  const [accrued, setAccrued] = useState(0)
  const [ratePerSec] = useState(1300)
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const saved = localStorage.getItem(`chat_${id}`)
      return saved ? JSON.parse(saved) : []
    } catch { return [] }
  })
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatBottomRef = useRef<HTMLDivElement>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const isValidSession = !!id && id !== 'new'

  useEffect(() => {
    if (!isValidSession) {
      router.replace('/marketplace')
    }
  }, [isValidSession, router])

  useEffect(() => {
    if (!isValidSession || status !== 'active') return
    const interval = setInterval(() => {
      setAccrued(prev => prev + ratePerSec)
    }, 1000)
    return () => clearInterval(interval)
  }, [isValidSession, status, ratePerSec])

  useEffect(() => {
    if (!isValidSession) return
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
    const connect = () => {
      const es = new EventSource(`${apiBase}/api/sessions/${id}/stream`)
      eventSourceRef.current = es

      es.addEventListener('step', (e) => {
        const step = JSON.parse(e.data)
        setSteps(prev => [...prev.slice(-50), step])
      })

      es.addEventListener('proof', (e) => {
        const proof = JSON.parse(e.data)
        setProofs(prev => [...prev.slice(-20), proof])
      })

      es.addEventListener('status', (e) => {
        const { status: newStatus } = JSON.parse(e.data)
        setStatus(newStatus)
      })

      es.addEventListener('earnings', (e) => {
        const { accrued: newAccrued } = JSON.parse(e.data)
        setAccrued(newAccrued)
      })

      es.onerror = () => {
        es.close()
        setTimeout(connect, 3000)
      }
    }

    connect()
    return () => eventSourceRef.current?.close()
  }, [id, isValidSession])

  useEffect(() => {
    if (isValidSession && chatHistory.length > 0) {
      localStorage.setItem(`chat_${id}`, JSON.stringify(chatHistory))
    }
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory])

  async function sendMessage() {
    const text = chatInput.trim()
    if (!text || chatLoading) return
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

    const userMsg: ChatMessage = { role: 'user', text }
    const nextHistory = [...chatHistory, userMsg]
    setChatHistory(nextHistory)
    setChatInput('')
    setChatLoading(true)

    try {
      const res = await fetch(`${apiBase}/api/sessions/${id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: nextHistory.slice(0, -1).map(m => ({
            role: m.role,
            parts: [{ text: m.text }],
          })),
        }),
      })
      const data = await res.json()
      setChatHistory(prev => [...prev, { role: 'model', text: data.reply || data.error || 'No response' }])
    } catch {
      setChatHistory(prev => [...prev, { role: 'model', text: 'Failed to reach AI.' }])
    } finally {
      setChatLoading(false)
    }
  }

  if (!isValidSession) {
    return null
  }

  return (
    <div className="max-w-[1920px] mx-auto px-24 pt-24 pb-32">
      {/* Header */}
      <div className="flex items-end justify-between border-b border-border-strong pb-8 mb-16">
        <div>
          <h1 className="text-[3rem] font-display italic leading-none mb-2">Live Session</h1>
          <p className="text-text-secondary text-lg font-mono">#{id}</p>
        </div>
        <div className="mb-2">
          <StreamStatusBadge status={status} />
        </div>
      </div>

      {/* MAGI Consensus Engine */}
      <MagiConsensusEngine />

      {/* Main grid */}
      <div className="grid grid-cols-12 gap-8 items-start">
        {/* Left: Salary + Cost */}
        <div className="col-span-3 space-y-8">
          <SalaryTicker accrued={accrued} ratePerSec={ratePerSec} status={status} />
          <CostBreakdown curatorRate={1000} platformFee={300} />
        </div>

        {/* Center: Agent Work */}
        <div className="col-span-6 h-full min-h-[40rem]">
          <AgentWorkTimeline steps={steps} />
        </div>

        {/* Right: Proof Timeline */}
        <div className="col-span-3 h-full max-h-[40rem]">
          <ProofHeartbeatTimeline proofs={proofs} />
        </div>
      </div>

      {/* Chat with Agent */}
      <div className="mt-16 border border-border-subtle bg-surface-elevated flex flex-col h-80">
        <p className="text-xs text-text-tertiary uppercase tracking-widest px-6 pt-4 pb-3 border-b border-border-subtle">
          Chat with Agent
        </p>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {chatHistory.length === 0 && (
            <p className="text-text-tertiary text-sm italic">Ask the agent anything about the current session...</p>
          )}
          {chatHistory.map((msg, i) => (
            <div key={`chat-${i}`} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] px-4 py-2 text-sm ${
                msg.role === 'user'
                  ? 'bg-accent text-white'
                  : 'bg-surface-dim text-text-primary'
              }`}>
                {msg.text}
              </div>
            </div>
          ))}
          {chatLoading && (
            <div className="flex justify-start">
              <div className="bg-surface-dim text-text-tertiary px-4 py-2 text-sm">Thinking...</div>
            </div>
          )}
          <div ref={chatBottomRef} />
        </div>
        <div className="flex gap-3 p-4 border-t border-border-subtle">
          <input
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder="Ask the agent..."
            disabled={chatLoading}
            className="flex-1 bg-surface-dim border border-border-subtle px-4 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent outline-none disabled:opacity-50 transition-colors"
          />
          <button
            type="button"
            onClick={sendMessage}
            disabled={chatLoading || !chatInput.trim()}
            className="bg-text-primary text-surface font-bold px-6 py-2 text-xs uppercase tracking-widest hover:bg-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </div>

      {/* Settlement breakdown — shows when session ends */}
      {status === 'stopped' && (
        <div className="mt-16 border border-border-subtle bg-surface-elevated">
          <div className="border-b border-border-subtle p-6 bg-surface-dim">
            <h3 className="font-display font-bold text-2xl text-text-primary">Final Settlement</h3>
          </div>
          <div className="grid grid-cols-3 divide-x divide-border-subtle text-center">
            <div className="p-12">
              <div className="text-4xl font-display font-bold text-accent mb-2">${(accrued / 1_000_000).toFixed(4)}</div>
              <div className="text-text-secondary uppercase tracking-widest text-xs">Total Charged</div>
            </div>
            <div className="p-12">
              <div className="text-4xl font-display font-bold text-text-primary mb-2">${(accrued * 1000 / 1300 / 1_000_000).toFixed(4)}</div>
              <div className="text-text-secondary uppercase tracking-widest text-xs">Curator Payout</div>
            </div>
            <div className="p-12">
              <div className="text-4xl font-display font-bold text-text-primary mb-2">${(accrued * 300 / 1300 / 1_000_000).toFixed(4)}</div>
              <div className="text-text-secondary uppercase tracking-widest text-xs">Platform Fee</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
