'use client'
import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAccount, useSignMessage } from 'wagmi'
import { signAction } from '@/lib/sign-action'
import { chatInSession, stopSession, rateAgent } from '@/lib/agents-api'

import SalaryTicker from '@/components/session/SalaryTicker'
import ProofHeartbeatTimeline from '@/components/session/ProofHeartbeatTimeline'
import AgentWorkTimeline from '@/components/session/AgentWorkTimeline'
import StreamStatusBadge from '@/components/session/StreamStatusBadge'
import CostBreakdown from '@/components/session/CostBreakdown'
import MagiConsensusEngine from '@/components/session/MagiConsensusEngine'

interface ChatMessage {
  id: string
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
  const { address } = useAccount()
  const { signMessageAsync } = useSignMessage()

  const [status, setStatus] = useState<'active' | 'paused' | 'stopped'>('active')
  const [steps, setSteps] = useState<AgentStep[]>([])
  const [proofs, setProofs] = useState<ProofEvent[]>([])
  const [accrued, setAccrued] = useState(0)
  const [ratePerSec, setRatePerSec] = useState(0)
  const [curatorRate, setCuratorRate] = useState(0)
  const [platformFee, setPlatformFee] = useState(0)
  
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const saved = localStorage.getItem(`chat_${id}`)
      if (!saved) return []
      return JSON.parse(saved).map((m: any) => ({
        ...m,
        id: m.id || crypto.randomUUID()
      }))
    } catch { return [] }
  })
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [isActionLoading, setIsActionLoading] = useState(false)
  const [showReview, setShowReview] = useState(false)
  const [agentId, setAgentId] = useState<string | null>(null)
  const [reviewRating, setReviewRating] = useState(0)
  const [ratingHover, setRatingHover] = useState(0)
  const [ratingSubmitted, setRatingSubmitted] = useState(false)
  const sessionStartRef = useRef(Date.now())
  
  const [toolCallCount, setToolCallCount] = useState(0)
  interface ToolActivityItem {
    id: string
    name: string
  }
  const [toolActivity, setToolActivity] = useState<ToolActivityItem[]>([])

  const chatBottomRef = useRef<HTMLDivElement>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const initialQuerySentRef = useRef(false)
  const isValidSession = !!id && id !== 'new'

  useEffect(() => {
    if (!isValidSession) {
      router.replace('/marketplace')
      return
    }

    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
    fetch(`${apiBase}/api/sessions/${id}`)
      .then(r => r.json())
      .then((session: any) => {
        if (session.total_rate) setRatePerSec(session.total_rate)
        if (session.curator_rate) setCuratorRate(session.curator_rate)
        if (session.platform_fee) setPlatformFee(session.platform_fee)
        if (session.agent_id) setAgentId(session.agent_id)
        if (session.status && ['active', 'paused', 'stopped'].includes(session.status)) {
          setStatus(session.status)
        }
        if (session.started_at) {
          sessionStartRef.current = new Date(session.started_at).getTime()
        }
      })
      .catch(() => {})
  }, [isValidSession, id, router])

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

      es.addEventListener('connected', () => {
        if (initialQuerySentRef.current) return
        const storageKey = `session_query_${id}`
        const initialQuery = sessionStorage.getItem(storageKey)
        if (!initialQuery) return
        initialQuerySentRef.current = true
        sessionStorage.removeItem(storageKey)

        setChatHistory(prev => {
          if (prev.some(m => m.role === 'user')) return prev
          return [{ id: crypto.randomUUID(), role: 'user', text: initialQuery }]
        })
        setChatLoading(true)

        chatInSession(id, initialQuery, [])
          .then(({ reply, toolCallCount: tc }) => {
            setChatHistory(prev => [...prev, { id: crypto.randomUUID(), role: 'model', text: reply }])
            if (tc) setToolCallCount(prev => prev + tc)
          })
          .catch((err) => {
            setChatHistory(prev => [...prev, { id: crypto.randomUUID(), role: 'model', text: `Error: ${err.message}` }])
          })
          .finally(() => setChatLoading(false))
      })

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

      es.addEventListener('chunk', (e) => {
        const { chunk } = JSON.parse(e.data)
        setChatHistory(prev => {
          const next = [...prev]
          if (next.length > 0 && next[next.length - 1].role === 'model') {
            next[next.length - 1].text += chunk
          } else {
            next.push({ id: crypto.randomUUID(), role: 'model', text: chunk })
          }
          return next
        })
        setChatLoading(false)
      })

      es.addEventListener('tool_use', (e) => {
        const tool = JSON.parse(e.data)
        setToolActivity(prev => [...prev.slice(-9), { id: crypto.randomUUID(), name: tool.name }])
        setToolCallCount(prev => prev + 1)
      })

      es.addEventListener('tool_result', () => {})

      es.addEventListener('complete', () => {
        setChatLoading(false)
      })

      es.addEventListener('error', (e) => {
        // Custom SSE 'error' events carry data; the native EventSource error does not
        const data = (e as MessageEvent).data
        if (!data) return
        const { error } = JSON.parse(data)
        setChatHistory(prev => [...prev, { id: crypto.randomUUID(), role: 'model', text: `Error: ${error}` }])
        setChatLoading(false)
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
  }, [chatHistory, id, isValidSession])

  const handleStop = async () => {
    if (!address) return
    setIsActionLoading(true)
    try {
      const auth = await signAction(signMessageAsync, address, 'stop-session', id)
      await stopSession(id, auth)
      setStatus('stopped')
      eventSourceRef.current?.close()
      setShowReview(true)
    } catch (e: any) {
      alert(`Failed to stop: ${e.message}`)
    } finally {
      setIsActionLoading(false)
    }
  }

  const sessionDuration = () => {
    const secs = Math.floor((Date.now() - sessionStartRef.current) / 1000)
    const m = Math.floor(secs / 60)
    const s = secs % 60
    if (m === 0) return `${s}s`
    return `${m}m ${s}s`
  }

  const handleRateAgent = async (stars: number) => {
    if (!address || !agentId) return
    setReviewRating(stars)
    try {
      const auth = await signAction(signMessageAsync, address, 'rate-agent', agentId)
      await rateAgent(agentId, stars, auth)
      setRatingSubmitted(true)
    } catch {
      setReviewRating(0)
    }
  }

  async function sendMessage() {
    const text = chatInput.trim()
    if (!text || chatLoading) return

    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', text }
    const nextHistory = [...chatHistory, userMsg]
    setChatHistory(nextHistory)
    setChatInput('')
    setChatLoading(true)

    try {
      const geminiHistory = nextHistory.slice(0, -1).map(m => ({
        role: m.role,
        parts: [{ text: m.text }],
      }))
      
      const { reply, toolCallCount: newToolCount } = await chatInSession(id, text, geminiHistory)
      
      setChatHistory(prev => {
        const next = [...prev]
        if (next.length > 0 && next[next.length - 1].role === 'model') {
          next[next.length - 1].text = reply || next[next.length - 1].text
        } else if (reply) {
          next.push({ id: crypto.randomUUID(), role: 'model', text: reply })
        }
        return next
      })
      
      if (newToolCount) {
        setToolCallCount(prev => prev + newToolCount)
      }
    } catch (e: any) {
      setChatHistory(prev => [...prev, { id: crypto.randomUUID(), role: 'model', text: `Failed to reach AI: ${e.message}` }])
    } finally {
      setChatLoading(false)
    }
  }

  if (!isValidSession) {
    return null
  }

  return (
    <div className="max-w-[1920px] mx-auto px-24 pt-24 pb-32">
      <div className="flex items-end justify-between border-b border-border-strong pb-8 mb-16">
        <div>
          <h1 className="text-[3rem] font-display italic leading-none mb-2">Live Session</h1>
          <p className="text-text-secondary text-lg font-mono">#{id}</p>
        </div>
        <StreamStatusBadge status={status} />
      </div>

      <MagiConsensusEngine />

      <div className="grid grid-cols-12 gap-8 items-start">
        <div className="col-span-3 space-y-8">
          <SalaryTicker accrued={accrued} ratePerSec={ratePerSec} status={status} />
          <CostBreakdown curatorRate={curatorRate} platformFee={platformFee} />
        </div>

        <div className="col-span-6 h-full min-h-[40rem]">
          <AgentWorkTimeline steps={steps} />
        </div>

        <div className="col-span-3 h-full max-h-[40rem]">
          <ProofHeartbeatTimeline proofs={proofs} />
        </div>
      </div>

      <div className="mt-16 border border-border-subtle bg-surface-elevated flex flex-col h-[36rem] overflow-hidden shadow-2xl shadow-black/5">
        <div className="flex items-center justify-between px-6 pt-4 pb-3 border-b border-border-subtle bg-surface">
          <p className="text-xs text-text-tertiary uppercase tracking-widest font-bold">
            Chat with Agent
          </p>
          <button type="button" onClick={() => setChatHistory([])} className="text-xs uppercase tracking-widest font-bold text-text-tertiary hover:text-text-primary transition-colors">
            Clear Chat
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto px-6 py-8 space-y-6 bg-surface-elevated">
          {chatHistory.length === 0 && (
            <p className="text-text-tertiary text-sm italic font-display text-center py-12">Ask the agent anything about the current session...</p>
          )}
          {chatHistory.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] px-6 py-4 text-sm ${
                msg.role === 'user'
                  ? 'bg-surface-dim text-text-primary border border-border-strong font-medium'
                  : 'bg-surface text-text-secondary border border-border-subtle'
              }`}>
                <div className="whitespace-pre-wrap leading-relaxed">{msg.text}</div>
              </div>
            </div>
          ))}
          {chatLoading && (
            <div className="flex justify-start">
              <div className="bg-surface text-text-tertiary border border-border-subtle px-6 py-4 text-sm">
                <span className="flex items-center gap-3 font-medium uppercase tracking-widest text-[10px]">
                  <span className="w-3 h-3 border-2 border-border-strong border-t-accent animate-spin" />
                  Thinking...
                </span>
              </div>
            </div>
          )}
          <div ref={chatBottomRef} />
        </div>
        
        {toolActivity.length > 0 && (
          <div className="bg-surface-dim border-t border-border-subtle px-6 py-3">
            <div className="flex items-center gap-3 text-xs uppercase tracking-widest font-bold text-text-secondary">
              <span>Tools: {toolCallCount} calls</span>
              <div className="flex flex-wrap gap-2">
                {toolActivity.slice(-5).map((a) => (
                  <span key={a.id} className="bg-surface-elevated border border-border-subtle text-text-secondary px-2 py-1 uppercase tracking-widest text-[10px]">{a.name}</span>
                ))}
              </div>
            </div>
          </div>
        )}
        
        <div className="flex gap-4 p-6 border-t border-border-subtle bg-surface">
          {status !== 'stopped' && (
            <button
              type="button"
              onClick={handleStop}
              disabled={!address || isActionLoading}
              className="px-6 py-4 text-xs uppercase tracking-widest font-bold border border-red-900/50 text-red-500 hover:bg-red-900/10 transition-colors disabled:opacity-50"
            >
              {isActionLoading ? 'Stopping...' : 'End Session'}
            </button>
          )}
          <input
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => { if(e.key === 'Enter' && !e.shiftKey) sendMessage() }}
            placeholder={status === 'stopped' ? 'Session ended' : 'Ask the agent...'}
            disabled={chatLoading || status === 'stopped'}
            className="flex-1 bg-surface-elevated border border-border-subtle px-6 py-4 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent outline-none disabled:opacity-50 transition-colors"
          />
          <button
            type="button"
            onClick={sendMessage}
            disabled={chatLoading || !chatInput.trim() || status === 'stopped'}
            className="bg-text-primary text-surface-elevated font-bold px-8 py-4 text-xs uppercase tracking-widest transition-colors hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </div>

      {showReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-surface-elevated border border-border-strong w-full max-w-2xl mx-4 shadow-2xl shadow-black/10">
            <div className="border-b border-border-subtle p-8 bg-surface-dim flex items-center justify-between">
              <div>
                <h3 className="font-display font-bold text-3xl text-text-primary italic">Session Complete</h3>
                <p className="text-text-tertiary text-xs font-mono mt-2">#{id?.slice(0, 8)}</p>
              </div>
              <span className="text-xs uppercase tracking-widest font-bold px-3 py-1 border border-border-strong text-text-tertiary">Settled</span>
            </div>

            <div className="grid grid-cols-3 divide-x divide-border-subtle text-center border-b border-border-subtle">
              <div className="p-8">
                <div className="text-3xl font-display font-bold text-accent mb-1">${(accrued / 1_000_000).toFixed(4)}</div>
                <div className="text-text-tertiary uppercase tracking-widest text-[10px] font-bold">Total Cost</div>
              </div>
              <div className="p-8">
                <div className="text-3xl font-display font-bold text-text-primary mb-1">{sessionDuration()}</div>
                <div className="text-text-tertiary uppercase tracking-widest text-[10px] font-bold">Duration</div>
              </div>
              <div className="p-8">
                <div className="text-3xl font-display font-bold text-text-primary mb-1">{proofs.length}</div>
                <div className="text-text-tertiary uppercase tracking-widest text-[10px] font-bold">Proofs</div>
              </div>
            </div>

            <div className="p-8 border-b border-border-subtle">
              <p className="text-xs uppercase tracking-widest font-bold text-text-tertiary mb-4">Settlement Breakdown</p>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-secondary">Curator Payout</span>
                  <span className="text-text-primary font-bold">${(ratePerSec > 0 ? accrued * curatorRate / ratePerSec / 1_000_000 : 0).toFixed(4)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Platform Fee</span>
                  <span className="text-text-primary font-bold">${(ratePerSec > 0 ? accrued * platformFee / ratePerSec / 1_000_000 : 0).toFixed(4)}</span>
                </div>
              </div>
            </div>

            <div className="p-8 border-b border-border-subtle">
              <p className="text-xs uppercase tracking-widest font-bold text-text-tertiary mb-4">Session Activity</p>
              <div className="grid grid-cols-3 gap-6 text-sm">
                <div>
                  <span className="text-2xl font-display font-bold text-text-primary">{chatHistory.filter(m => m.role === 'user').length}</span>
                  <span className="text-text-tertiary text-xs block mt-1">Messages Sent</span>
                </div>
                <div>
                  <span className="text-2xl font-display font-bold text-text-primary">{chatHistory.filter(m => m.role === 'model').length}</span>
                  <span className="text-text-tertiary text-xs block mt-1">Agent Replies</span>
                </div>
                <div>
                  <span className="text-2xl font-display font-bold text-text-primary">{steps.length}</span>
                  <span className="text-text-tertiary text-xs block mt-1">Work Steps</span>
                </div>
              </div>
            </div>

            {address && agentId && (
              <div className="p-8 border-b border-border-subtle">
                <p className="text-xs uppercase tracking-widest font-bold text-text-tertiary mb-5">Rate This Agent</p>
                {ratingSubmitted ? (
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map(star => (
                        <span key={star} className={`text-2xl ${star <= reviewRating ? 'text-accent' : 'text-border-strong'}`}>★</span>
                      ))}
                    </div>
                    <span className="text-xs uppercase tracking-widest text-text-tertiary">Submitted — thank you</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map(star => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => handleRateAgent(star)}
                          onMouseEnter={() => setRatingHover(star)}
                          onMouseLeave={() => setRatingHover(0)}
                          className="text-2xl transition-colors"
                        >
                          <span className={(ratingHover || reviewRating) >= star ? 'text-accent' : 'text-border-strong'}>★</span>
                        </button>
                      ))}
                    </div>
                    <span className="text-xs text-text-tertiary">Click to rate</span>
                  </div>
                )}
              </div>
            )}

            <div className="p-8 flex items-center justify-between">
              <button
                type="button"
                onClick={() => router.push('/sessions')}
                className="text-xs uppercase tracking-widest font-bold text-text-tertiary hover:text-text-primary transition-colors"
              >
                View All Sessions &rarr;
              </button>
              <button
                type="button"
                onClick={() => setShowReview(false)}
                className="bg-text-primary text-surface-elevated font-bold px-8 py-3 text-xs uppercase tracking-widest transition-colors hover:bg-accent"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
