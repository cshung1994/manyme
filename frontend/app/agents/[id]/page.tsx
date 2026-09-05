'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAccount, useSignMessage } from 'wagmi'
import {
  fetchAgent, createSession, rateAgent, fetchUserRating,
  fetchBalance, depositFunds, fetchAgentStats,
} from '@/lib/agents-api'
import { signAction } from '@/lib/sign-action'

interface Agent {
  id: string; name: string; description: string; category: string
  system_prompt: string; user_prompt_template: string | null
  model: string; temperature: number; max_tokens: number
  input_schema_json: string | null; rate_per_second: number
  run_count: number; avg_rating: number | null
  creator_wallet: string; created_at: string
}

interface InputField { name: string; type: string; required: boolean }

function parseInputSchema(schemaJson: string | null): InputField[] {
  if (!schemaJson) return []
  try {
    const schema = JSON.parse(schemaJson)
    const props = schema.properties || {}
    const required: string[] = schema.required || []
    return Object.entries(props).map(([name, def]: [string, any]) => ({
      name, type: def.type === 'number' ? 'number' : 'text', required: required.includes(name),
    }))
  } catch { return [] }
}

function formatRate(microPerSec: number): string {
  if (microPerSec === 0) return 'Free'
  return `$${(microPerSec / 1_000_000).toFixed(4)}/sec`
}

