import { useEffect, useRef, useState } from 'react'
import { formatUSDC } from '@/lib/utils'

export default function SalaryTicker({ accrued, ratePerSec, status }: {
  accrued: number
  ratePerSec: number
  status: string
}) {
  const [displayValue, setDisplayValue] = useState(accrued)
  const prevAccruedRef = useRef(accrued)

  useEffect(() => {
    const prev = prevAccruedRef.current
    if (prev === accrued) return

    const startTime = performance.now()
    const duration = 1000
    
    let animationFrameId: number

    const updateValue = (currentTime: number) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)
      
      const easeOut = 1 - Math.pow(1 - progress, 3)
      
      setDisplayValue(prev + (accrued - prev) * easeOut)
      
      if (progress < 1) {
        animationFrameId = requestAnimationFrame(updateValue)
      } else {
        prevAccruedRef.current = accrued
      }
    }
    
    animationFrameId = requestAnimationFrame(updateValue)
    
    return () => cancelAnimationFrame(animationFrameId)
  }, [accrued])

  return (
    <div className="border border-border-subtle p-8 bg-surface-elevated">
      <p className="text-text-tertiary text-xs uppercase tracking-widest mb-4">Session Cost</p>
      <div 
        className={`text-6xl font-display font-bold transition-colors ${
          status === 'active' ? 'text-accent' : 'text-text-tertiary'
        }`}
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {formatUSDC(displayValue)}
      </div>
      <div className="flex items-center gap-3 mt-6">
        <div 
          className={`w-2 h-2 ${
            status === 'active' ? 'bg-accent' : 'bg-text-tertiary'
          }`}
          style={status === 'active' ? { animation: 'breathe 2s ease-in-out infinite' } : {}}
        />
        <span className="text-xs uppercase tracking-widest text-text-secondary">
          {status === 'active' ? `${formatUSDC(ratePerSec)}/sec` : status}
        </span>
      </div>
    </div>
  )
}
