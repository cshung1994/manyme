'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

type VoteStatus = 'idle' | 'processing' | 'yes' | 'no' | 'conditional'

interface AgentState {
  id: string
  name: string
  icon: string
  status: VoteStatus
  clipPath: string
  logs: string[]
}

type ConsensusResult = 'idle' | 'processing' | 'yes' | 'no' | 'conditional' | 'error'

const CONSENSUS_LABELS: Record<ConsensusResult, { kanji: string; latin: string }> = {
  idle: { kanji: '待 機', latin: 'STANDBY' },
  processing: { kanji: '処 理', latin: 'PROCESSING' },
  yes: { kanji: '合 意', latin: 'CONSENSUS' },
  no: { kanji: '拒 絶', latin: 'REJECTED' },
  conditional: { kanji: '状 態', latin: 'CONDITIONAL' },
  error: { kanji: '誤 差', latin: 'ERROR' },
}

const VOTE_COLORS: Record<VoteStatus, string> = {
  idle: '#c6c6c6',
  processing: '#777777',
  yes: '#4a3bf6',
  no: '#ba1a1a',
  conditional: '#e65100',
}

const CONSENSUS_COLORS: Record<ConsensusResult, string> = {
  idle: '#c6c6c6',
  processing: '#777777',
  yes: '#4a3bf6',
  no: '#ba1a1a',
  conditional: '#e65100',
  error: '#777777',
}

const CLIP_PATHS = {
  claude: 'polygon(0 0, 65% 0, 100% 44%, 100% 100%, 0 100%)',
  gpt: 'polygon(0 0, 100% 0, 100% 80%, 75% 100%, 25% 100%, 0 80%)',
  gemini: 'polygon(35% 0, 100% 0, 100% 100%, 0 100%, 0 44%)',
}

const LOG_LINES: Record<string, string[]> = {
  claude: [
    'Initializing recursive query structure...',
    'Cross-referencing decentralized ledger A1...',
    'Verifying merkle root integrity...',
    'Parsing semantic graph nodes...',
    'Evaluating trust boundary conditions...',
    'Running adversarial probe sequence...',
    'Consensus vector aligned.',
  ],
  gpt: [
    'Parallelizing shard retrieval...',
    'Entropy check passed (0.002)...',
    'Scanning temporal correlation matrix...',
    'Validating causal inference chain...',
    'Bayesian prior updated...',
    'Conflict resolution protocol active...',
    'Consensus vector aligned.',
  ],
  gemini: [
    'Context window integrity check...',
    'Core triad protocol sync initiated...',
    'Evaluating multi-modal embeddings...',
    'Running stochastic verification pass...',
    'Cross-validating with peer nodes...',
    'Final hash reconciliation...',
    'Consensus vector aligned.',
  ],
}

const SCENARIOS: { votes: [VoteStatus, VoteStatus, VoteStatus]; result: ConsensusResult }[] = [
  { votes: ['yes', 'yes', 'yes'], result: 'yes' },
  { votes: ['yes', 'no', 'yes'], result: 'no' },
  { votes: ['yes', 'conditional', 'yes'], result: 'conditional' },
  { votes: ['yes', 'yes', 'yes'], result: 'yes' },
  { votes: ['conditional', 'yes', 'conditional'], result: 'conditional' },
  { votes: ['yes', 'yes', 'yes'], result: 'yes' },
]

function deriveConsensus(agents: AgentState[]): ConsensusResult {
  if (agents.some(a => a.status === 'idle')) return 'idle'
  if (agents.some(a => a.status === 'processing')) return 'processing'
  if (agents.some(a => a.status === 'no')) return 'no'
  if (agents.some(a => a.status === 'conditional')) return 'conditional'
  if (agents.every(a => a.status === 'yes')) return 'yes'
  return 'error'
}

