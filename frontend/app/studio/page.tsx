'use client'
import { useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import Link from 'next/link'
import { fetchAgents } from '@/lib/agents-api'

export default function StudioPage() {
  const { address } = useAccount()
  const [agents, setAgents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!address) {
      setLoading(false)
      return
    }
    fetchAgents({ creator: address })
      .then(setAgents)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [address])

  const totalEarned = 0 // Will be populated from settlement service
  const pendingPayout = 0

  return (
    <div className="bg-background min-h-screen text-text-primary font-sans">
      <div className="max-w-[1920px] mx-auto px-4 sm:px-8 lg:px-24 py-24">
        
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end mb-16 border-b border-border-strong pb-8">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <span className="bg-text-primary text-surface-elevated px-3 py-1 text-xs uppercase tracking-widest font-bold">
                SYS.ADM_CTRL
              </span>
              <span className="text-accent text-xs uppercase tracking-widest border border-accent px-3 py-1 font-bold">
                STATUS: ONLINE
              </span>
            </div>
            <h1 className="font-display font-bold text-6xl leading-none tracking-tight mb-8">
              Creator Studio
            </h1>
            <div className="flex items-center gap-0 border border-border-subtle inline-flex bg-surface-elevated">
              <span className="text-text-secondary text-xs uppercase tracking-widest font-bold border-r border-border-subtle px-4 py-3 bg-surface-dim">
                WALLET_ID
              </span>
              <span className="text-text-primary text-sm px-4 py-3 font-bold">
                {address ? `${address.slice(0,6)}...${address.slice(-4)}` : 'DISCONNECTED'}
              </span>
              {address && (
                <button 
                  type="button"
                  onClick={() => navigator.clipboard.writeText(address)}
                  className="text-text-secondary hover:text-accent hover:bg-surface-dim transition-colors border-l border-border-subtle px-4 py-3 flex items-center"
                  title="Copy address"
                >
                  <span className="material-symbols-outlined text-sm">content_copy</span>
                </button>
              )}
            </div>
          </div>
          
          <Link
            href="/agents/new"
            className="mt-8 md:mt-0 bg-text-primary text-surface-elevated font-bold text-xs uppercase tracking-widest px-8 py-4 hover:bg-accent transition-colors flex items-center gap-3 group"
          >
            <span className="material-symbols-outlined text-sm group-hover:rotate-90 transition-transform">add</span>
            Upload Agent
          </Link>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border border-border-strong mb-24 bg-surface-elevated">
          <div className="p-12 border-b md:border-b-0 md:border-r border-border-strong relative">
            <p className="text-text-secondary text-xs uppercase tracking-widest font-bold mb-4">Total Earned</p>
            <p className="font-display text-5xl md:text-6xl text-text-primary tracking-tight font-bold">
              <span className="text-text-tertiary mr-2 font-sans font-light">$</span>{totalEarned.toFixed(4)}
            </p>
          </div>
          <div className="p-12 border-b md:border-b-0 md:border-r border-border-strong relative bg-surface-dim">
            <p className="text-text-secondary text-xs uppercase tracking-widest font-bold mb-4">Active Agents</p>
            <p className="font-display text-5xl md:text-6xl text-accent tracking-tight flex items-baseline font-bold">
              {agents.filter(a => a.active).length}
              <span className="text-text-tertiary text-3xl ml-2 tracking-normal font-sans font-light">/ {agents.length}</span>
            </p>
          </div>
          <div className="p-12 relative">
            <p className="text-text-secondary text-xs uppercase tracking-widest font-bold mb-4">Pending Payout</p>
            <p className="font-display text-5xl md:text-6xl text-text-primary tracking-tight font-bold">
              <span className="text-text-tertiary mr-2 font-sans font-light">$</span>{pendingPayout.toFixed(4)}
            </p>
          </div>
        </div>

        {/* Agent list */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12 md:gap-24">
          <div className="md:col-span-3">
            <h2 className="text-xs font-bold border-b border-border-strong pb-4 mb-6 uppercase tracking-widest text-text-primary">
              Network Nodes
            </h2>
            <p className="text-text-secondary text-sm leading-relaxed">
              Manage deployed agent instances. Revenue streams generated per second of compute time utilized by external clients.
            </p>
            <div className="mt-8 border border-border-subtle p-6 bg-surface-dim">
              <div className="flex items-center gap-3 text-xs uppercase tracking-widest font-bold text-text-secondary mb-3">
                <span className="w-2 h-2 bg-accent animate-pulse"></span>
                System Health
              </div>
              <div className="h-1 w-full bg-border-subtle mt-1">
                <div className="h-full bg-accent w-full"></div>
              </div>
            </div>
          </div>
          <div className="md:col-span-9">
            {loading ? (
              <div className="space-y-4 border-t border-border-strong pt-4">
                {[1, 2].map((i) => (
                  <div key={i} className="animate-pulse border border-border-subtle py-8 px-8 bg-surface-elevated">
                    <div className="h-8 bg-surface-dim w-1/3 mb-4" />
                    <div className="h-4 bg-surface-dim w-1/4 mb-4" />
                    <div className="h-4 bg-surface-dim w-1/2" />
                  </div>
                ))}
              </div>
            ) : agents.length === 0 ? (
              <div className="border border-border-strong p-16 md:p-24 flex flex-col items-center justify-center text-center bg-surface-elevated relative overflow-hidden group">
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9IiNjNmM2YzYiLz48L3N2Zz4=')] opacity-20"></div>
                <span className="material-symbols-outlined text-6xl text-border-strong mb-6 relative z-10">smart_toy</span>
                <h3 className="font-display italic text-4xl mb-4 text-text-primary font-bold relative z-10">No agents active</h3>
                <p className="text-text-secondary text-base mb-10 max-w-md relative z-10">
                  Deploy your first AI agent to initialize network connections and begin streaming USDC revenue.
                </p>
                <Link href="/agents/new" className="text-xs font-bold uppercase tracking-widest bg-text-primary text-surface-elevated px-8 py-4 hover:bg-accent transition-colors flex items-center gap-2 relative z-10">
                  Upload your first agent <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </Link>
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                {agents.map(agent => (
                  <Link 
                    href={`/agents/${agent.id}`} 
                    key={agent.id} 
                    className="border border-border-subtle hover:border-border-strong p-8 flex flex-col md:flex-row justify-between items-start md:items-center bg-surface-elevated transition-colors group relative"
                  >
                    
                    <div className="pl-0 w-full md:w-auto">
                      <div className="flex items-center gap-4 mb-3">
                        <h3 className="font-display italic text-4xl font-bold text-text-primary group-hover:text-accent transition-colors tracking-tight">
                          {agent.name}
                        </h3>
                        <span className="text-[10px] border border-border-subtle px-2 py-1 text-text-tertiary uppercase tracking-widest bg-surface-dim font-bold">
                          ID: {agent.id.slice(0,8)}
                        </span>
                      </div>
                      <p className="text-text-secondary text-xs uppercase tracking-widest font-bold mb-6">
                        CAT: {agent.category}
                      </p>
                      <div className="flex flex-wrap items-center gap-6 md:gap-10 border-t border-border-subtle pt-6">
                        <span className="text-text-primary text-sm flex items-center gap-2">
                          <span className="material-symbols-outlined text-[18px] text-text-tertiary">payments</span>
                          <span className="font-bold uppercase tracking-widest text-xs">${((agent.rate_per_second || 0) / 1_000_000).toFixed(4)}/SEC</span>
                        </span>
                        <span className="text-text-secondary text-sm flex items-center gap-2">
                          <span className="material-symbols-outlined text-[18px] text-text-tertiary">account_balance_wallet</span>
                          <span className="font-bold uppercase tracking-widest text-xs">$0.0000 EARNED</span>
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-start md:items-end gap-3 mt-6 md:mt-0 w-full md:w-auto border-t md:border-t-0 border-border-subtle pt-6 md:pt-0">
                      <span className={`text-[10px] uppercase tracking-widest font-bold px-3 py-1.5 flex items-center gap-2 ${agent.active ? 'bg-accent text-surface-elevated' : 'bg-surface-dim text-text-secondary border border-border-subtle'}`}>
                        {agent.active && <span className="w-1.5 h-1.5 bg-surface-elevated animate-pulse"></span>}
                        {agent.active ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                      <span className="text-xs text-text-tertiary group-hover:text-accent transition-colors uppercase tracking-widest mt-2 hidden md:flex items-center gap-1 font-bold">
                        ACCESS <span className="material-symbols-outlined text-sm">arrow_outward</span>
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
