'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAccount } from 'wagmi'
import { fetchAgents } from '@/lib/agents-api'

interface Agent {
  id: string | number
  name: string
  description: string
  category: string
  rate_per_second: number
  creator_wallet: string
  avg_rating: number | null
  run_count: number
}

const CATEGORIES = ['all', 'defi', 'trading', 'nft', 'security', 'general', 'research']

function formatPrice(microUnits: number | undefined | null): string {
  if (!microUnits) return 'Free'
  return `$${(microUnits / 1_000_000).toFixed(4)}`
}

export default function AgentsPage() {
  const { address } = useAccount()
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState('all')
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'all' | 'mine'>('all')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fetchAgents({ category: category !== 'all' ? category : undefined, q: search || undefined })
      .then(setAgents)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [category, search])

  const displayed = tab === 'mine' && address
    ? agents.filter(a => a.creator_wallet?.toLowerCase() === address.toLowerCase())
    : agents

  return (
    <div className="bg-background min-h-screen text-text-primary">
      <div className="max-w-[1920px] mx-auto px-4 sm:px-8 lg:px-24 py-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-24 items-end">
          <div className="md:col-span-1">
            <h1 className="font-display text-6xl font-bold text-text-primary leading-none">
              Agent Marketplace
            </h1>
          </div>
          <div className="md:col-span-2 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b border-border-strong pb-4">
            <p className="font-display italic text-2xl text-text-secondary">
              Compute agents for any task. Pay by the second. Stop anytime.
            </p>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-accent animate-pulse"></div>
              <span className="text-xs uppercase tracking-widest text-text-tertiary font-bold">Live Status</span>
            </div>
          </div>
        </div>

        <div className="flex gap-8 mb-12 border-b border-border-subtle">
          <button type="button" onClick={() => setTab('all')}
            className={`pb-3 text-xs uppercase tracking-widest font-bold transition-colors ${
              tab === 'all' ? 'text-text-primary border-b-2 border-text-primary' : 'text-text-tertiary hover:text-text-primary'
            }`}>
            All Agents
          </button>
          <button type="button" onClick={() => setTab('mine')}
            className={`pb-3 text-xs uppercase tracking-widest font-bold transition-colors ${
              tab === 'mine' ? 'text-text-primary border-b-2 border-text-primary' : 'text-text-tertiary hover:text-text-primary'
            }`}>
            My Agents {address && tab === 'mine' ? `(${displayed.length})` : ''}
          </button>
        </div>

        {tab === 'mine' && !address && (
          <div className="py-24 border-y border-border-strong text-center">
            <h2 className="font-display text-4xl text-text-primary mb-4 italic">Connect your wallet</h2>
            <p className="text-text-secondary">Connect your wallet to see your published agents.</p>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-between border border-error/30 bg-error/5 px-6 py-3 mb-8">
            <p className="text-error text-sm">{error}</p>
            <button type="button" onClick={() => setError(null)} className="text-error hover:text-text-primary text-sm transition-colors">&times;</button>
          </div>
        )}

        {(tab === 'all' || address) && (
          <>
            <div className="mb-8">
              <label htmlFor="agent-search" className="block text-xs text-text-secondary uppercase tracking-widest mb-2">Search</label>
              <input
                id="agent-search"
                type="text" value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search agents..."
                className="w-full bg-surface-dim border border-border-subtle px-4 py-3 text-text-primary placeholder:text-text-tertiary focus:border-accent outline-none transition-colors"
              />
            </div>

            <div className="flex gap-8 mb-16 flex-wrap">
              {CATEGORIES.map(cat => (
                <button type="button" key={cat} onClick={() => setCategory(cat)}
                  className={`text-xs uppercase tracking-widest border-b pb-1 transition-colors ${
                    category === cat
                      ? 'border-text-primary text-text-primary font-bold'
                      : 'border-transparent text-text-tertiary hover:border-text-primary hover:text-text-primary'
                  }`}>
                  {cat}
                </button>
              ))}
            </div>
          </>
        )}

        {loading ? (
          <div className="space-y-12">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse space-y-4 border-t border-border-subtle pt-8">
                <div className="h-8 bg-surface-dim w-1/3" />
                <div className="h-4 bg-surface-dim w-full" />
                <div className="h-4 bg-surface-dim w-2/3" />
              </div>
            ))}
          </div>
        ) : displayed.length === 0 ? (
          <div className="py-24 border-y border-border-strong text-center">
            <h2 className="font-display text-4xl text-text-primary mb-4 italic">
              {tab === 'mine' ? 'No agents published yet' : 'No agents found'}
            </h2>
            <p className="text-text-secondary">
              <Link href="/curator" className="font-display italic text-accent hover:text-accent-muted transition-colors">
                {tab === 'mine' ? 'Upload your first agent' : 'Upload the first agent'} &rarr;
              </Link>
            </p>
          </div>
        ) : (
        <div className="grid grid-cols-1 gap-8">
            {displayed.map(agent => {
              const isOwner = address && agent.creator_wallet?.toLowerCase() === address.toLowerCase()
              return (
                <Link
                  key={agent.id}
                  href={`/agents/${agent.id}`}
                  className="group grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 items-start p-8 bg-surface-elevated border border-border-subtle hover:border-border-strong transition-colors cursor-pointer"
                >
                  <div className="md:col-span-1 flex flex-col items-start">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="bg-surface-dim px-3 py-1 text-[10px] uppercase tracking-widest font-bold text-text-tertiary">
                        {agent.category}
                      </span>
                      {isOwner && (
                        <span className="text-[10px] uppercase tracking-widest text-accent font-bold">You</span>
                      )}
                    </div>
                    <h3 className="font-display font-bold text-3xl text-text-primary tracking-tight mb-3 group-hover:text-accent transition-colors">
                      {agent.name}
                    </h3>
                    <div className="w-12 h-0.5 bg-accent/30 transition-all duration-300 group-hover:w-24 group-hover:bg-accent" />
                  </div>

                  <div className="md:col-span-2 flex flex-col h-full justify-between">
                    <p className="text-text-secondary text-base leading-relaxed mb-6 max-w-3xl">
                      {agent.description}
                    </p>

                    <div className="grid grid-cols-3 md:grid-cols-4 border-t border-border-subtle pt-4 mt-auto items-end">
                      <div>
                        <div className="text-[10px] uppercase tracking-widest text-text-tertiary mb-1">Runs</div>
                        <div className="text-sm text-text-secondary">{agent.run_count || 0}</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-widest text-text-tertiary mb-1">Rating</div>
                        <div className="text-sm text-text-secondary">
                          {agent.avg_rating ? `★ ${agent.avg_rating.toFixed(1)}` : '—'}
                        </div>
                      </div>
                      <div className="col-span-1 md:col-span-2 md:text-right">
                        <div className="text-[10px] uppercase tracking-widest text-accent mb-1 font-bold">Rate</div>
                        <div className="font-bold text-lg text-accent">{formatPrice(agent.rate_per_second)}/sec</div>
                      </div>
                    </div>
                    
                    <div className="flex justify-end mt-6">
                      <div className="bg-text-primary text-surface-elevated px-8 py-3 text-xs uppercase tracking-widest font-bold transition-colors flex items-center gap-2">
                        View Agent
                        <span className="material-symbols-outlined text-sm">arrow_forward</span>
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
