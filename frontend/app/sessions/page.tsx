'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { fetchSessions } from '@/lib/api'

const STATUS_STYLES: Record<string, string> = {
  active: 'border border-accent text-accent',
  paused: 'border border-warning text-warning',
  stopped: 'border border-border-strong text-text-tertiary',
}

function formatCost(microUnits: number) {
  return `$${(microUnits / 1_000_000).toFixed(4)}`
}

function formatDuration(createdAt: string, endedAt: string | null) {
  const start = new Date(createdAt).getTime()
  const end = endedAt ? new Date(endedAt).getTime() : Date.now()
  const secs = Math.floor((end - start) / 1000)
  if (secs < 60) return `${secs}s`
  if (secs < 3600) return `${Math.floor(secs / 60)}m ${secs % 60}s`
  return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchSessions()
      .then(setSessions)
      .catch((e: any) => setError(e.message || 'Failed to fetch sessions'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="bg-background min-h-screen text-text-primary">
      <div className="max-w-[1920px] mx-auto px-6 md:px-12 lg:px-24 pt-24 pb-32">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-24">
          <div>
            <h1 className="font-display font-bold text-[5rem] leading-[0.95] tracking-tight mb-4">
              My Sessions
            </h1>
            <p className="font-display italic text-2xl text-text-secondary">
              All agent session history and work records.
            </p>
          </div>
          <Link
            href="/marketplace"
            className="group flex items-center gap-2 border-b border-text-primary pb-1 text-sm font-medium text-text-primary transition-colors hover:text-accent hover:border-accent"
          >
            Start New Session
            <span className="material-symbols-outlined text-sm transition-transform group-hover:translate-x-1">arrow_forward</span>
          </Link>
        </div>

        {error && (
          <div className="flex items-center justify-between border border-error/30 bg-error/5 px-6 py-3 mb-8">
            <p className="text-error text-sm">{error}</p>
            <button type="button" onClick={() => setError(null)} className="text-error hover:text-text-primary text-sm transition-colors">&times;</button>
          </div>
        )}

        {loading ? (
          <div className="space-y-8 border-t border-border-subtle">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse border-b border-border-subtle py-8 flex flex-col px-8">
                <div className="h-8 bg-surface-dim w-1/3 mb-2" />
                <div className="h-4 bg-surface-dim w-1/4 mb-4" />
                <div className="h-4 bg-surface-dim w-1/2" />
              </div>
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <div className="bg-surface-dim p-24 flex flex-col items-center justify-center text-center">
            <span className="material-symbols-outlined text-4xl text-text-tertiary mb-6">stream</span>
            <h3 className="font-display text-3xl mb-4 italic">No sessions yet</h3>
            <p className="text-text-secondary mb-8 max-w-md">
              Start a session from the Marketplace to begin streaming agent work.
            </p>
            <Link href="/marketplace" className="font-display italic text-accent hover:text-accent-muted text-lg transition-colors">
              Browse agents and start your first session &rarr;
            </Link>
          </div>
        ) : (
          <div className="flex flex-col border-t border-border-subtle">
            {sessions.map((s) => (
              <Link
                key={s.id}
                href={`/sessions/${s.id}`}
                className="group flex flex-col md:flex-row justify-between items-start md:items-center gap-4 py-8 border-b border-border-subtle hover:bg-surface-dim transition-colors px-4 md:px-8"
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <span className={`text-xs uppercase tracking-widest px-3 py-1 font-bold ${STATUS_STYLES[s.status] ?? STATUS_STYLES.stopped}`}>
                      {s.status}
                    </span>
                    <span className="text-xs text-text-tertiary font-mono">#{s.id.slice(0, 8)}</span>
                  </div>
                  <h3 className="font-display text-2xl font-bold group-hover:text-accent transition-colors">
                    Agent #{s.agent_id}
                  </h3>
                  <p className="text-xs text-text-tertiary font-mono">
                    {new Date(s.created_at).toLocaleString()} · {formatDuration(s.created_at, s.ended_at)}
                  </p>
                </div>
                <div className="text-right space-y-1">
                  <p className="text-accent font-display text-2xl font-bold">{formatCost(s.total_rate * 4)}</p>
                  <p className="text-xs text-text-secondary uppercase tracking-widest">{formatCost(s.total_rate)}/sec</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