function useDeliberationLoop() {
  const [agents, setAgents] = useState<AgentState[]>([
    { id: 'claude', name: 'Claude Opus 4.6', icon: 'neurology', status: 'idle', clipPath: CLIP_PATHS.claude, logs: [] },
    { id: 'gpt', name: 'GPT-5.4', icon: 'psychology', status: 'idle', clipPath: CLIP_PATHS.gpt, logs: [] },
    { id: 'gemini', name: 'Gemini 3.1 Pro', icon: 'memory', status: 'idle', clipPath: CLIP_PATHS.gemini, logs: [] },
  ])
  const [consensus, setConsensus] = useState<ConsensusResult>('idle')
  const scenarioRef = useRef(0)
  const timerRefs = useRef<ReturnType<typeof setTimeout>[]>([])

  const clearTimers = useCallback(() => {
    timerRefs.current.forEach(clearTimeout)
    timerRefs.current = []
  }, [])

  const runCycle = useCallback(() => {
    clearTimers()
    const scenario = SCENARIOS[scenarioRef.current % SCENARIOS.length]
    scenarioRef.current++

    setAgents(prev => prev.map(a => ({ ...a, status: 'processing' as VoteStatus, logs: [] })))
    setConsensus('processing')

    const agentIds = ['claude', 'gpt', 'gemini'] as const
    const resolveDelays = [
      1200 + Math.random() * 2000,
      1800 + Math.random() * 2500,
      1400 + Math.random() * 2200,
    ]

    agentIds.forEach((id, i) => {
      const lines = LOG_LINES[id]
      const resolveAt = resolveDelays[i]
      const lineInterval = resolveAt / (lines.length + 1)

      lines.forEach((line, lineIdx) => {
        const t = setTimeout(() => {
          setAgents(prev => prev.map(a =>
            a.id === id ? { ...a, logs: [...a.logs, line] } : a
          ))
        }, lineInterval * (lineIdx + 1))
        timerRefs.current.push(t)
      })

      const resolveTimer = setTimeout(() => {
        setAgents(prev => {
          const next = prev.map(a =>
            a.id === id ? { ...a, status: scenario.votes[i] } : a
          )
          setConsensus(deriveConsensus(next))
          return next
        })
      }, resolveAt)
      timerRefs.current.push(resolveTimer)
    })

    const maxDelay = Math.max(...resolveDelays)
    const resetTimer = setTimeout(() => {
      const holdTimer = setTimeout(() => {
        setAgents(prev => prev.map(a => ({ ...a, status: 'idle' as VoteStatus, logs: [] })))
        setConsensus('idle')
        const nextCycleTimer = setTimeout(runCycle, 1500)
        timerRefs.current.push(nextCycleTimer)
      }, 3500)
      timerRefs.current.push(holdTimer)
    }, maxDelay + 200)
    timerRefs.current.push(resetTimer)
  }, [clearTimers])

  useEffect(() => {
    const startTimer = setTimeout(runCycle, 2000)
    timerRefs.current.push(startTimer)
    return clearTimers
  }, [runCycle, clearTimers])

  return { agents, consensus }
}

