const ACQUIRE_TIMEOUT_MS = 30_000

class Semaphore {
  private current = 0
  private queue: Array<{ resolve: () => void; timer: ReturnType<typeof setTimeout> }> = []

  constructor(private max: number) {}

  async acquire(): Promise<void> {
    if (this.current < this.max) {
      this.current++
      return
    }
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.queue.findIndex(e => e.resolve === resolve)
        if (idx !== -1) this.queue.splice(idx, 1)
        reject(new Error('Skill execution queue timeout — too many concurrent requests. Try again shortly.'))
      }, ACQUIRE_TIMEOUT_MS)

      this.queue.push({ resolve, timer })
    })
  }

  release(): void {
    this.current--
    const next = this.queue.shift()
    if (next) {
      clearTimeout(next.timer)
      this.current++
      next.resolve()
    }
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire()
    try {
      return await fn()
    } finally {
      this.release()
    }
  }

  get pending(): number {
    return this.queue.length
  }

  get active(): number {
    return this.current
  }
}

export const geminiQueue = new Semaphore(
  parseInt(process.env.GEMINI_MAX_CONCURRENT || '3')
)
