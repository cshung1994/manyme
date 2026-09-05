import { motion, AnimatePresence } from 'framer-motion'

const STATUS_CONFIG = {
  active: { label: 'RUNNING', color: 'bg-accent/10 text-accent border border-accent/30' },
  paused: { label: 'PAUSED — NO PROOF', color: 'bg-warning/10 text-warning border border-warning/30' },
  stopped: { label: 'STOPPED', color: 'bg-surface-dim text-text-tertiary border border-border-subtle' },
}

export default function StreamStatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.stopped
  return (
    <div className="relative inline-flex items-center justify-center">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={status}
          layout
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className={`px-4 py-2 text-xs font-bold uppercase tracking-widest ${cfg.color}`}
          style={status === 'active' ? { animation: 'border-glow 2s ease-in-out infinite' } : {}}
        >
          {cfg.label}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
