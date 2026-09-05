'use client'
import { useState, useEffect } from 'react'
import { useWalletClient } from 'wagmi'
import { fetchAgents } from '@/lib/api'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
// Mirrors the backend X402_MOCK flag: set NEXT_PUBLIC_X402_MOCK=false for real payments
const X402_MOCK = process.env.NEXT_PUBLIC_X402_MOCK !== 'false'

const QUERY_TYPES = [
  { id: 'summary', label: 'Analysis Summary', price: '$0.001', description: 'Brief overview of recent analysis' },
  { id: 'ask', label: 'Ask a Question', price: '$0.003', description: 'Ask the agent a specific question' },
  { id: 'evidence', label: 'Full Evidence', price: '$0.005', description: 'Complete proof package with all data' },
]

export default function QueryPage() {
  const { data: walletClient } = useWalletClient()
  const [agents, setAgents] = useState<any[]>([])
  const [loadingAgents, setLoadingAgents] = useState(true)
  const [selectedAgent, setSelectedAgent] = useState<string>('')
  const [queryType, setQueryType] = useState('summary')
  const [question, setQuestion] = useState('')
  const [state, setState] = useState<'idle' | 'requires-payment' | 'paying' | 'paid' | 'error'>('idle')
  const [result, setResult] = useState<any>(null)
  const [paymentInfo, setPaymentInfo] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchAgents().then(list => {
      setAgents(list)
      if (list.length > 0) setSelectedAgent(list[0].id)
    }).catch((e: any) => setError(e.message || 'Failed to fetch agents')).finally(() => setLoadingAgents(false))
  }, [])

  const handleQuery = async () => {
    if (!selectedAgent) return
    setState('requires-payment')
    
    const url = `${API_BASE}/queries/agent/${selectedAgent}/${queryType}`
    const res = await fetch(url, {
      method: queryType === 'ask' ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: queryType === 'ask' ? JSON.stringify({ question }) : undefined,
    })
    
    if (res.status === 402) {
      const data = await res.json()
      setPaymentInfo(data)
      setState('requires-payment')
    } else if (res.ok) {
      setResult(await res.json())
      setState('paid')
    }
  }

  const handlePay = async () => {
    setState('paying')

    const url = `${API_BASE}/queries/agent/${selectedAgent}/${queryType}`
    const init: RequestInit = {
      method: queryType === 'ask' ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: queryType === 'ask' ? JSON.stringify({ question }) : undefined,
    }

    try {
      let res: Response
      if (!X402_MOCK && walletClient?.account) {
        // Real x402: sign an EIP-3009 USDC authorization and retry with X-Payment
        const [{ wrapFetchWithPaymentFromConfig }, { ExactEvmScheme }] = await Promise.all([
          import('@x402/fetch'),
          import('@x402/evm/exact/client'),
        ])
        const account = walletClient.account
        const signer = {
          address: account.address,
          signTypedData: (msg: any) => walletClient.signTypedData({ ...msg, account }),
        }
        const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
          schemes: [{ network: 'eip155:84532', client: new ExactEvmScheme(signer) }],
        })
        res = await fetchWithPayment(url, init)
      } else {
        await new Promise(r => setTimeout(r, 1500))
        res = await fetch(url, {
          ...init,
          headers: { ...init.headers, 'X-Payment': `mock-payment-${Date.now()}` },
        })
      }

      if (res.ok) {
        setResult(await res.json())
        setState('paid')
      } else {
        setState('error')
      }
    } catch {
      setState('error')
    }
  }

  const selectedQueryType = QUERY_TYPES.find(q => q.id === queryType)!

  return (
    <div className="max-w-[1920px] mx-auto px-24 pt-24 pb-32">
      <div className="max-w-3xl mx-auto">
        <h1 className="font-display font-bold text-[5rem] leading-none mb-6">Spot Query</h1>
        <p className="font-display italic text-2xl text-text-secondary mb-16">Single-request agents. Pay per query. No subscriptions.</p>

        {error && (
          <div className="flex items-center justify-between border border-error/30 bg-error/5 px-6 py-3 mb-8">
            <p className="text-error text-sm">{error}</p>
            <button type="button" onClick={() => setError(null)} className="text-error hover:text-text-primary text-sm transition-colors">&times;</button>
          </div>
        )}

        <div className="border border-border-subtle bg-surface-elevated p-8 mb-12">
          <label htmlFor="agent-select" className="block text-xs uppercase tracking-widest text-text-secondary mb-4">Select Agent</label>
          {loadingAgents ? (
            <div className="animate-pulse h-12 bg-surface-dim w-full border border-border-subtle" />
          ) : (
            <select
              id="agent-select"
              value={selectedAgent}
              onChange={e => setSelectedAgent(e.target.value)}
              className="w-full bg-surface-dim border border-border-subtle px-4 py-3 text-text-primary outline-none focus:border-accent font-sans cursor-pointer"
            >
              {agents.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          )}
        </div>

        <div className="mb-12">
          <h2 className="text-xs uppercase tracking-widest text-text-secondary mb-4">Query Type</h2>
          <div className="flex flex-col border border-border-subtle bg-surface-elevated divide-y divide-border-subtle">
            {QUERY_TYPES.map(qt => (
              <button
                key={qt.id}
                type="button"
                onClick={() => { setQueryType(qt.id); setState('idle'); setResult(null) }}
                className={`p-6 text-left transition-all ${
                  queryType === qt.id
                    ? 'border-l-4 border-l-accent bg-accent/5'
                    : 'border-l-4 border-l-transparent hover:bg-surface-dim'
                }`}
              >
                <div className="flex justify-between items-baseline mb-2">
                  <div className="font-display font-bold text-2xl text-text-primary">{qt.label}</div>
                  <div className="text-accent font-mono font-bold">{qt.price}</div>
                </div>
                <div className="text-text-secondary">{qt.description}</div>
              </button>
            ))}
          </div>
        </div>

        {queryType === 'ask' && (
          <div className="mb-12">
            <label htmlFor="question-input" className="block text-xs uppercase tracking-widest text-text-secondary mb-4">Question</label>
            <input
              id="question-input"
              value={question}
              onChange={e => setQuestion(e.target.value)}
              placeholder="Ask the agent a question..."
              className="w-full bg-surface-dim border border-border-subtle px-4 py-3 text-text-primary placeholder:text-text-tertiary focus:border-accent outline-none font-sans"
            />
          </div>
        )}

        {state === 'idle' && (
          <button
            type="button"
            onClick={handleQuery}
            className="w-full bg-black text-white font-bold py-4 uppercase tracking-widest hover:bg-text-secondary transition-colors"
          >
            Query for {selectedQueryType.price} →
          </button>
        )}

        {state === 'requires-payment' && paymentInfo && (
          <div className="border border-accent p-8 bg-surface-elevated mt-8">
            <div className="flex items-center gap-3 mb-8 border-b border-border-subtle pb-4">
              <div className="w-3 h-3 bg-warning" />
              <span className="font-bold uppercase tracking-widest text-sm text-text-primary">Payment Required</span>
            </div>
            <div className="space-y-4 text-sm mb-8">
              <div className="flex justify-between py-2 border-b border-border-subtle">
                <span className="text-text-secondary">Amount</span>
                <span className="font-mono font-bold text-accent">{selectedQueryType.price} USDC</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border-subtle">
                <span className="text-text-secondary">Network</span>
                <span className="font-mono text-text-primary">Base</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-text-secondary">Protocol</span>
                <span className="font-mono text-text-primary">x402</span>
              </div>
            </div>
            <button
              type="button"
              onClick={handlePay}
              className="w-full bg-black text-white font-bold py-4 uppercase tracking-widest hover:bg-text-secondary transition-colors"
            >
              Pay {selectedQueryType.price} USDC →
            </button>
          </div>
        )}

        {state === 'paying' && (
          <div className="border border-border-subtle p-12 bg-surface-elevated text-center mt-8">
            <div className="w-12 h-12 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-6" />
            <p className="text-text-secondary uppercase tracking-widest text-sm">Processing payment on Base...</p>
          </div>
        )}

        {state === 'paid' && result && (
          <div className="border border-accent/30 bg-surface-elevated p-8 mt-8">
            <div className="flex items-center gap-3 mb-8 border-b border-border-subtle pb-4">
              <div className="w-3 h-3 bg-accent" />
              <span className="font-bold uppercase tracking-widest text-sm text-accent">Payment Confirmed — Analysis Unlocked</span>
            </div>
            
            {result.summary && (
              <p className="text-text-primary text-lg leading-relaxed mb-6 font-display">{result.summary}</p>
            )}
            {result.answer && (
              <div className="mb-6">
                <p className="text-text-secondary text-xs uppercase tracking-widest mb-2">Question: {result.question}</p>
                <p className="text-text-primary text-lg leading-relaxed font-display">{result.answer}</p>
              </div>
            )}
            {result.proofs && (
              <div className="mb-6 bg-surface-dim p-6 border border-border-subtle">
                <p className="text-text-secondary text-xs uppercase tracking-widest mb-4">{result.proofCount} proof records found</p>
                {result.proofs.slice(0, 3).map((p: any) => (
                  <div key={p.seq || p.proofHash || Math.random()} className="text-sm font-mono text-text-tertiary mb-2 pb-2 border-b border-border-subtle last:border-0 last:pb-0 last:mb-0">
                    <span className="text-text-secondary font-bold mr-4">#{p.seq}</span>
                    {p.proofHash?.slice(0, 32)}...
                  </div>
                ))}
              </div>
            )}
            
            <div className="mt-8 pt-6 border-t border-border-strong flex justify-between text-xs font-mono text-text-tertiary">
              <span>Paid: {result.pricePaid}</span>
              <span>{new Date(result.timestamp).toLocaleTimeString()}</span>
            </div>
            
            <button
              type="button"
              onClick={() => { setState('idle'); setResult(null); setPaymentInfo(null) }}
              className="mt-8 w-full border border-border-strong text-text-primary font-bold uppercase tracking-widest py-4 hover:bg-surface-dim transition-colors text-sm"
            >
              Query Again
            </button>
          </div>
        )}

        {state === 'error' && (
          <div className="bg-error/5 border border-error/20 p-6 mt-8 flex justify-between items-center">
            <span className="text-error font-bold text-sm uppercase tracking-widest">Couldn't complete the query — try again in a moment.</span>
            <button type="button" onClick={() => setState('idle')} className="text-error underline text-sm uppercase tracking-widest font-bold hover:opacity-80">Try again</button>
          </div>
        )}
      </div>
    </div>
  )
}
