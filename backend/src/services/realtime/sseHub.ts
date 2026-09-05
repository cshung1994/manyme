type EventType = 'step' | 'proof' | 'status' | 'earnings' | 'ping' | 'chunk' | 'tool_use' | 'tool_result' | 'complete' | 'error'

export type SessionEventType = EventType;

interface Subscriber {
  sessionId: string
  controller: ReadableStreamDefaultController
  lastEventId: number
}

class SSEHub {
  private subscribers = new Map<string, Set<Subscriber>>()
  private eventCounters = new Map<string, number>()

  subscribe(
    sessionId: string,
    controller: ReadableStreamDefaultController,
    lastEventId: number,
  ): Subscriber {
    const sub: Subscriber = { sessionId, controller, lastEventId }
    if (!this.subscribers.has(sessionId)) {
      this.subscribers.set(sessionId, new Set())
    }
    this.subscribers.get(sessionId)!.add(sub)
    console.log(`[SSEHub] Client subscribed to session ${sessionId}`)
    return sub
  }

  unsubscribe(sessionId: string, sub: Subscriber) {
    this.subscribers.get(sessionId)?.delete(sub)
    console.log(`[SSEHub] Client unsubscribed from session ${sessionId}`)
  }

  emit(sessionId: string, type: EventType, data: unknown) {
    const subs = this.subscribers.get(sessionId)
    if (!subs || subs.size === 0) return

    const counter = (this.eventCounters.get(sessionId) || 0) + 1
    this.eventCounters.set(sessionId, counter)

    const message = `id: ${counter}\nevent: ${type}\ndata: ${JSON.stringify(data)}\n\n`
    const encoder = new TextEncoder()
    const encoded = encoder.encode(message)

    for (const sub of subs) {
      try {
        sub.controller.enqueue(encoded)
      } catch {
        subs.delete(sub)
      }
    }
  }

  emitStep(
    sessionId: string,
    step: { kind: string; title: string; body: string; ts: string },
  ) {
    this.emit(sessionId, 'step', step)
  }

  emitProof(
    sessionId: string,
    proof: {
      seq: number
      proofHash: string
      txHash?: string
      ts: string
    },
  ) {
    this.emit(sessionId, 'proof', proof)
  }

  emitStatus(sessionId: string, status: string) {
    this.emit(sessionId, 'status', { status, ts: new Date().toISOString() })
  }

  emitEarnings(sessionId: string, accrued: number) {
    this.emit(sessionId, 'earnings', {
      accrued,
      ts: new Date().toISOString(),
    })
  }

  emitChunk(sessionId: string, chunk: string) {
    this.emit(sessionId, 'chunk', { chunk, ts: new Date().toISOString() })
  }

  emitToolUse(sessionId: string, tool: { name: string; args: any }) {
    this.emit(sessionId, 'tool_use', { ...tool, ts: new Date().toISOString() })
  }

  emitToolResult(sessionId: string, result: { name: string; result: any }) {
    this.emit(sessionId, 'tool_result', { ...result, ts: new Date().toISOString() })
  }

  emitComplete(sessionId: string) {
    this.emit(sessionId, 'complete', { ts: new Date().toISOString() })
  }

  emitError(sessionId: string, error: string) {
    this.emit(sessionId, 'error', { error, ts: new Date().toISOString() })
  }

  startPingLoop() {
    setInterval(() => {
      for (const [sessionId] of this.subscribers) {
        this.emit(sessionId, 'ping', { ts: new Date().toISOString() })
      }
    }, 15_000)
  }
}

export const sseHub = new SSEHub()
