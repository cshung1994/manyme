import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="bg-background min-h-screen flex items-center justify-center">
      <div className="text-center max-w-lg px-6">
        <h1 className="font-display text-[8rem] font-bold text-text-primary leading-none mb-4">404</h1>
        <p className="font-display italic text-2xl text-text-secondary mb-8">
          Page not found
        </p>
        <Link
          href="/"
          className="bg-text-primary text-surface-elevated font-bold px-8 py-3 text-xs uppercase tracking-widest hover:bg-accent transition-colors inline-block"
        >
          Back to Home
        </Link>
      </div>
    </div>
  )
}
