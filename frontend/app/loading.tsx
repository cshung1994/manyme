export default function Loading() {
  return (
    <div className="bg-background min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent animate-spin mx-auto mb-6" />
        <p className="text-xs uppercase tracking-widest text-text-tertiary">Loading</p>
      </div>
    </div>
  )
}