function WiseManNode({
  agent,
  index,
}: {
  agent: AgentState
  index: number
}) {
  const isProcessing = agent.status === 'processing'
  const color = VOTE_COLORS[agent.status]
  const scrollRef = useRef<HTMLDivElement>(null)
  const prevLogCount = useRef(0)

  if (agent.logs.length !== prevLogCount.current) {
    prevLogCount.current = agent.logs.length
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
    })
  }

  return (
    <div className="flex flex-col h-full">

      <div
        className="relative flex-shrink-0 flex items-center justify-center cursor-pointer transition-colors duration-300"
        style={{
          clipPath: agent.clipPath,
          background: color,
          padding: '2px',
          height: '80px',
          animation: isProcessing ? 'magi-flicker 0.25s infinite step-end' : 'none',
        }}
      >
        <div
          className="w-full h-full flex items-center justify-center"
          style={{
            clipPath: agent.clipPath,
            background: color,
          }}
        >
          <span
            className="font-display font-bold text-white text-sm tracking-wider"
            style={{ textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}
          >
            {agent.name.toUpperCase()}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between px-3 py-2 border-x border-border-subtle">
        <div className="flex items-center gap-2">
          <span
            className="material-symbols-outlined text-xs text-text-secondary"
            style={{ fontVariationSettings: "'FILL' 0, 'wght' 300" }}
          >
            {agent.icon}
          </span>
          <span className="text-[8px] tracking-[0.15em] font-bold uppercase text-text-secondary">
            {agent.id.toUpperCase()} • {index + 1}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div
            className="w-1.5 h-1.5"
            style={{
              background: color,
              animation: isProcessing ? 'breathe 0.8s ease-in-out infinite' : 'none',
            }}
          />
          <span
            className="text-[8px] tracking-[0.1em] font-bold uppercase"
            style={{ color }}
          >
            {agent.status === 'idle' ? 'STANDBY' : agent.status === 'processing' ? 'ANALYZING' : agent.status.toUpperCase()}
          </span>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 border border-border-subtle border-t-0 bg-surface-elevated px-3 py-2 overflow-y-auto"
        style={{ scrollbarWidth: 'none', minHeight: '120px' }}
      >
        {agent.logs.length === 0 && !isProcessing ? (
          <p className="text-text-tertiary text-[10px] italic">Awaiting query...</p>
        ) : (
          <AnimatePresence initial={false}>
            {agent.logs.map((line, i) => (
              <motion.div
                key={`${agent.id}-log-${line.slice(0, 15)}`}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="text-[10px] text-text-secondary py-0.5 border-l border-border-subtle pl-2 mb-1"
              >
                <span className="text-text-tertiary font-mono">[{String(i).padStart(2, '0')}]</span>{' '}
                {line}
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}

function ConnectionBar({ rotation, active }: { rotation: number; active: boolean }) {
  return (
    <motion.div
      animate={{
        opacity: active ? 1 : 0.3,
        scaleX: active ? 1 : 0.9,
      }}
      transition={{ duration: 0.4 }}
      style={{
        height: '3px',
        background: active ? '#4a3bf6' : '#e2e2e2',
        alignSelf: 'center',
        transform: `rotate(${rotation}deg)`,
        margin: '-10%',
        transition: 'background 0.4s ease',
      }}
    />
  )
}

function ResponseBox({ consensus }: { consensus: ConsensusResult }) {
  const label = CONSENSUS_LABELS[consensus]
  const color = CONSENSUS_COLORS[consensus]
  const isProcessing = consensus === 'processing'

  return (
    <motion.div
      layout
      className="flex flex-col items-center justify-center"
      style={{
        animation: isProcessing ? 'magi-flicker 0.25s infinite step-end' : 'none',
      }}
    >
      <div
        className="border-2 p-[3px] transition-colors duration-500"
        style={{ borderColor: color }}
      >
        <div
          className="border-2 px-6 py-3 transition-colors duration-500"
          style={{ borderColor: color }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={consensus}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.3 }}
              className="text-center"
            >
              <div
                className="text-4xl font-bold font-display tracking-widest transition-colors duration-500"
                style={{ color }}
              >
                {label.kanji}
              </div>
              <div
                className="text-[8px] tracking-[0.3em] font-bold mt-1 transition-colors duration-500"
                style={{ color }}
              >
                {label.latin}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}

function StatusPanel({ consensus }: { consensus: ConsensusResult }) {
  const ext = consensus === 'idle' ? '????' : consensus === 'yes' ? '7312' : '3023'

  return (
    <div className="space-y-0.5">
      <div className="text-[11px] font-mono font-bold text-text-primary" style={{ transform: 'scaleX(1.15)', transformOrigin: 'left' }}>
        CODE:473
      </div>
      {['FILE:MAGI_SYS', `EXTENTION:${ext}`, 'EX_MODE:OFF', 'PRIORITY:AAA'].map(line => (
        <div
          key={line}
          className="text-[9px] font-mono text-text-secondary pl-3"
          style={{ transform: 'scaleX(1.1)', transformOrigin: 'left' }}
        >
          {line}
        </div>
      ))}
    </div>
  )
}

function HeaderBar({ side, title }: { side: 'left' | 'right'; title: string }) {
  return (
    <div className={`overflow-hidden flex flex-col gap-0.5 ${side === 'right' ? 'items-end' : ''}`}>
      <div className="w-full h-[2px] bg-success/40" />
      <div className="w-full h-[2px] bg-success/40" />
      <div
        className="text-text-primary font-bold text-sm tracking-widest"
        style={{ transform: 'scaleX(1.8)', transformOrigin: side === 'left' ? 'left' : 'right' }}
      >
        {title}
      </div>
      <div className="w-full h-[2px] bg-success/40" />
      <div className="w-full h-[2px] bg-success/40" />
    </div>
  )
}

export default function MagiConsensusEngine() {
  const { agents, consensus } = useDeliberationLoop()
  const allResolved = agents.every(a => a.status !== 'processing' && a.status !== 'idle')

  return (
    <div className="border border-border-subtle bg-surface-elevated mb-16">

      <div className="border border-border-subtle m-2 p-4 lg:p-6 relative" style={{ aspectRatio: '2 / 1', minHeight: '450px' }}>
        <div
          className="grid gap-3 h-full"
          style={{
            gridTemplateColumns: '1fr 2fr 0.5fr 1fr 0.5fr 2fr 1fr',
            gridTemplateRows: 'auto 2fr 2fr 1fr 3fr auto',
          }}
        >
          <div style={{ gridColumn: '1 / 3', gridRow: '1' }}>
            <HeaderBar side="left" title="質 問" />
          </div>
          <div style={{ gridColumn: '6 / 8', gridRow: '1' }}>
            <HeaderBar side="right" title="解 決" />
          </div>

          <div style={{ gridColumn: '1 / 3', gridRow: '2 / 4' }}>
            <StatusPanel consensus={consensus} />
          </div>

          <div style={{ gridColumn: '6 / 8', gridRow: '2 / 4', justifySelf: 'end', alignSelf: 'center' }}>
            <ResponseBox consensus={consensus} />
          </div>

          <div style={{ gridColumn: '2 / 4', gridRow: '4 / 7' }}>
            <WiseManNode agent={agents[2]} index={2} />
          </div>

          <div style={{ gridColumn: '3 / 6', gridRow: '1 / 4' }}>
            <WiseManNode agent={agents[1]} index={1} />
          </div>

          <div style={{ gridColumn: '5 / 7', gridRow: '4 / 7' }}>
            <WiseManNode agent={agents[0]} index={0} />
          </div>

          <div style={{ gridColumn: '3', gridRow: '4', alignSelf: 'center' }}>
            <ConnectionBar
              rotation={-54}
              active={agents[2].status !== 'idle' && agents[1].status !== 'idle' && agents[2].status !== 'processing' && agents[1].status !== 'processing'}
            />
          </div>
          <div style={{ gridColumn: '4', gridRow: '5', alignSelf: 'center' }}>
            <ConnectionBar
              rotation={0}
              active={agents[2].status !== 'idle' && agents[0].status !== 'idle' && agents[2].status !== 'processing' && agents[0].status !== 'processing'}
            />
          </div>
          <div style={{ gridColumn: '5', gridRow: '4', alignSelf: 'center' }}>
            <ConnectionBar
              rotation={54}
              active={agents[1].status !== 'idle' && agents[0].status !== 'idle' && agents[1].status !== 'processing' && agents[0].status !== 'processing'}
            />
          </div>

          <div className="flex items-center justify-center" style={{ gridColumn: '3 / 6', gridRow: '5 / 6' }}>
            <AnimatePresence>
              {allResolved && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-center text-text-primary font-display font-bold text-xl italic tracking-tight"
                >
                  MAGI
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  )
}
