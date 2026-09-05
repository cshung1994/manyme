'use client'
import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import { useAccount } from 'wagmi'
import { useRouter } from 'next/navigation'
import { useSignMessage } from 'wagmi'
import {
  fetchSkill, runSkill, runSkillStream, chatWithSkill,
  fetchSkillExecutions, deleteSkill, fetchBalance, depositFunds,
  rateSkill as rateSkillApi, fetchUserRating,
} from '@/lib/agents-api'
import { signAction } from '@/lib/sign-action'

interface Skill {
  id: string; name: string; description: string; category: string
  system_prompt: string; user_prompt_template: string | null
  model: string; temperature: number; max_tokens: number
  input_schema_json: string | null; price_per_run: number
  execution_mode: string; run_count: number; avg_rating: number | null
  creator_wallet: string; created_at: string
}

interface InputField { name: string; type: string; required: boolean }
interface ChatMsg { role: 'user' | 'model'; text: string }
interface Execution {
  id: string; user_wallet: string; status: string
  output_text: string | null; duration_ms: number | null
  tokens_used: number | null; created_at: string; error_message: string | null
}

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

function formatPrice(microUnits: number): string {
  if (microUnits === 0) return 'Free'
  return `$${(microUnits / 1_000_000).toFixed(4)}`
}

