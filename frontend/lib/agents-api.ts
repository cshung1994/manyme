const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

import type { SignedHeaders as AuthHeaders } from './sign-action'
export type { AuthHeaders }

// Agent CRUD
export async function fetchAgents(params?: { category?: string; q?: string; creator?: string }): Promise<any[]> {
  const searchParams = new URLSearchParams()
  if (params?.category && params.category !== 'all') searchParams.set('category', params.category)
  if (params?.q) searchParams.set('q', params.q)
  if (params?.creator) searchParams.set('creator', params.creator)
  const qs = searchParams.toString()
  const res = await fetch(`${API}/api/agents${qs ? `?${qs}` : ''}`)
  if (!res.ok) throw new Error('Failed to fetch agents')
  return res.json()
}

export async function fetchAgent(id: string): Promise<any> {
  const res = await fetch(`${API}/api/agents/${id}`)
  if (!res.ok) throw new Error('Failed to fetch agent')
  return res.json()
}

export async function createAgent(data: any, auth: AuthHeaders): Promise<any> {
  const res = await fetch(`${API}/api/agents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to create agent')
  }
  return res.json()
}

export async function deleteAgent(id: string, auth: AuthHeaders): Promise<void> {
  const res = await fetch(`${API}/api/agents/${id}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', ...auth },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to delete agent')
  }
}

export async function rateAgent(id: string, rating: number, auth: AuthHeaders): Promise<{ avg_rating: number }> {
  const res = await fetch(`${API}/api/agents/${id}/rate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify({ rating }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to rate agent')
  }
  return res.json()
}

export async function fetchUserRating(id: string, wallet: string): Promise<number | null> {
  const res = await fetch(`${API}/api/agents/${id}/rating?wallet=${wallet}`)
  if (!res.ok) return null
  const data = await res.json()
  return data.rating
}

export async function fetchAgentStats(id: string): Promise<any> {
  const res = await fetch(`${API}/api/agents/${id}/stats`)
  if (!res.ok) throw new Error('Failed to fetch stats')
  return res.json()
}

export async function fetchAgentExecutions(id: string, wallet?: string): Promise<any[]> {
  const params = wallet ? `?wallet=${wallet}` : ''
  const res = await fetch(`${API}/api/agents/${id}/executions${params}`)
  if (!res.ok) throw new Error('Failed to fetch executions')
  return res.json()
}

// Billing
export async function fetchBalance(wallet: string): Promise<{ wallet: string; balance: number; total_deposited: number; total_spent: number }> {
  const res = await fetch(`${API}/api/agents/billing/balance?wallet=${wallet}`)
  if (!res.ok) throw new Error('Failed to fetch balance')
  return res.json()
}

export async function depositFunds(amount: number, auth: AuthHeaders, txHash?: string): Promise<{ wallet: string; balance: number; total_deposited: number; total_spent: number }> {
  const res = await fetch(`${API}/api/agents/billing/deposit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify({ amount, txHash }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to deposit')
  }
  return res.json()
}

// Compression
export async function compressContent(content: string, type: string): Promise<any> {
  const res = await fetch(`${API}/api/agents/compress`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, type }),
  })
  if (!res.ok) throw new Error('Failed to compress')
  return res.json()
}

// Sessions
export async function createSession(agentId: string, inputs: Record<string, string>, auth: AuthHeaders): Promise<{ id: string }> {
  const res = await fetch(`${API}/api/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify({ agentId, inputs }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to create session')
  }
  return res.json()
}

export async function chatInSession(sessionId: string, message: string, history: any[], auth?: AuthHeaders): Promise<{ reply: string; toolCallCount: number }> {
  const res = await fetch(`${API}/api/sessions/${sessionId}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(auth ?? {}) },
    body: JSON.stringify({ message, history }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to chat in session')
  }
  return res.json()
}

export async function pauseSession(id: string, auth: AuthHeaders): Promise<void> {
  const res = await fetch(`${API}/api/sessions/${id}/pause`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to pause session')
  }
}

export async function resumeSession(id: string, auth: AuthHeaders): Promise<void> {
  const res = await fetch(`${API}/api/sessions/${id}/resume`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to resume session')
  }
}

export async function stopSession(id: string, auth: AuthHeaders): Promise<void> {
  const res = await fetch(`${API}/api/sessions/${id}/stop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to stop session')
  }
}

export async function fetchSessions(wallet: string): Promise<any[]> {
  const res = await fetch(`${API}/api/sessions?wallet=${wallet}`)
  if (!res.ok) throw new Error('Failed to fetch sessions')
  return res.json()
}

// ─── Skill aliases (agents and skills are unified) ───────────

export const fetchSkill = fetchAgent
export const deleteSkill = deleteAgent
export const rateSkill = rateAgent
export const fetchSkillExecutions = fetchAgentExecutions

export async function runSkill(id: string, inputs: Record<string, unknown>, auth: AuthHeaders): Promise<any> {
  const res = await fetch(`${API}/api/agents/${id}/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify({ inputs }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to run agent')
  }
  return res.json()
}

export async function runSkillStream(
  id: string,
  inputs: Record<string, unknown>,
  auth: AuthHeaders,
  onChunk: (text: string) => void,
  onComplete: (stats: { executionId: string; durationMs: number; tokensUsed: number | null; toolCallCount?: number }) => void,
  onError: (error: string) => void,
  onToolUse?: (calls: Array<{ name: string; args: unknown }>) => void,
  onToolResult?: (results: Array<{ name: string; hasError: boolean }>, totalCalls: number) => void,
): Promise<void> {
  const res = await fetch(`${API}/api/agents/${id}/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify({ inputs }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to start stream')
  }
  const reader = res.body?.getReader()
  if (!reader) throw new Error('No response body')
  const decoder = new TextDecoder()
  let buffer = ''
  let currentEvent = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) {
        if (line.startsWith('event: ')) currentEvent = line.slice(7)
        else if (line.startsWith('data: ')) {
          const data = JSON.parse(line.slice(6))
          if (currentEvent === 'chunk') onChunk(data.text)
          else if (currentEvent === 'complete') onComplete(data)
          else if (currentEvent === 'error') onError(data.error)
          else if (currentEvent === 'tool_use' && onToolUse) onToolUse(data.calls)
          else if (currentEvent === 'tool_result' && onToolResult) onToolResult(data.results, data.totalCalls)
        }
      }
    }
  } finally {
    reader.cancel()
  }
}

export async function chatWithSkill(
  id: string,
  message: string,
  history: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>,
  inputs: Record<string, unknown>,
  auth?: AuthHeaders,
): Promise<{ reply: string; tokensUsed: number | null; toolCallCount: number }> {
  const endpoint = auth ? `${API}/api/agents/${id}/chat` : `${API}/api/agents/${id}/chat-demo`
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(auth ?? {}) },
    body: JSON.stringify({ message, history, inputs }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to chat with agent')
  }
  return res.json()
}