export default function AgentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { address } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const router = useRouter()
  const [agent, setAgent] = useState<Agent | null>(null)
  const [inputs, setInputs] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [balance, setBalance] = useState<number | null>(null)
  const [userRating, setUserRating] = useState<number | null>(null)
  const [ratingHover, setRatingHover] = useState(0)
  const [showRating, setShowRating] = useState(false)
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    if (!id) return
    fetchAgent(id).then(a => { setAgent(a); setLoading(false) }).catch(() => { setError('Agent not found'); setLoading(false) })
  }, [id])

  useEffect(() => {
    if (!address) return
    fetchBalance(address).then(b => setBalance(b.balance)).catch(() => {})
    if (id) fetchUserRating(id, address).then(r => setUserRating(r)).catch(() => {})
  }, [address, id])

  const handleStartSession = async () => {
    if (!address || !agent) return
    setStarting(true)
    try {
      const auth = await signAction(signMessageAsync, address, 'create-session')
      const session = await createSession(agent.id, inputs, auth)
      const queryText = inputs._query || inputs.query || Object.values(inputs).join(' ')
      if (queryText) {
        sessionStorage.setItem(`session_query_${session.id}`, queryText)
      }
      router.push(`/sessions/${session.id}`)
    } catch (e: any) {
      setError(e.message || 'Failed to start session')
      setStarting(false)
    }
  }

  const handleRate = async (rating: number) => {
    if (!address || !id) return
    try {
      const auth = await signAction(signMessageAsync, address, 'rate-agent', id)
      const result = await rateAgent(id, rating, auth)
      setUserRating(rating)
      if (agent) setAgent({ ...agent, avg_rating: result.avg_rating })
    } catch {}
  }

  const handleDeposit = async () => {
    if (!address) return
    try {
      const auth = await signAction(signMessageAsync, address, 'deposit')
      const result = await depositFunds(10_000_000, auth)
      setBalance(result.balance)
    } catch {}
  }

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><p className="text-text-secondary font-display">Loading...</p></div>
  if (error || !agent) return <div className="min-h-screen bg-background flex items-center justify-center"><p className="text-red-400 font-display">{error || 'Agent not found'}</p></div>

  const fields = parseInputSchema(agent.input_schema_json)
  const hasFields = fields.length > 0

  return (
    <div className="min-h-screen bg-background text-text-primary">
      <div className="max-w-[1920px] mx-auto px-4 sm:px-8 lg:px-24 py-24">
        {/* Header */}
        <div className="mb-16">
          <div className="flex items-center gap-3 mb-6">
            <span className="px-3 py-1 text-xs uppercase tracking-widest font-bold bg-surface-dim text-text-tertiary border border-border-subtle">{agent.category}</span>
            <span className="text-text-secondary text-sm font-mono">{agent.run_count} runs</span>
          </div>
          <h1 className="font-display text-6xl font-bold mb-6 tracking-tight leading-none">{agent.name}</h1>
          <p className="text-text-secondary text-2xl mb-8 leading-relaxed max-w-3xl">{agent.description}</p>
          <div className="flex items-center gap-8 text-sm uppercase tracking-widest text-text-tertiary border-t border-border-subtle pt-6 max-w-3xl">
            <span className="text-accent font-bold text-base">{formatRate(agent.rate_per_second)}</span>
            <span>by {agent.creator_wallet.slice(0,6)}...{agent.creator_wallet.slice(-4)}</span>
            <span>{agent.model}</span>
            {agent.avg_rating && <span className="text-text-secondary">★ {agent.avg_rating.toFixed(1)}</span>}
          </div>
        </div>

        {/* Input Form */}
        <div className="border border-border-strong p-12 mb-12 bg-surface-elevated max-w-3xl">
          <h2 className="font-display text-3xl font-bold mb-8 italic">Session Inputs</h2>
          {hasFields ? fields.map(field => (
            <div key={field.name} className="mb-8">
              <label htmlFor={`field-${field.name}`} className="block text-xs uppercase tracking-widest font-bold text-text-secondary mb-3">{field.name}{field.required && <span className="text-accent ml-1">*</span>}</label>
              <input id={`field-${field.name}`} type={field.type} value={inputs[field.name] || ''} onChange={e => setInputs(prev => ({ ...prev, [field.name]: e.target.value }))}
                className="w-full px-4 py-3 bg-surface-dim border border-border-subtle text-text-primary text-sm focus:border-accent focus:outline-none transition-colors" />
            </div>
          )) : (
            <div className="mb-8">
              <label htmlFor="field-query" className="block text-xs uppercase tracking-widest font-bold text-text-secondary mb-3">Query</label>
              <textarea id="field-query" value={inputs._query || ''} onChange={e => setInputs({ _query: e.target.value })} rows={4}
                className="w-full px-4 py-3 bg-surface-dim border border-border-subtle text-text-primary text-sm focus:border-accent focus:outline-none resize-none transition-colors" placeholder="What would you like the agent to analyze?" />
            </div>
          )}

          <div className="flex items-center gap-6 mt-12 pt-8 border-t border-border-subtle">
            <button type="button" onClick={handleStartSession} disabled={!address || starting}
              className="px-8 py-3 bg-text-primary text-surface-elevated text-xs uppercase tracking-widest font-bold transition-colors hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed">
              {starting ? 'Starting...' : address ? 'Start Session' : 'Connect Wallet'}
            </button>
            {balance !== null && (
              <div className="flex items-center gap-2 text-sm text-text-secondary">
                <span className="font-mono">Balance: ${(balance / 1_000_000).toFixed(2)}</span>
                <button type="button" onClick={handleDeposit} className="text-accent hover:underline text-xs">+$10</button>
              </div>
            )}
          </div>
        </div>

        {/* Model Info */}
        <div className="border border-border-subtle p-8 text-sm text-text-secondary max-w-3xl bg-surface-dim">
          <div className="grid grid-cols-3 gap-8">
            <div><span className="text-xs uppercase tracking-widest text-text-tertiary mb-2 block">Model</span><span className="font-bold text-text-primary">{agent.model}</span></div>
            <div><span className="text-xs uppercase tracking-widest text-text-tertiary mb-2 block">Temperature</span><span className="font-bold text-text-primary">{agent.temperature}</span></div>
            <div><span className="text-xs uppercase tracking-widest text-text-tertiary mb-2 block">Max Tokens</span><span className="font-bold text-text-primary">{agent.max_tokens}</span></div>
          </div>
        </div>

        {/* Rating — only for connected wallets, collapsed by default */}
        {address && (
          <div className="mt-12 max-w-3xl">
            {showRating ? (
              <div className="border border-border-subtle bg-surface-elevated p-6 flex items-center gap-6">
                <span className="text-xs uppercase tracking-widest text-text-secondary font-bold">Rate this agent</span>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button key={star} type="button" onClick={() => handleRate(star)} onMouseEnter={() => setRatingHover(star)} onMouseLeave={() => setRatingHover(0)}
                      className={`text-2xl transition-colors ${(ratingHover || userRating || 0) >= star ? 'text-accent' : 'text-border-strong'}`}>★</button>
                  ))}
                </div>
                {userRating && <span className="text-xs uppercase tracking-widest text-text-tertiary">Your rating: {userRating}/5</span>}
                {!userRating && agent.avg_rating && <span className="text-xs uppercase tracking-widest text-text-tertiary">Avg: {agent.avg_rating.toFixed(1)}</span>}
                <button type="button" onClick={() => setShowRating(false)} className="ml-auto text-text-tertiary hover:text-text-primary text-sm transition-colors">&times;</button>
              </div>
            ) : (
              <button type="button" onClick={() => setShowRating(true)}
                className="text-xs uppercase tracking-widest text-text-tertiary hover:text-text-secondary transition-colors">
                {userRating ? `Your rating: ${'★'.repeat(userRating)}${'☆'.repeat(5 - userRating)}` : 'Rate this agent →'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
