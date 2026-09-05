import { formatRate } from '@/lib/utils'

export default function CostBreakdown({ curatorRate, platformFee }: {
  curatorRate: number
  platformFee: number
}) {

  return (
    <div className="border border-border-subtle p-6 bg-surface-elevated">
      <p className="text-text-tertiary text-xs uppercase tracking-widest mb-4">Cost Breakdown</p>
      <div className="text-sm">
        <div className="flex justify-between py-3 border-b border-border-subtle">
          <span className="text-text-secondary">Curator</span>
          <span className="text-text-primary">{formatRate(curatorRate)}</span>
        </div>
        <div className="flex justify-between py-3 border-b border-border-subtle">
          <span className="text-text-secondary">Platform</span>
          <span className="text-text-primary">{formatRate(platformFee)}</span>
        </div>
        <div className="flex justify-between py-3 font-bold text-accent">
          <span>Total</span>
          <span>{formatRate(curatorRate + platformFee)}</span>
        </div>
      </div>
    </div>
  )
}
