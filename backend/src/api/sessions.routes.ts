import { Hono } from 'hono'
import { getDb } from '../db/client.js'
import {
  startSession,
  pauseSession,
  resumeSession,
  stopSession,
  chatInSession,
  getSessionDetails,
} from '../services/session/liveSessionOrchestrator.js'
import { sseHub } from '../services/realtime/sseHub.js'
import { requireSignature, type SignatureEnv } from '../middleware/verifySignature.js'

export const sessionsRoutes = new Hono<SignatureEnv>()

// ─── Public read routes ──────────────────────────────────────

sessionsRoutes.get('/', (c) => {
  const wallet = c.req.query('wallet')
  const db = getDb()

  const rows = wallet
    ? db
        .prepare('SELECT * FROM sessions WHERE user_wallet = $wallet ORDER BY created_at DESC LIMIT 50')
        .all({ $wallet: wallet.toLowerCase() })
    : db.prepare('SELECT * FROM sessions ORDER BY created_at DESC LIMIT 50').all()

  return c.json(rows)
})

sessionsRoutes.get('/:id', (c) => {
  const session = getSessionDetails(c.req.param('id'))
  if (!session) return c.json({ error: 'Not found' }, 404)
  return c.json(session)
})

sessionsRoutes.get('/:id/stream', (c) => {
  const sessionId = c.req.param('id')
  const lastEventId = parseInt(c.req.header('Last-Event-ID') || '0')

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()
      controller.enqueue(
        encoder.encode(`event: connected\ndata: ${JSON.stringify({ sessionId })}\n\n`),
      )

      const sub = sseHub.subscribe(sessionId, controller, lastEventId)

      c.req.raw.signal?.addEventListener('abort', () => {
        sseHub.unsubscribe(sessionId, sub)
        try { controller.close() } catch { /* already closed */ }
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
})

// ─── Authenticated write routes ──────────────────────────────

sessionsRoutes.post(
  '/',
  requireSignature('create-session'),
  async (c) => {
    const wallet: string = c.get('verifiedWallet')
    const body = await c.req.json<{ agentId?: string; inputs?: Record<string, string> }>()

    if (!body.agentId) {
      return c.json({ error: 'agentId is required' }, 400)
    }

    try {
      const { sessionId } = startSession(body.agentId, wallet, body.inputs)
      const details = getSessionDetails(sessionId)

      return c.json(
        {
          id: sessionId,
          status: details?.status ?? 'active',
          agent_id: body.agentId,
        },
        201,
      )
    } catch (e: any) {
      const status = e.message?.includes('not found') ? 404 : 400
      return c.json({ error: e.message }, status)
    }
  },
)

sessionsRoutes.post(
  '/:id/chat',
  async (c) => {
    const sessionId = c.req.param('id')
    const body = await c.req.json<{
      message?: string
      history?: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>
    }>()

    if (!body.message || typeof body.message !== 'string') {
      return c.json({ error: 'message is required and must be a string' }, 400)
    }
    if (body.history && !Array.isArray(body.history)) {
      return c.json({ error: 'history must be an array' }, 400)
    }

    try {
      const { reply, toolCallCount } = await chatInSession(
        sessionId,
        body.message,
        body.history ?? [],
      )
      return c.json({ reply, toolCallCount })
    } catch (e: any) {
      const status = e.message?.includes('not found') ? 404 : 400
      return c.json({ error: e.message }, status)
    }
  },
)

sessionsRoutes.post(
  '/:id/pause',
  requireSignature('pause-session'),
  (c) => {
    const wallet: string = c.get('verifiedWallet')
    const sessionId = c.req.param('id')

    try {
      pauseSession(sessionId, wallet)
      return c.json({ id: sessionId, status: 'paused' })
    } catch (e: any) {
      const status = e.message?.includes('not found') ? 404 : 403
      return c.json({ error: e.message }, status)
    }
  },
)

sessionsRoutes.post(
  '/:id/resume',
  requireSignature('resume-session'),
  (c) => {
    const wallet: string = c.get('verifiedWallet')
    const sessionId = c.req.param('id')

    try {
      resumeSession(sessionId, wallet)
      return c.json({ id: sessionId, status: 'active' })
    } catch (e: any) {
      const status = e.message?.includes('not found') ? 404 : 403
      return c.json({ error: e.message }, status)
    }
  },
)

sessionsRoutes.post(
  '/:id/stop',
  requireSignature('stop-session'),
  (c) => {
    const wallet: string = c.get('verifiedWallet')
    const sessionId = c.req.param('id')

    try {
      stopSession(sessionId, wallet)
      return c.json({ id: sessionId, status: 'stopped' })
    } catch (e: any) {
      const status = e.message?.includes('not found') ? 404 : 403
      return c.json({ error: e.message }, status)
    }
  },
)