export default function SkillDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { address } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const router = useRouter()
  const [skill, setSkill] = useState<Skill | null>(null)
  const [inputs, setInputs] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [balance, setBalance] = useState<number | null>(null)
  const [depositing, setDepositing] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [userRating, setUserRating] = useState<number | null>(null)
  const [ratingHover, setRatingHover] = useState(0)
  const [executions, setExecutions] = useState<Execution[]>([])
  const [execTab, setExecTab] = useState<'all' | 'mine'>('all')

  // Chat state
  const [chatHistory, setChatHistory] = useState<ChatMsg[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chatStarted, setChatStarted] = useState(false)
  const [toolActivity, setToolActivity] = useState<string[]>([])
  const [toolCallCount, setToolCallCount] = useState(0)
  const [demoMode, setDemoMode] = useState(false)
  const chatBottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchSkill(id).then(setSkill).catch(e => setError(e.message)).finally(() => setLoading(false))
    fetchSkillExecutions(id, address?.toLowerCase()).then(setExecutions).catch(() => {})
  }, [id, address])

  useEffect(() => {
    if (address) {
      fetchBalance(address).then(b => setBalance(b.balance)).catch(() => {})
      fetchUserRating(id, address).then(setUserRating).catch(() => {})
    }
  }, [address, id])

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory, chatLoading])

  // Load chat from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const saved = localStorage.getItem(`skill_chat_${id}`)
      if (saved) {
        const parsed = JSON.parse(saved)
        setChatHistory(parsed)
        if (parsed.length > 0) setChatStarted(true)
      }
    } catch { /* localStorage parse error */ }
  }, [id])

  // Save chat to localStorage
  useEffect(() => {
    if (chatHistory.length > 0) {
      localStorage.setItem(`skill_chat_${id}`, JSON.stringify(chatHistory))
    }
  }, [chatHistory, id])

  const inputFields = skill ? parseInputSchema(skill.input_schema_json) : []
  const isOwner = skill && address && skill.creator_wallet.toLowerCase() === address.toLowerCase()

  const filteredExecutions = execTab === 'mine' && address
    ? executions.filter(e => e.user_wallet.toLowerCase() === address.toLowerCase())
    : executions

  const handleRate = async (rating: number) => {
    if (!address) return
    try {
      const auth = await signAction(signMessageAsync, address, 'rate-skill', id)
      const result = await rateSkillApi(id, rating, auth)
      setUserRating(rating)
      if (skill) setSkill({ ...skill, avg_rating: result.avg_rating })
    } catch (e: any) { setError(e.message) }
  }

  const handleDeposit = async () => {
    if (!address) return
    setDepositing(true)
    try {
      const auth = await signAction(signMessageAsync, address, 'deposit')
      const result = await depositFunds(5_000_000, auth)
      setBalance(result.balance)
    } catch (e: any) { setError(e.message) }
    finally { setDepositing(false) }
  }

  const confirmDelete = async () => {
    if (!address) return
    try {
      const auth = await signAction(signMessageAsync, address, 'delete-skill', id)
      await deleteSkill(id, auth)
      router.push('/skills')
    } catch (e: any) {
      setError(e.message)
      setIsDeleting(false)
    }
  }

  const handleClearChat = () => {
    setChatHistory([])
    setChatStarted(false)
    setToolActivity([])
    setToolCallCount(0)
    localStorage.removeItem(`skill_chat_${id}`)
  }

  // Send message in chat mode
  const sendMessage = async (overrideMessage?: string) => {
    const text = (overrideMessage || chatInput).trim()
    if (!text || chatLoading) return
    if (!overrideMessage) setChatInput('')

    const userMsg: ChatMsg = { role: 'user', text }
    setChatHistory(prev => [...prev, userMsg])
    setChatLoading(true)
    setError(null)

    try {
      // Use signed auth if wallet connected and not in demo mode
      const auth = (address && !demoMode)
        ? await signAction(signMessageAsync, address, 'run-skill', id)
        : undefined

      // Build Gemini-format history (exclude the message we're about to send)
      const geminiHistory = chatHistory.map(m => ({
        role: m.role,
        parts: [{ text: m.text }],
      }))

      const result = await chatWithSkill(id, text, geminiHistory, inputs, auth)

      if (result.toolCallCount > 0) {
        setToolCallCount(prev => prev + result.toolCallCount)
        setToolActivity(prev => [...prev, `${result.toolCallCount} RPC calls`])
      }

      setChatHistory(prev => [...prev, { role: 'model', text: result.reply }])
    } catch (e: any) {
      setError(e.message)
      setChatHistory(prev => [...prev, { role: 'model', text: `Error: ${e.message}` }])
    } finally {
      setChatLoading(false)
    }
  }

  // Start chat with initial inputs
  const handleStartChat = () => {
    setChatStarted(true)

    // Build initial message from inputs
    const parts: string[] = []
    if (inputFields.length > 0) {
      inputFields.forEach(f => {
        if (inputs[f.name]) parts.push(`${f.name}: ${inputs[f.name]}`)
      })
    } else if (inputs._query) {
      parts.push(inputs._query)
    }

    const initialMessage = parts.length > 0 ? parts.join('\n') : 'Start analysis'
    sendMessage(initialMessage)
  }

  if (loading) return <div className="min-h-screen bg-background text-text-primary p-24"><p className="text-text-secondary uppercase tracking-widest text-xs">Loading...</p></div>
  if (!skill) return <div className="min-h-screen bg-background text-text-primary p-24"><p className="text-error uppercase tracking-widest text-xs">Skill not found</p></div>

  const inputCls = 'w-full bg-surface-dim border border-border-subtle px-4 py-3 text-text-primary placeholder:text-text-tertiary focus:border-accent outline-none transition-colors'

  return (
    <div className="min-h-screen bg-background text-text-primary">
      <div className="max-w-[1920px] mx-auto px-24 pt-24 pb-32">
        {/* Header */}
        <div className="mb-16 border-b border-border-strong pb-8">
          <div className="flex items-center gap-4 mb-4">
            <span className="text-xs text-accent border border-accent/30 bg-accent/5 px-2 py-1 uppercase tracking-widest">
              {skill.category}
            </span>
            <span className="text-xs bg-surface-dim border border-border-subtle text-text-secondary px-2 py-1 uppercase tracking-widest">Chat Mode</span>
            <span className="text-xs text-text-tertiary uppercase tracking-widest">{skill.run_count} runs</span>
            {skill.avg_rating && <span className="text-xs text-text-secondary uppercase tracking-widest">{'★'} {skill.avg_rating.toFixed(1)}</span>}
          </div>
          <h1 className="text-[4rem] font-display font-bold leading-none mb-4">{skill.name}</h1>
          <p className="font-display italic text-2xl text-text-secondary mb-6">{skill.description}</p>
          <div className="flex items-center gap-4 text-xs uppercase tracking-widest text-text-tertiary">
            <p>
              By {skill.creator_wallet.slice(0, 6)}...{skill.creator_wallet.slice(-4)} · {skill.model} · {formatPrice(skill.price_per_run)}/msg
            </p>
            {isOwner && (
              isDeleting ? (
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-text-secondary">Delete this skill?</span>
                  <button type="button" onClick={confirmDelete} className="text-error font-bold uppercase tracking-widest">Confirm</button>
                  <button type="button" onClick={() => setIsDeleting(false)} className="text-text-tertiary uppercase tracking-widest">Cancel</button>
                </div>
              ) : (
                <button type="button" onClick={() => setIsDeleting(true)}
                  className="text-error hover:opacity-80 border border-error/30 px-3 py-1 transition-colors">
                  Delete Skill
                </button>
              )
            )}
          </div>
        </div>

        {error && (
          <div className="flex items-center justify-between border border-error/30 bg-error/5 px-6 py-3 mb-8">
            <p className="text-error text-sm">{error}</p>
            <button type="button" onClick={() => setError(null)} className="text-error hover:text-text-primary text-sm transition-colors">&times;</button>
          </div>
        )}

        <div className="max-w-3xl mx-auto">
          {/* Main area */}
          {!chatStarted ? (
            /* ── Pre-chat: Input form ── */
            <div className="border border-border-subtle bg-surface-elevated p-8 mb-12">
              <h2 className="text-xs uppercase tracking-widest text-text-secondary mb-2">Start a conversation</h2>
              <p className="font-display text-lg text-text-secondary mb-8">Fill in the parameters below to begin. You can ask follow-up questions after the initial analysis.</p>

              {inputFields.length > 0 ? (
                <div className="space-y-6">
                  {inputFields.map(field => (
                    <div key={field.name}>
                      <label htmlFor={`input-${field.name}`} className="block text-xs uppercase tracking-widest text-text-secondary mb-3">
                        {field.name} {field.required && <span className="text-accent">*</span>}
                      </label>
                      <input id={`input-${field.name}`} type={field.type} value={inputs[field.name] || ''}
                        onChange={e => setInputs(prev => ({ ...prev, [field.name]: e.target.value }))}
                        placeholder={`Enter ${field.name}`} required={field.required} className={inputCls}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div>
                  <label htmlFor="input-query" className="block text-xs uppercase tracking-widest text-text-secondary mb-3">Query</label>
                  <textarea id="input-query" value={inputs._query || ''}
                    onChange={e => setInputs(prev => ({ ...prev, _query: e.target.value }))}
                    placeholder="Enter your query..."
                    rows={3} className={`${inputCls} resize-none`}
                  />
                </div>
              )}



              {/* Mode toggle */}
              <div className="mt-8 flex items-center justify-between border-t border-border-subtle pt-6">
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => setDemoMode(false)}
                    className={`text-xs px-4 py-2 uppercase tracking-widest border transition-colors ${
                      !demoMode ? 'bg-accent/5 text-accent border-accent/30' : 'text-text-tertiary border-border-subtle hover:border-border-strong'
                    }`}>
                    Wallet Mode
                  </button>
                  <button
                    type="button"
                    onClick={() => setDemoMode(true)}
                    className={`text-xs px-4 py-2 uppercase tracking-widest border transition-colors ${
                      demoMode ? 'bg-accent/5 text-accent border-accent/30' : 'text-text-tertiary border-border-subtle hover:border-border-strong'
                    }`}>
                    Demo Mode
                  </button>
                </div>
                {!demoMode && !address && <span className="text-xs uppercase tracking-widest text-text-tertiary">Connect wallet to use</span>}
              </div>

              <button type="button" onClick={handleStartChat}
                disabled={!demoMode && !address}
                className="w-full mt-8 bg-text-primary text-surface-elevated font-bold py-4 uppercase tracking-widest hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed">
                {demoMode ? 'Start Conversation (Demo) →' : !address ? 'Connect Wallet First' : 'Start Conversation →'}
              </button>

              {/* Balance info */}
              {!demoMode && address && (
                <div className="mt-6 flex items-center justify-between text-xs uppercase tracking-widest text-text-tertiary border-t border-border-subtle pt-4">
                  <span>
                    Platform balance:
                    <span className="text-accent ml-2 font-mono">
                      {balance !== null ? `$${(balance / 1_000_000).toFixed(4)}` : '...'}
                    </span>
                  </span>
                  <button type="button" onClick={handleDeposit} disabled={depositing}
                    className="text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50">
                    {depositing ? 'Depositing...' : '+ Deposit'}
                  </button>
                </div>
              )}
              {demoMode && (
                <p className="mt-6 text-xs uppercase tracking-widest text-text-tertiary border-t border-border-subtle pt-4">Demo mode: no wallet or payment required, free to test.</p>
              )}
            </div>
          ) : (
            /* ── Chat interface ── */
            <div className="border border-border-subtle bg-surface-elevated flex flex-col h-[calc(100vh-280px)]">
              {/* Chat header */}
              <div className="flex items-center justify-between border-b border-border-subtle px-6 pt-4 pb-3">
                <span className={`text-xs uppercase tracking-widest px-2 py-1 border ${demoMode ? 'bg-warning/10 text-warning border-warning/30' : 'bg-accent/10 text-accent border-accent/30'}`}>
                  {demoMode ? 'Demo Mode' : `${address?.slice(0, 6)}...${address?.slice(-4)}`}
                </span>
                <button type="button" onClick={handleClearChat} className="text-xs uppercase tracking-widest text-text-tertiary hover:text-text-primary transition-colors">
                  New Chat
                </button>
              </div>
              {/* Chat messages */}
              <div className="flex-1 overflow-y-auto bg-background p-6 space-y-4" role="log" aria-live="polite">
                {chatHistory.map((msg, i) => (
                  <div key={`msg-${i}-${msg.role}`} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] px-5 py-3 text-sm border ${
                      msg.role === 'user'
                        ? 'bg-accent text-white border-accent'
                        : 'bg-surface-dim text-text-primary border-border-subtle'
                    }`}>
                      <div className="whitespace-pre-wrap leading-relaxed font-sans">{msg.text}</div>
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex justify-start">
                    <div role="status" aria-label="Loading response" className="bg-surface-dim text-text-tertiary border border-border-subtle px-5 py-3 text-sm uppercase tracking-widest">
                      <span className="flex items-center gap-3">
                        <span className="w-4 h-4 border-2 border-border-strong border-t-accent animate-spin" />
                        Thinking...
                      </span>
                    </div>
                  </div>
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* Tool activity bar */}
              {toolActivity.length > 0 && (
                <div className="bg-surface-dim border-y border-border-subtle px-6 py-3">
                  <div className="flex items-center gap-4 text-xs uppercase tracking-widest text-text-tertiary">
                    <span>Tools: {toolCallCount} calls</span>
                    <div className="flex flex-wrap gap-2">
                      {toolActivity.slice(-5).map((a, i) => (
                        <span key={i} className="bg-background border border-border-subtle text-text-secondary px-2 py-1">{a}</span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Chat input */}
              <div className="bg-surface-elevated border-t border-border-subtle p-6">
                <div className="flex gap-4">
                  <input
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                    placeholder="Ask a follow-up question..."
                    className="flex-1 bg-surface-dim border border-border-subtle px-4 py-3 text-text-primary placeholder:text-text-tertiary focus:border-accent outline-none text-sm font-sans transition-colors"
                    disabled={chatLoading}
                  />
                  <button
                    onClick={() => sendMessage()}
                    disabled={chatLoading || !chatInput.trim()}
                    className="bg-text-primary text-surface-elevated font-bold uppercase tracking-widest px-8 hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Send
                  </button>
                  <button
                    onClick={handleClearChat}
                    className="text-xs uppercase tracking-widest text-text-tertiary hover:text-text-primary border border-border-strong px-4 transition-colors"
                    title="Clear chat and start over"
                  >
                    Clear
                  </button>
                </div>

                <div className="flex items-center justify-between mt-4 text-xs uppercase tracking-widest text-text-tertiary">
                  <span>
                    Balance: <span className="text-accent font-mono ml-2">{balance !== null ? `$${(balance / 1_000_000).toFixed(4)}` : '...'}</span>
                  </span>
                  <span>{chatHistory.filter(m => m.role === 'model').length} responses</span>
                </div>
              </div>
            </div>
          )}

          {/* Rating */}
          {address && chatHistory.length > 0 && (
            <div className="mt-8 border border-border-subtle bg-surface-elevated p-6 flex items-center gap-6">
              <span className="text-xs uppercase tracking-widest text-text-secondary">Rate this skill:</span>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(star => (
                  <button key={star} onClick={() => handleRate(star)}
                    onMouseEnter={() => setRatingHover(star)} onMouseLeave={() => setRatingHover(0)}
                    className="text-2xl transition-colors">
                    <span className={(ratingHover || userRating || 0) >= star ? 'text-accent' : 'text-border-strong'}>{'★'}</span>
                  </button>
                ))}
              </div>
              {userRating && <span className="text-xs uppercase tracking-widest text-text-tertiary ml-auto">Your rating: {userRating}/5</span>}
              {!userRating && skill.avg_rating && <span className="text-xs uppercase tracking-widest text-text-tertiary ml-auto">Avg: {skill.avg_rating.toFixed(1)}</span>}
            </div>
          )}

          {/* Recent Executions */}
          {executions.length > 0 && (
            <div className="mt-16">
              <div className="flex items-center justify-between mb-6 border-b border-border-subtle pb-4">
                <h2 className="text-2xl font-display font-bold">Recent Executions</h2>
                <div className="flex gap-4">
                  <button onClick={() => setExecTab('all')}
                    className={`text-xs uppercase tracking-widest px-3 py-1 border transition-colors ${
                      execTab === 'all' ? 'bg-accent/5 text-accent border-accent/30' : 'text-text-tertiary border-border-subtle hover:text-text-primary hover:border-border-strong'}`}>
                    All ({executions.length})
                  </button>
                  {address && (
                    <button onClick={() => setExecTab('mine')}
                      className={`text-xs uppercase tracking-widest px-3 py-1 border transition-colors ${
                        execTab === 'mine' ? 'bg-accent/5 text-accent border-accent/30' : 'text-text-tertiary border-border-subtle hover:text-text-primary hover:border-border-strong'}`}>
                      Mine ({executions.filter(e => e.user_wallet.toLowerCase() === address.toLowerCase()).length})
                    </button>
                  )}
                </div>
              </div>
              <div className="space-y-4">
                {filteredExecutions.slice(0, 10).map(exec => (
                  <div key={exec.id} className="bg-surface-elevated border border-border-subtle p-6 flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs uppercase tracking-widest px-2 py-1 border ${
                        exec.status === 'completed' ? 'bg-success/10 text-success border-success/30' :
                        exec.status === 'failed' ? 'bg-error/10 text-error border-error/30' :
                        'bg-warning/10 text-warning border-warning/30'}`}>
                        {exec.status}
                      </span>
                      <div className="flex gap-4 text-xs font-mono text-text-tertiary">
                        <span>{exec.user_wallet.slice(0, 6)}...{exec.user_wallet.slice(-4)}</span>
                        <span>{new Date(exec.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 border-t border-border-subtle pt-4">
                      <p className="text-sm text-text-secondary font-sans line-clamp-3">
                        {exec.output_text || exec.error_message || 'No output'}
                      </p>
                      <div className="flex gap-6 text-xs uppercase tracking-widest text-text-tertiary mt-4">
                        {exec.duration_ms && <span>Time: {exec.duration_ms}ms</span>}
                        {exec.tokens_used && <span>Tokens: {exec.tokens_used}</span>}
                      </div>
                    </div>
                  </div>
                ))}
                {filteredExecutions.length === 0 && (
                  <div className="bg-surface-dim border border-border-subtle p-8 text-center">
                    <p className="text-sm uppercase tracking-widest text-text-tertiary">No executions yet</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
