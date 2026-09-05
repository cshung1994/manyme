import { PLATFORM_FEE } from './utils'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export async function fetchAgents() {
  const res = await fetch(`${API_BASE}/api/agents`)
  if (!res.ok) throw new Error('Failed to fetch agents')
  return res.json()
}

export async function fetchAgent(id: string) {
  const res = await fetch(`${API_BASE}/api/agents/${id}`)
  if (!res.ok) throw new Error('Failed to fetch agent')
  return res.json()
}

export async function fetchSessions() {
  const res = await fetch(`${API_BASE}/api/sessions`)
  if (!res.ok) throw new Error('Failed to fetch sessions')
  return res.json()
}

export async function createSession(agentId: number, userWallet: string, curatorRate: number) {
  const totalRate = curatorRate + PLATFORM_FEE
  const res = await fetch(`${API_BASE}/api/sessions/0/spawn`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agentId,
      userWallet,
      totalRate,
      curatorRate,
      platformFee: PLATFORM_FEE,
      depositAmount: totalRate * 3600,
    }),
  })
  if (!res.ok) throw new Error('Failed to create session')
  return res.json()
}
