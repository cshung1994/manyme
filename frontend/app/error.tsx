'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="bg-background min-h-screen flex items-center justify-center">
      <div className="text-center max-w-lg px-6">
        <h1 className="font-display text-6xl font-bold text-text-primary mb-4">Error</h1>
        <p className="text-text-secondary mb-8">
          {error.message || 'Something went wrong. Please try again.'}
        </p>
        <button
          type="button"
          onClick={reset}
          className="bg-text-primary text-surface-elevated font-bold px-8 py-3 text-xs uppercase tracking-widest hover:bg-accent transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  )
}
